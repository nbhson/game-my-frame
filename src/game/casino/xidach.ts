// ===== Xì dách VN: mọi nhà con đấu với NHÀ CÁI (máy) =====
// Luật: A = 1/11, J/Q/K/10 = 10. Mỗi người 2 lá, lần lượt Rút/Dằn.
// - Xì bàng (đôi A) > Xì dách (A + 10/J/Q/K) > Ngũ linh (5 lá ≤ 21) > 21 > ... > 16
// - Quắc (> 21) và Dằn non (< 16) thua luôn, kể cả nhà cái quắc.
// - Hòa điểm nhà cái → nhà con thắng (chia pot).
// - Không ai thắng nhà cái → nhà cái ăn hết (KHÔNG hoàn cược).
import type { Card } from './cards';

export type XiDachPhase = 'play' | 'done';

export interface XiDachState {
  order: string[];
  hands: Record<string, Card[]>;
  deck: Card[];
  stood: string[]; // ai đã dằn xong (kể cả quắc/ngũ linh tự dừng)
  turn: string; // tới lượt ai rút/dằn
  dealer: Card[]; // bài nhà cái — ẩn tới khi xong
  phase: XiDachPhase;
  winners: string[] | null;
  /** mốc hết giờ của lượt hiện tại (ms epoch) — hết giờ tự xử */
  deadline: number | null;
}

export function newXiDachGame(playerIds: string[], deck: Card[]): XiDachState {
  const hands: Record<string, Card[]> = {};
  playerIds.forEach((id) => (hands[id] = []));
  for (let k = 0; k < 2; k++) {
    for (const id of playerIds) {
      const c = deck.pop();
      if (c) hands[id].push(c);
    }
  }
  const dealer: Card[] = [];
  for (let k = 0; k < 2; k++) {
    const c = deck.pop();
    if (c) dealer.push(c);
  }
  return {
    order: playerIds.slice(), hands, deck,
    stood: [], turn: playerIds[0] ?? '', dealer,
    phase: 'play', winners: null, deadline: null,
  };
}

/** giá trị tay bài: A linh hoạt 11/1 */
export function xiDachValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.r === 14) { aces++; total += 11; }
    else if (c.r >= 10 && c.r <= 13) total += 10;
    else if (c.r === 15) total += 2;
    else total += c.r;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export type XiDachRank =
  | { kind: 'xibang' } | { kind: 'xidach' } | { kind: 'ngulinh'; value: number }
  | { kind: 'points'; value: number } | { kind: 'non' } | { kind: 'quac' };

export function xiDachRank(hand: Card[]): XiDachRank {
  const v = xiDachValue(hand);
  if (v > 21) return { kind: 'quac' };
  if (hand.length === 2 && hand.every((c) => c.r === 14)) return { kind: 'xibang' };
  if (hand.length === 2 && hand.some((c) => c.r === 14) && hand.some((c) => c.r >= 10 && c.r <= 13)) return { kind: 'xidach' };
  if (hand.length >= 5) return { kind: 'ngulinh', value: v };
  if (v < 16) return { kind: 'non' };
  return { kind: 'points', value: v };
}

/** sức mạnh để so: xì bàng 600 > xì dách 500 > ngũ linh 400+v > điểm > non/quắc thua */
export function xiDachStrength(hand: Card[]): number {
  const r = xiDachRank(hand);
  switch (r.kind) {
    case 'xibang': return 600;
    case 'xidach': return 500;
    case 'ngulinh': return 400 + r.value;
    case 'points': return r.value;
    default: return -1; // non / quắc
  }
}

export function xiDachLabel(hand: Card[]): string {
  const r = xiDachRank(hand);
  switch (r.kind) {
    case 'xibang': return 'XÌ BÀNG!';
    case 'xidach': return 'XÌ DÁCH!';
    case 'ngulinh': return `Ngũ linh ${r.value}!`;
    case 'points': return `${r.value} điểm`;
    case 'non': return `Dằn non ${xiDachValue(hand)}`;
    case 'quac': return `Quắc ${xiDachValue(hand)}`;
  }
}

function nextTurn(st: XiDachState, from: string): string {
  const n = st.order.length;
  const i = st.order.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = st.order[(i + k) % n];
    if (!st.stood.includes(id)) return id;
  }
  return from;
}

