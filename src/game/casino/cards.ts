// ===== Casino: bộ bài 52 lá dùng chung (tiến lên + bài cào) =====
// rank: 3..2 (3 nhỏ nhất, 2 lớn nhất). suit: 0=Bích♠ 1=Chuồn♣ 2=Rô♦ 3=Cơ♥
export interface Card { r: number; s: number; id: string }

export const SUITS = ['♠', '♣', '♦', '♥'] as const;
export const SUIT_NAME = ['Bích', 'Chuồn', 'Rô', 'Cơ'] as const;
export function rankLabel(r: number): string {
  if (r <= 10) return String(r);
  return r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : r === 14 ? 'A' : '2';
}
export function cardLabel(c: Card): string {
  return `${rankLabel(c.r)}${SUITS[c.s]}`;
}
export function cardName(c: Card): string {
  return `${rankLabel(c.r)} ${SUIT_NAME[c.s]}`;
}
export function isRed(c: Card): boolean {
  return c.s >= 2;
}

export function fullDeck(): Card[] {
  const d: Card[] = [];
  for (let r = 3; r <= 15; r++) {
    const rank = r === 15 ? 2 : r; // r=15 lưu là 2? — giữ r=15 cho dễ so (2 lớn nhất)
    void rank;
    for (let s = 0; s < 4; s++) d.push({ r, s, id: `${r}-${s}` });
  }
  return d;
}

/** rank thực để so: 3..14, 2 => 15 */
export function rankVal(r: number): number {
  return r;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** so 2 lá: rank trước, suit sau */
export function cmpCard(a: Card, b: Card): number {
  if (a.r !== b.r) return a.r - b.r;
  return a.s - b.s;
}

export function sortHand(hand: Card[]): Card[] {
  return hand.slice().sort(cmpCard);
}

/** lá 3 Bích */
export function isThreeSpade(c: Card): boolean {
  return c.r === 3 && c.s === 0;
}
