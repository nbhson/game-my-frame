// ===== NỘI THẤT 6 NHÀ (trừ casino): phòng đi lại được, đồ đạc + NPC tương tác =====
// Mỗi interior: sàn 1100x760, cửa ở đáy giữa, đồ solid va chạm, NPC đứng yên + idle anim.
// Hành động tốn/tặng vật phẩm-XU thật (ăn sâu kinh tế), không còn popup bấm-cho-vui.
import type { InteractTarget } from './types';

export interface FurnDef {
  id: string; label: string;
  x: number; y: number; w: number; h: number;
  solid: boolean;
  /** kiểu vẽ trong interiorRender */
  look: 'counter' | 'table' | 'stove' | 'cabinet' | 'piano' | 'rack' | 'mirror'
  | 'mannequin' | 'machine' | 'board' | 'donate' | 'stageplat' | 'lights' | 'giftbox'
  | 'junk' | 'bench' | 'shelf' | 'trophy' | 'rug' | 'plantpot' | 'bedbox';
  radius?: number; // bán kính E (mặc định 120)
}

export interface NpcDef {
  id: string; name: string;
  x: number; y: number;
  look: 'elder' | 'barista' | 'clerk' | 'coba' | 'chutam' | 'fan' | 'cat';
  /** màu lông mèo (chỉ look cat) */
  fur?: string;
  lines: string[];
}

export interface InteriorDef {
  id: string; name: string; emoji: string;
  w: number; h: number;
  spawn: { x: number; y: number };
  door: { x: number; y: number; w: number; h: number };
  wall: string; wallDark: string; floorA: string; floorB: string;
  floorKind: 'wood' | 'tile' | 'stagewood';
  furns: FurnDef[];
  npcs: NpcDef[];
}

const W = 1100, H = 760;

