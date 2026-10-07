// ===== Casino client store: phòng + realtime + cược xu =====
// 2 chế độ:
// - socket (LAN server): server/index.js làm trọng tài (khuyên dùng, nhiều máy)
// - local (2 tab cùng máy / chơi với máy): BroadcastChannel + chủ phòng làm trọng tài
// Cược: 10-100 xu/ván. Trừ khi vào phòng chờ start? — thực tế trừ khi ván bắt đầu,
// thắng nhận pot = bet * số người (chia đều nếu hòa), hòa caro hoàn cược.
import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { useGame } from '../game/store';
import { getPresenceId } from './session';
import { fullDeck, shuffle, type Card } from '../game/casino/cards';
import { applyPass, applyPlay, botPick, newTienLenGame, validatePlay, type TienLenState } from '../game/casino/tienlen';
import { findBaiCaoWinners, newBaiCaoGame, type BaiCaoState } from '../game/casino/baicao';
import { applyCaroMove, caroBotMove, newCaroGame, type CaroState } from '../game/casino/caro';

export type CasinoGame = 'tienlen' | 'baicao' | 'caro';
export const CASINO_MIN_BET = 10;
export const CASINO_MAX_BET = 100;
/** Mỗi lượt tiến lên/caro 30s, vòng lật bài cào 45s — hết giờ tự đánh (đồng bộ với server) */
export const CASINO_TURN_MS = 30000;
export const CASINO_BAICAO_MS = 45000;
export const CASINO_GAMES: { id: CasinoGame; name: string; desc: string; emoji: string; max: number }[] = [
  { id: 'tienlen', name: 'Tiến lên', desc: '2-4 người • 13 lá • nhất ăn tất', emoji: '🃏', max: 4 },
  { id: 'baicao', name: 'Bài cào', desc: '2-4 người • 3 lá • nhiều nút thắng', emoji: '🎴', max: 4 },
  { id: 'caro', name: 'Caro', desc: '2 người • 12x12 • 5 liên tiếp', emoji: '⭕', max: 2 },
];

export interface CasinoPlayer {
  pid: string;
  name: string;
  avatar: number;
  bot?: boolean;
}

export interface CasinoRoom {
  id: string;
  game: CasinoGame;
  bet: number;
  pot?: number;
  hostPid: string;
  players: CasinoPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  state: TienLenState | BaiCaoState | CaroState | null;
  winners: string[] | null;
  updatedAt: number;
}

export interface CasinoRoomInfo {
  id: string;
  game: CasinoGame;
  bet: number;
  status: string;
  players: CasinoPlayer[];
  hostPid: string;
  updatedAt: number;
}

interface CasinoStore {
  transport: 'socket' | 'local';
  connected: boolean;
  rooms: CasinoRoomInfo[];
  room: CasinoRoom | null;
  solo: boolean; // true = chơi với máy, không public
  error: string;
  lockedBet: number; // xu đã đặt cho phòng hiện tại (đã trừ)
  deducted: boolean; // đã trừ xu ván này chưa
  settledKey: string; // key ván đã thanh toán (tránh cộng 2 lần)

  ensure(): void;
  refresh(): void;
  createRoom(game: CasinoGame, bet: number, withBot: boolean): void;
  joinRoom(id: string): void;
  leaveRoom(): void;
  addBot(): void;
  startRoom(): void;
  rematch(): void;
  // actions
  playCards(cards: Card[]): void;
  passTurn(): void;
  reveal(): void;
  moveCaro(r: number, c: number): void;
  setError(e: string): void;
}

let socket: Socket | null = null;
let bc: BroadcastChannel | null = null;
let announceTimer: number | null = null;
let listTimer: number | null = null;
let botTimer: number | null = null;
// local mode: phòng tôi làm chủ (authority)
const localHostRooms = new Map<string, CasinoRoom>();
// local mode: rooms thấy được (kèm timestamp)
const localSeen = new Map<string, { info: CasinoRoomInfo; at: number }>();

function myPid(): string {
  try { return getPresenceId(); } catch { return 'me-' + Math.floor(Math.random() * 1e6); }
}
function myPlayer(): CasinoPlayer {
  const g = useGame.getState();
  return { pid: myPid(), name: (g.name || 'Bạn').slice(0, 12), avatar: g.avatar ?? 0 };
}
function roomId4(): string {
  const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += CH[Math.floor(Math.random() * CH.length)];
  return s;
}
function clampBet(b: number): number {
  return Math.max(CASINO_MIN_BET, Math.min(CASINO_MAX_BET, Math.round(Number(b) || 10)));
}
async function lanAvailable(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('/api/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return false;
    const j = await r.json();
    return j?.mode === 'lan';
  } catch { return false; }
}

