// ===== Village store: presence + chat + visit + cloud sync =====
// GameCanvas và UI chỉ gọi store này, không đụng trực tiếp transport.
import { create } from 'zustand';
import type { ChatMsg, FarmPayload, FarmSnapshot, NetTransport, RemotePlayer, StealWire } from './transport';
import { LocalTransport } from './local';
import { SupabaseTransport, supabaseConfigured } from './supabase';
import { SocketTransport, lanServerAvailable } from './socket';
import { PRESENCE_PROTO, codeFromName, getPresenceId } from './session';
import { useGame } from '../game/store';
import { CROPS } from '../game/data';
import { sfx } from '../game/audio';

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
  /** đang xử lý 1 vụ hái trộm (chống bấm đúp) */
  stealing: boolean;
  /** tên trộm mới nhất mò vào farm mình (để vẽ bóng "Gâu gâu!" trên đầu nó 5s) */
  lastThief: { name: string; at: number } | null;

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
  /** Hái trộm 1 ô chín trong farm đang thăm: chó có thể cắn → mất trắng + bị đuổi */
  stealFromVisit(plot: number): Promise<void>;
}

let transport: NetTransport | null = null;
let unsubs: (() => void)[] = [];
let farmTimer: number | null = null;
let lastPos = 0;

// ---- KÊNH TIN NHẮN GAME ẨN (thi câu cá / ma sói / ...): đi qua chat broadcast
// nhưng UI chat không hiện — module game đăng ký tiền tố để nhận. Tin đi + về
// (cả người gửi cũng nhận echo) nên bên gửi KHÔNG tự áp dụng, chờ echo để 1 luồng.
// ----
type GameMsgCb = (m: ChatMsg) => void;
const gameHandlers: { prefix: string; cb: GameMsgCb }[] = [];
/** Đăng ký nhận tin nhắn game có tiền tố (trả về hàm hủy). Gọi ở top-level module game. */
export function onGameMsg(prefix: string, cb: GameMsgCb): () => void {
  gameHandlers.push({ prefix, cb });
  return () => {
    const i = gameHandlers.findIndex((h) => h.cb === cb);
    if (i >= 0) gameHandlers.splice(i, 1);
  };
}
/** Gửi tin nhắn game ẩn (không hiện chat). Tên/số tự làm sạch ký tự phân tách. */
export function sendGameMsg(text: string) {
  if (!transport) return;
  transport.sendChat(text);
}
/** Tên mình (đã làm sạch) + id presence — định danh người chơi trong game chung */
export function gameMe(): { id: string; name: string } {
  const raw = useGame.getState().name || 'Bạn';
  return { id: getPresenceId(), name: raw.replace(/[|,]/g, '').slice(0, 16) || 'Bạn' };
}
/** true nếu tin nhắn game đã xử lý (chống echo trùng) — mỗi store game giữ 1 Set riêng */
export function markSeen(seen: Set<string>, id: string): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 300) {
    const drop = [...seen].slice(0, seen.size - 300);
    for (const d of drop) seen.delete(d);
  }
  return false;
}

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
      baLove: g.baLove, loveClaim: g.loveClaim, fundTotal: g.fundTotal, fundClaim: g.fundClaim,
      daily: g.daily, junkAt: g.junkAt,
      quality: g.quality,
    },
  };
}

// ---------- trộm farm: giới hạn + chó giữ nhà ----------
// Mỗi farm chỉ bị hái tối đa 3 cây/ngày (chống phá). Chó Vàng/Mực luôn trực:
// tỉ lệ cắn = 45% + 10% mỗi cây đã mất hôm nay (tối đa 80%).
export const STEAL_MAX_PER_DAY = 3;
function stealDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function stealKey(victim: string): string { return `nt-steal:${stealDay()}:${victim}`; }
/** số cây đã hái trộm ở farm này hôm nay */
export function stealCountToday(victim: string): number {
  try { return Number(localStorage.getItem(stealKey(victim)) || 0); } catch { return 0; }
}
function bumpSteal(victim: string) {
  try { localStorage.setItem(stealKey(victim), String(stealCountToday(victim) + 1)); } catch { /* ignore */ }
}
/** tỉ lệ bị chó cắn khi hái trộm ở farm này */
export function dogCatchChance(victim: string): number {
  return Math.min(0.8, 0.45 + 0.1 * stealCountToday(victim));
}

