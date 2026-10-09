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
  lua:     { id: 'lua',     name: 'Lúa',         emoji: '', seedPrice: 10,   sell: 28,    grow: 70,  xp: 6,   lv: 1,  desc: 'Lớn nhanh, dễ trồng' },
  carot:   { id: 'carot',   name: 'Cà rốt',      emoji: '', seedPrice: 25,   sell: 65,    grow: 140,  xp: 12,  lv: 2,  desc: 'Củ ngọt giòn' },
  caixanh: { id: 'caixanh', name: 'Cải xanh',    emoji: '', seedPrice: 40,   sell: 110,   grow: 190, xp: 16,  lv: 4,  desc: 'Rau sạch mỗi ngày' },
  cachua:  { id: 'cachua',  name: 'Cà chua',     emoji: '', seedPrice: 60,   sell: 160,   grow: 240, xp: 22,  lv: 6,  desc: 'Mọng nước' },
  khoai:   { id: 'khoai',   name: 'Khoai tây',   emoji: '', seedPrice: 100,  sell: 260,   grow: 300, xp: 30,  lv: 9,  desc: 'Bùi béo' },
  bap:     { id: 'bap',     name: 'Bắp',         emoji: '', seedPrice: 150,  sell: 400,   grow: 380, xp: 42,  lv: 12, desc: 'Vàng óng' },
  dualeo:  { id: 'dualeo',  name: 'Dưa leo',      emoji: '', seedPrice: 220,  sell: 580,   grow: 690, xp: 55,  lv: 16, desc: 'Giòn mát' },
  catim:   { id: 'catim',   name: 'Cà tím',      emoji: '', seedPrice: 320,  sell: 850,   grow: 840, xp: 70,  lv: 20, desc: 'Bóng mượt' },
  dautay:  { id: 'dautay',  name: 'Dâu tây',     emoji: '', seedPrice: 450,  sell: 1250,  grow: 990, xp: 90,  lv: 25, desc: 'Chua ngọt' },
  duahau:  { id: 'duahau',  name: 'Dưa hấu',     emoji: '', seedPrice: 650,  sell: 1800,  grow: 1200, xp: 120, lv: 32, desc: 'Ngọt lịm ngày hè' },
  nho:     { id: 'nho',     name: 'Nho',         emoji: '', seedPrice: 950,  sell: 2600,  grow: 1920, xp: 160, lv: 40, desc: 'Chùm trĩu quả' },
  bingo:   { id: 'bingo',   name: 'Bí ngô',      emoji: '', seedPrice: 1400, sell: 3900,  grow: 2240, xp: 210, lv: 50, desc: 'Quả to khổng lồ' },
  caphe:   { id: 'caphe',   name: 'Cà phê',      emoji: '', seedPrice: 2200, sell: 6200,  grow: 2640, xp: 280, lv: 65, desc: 'Thơm nức mũi' },
  nam:     { id: 'nam',     name: 'Nấm linh chi', emoji: '', seedPrice: 3500, sell: 10000, grow: 3900, xp: 380, lv: 80, desc: 'Dược liệu quý' },
  sam:     { id: 'sam',     name: 'Nhân sâm',    emoji: '', seedPrice: 6000, sell: 18000, grow: 4500, xp: 550, lv: 95, desc: 'Ngàn năm tuổi' },
  // --- vụ mới: lấp khoảng giữa + 2 cây endgame ---
  ot:       { id: 'ot',       name: 'Ớt',        emoji: '🌶️', seedPrice: 85,   sell: 230,   grow: 270, xp: 26,  lv: 8,  desc: 'Cay xé lưỡi' },
  hanh:     { id: 'hanh',     name: 'Hành lá',   emoji: '🧅', seedPrice: 180,  sell: 480,   grow: 400, xp: 48,  lv: 14, desc: 'Thơm nức mũi' },
  mia:      { id: 'mia',      name: 'Mía',       emoji: '🎋', seedPrice: 380,  sell: 1050,  grow: 900, xp: 80,  lv: 22, desc: 'Ngọt lịm' },
  dauphong: { id: 'dauphong', name: 'Đậu phộng', emoji: '🥜', seedPrice: 550,  sell: 1500,  grow: 1080, xp: 105, lv: 28, desc: 'Bùi béo' },
  thanhlog: { id: 'thanhlog', name: 'Thanh long', emoji: '🐉', seedPrice: 800,  sell: 2200,  grow: 1760, xp: 140, lv: 36, desc: 'Vỏ đỏ ruột trắng' },
  saurieng: { id: 'saurieng', name: 'Sầu riêng', emoji: '👑', seedPrice: 1200, sell: 3400,  grow: 2080, xp: 190, lv: 45, desc: 'Vua trái cây' },
  bo:       { id: 'bo',       name: 'Bơ',        emoji: '🥑', seedPrice: 1800, sell: 5200,  grow: 2400, xp: 240, lv: 58, desc: 'Béo ngậy' },
  mangcut:  { id: 'mangcut',  name: 'Măng cụt',  emoji: '🫐', seedPrice: 2800, sell: 8000,  grow: 3600, xp: 330, lv: 72, desc: 'Nữ hoàng trái cây' },
  vaithieu: { id: 'vaithieu', name: 'Vải thiều', emoji: '🍒', seedPrice: 4500, sell: 13500, grow: 4200, xp: 460, lv: 88, desc: 'Ngọt như đường' },
};

