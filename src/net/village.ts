// ===== Village store: presence + chat + visit + cloud sync =====
// GameCanvas và UI chỉ gọi store này, không đụng trực tiếp transport.
import { create } from 'zustand';
import type { ChatMsg, FarmPayload, FarmSnapshot, NetTransport, RemotePlayer } from './transport';
import { LocalTransport } from './local';
import { SupabaseTransport, supabaseConfigured } from './supabase';
import { SocketTransport, lanServerAvailable } from './socket';
import { PRESENCE_PROTO, codeFromName, getPresenceId } from './session';
import { useGame } from '../game/store';

export type CloudState = 'offline' | 'local' | 'syncing' | 'synced' | 'error';
export type NetMode = 'local' | 'supabase' | 'socket';

interface Visiting { code: string; snap: FarmSnapshot }

interface VillageState {
  connected: boolean;
  mode: NetMode;
  myCode: string;
  players: RemotePlayer[];
  chat: ChatMsg[];
  visiting: Visiting | null;
  cloud: CloudState;
  selfBubble: string;
  selfBubbleAt: number;
  selfEmote: string;
  selfEmoteAt: number;
  demoBots: boolean;
  /** true khi thấy người chơi chạy bản game khác mình → nhắc reload cả 2 tab */
  mismatch: boolean;

  connect(): void;
  disconnect(): void;
  reconnect(): void;
  pushPosition(x: number, y: number, dir: 1 | -1, moving: boolean): void;
  pushFarmNow(): void;
  sendChat(text: string): void;
  sendEmote(emote: string): void;
  visit(code: string): Promise<boolean>;
  leaveVisit(): void;
  toggleBots(): void;
}

let transport: NetTransport | null = null;
let unsubs: (() => void)[] = [];
let farmTimer: number | null = null;
let lastPos = 0;

/** Thứ tự ưu tiên: LAN server (nếu có) → Supabase (nếu cấu hình) → làng local */
async function buildTransport(): Promise<NetTransport> {
  // presence id riêng mỗi tab → 2 tab cùng máy vẫn thấy nhau
  const pid = getPresenceId();
  // mã farm suy từ username → cùng username là cùng mã trên mọi máy/tab
  const g = useGame.getState();
  const code = g.name ? codeFromName(g.name) : undefined;
  if (await lanServerAvailable()) return new SocketTransport(pid, code ?? 'ABCDEF');
  if (supabaseConfigured()) return new SupabaseTransport(pid, code);
  return new LocalTransport(pid, code);
}

function snapshotOfGame(): FarmPayload {
  const g = useGame.getState();
  return {
    username: g.name,
    name: g.name, avatar: g.avatar, level: g.level, day: g.day,
    plots: g.plots, fishes: g.fishes, animals: g.animals,
    data: {
      name: g.name, avatar: g.avatar,
      xu: g.xu, gem: g.gem, level: g.level, xp: g.xp,
      day: g.day, dayTime: g.dayTime,
      inv: g.inv, plots: g.plots, fishes: g.fishes, animals: g.animals,
      pondSlots: g.pondSlots, coopCap: g.coopCap,
      stats: g.stats, questIdx: g.questIdx, uidSeq: g.uidSeq,
    },
  };
}

// --- demo bots: 2 nông dân đi loanh quanh để test 1 tab vẫn thấy làng đông ---
const BOTS: RemotePlayer[] = [
  { id: 'bot-lan', name: 'Lan', avatar: 1, x: 400, y: 500, dir: 1, moving: true, map: 'farm', updatedAt: Date.now() },
  { id: 'bot-teo', name: 'Tèo', avatar: 2, x: 1200, y: 900, dir: -1, moving: true, map: 'farm', updatedAt: Date.now() },
  { id: 'bot-dao', name: 'Đào', avatar: 3, x: 800, y: 640, dir: 1, moving: true, map: 'town', updatedAt: Date.now() },
];
function botPositions(t: number): RemotePlayer[] {
  return BOTS.map((b, i) => ({
    ...b,
    x: b.x + Math.sin(t / 3000 + i * 2) * 120,
    y: b.y + Math.cos(t / 4200 + i) * 90,
    dir: (Math.cos(t / 3000 + i * 2) > 0 ? 1 : -1) as 1 | -1,
    moving: true,
    updatedAt: Date.now(),
  }));
}

