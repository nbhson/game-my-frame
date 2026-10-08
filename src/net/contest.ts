// ===== GIẢI CÂU CÁ CÔNG VIÊN (multiplayer, không cần chủ trì) =====
// Ai cũng mở giải được: broadcast START kèm giờ kết thúc cố định.
// Trong giờ thi, mỗi con cá sông giật dính tự báo điểm (tổng giá trị).
// Hết giờ: mọi client cùng tính 1 bảng → tự trao giải cho chính mình (top 3).
// Tin nhắn đi qua kênh game ẩn `🎣CT|` (không hiện chat), chờ echo rồi mới tính.
import { create } from 'zustand';
import { FISHES, sellPrice } from '../game/data';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { gameMe, markSeen, onGameMsg, sendGameMsg, useVillage } from './village';
import type { ChatMsg } from './transport';

export const CONTEST_MS = 3 * 60 * 1000;
export const CONTEST_PRIZES = [
  { xu: 600, gem: 3, label: '🥇 Vô địch' },
  { xu: 300, gem: 1, label: '🥈 Á quân' },
  { xu: 150, gem: 0, label: '🥉 Hạng ba' },
];
const P = '🎣CT|';

export interface ContestEntry {
  name: string;
  total: number;
  count: number;
  best: number;
  bestFish: string;
}

interface ContestState {
  running: boolean;
  endsAt: number;
  host: string;
  scores: Record<string, ContestEntry>;
  claimedFor: number;
  /** Mở giải mới (3 phút). Đang có giải thì thôi. */
  start: () => void;
  /** Báo 1 con cá vừa giật dính (chỉ tính khi đang thi) */
  reportCatch: (fishId: string) => void;
  /** Bảng xếp hạng đã sắp xếp */
  board: () => ContestEntry[];
  /** Còn lại (ms). Hết giờ tự chốt + trao giải 1 lần. */
  tick: (now: number) => void;
}

function fishName(id: string): string {
  if (id === 'ung') return 'Ủng cũ';
  if (id === 'rong') return 'Rong biển';
  return FISHES[id]?.name ?? id;
}

const seen = new Set<string>();

function applyScore(fromName: string, fishId: string) {
  const value = sellPrice(fishId);
  const st = useContest.getState();
  if (!st.running || Date.now() > st.endsAt) return;
  const prev = st.scores[fromName];
  const entry: ContestEntry = prev
    ? {
      ...prev,
      total: prev.total + value,
      count: prev.count + 1,
      best: Math.max(prev.best, value),
      bestFish: value >= prev.best ? fishName(fishId) : prev.bestFish,
    }
    : { name: fromName, total: value, count: 1, best: value, bestFish: fishName(fishId) };
  useContest.setState({ scores: { ...st.scores, [fromName]: entry } });
}

function handleMsg(m: ChatMsg) {
  if (markSeen(seen, m.id)) return;
  const body = m.text.slice(P.length);
  const [kind, ...rest] = body.split('|');
  const st = useContest.getState();
  if (kind === 'START') {
    const endsAt = Number(rest[0]);
    const host = rest[1] || m.fromName;
    if (!Number.isFinite(endsAt) || endsAt <= Date.now()) return;
    if (st.running && Date.now() <= st.endsAt) return; // đang thi → bỏ qua giải mới
    useContest.setState({ running: true, endsAt, host, scores: {}, claimedFor: 0 });
    sfx.catch_();
    useGame.getState().toast(`🏆 ${host} mở GIẢI CÂU CÁ 3 phút! Ra bến sông giật cá ngay!`);
  } else if (kind === 'SCORE') {
    const fishId = rest[0];
    if (!fishId) return;
    applyScore(m.fromName, fishId);
  }
}

export const useContest = create<ContestState>()((set, get) => ({
  running: false,
  endsAt: 0,
  host: '',
  scores: {},
  claimedFor: 0,

  start: () => {
    const s = get();
    if (!useVillage.getState().connected) {
      useGame.getState().toast('Chưa vào làng (đang kết nối…), thử lại sau 2 giây!');
      return;
    }
    if (s.running && Date.now() <= s.endsAt) {
      useGame.getState().toast('Đang có giải diễn ra, chờ hết giờ nhé!');
      return;
    }
    const me = gameMe();
    // chờ echo về rồi mới bật (1 luồng duy nhất, mọi client đồng bộ)
    sendGameMsg(`${P}START|${Date.now() + CONTEST_MS}|${me.name}`);
  },

  reportCatch: (fishId: string) => {
    const s = get();
    if (!s.running || Date.now() > s.endsAt) return;
    sendGameMsg(`${P}SCORE|${fishId}`);
  },

  board: () => {
    const s = get();
    return Object.values(s.scores).sort((a, b) => b.total - a.total || b.best - a.best || a.name.localeCompare(b.name));
  },

  tick: (now) => {
    const s = get();
    if (!s.running || now <= s.endsAt || s.claimedFor === s.endsAt) return;
    // HẾT GIỜ: chốt giải + tự trao giải cho chính mình nếu lọt top 3
    set({ running: false, claimedFor: s.endsAt });
    const board = get().board();
    if (!board.length) {
      useGame.getState().toast('🏆 Giải câu cá kết thúc mà không ai dính con nào!');
      return;
    }
    const me = gameMe().name;
    const rank = board.findIndex((e) => e.name === me);
    const top = board[0];
    if (rank >= 0 && rank < CONTEST_PRIZES.length) {
      const pz = CONTEST_PRIZES[rank];
      const g = useGame.getState();
      g.addXu(pz.xu);
      if (pz.gem > 0) g.addGem(pz.gem);
      sfx.lvup();
      g.toast(`🏆 Giải câu cá: bạn ${pz.label}! +${pz.xu} xu${pz.gem ? ` +${pz.gem} gem` : ''} (tổng ${board[rank].total} xu cá)`);
    } else {
      sfx.catch_();
      useGame.getState().toast(`🏆 Giải câu cá: ${top.name} vô địch với ${top.total} xu cá!`);
    }
  },
}));

onGameMsg(P, handleMsg);

/** Gọi từ store khi giật dính cá sông (đang thi mới báo điểm) */
export function reportContestCatch(fishId: string) {
  useContest.getState().reportCatch(fishId);
}