export const FISHES: Record<string, FishDef> = {
  caro:     { id: 'caro',     name: 'Cá rô',      emoji: '', babyPrice: 30,   sell: 80,   grow: 360,  xp: 10,  lv: 1,  desc: 'Dễ nuôi' },
  cachep:   { id: 'cachep',   name: 'Cá chép',    emoji: '', babyPrice: 60,   sell: 170,  grow: 600, xp: 18,  lv: 3,  desc: 'Vảy vàng' },
  tom:      { id: 'tom',      name: 'Tôm',        emoji: '', babyPrice: 120,  sell: 340,  grow: 800, xp: 30,  lv: 6,  desc: 'Nhảy tanh tách' },
  cua:      { id: 'cua',      name: 'Cua',        emoji: '', babyPrice: 220,  sell: 620,  grow: 1040, xp: 45,  lv: 10, desc: 'Càng to chắc thịt' },
  caloc:    { id: 'caloc',    name: 'Cá lóc',     emoji: '', babyPrice: 380,  sell: 1100, grow: 1320, xp: 70,  lv: 15, desc: 'Khỏe mạnh' },
  cakoi:    { id: 'cakoi',    name: 'Cá Koi',     emoji: '', babyPrice: 700,  sell: 2100, grow: 1680, xp: 110, lv: 25, desc: 'Quý hiếm' },
  bachtuoc: { id: 'bachtuoc', name: 'Bạch tuộc',  emoji: '', babyPrice: 1200, sell: 3600, grow: 2080, xp: 160, lv: 35, desc: 'Tám tay thông thái' },
  camap:    { id: 'camap',    name: 'Cá mập',     emoji: '', babyPrice: 2200, sell: 6800, grow: 2640, xp: 240, lv: 50, desc: 'Chúa tể đại dương' },
  // --- thủy sản mới: từ ao làng tới biển sâu ---
  cadieu:   { id: 'cadieu',   name: 'Cá diêu hồng', emoji: '🐟', babyPrice: 180,  sell: 520,   grow: 960, xp: 40,  lv: 8,  desc: 'Thịt ngọt' },
  catre:    { id: 'catre',    name: 'Cá trê',       emoji: '🐟', babyPrice: 300,  sell: 900,   grow: 1200, xp: 60,  lv: 12, desc: 'Râu dài' },
  luon:     { id: 'luon',     name: 'Lươn',         emoji: '🐍', babyPrice: 500,  sell: 1500,  grow: 1480, xp: 90,  lv: 20, desc: 'Trơn tuột' },
  ech:      { id: 'ech',      name: 'Ếch',          emoji: '🐸', babyPrice: 850,  sell: 2500,  grow: 1800, xp: 125, lv: 30, desc: 'Đùi to' },
  cahoi:    { id: 'cahoi',    name: 'Cá hồi',       emoji: '🍣', babyPrice: 1500, sell: 4600,  grow: 2240, xp: 190, lv: 42, desc: 'Vượt thác' },
  tomhum:   { id: 'tomhum',   name: 'Tôm hùm',      emoji: '🦞', babyPrice: 2800, sell: 8600,  grow: 2800, xp: 300, lv: 60, desc: 'Càng khổng lồ' },
  cavang:   { id: 'cavang',   name: 'Cá vàng',      emoji: '🐠', babyPrice: 4000, sell: 12500, grow: 3200, xp: 420, lv: 75, desc: 'Cảnh quý tộc' },
};

export const ANIMALS: Record<string, AnimalDef> = {
  chicken: { id: 'chicken', name: 'Gà',   emoji: '', babyPrice: 80,  product: 'Trứng',     productId: 'trung',    sell: 45,  grow: 270,  cycle: 45,  xp: 12, lv: 2,  desc: 'Đẻ trứng đều', max: 30 },
  duck:    { id: 'duck',    name: 'Vịt',  emoji: '', babyPrice: 150, product: 'Trứng vịt',  productId: 'trungvit', sell: 70,  grow: 330, cycle: 55,  xp: 18, lv: 6,  desc: 'Bơi lội giỏi', max: 15 },
  cow:     { id: 'cow',     name: 'Bò sữa', emoji: '', babyPrice: 250, product: 'Sữa',      productId: 'sua',      sell: 120, grow: 540, cycle: 75,  xp: 28, lv: 4,  desc: 'Cho sữa ngọt', max: 20 },
  pig:     { id: 'pig',     name: 'Heo',  emoji: '', babyPrice: 280, product: 'Thịt',      productId: 'thit',     sell: 420, grow: 720, cycle: 150, xp: 50, lv: 5,  desc: 'Lớn nhanh', max: 20 },
  sheep:   { id: 'sheep',   name: 'Cừu',  emoji: '', babyPrice: 600, product: 'Len',        productId: 'len',      sell: 300, grow: 780, cycle: 120, xp: 70, lv: 12, desc: 'Len mềm ấm', max: 12 },
  // --- vật nuôi mới: chuồng gà-vịt (nhỏ) + trại bò-heo-cừu (lớn) ---
  cut:     { id: 'cut',     name: 'Chim cút', emoji: '🐦', babyPrice: 120, product: 'Trứng cút',  productId: 'trungcut',  sell: 80,  grow: 240,  cycle: 40,  xp: 10, lv: 3,  desc: 'Nhỏ mà đẻ khỏe', max: 25 },
  bocau:   { id: 'bocau',   name: 'Bồ câu',   emoji: '🕊️', babyPrice: 180, product: 'Trứng chim', productId: 'trungcau',  sell: 110, grow: 300, cycle: 50,  xp: 15, lv: 5,  desc: 'Đưa thư siêu tốc', max: 20 },
  rabbit:  { id: 'rabbit',  name: 'Thỏ',      emoji: '🐰', babyPrice: 200, product: 'Lông thỏ',   productId: 'longtho',   sell: 140, grow: 360, cycle: 60,  xp: 22, lv: 7,  desc: 'Nhảy tung tăng', max: 20 },
  goose:   { id: 'goose',   name: 'Ngỗng',    emoji: '🪿', babyPrice: 350, product: 'Trứng ngỗng',productId: 'trungngong',sell: 160, grow: 480, cycle: 80,  xp: 35, lv: 10, desc: 'Trông nhà giỏi', max: 12 },
  ong:     { id: 'ong',     name: 'Ong mật',  emoji: '🐝', babyPrice: 500, product: 'Mật ong',    productId: 'matong',    sell: 500, grow: 600, cycle: 100, xp: 60, lv: 16, desc: 'Chăm chỉ hút mật', max: 16 },
  goat:    { id: 'goat',    name: 'Dê',       emoji: '🐐', babyPrice: 700, product: 'Sữa dê',     productId: 'suade',     sell: 350, grow: 840, cycle: 130, xp: 80, lv: 14, desc: 'Leo trèo giỏi', max: 12 },
  buffalo: { id: 'buffalo', name: 'Trâu',     emoji: '🐃', babyPrice: 1200, product: 'Sữa trâu',  productId: 'suatrau',   sell: 550, grow: 1080, cycle: 180, xp: 130, lv: 22, desc: 'Đầu cơ nghiệp', max: 10 },
};

