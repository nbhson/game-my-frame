// ============================================================
// NÔNG TRẠI PIXEL — LAN server: 1 lệnh cho cả mạng cùng chơi
//   npm run lan   → build web + serve + realtime + DB local
// Không cần Supabase, không cần mạng internet.
// DB local: file JSON (server/data/db.json), đủ cho quy mô LAN party.
// Sau này cần scale: thay DB file bằng SQLite/Postgres, socket giữ nguyên.
// ============================================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8931);
const DIST = path.join(__dirname, '..', 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ---------- DB local (JSON file, ghi debounced) ----------
// accounts: username (viết thường) -> { username, name, avatar, code, data, updatedAt }
// Toàn bộ farm của 1 username nằm ở đây: reload/tab khác/máy khác chỉ cần
// nhập đúng username là lấy lại được.
let db = { accounts: {} };
let saveTimer = null;

/** Mã farm 6 ký tự, suy ra deterministically từ username (client dùng y hệt) */
function codeFromName(name) {
  const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let h = 5381;
  const s = String(name || '').toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.codePointAt(i)) >>> 0;
  let out = '';
  for (let i = 0; i < 6; i++) { out += ALPH[h & 31]; h = (h >>> 5) ^ (h >>> 11); }
  return out;
}
const keyOf = (u) => String(u || '').trim().toLowerCase().slice(0, 12);

async function loadDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      // migrate db cũ { profiles, farms } -> { accounts } (best-effort)
      if (parsed.accounts) db = { accounts: parsed.accounts };
      else {
        db = { accounts: {} };
        for (const [code, snap] of Object.entries(parsed.farms || {})) {
          const uname = keyOf(snap?.name || '');
          if (uname) db.accounts[uname] = { username: uname, name: snap.name, avatar: 0, code, data: snap, updatedAt: snap.updatedAt || Date.now() };
        }
      }
    }
    console.log(`[db] loaded ${Object.keys(db.accounts).length} account(s) from ${DB_FILE}`);
  } catch {
    console.log('[db] fresh database (no db.json yet)');
  }
}
function saveDbSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.writeFile(DB_FILE, JSON.stringify(db, null, 1)).catch((e) => console.error('[db] write failed:', e.message));
  }, 1000);
}

// ---------- App ----------
const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'lan', accounts: true, players: players.size, farms: Object.keys(db.accounts).length });
});

// ---- ACCOUNT: nhập đúng username là lấy lại toàn bộ farm ----
app.get('/api/players/:username', (req, res) => {
  const acc = db.accounts[keyOf(req.params.username)];
  if (!acc) return res.status(404).json({ error: 'not found' });
  res.json(acc);
});

function saveAccount(username, body = {}) {
  const key = keyOf(username);
  if (!key) return null;
  const acc = {
    username: key,
    name: String(body.name || key).slice(0, 12),
    avatar: Number(body.avatar ?? db.accounts[key]?.avatar ?? 0),
    code: codeFromName(key),
    data: body.data && typeof body.data === 'object' ? body.data : (db.accounts[key]?.data || null),
    updatedAt: Date.now(),
  };
  db.accounts[key] = acc;
  saveDbSoon();
  return acc;
}
app.put('/api/players/:username', (req, res) => {
  const acc = saveAccount(req.params.username, req.body);
  if (!acc) return res.status(400).json({ error: 'bad username' });
  res.json({ ok: true, code: acc.code });
});
// sendBeacon (unload) chỉ POST được
app.post('/api/players/:username', (req, res) => {
  const acc = saveAccount(req.params.username, req.body);
  if (!acc) return res.status(400).json({ error: 'bad username' });
  res.json({ ok: true, code: acc.code });
});

// thăm farm bạn bằng mã 6 ký tự (kể cả chủ offline) — trả về dạng FarmSnapshot
app.get('/api/farms/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const acc = Object.values(db.accounts).find((a) => a.code === code);
  if (!acc || !acc.data) return res.status(404).json({ error: 'not found' });
  res.json({ ...acc.data, code, name: acc.name, avatar: acc.avatar, updatedAt: acc.updatedAt });
});

// serve game đã build
app.use(express.static(DIST));
app.use((_req, res) => res.sendFile(path.join(DIST, 'index.html')));

// ---------- Realtime (làng chung) ----------
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

/** id -> { id, v, name, avatar, code, x, y, dir, moving, bubble, bubbleAt, map, emote, emoteAt, visit, updatedAt } */
const players = new Map();
let broadcastTimer = null;

