// ===== Cân bằng game (balance) tách riêng để dễ tuning / mở rộng =====
// Triết lý kinh tế (max level 100):
// - Lợi nhuận/phút tăng dần theo cấp để luôn có mục tiêu mới, nhưng chi phí
//   unlock (ruộng/ao/chuồng) tăng nhanh hơn, buộc người chơi tái đầu tư.
// - XP/cấp = cấp*100 (tổng ~505k XP lên Lv100). Cây cuối cho 550 XP/quả,
//   45 ô sâm = ~25k XP/vụ → endgame vẫn tiến đều.
// - Thức ăn là chi phí vận hành: cám thường rẻ, cám cao cấp đắt nhưng tăng tốc.
export interface CropDef {
  id: string; name: string; emoji: string;
  seedPrice: number; sell: number; grow: number; xp: number; lv: number; desc: string;
}
export interface FishDef {
  id: string; name: string; emoji: string;
  babyPrice: number; sell: number; grow: number; xp: number; lv: number; desc: string;
}
export interface AnimalDef {
  id: string; name: string; emoji: string;
  babyPrice: number; product: string; productId: string;
  sell: number; grow: number; cycle: number; xp: number; lv: number; desc: string; max: number;
}

export const CROPS: Record<string, CropDef> = {
  lua:     { id: 'lua',     name: 'Lúa',         emoji: '', seedPrice: 10,   sell: 28,    grow: 35,  xp: 6,   lv: 1,  desc: 'Lớn nhanh, dễ trồng' },
  carot:   { id: 'carot',   name: 'Cà rốt',      emoji: '', seedPrice: 25,   sell: 65,    grow: 70,  xp: 12,  lv: 2,  desc: 'Củ ngọt giòn' },
  caixanh: { id: 'caixanh', name: 'Cải xanh',    emoji: '', seedPrice: 40,   sell: 110,   grow: 95,  xp: 16,  lv: 4,  desc: 'Rau sạch mỗi ngày' },
  cachua:  { id: 'cachua',  name: 'Cà chua',     emoji: '', seedPrice: 60,   sell: 160,   grow: 120, xp: 22,  lv: 6,  desc: 'Mọng nước' },
  khoai:   { id: 'khoai',   name: 'Khoai tây',   emoji: '', seedPrice: 100,  sell: 260,   grow: 150, xp: 30,  lv: 9,  desc: 'Bùi béo' },
  bap:     { id: 'bap',     name: 'Bắp',         emoji: '', seedPrice: 150,  sell: 400,   grow: 190, xp: 42,  lv: 12, desc: 'Vàng óng' },
  dualeo:  { id: 'dualeo',  name: 'Dưa leo',      emoji: '', seedPrice: 220,  sell: 580,   grow: 230, xp: 55,  lv: 16, desc: 'Giòn mát' },
  catim:   { id: 'catim',   name: 'Cà tím',      emoji: '', seedPrice: 320,  sell: 850,   grow: 280, xp: 70,  lv: 20, desc: 'Bóng mượt' },
  dautay:  { id: 'dautay',  name: 'Dâu tây',     emoji: '', seedPrice: 450,  sell: 1250,  grow: 330, xp: 90,  lv: 25, desc: 'Chua ngọt' },
  duahau:  { id: 'duahau',  name: 'Dưa hấu',     emoji: '', seedPrice: 650,  sell: 1800,  grow: 400, xp: 120, lv: 32, desc: 'Ngọt lịm ngày hè' },
  nho:     { id: 'nho',     name: 'Nho',         emoji: '', seedPrice: 950,  sell: 2600,  grow: 480, xp: 160, lv: 40, desc: 'Chùm trĩu quả' },
  bingo:   { id: 'bingo',   name: 'Bí ngô',      emoji: '', seedPrice: 1400, sell: 3900,  grow: 560, xp: 210, lv: 50, desc: 'Quả to khổng lồ' },
  caphe:   { id: 'caphe',   name: 'Cà phê',      emoji: '', seedPrice: 2200, sell: 6200,  grow: 660, xp: 280, lv: 65, desc: 'Thơm nức mũi' },
  nam:     { id: 'nam',     name: 'Nấm linh chi', emoji: '', seedPrice: 3500, sell: 10000, grow: 780, xp: 380, lv: 80, desc: 'Dược liệu quý' },
  sam:     { id: 'sam',     name: 'Nhân sâm',    emoji: '', seedPrice: 6000, sell: 18000, grow: 900, xp: 550, lv: 95, desc: 'Ngàn năm tuổi' },
};

