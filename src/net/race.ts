// ===== GIẢI ĐUA XE TRƯỜNG ĐUA THẬT (tối đa 5 người, không cần chủ trì) =====
// Ai cũng tạo phòng được: broadcast OPEN kèm tên chủ phòng.
// Chủ phòng START → mọi tay lái tự về khu mua sắm, xếp vào ô xuất phát,
// đếm ngược 3s → LÁI XE THẬT quanh vòng track (5 vòng, 10 chốt/vòng, cán đủ chốt
// mới tính) — vị trí xe của nhau thấy trực tiếp trên map qua làng.
// Tiến trình (vòng/chốt) phát cho cả phòng mỗi khi qua chốt + RFIN khi về đích.
// Mỗi client tự chốt bảng theo giờ về đích (ai về trước thắng) và tự trao giải.
// Một mình thì đua với 4 tay đua máy. Tin nhắn qua kênh game ẩn `🏁RC|`.
import { create } from 'zustand';
import { useGame } from '../game/store';
import { RACE_CPS, RACE_CP_R, RACE_LAPS, raceGridSlot, raceLoopPoint, RACE_LOOP_TOTAL } from '../game/mall';
export { RACE_LAPS, raceGridSlot };
import { sfx } from '../game/audio';
import { gameMe, markSeen, onGameMsg, sendGameMsg } from './village';
import type { ChatMsg } from './transport';

export const RACE_MAX = 5;
export const RACE_COUNTDOWN_MS = 3000;
export const RACE_N = RACE_CPS.length;
export const RACE_PRIZES = [
  { xu: 300, gem: 1, label: '🥇 Vô địch' },
  { xu: 150, gem: 0, label: '🥈 Á quân' },
  { xu: 80, gem: 0, label: '🥉 Hạng ba' },
];
const P = '🏁RC|';
const RACE_BOTS = ['Tí Lửa', 'Tèo Bốc', 'Tũn Khói', 'Tẹt Ga'];
const FIN_GRACE_MS = 8000;

export type RacePhase = 'idle' | 'lobby' | 'count' | 'racing' | 'done';
export interface RaceProg { lap: number; cp: number }

export const isRaceBot = (n: string) => RACE_BOTS.includes(n);
/** điểm tiến trình để xếp hạng: vòng * số chốt + chốt */
export const progScore = (p: RaceProg) => p.lap * RACE_N + p.cp;
/** % hoàn thành cuộc đua (0–100) */
export const racePct = (p: RaceProg) =>
  Math.min(100, Math.round((progScore(p) / (RACE_LAPS * RACE_N)) * 100));

interface RaceState {
  phase: RacePhase;
  host: string;
  racers: string[];
  progress: Record<string, RaceProg>;
  /** giờ về đích (ms tính từ goAt), bot cũng có */
  finishes: Record<string, number>;
  goAt: number;
  results: string[];
  /** phòng đang mở của người khác (host -> số tay lái) để bấm tham gia */
  openRooms: Record<string, { n: number; at: number }>;
  create: () => void;
  join: (host: string) => void;
  leave: () => void;
  start: () => void;
  tick: (now: number) => void;
}

const seen = new Set<string>();
let lastTick = 0;
/** tốc độ bot: ms/vòng (quy ra chốt) + tiến trình float đang chạy */
const botLapMs: Record<string, number> = {};
let botFloat: Record<string, number> = {};
/** mình đã về đích + hẹn giờ chốt bảng */
let myDoneAt = 0;
let finalizeAt = 0;
let lastRposResend = 0;

function me(): string {
  return gameMe().name;
}

function botTick(now: number, dt: number) {
  const st = useRace.getState();
  if (st.phase !== 'racing') return;
  const progress = { ...st.progress };
  const finishes = { ...st.finishes };
  let changed = false;
  for (const b of RACE_BOTS) {
    if (!st.racers.includes(b) || finishes[b] != null) continue;
    const per = (botLapMs[b] || 12000) / RACE_N; // ms/chốt
    botFloat[b] = (botFloat[b] ?? 0) + dt / per;
    if (botFloat[b] >= RACE_LAPS * RACE_N) {
      finishes[b] = now - st.goAt;
      delete progress[b];
    } else {
      const f = Math.floor(botFloat[b]);
      progress[b] = { lap: Math.floor(f / RACE_N), cp: f % RACE_N };
    }
    changed = true;
  }
  if (changed) useRace.setState({ progress, finishes });
}