/** Giá bán 1 con vật nuôi đã lớn = 180% giá mua con non (nuôi lớn rồi bán mới có lãi) */
export function animalSellPrice(type: string): number {
  const A = ANIMALS[type];
  if (!A) return 1;
  return Math.round(A.babyPrice * 1.8);
}
/** Sức chứa mặc định mỗi chuồng (mở rộng dần bằng tiền + cấp) */
export const START_CAP = 3;
export const MAX_CAP: Record<string, number> = {
  chicken: 30, duck: 15, cow: 20, pig: 20, sheep: 12,
  cut: 25, bocau: 20, rabbit: 20, goose: 12, ong: 16, goat: 12, buffalo: 10,
};
/** Con nhỏ ở chuồng gà–vịt, con lớn ở trại bò–heo–cừu */
export const COOP_TYPES = ['chicken', 'duck', 'cut', 'bocau', 'rabbit', 'goose', 'ong'];
export const BARN_TYPES = ['cow', 'pig', 'sheep', 'goat', 'buffalo'];

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
  longtho: ['Lông thỏ', '🐰'],
  suade: ['Sữa dê', '🐐'],
  suatrau: ['Sữa trâu', '🐃'],
  trungngong: ['Trứng ngỗng', '🪿'],
  trungcau: ['Trứng chim', '🕊️'],
  trungcut: ['Trứng cút', '🐦'],
  matong: ['Mật ong', '🍯'],
  feed: ['Cám thường', ''],
  feedPro: ['Cám cao cấp', ''],
  bait: ['Mồi thường', ''],
  baitPro: ['Mồi ngon', ''],
  pesticide: ['Thuốc trừ sâu', ''],
  ung: ['Ủng cũ', ''],
  rong: ['Rong biển', ''],
  // --- món ăn nấu trong Nhà cô Ba (bán được giá cao hơn tổng nguyên liệu) ---
  flan: ['Bánh flan', '🍮'],
  saladtron: ['Salad trộn', '🥗'],
  thitkho: ['Thịt kho trứng', '🍲'],
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
  if (pid === 'longtho') return 140;
  if (pid === 'suade') return 350;
  if (pid === 'suatrau') return 550;
  if (pid === 'trungngong') return 160;
  if (pid === 'trungcau') return 110;
  if (pid === 'trungcut') return 80;
  if (pid === 'matong') return 500;
  if (pid === 'feed') return 7;
  if (pid === 'feedPro') return 25;
  if (pid === 'bait') return 5;
  if (pid === 'baitPro') return 22;
  if (pid === 'pesticide') return 10;
  if (pid === 'ung') return 3;
  if (pid === 'rong') return 2;
  if (pid === 'flan') return 300;
  if (pid === 'saladtron') return 430;
  if (pid === 'thitkho') return 740;
  return 1;
}

// ---------- Mở rộng trang trại: ô đất / ngăn ao / sức chứa ----------
// Ô sau đắt hơn ô trước (cấp số nhân), đồng thời yêu cầu cấp tăng dần.
export const MAX_PLOTS = 45;
export const START_PLOTS = 6;
export const MAX_POND = 15;
export const START_POND = 3;

