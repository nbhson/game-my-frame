// ===== Bài Cào (3 lá) — ai nhiều nút hơn thắng =====
// A=1, 2-10 giữ nguyên, J/Q/K=10. Tổng % 10. Ba con Tây (J/Q/K) = "3 cào" cao nhất.
import type { Card } from './cards';
import { cmpCard } from './cards';

export interface BaiCaoResult {
  score: number; // 0..9, 3 cào = 10
  isThreeFace: boolean;
  top: Card; // lá lớn nhất để so hòa
}

export function cardPoint(r: number): number {
  if (r === 14) return 1; // A
  if (r >= 11 && r <= 13) return 10; // J Q K
  if (r === 15) return 2; // lá 2 tính 2 nút
  return r;
}

export function scoreHand(hand: Card[]): BaiCaoResult {
  const faces = hand.filter((c) => c.r >= 11 && c.r <= 13).length;
  const isThreeFace = hand.length === 3 && faces === 3;
  const top = hand.slice().sort(cmpCard)[hand.length - 1];
  if (isThreeFace) return { score: 10, isThreeFace: true, top };
  const sum = hand.reduce((a, c) => a + cardPoint(c.r), 0);
  return { score: sum % 10, isThreeFace: false, top };
}

/** so 2 tay: 1 thắng, -1 thua, 0 hòa */
export function compareHands(a: Card[], b: Card[]): number {
  const ra = scoreHand(a); const rb = scoreHand(b);
  if (ra.score !== rb.score) return ra.score > rb.score ? 1 : -1;
  if (ra.top.r !== rb.top.r) return ra.top.r > rb.top.r ? 1 : -1;
  if (ra.top.s !== rb.top.s) return ra.top.s > rb.top.s ? 1 : -1;
  return 0;
}

export interface BaiCaoState {
  order: string[];
  hands: Record<string, Card[]>;
  revealed: string[]; // ai đã lật bài
  winners: string[] | null;
}

export function newBaiCaoGame(playerIds: string[], deck: Card[]): BaiCaoState {
  const hands: Record<string, Card[]> = {};
  playerIds.forEach((id) => (hands[id] = []));
  for (let k = 0; k < 3; k++) {
    for (const id of playerIds) {
      const c = deck.pop();
      if (c) hands[id].push(c);
    }
  }
  return { order: playerIds.slice(), hands, revealed: [], winners: null };
}

/** tìm người thắng (có thể nhiều người hòa) */
export function findBaiCaoWinners(st: BaiCaoState): string[] {
  let best: string[] = [];
  for (const id of st.order) {
    if (!best.length) { best = [id]; continue; }
    const cmp = compareHands(st.hands[best[0]], st.hands[id]);
    if (cmp < 0) best = [id];
    else if (cmp === 0) best.push(id);
  }
  return best;
}