function finalize() {
  const st = useRace.getState();
  if (st.phase !== 'racing') return;
  const score = (n: string) =>
    st.finishes[n] != null ? st.finishes[n] : Infinity;
  const results = [...st.racers].sort((a, b) => {
    const fa = score(a), fb = score(b);
    if (fa !== fb) return fa - fb;
    return progScore(st.progress[b] ?? { lap: 0, cp: 0 }) - progScore(st.progress[a] ?? { lap: 0, cp: 0 });
  });
  useRace.setState({ phase: 'done', results });
  myDoneAt = 0; finalizeAt = 0;
  const rank = results.indexOf(me());
  const g = useGame.getState();
  if (rank >= 0 && rank < RACE_PRIZES.length) {
    const pz = RACE_PRIZES[rank];
    g.addXu(pz.xu);
    if (pz.gem > 0) g.addGem(pz.gem);
    sfx.lvup();
    g.toast(`🏁 Giải đua: bạn ${pz.label}! +${pz.xu} xu${pz.gem ? ` +${pz.gem} gem` : ''}`);
    g.setModal('race');
  } else {
    sfx.catch_();
    g.toast(`🏁 Giải đua: ${results[0] ?? '?'} vô địch! Bạn hạng ${rank + 1}`);
    g.setModal('race');
  }
}

function handleMsg(m: ChatMsg) {
  if (markSeen(seen, m.id)) return;
  const body = m.text.slice(P.length);
  const [kind, ...rest] = body.split('|');
  const st = useRace.getState();
  if (kind === 'OPEN') {
    const host = rest[0] || m.fromName;
    if (host === me()) return;
    const openRooms = { ...st.openRooms, [host]: { n: 1, at: Date.now() } };
    useRace.setState({ openRooms });
    useGame.getState().toast(`🏁 ${host} mở phòng đua xe (tối đa ${RACE_MAX})! Mở menu Đua xe để tham gia!`);
  } else if (kind === 'JOIN') {
    const host = rest[0];
    const who = rest[1] || m.fromName;
    if (host !== me()) return; // chỉ chủ phòng duyệt
    if (st.phase !== 'lobby') return;
    if (st.racers.includes(who) || st.racers.length >= RACE_MAX) return;
    const racers = [...st.racers, who];
    useRace.setState({ racers });
    sendGameMsg(`${P}ROSTER|${me()}|${racers.join(',')}`);
  } else if (kind === 'ROSTER') {
    if (st.phase === 'racing' || st.phase === 'count') return;
    const host = rest[0];
    const racers = (rest[1] ?? '').split(',').filter(Boolean);
    if (host === me() && racers.length === 0) return; // mình giải tán, bỏ qua echo
    if (st.phase === 'lobby' && st.host === host && !racers.includes(me())) {
      // chủ phòng giải tán / mình bị mời ra → về chờ
      useRace.setState({ phase: 'idle', host: '', racers: [], progress: {}, finishes: {}, results: [] });
      useGame.getState().toast('Phòng đua đã giải tán!');
      return;
    }
    if (!racers.includes(me())) return;
    useRace.setState({ phase: 'lobby', host, racers, progress: {}, finishes: {}, results: [] });
    sfx.click();
  } else if (kind === 'LEAVE') {
    const who = rest[0] || m.fromName;
    if (!st.racers.includes(who)) return;
    if (st.phase === 'racing' || st.phase === 'count') {
      // bỏ cuộc giữa chừng: xóa khỏi bảng (DNF)
      const racers = st.racers.filter((r) => r !== who);
      const progress = { ...st.progress };
      delete progress[who];
      useRace.setState({ racers, progress });
      return;
    }
    if (st.host !== me()) return;
    const racers = st.racers.filter((r) => r !== who);
    useRace.setState({ racers });
    sendGameMsg(`${P}ROSTER|${me()}|${racers.join(',')}`);
  } else if (kind === 'START') {
    const goAt = Number(rest[0]);
    const racers = (rest[1] ?? '').split(',').filter(Boolean);
    if (!Number.isFinite(goAt) || !racers.includes(me())) return;
    for (const b of RACE_BOTS) {
      botLapMs[b] = 9000 + Math.random() * 7000;
    }
    botFloat = {};
    myDoneAt = 0; finalizeAt = 0;
    useRace.setState({ phase: 'count', host: st.host || m.fromName, racers, progress: {}, finishes: {}, goAt, results: [] });
    sfx.catch_();
    // đóng bảng ngay để cả phòng THẤY đường đua + ô xuất phát (đếm ngược hiện trên HUD)
    if (useGame.getState().modal === 'race') useGame.getState().setModal(null);
    useGame.getState().toast('🏁 Chuẩn bị… đang đưa bạn ra vạch xuất phát!');
  } else if (kind === 'RPOS') {
    if (st.phase !== 'racing') return;
    const who = rest[0] || m.fromName;
    const lap = Number(rest[1]), cp = Number(rest[2]);
    if (!st.racers.includes(who) || isRaceBot(who)) return;
    if (!Number.isFinite(lap) || !Number.isFinite(cp)) return;
    const cur = st.progress[who] ?? { lap: 0, cp: 0 };
    if (progScore({ lap, cp }) < progScore(cur)) return; // bỏ gói cũ
    useRace.setState({ progress: { ...st.progress, [who]: { lap, cp } } });
  } else if (kind === 'RFIN') {
    if (st.phase !== 'racing') return;
    const who = rest[0] || m.fromName;
    const ms = Number(rest[1]);
    if (!st.racers.includes(who) || !Number.isFinite(ms)) return;
    const finishes = { ...st.finishes, [who]: ms };
    useRace.setState({ finishes });
    // mọi người thật đều về đích → chốt bảng ngay
    const humans = st.racers.filter((r) => !isRaceBot(r));
    if (humans.length > 0 && humans.every((h) => finishes[h] != null)) finalize();
  }
}