function publicList() {
  return [...players.values()].map(({ id, v, name, avatar, code, x, y, dir, moving, bubble, bubbleAt, map, emote, emoteAt, visit }) => (
    { id, v: v ?? 1, name, avatar, code, x, y, dir, moving, bubble, bubbleAt, map, emote, emoteAt, visit: visit ?? null, updatedAt: Date.now() }
  ));
}
function emitPlayers() {
  io.emit('players', publicList());
}
function emitSoon() {
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => { broadcastTimer = null; emitPlayers(); }, 300);
}

// ================= CASINO rooms (authoritative, LAN) =================
// bet 10..100 xu/ván. Server giữ bài + lượt + thắng thua; client tự trừ/cộng xu theo kết quả.
const casinoRooms = new Map(); // roomId -> room
const socketToRoom = new Map(); // socket.id -> roomId
const CASINO_IDCHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function casinoRoomId() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CASINO_IDCHARS[Math.floor(Math.random() * CASINO_IDCHARS.length)];
  if (casinoRooms.has(s)) return casinoRoomId();
  return s;
}
function casinoMax(game) { return game === 'caro' ? 2 : 4; }
function casinoMin(game) { return 2; }
/** Mỗi lượt tiến lên/caro 30s, vòng lật bài cào 45s — hết giờ trọng tài tự đánh */
const TURN_MS = 30000;
const BAICAO_MS = 45000;
function touchDeadline(room) {
  if (!room.state) return;
  room.state.deadline = Date.now() + (room.game === 'baicao' ? BAICAO_MS : TURN_MS);
}
function pidOf(myId) { return myId || 'anon'; }
// pid casino: client gửi kèm trong từng sự kiện (kết nối casino là socket riêng,
// không gửi hello nên myId của nó luôn null — không được dùng myId ở đây).
// Nhớ pid theo socket để dọn phòng khi mất kết nối.
const casinoPidBySocket = new Map(); // socket.id -> pid
function ccPid(socket, myId, p) {
  const direct = String(p?.pid || '').trim().slice(0, 80);
  if (direct) { casinoPidBySocket.set(socket.id, direct); return direct; }
  return casinoPidBySocket.get(socket.id) || pidOf(myId);
}
function casinoPlayerFrom(socket, myId, p = {}) {
  const pid = ccPid(socket, myId, p);
  const pl = players.get(pid) || players.get(myId);
  return {
    pid,
    sid: socket.id,
    name: String(p.name || pl?.name || 'Bạn').slice(0, 12),
    avatar: Number(p.avatar ?? pl?.avatar ?? 0),
    bot: false,
  };
}
function casinoPublic() {
  return [...casinoRooms.values()].map((r) => ({
    id: r.id, game: r.game, bet: r.bet, status: r.status,
    players: r.players.map((x) => ({ pid: x.pid, name: x.name, avatar: x.avatar, bot: !!x.bot })),
    hostPid: r.hostPid, updatedAt: r.updatedAt,
  }));
}
function casinoNewRoom(game, bet, me) {
  const id = casinoRoomId();
  return { id, game, bet, hostPid: me.pid, players: [me], status: 'waiting', state: null, winners: null, createdAt: Date.now(), updatedAt: Date.now() };
}
function leaveCasinoRoom(socket, pid, notify = false) {
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) return;
  const room = casinoRooms.get(roomId);
  socketToRoom.delete(socket.id);
  try { socket.leave('casino:' + roomId); } catch { /* ignore */ }
  if (!room) return;
  room.players = room.players.filter((x) => x.pid !== pid);
  if (!room.players.length) { casinoRooms.delete(roomId); }
  else {
    if (room.hostPid === pid) room.hostPid = room.players[0].pid;
    // đang chơi mà còn 1 người → người đó thắng (đối thủ bỏ cuộc)
    if (room.status === 'playing' && room.players.length === 1) {
      room.status = 'finished';
      room.winners = [room.players[0].pid];
      if (room.state) { room.state.winner = room.players[0].pid; }
    } else if (room.status === 'playing' && room.players.length < 1) {
      casinoRooms.delete(roomId);
      io.emit('casino:rooms', casinoPublic());
      return;
    }
    // bỏ lượt của người rời nếu đang tới lượt họ
    if (room.status === 'playing' && room.state?.turn === pid) {
      casinoSkipTurn(room, pid);
    }
    if (room.status === 'playing' && room.state) touchDeadline(room);
    room.updatedAt = Date.now();
    io.to('casino:' + roomId).emit('casino:state', room);
  }
  io.emit('casino:rooms', casinoPublic());
  if (notify) { /* caller emits null */ }
}
// ---- bài ----
function cDeck() {
  const d = [];
  for (let r = 3; r <= 15; r++) for (let s = 0; s < 4; s++) d.push({ r, s, id: `${r}-${s}` });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function cCmp(a, b) { return a.r !== b.r ? a.r - b.r : a.s - b.s; }
function cCombo(cards) {
  if (!cards?.length) return null;
  const a = cards.slice().sort(cCmp);
  const n = a.length;
  if (n === 1) return { type: 'single', len: 1, topRank: a[0].r, topSuit: a[0].s };
  if (n === 2 && a[0].r === a[1].r) return { type: 'pair', len: 2, topRank: a[0].r, topSuit: Math.max(a[0].s, a[1].s) };
  if (n === 3 && a[0].r === a[1].r && a[1].r === a[2].r) return { type: 'triple', len: 3, topRank: a[0].r, topSuit: Math.max(a[0].s, a[1].s, a[2].s) };
  if (n === 4 && a[0].r === a[1].r && a[1].r === a[2].r && a[2].r === a[3].r) return { type: 'four', len: 4, topRank: a[0].r, topSuit: 3 };
  if (n >= 3) {
    for (let i = 1; i < n; i++) if (a[i].r !== a[i - 1].r + 1) return null;
    if (a[n - 1].r >= 15) return null;
    return { type: 'straight', len: n, topRank: a[n - 1].r, topSuit: a[n - 1].s };
  }
  return null;
}
function cBeats(prev, next) {
  if (next.type === 'four') {
    if (prev.type === 'single' && prev.topRank === 15) return true;
    if (prev.type === 'pair' && prev.topRank === 15) return true;
    if (prev.type === 'four') return next.topRank > prev.topRank;
  }
  if (prev.type !== next.type || prev.len !== next.len) return false;
  if (next.topRank !== prev.topRank) return next.topRank > prev.topRank;
  return next.topSuit > prev.topSuit;
}
function tlNext(st, from) {
  const n = st.order.length;
  const i = st.order.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = st.order[(i + k) % n];
    if ((st.hands[id]?.length ?? 0) > 0) return id;
  }
  return from;
}
function tlAllPassed(st, me) {
  const others = st.order.filter((id) => id !== me && (st.hands[id]?.length ?? 0) > 0);
  return others.length > 0 && others.every((id) => st.passed.includes(id));
}
function casinoStartRoom(room) {
  const need = casinoMin(room.game);
  if (room.players.length < need) return `Cần ít nhất ${need} người (có thể thêm máy)`;
  const pids = room.players.map((x) => x.pid);
  room.pot = room.bet * room.players.length;
  if (room.game === 'tienlen') {
    const deck = cDeck();
    const hands = {};
    pids.forEach((id) => (hands[id] = []));
    for (let k = 0; k < 13; k++) for (const id of pids) { const c = deck.pop(); if (c) hands[id].push(c); }
    for (const id of pids) hands[id].sort(cCmp);
    let first = pids[0];
    for (const [id, h] of Object.entries(hands)) if (h.some((c) => c.r === 3 && c.s === 0)) first = id;
    room.state = { order: pids, hands, turn: first, leader: first, lastPlay: null, lastPlayer: null, passed: [], firstTurn: true, winner: null, rank: [], deadline: null };
  } else if (room.game === 'baicao') {
    const deck = cDeck();
    const hands = {};
    pids.forEach((id) => (hands[id] = []));
    for (let k = 0; k < 3; k++) for (const id of pids) { const c = deck.pop(); if (c) hands[id].push(c); }
    room.state = { order: pids, hands, revealed: room.players.filter((x) => x.bot).map((x) => x.pid), winners: null, deadline: null };
    if (room.state.revealed.length >= pids.length) casinoFinishBaiCao(room);
  } else if (room.game === 'caro') {
    if (pids.length !== 2) return 'Caro cần đúng 2 người';
    room.state = { size: 12, board: Array.from({ length: 12 }, () => Array(12).fill(null)), order: pids, turn: pids[0], winner: null, winLine: null, draw: false, moveCount: 0, deadline: null };
  }
  room.status = 'playing';
  room.winners = null;
  room.updatedAt = Date.now();
  return null;
}
function bcPoint(r) { if (r === 14) return 1; if (r >= 11 && r <= 13) return 10; if (r === 15) return 2; return r; }
function bcScore(hand) {
  const faces = hand.filter((c) => c.r >= 11 && c.r <= 13).length;
  if (hand.length === 3 && faces === 3) return { score: 10, top: hand.slice().sort(cCmp)[2] };
  return { score: hand.reduce((a, c) => a + bcPoint(c.r), 0) % 10, top: hand.slice().sort(cCmp)[hand.length - 1] };
}
function casinoFinishBaiCao(room) {
  const st = room.state;
  let best = [];
  for (const id of st.order) {
    if (!best.length) { best = [id]; continue; }
    const a = bcScore(st.hands[best[0]]); const b = bcScore(st.hands[id]);
    if (b.score !== a.score) { if (b.score > a.score) best = [id]; }
    else {
      if (b.top.r !== a.top.r) { if (b.top.r > a.top.r) best = [id]; }
      else if (b.top.s !== a.top.s) { if (b.top.s > a.top.s) best = [id]; }
      else best.push(id);
    }
  }
  st.winners = best;
  st.deadline = null;
  room.status = 'finished';
  room.winners = best;
  room.updatedAt = Date.now();
}
function caroWin(board, r, c) {
  const v = board[r]?.[c];
  if (v == null) return null;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line = [[r, c]];
    for (let k = 1; k < 5; k++) { const nr = r + dr * k, nc = c + dc * k; if (board[nr]?.[nc] !== v) break; line.push([nr, nc]); }
    for (let k = 1; k < 5; k++) { const nr = r - dr * k, nc = c - dc * k; if (board[nr]?.[nc] !== v) break; line.unshift([nr, nc]); }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return null;
}
function casinoSkipTurn(room, pid) {
  const st = room.state;
  if (!st) return;
  if (room.game === 'tienlen') {
    if (st.turn !== pid) return;
    if (!st.lastPlay) {
      // đầu vòng mà rời → chuyển lượt
      st.turn = tlNext(st, pid);
      st.leader = st.turn; st.passed = [];
    } else {
      const passed = st.passed.includes(pid) ? st.passed : [...st.passed, pid];
      const alive = st.order.filter((id) => (st.hands[id]?.length ?? 0) > 0);
      const still = alive.filter((id) => !passed.includes(id));
      if (still.length === 1) { st.passed = []; st.lastPlay = null; st.lastPlayer = null; st.leader = still[0]; st.turn = still[0]; }
      else { st.passed = passed; st.turn = tlNext(st, pid); }
    }
  } else if (room.game === 'caro') {
    // bỏ lượt caro = đổi turn (coi như pass 1 nước)
    const i = st.order.indexOf(pid);
    if (st.turn === pid) st.turn = st.order[(i + 1) % st.order.length];
  }
}
function casinoAction(room, pid, p) {
  const st = room.state;
  if (!st) return 'Chưa bắt đầu';
  if (!room.players.some((x) => x.pid === pid)) return 'Bạn không trong phòng';
  if (room.game === 'tienlen') {
    if (st.winner) return 'Ván đã kết thúc';
    if (st.turn !== pid) return 'Chưa tới lượt';
    if (p.type === 'pass') {
      if (!st.lastPlay) return 'Đầu vòng phải ra bài';
      const passed = st.passed.includes(pid) ? st.passed : [...st.passed, pid];
      const alive = st.order.filter((id) => (st.hands[id]?.length ?? 0) > 0);
      const still = alive.filter((id) => !passed.includes(id));
      if (still.length === 1) { st.passed = []; st.lastPlay = null; st.lastPlayer = null; st.leader = still[0]; st.turn = still[0]; }
      else { st.passed = passed; st.turn = tlNext(st, pid); }
      room.updatedAt = Date.now();
      return null;
    }
    if (p.type === 'play') {
      const ids = new Set((p.cards || []).map(String));
      const hand = st.hands[pid] ?? [];
      const cards = hand.filter((c) => ids.has(c.id));
      if (cards.length !== ids.size || !cards.length) return 'Chọn bài trong tay';
      const info = cCombo(cards);
      if (!info) return 'Bộ không hợp lệ';
      if (st.firstTurn && !cards.some((c) => c.r === 3 && c.s === 0)) return 'Ván đầu phải ra 3♠';
      const isLead = !st.lastPlay || st.lastPlayer === pid || tlAllPassed(st, pid);
      if (!isLead) {
        const prev = cCombo(st.lastPlay);
        if (!prev || !cBeats(prev, info)) return 'Bài nhỏ, không chặt được';
      }
      st.hands[pid] = hand.filter((c) => !ids.has(c.id));
      st.firstTurn = false;
      if (st.hands[pid].length === 0) {
        st.winner = pid; st.rank = [...(st.rank || []), pid];
        st.lastPlay = cards; st.lastPlayer = pid;
        st.deadline = null;
        room.status = 'finished'; room.winners = [pid];
      } else {
        st.lastPlay = cards; st.lastPlayer = pid; st.leader = pid;
        st.passed = st.passed.filter((id) => id !== pid);
        st.turn = tlNext(st, pid);
      }
      room.updatedAt = Date.now();
      return null;
    }
    return 'Hành động không hợp lệ';
  }
  if (room.game === 'baicao') {
    if (p.type === 'reveal') {
      if (!st.revealed.includes(pid)) st.revealed.push(pid);
      if (st.revealed.length >= st.order.length) casinoFinishBaiCao(room);
      else room.updatedAt = Date.now();
      return null;
    }
    return 'Hành động không hợp lệ';
  }
  if (room.game === 'caro') {
    if (st.winner || st.draw) return 'Ván đã kết thúc';
    if (st.turn !== pid) return 'Chưa tới lượt';
    if (p.type === 'move') {
      const r = Number(p.r), c = Number(p.c);
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= st.size || c >= st.size) return 'Ô không hợp lệ';
      if (st.board[r][c] !== null) return 'Ô đã đánh';
      const idx = st.order.indexOf(pid);
      st.board[r][c] = idx; st.moveCount++;
      const line = caroWin(st.board, r, c);
      if (line) { st.winner = pid; st.winLine = line; st.deadline = null; room.status = 'finished'; room.winners = [pid]; }
      else if (st.moveCount >= st.size * st.size) { st.draw = true; st.deadline = null; room.status = 'finished'; room.winners = []; }
      else st.turn = st.order[(idx + 1) % st.order.length];
      room.updatedAt = Date.now();
      return null;
    }
    return 'Hành động không hợp lệ';
  }
  return 'Game không hợp lệ';
}
/** Hết giờ mà chưa đi: trọng tài tự xử (tiến lên: bỏ qua hoặc ra nhỏ nhất; bài cào: tự lật; caro: tự đánh) */
function casinoAutoTimeout(room) {
  const st = room.state;
  if (!st || room.status !== 'playing') return false;
  if (room.game === 'tienlen') {
    if (st.winner) return false;
    const cur = st.turn;
    const mv = tlBotPick(st, cur);
    if (mv) casinoAction(room, cur, { type: 'play', cards: mv.map((c) => c.id) });
    else if (st.lastPlay) casinoAction(room, cur, { type: 'pass' });
    else {
      // đầu vòng mà không có nước hợp lệ (hiếm) → ra lá nhỏ nhất
      const h = (st.hands[cur] || []).slice().sort(cCmp);
      if (!h.length) return false;
      casinoAction(room, cur, { type: 'play', cards: [h[0].id] });
    }
    if (room.status === 'playing') touchDeadline(room);
    room.updatedAt = Date.now();
    return true;
  }
  if (room.game === 'baicao') {
    let changed = false;
    for (const id of st.order) {
      if (!st.revealed.includes(id)) { st.revealed.push(id); changed = true; }
    }
    if (changed) {
      if (st.revealed.length >= st.order.length) casinoFinishBaiCao(room);
      else room.updatedAt = Date.now();
      return true;
    }
    return false;
  }
  if (room.game === 'caro') {
    if (st.winner || st.draw) return false;
    const mv = caroBotPick(st);
    if (!mv) return false;
    casinoAction(room, st.turn, { type: 'move', r: mv[0], c: mv[1] });
    if (room.status === 'playing') touchDeadline(room);
    room.updatedAt = Date.now();
    return true;
  }
  return false;
}
// ---- bot tự đánh (server) ----
function casinoMaybeBot(room) {
  if (room.status !== 'playing' || !room.state) return;
  const st = room.state;
  const botOf = (pid) => room.players.find((x) => x.pid === pid && x.bot);
  if (room.game === 'tienlen') {
    if (st.winner) return;
    const cur = room.players.find((x) => x.pid === st.turn);
    if (!cur?.bot) return;
    setTimeout(() => {
      if (room.status !== 'playing' || st.winner) return;
      if (st.turn !== cur.pid) return;
      const mv = tlBotPick(st, cur.pid);
      if (mv) casinoAction(room, cur.pid, { type: 'play', cards: mv.map((c) => c.id) });
      else if (st.lastPlay) casinoAction(room, cur.pid, { type: 'pass' });
      else {
        // đầu vòng mà bot không có nước (không xảy ra) → đánh lá nhỏ nhất
        const h = (st.hands[cur.pid] || []).slice().sort(cCmp);
        if (h.length) casinoAction(room, cur.pid, { type: 'play', cards: [h[0].id] });
      }
      if (room.status === 'playing' && room.state) touchDeadline(room);
      io.to('casino:' + room.id).emit('casino:state', room);
      io.emit('casino:rooms', casinoPublic());
      casinoMaybeBot(room);
    }, 800);
  } else if (room.game === 'caro') {
    const cur = room.players.find((x) => x.pid === st.turn);
    if (!cur?.bot || st.winner || st.draw) return;
    setTimeout(() => {
      if (room.status !== 'playing') return;
      const mv = caroBotPick(st);
      if (mv) casinoAction(room, cur.pid, { type: 'move', r: mv[0], c: mv[1] });
      if (room.status === 'playing' && room.state) touchDeadline(room);
      io.to('casino:' + room.id).emit('casino:state', room);
      io.emit('casino:rooms', casinoPublic());
      casinoMaybeBot(room);
    }, 700);
  }
}
function tlBotPick(st, pid) {
  const hand = st.hands[pid] || [];
  if (!hand.length) return null;
  const byRank = new Map();
  for (const c of hand) {
    if (!byRank.has(c.r)) byRank.set(c.r, []);
    byRank.get(c.r).push(c);
  }
  const cands = [];
  for (const g of byRank.values()) {
    const s = g.slice().sort((a, b) => a.s - b.s);
    cands.push([s[0]]);
    if (s.length >= 2) cands.push(s.slice(0, 2));
    if (s.length >= 3) cands.push(s.slice(0, 3));
    if (s.length >= 4) cands.push(s.slice(0, 4));
  }
  const isLead = !st.lastPlay || st.lastPlayer === pid || tlAllPassed(st, pid);
  let list = cands;
  if (st.firstTurn) list = list.filter((c) => c.some((x) => x.r === 3 && x.s === 0));
  if (!list.length) return null;
  if (isLead) {
    list.sort((a, b) => { const ia = cCombo(a); const ib = cCombo(b); return ia.topRank - ib.topRank || ia.len - ib.len; });
    return list[0];
  }
  const prev = cCombo(st.lastPlay);
  const ok = list.filter((c) => { const i = cCombo(c); return i && cBeats(prev, i); });
  ok.sort((a, b) => { const ia = cCombo(a); const ib = cCombo(b); return ia.topRank - ib.topRank || ia.topSuit - ib.topSuit; });
  return ok[0] || null;
}
function caroBotPick(st) {
  const size = st.size;
  const meIdx = st.order.indexOf(st.turn);
  const me = meIdx; const opp = 1 - meIdx;
  // thu thập ô trống gần quân
  let has = false;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (st.board[r][c] !== null) { has = true; break; }
  if (!has) return [Math.floor(size / 2), Math.floor(size / 2)];
  const cand = new Map();
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (st.board[r][c] !== null) continue;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < size && nc < size && st.board[nr][nc] !== null) { near = true; break; }
    }
    if (near) cand.set(r + ':' + c, [r, c]);
  }
  const list = [...cand.values()];
  const tryWin = (v) => {
    for (const [r, c] of list) { st.board[r][c] = v; const w = caroWin(st.board, r, c); st.board[r][c] = null; if (w) return [r, c]; }
    return null;
  };
  return tryWin(me) || tryWin(opp) || list[Math.floor(Math.random() * list.length)] || null;
}