/** Hệ số càng mở càng đắt: lần mở đầu x2, lần mở cuối x10 (tuyến tính theo tiến độ) */
function rampMult(pos: number, total: number): number {
  if (total <= 1) return 2;
  return 2 + (8 * Math.max(0, Math.min(total - 1, pos))) / (total - 1);
}
/** Giá mở ô đất thứ i (0-based): gốc cấp số nhân rồi x thêm hệ số ramp (ô 7 ~x2, ô 45 ~x10) */
export function plotCost(i: number): number {
  const base = Math.max(50, Math.round((50 * Math.pow(1.22, i)) / 10) * 10);
  return Math.round((base * rampMult(i - START_PLOTS, MAX_PLOTS - START_PLOTS)) / 10) * 10;
}
/** Cấp yêu cầu mở ô đất thứ i: ô 45 cần ~Lv31 */
export function plotReq(i: number): number {
  return 1 + Math.round(30 * Math.pow(i / (MAX_PLOTS - 1), 1.5));
}
/** Giá mở ngăn ao thứ k (0-based, k>=3): gốc lũy thừa rồi x thêm ramp (ngăn đầu x2, ngăn cuối x10) */
export function pondCost(k: number): number {
  const base = Math.round((300 * Math.pow(1.55, k - START_POND)) / 10) * 10;
  return Math.round((base * rampMult(k - START_POND, MAX_POND - START_POND)) / 10) * 10;
}
/** Cấp yêu cầu ngăn ao thứ k: ngăn 15 cần Lv27 */
export function pondReq(k: number): number {
  return 2 + (k - START_POND) * 2;
}
const CAP_BASE: Record<string, number> = {
  chicken: 150, duck: 250, cow: 450, pig: 400, sheep: 900,
  cut: 200, bocau: 260, rabbit: 300, goose: 500, ong: 600, goat: 1000, buffalo: 2000,
};
const CAP_RATE: Record<string, number> = {
  chicken: 1.22, duck: 1.24, cow: 1.25, pig: 1.25, sheep: 1.27,
  cut: 1.22, bocau: 1.23, rabbit: 1.24, goose: 1.25, ong: 1.26, goat: 1.28, buffalo: 1.3,
};
/** Giá nâng sức chứa lên `next` (số con tối đa mới): gốc lũy thừa rồi x thêm ramp (nới đầu x2, nới cuối x10) */
export function capCost(type: string, next: number): number {
  const base = Math.round(((CAP_BASE[type] ?? 100) * Math.pow(CAP_RATE[type] ?? 1.15, next - 4)) / 10) * 10;
  const max = ANIMALS[type]?.max ?? next;
  return Math.round((base * rampMult(next - (START_CAP + 1), max - (START_CAP + 1))) / 10) * 10;
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
    case 'cut': return 3 + Math.floor(over / 4);
    case 'bocau': return 5 + Math.floor(over / 3);
    case 'rabbit': return 7 + Math.floor(over / 3);
    case 'goose': return 10 + Math.floor(over / 2);
    case 'ong': return 16 + over;
    case 'goat': return 14 + over;
    case 'buffalo': return 22 + over;
    default: return 1;
  }
}

// ---------- Câu sông: thời gian cắn câu + bảng cá ----------
export const BITE_MIN = 3;      // giây chờ tối thiểu
export const BITE_MAX = 9;      // giây chờ tối đa
export const BITE_WINDOW = 3;   // thời gian hoàn thành dãy mũi tên (giây)

// Mini-game giật cá: khi cá cắn câu hiện dãy phím mũi tên, bấm đúng + kịp giờ mới dính.
// Cá giá trị càng lớn → dãy càng dài.
export type BiteDir = 'up' | 'down' | 'left' | 'right';
export const BITE_ARROWS: Record<BiteDir, string> = { up: '↑', down: '↓', left: '←', right: '→' };

/** Số phím phải bấm theo giá bán của con cá (rác = 3, Cá mập = 8) */
export function comboLengthFor(sell: number): number {
  if (sell <= 100) return 3;
  if (sell <= 400) return 4;
  if (sell <= 1200) return 5;
  if (sell <= 2500) return 6;
  if (sell <= 4000) return 7;
  return 8;
}

/** Sinh dãy mũi tên ngẫu nhiên, độ dài theo giá trị cá */
export function genBiteCombo(sell: number): BiteDir[] {
  const n = comboLengthFor(sell);
  const dirs: BiteDir[] = ['up', 'down', 'left', 'right'];
  return Array.from({ length: n }, () => dirs[(Math.random() * dirs.length) | 0]);
}

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