function publicOf(r: CasinoRoom): CasinoRoomInfo {
  return { id: r.id, game: r.game, bet: r.bet, status: r.status, players: r.players, hostPid: r.hostPid, updatedAt: r.updatedAt };
}

/** trừ xu khi ván bắt đầu (mỗi ván 1 lần), hoàn khi rời sớm, cộng khi thắng */
function settleIfFinished(room: CasinoRoom, prevStatus: string | null, settledKey: string): string {
  if (room.status !== 'finished' || !room) return settledKey;
  const key = room.id + ':' + (room.updatedAt ?? 0) + ':' + (room.winners?.join(',') ?? 'draw');
  if (settledKey === key) return settledKey;
  const g = useGame.getState();
  const me = myPid();
  const winners = room.winners ?? [];
  const pot = room.pot ?? room.bet * room.players.length;
  if (winners.includes(me)) {
    const share = Math.floor(pot / winners.length);
    g.addXu(share);
    g.toast(winners.length > 1 ? `Hòa! Mỗi người +${share} xu` : `Thắng +${share} xu! 🎉`);
  } else if (winners.length === 0) {
    // caro hòa → hoàn cược (đã trừ lúc start)
    g.addXu(room.bet);
    g.toast('Hòa! Hoàn lại cược');
  } else {
    g.toast('Thua mất cược, gỡ ván sau!');
  }
  void prevStatus;
  return key;
}

function botName(n: number): { name: string; avatar: number } {
  const names = ['Máy Lan', 'Máy Tèo', 'Máy Đào', 'Máy Bờm'];
  return { name: names[n % names.length], avatar: n % 4 };
}

