// ===== Village store: presence + chat + visit + cloud sync =====
// GameCanvas và UI chỉ gọi store này, không đụng trực tiếp transport.
import { create } from 'zustand';
import type { ChatMsg, FarmPayload, FarmSnapshot, NetTransport, RemotePlayer } from './transport';
import { LocalTransport } from './local';
import { SupabaseTransport, supabaseConfigured } from './supabase';
import { SocketTransport, lanServerAvailable } from './socket';
import { codeFromName, getPlayerId } from './session';
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
  demoBots: boolean;

  connect(): void;
  disconnect(): void;
  pushPosition(x: number, y: number, dir: 1 | -1, moving: boolean): void;
  pushFarmNow(): void;
  sendChat(text: string): void;
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
  const pid = getPlayerId();
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
  { id: 'bot-lan', name: 'Lan', avatar: 1, x: 400, y: 500, dir: 1, moving: true, updatedAt: Date.now() },
  { id: 'bot-teo', name: 'Tèo', avatar: 2, x: 1200, y: 900, dir: -1, moving: true, updatedAt: Date.now() },
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
  demoBots: false,

  async connect() {
    if (transport || get().connected) return;
    // đang dò mạng → hiện syncing trước để HUD phản hồi ngay
    set({ cloud: 'syncing' });
    transport = await buildTransport();
    const g = useGame.getState();
    transport.connect({ id: getPlayerId(), name: g.name, avatar: g.avatar });
    set({ connected: true, mode: transport.mode, myCode: transport.code, cloud: transport.mode === 'local' ? 'local' : 'syncing' });
    unsubs = [
      transport.onPlayers((list) => set({ players: list })),
      transport.onChat((msg) => {
        set((s) => ({ chat: [...s.chat.slice(-49), msg] }));
        // nếu là người khác → gắn bubble vào player
        if (msg.fromId !== getPlayerId()) {
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
    transport?.disconnect();
    transport = null;
    set({ connected: false, players: [], chat: [], visiting: null, cloud: 'offline' });
  },

  pushPosition(x, y, dir, moving) {
    const now = Date.now();
    if (now - lastPos < 120) return; // ~8/s
    lastPos = now;
    const g = useGame.getState();
    // cập nhật tên/avatar nếu đổi sau khi connect
    transport?.pushPosition(x, y, dir, moving, get().selfBubble || undefined);
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

  async visit(code) {
    if (!transport) return false;
    const c = code.trim().toUpperCase();
    if (!c || c === transport.code) return false;
    // 1. farm của mình (local echo)
    const snap = await transport.fetchFarm(c);
    if (!snap || !snap.plots) {
      useGame.getState().toast('Không tìm thấy farm mã ' + c);
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

/** players để vẽ = online thật + bots (nếu bật) */
export function visiblePlayers(now: number): RemotePlayer[] {
  const { players, demoBots } = useVillage.getState();
  return demoBots ? [...players, ...botPositions(now)] : players;
}