export const INTERIORS: Record<string, InteriorDef> = {
  // ---------------- QUÁN CÀ PHÊ MÈO ----------------
  cafe: {
    id: 'cafe', name: 'Quán Cà phê Mèo', emoji: '🐱', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#e8b04b', wallDark: '#b97f2a', floorA: '#d9a066', floorB: '#cf9457', floorKind: 'wood',
    furns: [
      { id: 'counter', label: 'Quầy order', x: 80, y: 110, w: 280, h: 95, solid: true, look: 'counter' },
      { id: 'table1', label: 'Bàn số 1 (ngồi nghỉ)', x: 470, y: 170, w: 150, h: 95, solid: true, look: 'table' },
      { id: 'table2', label: 'Bàn số 2 (ngồi nghỉ)', x: 740, y: 170, w: 150, h: 95, solid: true, look: 'table' },
      { id: 'piano', label: 'Đàn piano', x: 800, y: 420, w: 210, h: 115, solid: true, look: 'piano' },
      { id: 'shelf', label: 'Kệ bánh trưng', x: 80, y: 420, w: 180, h: 100, solid: true, look: 'shelf' },
      { id: 'rug', label: 'Thảm mèo', x: 420, y: 430, w: 220, h: 130, solid: false, look: 'rug' },
    ],
    npcs: [
      { id: 'barista', name: 'Bà chủ quán', x: 220, y: 300, look: 'barista', lines: ['Vào quán là phải vuốt mèo, luật quán đó nghen!', 'Cà phê trứng nhà làm — uống xong chạy như bay!', 'Mấy đứa mèo lười lắm, rảnh thì vuốt giùm cô!'] },
      { id: 'mimi', name: 'Mèo Mimi', x: 530, y: 310, look: 'cat', fur: '#f5f5f5', lines: ['Meo~ (Mimi dụi đầu vào tay bạn)'] },
      { id: 'mun', name: 'Mèo Mun', x: 800, y: 310, look: 'cat', fur: '#3a3a3a', lines: ['... (Mun nhìn bạn bằng nửa con mắt, rồi gừ gừ)'] },
      { id: 'tamt', name: 'Mèo Tam Thể', x: 620, y: 500, look: 'cat', fur: '#e8956b', lines: ['Meo meo! (Tam Thể lăn ra khoe bụng)'] },
    ],
  },
  // ---------------- HỘI QUÁN ----------------
  hall: {
    id: 'hall', name: 'Hội quán Công viên', emoji: '🏛️', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#c98f4e', wallDark: '#9a6730', floorA: '#cbb27f', floorB: '#c0a671', floorKind: 'wood',
    furns: [
      { id: 'board', label: 'Bảng nhiệm vụ ngày', x: 400, y: 85, w: 300, h: 70, solid: true, look: 'board' },
      { id: 'donate', label: 'Hòm quyên góp làng', x: 850, y: 140, w: 130, h: 135, solid: true, look: 'donate' },
      { id: 'trophy', label: 'Tủ cúp vàng', x: 120, y: 110, w: 210, h: 90, solid: true, look: 'trophy' },
      { id: 'table1', label: 'Bàn họp làng', x: 380, y: 380, w: 340, h: 110, solid: true, look: 'table' },
    ],
    npcs: [
      { id: 'elder', name: 'Bác hội trưởng', x: 550, y: 300, look: 'elder', lines: ['Zzz... ủa, ai đó? Vô hội quán hả con!', 'Làng mình sống nhờ nhau — rảnh thì góp ít nông sản vô hòm!', 'Bảng nhiệm vụ ngày kia kìa, làm xong làng thưởng hậu!'] },
    ],
  },
  // ---------------- SHOP THỜI TRANG ----------------
  shop: {
    id: 'shop', name: 'Shop Thời trang', emoji: '👗', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#f2a7c3', wallDark: '#c9759a', floorA: '#efe6f5', floorB: '#e3d3ec', floorKind: 'tile',
    furns: [
      { id: 'rack', label: 'Giá treo đồ (mua sắm)', x: 110, y: 120, w: 250, h: 95, solid: true, look: 'rack' },
      { id: 'mannequin', label: 'Ma-nơ-canh (thử phối đồ)', x: 480, y: 190, w: 130, h: 160, solid: true, look: 'mannequin' },
      { id: 'mirror', label: 'Gương thần', x: 770, y: 120, w: 120, h: 150, solid: true, look: 'mirror' },
      { id: 'rug', label: 'Thảm hồng', x: 400, y: 450, w: 300, h: 140, solid: false, look: 'rug' },
    ],
    npcs: [
      { id: 'clerk', name: 'Chị thu ngân', x: 240, y: 310, look: 'clerk', lines: ['Đồ mới về mỗi tuần đó cưng!', 'Đứng trước gương ngắm là thấy đẹp ra liền!', 'Ma-nơ-canh kia phối đồ giỏi lắm, thử thách nó đi!'] },
    ],
  },
  // ---------------- NHÀ HÁT (sân khấu trong nhà) ----------------
  stage: {
    id: 'stage', name: 'Nhà hát Làng', emoji: '🎤', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#5a3d6e', wallDark: '#3c2750', floorA: '#7a5a3a', floorB: '#6e5234', floorKind: 'stagewood',
    furns: [
      { id: 'stageplat', label: 'Sân khấu (lên diễn)', x: 250, y: 100, w: 600, h: 150, solid: true, look: 'stageplat', radius: 170 },
      { id: 'lights', label: 'Dàn đèn màu', x: 890, y: 110, w: 110, h: 110, solid: true, look: 'lights' },
      { id: 'giftbox', label: 'Hòm hoa khán giả', x: 90, y: 140, w: 120, h: 120, solid: true, look: 'giftbox' },
    ],
    npcs: [
      { id: 'fan1', name: 'Khán giả Tí', x: 400, y: 430, look: 'fan', lines: ['Lên diễn đi! Tụi tui vỗ tay gãy tay luôn!'] },
      { id: 'fan2', name: 'Khán giả Tèo', x: 660, y: 430, look: 'fan', lines: ['Hát hay là tui ném hoa, hát dở... cũng ném (cà chua)!'] },
    ],
  },
  // ---------------- NHÀ CÔ BA ----------------
  house1: {
    id: 'house1', name: 'Nhà cô Ba', emoji: '🏠', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#e8c98a', wallDark: '#bd9757', floorA: '#d9b078', floorB: '#cfa76e', floorKind: 'wood',
    furns: [
      { id: 'stove', label: 'Bếp củi (nấu ăn)', x: 110, y: 120, w: 230, h: 125, solid: true, look: 'stove' },
      { id: 'cabinet', label: 'Tủ bánh', x: 770, y: 120, w: 180, h: 135, solid: true, look: 'cabinet' },
      { id: 'table1', label: 'Bàn ăn', x: 400, y: 400, w: 300, h: 110, solid: true, look: 'table' },
      { id: 'bedbox', label: 'Chạn bát', x: 110, y: 420, w: 150, h: 110, solid: true, look: 'bedbox' },
    ],
    npcs: [
      { id: 'coba', name: 'Cô Ba', x: 550, y: 300, look: 'coba', lines: ['Vô bếp phụ cô một tay không con?', 'Nhà cô lúc nào cũng thơm mùi bánh!', 'Có nông sản tươi thì cho cô xin ít, cô quý lắm!'] },
    ],
  },
  // ---------------- NHÀ CHÚ TÁM ----------------
  house2: {
    id: 'house2', name: 'Nhà chú Tám', emoji: '🏚️', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#a8a29a', wallDark: '#7c766e', floorA: '#b8ab98', floorB: '#ac9f8a', floorKind: 'wood',
    furns: [
      { id: 'junk', label: 'Đống ve chai (bới tìm)', x: 110, y: 130, w: 270, h: 170, solid: true, look: 'junk', radius: 160 },
      { id: 'bench', label: 'Bàn chế đồ', x: 720, y: 130, w: 250, h: 125, solid: true, look: 'bench' },
      { id: 'shelf', label: 'Kệ đồ cổ', x: 110, y: 430, w: 190, h: 100, solid: true, look: 'shelf' },
    ],
    npcs: [
      { id: 'chutam', name: 'Chú Tám', x: 540, y: 330, look: 'chutam', lines: ['Ve chai là vàng đó con! Bới đi, hên thì trúng mánh!', 'Có ủng cũ rong biển thì bán cho chú, chú mua giá cao!', 'Hồi đó chú chế được cái máy bay... bằng giấy!'] },
    ],
  },
};