/** nhà cái rút tới 16 rồi so từng nhà con */
function dealerFinish(st: XiDachState): XiDachState {
  const deck = st.deck.slice();
  const dealer = st.dealer.slice();
  while (xiDachValue(dealer) < 16 && dealer.length < 5) {
    const c = deck.pop();
    if (!c) break;
    dealer.push(c);
  }
  const ds = xiDachStrength(dealer);
  const winners = st.order.filter((id) => {
    const ps = xiDachStrength(st.hands[id] ?? []);
    if (ps < 0) return false; // quắc / non thua luôn
    return ps >= ds; // hòa nhà cái vẫn thắng
  });
  return { ...st, deck, dealer, phase: 'done', winners, turn: '', deadline: null };
}

/** Rút 1 lá. Quắc hoặc đủ 5 lá → tự dằn. Hết người → nhà cái xử. */
export function applyXiDachHit(st: XiDachState, playerId: string): XiDachState | null {
  if (st.phase !== 'play' || st.turn !== playerId) return null;
  if (st.stood.includes(playerId)) return null;
  const hand = st.hands[playerId];
  if (!hand || hand.length >= 5) return null;
  const deck = st.deck.slice();
  const c = deck.pop();
  if (!c) {
    // hết bài → coi như dằn
    return applyXiDachStand({ ...st, deck }, playerId);
  }
  const hands = { ...st.hands, [playerId]: [...hand, c] };
  const nh = hands[playerId];
  const stood = st.stood.slice();
  if (xiDachValue(nh) > 21 || nh.length >= 5) stood.push(playerId);
  const done = stood.length >= st.order.length;
  const next: XiDachState = { ...st, hands, deck, stood, turn: nextTurn({ ...st, stood }, playerId) };
  return done ? dealerFinish(next) : next;
}

/** Dằn (kể cả dằn non < 16 — sẽ thua khi so). */
export function applyXiDachStand(st: XiDachState, playerId: string): XiDachState | null {
  if (st.phase !== 'play' || st.turn !== playerId) return null;
  if (st.stood.includes(playerId)) return null;
  const stood = [...st.stood, playerId];
  const done = stood.length >= st.order.length;
  const next: XiDachState = { ...st, stood, turn: nextTurn({ ...st, stood }, playerId) };
  return done ? dealerFinish(next) : next;
}

// ---------- bot: đủ 16 tuổi mới dằn, 4 lá ham ngũ linh ----------
export function botXiDachMove(st: XiDachState, playerId: string): 'hit' | 'stand' | null {
  const hand = st.hands[playerId];
  if (!hand || st.phase !== 'play' || hand.length >= 5) return null;
  const r = xiDachRank(hand);
  if (r.kind === 'xibang' || r.kind === 'xidach') return 'stand';
  const v = xiDachValue(hand);
  if (v < 16) return 'hit'; // chưa đủ tuổi
  if (hand.length === 4 && v <= 17) return 'hit'; // ham ngũ linh
  return 'stand';
}

export function botXiDachAuto(st: XiDachState, playerId: string): XiDachState | null {
  const mv = botXiDachMove(st, playerId);
  if (mv === 'hit') return applyXiDachHit(st, playerId);
  if (mv === 'stand') return applyXiDachStand(st, playerId);
  return null;
}

/** rời phòng giữa ván: coi như dằn non + loại khỏi cuộc (không được chia pot) */
export function removeXiDachPlayer(st: XiDachState, playerId: string): XiDachState {
  if (st.phase !== 'play') return st;
  const stood = st.stood.includes(playerId) ? st.stood.slice() : [...st.stood, playerId];
  const order = st.order.filter((id) => id !== playerId);
  if (!order.length) {
    // không còn ai — nhà cái ăn, kết thúc
    return { ...st, stood, order, turn: '', phase: 'done', winners: [], deadline: null };
  }
  let turn = st.turn;
  if (turn === playerId || stood.includes(turn)) {
    turn = '';
    for (const id of order) {
      if (!stood.includes(id)) { turn = id; break; }
    }
  }
  const next = { ...st, stood, order, turn };
  if (order.every((id) => stood.includes(id))) return dealerFinish(next);
  return next;
}