// ---------- Thời trang: mua bằng xu/gem ở Shop Lưu niệm (thị trấn) ----------
// Mỗi món thuộc 1 slot; mỗi slot chỉ mặc 1 món. Đồ mặc thấy ngay trên nhân vật.
export type OutfitSlot = 'shirt' | 'pants' | 'hat' | 'hair' | 'shoes' | 'acc' | 'wing';
export interface OutfitItem {
  id: string; slot: OutfitSlot; name: string; desc: string;
  priceXu?: number; priceGem?: number;
  /** màu vẽ lên nhân vật (tùy slot) */
  color?: string;
  /** icon minh họa trong shop */
  emoji: string;
}
export const OUTFIT_SLOTS: { id: OutfitSlot; name: string; emoji: string }[] = [
  { id: 'shirt', name: 'Áo', emoji: '👕' },
  { id: 'pants', name: 'Quần', emoji: '👖' },
  { id: 'hat', name: 'Nón', emoji: '🎩' },
  { id: 'hair', name: 'Tóc', emoji: '💇' },
  { id: 'shoes', name: 'Giày', emoji: '👟' },
  { id: 'acc', name: 'Phụ kiện', emoji: '🕶️' },
  { id: 'wing', name: 'Cánh', emoji: '🪽' },
];
export const OUTFITS: Record<string, OutfitItem> = {
  // Áo (11)
  shirt_basic:  { id: 'shirt_basic',  slot: 'shirt', name: 'Áo vải nông dân', desc: 'Mặc định, thơm mùi rơm', emoji: '👕' },
  shirt_lua:    { id: 'shirt_lua',    slot: 'shirt', name: 'Áo Lúa vàng', desc: 'Mặc vào gặt hên hơn (đồn thế)', priceXu: 600, color: '#eab308', emoji: '🌾' },
  shirt_hong:   { id: 'shirt_hong',   slot: 'shirt', name: 'Áo Hồng cánh sen', desc: 'Nổi nhất thị trấn', priceXu: 1250, color: '#ec4899', emoji: '🌸' },
  shirt_dragon: { id: 'shirt_dragon', slot: 'shirt', name: 'Áo Rồng lửa', desc: 'Hàng hiếm đổi bằng gem', priceGem: 15, color: '#dc2626', emoji: '🐉' },
  shirt_ran:    { id: 'shirt_ran',    slot: 'shirt', name: 'Áo Rằn ri', desc: 'Ngụy trang đi hái trộm', priceXu: 2000, color: '#4d7c0f', emoji: '🎖️' },
  shirt_bien:   { id: 'shirt_bien',   slot: 'shirt', name: 'Áo Biển xanh', desc: 'Mát như gió sông', priceXu: 3000, color: '#0284c7', emoji: '🌊' },
  shirt_hoa:    { id: 'shirt_hoa',    slot: 'shirt', name: 'Áo Hoa hòe', desc: 'Rực rỡ mùa hè', priceXu: 4000, color: '#f472b6', emoji: '🌺' },
  shirt_gio:    { id: 'shirt_gio',    slot: 'shirt', name: 'Áo Gió thể thao', desc: 'Chạy nhanh như gió', priceXu: 4500, color: '#38bdf8', emoji: '🎽' },
  shirt_den:    { id: 'shirt_den',    slot: 'shirt', name: 'Áo Đen huyền bí', desc: 'Ngầu lòi thị trấn', priceXu: 6000, color: '#111827', emoji: '🖤' },
  shirt_ngoc:   { id: 'shirt_ngoc',   slot: 'shirt', name: 'Áo Ngọc bích', desc: 'Ngọc quý đổi bằng gem', priceGem: 20, color: '#10b981', emoji: '💚' },
  shirt_vua:    { id: 'shirt_vua',    slot: 'shirt', name: 'Áo Vua nông trại', desc: 'Chỉ vua mới dám mặc', priceGem: 30, color: '#f59e0b', emoji: '👑' },
  // Quần (10)
  pants_basic: { id: 'pants_basic', slot: 'pants', name: 'Quần yếm xanh', desc: 'Mặc định', emoji: '👖' },
  pants_dui:   { id: 'pants_dui',   slot: 'pants', name: 'Quần đùi tắm sông', desc: 'Mát mẻ ngày hè', priceXu: 500, color: '#f59e0b', emoji: '🩳' },
  pants_vest:  { id: 'pants_vest',  slot: 'pants', name: 'Quần tây lịch lãm', desc: 'Đi casino không ai dám khinh', priceXu: 1500, color: '#1f2937', emoji: '🤵' },
  pants_jean:  { id: 'pants_jean',  slot: 'pants', name: 'Quần jean bụi', desc: 'Bụi đời chợ quê', priceXu: 2000, color: '#3b82f6', emoji: '👖' },
  pants_kaki:  { id: 'pants_kaki',  slot: 'pants', name: 'Quần kaki', desc: 'Đứng đắn làm ăn', priceXu: 3250, color: '#a16207', emoji: '🧵' },
  pants_the:   { id: 'pants_the',   slot: 'pants', name: 'Quần thể thao', desc: 'Co giãn 4 chiều', priceXu: 4000, color: '#64748b', emoji: '🏃' },
  pants_hoa:   { id: 'pants_hoa',   slot: 'pants', name: 'Quần hoa', desc: 'Đi hội làng', priceXu: 5000, color: '#ec4899', emoji: '🌷' },
  pants_da:    { id: 'pants_da',    slot: 'pants', name: 'Quần da ngầu', desc: 'Phượt thủ chính hiệu', priceXu: 7500, color: '#451a03', emoji: '🤘' },
  pants_gem:   { id: 'pants_gem',   slot: 'pants', name: 'Quần Gem lấp lánh', desc: 'Đổi bằng gem, sáng cả đêm', priceGem: 20, color: '#22d3ee', emoji: '✨' },
  pants_vang:  { id: 'pants_vang',  slot: 'pants', name: 'Quần Vàng vua', desc: 'Xứng đôi với Áo Vua', priceGem: 30, color: '#fbbf24', emoji: '👑' },
  // Nón / mũ (12)
  hat_none:   { id: 'hat_none',   slot: 'hat', name: 'Không đội mũ', desc: 'Khoe tóc mới', emoji: '🧑' },
  hat_la:     { id: 'hat_la',     slot: 'hat', name: 'Nón lá quê hương', desc: 'Mặc định, che nắng tốt', emoji: '⛑️' },
  hat_luoi:   { id: 'hat_luoi',   slot: 'hat', name: 'Mũ lưỡi trai đỏ', desc: 'Trẻ trung năng động', priceXu: 750, color: '#ef4444', emoji: '🧢' },
  hat_cao:    { id: 'hat_cao',    slot: 'hat', name: 'Mũ cao bồi', desc: 'Cao bồi nông trại', priceXu: 1750, color: '#92400e', emoji: '🤠' },
  hat_vuong:  { id: 'hat_vuong',  slot: 'hat', name: 'Vương miện Củ cải', desc: 'Vua của ruộng vườn, bằng gem', priceGem: 25, color: '#fbbf24', emoji: '👑' },
  hat_ket:    { id: 'hat_ket',    slot: 'hat', name: 'Mũ kết đen', desc: 'Chất chơi người dơi', priceXu: 1250, color: '#1f2937', emoji: '🧢' },
  hat_taibeo: { id: 'hat_taibeo', slot: 'hat', name: 'Mũ tai bèo', desc: 'Đi ruộng chuẩn bài', priceXu: 2000, color: '#65a30d', emoji: '🎩' },
  hat_len:    { id: 'hat_len',    slot: 'hat', name: 'Mũ len ấm', desc: 'Mùa tuyết không lo', priceXu: 2500, color: '#f472b6', emoji: '🧶' },
  hat_noel:   { id: 'hat_noel',   slot: 'hat', name: 'Mũ Noel', desc: 'Giáng sinh an lành', priceXu: 3500, color: '#dc2626', emoji: '🎅' },
  hat_phot:   { id: 'hat_phot',   slot: 'hat', name: 'Mũ phớt', desc: 'Quý ông thị trấn', priceXu: 6000, color: '#57534e', emoji: '🎩' },
  hat_sat:    { id: 'hat_sat',    slot: 'hat', name: 'Mũ sắt chiến binh', desc: 'Đánh nhau không sợ đau', priceXu: 10000, color: '#9ca3af', emoji: '⛑️' },
  hat_kimcuong: { id: 'hat_kimcuong', slot: 'hat', name: 'Mũ Kim cương', desc: 'Sáng nhất server', priceGem: 35, color: '#67e8f9', emoji: '💎' },
  // Tóc (11)
  hair_black: { id: 'hair_black', slot: 'hair', name: 'Tóc đen mượt', desc: 'Mặc định', color: '#1f2937', emoji: '💇' },
  hair_vang:  { id: 'hair_vang',  slot: 'hair', name: 'Tóc vàng hoe', desc: 'Nhuộm nắng đồng quê', priceXu: 600, color: '#f59e0b', emoji: '👱' },
  hair_hong:  { id: 'hair_hong',  slot: 'hair', name: 'Tóc hồng kẹo bông', desc: 'Ngọt ngào đáng yêu', priceXu: 1000, color: '#f9a8d4', emoji: '🌷' },
  hair_xanh:  { id: 'hair_xanh',  slot: 'hair', name: 'Tóc xanh đại dương', desc: 'Câu cá auto dính (đồn thế)', priceGem: 10, color: '#22d3ee', emoji: '🌊' },
  hair_nau:   { id: 'hair_nau',   slot: 'hair', name: 'Tóc nâu hạt dẻ', desc: 'Dịu dàng thu Hà Nội', priceXu: 750, color: '#92400e', emoji: '🌰' },
  hair_do:    { id: 'hair_do',    slot: 'hair', name: 'Tóc đỏ rực lửa', desc: 'Cá tính bùng cháy', priceXu: 1250, color: '#ef4444', emoji: '🔥' },
  hair_tim:   { id: 'hair_tim',   slot: 'hair', name: 'Tóc tím mộng mơ', desc: 'Hoàng hôn thị trấn', priceXu: 2000, color: '#a855f7', emoji: '🔮' },
  hair_trang: { id: 'hair_trang', slot: 'hair', name: 'Tóc trắng cước', desc: 'Lão làng nông trại', priceXu: 3000, color: '#e5e7eb', emoji: '❄️' },
  hair_xanhla:{ id: 'hair_xanhla', slot: 'hair', name: 'Tóc xanh lá', desc: 'Hòa mình ruộng lúa', priceXu: 4000, color: '#22c55e', emoji: '🌿' },
  hair_cauvong: { id: 'hair_cauvong', slot: 'hair', name: 'Tóc cầu vồng', desc: '7 sắc đổi bằng gem', priceGem: 15, color: '#f472b6', emoji: '🌈' },
  hair_bachkim: { id: 'hair_bachkim', slot: 'hair', name: 'Tóc bạch kim', desc: 'Sao hạng A', priceGem: 25, color: '#fef08a', emoji: '⭐' },
  // Giày (11)
  shoes_basic: { id: 'shoes_basic', slot: 'shoes', name: 'Ủng nâu lội ruộng', desc: 'Mặc định', emoji: '🥾' },
  shoes_dep:   { id: 'shoes_dep',   slot: 'shoes', name: 'Dép tổ ong', desc: 'Huyền thoại thị trấn', priceXu: 400, color: '#fbbf24', emoji: '🩴' },
  shoes_giay:  { id: 'shoes_giay',   slot: 'shoes', name: 'Giày thể thao', desc: 'Chạy nhanh hơn (cảm giác thế)', priceXu: 1100, color: '#ef4444', emoji: '👟' },
  shoes_vang:  { id: 'shoes_vang',   slot: 'shoes', name: 'Giày vàng óng', desc: 'Đeo vào ai cũng ngoái nhìn', priceGem: 10, color: '#facc15', emoji: '✨' },
  shoes_vai:   { id: 'shoes_vai',   slot: 'shoes', name: 'Giày vải', desc: 'Nhẹ tênh đi chợ', priceXu: 750, color: '#93c5fd', emoji: '👟' },
  shoes_boot:  { id: 'shoes_boot',  slot: 'shoes', name: 'Ủng cao su', desc: 'Lội bùn vô tư', priceXu: 2000, color: '#166534', emoji: '🥾' },
  shoes_da:    { id: 'shoes_da',    slot: 'shoes', name: 'Giày da bóng', desc: 'Đi casino oách xà lách', priceXu: 3500, color: '#451a03', emoji: '👞' },
  shoes_chay:  { id: 'shoes_chay',  slot: 'shoes', name: 'Giày chạy bộ', desc: 'Marathon đồng quê', priceXu: 5000, color: '#f97316', emoji: '🏃' },
  shoes_truot: { id: 'shoes_truot', slot: 'shoes', name: 'Giày trượt patin', desc: 'Lướt thị trấn', priceXu: 7500, color: '#8b5cf6', emoji: '🛼' },
  shoes_ngoc:  { id: 'shoes_ngoc',  slot: 'shoes', name: 'Giày ngọc', desc: 'Đổi bằng gem', priceGem: 15, color: '#2dd4bf', emoji: '💚' },
  shoes_bay:   { id: 'shoes_bay',   slot: 'shoes', name: 'Giày Bay', desc: 'Nhảy cao 3 mét (đồn thế)', priceGem: 30, color: '#fde047', emoji: '🪽' },
  // Phụ kiện (11)
  acc_none:   { id: 'acc_none',   slot: 'acc', name: 'Không đeo gì', desc: 'Giản dị', emoji: '🚫' },
  acc_kinh:   { id: 'acc_kinh',   slot: 'acc', name: 'Kính râm ngầu', desc: 'Đeo vào auto ngầu', priceXu: 900, emoji: '🕶️' },
  acc_hoa:    { id: 'acc_hoa',    slot: 'acc', name: 'Hoa tai cúc họa mi', desc: 'Dịu dàng thướt tha', priceXu: 1300, emoji: '🌼' },
  acc_sao:    { id: 'acc_sao',    slot: 'acc', name: 'Huy hiệu Ngôi sao', desc: 'Dành cho đại gia gem', priceGem: 20, emoji: '⭐' },
  acc_dongho: { id: 'acc_dongho', slot: 'acc', name: 'Đồng hồ xịn', desc: 'Giờ nào cũng đúng', priceXu: 1500, emoji: '⌚' },
  acc_daychuyen: { id: 'acc_daychuyen', slot: 'acc', name: 'Dây chuyền vàng', desc: 'Lấp lánh là lên', priceXu: 2500, emoji: '📿' },
  acc_matna:  { id: 'acc_matna',  slot: 'acc', name: 'Mặt nạ siêu nhân', desc: 'Đi đêm không sợ', priceXu: 3500, emoji: '🎭' },
  acc_canh:   { id: 'acc_canh',   slot: 'acc', name: 'Cánh tiên', desc: 'Bay lượn thị trấn', priceXu: 5000, emoji: '🧚' },
  acc_kiem:   { id: 'acc_kiem',   slot: 'acc', name: 'Kiếm gỗ', desc: 'Đánh yêu đau hơn', priceXu: 7500, emoji: '🗡️' },
  acc_khien:  { id: 'acc_khien',  slot: 'acc', name: 'Khiên rơm', desc: 'Đỡ đòn hái trộm', priceXu: 10000, emoji: '🛡️' },
  acc_vong:   { id: 'acc_vong',   slot: 'acc', name: 'Vòng Gem vĩnh cửu', desc: 'Đeo vào trường sinh', priceGem: 25, emoji: '💍' },
  // Đồ đeo sau lưng (6)
  wing_none:  { id: 'wing_none',  slot: 'wing', name: 'Trống lưng', desc: 'Để lưng trần thoáng mát', emoji: '🚫' },
  wing_balo:  { id: 'wing_balo',  slot: 'wing', name: 'Balo Du lịch', desc: 'Đựng cả thế giới sau lưng', priceXu: 2500, color: '#b45309', emoji: '🎒' },
  wing_buom:  { id: 'wing_buom',  slot: 'wing', name: 'Cánh Bướm', desc: 'Vỗ cánh bay lượn thị trấn', priceXu: 4000, color: '#f472b6', emoji: '🦋' },
  wing_doi:   { id: 'wing_doi',   slot: 'wing', name: 'Cánh Dơi đêm', desc: 'Lặng lẽ như bóng đêm', priceXu: 6000, color: '#334155', emoji: '🦇' },
  wing_mai:   { id: 'wing_mai',   slot: 'wing', name: 'Mai Rùa con', desc: 'Chậm mà chắc, cưng xỉu', priceXu: 7500, color: '#65a30d', emoji: '🐢' },
  wing_thien: { id: 'wing_thien', slot: 'wing', name: 'Cánh Thiên thần', desc: 'Trắng muốt đổi bằng gem', priceGem: 25, color: '#fefce8', emoji: '😇' },
};
export const DEFAULT_OUTFIT: Record<OutfitSlot, string> = {
  shirt: 'shirt_basic', pants: 'pants_basic', hat: 'hat_la',
  hair: 'hair_black', shoes: 'shoes_basic', acc: 'acc_none', wing: 'wing_none',
};
/** Màu áo đang mặc (áo đặc biệt đè màu avatar) */
export function shirtColorOf(outfit?: Record<string, string>, fallback = '#3f9e4d'): string {
  const id = outfit?.shirt;
  const c = id ? OUTFITS[id]?.color : undefined;
  return c ?? fallback;
}

