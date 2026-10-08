// ===== Tiến Lên Miền Nam (rút gọn nhưng đủ chơi 2-4 người) =====
// Combo: single | pair | triple | straight(3+, không chứa 2) | four (tứ quý)
// Luật chặt: cùng loại + cùng độ dài thì lớn hơn thắng; tứ quý chặt được 1 con 2 / đôi 2.
import type { Card } from './cards';
import { cmpCard, isThreeSpade } from './cards';

export type TienLenCombo = 'single' | 'pair' | 'triple' | 'straight' | 'four';

export interface ComboInfo {
  type: TienLenCombo;
  len: number;
  topRank: number;
  topSuit: number; // chất lớn nhất trong lá top (để so đôi/sám bằng rank)
}

export function comboOf(cards: Card[]): ComboInfo | null {
  if (!cards.length) return null;
  const a = cards.slice().sort(cmpCard);
  const n = a.length;
  if (n === 1) return { type: 'single', len: 1, topRank: a[0].r, topSuit: a[0].s };
  if (n === 2 && a[0].r === a[1].r) {
    return { type: 'pair', len: 2, topRank: a[0].r, topSuit: Math.max(a[0].s, a[1].s) };
  }
  if (n === 3 && a[0].r === a[1].r && a[1].r === a[2].r) {
    return { type: 'triple', len: 3, topRank: a[0].r, topSuit: Math.max(a[0].s, a[1].s, a[2].s) };
  }
  if (n === 4 && a[0].r === a[1].r && a[1].r === a[2].r && a[2].r === a[3].r) {
    return { type: 'four', len: 4, topRank: a[0].r, topSuit: 3 };
  }
  // sảnh: 3+ lá liên tiếp, không chứa 2 (r=15)
  if (n >= 3) {
    for (let i = 1; i < n; i++) {
      if (a[i].r !== a[i - 1].r + 1) return null;
    }
    if (a[n - 1].r >= 15) return null; // sảnh không chứa 2
    // sảnh không trùng rank (mỗi rank 1 lá — cho phép trùng chất khác nhau)
    // ở đây a đã sort, nếu có 2 lá cùng rank thì hiệu =0 → đã return null ở trên
    const top = a[n - 1];
    return { type: 'straight', len: n, topRank: top.r, topSuit: top.s };
  }
  return null;
}

/** tứ quý có chặt được combo trước không? */
function fourBeats(info: ComboInfo, prev: ComboInfo): boolean {
  if (info.type !== 'four') return false;
  // tứ quý chặt: 1 con 2, đôi 2 (và tứ quý nhỏ hơn)
  if (prev.type === 'single' && prev.topRank === 15) return true;
  if (prev.type === 'pair' && prev.topRank === 15) return true;
  if (prev.type === 'four') return info.topRank > prev.topRank;
  return false;
}

/** combo sau có đè được combo trước không (cùng vòng)? */
export function beats(prev: ComboInfo, next: ComboInfo): boolean {
  if (next.type === 'four' && fourBeats(next, prev)) return true;
  if (prev.type !== next.type) return false;
  if (prev.len !== next.len) return false;
  if (next.topRank !== prev.topRank) return next.topRank > prev.topRank;
  return next.topSuit > prev.topSuit;
}

export interface TienLenState {
  order: string[]; // playerId theo vòng
  hands: Record<string, Card[]>;
  turn: string; // playerId tới lượt
  leader: string; // người ra bài đầu vòng (được ra tự do)
  lastPlay: Card[] | null;
  lastPlayer: string | null;
  passed: string[]; // đã bỏ qua trong vòng này
  firstTurn: boolean; // ván mới: phải có 3♠
  winner: string | null;
  rank: string[]; // thứ tự về (winner đầu)
  /** mốc hết giờ của lượt hiện tại (ms epoch, do trọng tài set) — hết giờ tự bỏ qua/đánh */
  deadline: number | null;
}

