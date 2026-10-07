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

  socket.on('disconnect', () => {
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