export const useRace = create<RaceState>()((set, get) => ({
  phase: 'idle',
  host: '',
  racers: [],
  progress: {},
  finishes: {},
  goAt: 0,
  results: [],
  openRooms: {},

  create: () => {
    const name = me();
    set({ phase: 'lobby', host: name, racers: [name], progress: {}, finishes: {}, results: [] });
    sendGameMsg(`${P}OPEN|${name}`);
    sfx.click();
    useGame.getState().toast(`🏁 Bạn mở phòng đua! Chờ bạn bè vào (tối đa ${RACE_MAX}) rồi bấm Bắt đầu!`);
  },

  join: (host: string) => {
    const s = get();
    if (s.phase !== 'idle') {
      useGame.getState().toast('Bạn đang trong phòng đua rồi!');
      return;
    }
    sendGameMsg(`${P}JOIN|${host}|${me()}`);
    useGame.getState().toast(`Đã xin vào phòng của ${host}…`);
    // watchdog: không thấy ROSTER sau 2.5s thì báo
    setTimeout(() => {
      const cur = useRace.getState();
      if (cur.phase === 'idle') useGame.getState().toast(`${host} chưa phản hồi — phòng đầy hoặc đã đua rồi!`);
    }, 2500);
  },

  leave: () => {
    const s = get();
    if (s.phase === 'racing' || s.phase === 'count') sendGameMsg(`${P}LEAVE|${me()}`);
    else if (s.host === me()) sendGameMsg(`${P}ROSTER|${me()}|`);
    else if (s.phase === 'lobby') sendGameMsg(`${P}LEAVE|${me()}`);
    myDoneAt = 0; finalizeAt = 0;
    set({ phase: 'idle', host: '', racers: [], progress: {}, finishes: {}, results: [] });
    sfx.click();
  },

  start: () => {
    const s = get();
    if (s.host !== me() || s.phase !== 'lobby') return;
    let racers = [...s.racers];
    // một mình thì đua với 4 tay đua máy cho vui
    if (racers.length < 2) racers = [me(), ...RACE_BOTS];
    for (const b of RACE_BOTS) {
      botLapMs[b] = 9000 + Math.random() * 7000;
    }
    botFloat = {};
    myDoneAt = 0; finalizeAt = 0;
    const goAt = Date.now() + RACE_COUNTDOWN_MS;
    set({ racers, progress: {}, finishes: {}, phase: 'count', goAt, results: [] });
    sendGameMsg(`${P}START|${goAt}|${racers.join(',')}`);
    sfx.catch_();
    if (useGame.getState().modal === 'race') useGame.getState().setModal(null);
    useGame.getState().toast('🏁 Chuẩn bị… đang đưa cả phòng ra vạch xuất phát!');
  },

  tick: (now: number) => {
    const s = get();
    const dt = lastTick ? Math.min(1000, now - lastTick) : 200;
    lastTick = now;
    // dọn phòng mở quá 60s không ai vào
    if (Object.keys(s.openRooms).length) {
      const fresh: RaceState['openRooms'] = {};
      for (const [h, r] of Object.entries(s.openRooms)) {
        if (now - r.at < 60000) fresh[h] = r;
      }
      if (Object.keys(fresh).length !== Object.keys(s.openRooms).length) set({ openRooms: fresh });
    }
    if (s.phase === 'count' && now >= s.goAt) {
      set({ phase: 'racing' });
      sfx.lvup();
      // đóng mọi bảng để lái xe (kể cả đang mở shop/làng)
      useGame.getState().setModal(null);
      useGame.getState().toast(`🏁 XUẤT PHÁT! Lái xe qua ${RACE_CPS.length} chốt × ${RACE_LAPS} vòng!`);
    }
    if (s.phase === 'racing') {
      botTick(now, dt);
      // gửi lại tiến trình của mình 3s/lần (phòng rớt gói)
      if (myDoneAt === 0 && now - lastRposResend > 3000) {
        const mine = useRace.getState().progress[me()];
        if (mine) {
          lastRposResend = now;
          sendGameMsg(`${P}RPOS|${me()}|${mine.lap}|${mine.cp}`);
        }
      }
      if (myDoneAt !== 0 && now >= finalizeAt) finalize();
    }
  },
}));

