// ===== VÉ SỐ THỊ TRẤN (sổ tự động mỗi 5 phút, không cần chủ trì) =====
// - Mỗi kỳ 5 phút, mã kỳ = floor(Date.now()/LOTTERY_MS). Mọi client cùng lịch
//   nên cùng giờ sổ, cùng số trúng — không cần server trọng tài.
// - Số trúng deterministic theo mã kỳ (hash ổn định) → mọi máy tính ra 1 số.
// - Vé 2 số 00-99, giá TICKET_PRICE xu. Trúng 2 số: jackpot; trúng số cuối: an ủi.
// - Mua vé trừ xu ngay, sổ xong tự cộng thưởng + toast. Trúng ĐB broadcast cho cả làng vui.
import { create } from 'zustand';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { gameMe, markSeen, onGameMsg, sendGameMsg } from './village';
import type { ChatMsg } from './transport';

export const LOTTERY_MS = 5 * 60 * 1000;
export const TICKET_PRICE = 50;
export const JACKPOT_XU = 3000;
export const JACKPOT_GEM = 1;
export const CONSOLATION_XU = 150;
export const MAX_TICKETS_PER_DRAW = 5;
const P = '🎫XS|';

/** mã kỳ hiện tại theo giờ wall-clock (mọi client giống nhau) */
export function lotteryDrawId(now = Date.now()): number {
  return Math.floor(now / LOTTERY_MS);
}
export function lotteryEndsAt(drawId: number): number {
  return (drawId + 1) * LOTTERY_MS;
}
/** số trúng 00-99 deterministic theo mã kỳ (mọi máy ra cùng 1 số) */
export function lotteryWinning(drawId: number): string {
  let h = (drawId * 1103515245 + 12345) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
  return String(h % 100).padStart(2, '0');
}
export const fmtDraw = (drawId: number) => `#${String(drawId).slice(-6)}`;

export interface LotteryTicket { num: string; at: number }
export interface LotteryResult {
  drawId: number;
  winning: string;
  tickets: string[];
  jackpot: number;
  consolation: number;
  prize: number;
}

interface LotteryState {
  /** kỳ đang bán vé */
  drawId: number;
  tickets: LotteryTicket[];
  history: LotteryResult[];
  /** Mua 1 vé số tự chọn (00-99). Kỳ hiện tại tối đa MAX_TICKETS_PER_DRAW vé. */
  buyTicket: (num: string) => void;
  /** Mua vé ngẫu nhiên */
  buyRandom: () => void;
  /** Gọi mỗi giây: qua kỳ mới thì sổ kỳ cũ + trao thưởng */
  tick: (now: number) => void;
  countdown: () => number;
  winningNow: () => string;
}

const seen = new Set<string>();
const LS_TICKETS = 'nongtrai-lottery-tickets';
const LS_HISTORY = 'nongtrai-lottery-history';

function loadTickets(): { drawId: number; tickets: LotteryTicket[] } {
  try {
    const raw = localStorage.getItem(LS_TICKETS);
    if (!raw) return { drawId: lotteryDrawId(), tickets: [] };
    const o = JSON.parse(raw) as { drawId: number; tickets: LotteryTicket[] };
    if (o.drawId !== lotteryDrawId()) return { drawId: lotteryDrawId(), tickets: [] };
    return { drawId: o.drawId, tickets: Array.isArray(o.tickets) ? o.tickets : [] };
  } catch { return { drawId: lotteryDrawId(), tickets: [] }; }
}
function loadHistory(): LotteryResult[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return [];
    const a = JSON.parse(raw) as LotteryResult[];
    return Array.isArray(a) ? a.slice(0, 5) : [];
  } catch { return []; }
}

function handleMsg(m: ChatMsg) {
  if (markSeen(seen, m.id)) return;
  const body = m.text.slice(P.length);
  const [kind, ...rest] = body.split('|');
  if (kind === 'WIN') {
    const [draw, prize] = rest;
    if (m.fromName === gameMe().name) return; // mình đã có toast riêng
    useGame.getState().toast(`🎫 Kỳ ${draw}: ${m.fromName} TRÚNG ĐB +${Number(prize || 0).toLocaleString('vi-VN')} xu!`);
    sfx.lvup();
  }
}