export const useCasino = create<CasinoStore>()((set, get) => ({
  transport: 'local',
  connected: false,
  rooms: [],
  room: null,
  solo: false,
  error: '',
  lockedBet: 0,
  deducted: false,
  settledKey: '',

  setError(e) { set({ error: e }); },

  ensure() {
    if (socket || bc) return;
    // mặc định local (kênh tab) trước để UI hiện ngay, rồi nâng lên socket nếu có LAN
    bc = new BroadcastChannel('nongtrai-casino');
    bc.onmessage = (e) => handleLocalMsg(e.data);
    set({ transport: 'local', connected: true });
    announceTimer = window.setInterval(() => {
      // host quảng bá phòng waiting
      for (const r of localHostRooms.values()) {
        if (r.status !== 'waiting' || get().solo) continue;
        try { bc?.postMessage({ kind: 'announce', info: publicOf(r) }); } catch { /* ignore */ }
      }
      // dọn rooms hết hạn + tổng hợp
      const now = Date.now();
      for (const [id, v] of localSeen) if (now - v.at > 6000) localSeen.delete(id);
      if (get().transport === 'local' && !get().room) {
        set({ rooms: [...localSeen.values()].map((v) => v.info).sort((a, b) => b.updatedAt - a.updatedAt) });
      }
    }, 2000);
    void lanAvailable().then((ok) => {
      if (!ok) return;
      try {
        socket = io({ transports: ['websocket', 'polling'] });
        socket.on('connect', () => {
          set({ transport: 'socket', connected: true });
          get().refresh();
        });
        socket.on('casino:rooms', (list: CasinoRoomInfo[]) => {
          if (get().room) return; // đang trong phòng thì không đè list
          set({ rooms: (list || []).sort((a, b) => b.updatedAt - a.updatedAt) });
        });
        socket.on('casino:state', (room: CasinoRoom | null) => {
          applyRemoteState(room);
        });
        socket.on('casino:error', (p: { msg?: string }) => {
          set({ error: p?.msg || 'Lỗi casino' });
          useGame.getState().toast(p?.msg || 'Lỗi casino');
        });
        listTimer = window.setInterval(() => {
          if (get().transport === 'socket' && !get().room) socket?.emit('casino:list');
        }, 3000);
      } catch { /* giữ local */ }
    });
  },

  refresh() {
    if (get().transport === 'socket') socket?.emit('casino:list');
    else {
      // local: xin announce
      try { bc?.postMessage({ kind: 'list-req', from: myPid() }); } catch { /* ignore */ }
      set({ rooms: [...localSeen.values()].map((v) => v.info) });
    }
  },

  createRoom(game, bet, withBot) {
    const g = useGame.getState();
    bet = clampBet(bet);
    if (g.xu < bet) { g.toast(`Cần ít nhất ${bet} xu để chơi!`); return; }
    const me = myPlayer();
    if (get().transport === 'socket' && !withBot) {
      socket?.emit('casino:create', { pid: me.pid, game, bet, player: { name: me.name, avatar: me.avatar } });
      set({ lockedBet: bet, deducted: false, settledKey: '', solo: false, error: '' });
      return;
    }
    // local / solo: mình làm host (authority)
    const room: CasinoRoom = {
      id: roomId4(), game, bet, hostPid: me.pid,
      players: [me], status: 'waiting', state: null, winners: null, updatedAt: Date.now(),
    };
    if (withBot) {
      const max = game === 'caro' ? 2 : 4;
      const need = game === 'caro' ? 2 : 3;
      for (let i = 1; i < Math.min(max, need); i++) {
        const b = botName(i);
        room.players.push({ pid: `bot-${room.id}-${i}`, name: b.name, avatar: b.avatar, bot: true });
      }
    }
    localHostRooms.set(room.id, room);
    if (!withBot) {
      try { bc?.postMessage({ kind: 'announce', info: publicOf(room) }); } catch { /* ignore */ }
    }
    set({ room, rooms: [], lockedBet: bet, deducted: false, settledKey: '', solo: withBot, error: '' });
  },

  joinRoom(id) {
    const target = (id || '').trim().toUpperCase();
    if (!target) return;
    const g = useGame.getState();
    // tìm bet để check xu
    const info = get().rooms.find((r) => r.id === target);
    if (info && g.xu < info.bet) { g.toast(`Cần ít nhất ${info.bet} xu!`); return; }
    if (get().transport === 'socket' && !get().solo) {
      const me = myPlayer();
      socket?.emit('casino:join', { pid: me.pid, roomId: target, player: { name: me.name, avatar: me.avatar } });
      set({ lockedBet: info?.bet ?? 0, deducted: false, settledKey: '', error: '' });
      return;
    }
    // local join: gửi yêu cầu tới host
    const me = myPlayer();
    try { bc?.postMessage({ kind: 'join-req', roomId: target, player: me }); } catch { /* ignore */ }
    set({ error: '' });
  },

  leaveRoom() {
    const { room, lockedBet, deducted } = get();
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:leave', { pid: myPid() });
    } else if (room) {
      if (localHostRooms.has(room.id)) {
        localHostRooms.delete(room.id);
        try { bc?.postMessage({ kind: 'room-closed', roomId: room.id }); } catch { /* ignore */ }
      } else {
        try { bc?.postMessage({ kind: 'leave', roomId: room.id, pid: myPid() }); } catch { /* ignore */ }
      }
    }
    // hoàn cược nếu rời khi chưa bắt đầu (chưa trừ thì thôi)
    if (room && room.status === 'waiting' && deducted) {
      useGame.getState().addXu(lockedBet);
    }
    // nếu đang chơi mà rời → mất cược (không hoàn)
    set({ room: null, rooms: [], lockedBet: 0, deducted: false, error: '' });
    stopBotLoop();
  },

  addBot() {
    const { room } = get();
    if (!room) return;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:addbot', { pid: myPid() });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host || host.hostPid !== myPid()) { useGame.getState().toast('Chỉ chủ phòng thêm máy'); return; }
    const max = host.game === 'caro' ? 2 : 4;
    if (host.players.length >= max) return;
    const n = host.players.filter((x) => x.bot).length + 1;
    const b = botName(n + host.players.length);
    host.players.push({ pid: `bot-${host.id}-${Date.now() % 100000}`, name: b.name, avatar: b.avatar, bot: true });
    host.updatedAt = Date.now();
    broadcastLocalRoom(host);
    set({ room: { ...host } });
  },

  startRoom() {
    const { room, lockedBet } = get();
    if (!room) return;
    const g = useGame.getState();
    if (g.xu < room.bet && !get().deducted) { g.toast(`Cần ít nhất ${room.bet} xu!`); return; }
    void lockedBet;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:start', { pid: myPid() });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host) return;
    if (host.hostPid !== myPid()) { g.toast('Chỉ chủ phòng bắt đầu'); return; }
    const err = localStart(host);
    if (err) { g.toast(err); return; }
    // trừ cược tất cả người thật (host trừ mình; khách tự trừ khi nhận state playing)
    deductForNewGame(host);
    broadcastLocalRoom(host);
    set({ room: { ...host }, deducted: true });
    startBotLoop();
  },

  rematch() {
    const { room } = get();
    if (!room) return;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:rematch', { pid: myPid() });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host) return;
    if (host.hostPid !== myPid()) { useGame.getState().toast('Chỉ chủ phòng mở ván mới'); return; }
    host.status = 'waiting';
    host.state = null;
    host.winners = null;
    host.updatedAt = Date.now();
    broadcastLocalRoom(host);
    set({ room: { ...host }, deducted: false, settledKey: '' });
  },

  playCards(cards) {
    const { room } = get();
    if (!room || room.status !== 'playing') return;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:action', { pid: myPid(), type: 'play', cards: cards.map((c) => c.id) });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host || !host.state) return;
    const me = myPid();
    // nếu mình là khách local (không phải host) → gửi action cho host
    if (host.hostPid !== me) {
      try { bc?.postMessage({ kind: 'action', roomId: room.id, pid: me, action: { type: 'play', cards: cards.map((c) => c.id) } }); } catch { /* ignore */ }
      return;
    }
    const st = host.state as TienLenState;
    const hand = (st.hands[me] ?? []);
    const sel = hand.filter((h) => cards.some((c) => c.id === h.id));
    const err = validatePlay(st, me, sel);
    if (err) { useGame.getState().toast(err); return; }
    host.state = applyPlay(st, me, sel);
    afterLocalAction(host);
  },

  passTurn() {
    const { room } = get();
    if (!room || room.status !== 'playing') return;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:action', { pid: myPid(), type: 'pass' });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host || !host.state) return;
    const me = myPid();
    if (host.hostPid !== me) {
      try { bc?.postMessage({ kind: 'action', roomId: room.id, pid: me, action: { type: 'pass' } }); } catch { /* ignore */ }
      return;
    }
    host.state = applyPass(host.state as TienLenState, me);
    afterLocalAction(host);
  },

  reveal() {
    const { room } = get();
    if (!room || room.status !== 'playing') return;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:action', { pid: myPid(), type: 'reveal' });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host || !host.state) return;
    const me = myPid();
    if (host.hostPid !== me) {
      try { bc?.postMessage({ kind: 'action', roomId: room.id, pid: me, action: { type: 'reveal' } }); } catch { /* ignore */ }
      return;
    }
    const st = host.state as BaiCaoState;
    if (!st.revealed.includes(me)) st.revealed.push(me);
    afterLocalAction(host);
  },

  moveCaro(r, c) {
    const { room } = get();
    if (!room || room.status !== 'playing') return;
    if (get().transport === 'socket' && !get().solo) {
      socket?.emit('casino:action', { pid: myPid(), type: 'move', r, c });
      return;
    }
    const host = localHostRooms.get(room.id);
    if (!host || !host.state) return;
    const me = myPid();
    if (host.hostPid !== me) {
      try { bc?.postMessage({ kind: 'action', roomId: room.id, pid: me, action: { type: 'move', r, c } }); } catch { /* ignore */ }
      return;
    }
    const next = applyCaroMove(host.state as CaroState, me, r, c);
    if (!next) { useGame.getState().toast('Ô không hợp lệ / chưa tới lượt'); return; }
    host.state = next;
    afterLocalAction(host);
  },
}));