export const useVillage = create<VillageState>()((set, get) => ({
  connected: false,
  mode: supabaseConfigured() ? 'supabase' : 'local',
  myCode: '',
  players: [],
  chat: [],
  visiting: null,
  cloud: 'offline',
  selfBubble: '',
  selfBubbleAt: 0,
  selfEmote: '',
  selfEmoteAt: 0,
  demoBots: false,
  mismatch: false,

  async connect() {
    if (transport || get().connected) return;
    // đang dò mạng → hiện syncing trước để HUD phản hồi ngay
    set({ cloud: 'syncing' });
    transport = await buildTransport();
    const g = useGame.getState();
    transport.connect({ id: getPresenceId(), name: g.name, avatar: g.avatar });
    set({ connected: true, mode: transport.mode, myCode: transport.code, cloud: transport.mode === 'local' ? 'local' : 'syncing' });
    unsubs = [
      transport.onPlayers((list) => {
        const mismatch = list.some((p) => (p.proto ?? 1) !== PRESENCE_PROTO);
        if (mismatch && !get().mismatch) {
          console.warn('[village] lệch bản presence: tab khác chạy build khác, hãy reload cả 2 tab');
        }
        set({ players: list, mismatch });
      }),
      transport.onChat((msg) => {
        set((s) => ({ chat: [...s.chat.slice(-49), msg] }));
        // nếu là người khác → gắn bubble vào player
        if (msg.fromId !== getPresenceId()) {
          // bubble đi theo presence lần tới; ở local gắn trực tiếp:
          // (supabase đã gắn trong transport)
        }
      }),
      transport.onStatus((ok) => set({ cloud: transport!.mode === 'local' ? 'local' : ok ? 'synced' : 'error' })),
    ];
    // đẩy farm định kỳ (cloud save)
    farmTimer = window.setInterval(() => {
      if (get().visiting) return; // đang thăm farm người khác thì không ghi đè
      transport?.pushFarm(snapshotOfGame());
    }, 10000);
    // đẩy ngay 1 lần
    setTimeout(() => transport?.pushFarm(snapshotOfGame()), 2000);
  },

  disconnect() {
    unsubs.forEach((u) => u());
    unsubs = [];
    if (farmTimer) clearInterval(farmTimer);
    farmTimer = null;
    transport?.disconnect();
    transport = null;
    lastPos = 0;
    set({ connected: false, players: [], chat: [], visiting: null, cloud: 'offline', mismatch: false });
  },

  reconnect() {
    get().disconnect();
    void get().connect();
  },

  pushPosition(x, y, dir, moving) {
    const now = Date.now();
    if (now - lastPos < 120) return; // ~8/s
    lastPos = now;
    const g = useGame.getState();
    // gửi kèm map + emote + mã farm đang thăm (farm riêng tư: chỉ chủ + khách cùng thăm thấy nhau)
    transport?.pushPosition(x, y, dir, moving, get().selfBubble || undefined, {
      map: g.scene,
      emote: get().selfEmote || undefined,
      visit: get().visiting?.code ?? null,
    });
    void g;
  },

  pushFarmNow() {
    transport?.pushFarm(snapshotOfGame());
  },

  sendChat(text) {
    const t = text.trim().slice(0, 80);
    if (!t || !transport) return;
    transport.sendChat(t);
    set({ selfBubble: t, selfBubbleAt: Date.now() });
    setTimeout(() => {
      if (Date.now() - get().selfBubbleAt >= 4900) set({ selfBubble: '' });
    }, 5000);
  },

  sendEmote(emote) {
    const e = (emote || '').trim().slice(0, 20);
    if (!e) return;
    set({ selfEmote: e, selfEmoteAt: Date.now() });
    // đẩy ngay 1 gói presence để bạn bè thấy action tức thì
    lastPos = 0;
    const g = useGame.getState();
    void g;
    setTimeout(() => {
      if (Date.now() - get().selfEmoteAt >= 3900) set({ selfEmote: '' });
    }, 4000);
  },

  async visit(code) {
    // cho phép dán cả link mời ?visit=ABC123 hoặc mã kèm khoảng trắng
    let c = (code || '').trim().toUpperCase();
    const m = c.match(/VISIT=([A-Z0-9]{4,8})/);
    if (m) c = m[1];
    c = c.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (!c) { useGame.getState().toast('Nhập mã farm 6 ký tự của bạn bè!'); return false; }
    // chưa connect (vào bằng link mời sớm) → connect trước rồi mới tìm
    if (!transport) {
      try { await get().connect(); } catch { /* ignore */ }
    }
    if (!transport) { useGame.getState().toast('Chưa vào làng, thử lại sau 2 giây!'); return false; }
    if (c === transport.code) { useGame.getState().toast('Đây là farm của bạn mà!'); return false; }
    useGame.getState().toast('Đang tìm farm ' + c + '…');
    let snap: FarmSnapshot | null = null;
    try {
      snap = await transport.fetchFarm(c);
    } catch {
      snap = null;
    }
    if (!snap || !snap.plots) {
      const modeHint = transport.mode === 'local'
        ? ' (Local: bạn phải mở tab farm đó trên cùng máy)'
        : transport.mode === 'socket'
          ? ' (LAN: chủ farm phải từng online để server lưu)'
          : ' (Cloud: chủ farm phải từng online)';
      useGame.getState().toast('Không tìm thấy farm mã ' + c + modeHint);
      return false;
    }
    set({ visiting: { code: c, snap } });
    useGame.getState().toast(`Đang thăm farm của ${snap.name}!`);
    return true;
  },

  leaveVisit() {
    set({ visiting: null });
  },

  toggleBots() {
    set((s) => ({ demoBots: !s.demoBots }));
  },
}));

/** players để vẽ = online thật + bots (nếu bật), lọc theo map đang đứng */
export function visiblePlayers(now: number, map?: 'farm' | 'town'): RemotePlayer[] {
  const { players, demoBots } = useVillage.getState();
  const want = map ?? useGame.getState().scene;
  const sameMap = (p: RemotePlayer) => (p.map ?? 'farm') === want;
  const real = players.filter(sameMap);
  if (!demoBots) return real;
  return [...real, ...botPositions(now).filter(sameMap)];
}

/**
 * Người thấy được ở FARM (riêng tư):
 * - ở nhà mình: chỉ mình (+bots demo), KHÔNG thấy nông dân khác
 * - đang thăm farm mã X: thấy chủ farm (nếu chủ đang ở nhà) + khách cùng thăm X
 */
export function farmVisible(now: number, visitingCode: string | null): RemotePlayer[] {
  const { players, demoBots } = useVillage.getState();
  if (!visitingCode) {
    if (!demoBots) return [];
    return botPositions(now).filter((b) => (b.map ?? 'farm') === 'farm');
  }
  return players.filter((p) =>
    p.visit === visitingCode ||
    (p.code === visitingCode && (p.map ?? 'farm') === 'farm' && !p.visit),
  );
}

/** số người đang ở công viên (để HUD hiện) */
export function townCount(): number {
  const { players } = useVillage.getState();
  return players.filter((p) => (p.map ?? 'farm') === 'town').length;
}