export const FISHES: Record<string, FishDef> = {
  caro:     { id: 'caro',     name: 'Cá rô',      emoji: '', babyPrice: 30,   sell: 80,   grow: 90,  xp: 10,  lv: 1,  desc: 'Dễ nuôi' },
  cachep:   { id: 'cachep',   name: 'Cá chép',    emoji: '', babyPrice: 60,   sell: 170,  grow: 150, xp: 18,  lv: 3,  desc: 'Vảy vàng' },
  tom:      { id: 'tom',      name: 'Tôm',        emoji: '', babyPrice: 120,  sell: 340,  grow: 200, xp: 30,  lv: 6,  desc: 'Nhảy tanh tách' },
  cua:      { id: 'cua',      name: 'Cua',        emoji: '', babyPrice: 220,  sell: 620,  grow: 260, xp: 45,  lv: 10, desc: 'Càng to chắc thịt' },
  caloc:    { id: 'caloc',    name: 'Cá lóc',     emoji: '', babyPrice: 380,  sell: 1100, grow: 330, xp: 70,  lv: 15, desc: 'Khỏe mạnh' },
  cakoi:    { id: 'cakoi',    name: 'Cá Koi',     emoji: '', babyPrice: 700,  sell: 2100, grow: 420, xp: 110, lv: 25, desc: 'Quý hiếm' },
  bachtuoc: { id: 'bachtuoc', name: 'Bạch tuộc',  emoji: '', babyPrice: 1200, sell: 3600, grow: 520, xp: 160, lv: 35, desc: 'Tám tay thông thái' },
  camap:    { id: 'camap',    name: 'Cá mập',     emoji: '', babyPrice: 2200, sell: 6800, grow: 660, xp: 240, lv: 50, desc: 'Chúa tể đại dương' },
};

export const ANIMALS: Record<string, AnimalDef> = {
  chicken: { id: 'chicken', name: 'Gà',   emoji: '', babyPrice: 80,  product: 'Trứng',     productId: 'trung',    sell: 45,  grow: 90,  cycle: 45,  xp: 12, lv: 2,  desc: 'Đẻ trứng đều', max: 30 },
  duck:    { id: 'duck',    name: 'Vịt',  emoji: '', babyPrice: 150, product: 'Trứng vịt',  productId: 'trungvit', sell: 70,  grow: 110, cycle: 55,  xp: 18, lv: 6,  desc: 'Bơi lội giỏi', max: 15 },
  cow:     { id: 'cow',     name: 'Bò sữa', emoji: '', babyPrice: 250, product: 'Sữa',      productId: 'sua',      sell: 120, grow: 180, cycle: 75,  xp: 28, lv: 4,  desc: 'Cho sữa ngọt', max: 20 },
  pig:     { id: 'pig',     name: 'Heo',  emoji: '', babyPrice: 280, product: 'Thịt',      productId: 'thit',     sell: 420, grow: 240, cycle: 150, xp: 50, lv: 5,  desc: 'Lớn nhanh', max: 20 },
  sheep:   { id: 'sheep',   name: 'Cừu',  emoji: '', babyPrice: 600, product: 'Len',        productId: 'len',      sell: 300, grow: 260, cycle: 120, xp: 70, lv: 12, desc: 'Len mềm ấm', max: 12 },
};

/** Sức chứa mặc định mỗi chuồng (mở rộng dần bằng tiền + cấp) */
export const START_CAP = 3;
export const MAX_CAP: Record<string, number> = { chicken: 30, duck: 15, cow: 20, pig: 20, sheep: 12 };