io.on('connection', (socket) => {
  let myId = null;

  socket.on('hello', (p = {}) => {
    myId = p.id || socket.id;
    const prev = players.get(myId);
    players.set(myId, {
      id: myId,
      v: Number(p.v ?? prev?.v ?? 1),
      name: String(p.name || prev?.name || 'Bạn').slice(0, 12),
      avatar: Number(p.avatar ?? prev?.avatar ?? 0),
      code: String(p.code || prev?.code || ''),
      x: Number(p.x ?? prev?.x ?? 700), y: Number(p.y ?? prev?.y ?? 600),
      dir: prev?.dir ?? 1, moving: false,
      bubble: prev?.bubble, bubbleAt: prev?.bubbleAt,
      map: (p.map === 'farm' || p.map === 'town') ? p.map : (prev?.map ?? 'farm'),
      emote: prev?.emote, emoteAt: prev?.emoteAt,
      visit: typeof p.visit === 'string' ? p.visit.toUpperCase().slice(0, 6) : (prev?.visit ?? null),
      updatedAt: Date.now(),
    });
    socket.emit('players', publicList());
    emitSoon();
  });

  socket.on('pos', (p = {}) => {
    if (!myId || !players.has(myId)) return;
    const pl = players.get(myId);
    pl.x = p.x; pl.y = p.y; pl.dir = p.dir === -1 ? -1 : 1; pl.moving = !!p.moving;
    if (p.v != null) pl.v = Number(p.v) || 1;
    if (p.bubble) { pl.bubble = String(p.bubble).slice(0, 80); pl.bubbleAt = Date.now(); }
    if (p.map === 'farm' || p.map === 'town') pl.map = p.map;
    if (p.emote) { pl.emote = String(p.emote).slice(0, 20); pl.emoteAt = Date.now(); }
    // client mới luôn gửi visit (mã farm đang thăm hoặc null) → gán trực tiếp;
    // client cũ không gửi key này (undefined) → giữ nguyên
    if (p.visit !== undefined) pl.visit = (typeof p.visit === 'string' && p.visit) ? p.visit.toUpperCase().slice(0, 6) : null;
    pl.updatedAt = Date.now();
    emitSoon();
  });

  socket.on('chat', (p = {}) => {
    if (!myId || !players.has(myId)) return;
    const text = String(p.text || '').slice(0, 80);
    if (!text) return;
    const pl = players.get(myId);
    pl.bubble = text; pl.bubbleAt = Date.now();
    io.emit('chat', { id: `${Date.now()}-${myId}`, fromId: myId, fromName: pl.name, text, at: Date.now() });
    emitSoon();
  });

  socket.on('farm:save', (snap = {}) => {
    // client gửi { username, name, avatar, data } — upsert account
    if (snap.username) saveAccount(snap.username, snap);
    else if (snap.code) {
      // tương thích client cũ: tìm account theo code
      const acc = Object.values(db.accounts).find((a) => a.code === String(snap.code).toUpperCase());
      if (acc) saveAccount(acc.username, { ...snap, data: snap });
    }
  });

  // ================= CASINO (phòng chơi realtime) =================
  socket.on('casino:list', () => {
    socket.emit('casino:rooms', casinoPublic());
  });
  socket.on('casino:create', (p = {}) => {
    const game = ['tienlen', 'baicao', 'caro'].includes(p.game) ? p.game : 'tienlen';
    const bet = Math.max(10, Math.min(100, Number(p.bet) || 10));
    const me = casinoPlayerFrom(socket, myId, { ...(p.player || {}), pid: p.pid });
    leaveCasinoRoom(socket, me.pid);
    const room = casinoNewRoom(game, bet, me);
    casinoRooms.set(room.id, room);
    socket.join('casino:' + room.id);
    socketToRoom.set(socket.id, room.id);
    socket.emit('casino:state', room);
    io.emit('casino:rooms', casinoPublic());
  });
  socket.on('casino:join', (p = {}) => {
    const room = casinoRooms.get(String(p.roomId || '').toUpperCase());
    const me = casinoPlayerFrom(socket, myId, { ...(p.player || {}), pid: p.pid });
    if (!room) { socket.emit('casino:error', { msg: 'Phòng không tồn tại' }); return; }
    if (room.status !== 'waiting') { socket.emit('casino:error', { msg: 'Phòng đang chơi rồi' }); return; }
    if (room.players.length >= casinoMax(room.game)) { socket.emit('casino:error', { msg: 'Phòng đầy' }); return; }
    if (room.players.some((x) => x.pid === me.pid)) {
      socket.join('casino:' + room.id);
      socketToRoom.set(socket.id, room.id);
      socket.emit('casino:state', room);
      return;
    }
    leaveCasinoRoom(socket, me.pid);
    room.players.push(me);
    room.updatedAt = Date.now();
    socket.join('casino:' + room.id);
    socketToRoom.set(socket.id, room.id);
    io.to('casino:' + room.id).emit('casino:state', room);
    io.emit('casino:rooms', casinoPublic());
  });
  socket.on('casino:leave', (p = {}) => {
    leaveCasinoRoom(socket, ccPid(socket, myId, p), true);
    socket.emit('casino:state', null);
  });
  socket.on('casino:addbot', (p = {}) => {
    const roomId = socketToRoom.get(socket.id);
    const room = roomId && casinoRooms.get(roomId);
    if (!room) return;
    if (room.hostPid !== ccPid(socket, myId, p)) { socket.emit('casino:error', { msg: 'Chỉ chủ phòng thêm máy' }); return; }
    if (room.status !== 'waiting') return;
    if (room.players.length >= casinoMax(room.game)) return;
    const n = room.players.filter((x) => x.bot).length + 1;
    room.players.push({ pid: `bot-${room.id}-${Date.now() % 100000}-${n}`, sid: null, name: ['Máy Lan', 'Máy Tèo', 'Máy Đào', 'Máy Bờm'][n % 4] || ('Máy ' + n), avatar: n % 4, bot: true });
    room.updatedAt = Date.now();
    io.to('casino:' + room.id).emit('casino:state', room);
    io.emit('casino:rooms', casinoPublic());
  });
  socket.on('casino:start', (p = {}) => {
    const roomId = socketToRoom.get(socket.id);
    const room = roomId && casinoRooms.get(roomId);
    if (!room) return;
    if (room.hostPid !== ccPid(socket, myId, p)) { socket.emit('casino:error', { msg: 'Chỉ chủ phòng bắt đầu' }); return; }
    const err = casinoStartRoom(room);
    if (err) { socket.emit('casino:error', { msg: err }); return; }
    touchDeadline(room);
    io.to('casino:' + room.id).emit('casino:state', room);
    io.emit('casino:rooms', casinoPublic());
    casinoMaybeBot(room);
  });
  socket.on('casino:action', (p = {}) => {
    const roomId = socketToRoom.get(socket.id);
    const room = roomId && casinoRooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    const pid = ccPid(socket, myId, p);
    const err = casinoAction(room, pid, p);
    if (err) { socket.emit('casino:error', { msg: err }); return; }
    if (room.status === 'playing' && room.state) touchDeadline(room);
    io.to('casino:' + room.id).emit('casino:state', room);
    io.emit('casino:rooms', casinoPublic());
    casinoMaybeBot(room);
  });
  socket.on('casino:rematch', (p = {}) => {
    const roomId = socketToRoom.get(socket.id);
    const room = roomId && casinoRooms.get(roomId);
    if (!room) return;
    if (room.hostPid !== ccPid(socket, myId, p)) { socket.emit('casino:error', { msg: 'Chỉ chủ phòng mở ván mới' }); return; }
    if (room.status !== 'finished') return;
    room.status = 'waiting';
    room.state = null;
    room.winners = null;
    room.updatedAt = Date.now();
    io.to('casino:' + room.id).emit('casino:state', room);
    io.emit('casino:rooms', casinoPublic());
  });

  socket.on('disconnect', () => {
    const cpid = casinoPidBySocket.get(socket.id);
    if (cpid) { leaveCasinoRoom(socket, cpid, true); casinoPidBySocket.delete(socket.id); }
    else leaveCasinoRoom(socket, pidOf(myId), true);
    if (myId) { players.delete(myId); myId = null; emitSoon(); }
  });
});