/** Chủ farm nhận báo trộm: trừ cây (nếu còn) + cho chó sủa */
function handleFarmSteal(ev: StealWire) {
  if (!transport || !ev?.code) return;
  if (ev.code.toUpperCase() !== transport.code.toUpperCase()) return; // không phải farm mình
  const g = useGame.getState();
  useVillage.setState({ lastThief: { name: ev.thief, at: Date.now() } });
  if (ev.caught) {
    g.toast(`Chó Vàng cắn ${ev.thief}, đuổi khỏi farm rồi!`);
    sfx.bark();
    return;
  }
  const applied = g.applyVictimSteal(ev.plot, ev.crop);
  const cname = CROPS[ev.crop]?.name ?? ev.crop;
  g.toast(applied ? `Bị ${ev.thief} hái trộm ${cname}! Chó sủa ầm ĩ!` : `${ev.thief} mò vào farm nhưng hụt rồi!`);
  sfx.bark();
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
  stealing: false,
  lastThief: null,

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
        // tin nhắn game ẩn → chuyển cho module game, KHÔNG hiện lên chat
        for (const h of gameHandlers) {
          if (msg.text.startsWith(h.prefix)) {
            try { h.cb(msg); } catch (e) { console.warn('[gameMsg]', e); }
            return;
          }
        }
        set((s) => ({ chat: [...s.chat.slice(-49), msg] }));
        // nếu là người khác → gắn bubble vào player
        if (msg.fromId !== getPresenceId()) {
          // bubble đi theo presence lần tới; ở local gắn trực tiếp:
          // (supabase đã gắn trong transport)
        }
      }),
      transport.onStatus((ok) => set({ cloud: transport!.mode === 'local' ? 'local' : ok ? 'synced' : 'error' })),
      // báo trộm farm mình (chủ farm): trừ cây + chó sủa (backend không hỗ trợ thì thôi)
      ...(transport.onFarmEvent ? [transport.onFarmEvent((ev) => handleFarmSteal(ev))] : []),
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
    set({ connected: false, players: [], chat: [], visiting: null, cloud: 'offline', mismatch: false, stealing: false, lastThief: null });
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
    // --- lệnh ẩn "pupu": ném trứng vào xung quanh, KHÔNG hiện chữ lên màn hình ---
    if (t.toLowerCase() === 'pupu') {
      // phát qua kênh emote (presence) để cả làng thấy trứng bay,
      // không gửi chat nên không ai thấy chữ "pupu"
      get().sendEmote('🥚');
      // tiếng vút + bẹp khớp nhịp 3 quả trứng (tung ở 0.15/0.6/1.05s, bay 0.6s)
      sfx.whoosh();
      setTimeout(() => sfx.whoosh(), 450);
      setTimeout(() => sfx.whoosh(), 900);
      setTimeout(() => sfx.splat(), 750);
      setTimeout(() => sfx.splat(), 1200);
      setTimeout(() => sfx.splat(), 1650);
      useGame.getState().toast('PUPU! Ném trứng thối vào đứa đứng gần nhất 🥚💨');
      return;
    }
    // --- lệnh ẩn "kiki": gọi chó khổng lồ chạy quanh mình rồi chạy đi ---
    if (t.toLowerCase() === 'kiki') {
      get().sendEmote('🐕');
      sfx.bark();
      setTimeout(() => sfx.bark(), 900);
      useGame.getState().toast('KIKI! Chó khổng lồ tới chơi 🐕💨');
      return;
    }
    // --- lệnh ẩn "mimi": gọi đàn mèo từ mọi phía vây quanh mình ---
    if (t.toLowerCase() === 'mimi') {
      get().sendEmote('🐈');
      sfx.meow();
      setTimeout(() => sfx.meow(), 500);
      setTimeout(() => sfx.meow(), 1100);
      useGame.getState().toast('MIMI! Đàn mèo kéo tới vây quanh bạn 🐈💖');
      return;
    }
    // --- lệnh ẩn "kemkem": triệu hồi mèo cam Kem đi theo mình mãi mãi (đúng 1 con) ---
    if (t.toLowerCase() === 'kemkem') {
      const g = useGame.getState();
      // đã có Kem rồi → không có gì xảy ra (đúng yêu cầu: chỉ 1 con duy nhất)
      if (g.summonKem()) {
        sfx.meow();
        g.toast('KEMKEM! Mèo cam Kem xuất hiện, từ nay bám theo bạn khắp farm + công viên 🐱💖');
      }
      return;
    }
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

  async stealFromVisit(plot) {
    const v = get();
    if (v.stealing || !v.visiting || !transport) return;
    const g = useGame.getState();
    if (g.scene !== 'farm') return;
    const code = v.visiting.code;
    set({ stealing: true });
    try {
      // lấy farm mới nhất để chắc cây còn chín (tránh hái trùng ô đã mất)
      let snap: FarmSnapshot | null = null;
      try { snap = await transport.fetchFarm(code); } catch { snap = null; }
      const target = (snap ?? v.visiting.snap).plots?.[plot];
      if (!target || target.locked || target.state !== 'ready' || !target.crop) {
        g.toast('Ô này chưa chín (hoặc bị hái mất rồi)!');
        return;
      }
      if (stealCountToday(code) >= STEAL_MAX_PER_DAY) {
        g.toast(`Hôm nay hái đủ ${STEAL_MAX_PER_DAY} cây ở farm này rồi, mai quay lại!`);
        return;
      }
      const crop = target.crop;
      const cname = CROPS[crop]?.name ?? crop;
      const thiefName = g.name || 'Ai đó';
      // --- chó giữ nhà: Vàng + Mực luôn trực ---
      if (Math.random() < dogCatchChance(code)) {
        g.setThiefBite();
        sfx.bark();
        setTimeout(() => sfx.error(), 550);
        g.toast(`GÂU GÂU! Chó nhà ${v.visiting.snap.name} cắn! Bị đuổi khỏi farm!`);
        try { transport.stealNotify?.({ code, plot, crop, thief: thiefName, caught: true }); } catch { /* ignore */ }
        // cho xem hiệu ứng bị cắn 1.5s rồi đuổi về
        setTimeout(() => get().leaveVisit(), 1500);
        return;
      }
      // --- trộm thành công ---
      g.addInv(crop, 1);
      g.addXP(8);
      sfx.harvest();
      bumpSteal(code);
      g.toast(`Hái trộm +1 ${cname}! Coi chừng chó… (${stealCountToday(code)}/${STEAL_MAX_PER_DAY} hôm nay)`);
      // cập nhật bản đang xem để không hái lại ô này
      set((s) => (s.visiting
        ? {
          visiting: {
            code,
            snap: {
              ...s.visiting.snap,
              plots: s.visiting.snap.plots.map((p, i) => (i === plot
                ? { ...p, state: 'soil' as const, crop: null, progress: 0, watered: false, waterLeft: 0, pest: false }
                : p)),
            },
          },
        }
        : {}));
      // trừ cây bên chủ farm: online → báo realtime, offline → ghi vào DB server
      const victimOnline = get().players.some((p) => (p.code || '').toUpperCase() === code);
      if (transport.mode === 'socket' && !victimOnline) {
        try {
          await fetch(`/api/farms/${encodeURIComponent(code)}/steal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plot, crop }),
          });
        } catch { /* ignore */ }
      } else {
        try { transport.stealNotify?.({ code, plot, crop, thief: thiefName, caught: false }); } catch { /* ignore */ }
      }
    } finally {
      set({ stealing: false });
    }
  },

  toggleBots() {
    set((s) => ({ demoBots: !s.demoBots }));
  },
}));

/** players để vẽ = online thật + bots (nếu bật), lọc theo map đang đứng */
export function visiblePlayers(now: number, map?: 'farm' | 'town' | 'interior'): RemotePlayer[] {
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