// ---------- remote state (socket) ----------
function applyRemoteState(room: CasinoRoom | null) {
  const prev = useCasino.getState().room;
  const st = useCasino.getState();
  if (!room) { useCasino.setState({ room: null }); return; }
  // trừ cược khi ván mới bắt đầu (lần đầu thấy playing)
  let deducted = st.deducted;
  if (room.status === 'playing' && !deducted && prev?.id === room.id && prev?.status === 'waiting') {
    // đã check xu khi join; giờ trừ
    useCasinoDeduct(room.bet);
    deducted = true;
  } else if (room.status === 'playing' && !deducted && !prev) {
    useCasinoDeduct(room.bet);
    deducted = true;
  }
  let settledKey = st.settledKey;
  if (room.status === 'finished') {
    settledKey = settleIfFinished(room, prev?.status ?? null, settledKey);
  }
  // reset cờ khi về waiting (ván mới)
  if (room.status === 'waiting') { deducted = false; settledKey = ''; }
  useCasino.setState({ room, deducted, settledKey, lockedBet: room.bet, error: '' });
}

function useCasinoDeduct(bet: number) {
  const g = useGame.getState();
  if (g.xu < bet) { g.toast('Không đủ xu cược!'); return; }
  g.addXu(-bet);
}

// ---------- local (BroadcastChannel) ----------
function broadcastLocalRoom(room: CasinoRoom) {
  room.updatedAt = Date.now();
  try { bc?.postMessage({ kind: 'state', room }); } catch { /* ignore */ }
  const st = useCasino.getState();
  if (st.room?.id === room.id) {
    let settledKey = st.settledKey;
    if (room.status === 'finished') settledKey = settleIfFinished(room, st.room.status, settledKey);
    useCasino.setState({ room: { ...room }, settledKey });
  }
}