// ---------- va chạm: tường biên + đồ solid ----------
export function isInteriorBlocked(id: string, x: number, y: number): boolean {
  const d = INTERIORS[id];
  if (!d) return true;
  if (x < 40 || y < 130 || x > d.w - 40 || y > d.h - 30) return true;
  // cửa: luôn đi được để ra ngoài
  const dr = d.door;
  if (x > dr.x - 10 && x < dr.x + dr.w + 10 && y > dr.y - 20 && y < d.h) return false;
  for (const f of d.furns) {
    if (!f.solid) continue;
    if (x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) return true;
  }
  // NPC: chạm nhẹ thì đẩy (bán kính 26)
  for (const n of d.npcs) {
    if (Math.hypot(x - n.x, y - n.y) < 26) return true;
  }
  return false;
}

// ---------- quét tương tác gần nhất trong phòng ----------
export function nearestInteriorInteract(id: string, px: number, py: number): InteractTarget | null {
  const d = INTERIORS[id];
  if (!d) return null;
  let best: InteractTarget | null = null;
  let bestD = Infinity;
  const consider = (x: number, y: number, t: InteractTarget, r: number) => {
    const dd = Math.hypot(px - x, py - y);
    if (dd < r && dd < bestD) { bestD = dd; best = t; }
  };
  // cửa ra (ưu tiên thấp)
  consider(d.door.x + d.door.w / 2, d.door.y + 10, { kind: 'interior', propId: 'door', label: `Ra ngoài (${d.name})` }, 110);
  for (const f of d.furns) {
    if (f.look === 'rug') continue;
    consider(f.x + f.w / 2, f.y + f.h / 2, { kind: 'interior', propId: f.id, label: f.label }, f.radius ?? 130);
  }
  for (const n of d.npcs) {
    const isCat = n.look === 'cat';
    consider(n.x, n.y, { kind: 'interior', propId: 'npc:' + n.id, label: (isCat ? 'Vuốt ve ' : 'Trò chuyện: ') + n.name }, 120);
  }
  return best;
}

