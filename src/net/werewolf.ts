// ===== MA SÓI CÔNG VIÊN (mini-game suy luận đông người, 5–12 người) =====
// Mô hình "chủ bàn điều phối": chủ bàn chia vai + dẫn đêm/ngày/bỏ phiếu theo giờ.
// Vai trò BÍ MẬT ở mức UI: tin nhắn chia vai/hành động đêm đi qua kênh game ẩn
// `🐺MS|` (chat không hiện), client chỉ hiển thị vai của chính mình.
// Mọi client cùng nhận 1 luồng tin từ chủ bàn nên trạng thái luôn đồng bộ.
import { create } from 'zustand';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { gameMe, markSeen, onGameMsg, sendGameMsg, useVillage } from './village';
import type { ChatMsg } from './transport';

const P = '🐺MS|';
const NIGHT_MS = 40000;
const DAY_MS = 50000;
const VOTE_MS = 30000;
export const WOLF_PRIZE_XU = 300;
export const WOLF_PRIZE_GEM = 1;

export type Role = 'wolf' | 'seer' | 'guard' | 'villager';
export type WWPhase = 'idle' | 'lobby' | 'night' | 'day' | 'vote' | 'end';
export type WWWinner = 'wolves' | 'villagers' | null;

export const ROLE_META: Record<Role, { name: string; emoji: string; desc: string }> = {
  wolf: { name: 'Sói', emoji: '🐺', desc: 'Đêm xuống cùng đàn chọn 1 người để thịt. Ban ngày giả làm dân để thoát phiếu treo.' },
  seer: { name: 'Tiên tri', emoji: '🔮', desc: 'Mỗi đêm soi 1 người, biết người đó có phải sói không.' },
  guard: { name: 'Bảo vệ', emoji: '🛡️', desc: 'Mỗi đêm cứu 1 người khỏi sói (không cứu cùng 1 người 2 đêm liên tiếp).' },
  villager: { name: 'Dân làng', emoji: '🧑‍🌾', desc: 'Ban ngày quan sát + bỏ phiếu treo sói. Đừng để sói lừa!' },
};

/** Vai cho n người (5–12): 1–3 sói + tiên tri (+ bảo vệ từ 6 người) + dân */
export function rolesFor(n: number): Role[] {
  const wolves = n >= 10 ? 3 : n >= 7 ? 2 : 1;
  const roles: Role[] = Array<Role>(Math.max(0, wolves)).fill('wolf');
  roles.push('seer');
  if (n >= 6) roles.push('guard');
  while (roles.length < n) roles.push('villager');
  // xáo (chủ bàn xáo rồi chia riêng từng người)
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}

interface WWState {
  phase: WWPhase;
  room: string;
  host: string;
  players: string[];
  lobby: string[];
  myRole: Role | null;
  pack: string[];
  alive: Record<string, boolean>;
  night: number;
  day: number;
  endsAt: number;
  acted: boolean;
  voted: string | null;
  votes: Record<string, string>;
  lastDead: string;
  lastRole: Role | null;
  lastCause: 'kill' | 'hang' | null;
  seerHit: { target: string; wolf: boolean } | null;
  winner: WWWinner;
  reveal: Record<string, Role>;
  openRooms: Record<string, { host: string; at: number }>;
  log: string[];