function deductForNewGame(room: CasinoRoom) {
  // host đã trừ mình; ở đây chỉ trừ cho host (khách tự trừ khi nhận state)
  const st = useCasino.getState();
  if (!st.deducted) {
    useCasinoDeduct(room.bet);
    useCasino.setState({ deducted: true, lockedBet: room.bet });
  }
  room.pot = room.bet * room.players.length;
}

function localStart(host: CasinoRoom): string | null {
  const min = 2;
  if (host.players.length < min) return `Cần ít nhất ${min} người`;
  const pids = host.players.map((x) => x.pid);
  if (host.game === 'tienlen') {
    const deck = shuffle(fullDeck());
    host.state = newTienLenGame(pids, deck);
  } else if (host.game === 'baicao') {
    const deck = shuffle(fullDeck());
    const s = newBaiCaoGame(pids, deck);
    // bot tự lật
    for (const p of host.players) if (p.bot && !s.revealed.includes(p.pid)) s.revealed.push(p.pid);
    if (s.revealed.length >= pids.length) {
      s.winners = findBaiCaoWinners(s);
      host.status = 'finished';
      host.winners = s.winners;
      host.state = s;
      host.pot = host.bet * host.players.length;
      host.updatedAt = Date.now();
      return null;
    }
    host.state = s;
  } else if (host.game === 'caro') {
    if (pids.length !== 2) return 'Caro cần đúng 2 người';
    host.state = newCaroGame([pids[0], pids[1]]);
  }
  host.status = 'playing';
  host.winners = null;
  host.pot = host.bet * host.players.length;
  if (host.state) host.state.deadline = Date.now() + (host.game === 'baicao' ? CASINO_BAICAO_MS : CASINO_TURN_MS);
  host.updatedAt = Date.now();
  return null;
}

function afterLocalAction(host: CasinoRoom) {
  // kết thúc bài cào?
  if (host.game === 'baicao' && host.state) {
    const s = host.state as BaiCaoState;
    if (!host.winners && s.revealed.length >= s.order.length) {
      s.winners = findBaiCaoWinners(s);
      host.status = 'finished';
      host.winners = s.winners;
    }
  }
  // kết thúc tiến lên?
  if (host.game === 'tienlen' && host.state) {
    const s = host.state as TienLenState;
    if (s.winner && host.status !== 'finished') {
      host.status = 'finished';
      host.winners = [s.winner];
    }
  }
  // kết thúc caro?
  if (host.game === 'caro' && host.state) {
    const s = host.state as CaroState;
    if ((s.winner || s.draw) && host.status !== 'finished') {
      host.status = 'finished';
      host.winners = s.winner ? [s.winner] : [];
    }
  }
  if (host.state) {
    // còn đánh tiếp (tiến lên/caro) → gia hạn lượt mới; xong ván → xóa deadline
    host.state.deadline = host.status === 'playing' && host.game !== 'baicao'
      ? Date.now() + CASINO_TURN_MS
      : null;
  }
  host.updatedAt = Date.now();
  broadcastLocalRoom(host);
  // bot đánh tiếp?
  startBotLoop();
}