// ================= NỘI DUNG KINH TẾ =================

// Công thức bếp cô Ba: nguyên liệu -> món (bán cao hơn tổng vốn ~1.6-1.8x)
export interface Recipe { id: string; needs: Record<string, number>; xp: number; tip: string }
export const RECIPES: Recipe[] = [
  { id: 'flan', needs: { trung: 1, sua: 1 }, xp: 15, tip: 'Trứng + Sữa → béo ngậy' },
  { id: 'saladtron', needs: { caixanh: 2, cachua: 1 }, xp: 18, tip: 'Rau tươi giòn rụm' },
  { id: 'thitkho', needs: { thit: 1, trung: 2 }, xp: 25, tip: 'Món mặn hao cơm' },
];

// Bàn chế chú Tám: nâng mồi/cám thường lên xịn
export const BENCH: Recipe[] = [
  { id: 'baitPro', needs: { bait: 4 }, xp: 8, tip: '4 mồi thường + 10 xu công chế' },
  { id: 'feedPro', needs: { feed: 3 }, xp: 8, tip: '3 cám thường + 10 xu công chế' },
];
export const BENCH_FEE = 10;

// Nhiệm vụ ngày ở bảng hội quán (dùng Stats + snapshot lúc nhận)
export interface DailyQuest { id: string; name: string; stat: 'harvested' | 'fished' | 'fed'; need: number; xu: number; xp: number }
export const DAILIES: DailyQuest[] = [
  { id: 'dl_harvest', name: 'Thu hoạch 5 nông sản', stat: 'harvested', need: 5, xu: 150, xp: 20 },
  { id: 'dl_fish', name: 'Câu 2 con cá sông', stat: 'fished', need: 2, xu: 200, xp: 25 },
  { id: 'dl_feed', name: 'Cho 5 con vật ăn', stat: 'fed', need: 5, xu: 120, xp: 15 },
];

// Hòm quyên góp: mỗi 5 nông sản -> điểm = 120% giá bán; mốc quà làng
export const FUND_MILESTONES: { points: number; label: string; reward: string }[] = [
  { points: 2000, label: 'Làng ấm no I', reward: '5 mồi ngon' },
  { points: 8000, label: 'Làng ấm no II', reward: '5 cám cao cấp + 1 gem' },
  { points: 20000, label: 'Làng ấm no III', reward: '3 gem + 500 xu' },
];

// Tình cảm cô Ba: tặng nông sản -> mốc quà
export const LOVE_MILESTONES: { love: number; label: string; reward: string }[] = [
  { love: 10, label: 'Khách quen', reward: '2 Bánh flan' },
  { love: 25, label: 'Con nuôi cô Ba', reward: '5 mồi ngon + 1 gem' },
  { love: 50, label: 'Truyền nhân bếp củi', reward: '1 Thịt kho trứng + 3 gem' },
];

// Khen của gương thần / chuyện chú Tám (vui là chính)
export const MIRROR_LINES = [
  'Gương kia ngự ở trên tường, nông dân ta đẹp nhất làng hôm nay!',
  'Da rám nắng là da nhà nông chính hiệu — đẹp!',
  'Hôm nay bạn cười rất tươi, giữ nguyên nhé!',
  'Phong thái chủ farm lớn, ai nhìn cũng nể!',
];
export const TAM_STORIES = [
  'Hồi trẻ chú lặn xuống sông mò được... cái nồi thủng! Giờ nó là nồi cơm của nhà đó!',
  'Con diều rách kia từng bay qua 3 xã — chú thề!',
  'Ma lồng đèn bờ sông? Tào lao! Đèn công viên chập điện thôi!',
];