  openRoom: () => void;
  joinRoom: (room: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  nightAct: (target: string) => void;
  vote: (target: string) => void;
  newRound: () => void;
}

const seen = new Set<string>();
/** hành động đêm chủ bàn thu được: room → danh sách ACT */
const nightActs: { room: string; n: number; actor: string; kind: 'kill' | 'seer' | 'save'; target: string; at: number }[] = [];
/** bảo vệ cứu ai đêm trước (chống cứu liên tiếp): room → guard → target */
const guardLast: Record<string, Record<string, string>> = {};
const hostTimers: number[] = [];

function clearHostTimers() {
  for (const t of hostTimers) clearTimeout(t);
  hostTimers.length = 0;
}
function laterHost(ms: number, fn: () => void) {
  hostTimers.push(window.setTimeout(fn, ms));
}
const isHost = () => {
  const s = useWolf.getState();
  return !!s.room && gameMe().name === s.host;
};
function pushLog(msg: string) {
  const s = useWolf.getState();
  useWolf.setState({ log: [...s.log.slice(-29), msg] });
}
function aliveWolves(alive: Record<string, boolean>, reveal: Record<string, Role>, players: string[]): string[] {
  return players.filter((p) => alive[p] && reveal[p] === 'wolf');
}
function aliveCount(alive: Record<string, boolean>, players: string[]): number {
  return players.filter((p) => alive[p]).length;
}
/** kiểm tra thắng thua sau mỗi lần có người chết (chỉ chủ bàn gọi + broadcast) */
function checkWinHost() {
  const s = useWolf.getState();
  const wolves = aliveWolves(s.alive, s.reveal, s.players);
  const others = s.players.filter((p) => s.alive[p] && s.reveal[p] !== 'wolf');
  if (wolves.length === 0) return endHost('villagers');
  if (wolves.length >= others.length) return endHost('wolves');
}
function endHost(winner: Exclude<WWWinner, null>) {
  const s = useWolf.getState();
  clearHostTimers();
  const roles = s.players.map((p) => `${p}=${s.reveal[p]}`).join(',');
  sendGameMsg(`${P}END|${s.room}|${winner}|${roles}`);
}

function beginNightHost(n: number) {
  const s = useWolf.getState();
  useWolf.setState({ phase: 'night', night: n, endsAt: Date.now() + NIGHT_MS, acted: false, voted: null, votes: {} });
  sendGameMsg(`${P}NIGHT|${s.room}|${n}|${Date.now() + NIGHT_MS}`);
  laterHost(NIGHT_MS + 1200, () => {
    const cur = useWolf.getState();
    if (cur.phase !== 'night' || cur.room !== s.room || cur.night !== n) return;
    resolveNightHost(n);
  });
}

function resolveNightHost(n: number) {
  const s = useWolf.getState();
  const acts = nightActs.filter((a) => a.room === s.room && a.n === n);
  // sói chốt giết: đa số sói còn sống, hòa → tin sớm nhất
  const kills = acts.filter((a) => a.kind === 'kill' && s.alive[a.actor] && s.reveal[a.actor] === 'wolf' && s.alive[a.target]);
  const tally = new Map<string, { c: number; first: number }>();
  for (const k of kills) {
    const e = tally.get(k.target) ?? { c: 0, first: k.at };
    e.c++;
    e.first = Math.min(e.first, k.at);
    tally.set(k.target, e);
  }
  let killTarget = '';
  let best = 0, bestFirst = Infinity;
  for (const [t, e] of tally) {
    if (e.c > best || (e.c === best && e.first < bestFirst)) { best = e.c; bestFirst = e.first; killTarget = t; }
  }
  // bảo vệ cứu (còn sống, không cứu trùng đêm trước)
  const roomGuards = (guardLast[s.room] ??= {});
  const saves = acts.filter((a) => a.kind === 'save' && s.alive[a.actor] && s.reveal[a.actor] === 'guard');
  let saveTarget = '';
  for (const sv of saves.sort((a, b) => a.at - b.at)) {
    if (roomGuards[sv.actor] === sv.target) continue; // trùng đêm trước → bỏ
    saveTarget = sv.target;
    roomGuards[sv.actor] = sv.target;
    break;
  }
  // tiên tri soi: trả kết quả riêng cho từng tiên tri còn sống
  for (const sc of acts.filter((a) => a.kind === 'seer' && s.alive[a.actor] && s.reveal[a.actor] === 'seer')) {
    const isW = s.reveal[sc.target] === 'wolf';
    sendGameMsg(`${P}SEERHIT|${s.room}|${sc.actor}|${sc.target}|${isW ? 1 : 0}`);
  }
  const dead = killTarget && killTarget !== saveTarget ? killTarget : '';
  const alive = { ...s.alive };
  if (dead) alive[dead] = false;
  useWolf.setState({ alive });
  sendGameMsg(`${P}DAWN|${s.room}|${n}|${dead}|${dead ? s.reveal[dead] : ''}|${dead ? '' : saveTarget ? 'saved' : 'peace'}`);
  pushLog(dead ? `🌅 Đêm ${n}: ${dead} bị sói thịt (${ROLE_META[s.reveal[dead]].name})!` : saveTarget ? `🌅 Đêm ${n}: sói ra tay nhưng có người được cứu!` : `🌅 Đêm ${n}: bình yên, không ai hấn gì.`);
  sfx.bark();
  if (dead) {
    const cur = useWolf.getState();
    const wolves = aliveWolves(cur.alive, cur.reveal, cur.players);
    const others = cur.players.filter((p) => cur.alive[p] && cur.reveal[p] !== 'wolf');
    if (wolves.length === 0) { endHost('villagers'); return; }
    if (wolves.length >= others.length) { endHost('wolves'); return; }
  }
  // sang ngày: bàn luận rồi bỏ phiếu
  const d = s.day + 1;
  useWolf.setState({ phase: 'day', day: d, endsAt: Date.now() + DAY_MS });
  sendGameMsg(`${P}DAY|${s.room}|${d}|${Date.now() + DAY_MS}`);
  laterHost(DAY_MS + 1200, () => {
    const cur = useWolf.getState();
    if (cur.phase !== 'day' || cur.room !== s.room || cur.day !== d) return;
    beginVoteHost();
  });
}

function beginVoteHost() {
  const s = useWolf.getState();
  // dọn acts đêm cũ của room này
  for (let i = nightActs.length - 1; i >= 0; i--) {
    if (nightActs[i].room === s.room) nightActs.splice(i, 1);
  }
  useWolf.setState({ phase: 'vote', endsAt: Date.now() + VOTE_MS, votes: {}, voted: null });
  sendGameMsg(`${P}VOTESTART|${s.room}|${Date.now() + VOTE_MS}`);
  laterHost(VOTE_MS + 1200, () => {
    const cur = useWolf.getState();
    if (cur.phase !== 'vote' || cur.room !== s.room) return;
    resolveVoteHost();
  });
}

function resolveVoteHost() {
  const s = useWolf.getState();
  // phiếu hợp lệ: người sống vote người sống, không tự vote, mỗi người 1 phiếu cuối
  const tally = new Map<string, number>();
  for (const [voter, target] of Object.entries(s.votes)) {
    if (!s.alive[voter] || !s.alive[target] || voter === target) continue;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  let top = '', topC = 0, tie = false;
  for (const [t, c] of tally) {
    if (c > topC) { topC = c; top = t; tie = false; }
    else if (c === topC) tie = true;
  }
  const hanged = topC > 0 && !tie ? top : '';
  const alive = { ...s.alive };
  if (hanged) alive[hanged] = false;
  useWolf.setState({ alive });
  sendGameMsg(`${P}HANG|${s.room}|${hanged}|${hanged ? s.reveal[hanged] : ''}`);
  if (hanged) {
    pushLog(`⚖️ Dân treo cổ ${hanged} — là ${ROLE_META[s.reveal[hanged]].name} ${ROLE_META[s.reveal[hanged]].emoji}!`);
    sfx.splash();
  } else {
    pushLog('⚖️ Phiếu hòa / không ai bị treo. Sói cười thầm…');
  }
  checkWinHost();
  const cur = useWolf.getState();
  if (cur.phase === 'vote') beginNightHost(cur.night + 1); // chưa phân thắng bại → đêm tiếp
}

function handleMsg(m: ChatMsg) {
  if (markSeen(seen, m.id)) return;
  const [kind, ...rest] = m.text.slice(P.length).split('|');
  const s = useWolf.getState();
  const me = gameMe().name;

  if (kind === 'OPEN') {
    const [room, host] = rest;
    if (!room || !host) return;
    useWolf.setState({ openRooms: { ...s.openRooms, [room]: { host, at: Date.now() } } });
    if (s.phase === 'idle') useGame.getState().toast(`🐺 ${host} mở bàn MA SÓI! Bấm nút 🐺 ở công viên để chơi!`);
    return;
  }
  if (kind === 'JOIN') {
    const [room, name] = rest;
    if (s.phase === 'lobby' && room === s.room && name && !s.lobby.includes(name) && s.lobby.length < 12) {
      useWolf.setState({ lobby: [...s.lobby, name] });
    }
    return;
  }
  if (kind === 'START') {
    const [room, csv] = rest;
    const players = (csv || '').split(',').filter(Boolean);
    if (s.phase === 'lobby' && room === s.room) {
      if (!players.includes(me)) {
        useWolf.setState({ phase: 'idle', room: '', host: '', lobby: [], players: [] });
        useGame.getState().toast('Bàn ma sói đủ người, bạn lỡ chuyến này!');
        return;
      }
      const alive: Record<string, boolean> = {};
      for (const p of players) alive[p] = true;
      useWolf.setState({ players, lobby: players, alive, myRole: null, pack: [], night: 0, day: 0, reveal: {}, log: [`🎮 Ván ma sói bắt đầu! ${players.length} người chơi.`] });
      // vai gửi riêng từng người ngay sau đó (DEAL)
    }
    // dọn bàn khỏi danh sách mở
    if (s.openRooms[room]) {
      const o = { ...s.openRooms };
      delete o[room];
      useWolf.setState({ openRooms: o });
    }
    return;
  }
  if (kind === 'DEAL') {
    const [room, to, role, packCsv] = rest;
    if (room !== s.room || to !== me) return;
    const pack = (packCsv || '').split(',').filter(Boolean);
    const reveal = { ...s.reveal };
    reveal[me] = role as Role;
    for (const w of pack) reveal[w] = 'wolf';
    useWolf.setState({ myRole: role as Role, pack, reveal });
    const meta = ROLE_META[role as Role];
    sfx.lvup();
    useGame.getState().toast(`🐺 Vai của bạn: ${meta.emoji} ${meta.name}! Giữ kín nhé!`);
    return;
  }
  if (kind === 'NIGHT') {
    const [room, n, ends] = rest;
    if (room !== s.room) return;
    useWolf.setState({ phase: 'night', night: Number(n) || s.night + 1, endsAt: Number(ends) || Date.now() + NIGHT_MS, acted: false, voted: null, votes: {} });
    pushLog(`🌙 Đêm ${n} xuống… sói / tiên tri / bảo vệ hành động lén!`);
    return;
  }
  if (kind === 'ACT') {
    const [room, n, actor, actKind, target] = rest;
    if (room !== s.room) return;
    // chủ bàn thu để chốt đêm; người khác chỉ cần biết mình đã gửi (echo)
    if (isHost()) {
      nightActs.push({ room, n: Number(n), actor, kind: actKind as 'kill' | 'seer' | 'save', target, at: m.at });
    }
    if (actor === me) useWolf.setState({ acted: true });
    return;
  }
  if (kind === 'SEERHIT') {
    const [room, to, target, isW] = rest;
    if (room !== s.room || to !== me) return;
    useWolf.setState({ seerHit: { target, wolf: isW === '1' } });
    sfx.meow();
    useGame.getState().toast(`🔮 ${target} ${isW === '1' ? 'LÀ SÓI! 🐺' : 'không phải sói.'}`);
    return;
  }
  if (kind === 'DAWN') {
    const [room, , dead, deadRole, flag] = rest;
    if (room !== s.room) return;
    if (dead && s.alive[dead]) {
      const alive = { ...s.alive, [dead]: false };
      useWolf.setState({ alive, lastDead: dead, lastRole: (deadRole as Role) || null, lastCause: 'kill' });
      if (dead === me) {
        sfx.error();
        useGame.getState().toast(`🐺 Bạn bị sói thịt đêm qua! Ngồi xem + vẫn được bàn luận.`);
      }
    } else if (!dead) {
      useWolf.setState({ lastDead: '', lastRole: null, lastCause: null });
      void flag;
    }
    return;
  }
  if (kind === 'DAY') {
    const [room, d, ends] = rest;
    if (room !== s.room) return;
    useWolf.setState({ phase: 'day', day: Number(d) || 1, endsAt: Number(ends) || Date.now() + DAY_MS });
    pushLog('☀️ Trời sáng! Bàn luận trong chat công viên rồi bỏ phiếu.');
    sfx.coin();
    return;
  }
  if (kind === 'VOTESTART') {
    const [room, ends] = rest;
    if (room !== s.room) return;
    useWolf.setState({ phase: 'vote', endsAt: Number(ends) || Date.now() + VOTE_MS, votes: {}, voted: null });
    pushLog('🗳️ Bỏ phiếu treo cổ! Mỗi người 1 phiếu (được đổi ý tới hết giờ).');
    return;
  }
  if (kind === 'VOTE') {
    const [room, voter, target] = rest;
    if (room !== s.room || s.phase !== 'vote') return;
    useWolf.setState({ votes: { ...s.votes, [voter]: target } });
    if (voter === me) useWolf.setState({ voted: target });
    return;
  }
  if (kind === 'HANG') {
    const [room, name, role] = rest;
    if (room !== s.room) return;
    if (name && s.alive[name]) {
      const alive = { ...s.alive, [name]: false };
      useWolf.setState({ alive, lastDead: name, lastRole: (role as Role) || null, lastCause: 'hang' });
      if (name === me) {
        sfx.error();
        useGame.getState().toast('⚖️ Dân treo cổ bạn! Ngồi xem nốt ván này.');
      }
    }
    return;
  }
  if (kind === 'END') {
    const [room, winner, rolesCsv] = rest;
    if (room !== s.room) return;
    clearHostTimers();
    const reveal: Record<string, Role> = {};
    for (const pair of (rolesCsv || '').split(',')) {
      const [n, r] = pair.split('=');
      if (n && r) reveal[n] = r as Role;
    }
    useWolf.setState({ phase: 'end', winner: winner as WWWinner, reveal, endsAt: 0 });
    const iWin = reveal[me] && ((winner === 'wolves' && reveal[me] === 'wolf') || (winner === 'villagers' && reveal[me] !== 'wolf'));
    pushLog(winner === 'wolves' ? '🐺 ĐÀN SÓI THẮNG! Cả làng bị ăn thịt…' : '🧑‍🌾 DÂN LÀNG THẮNG! Sói bị treo hết rồi!');
    if (iWin) {
      const g = useGame.getState();
      g.addXu(WOLF_PRIZE_XU);
      g.addGem(WOLF_PRIZE_GEM);
      sfx.lvup();
      g.toast(`🐺 Ma sói: phe bạn THẮNG! +${WOLF_PRIZE_XU} xu +${WOLF_PRIZE_GEM} gem!`);
    } else {
      sfx.splash();
      useGame.getState().toast(winner === 'wolves' ? '🐺 Đàn sói thắng ván này!' : '🧑‍🌾 Dân làng thắng ván này!');
    }
    return;
  }
  if (kind === 'KILLROOM') {
    const [room] = rest;
    if (room !== s.room) return;
    clearHostTimers();
    useWolf.setState({
      phase: 'idle', room: '', host: '', players: [], lobby: [], myRole: null, pack: [],
      alive: {}, night: 0, day: 0, endsAt: 0, acted: false, voted: null, votes: {},
      lastDead: '', lastRole: null, lastCause: null, seerHit: null, winner: null, reveal: {}, log: [],
    });
    useGame.getState().toast('🐺 Bàn ma sói đã giải tán.');
  }
}

export const useWolf = create<WWState>()((set, get) => ({
  phase: 'idle',
  room: '',
  host: '',
  players: [],
  lobby: [],
  myRole: null,
  pack: [],
  alive: {},
  night: 0,
  day: 0,
  endsAt: 0,
  acted: false,
  voted: null,
  votes: {},
  lastDead: '',
  lastRole: null,
  lastCause: null,
  seerHit: null,
  winner: null,
  reveal: {},
  openRooms: {},
  log: [],

  openRoom: () => {
    const s = get();
    if (s.phase !== 'idle') return;
    if (!useVillage.getState().connected) {
      useGame.getState().toast('Chưa vào làng (đang kết nối…), thử lại sau 2 giây!');
      return;
    }
    const me = gameMe();
    const room = `${me.name}-${Date.now().toString(36)}`;
    set({
      phase: 'lobby', room, host: me.name, players: [], lobby: [me.name],
      myRole: null, pack: [], alive: {}, night: 0, day: 0, endsAt: 0,
      acted: false, voted: null, votes: {}, lastDead: '', lastRole: null, lastCause: null,
      seerHit: null, winner: null, reveal: {}, log: ['Mở bàn! Rủ thêm 4–11 người nữa (chat / đứng gần rủ rê).'],
    });
    sendGameMsg(`${P}OPEN|${room}|${me.name}`);
    sfx.coin();
    void s;
  },

  joinRoom: (room) => {
    const s = get();
    if (s.phase !== 'idle') return;
    const info = s.openRooms[room];
    if (!info) return;
    const me = gameMe();
    // chờ echo JOIN về rồi mới vào lobby (1 luồng)
    sendGameMsg(`${P}JOIN|${room}|${me.name}`);
    set({ phase: 'lobby', room, host: info.host, lobby: [me.name], players: [], log: [`Vào bàn của ${info.host}, chờ đủ người…`] });
  },

  leaveRoom: () => {
    const s = get();
    if (s.phase === 'idle') return;
    // chủ bàn rời giữa ván → giải tán luôn để mọi người khỏi kẹt
    if (isHost()) sendGameMsg(`${P}KILLROOM|${s.room}`);
    clearHostTimers();
    set({
      phase: 'idle', room: '', host: '', players: [], lobby: [], myRole: null, pack: [],
      alive: {}, night: 0, day: 0, endsAt: 0, acted: false, voted: null, votes: {},
      lastDead: '', lastRole: null, lastCause: null, seerHit: null, winner: null, reveal: {}, log: [],
    });
  },

  startGame: () => {
    const s = get();
    if (!isHost() || s.phase !== 'lobby') return;
    const players = [...new Set(s.lobby)].sort().slice(0, 12);
    if (players.length < 5) {
      useGame.getState().toast('Cần ít nhất 5 người mới chơi ma sói!');
      return;
    }
    const roles = rolesFor(players.length);
    const wolves = players.filter((_, i) => roles[i] === 'wolf');
    const reveal: Record<string, Role> = {};
    players.forEach((p, i) => { reveal[p] = roles[i]; });
    const alive: Record<string, boolean> = {};
    for (const p of players) alive[p] = true;
    set({ players, lobby: players, alive, reveal, night: 0, day: 0, log: [`🎮 Ván ma sói bắt đầu! ${players.length} người chơi.`] });
    sendGameMsg(`${P}START|${s.room}|${players.join(',')}`);
    // chia vai riêng từng người (tin ẩn — client chỉ hiện vai của mình)
    for (let i = 0; i < players.length; i++) {
      sendGameMsg(`${P}DEAL|${s.room}|${players[i]}|${roles[i]}|${roles[i] === 'wolf' ? wolves.join(',') : ''}`);
    }
    beginNightHost(1);
  },

  nightAct: (target) => {
    const s = get();
    if (s.phase !== 'night' || !s.alive[gameMe().name] || s.acted || !s.myRole) return;
    const kind = s.myRole === 'wolf' ? 'kill' : s.myRole === 'seer' ? 'seer' : s.myRole === 'guard' ? 'save' : null;
    if (!kind || !target) return;
    if (kind === 'kill' && s.pack.includes(target)) return; // sói không thịt đồng đội
    // chờ echo ACT về rồi mới khóa nút (1 luồng)
    sendGameMsg(`${P}ACT|${s.room}|${s.night}|${gameMe().name}|${kind}|${target}`);
  },

  vote: (target) => {
    const s = get();
    const me = gameMe().name;
    if (s.phase !== 'vote' || !s.alive[me] || !s.alive[target] || target === me) return;
    // phiếu công khai, được đổi ý — echo về tự cập nhật
    sendGameMsg(`${P}VOTE|${s.room}|${me}|${target}`);
  },

  newRound: () => {
    const s = get();
    if (!isHost() || s.phase !== 'end') return;
    sendGameMsg(`${P}KILLROOM|${s.room}`);
    clearHostTimers();
    set({
      phase: 'idle', room: '', host: '', players: [], lobby: [], myRole: null, pack: [],
      alive: {}, night: 0, day: 0, endsAt: 0, acted: false, voted: null, votes: {},
      lastDead: '', lastRole: null, lastCause: null, seerHit: null, winner: null, reveal: {}, log: [],
    });
  },
}));

onGameMsg(P, handleMsg);