function settle(drawId: number, tickets: LotteryTicket[]) {
  if (!tickets.length) return;
  const winning = lotteryWinning(drawId);
  let jackpot = 0, consolation = 0;
  for (const t of tickets) {
    if (t.num === winning) jackpot++;
    else if (t.num[1] === winning[1]) consolation++;
  }
  const prize = jackpot * JACKPOT_XU + consolation * CONSOLATION_XU;
  const g = useGame.getState();
  if (prize > 0) {
    g.addXu(prize);
    if (jackpot > 0) {
      g.addGem(jackpot * JACKPOT_GEM);
      sfx.lvup();
      g.toast(`🎫 TRÚNG ĐẶC BIỆT ${winning}! ${jackpot} vé × ${JACKPOT_XU} xu +${jackpot * JACKPOT_GEM} gem!`);
      try { sendGameMsg(`${P}WIN|${fmtDraw(drawId)}|${JACKPOT_XU * jackpot}`); } catch { /* ignore */ }
    } else {
      sfx.coin();
      g.toast(`🎫 Trúng an ủi ${winning}! ${consolation} vé × ${CONSOLATION_XU} xu = +${prize} xu`);
    }
    g.addXP(10 * (jackpot + consolation));
  } else {
    sfx.error();
    g.toast(`🎫 Kỳ ${fmtDraw(drawId)} sổ ${winning} — trượt rồi, kỳ sau gỡ!`);
  }
  const res: LotteryResult = {
    drawId, winning, tickets: tickets.map((t) => t.num),
    jackpot, consolation, prize,
  };
  useLottery.setState((s) => {
    const history = [res, ...s.history].slice(0, 5);
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)); } catch { /* ignore */ }
    return { history };
  });
}

const init = loadTickets();

export const useLottery = create<LotteryState>()((set, get) => ({
  drawId: init.drawId,
  tickets: init.tickets,
  history: loadHistory(),

  buyTicket: (num) => {
    const g = useGame.getState();
    const st = get();
    // qua kỳ mới mà chưa tick → sổ trước rồi mới bán kỳ mới
    const cur = lotteryDrawId();
    if (cur !== st.drawId) get().tick(Date.now());
    const s = get();
    const clean = String(num).replace(/\D/g, '').slice(-2).padStart(2, '0');
    if (!/^\d{2}$/.test(clean)) { g.toast('Chọn số 00–99 nhé!'); return; }
    if (s.tickets.length >= MAX_TICKETS_PER_DRAW) {
      sfx.error(); g.toast(`Mỗi kỳ mua tối đa ${MAX_TICKETS_PER_DRAW} vé thôi!`);
      return;
    }
    if (g.xu < TICKET_PRICE) { sfx.error(); g.toast(`Cần ${TICKET_PRICE} xu để mua 1 vé!`); return; }
    g.addXu(-TICKET_PRICE);
    const tickets = [...s.tickets, { num: clean, at: Date.now() }];
    set({ tickets });
    try { localStorage.setItem(LS_TICKETS, JSON.stringify({ drawId: s.drawId, tickets })); } catch { /* ignore */ }
    sfx.coin();
    g.toast(`Đã mua vé ${clean} kỳ ${fmtDraw(s.drawId)} (${tickets.length}/${MAX_TICKETS_PER_DRAW})!`);
    g.addXP(2);
  },

  buyRandom: () => {
    const n = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    get().buyTicket(n);
  },

  tick: (now) => {
    const s = get();
    const cur = lotteryDrawId(now);
    if (cur === s.drawId) return;
    // sổ kỳ cũ rồi sang kỳ mới
    try { settle(s.drawId, s.tickets); } catch { /* ignore */ }
    set({ drawId: cur, tickets: [] });
    try { localStorage.setItem(LS_TICKETS, JSON.stringify({ drawId: cur, tickets: [] })); } catch { /* ignore */ }
  },

  countdown: () => Math.max(0, lotteryEndsAt(get().drawId) - Date.now()),
  winningNow: () => lotteryWinning(get().drawId),
}));

onGameMsg(P, handleMsg);