// ---------- Xe: mua ở Gara Anh Tý (vào trong nhà xem + lái thử), chạy vi vu farm + thị trấn ----------
// Đi bộ 260. Thang giá leo dần: xe đạp mốc 10.000 xu -> xe máy -> ô tô xu -> mô tô gem -> siêu xe.
export type CarKind = 'bike' | 'moto' | 'car';
export interface CarItem {
  id: string; name: string; desc: string;
  priceXu?: number; priceGem?: number;
  /** cấp tối thiểu để mua */
  minLevel?: number;
  /** tốc độ lái (px/s) */
  speed: number;
  /** màu thân xe vẽ lên canvas */
  color: string;
  /** icon minh họa trong shop */
  emoji: string;
  /** loại xe: vẽ hình khác nhau ngoài đời (đạp/máy/hơi) */
  kind: CarKind;
}
export const WALK_SPEED = 260;
export const CAR_KINDS: { id: CarKind; name: string; emoji: string }[] = [
  { id: 'bike', name: 'Xe đạp', emoji: '🚲' },
  { id: 'moto', name: 'Xe máy', emoji: '🛵' },
  { id: 'car', name: 'Ô tô', emoji: '🚗' },
];
export const CARS: Record<string, CarItem> = {
  bike_xedap: { id: 'bike_xedap', kind: 'bike', name: 'Xe Đạp Thong Dong', desc: 'Đạp hóng gió, khỏe chân khỏe người', priceXu: 10000, minLevel: 1, speed: 272, color: '#38bdf8', emoji: '🚲' },
  bike_rua:   { id: 'bike_rua',   kind: 'bike', name: 'Xe Đạp Chở Hàng', desc: 'Giỏ trước gác sau, chở cả khu chợ', priceXu: 18000, minLevel: 2, speed: 288, color: '#fb8c00', emoji: '🚲' },
  bike_doi:   { id: 'bike_doi',   kind: 'bike', name: 'Xe Đạp Đôi Tình Cảm', desc: 'Hai yên hai lái, đạp đôi dạo làng', priceXu: 35000, minLevel: 3, speed: 308, color: '#ec407a', emoji: '🚲' },
  bike_dia:   { id: 'bike_dia',   kind: 'bike', name: 'Xe Đạp Địa Hình', desc: 'Lốp gai phuộc nhún, chấp mọi ổ gà', priceXu: 60000, minLevel: 5, speed: 332, color: '#7cb342', emoji: '🚲' },
  bike_dua:   { id: 'bike_dua',   kind: 'bike', name: 'Xe Đạp Đua Tia Chớp', desc: 'Khung vuốt lốp mỏng, phóng như bay', priceXu: 120000, minLevel: 7, speed: 340, color: '#00acc1', emoji: '🚲' },
  moto_cub:   { id: 'moto_cub',   kind: 'moto', name: 'Xe Máy Cub Chiến', desc: 'Cub huyền thoại, luồn lách khắp làng', priceXu: 28000, minLevel: 3, speed: 344, color: '#ef4444', emoji: '🛵' },
  moto_scoot: { id: 'moto_scoot', kind: 'moto', name: 'Xe Ga Thanh Lịch', desc: 'Yếm tròn cổ điển, chạy êm ru', priceXu: 45000, minLevel: 4, speed: 380, color: '#26a69a', emoji: '🛵' },
  moto_dia:   { id: 'moto_dia',   kind: 'moto', name: 'Xe Cào Cào Vượt Đồi', desc: 'Dè cao lốp gai, leo đồi vượt ruộng', priceXu: 100000, minLevel: 6, speed: 468, color: '#9ccc65', emoji: '🏍️' },
  moto_the:   { id: 'moto_the',   kind: 'moto', name: 'Mô Tô Thể Thao GP', desc: 'Dàn áo full, vít là dính lưng', priceXu: 200000, minLevel: 8, speed: 508, color: '#5c6bc0', emoji: '🏍️' },
  car_coc:    { id: 'car_coc',     kind: 'car', name: 'Xe Cọc Cạch', desc: 'Máy kêu cọc cạch nhưng chạy vẫn ngon', priceXu: 55000, minLevel: 5, speed: 384, color: '#8d6e63', emoji: '🛻' },
  car_bantai: { id: 'car_bantai',  kind: 'car', name: 'Xe Bán Tải Thôn Quê', desc: 'Thùng sau chở lúa chở rơm vô tư', priceXu: 90000, minLevel: 6, speed: 416, color: '#2e7d32', emoji: '🛻' },
  moto_pkl:   { id: 'moto_pkl',   kind: 'moto', name: 'Mô Tô Phân Khối Lớn', desc: 'Gầm rú như sấm, chỉ dân chơi gem', priceGem: 8, minLevel: 7, speed: 488, color: '#1f2937', emoji: '🏍️' },
  car_muitran:{ id: 'car_muitran', kind: 'car', name: 'Xe Mui Trần Gió Lộng', desc: 'Mở mui đón gió thị trấn', priceXu: 150000, minLevel: 8, speed: 480, color: '#e53935', emoji: '🚗' },
  car_co:     { id: 'car_co',      kind: 'car', name: 'Xe Cổ Sang Chảnh', desc: 'Đồ cổ mui cứng, càng cũ càng chất', priceGem: 20, minLevel: 9, speed: 528, color: '#5d4037', emoji: '🚙' },
  car_sieuxe: { id: 'car_sieuxe',  kind: 'car', name: 'Siêu Xe Tia Chớp', desc: 'Nhanh nhất server, ai cũng ngoái nhìn', priceGem: 40, minLevel: 10, speed: 592, color: '#fdd835', emoji: '🏎️' },
};

export const DAY_LENGTH = 240; // giây = 1 ngày