onGameMsg(P, handleMsg);

// tick gọi mỗi frame từ GameCanvas (tự tính dt, gọi nhiều nơi cũng an toàn)
export function tickRace(now = Date.now()) {
  try { useRace.getState().tick(now); } catch { /* ignore */ }
}

/** màu xe + áo của 4 tay đua máy */
export const RACE_BOT_STYLE: Record<string, { color: string; shirt: string }> = {
  'Tí Lửa': { color: '#e53935', shirt: '#e53935' },
  'Tèo Bốc': { color: '#3b82f6', shirt: '#3b82f6' },
  'Tũn Khói': { color: '#9ca3af', shirt: '#4b5563' },
  'Tẹt Ga': { color: '#fdd835', shirt: '#f59e0b' },
};

export interface RaceBotDraw { name: string; x: number; y: number; dir: 1 | -1; moving: boolean }

/** Vị trí xe các tay đua máy để vẽ lên map: đếm ngược thì xếp ô xuất phát,
 *  đang đua thì chạy theo tiến trình, về đích thì đậu sau vạch. */
export function raceBotPos(): RaceBotDraw[] {
  const st = useRace.getState();
  if (st.phase !== 'count' && st.phase !== 'racing' && st.phase !== 'done') return [];
  const out: RaceBotDraw[] = [];
  st.racers.forEach((n, i) => {
    if (!isRaceBot(n)) return;
    if (st.phase === 'count') {
      const g = raceGridSlot(i);
      out.push({ name: n, x: g.x, y: g.y, dir: 1, moving: false });
      return;
    }
    const total = RACE_LAPS * RACE_N;
    if (st.finishes[n] != null) {
      // về đích rồi thì lái vào bãi giữa đậu, xếp hàng theo thứ tự tên
      const order = Object.keys(st.finishes).filter((k) => isRaceBot(k)).sort().indexOf(n);
      out.push({ name: n, x: 1000 + Math.max(0, order) * 50, y: 800, dir: 1, moving: false });
      return;
    }
    const f = Math.min(botFloat[n] ?? 0, total);
    const d = (f / total) * RACE_LOOP_TOTAL;
    const p = raceLoopPoint(d);
    out.push({ name: n, x: p.x, y: p.y, dir: Math.cos(p.ang) >= 0 ? 1 : -1, moving: true });
  });
  return out;
}

/** GameCanvas gọi khi xe cán đúng chốt kỳ vọng → trả tiến trình mới (null nếu chưa cán) */
export function checkRaceCp(x: number, y: number): RaceProg | null {
  const st = useRace.getState();
  if (st.phase !== 'racing' || myDoneAt !== 0) return null;
  const cur = st.progress[me()] ?? { lap: 0, cp: 0 };
  const dx = x - RACE_CPS[cur.cp].x, dy = y - RACE_CPS[cur.cp].y;
  if (dx * dx + dy * dy > RACE_CP_R * RACE_CP_R) return null;
  const next: RaceProg = cur.cp + 1 >= RACE_N
    ? { lap: cur.lap + 1, cp: 0 }
    : { lap: cur.lap, cp: cur.cp + 1 };
  useRace.setState({ progress: { ...st.progress, [me()]: next } });
  sendGameMsg(`${P}RPOS|${me()}|${next.lap}|${next.cp}`);
  return next;
}

/** GameCanvas gọi khi cán chốt cuối vòng cuối → về đích */
export function finishRace(): void {
  const st = useRace.getState();
  if (st.phase !== 'racing' || myDoneAt !== 0) return;
  const ms = Date.now() - st.goAt;
  myDoneAt = ms;
  finalizeAt = Date.now() + FIN_GRACE_MS;
  useRace.setState({ finishes: { ...st.finishes, [me()]: ms } });
  sendGameMsg(`${P}RFIN|${me()}|${Math.round(ms)}`);
  sfx.lvup();
  useGame.getState().toast('🏁 VỀ ĐÍCH! Chờ cả phòng chốt bảng…');
}