export const FEED_PRICE = 15;
export const FEED_PRO_PRICE = 50;
export const BAIT_PRICE = 10;
export const BAIT_PRO_PRICE = 45;
/** Thuốc trừ sâu: phun khi cây bị sâu (cây ngừng lớn khi có sâu) */
export const PEST_PRICE = 20;
/** Tỉ lệ sâu ngẫu nhiên mỗi giây trên mỗi cây đang lớn (trung bình ~7 phút/cây) */
export const PEST_RATE = 0.0025;

export const PRODUCT_NAMES: Record<string, [string, string]> = {
  trung: ['Trứng', ''],
  trungvit: ['Trứng vịt', ''],
  sua: ['Sữa', ''],
  thit: ['Thịt heo', ''],
  len: ['Len cừu', ''],
  feed: ['Cám thường', ''],
  feedPro: ['Cám cao cấp', ''],
  bait: ['Mồi thường', ''],
  baitPro: ['Mồi ngon', ''],
  pesticide: ['Thuốc trừ sâu', ''],
  ung: ['Ủng cũ', ''],
  rong: ['Rong biển', ''],
};

export function itemName(pid: string): [string, string] {
  if (CROPS[pid]) return [CROPS[pid].name, CROPS[pid].emoji];
  if (FISHES[pid]) return [FISHES[pid].name, FISHES[pid].emoji];
  if (PRODUCT_NAMES[pid]) return PRODUCT_NAMES[pid];
  if (pid.startsWith('seed:')) { const c = CROPS[pid.slice(5)]; if (c) return ['Hạt ' + c.name, '']; }
  if (pid.startsWith('babyfish:')) { const c = FISHES[pid.slice(9)]; if (c) return ['Cá con ' + c.name, '']; }
  if (pid.startsWith('baby:')) { const c = FISHES[pid.slice(5)] ?? ANIMALS[pid.slice(5)]; if (c) return ['Con non ' + c.name, '']; }
  if (pid === 'feedPro') return PRODUCT_NAMES.feedPro;
  if (pid === 'baitPro') return PRODUCT_NAMES.baitPro;
  return [pid, ''];
}

export function sellPrice(pid: string): number {
  if (CROPS[pid]) return CROPS[pid].sell;
  if (FISHES[pid]) return FISHES[pid].sell;
  if (pid === 'trung') return 45;
  if (pid === 'trungvit') return 70;
  if (pid === 'sua') return 120;
  if (pid === 'thit') return 420;
  if (pid === 'len') return 300;
  if (pid === 'feed') return 7;
  if (pid === 'feedPro') return 25;
  if (pid === 'bait') return 5;
  if (pid === 'baitPro') return 22;
  if (pid === 'pesticide') return 10;
  if (pid === 'ung') return 3;
  if (pid === 'rong') return 2;
  return 1;
}

// ---------- Mở rộng trang trại: ô đất / ngăn ao / sức chứa ----------
// Ô sau đắt hơn ô trước (cấp số nhân), đồng thời yêu cầu cấp tăng dần.
export const MAX_PLOTS = 45;
export const START_PLOTS = 6;
export const MAX_POND = 15;
export const START_POND = 3;