export function dealTienLen(playerIds: string[], deck: Card[]): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  playerIds.forEach((id) => (hands[id] = []));
  // chia 13 lá mỗi người (2-4 người đều 13 lá, bài dư bỏ)
  for (let k = 0; k < 13; k++) {
    for (const id of playerIds) {
      const c = deck.pop();
      if (c) hands[id].push(c);
    }
  }
  for (const id of playerIds) hands[id] = hands[id].sort((a, b) => a.r - b.r || a.s - b.s);
  return hands;
}

export function firstPlayer(hands: Record<string, Card[]>): string {
  for (const [id, h] of Object.entries(hands)) {
    if (h.some(isThreeSpade)) return id;
  }
  return Object.keys(hands)[0];
}

export function newTienLenGame(playerIds: string[], deck: Card[]): TienLenState {
  const hands = dealTienLen(playerIds, deck.slice());
  const first = firstPlayer(hands);
  // 2-3 người chia 13 lá → 3♠ có thể nằm ở chồng dư, không ai có → đi tự do, khỏi kẹt
  const hasThree = Object.values(hands).some((h) => h.some(isThreeSpade));
  return {
    order: playerIds.slice(),
    hands,
    turn: first,
    leader: first,
    lastPlay: null,
    lastPlayer: null,
    passed: [],
    firstTurn: hasThree,
    winner: null,
    rank: [],
    deadline: null,
  };
}

/** kiểm tra nước đi, trả về lỗi hoặc null nếu hợp lệ */
export function validatePlay(st: TienLenState, playerId: string, cards: Card[]): string | null {
  if (st.winner) return 'Ván đã kết thúc';
  if (st.turn !== playerId) return 'Chưa tới lượt bạn';
  const hand = st.hands[playerId] ?? [];
  // đủ bài?
  for (const c of cards) {
    if (!hand.some((h) => h.id === c.id)) return 'Bài không có trong tay';
  }
  const info = comboOf(cards);
  if (!info) return 'Bộ không hợp lệ (lẻ/đôi/sám/sảnh/tứ quý)';
  // ván mới phải có 3♠ — nhưng nếu không ai có (chia 2-3 người, 3♠ ở chồng dư) thì cho đi tự do
  if (st.firstTurn) {
    const anyoneHas = Object.values(st.hands).some((h) => (h ?? []).some(isThreeSpade));
    if (!anyoneHas) return null;
    if (!cards.some(isThreeSpade)) return 'Ván đầu phải ra 3♠';
  }
  // đầu vòng: ra tự do
  if (!st.lastPlay || st.lastPlayer === playerId || everyOneElsePassed(st, playerId)) {
    return null;
  }
  const prev = comboOf(st.lastPlay);
  if (!prev) return 'Lỗi bài trước';
  if (!beats(prev, info)) return 'Bài nhỏ hơn, không chặt được';
  return null;
}

function everyOneElsePassed(st: TienLenState, me: string): boolean {
  const others = st.order.filter((id) => id !== me && (st.hands[id]?.length ?? 0) > 0);
  return others.length > 0 && others.every((id) => st.passed.includes(id));
}

export function nextTurn(st: TienLenState, from: string): string {
  // người kế tiếp còn bài
  const n = st.order.length;
  let i = st.order.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = st.order[(i + k) % n];
    if ((st.hands[id]?.length ?? 0) > 0) return id;
  }
  return from;
}

/** áp dụng nước đi (đã validate), trả state mới */
export function applyPlay(st: TienLenState, playerId: string, cards: Card[]): TienLenState {
  const hands = { ...st.hands };
  hands[playerId] = hands[playerId].filter((h) => !cards.some((c) => c.id === h.id));
  const rank = hands[playerId].length === 0 ? [...st.rank, playerId] : st.rank.slice();
  const winner = hands[playerId].length === 0 ? playerId : st.winner;
  // nếu thắng → ván kết thúc ngay (nhất ăn tất)
  if (winner) {
    return { ...st, hands, rank, winner, lastPlay: cards, lastPlayer: playerId, firstTurn: false };
  }
  // hết vòng? nếu mọi người khác đã pass → vòng mới
  const passed = st.passed.filter((id) => id !== playerId);
  return {
    ...st,
    hands,
    rank,
    lastPlay: cards,
    lastPlayer: playerId,
    leader: playerId,
    passed,
    firstTurn: false,
    turn: nextTurn({ ...st, hands }, playerId),
  };
}