function handleLocalMsg(m: {
  kind: string; info?: CasinoRoomInfo; room?: CasinoRoom; roomId?: string;
  player?: CasinoPlayer; pid?: string; from?: string; action?: { type: string; cards?: string[]; r?: number; c?: number };
}) {
  const st = useCasino.getState();
  const me = myPid();
  if (!m || typeof m !== 'object') return;
  if (m.kind === 'announce' && m.info) {
    localSeen.set(m.info.id, { info: m.info, at: Date.now() });
    if (!st.room && st.transport === 'local') {
      useCasino.setState({ rooms: [...localSeen.values()].map((v) => v.info).sort((a, b) => b.updatedAt - a.updatedAt) });
    }
    return;
  }
  if (m.kind === 'list-req') {
    for (const r of localHostRooms.values()) {
      if (r.status !== 'waiting') continue;
      try { bc?.postMessage({ kind: 'announce', info: publicOf(r) }); } catch { /* ignore */ }
    }
    return;
  }
  if (m.kind === 'room-closed' && m.roomId) {
    localSeen.delete(m.roomId);
    if (st.room?.id === m.roomId && !localHostRooms.has(m.roomId)) {
      useCasino.setState({ room: null, rooms: [...localSeen.values()].map((v) => v.info) });
      useGame.getState().toast('Phòng đã đóng');
    }
    return;
  }
  if (m.kind === 'join-req' && m.roomId && m.player) {
    const host = localHostRooms.get(m.roomId);
    if (!host || host.status !== 'waiting') return;
    const max = host.game === 'caro' ? 2 : 4;
    if (host.players.length >= max || host.players.some((x) => x.pid === m.player!.pid)) return;
    host.players.push(m.player);
    host.updatedAt = Date.now();
    broadcastLocalRoom(host);
    useCasino.setState({ room: { ...host } });
    return;
  }
  if (m.kind === 'state' && m.room) {
    // host broadcast — khách nhận
    if (localHostRooms.has(m.room.id)) return; // mình là host, bỏ qua echo
    const prev = st.room;
    // nếu mình đang trong phòng này → cập nhật
    if (st.room?.id === m.room.id || (!st.room && m.room.players.some((x) => x.pid === me))) {
      let deducted = st.deducted;
      if (m.room.status === 'playing' && !deducted) {
        // khách trừ cược khi ván bắt đầu
        if (prev?.status === 'waiting' || !prev) {
          useCasinoDeduct(m.room.bet);
          deducted = true;
        }
      }
      let settledKey = st.settledKey;
      if (m.room.status === 'finished') settledKey = settleIfFinished(m.room, prev?.status ?? null, settledKey);
      if (m.room.status === 'waiting') { deducted = false; settledKey = ''; }
      useCasino.setState({ room: { ...m.room }, deducted, settledKey, lockedBet: m.room.bet });
    }
    return;
  }
  if (m.kind === 'action' && m.roomId && m.pid && m.action) {
    const host = localHostRooms.get(m.roomId);
    if (!host || !host.state || host.hostPid !== me) return;
    applyLocalGuestAction(host, m.pid, m.action);
    return;
  }
  if (m.kind === 'leave' && m.roomId && m.pid) {
    const host = localHostRooms.get(m.roomId);
    if (!host) return;
    host.players = host.players.filter((x) => x.pid !== m.pid);
    if (!host.players.length) { localHostRooms.delete(m.roomId); return; }
    if (host.hostPid === m.pid) host.hostPid = host.players[0].pid;
    if (host.state && host.status === 'playing') {
      // rời giữa ván → xử thua (tiến lên: bỏ bài; caro: đối thủ thắng)
      if (host.game === 'tienlen') {
        const s = host.state as TienLenState;
        delete s.hands[m.pid!];
        s.order = s.order.filter((id) => id !== m.pid);
        s.passed = s.passed.filter((id) => id !== m.pid);
        if (s.turn === m.pid) s.turn = s.order[0];
        if (s.order.length === 1) { s.winner = s.order[0]; host.status = 'finished'; host.winners = [s.order[0]]; }
      } else if (host.game === 'caro') {
        const s = host.state as CaroState;
        const other = s.order.find((id) => id !== m.pid);
        if (other && !s.winner) { s.winner = other; host.status = 'finished'; host.winners = [other]; }
      }
    }
    host.updatedAt = Date.now();
    broadcastLocalRoom(host);
    return;
  }
}