/** Giá mở ô đất thứ i (0-based). VD: ô 7 ~70xu, ô 20 ~430xu, ô 45 ~6.5k */
export function plotCost(i: number): number {
  return Math.max(5, Math.round((40 * Math.pow(1.12, i)) / 5) * 5);
}
/** Cấp yêu cầu mở ô đất thứ i: ô 45 cần ~Lv31 */
export function plotReq(i: number): number {
  return 1 + Math.round(30 * Math.pow(i / (MAX_PLOTS - 1), 1.5));
}
/** Giá mở ngăn ao thứ k (0-based, k>=3). Ngăn 15 ~4k */
export function pondCost(k: number): number {
  return Math.round((100 * Math.pow(1.32, k - START_POND)) / 10) * 10;
}
/** Cấp yêu cầu ngăn ao thứ k: ngăn 15 cần Lv27 */
export function pondReq(k: number): number {
  return 2 + (k - START_POND) * 2;
}
const CAP_BASE: Record<string, number> = { chicken: 60, duck: 90, cow: 150, pig: 120, sheep: 300 };
const CAP_RATE: Record<string, number> = { chicken: 1.13, duck: 1.15, cow: 1.16, pig: 1.16, sheep: 1.18 };
/** Giá nâng sức chứa lên `next` (số con tối đa mới) */
export function capCost(type: string, next: number): number {
  return Math.round(((CAP_BASE[type] ?? 100) * Math.pow(CAP_RATE[type] ?? 1.15, next - 4)) / 10) * 10;
}
/** Cấp yêu cầu nâng sức chứa lên `next` */
export function capReq(type: string, next: number): number {
  const over = next - 4;
  switch (type) {
    case 'chicken': return 2 + Math.floor(over / 4);
    case 'duck': return 6 + Math.floor(over / 2);
    case 'cow': return 4 + Math.floor(over / 2);
    case 'pig': return 5 + Math.floor(over / 2);
    case 'sheep': return 12 + over;
    default: return 1;
  }
}

// ---------- Câu sông: thời gian cắn câu + bảng cá ----------
export const BITE_MIN = 3;      // giây chờ tối thiểu
export const BITE_MAX = 9;      // giây chờ tối đa
export const BITE_WINDOW = 1.4; // thời gian giật cần (giây)

/** Bảng cá sông: cá rẻ dễ dính, cá đắt hiếm; mồi ngon x5 tỉ lệ cá hiếm, ít rác */
export function riverTable(level: number, premium: boolean): { id: string; w: number }[] {
  const t: { id: string; w: number }[] = [];
  for (const id in FISHES) {
    const f = FISHES[id];
    if (level < f.lv) continue;
    let w = 1000 / Math.sqrt(f.sell);
    if (premium && f.sell >= 600) w *= 5;
    t.push({ id, w });
  }
  t.push({ id: 'ung', w: premium ? 3 : 8 });
  t.push({ id: 'rong', w: premium ? 4 : 10 });
  return t;
}
export function rollRiverCatch(level: number, premium: boolean): string {
  const t = riverTable(level, premium);
  let sum = 0;
  for (const e of t) sum += e.w;
  let r = Math.random() * sum;
  for (const e of t) { r -= e.w; if (r <= 0) return e.id; }
  return t[0].id;
}

export interface QuestDef { id: string; text: string; reward: { xu?: number; gem?: number; xp?: number } }
export const QUESTS: QuestDef[] = [
  { id: 'hoe',   text: 'Cày 1 ô đất đầu tiên (ra ruộng, bấm E)', reward: { xu: 50, xp: 10 } },
  { id: 'plant', text: 'Gieo 1 hạt Lúa', reward: { xu: 50, xp: 15 } },
  { id: 'water', text: 'Tưới nước cho cây', reward: { xu: 50, xp: 15 } },
  { id: 'harv',  text: 'Thu hoạch vụ đầu tiên', reward: { xu: 120, xp: 30 } },
  { id: 'chick', text: 'Mua 1 con Gà ở cửa hàng', reward: { xu: 100, xp: 25 } },
  { id: 'feed',  text: 'Cho vật nuôi / cá ăn 1 lần', reward: { xu: 100, xp: 25 } },
  { id: 'egg',   text: 'Thu 1 sản phẩm chăn nuôi (trứng/sữa...)', reward: { xu: 150, xp: 40 } },
  { id: 'fish',  text: 'Thả 1 con cá xuống ao', reward: { xu: 120, xp: 30 } },
  { id: 'rich',  text: 'Kiếm 2.000 xu (bán nông sản)', reward: { gem: 3, xp: 80 } },
  { id: 'lv5',   text: 'Đạt cấp 5 nông dân', reward: { gem: 5, xu: 500 } },
];

export const AVATARS = ['Nón lá', 'Khăn đỏ', 'Mũ lưỡi trai', 'Mũ cao bồi'];
export const SHIRTS = ['#3f9e4d', '#e75480', '#3b82f6', '#b45309'];

export const DAY_LENGTH = 240; // giây = 1 ngày