// dọn người mất kết nối
setInterval(() => {
  const now = Date.now();
  let drop = false;
  for (const [id, p] of players) {
    if (now - (p.updatedAt || 0) > 12000) { players.delete(id); drop = true; }
  }
  if (drop) emitPlayers();
}, 3000);

// casino: hết giờ lượt → trọng tài tự đánh (1s kiểm tra 1 lần)
setInterval(() => {
  const now = Date.now();
  for (const room of casinoRooms.values()) {
    if (room.status !== 'playing' || !room.state || room.state.deadline == null) continue;
    if (now < room.state.deadline) continue;
    // bỏ qua nếu tới lượt bot (bot loop riêng sẽ đánh trong ~1s)
    if (room.state.turn) {
      const cur = room.players.find((x) => x.pid === room.state.turn);
      if (cur?.bot) continue;
    }
    if (casinoAutoTimeout(room)) {
      io.to('casino:' + room.id).emit('casino:state', room);
      io.emit('casino:rooms', casinoPublic());
      casinoMaybeBot(room);
    } else if (room.status === 'playing' && room.state) {
      // không xử được (vd chờ bot) → gia hạn thêm để khỏi lặp vô hạn
      touchDeadline(room);
    }
  }
}, 1000);

// ---------- Start ----------
function lanIps() {
  const out = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

await loadDb();
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n🌾 NÔNG TRẠI PIXEL — LAN server running!');
  console.log(`   Local:  http://localhost:${PORT}/`);
  for (const ip of lanIps()) console.log(`   LAN:    http://${ip}:${PORT}/  ← cho cả mạng vào link này`);
  console.log(`   DB:     ${DB_FILE}`);
  console.log('   (điện thoại + máy khác cùng WiFi mở link LAN là chơi chung)\n');
});