function applyLocalGuestAction(host: CasinoRoom, pid: string, action: { type: string; cards?: string[]; r?: number; c?: number }) {
  if (host.status !== 'playing' || !host.state) return;
  if (host.game === 'tienlen' && host.state) {
    const s = host.state as TienLenState;
    if (action.type === 'pass') {
      host.state = applyPass(s, pid);
    } else if (action.type === 'play' && action.cards) {
      const ids = new Set(action.cards.map(String));
      const hand = s.hands[pid] ?? [];
      const sel = hand.filter((h) => ids.has(h.id));
      const err = validatePlay(s, pid, sel);
      if (err) return;
      host.state = applyPlay(s, pid, sel);
    }
  } else if (host.game === 'baicao' && host.state) {
    const s = host.state as BaiCaoState;
    if (action.type === 'reveal' && !s.revealed.includes(pid)) s.revealed.push(pid);
  } else if (host.game === 'caro' && host.state) {
    const next = applyCaroMove(host.state as CaroState, pid, Number(action.r), Number(action.c));
    if (next) host.state = next;
  }
  afterLocalAction(host);
}

// ---------- bot loop (local/solo): bot tự đánh khi tới lượt + xử hết giờ ----------
function startBotLoop() {
  stopBotLoop();
  botTimer = window.setInterval(() => {
    const st = useCasino.getState();
    const room = st.room;
    if (!room || room.status !== 'playing' || !room.state) return;
    const host = localHostRooms.get(room.id);
    if (!host || !host.state || host.hostPid !== myPid()) return;
    // hết giờ: trọng tài (host) tự xử lượt hiện tại, kể cả người thật treo máy
    if (host.state.deadline != null && Date.now() > host.state.deadline) {
      if (localAutoTimeout(host)) return;
    }
    if (host.game === 'tienlen') {
      const s = host.state as TienLenState;
      if (s.winner) return;
      const cur = host.players.find((x) => x.pid === s.turn);
      if (!cur?.bot) return;
      const mv = botPick(s, cur.pid);
      if (mv) host.state = applyPlay(s, cur.pid, mv);
      else if (s.lastPlay) host.state = applyPass(s, cur.pid);
      else return;
      afterLocalAction(host);
    } else if (host.game === 'caro') {
      const s = host.state as CaroState;
      if (s.winner || s.draw) return;
      const cur = host.players.find((x) => x.pid === s.turn);
      if (!cur?.bot) return;
      const mv = caroBotMove(s, cur.pid);
      if (mv) {
        const next = applyCaroMove(s, cur.pid, mv[0], mv[1]);
        if (next) { host.state = next; afterLocalAction(host); }
      }
    }
  }, 900);
}

/** Host tự xử khi hết giờ: tiến lên ra/bỏ qua, bài cào tự lật hết, caro tự đánh */
function localAutoTimeout(host: CasinoRoom): boolean {
  if (!host.state || host.status !== 'playing') return false;
  if (host.game === 'tienlen') {
    const s = host.state as TienLenState;
    if (s.winner) return false;
    const cur = s.turn;
    if (!host.players.some((x) => x.pid === cur)) return false;
    const mv = botPick(s, cur);
    if (mv) host.state = applyPlay(s, cur, mv);
    else if (s.lastPlay) host.state = applyPass(s, cur);
    else {
      const h = (s.hands[cur] || []).slice().sort((a, b) => a.r - b.r || a.s - b.s);
      if (!h.length) return false;
      host.state = applyPlay(s, cur, [h[0]]);
    }
    afterLocalAction(host);
    return true;
  }
  if (host.game === 'baicao') {
    const s = host.state as BaiCaoState;
    let changed = false;
    for (const id of s.order) {
      if (!s.revealed.includes(id)) { s.revealed.push(id); changed = true; }
    }
    if (changed) afterLocalAction(host);
    return changed;
  }
  if (host.game === 'caro') {
    const s = host.state as CaroState;
    if (s.winner || s.draw) return false;
    const mv = caroBotMove(s, s.turn);
    if (!mv) return false;
    const next = applyCaroMove(s, s.turn, mv[0], mv[1]);
    if (!next) return false;
    host.state = next;
    afterLocalAction(host);
    return true;
  }
  return false;
}
function stopBotLoop() {
  if (botTimer) clearInterval(botTimer);
  botTimer = null;
}