/** bỏ qua lượt */
export function applyPass(st: TienLenState, playerId: string): TienLenState {
  if (!st.lastPlay) return st; // đầu vòng không được pass (phải ra bài)
  const passed = st.passed.includes(playerId) ? st.passed : [...st.passed, playerId];
  // nếu chỉ còn 1 người chưa pass → người đó mở vòng mới
  const alive = st.order.filter((id) => (st.hands[id]?.length ?? 0) > 0);
  const stillIn = alive.filter((id) => !passed.includes(id));
  if (stillIn.length === 1) {
    const leader = stillIn[0];
    return { ...st, passed: [], lastPlay: null, lastPlayer: null, leader, turn: leader };
  }
  return { ...st, passed, turn: nextTurn(st, playerId) };
}

// ---------- gợi ý + bot ----------
/** mọi combo đơn giản trong tay (lẻ + đôi + sám) để bot chọn */
export function allSimpleCombos(hand: Card[]): Card[][] {
  const out: Card[][] = [];
  const byRank = new Map<number, Card[]>();
  for (const c of hand) {
    if (!byRank.has(c.r)) byRank.set(c.r, []);
    byRank.get(c.r)!.push(c);
  }
  for (const [, g] of byRank) {
    const s = g.slice().sort((a, b) => a.s - b.s);
    out.push([s[0]]);
    if (s.length >= 2) out.push(s.slice(0, 2));
    if (s.length >= 3) out.push(s.slice(0, 3));
    if (s.length >= 4) out.push(s.slice(0, 4));
  }
  // vài sảnh ngắn (tìm sảnh từ rank liên tiếp)
  const uniq = [...byRank.keys()].filter((r) => r < 15).sort((a, b) => a - b);
  for (let i = 0; i < uniq.length; i++) {
    let j = i;
    while (j + 1 < uniq.length && uniq[j + 1] === uniq[j] + 1) j++;
    const run = uniq.slice(i, j + 1);
    if (run.length >= 3) {
      for (let L = 3; L <= Math.min(6, run.length); L++) {
        for (let k = 0; k + L <= run.length; k++) {
          const combo = run.slice(k, k + L).map((r) => byRank.get(r)![0]);
          out.push(combo);
        }
      }
    }
  }
  return out;
}

/** bot chọn nước đi: nhỏ nhất mà hợp lệ, không được thì pass (null) */
export function botPick(st: TienLenState, playerId: string): Card[] | null {
  const hand = st.hands[playerId] ?? [];
  if (!hand.length) return null;
  const isLead = !st.lastPlay || st.lastPlayer === playerId || everyOneElsePassed(st, playerId);
  let cands = allSimpleCombos(hand);
  // ván đầu bắt buộc có 3♠ — chỉ ép khi thật sự có nước chứa 3♠ (không thì ra nhỏ nhất, khỏi kẹt)
  if (st.firstTurn) {
    const need = cands.filter((c) => c.some(isThreeSpade));
    if (need.length) cands = need;
  }
  if (isLead) {
    // ra lá/bộ nhỏ nhất
    cands.sort((a, b) => {
      const ia = comboOf(a)!; const ib = comboOf(b)!;
      return ia.topRank - ib.topRank || ia.len - ib.len || ia.topSuit - ib.topSuit;
    });
    return cands[0] ?? null;
  }
  const prev = st.lastPlay ? comboOf(st.lastPlay) : null;
  if (!prev) return cands[0] ?? null;
  const ok = cands.filter((c) => {
    const info = comboOf(c);
    return info && beats(prev, info);
  });
  ok.sort((a, b) => {
    const ia = comboOf(a)!; const ib = comboOf(b)!;
    return ia.topRank - ib.topRank || ia.topSuit - ib.topSuit;
  });
  return ok[0] ?? null;
}
