// ===== NỘI THẤT 11 NHÀ (town 5 + mall 6: casino + gara + shop + vé số + đua + sói) =====
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
  | 'junk' | 'bench' | 'shelf' | 'trophy' | 'rug' | 'plantpot' | 'bedbox'
  | 'cardtable' | 'boardgame' | 'slot' | 'bar' | 'vault' | 'orderboard'
  | 'cattree' | 'tipjar' | 'wheel' | 'bell' | 'radio' | 'drum' | 'disco'
  | 'costume' | 'salebin' | 'photoframe'
  | 'carcatalog' | 'cardisplay' | 'lift' | 'toolboard';
  radius?: number; // bán kính E (mặc định 120)
}

export interface NpcDef {
  id: string; name: string;
  x: number; y: number;
  look: 'elder' | 'barista' | 'clerk' | 'coba' | 'chutam' | 'fan' | 'cat' | 'dealer' | 'guest' | 'mechanic';
  /** màu lông mèo (chỉ look cat) */
  fur?: string;
  lines: string[];
}

export interface InteriorDef {
  id: string; name: string; emoji: string;
  /** bản đồ chứa cửa vào nhà này (thị trấn hay khu mua sắm) */
  via: 'town' | 'mall';
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
    id: 'cafe', via: 'town', name: 'Quán Cà phê Mèo', emoji: '🐱', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#e8b04b', wallDark: '#b97f2a', floorA: '#d9a066', floorB: '#cf9457', floorKind: 'wood',
    furns: [
      { id: 'counter', label: 'Quầy order', x: 80, y: 110, w: 280, h: 95, solid: true, look: 'counter' },
      { id: 'table1', label: 'Bàn số 1 (ngồi nghỉ)', x: 470, y: 170, w: 150, h: 95, solid: true, look: 'table' },
      { id: 'table2', label: 'Bàn số 2 (ngồi nghỉ)', x: 740, y: 170, w: 150, h: 95, solid: true, look: 'table' },
      { id: 'piano', label: 'Đàn piano', x: 800, y: 420, w: 210, h: 115, solid: true, look: 'piano' },
      { id: 'shelf', label: 'Kệ bánh trưng', x: 80, y: 420, w: 180, h: 100, solid: true, look: 'shelf' },
      { id: 'rug', label: 'Thảm mèo', x: 420, y: 430, w: 220, h: 130, solid: false, look: 'rug' },
      { id: 'tipjar', label: 'Hũ tiền tip (ủng hộ mèo)', x: 380, y: 105, w: 80, h: 85, solid: true, look: 'tipjar' },
      { id: 'cattree', label: 'Cây mèo (dụ mèo leo)', x: 290, y: 390, w: 130, h: 160, solid: true, look: 'cattree', radius: 140 },
    ],
    npcs: [
      { id: 'barista', name: 'Bà chủ quán', x: 220, y: 300, look: 'barista', lines: ['Vào quán là phải vuốt mèo, luật quán đó nghen!', 'Cà phê trứng nhà làm — uống xong chạy như bay!', 'Mấy đứa mèo lười lắm, rảnh thì vuốt giùm cô!'] },
      { id: 'quen', name: 'Chị Khách Quen', x: 350, y: 545, look: 'guest', lines: ['Chị ngồi đây từ lúc quán mới mở — ghế này là ghế của chị!', 'Mèo Tam Thể chỉ leo cây cho người nó quý thôi đó!', 'Bỏ tip vô hũ đi em, mèo nó nhớ mặt người hào phóng lắm!'] },
      { id: 'mimi', name: 'Mèo Mimi', x: 530, y: 310, look: 'cat', fur: '#f5f5f5', lines: ['Meo~ (Mimi dụi đầu vào tay bạn)'] },
      { id: 'mun', name: 'Mèo Mun', x: 800, y: 310, look: 'cat', fur: '#3a3a3a', lines: ['... (Mun nhìn bạn bằng nửa con mắt, rồi gừ gừ)'] },
      { id: 'tamt', name: 'Mèo Tam Thể', x: 620, y: 500, look: 'cat', fur: '#e8956b', lines: ['Meo meo! (Tam Thể lăn ra khoe bụng)'] },
    ],
  },
  // ---------------- HỘI QUÁN ----------------
  hall: {
    id: 'hall', via: 'town', name: 'Hội quán Thị trấn', emoji: '🏛️', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#c98f4e', wallDark: '#9a6730', floorA: '#cbb27f', floorB: '#c0a671', floorKind: 'wood',
    furns: [
      { id: 'board', label: 'Bảng nhiệm vụ ngày', x: 400, y: 85, w: 300, h: 70, solid: true, look: 'board' },
      { id: 'donate', label: 'Hòm quyên góp làng', x: 850, y: 140, w: 130, h: 135, solid: true, look: 'donate' },
      { id: 'trophy', label: 'Tủ cúp vàng', x: 120, y: 110, w: 210, h: 90, solid: true, look: 'trophy' },
      { id: 'table1', label: 'Bàn họp làng', x: 380, y: 380, w: 340, h: 110, solid: true, look: 'table' },
      { id: 'bell', label: 'Chuông đồng họp làng', x: 140, y: 400, w: 130, h: 140, solid: true, look: 'bell' },
      { id: 'teatable', label: 'Bàn nước chè (ngồi nghỉ)', x: 770, y: 420, w: 200, h: 110, solid: true, look: 'table' },
    ],
    npcs: [
      { id: 'elder', name: 'Bác hội trưởng', x: 550, y: 300, look: 'elder', lines: ['Zzz... ủa, ai đó? Vô hội quán hả con!', 'Làng mình sống nhờ nhau — rảnh thì góp ít nông sản vô hòm!', 'Bảng nhiệm vụ ngày kia kìa, làm xong làng thưởng hậu!'] },
    ],
  },
  // ---------------- SHOP THỜI TRANG ----------------
  shop: {
    id: 'shop', via: 'mall', name: 'Shop Thời trang', emoji: '👗', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#f2a7c3', wallDark: '#c9759a', floorA: '#efe6f5', floorB: '#e3d3ec', floorKind: 'tile',
    furns: [
      { id: 'rack', label: 'Giá treo đồ (mua sắm)', x: 110, y: 120, w: 250, h: 95, solid: true, look: 'rack' },
      { id: 'mannequin', label: 'Ma-nơ-canh (thử phối đồ)', x: 480, y: 190, w: 130, h: 160, solid: true, look: 'mannequin' },
      { id: 'mirror', label: 'Gương thần', x: 770, y: 120, w: 120, h: 150, solid: true, look: 'mirror' },
      { id: 'rug', label: 'Thảm hồng', x: 400, y: 450, w: 300, h: 140, solid: false, look: 'rug' },
      { id: 'salebin', label: 'Thùng sale (lục đồ rẻ)', x: 120, y: 400, w: 170, h: 140, solid: true, look: 'salebin' },
      { id: 'costume', label: 'Tủ hóa trang (thuê đồ diễn)', x: 760, y: 400, w: 170, h: 150, solid: true, look: 'costume' },
    ],
    npcs: [
      { id: 'clerk', name: 'Chị thu ngân', x: 240, y: 310, look: 'clerk', lines: ['Đồ mới về mỗi tuần đó cưng!', 'Đứng trước gương ngắm là thấy đẹp ra liền!', 'Ma-nơ-canh kia phối đồ giỏi lắm, thử thách nó đi!'] },
      { id: 'stylist', name: 'Anh Stylist', x: 550, y: 505, look: 'guest', lines: ['Nhìn phát biết ngay gu của cưng tới đâu!', 'Muốn nổi thì phải chịu chơi — chấm điểm không nể nang!', 'Thùng sale bên kia hên xui lắm, tay thơm hẵng lục!'] },
    ],
  },
  // ---------------- NHÀ HÁT (sân khấu trong nhà) ----------------
  stage: {
    id: 'stage', via: 'town', name: 'Nhà hát Làng', emoji: '🎤', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#5a3d6e', wallDark: '#3c2750', floorA: '#7a5a3a', floorB: '#6e5234', floorKind: 'stagewood',
    furns: [
      { id: 'stageplat', label: 'Sân khấu (lên diễn)', x: 250, y: 100, w: 600, h: 150, solid: true, look: 'stageplat', radius: 170 },
      { id: 'lights', label: 'Dàn đèn màu', x: 890, y: 110, w: 110, h: 110, solid: true, look: 'lights' },
      { id: 'giftbox', label: 'Hòm hoa khán giả', x: 90, y: 140, w: 120, h: 120, solid: true, look: 'giftbox' },
      { id: 'drum', label: 'Trống hội (đánh lấy hên)', x: 100, y: 430, w: 150, h: 130, solid: true, look: 'drum' },
      { id: 'disco', label: 'Quả cầu disco', x: 850, y: 430, w: 130, h: 130, solid: true, look: 'disco' },
    ],
    npcs: [
      { id: 'fan1', name: 'Khán giả Tí', x: 400, y: 430, look: 'fan', lines: ['Lên diễn đi! Tụi tui vỗ tay gãy tay luôn!'] },
      { id: 'fan2', name: 'Khán giả Tèo', x: 660, y: 430, look: 'fan', lines: ['Hát hay là tui ném hoa, hát dở... cũng ném (cà chua)!'] },
      { id: 'mc', name: 'MC Làng', x: 550, y: 558, look: 'fan', lines: ['Alo alo! Đêm nay ai lên sân khấu là tui giới thiệu hoành tráng!', 'Khán giả đổi màu đèn yêu thích liên tục — để ý mà chiều!', 'Diễn xong diễn tiếp liền là có ENCORE x1.5 tip đó!'] },
    ],
  },
  // ---------------- NHÀ CÔ BA ----------------
  house1: {
    id: 'house1', via: 'town', name: 'Nhà cô Ba', emoji: '🏠', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#e8c98a', wallDark: '#bd9757', floorA: '#d9b078', floorB: '#cfa76e', floorKind: 'wood',
    furns: [
      { id: 'stove', label: 'Bếp củi (nấu ăn)', x: 110, y: 120, w: 230, h: 125, solid: true, look: 'stove' },
      { id: 'cabinet', label: 'Tủ bánh', x: 770, y: 120, w: 180, h: 135, solid: true, look: 'cabinet' },
      { id: 'table1', label: 'Bàn ăn', x: 400, y: 400, w: 300, h: 110, solid: true, look: 'table' },
      { id: 'bedbox', label: 'Chạn bát', x: 110, y: 420, w: 150, h: 110, solid: true, look: 'bedbox' },
      { id: 'orderboard', label: 'Bảng đặt hàng (giao nông sản)', x: 770, y: 400, w: 180, h: 140, solid: true, look: 'orderboard' },
      { id: 'herb', label: 'Chậu rau thơm (hái mỗi ngày)', x: 290, y: 260, w: 110, h: 110, solid: true, look: 'plantpot' },
      { id: 'photo', label: 'Ảnh gia đình', x: 480, y: 55, w: 150, h: 90, solid: true, look: 'photoframe' },
    ],
    npcs: [
      { id: 'coba', name: 'Cô Ba', x: 550, y: 300, look: 'coba', lines: ['Vô bếp phụ cô một tay không con?', 'Nhà cô lúc nào cũng thơm mùi bánh!', 'Có nông sản tươi thì cho cô xin ít, cô quý lắm!'] },
      { id: 'emgai', name: 'Bé Út', x: 300, y: 545, look: 'guest', lines: ['Anh/chị mua kẹo que của em đi, ngon lắm!', 'Em thích nhất là Bánh flan của má Ba làm!', 'Ở trường em kể bạn nghe nhà em có bếp củi thần kỳ!'] },
    ],
  },
  // ---------------- NHÀ CHÚ TÁM ----------------
  house2: {
    id: 'house2', via: 'town', name: 'Nhà chú Tám', emoji: '🏚️', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#a8a29a', wallDark: '#7c766e', floorA: '#b8ab98', floorB: '#ac9f8a', floorKind: 'wood',
    furns: [
      { id: 'junk', label: 'Đống ve chai (bới tìm)', x: 110, y: 130, w: 270, h: 170, solid: true, look: 'junk', radius: 160 },
      { id: 'bench', label: 'Bàn chế đồ', x: 720, y: 130, w: 250, h: 125, solid: true, look: 'bench' },
      { id: 'shelf', label: 'Kệ đồ cổ', x: 110, y: 430, w: 190, h: 100, solid: true, look: 'shelf' },
      { id: 'motor', label: 'Xe máy ve chai (đạp máy)', x: 400, y: 430, w: 220, h: 130, solid: true, look: 'machine' },
      { id: 'radio', label: 'Đài radio (dò sóng)', x: 820, y: 430, w: 150, h: 110, solid: true, look: 'radio' },
    ],
    npcs: [
      { id: 'chutam', name: 'Chú Tám', x: 540, y: 330, look: 'chutam', lines: ['Ve chai là vàng đó con! Bới đi, hên thì trúng mánh!', 'Có ủng cũ rong biển thì bán cho chú, chú mua giá cao!', 'Hồi đó chú chế được cái máy bay... bằng giấy!'] },
      { id: 'nhoc', name: 'Nhóc Ve Chai', x: 250, y: 578, look: 'guest', lines: ['Em lượm ve chai phụ chú Tám, tiền để dành mua diều!', 'Em biết rap về ve chai đó, nghe không?', 'Đố mẹo đi, đúng em thưởng... lời khen!'] },
    ],
  },
  // ---------------- CASINO (sảnh chơi trong nhà) ----------------
  casino: {
    id: 'casino', via: 'mall', name: 'Sảnh Casino', emoji: '🎰', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#4a2a6e', wallDark: '#2e1a4a', floorA: '#5a3d8a', floorB: '#4e3480', floorKind: 'tile',
    furns: [
      { id: 'vault', label: 'Quầy chip (nhận lộc)', x: 80, y: 110, w: 230, h: 115, solid: true, look: 'vault' },
      { id: 'tableTL', label: 'Bàn Tiến Lên (chơi nhanh)', x: 390, y: 105, w: 200, h: 120, solid: true, look: 'cardtable', radius: 150 },
      { id: 'tableBC', label: 'Bàn Bài Cào (chơi nhanh)', x: 670, y: 105, w: 200, h: 120, solid: true, look: 'cardtable', radius: 150 },
      { id: 'tableXD', label: 'Bàn Xì Dách (chơi nhanh)', x: 390, y: 290, w: 200, h: 120, solid: true, look: 'cardtable', radius: 150 },
      { id: 'tableChess', label: 'Bàn Caro & Cờ vua', x: 670, y: 290, w: 200, h: 120, solid: true, look: 'boardgame', radius: 150 },
      { id: 'slot', label: 'Máy slot Xèng (20 xu/lượt)', x: 80, y: 330, w: 170, h: 150, solid: true, look: 'slot', radius: 160 },
      { id: 'bar', label: 'Quầy bar (giải khát)', x: 830, y: 330, w: 200, h: 140, solid: true, look: 'bar' },
      { id: 'rug', label: 'Thảm đỏ', x: 390, y: 480, w: 320, h: 110, solid: false, look: 'rug' },
      { id: 'wheel', label: 'Vòng quay may mắn', x: 430, y: 468, w: 170, h: 150, solid: true, look: 'wheel', radius: 150 },
    ],
    npcs: [
      { id: 'dealer', name: 'Anh Cào Dealer', x: 195, y: 300, look: 'dealer', lines: ['Chào mừng tới sảnh Casino! Bàn nào cũng có máy ngồi chờ sẵn!', 'Máy slot có GIỜ VÀNG x2 jackpot — hỏi cô Đào là biết giờ!', 'Thua thì cười, thắng thì khao cả sảnh nhé!'] },
      { id: 'baove', name: 'Anh Bảo Vệ', x: 950, y: 245, look: 'dealer', lines: ['Sảnh này anh giữ trật tự — quậy là anh... cười!', 'Xe cộ để gọn ngoài bãi, mất anh không đền đâu!', 'Sảnh VIP trong kia kìa, đủ Lv5 hẵng vào cho oách!'] },
      { id: 'guest1', name: 'Chú Tèo', x: 300, y: 545, look: 'guest', lines: ['Tui thua 3 ván liền... nhưng vui! Vui là chính!', 'Bí kíp của tui: cược nhỏ, chơi lâu, cười nhiều!', 'Nghe nói Xì Dách dễ ăn nhất sảnh đó!'] },
      { id: 'guest2', name: 'Cô Đào', x: 800, y: 545, look: 'guest', lines: ['Tui canh giờ vàng slot chuẩn từng giây luôn!', 'Hỏi tui giờ vàng, tui chỉ cho — miễn phí!', 'Hôm qua tui quay trúng 3 sao, cả sảnh hú hét!'] },
    ],
  },
  // ---------------- GARA ANH TÝ (showroom trong nhà, lái xe vào thẳng được) ----------------
  garage: {
    id: 'garage', via: 'mall', name: 'Gara Anh Tý', emoji: '🚗', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#7d8b96', wallDark: '#54616c', floorA: '#9aa5ad', floorB: '#8d99a1', floorKind: 'tile',
    furns: [
      { id: 'catalog', label: 'Quầy catalog (mua xe)', x: 80, y: 110, w: 230, h: 115, solid: true, look: 'carcatalog' },
      { id: 'display1', label: 'Bục Xe Đạp (xem + lái thử)', x: 360, y: 100, w: 170, h: 130, solid: true, look: 'cardisplay', radius: 150 },
      { id: 'display2', label: 'Bục Xe Máy (xem + lái thử)', x: 585, y: 100, w: 170, h: 130, solid: true, look: 'cardisplay', radius: 150 },
      { id: 'display3', label: 'Bục Siêu Xe (xem + lái thử)', x: 810, y: 100, w: 170, h: 130, solid: true, look: 'cardisplay', radius: 150 },
      { id: 'lift', label: 'Cầu nâng (rửa + bảo dưỡng)', x: 110, y: 350, w: 260, h: 160, solid: true, look: 'lift', radius: 160 },
      { id: 'toolboard', label: 'Bảng đồ nghề (thử tay nghề)', x: 790, y: 360, w: 210, h: 130, solid: true, look: 'toolboard' },
      { id: 'rug', label: 'Thảm ca-rô', x: 400, y: 470, w: 300, h: 110, solid: false, look: 'rug' },
    ],
    npcs: [
      { id: 'ty', name: 'Anh Tý chủ gara', x: 195, y: 300, look: 'dealer', lines: ['Vô gara là vô nhà tui đó! Cứ tự nhiên ngắm xe!', 'Xe đạp 10.000 xu là rẻ nhất — học sinh cũng mua nổi!', 'Càng lên đời xe càng nhanh, siêu xe nhanh hơn gấp đôi đi bộ!', 'Lái xe vô thẳng trong này cũng được, đừng tông bục là được!'] },
      { id: 'thomay', name: 'Thợ máy Tèo', x: 880, y: 560, look: 'mechanic', lines: ['Máy nào qua tay tui cũng êm như ru!', 'Cầu nâng kia kìa — rửa xe bóng loáng, bảo dưỡng máy bốc!', 'Bảng đồ nghề là chỗ thử tay nghề, khéo tay là có thưởng!'] },
    ],
  },
  // ---------------- NHÀ VÉ SỐ (khu mua sắm) ----------------
  xoso: {
    id: 'xoso', via: 'mall', name: 'Nhà Vé Số', emoji: '🎫', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#c62828', wallDark: '#7f0000', floorA: '#e8c86a', floorB: '#d9b855', floorKind: 'tile',
    furns: [
      { id: 'counter', label: 'Quầy bán vé (50 xu/vé)', x: 80, y: 110, w: 280, h: 95, solid: true, look: 'counter' },
      { id: 'scratch', label: 'Vé cào ăn liền (20 xu/vé)', x: 740, y: 110, w: 220, h: 120, solid: true, look: 'slot', radius: 150 },
      { id: 'board', label: 'Bảng kết quả các kỳ', x: 400, y: 85, w: 300, h: 70, solid: true, look: 'board' },
      { id: 'tipjar', label: 'Hũ lộc vé số', x: 480, y: 400, w: 140, h: 110, solid: true, look: 'tipjar' },
      { id: 'rug', label: 'Thảm đỏ may mắn', x: 400, y: 500, w: 300, h: 110, solid: false, look: 'rug' },
    ],
    npcs: [
      { id: 'cove', name: 'Cô Vé', x: 220, y: 300, look: 'clerk', lines: ['Vé số đây! 50 xu một vé, trúng độc đắc 3000 xu +1 gem!', 'Vé cào 20 xu cào là biết liền — tay thơm thì hốt!', 'Sổ mỗi 5 phút, mua càng nhiều vé càng dễ trúng!'] },
      { id: 'chuttrung', name: 'Chú Trúng', x: 850, y: 500, look: 'guest', lines: ['Tui trúng độc đắc 1 lần rồi — mua hẳn con trâu!', 'Bí kíp: mua vé số đuôi ngày sinh của... vợ!', 'Cào vé mới là chân ái, 20 xu mà hồi hộp như 2 triệu!'] },
    ],
  },
  // ---------------- NHÀ TRƯỜNG ĐUA (khu mua sắm) ----------------
  racehouse: {
    id: 'racehouse', via: 'mall', name: 'Nhà Trường Đua', emoji: '🏁', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#37474f', wallDark: '#102027', floorA: '#b0bec5', floorB: '#90a4ae', floorKind: 'tile',
    furns: [
      { id: 'board', label: 'Bảng đăng ký đua (tối đa 5)', x: 400, y: 85, w: 300, h: 70, solid: true, look: 'board' },
      { id: 'trophy', label: 'Cúp tay lái vàng', x: 120, y: 110, w: 210, h: 90, solid: true, look: 'trophy' },
      { id: 'bell', label: 'Chuông xuất phát (gõ lấy hên)', x: 770, y: 110, w: 130, h: 140, solid: true, look: 'bell' },
      { id: 'rug', label: 'Thảm caro đích đến', x: 400, y: 470, w: 300, h: 110, solid: false, look: 'rug' },
    ],
    npcs: [
      { id: 'trongtai', name: 'Trọng tài Còi', x: 550, y: 300, look: 'dealer', lines: ['Muốn đua thì đăng ký ở bảng kia — tối đa 5 tay lái một giải!', 'Luật mới: lái xe THẬT quanh track 5 vòng, cán đủ 8 chốt/vòng — ai về đích trước thì thắng!', 'Vô địch +300 xu +1 gem, á quân +150, hạng ba +80!'] },
      { id: 'taydua', name: 'Tay đua Cũ', x: 250, y: 520, look: 'guest', lines: ['Tui từng vô địch 3 giải liền — giờ treo mũ ở đây!', 'Muốn thắng thì ôm cua gọn, đừng cắt góc bỏ chốt là phải quay lại đó!', 'Có xe xịn ngoài đời thì vào đường đua chạy thử cho nóng máy!'] },
    ],
  },
  // ---------------- HANG MA SÓI (khu mua sắm) ----------------
  wolfhouse: {
    id: 'wolfhouse', via: 'mall', name: 'Hang Ma Sói', emoji: '🐺', w: W, h: H,
    spawn: { x: 550, y: 620 }, door: { x: 500, y: 700, w: 100, h: 60 },
    wall: '#2e2e4e', wallDark: '#121224', floorA: '#4a4a6e', floorB: '#3d3d60', floorKind: 'tile',
    furns: [
      { id: 'board', label: 'Bảng luật + lập đội sói', x: 400, y: 85, w: 300, h: 70, solid: true, look: 'board' },
      { id: 'bell', label: 'Chuông đêm (gọi hồn)', x: 140, y: 400, w: 130, h: 140, solid: true, look: 'bell' },
      { id: 'shelf', label: 'Kệ mặt nạ hóa trang', x: 770, y: 120, w: 180, h: 100, solid: true, look: 'shelf' },
      { id: 'rug', label: 'Thảm lông sói', x: 400, y: 470, w: 300, h: 110, solid: false, look: 'rug' },
    ],
    npcs: [
      { id: 'giagia', name: 'Già Làng Bí Ẩn', x: 550, y: 300, look: 'elder', lines: ['Đêm xuống, sói sẽ lộ mặt... ngươi có dám chơi không?', 'Lập đội 5–12 người ở bảng kia, thắng được 300 xu +1 gem!', 'Nhớ: ban ngày bỏ phiếu, ban đêm sói cắn — đừng tin ai!'] },
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
  'Ma lồng đèn bờ sông? Tào lao! Đèn thị trấn chập điện thôi!',
];

// ================= SỰ KIỆN & CƠ CHẾ MỚI TRONG NHÀ (9/10) =================

// Món hôm nay ở cafe (xoay theo ngày ingame): gọi đúng món được x2 XP
export function cafeSpecial(day: number): { id: 'coffee' | 'milk'; name: string } {
  return day % 2 === 0 ? { id: 'coffee', name: 'Cà phê trứng' } : { id: 'milk', name: 'Sữa nóng' };
}

// Đố vui thời trang ở shop (xoay theo ngày) — trả lời đúng +30 xu +3 XP
export interface ShopQuiz { q: string; opts: string[]; answer: number }
export const SHOP_QUIZZES: ShopQuiz[] = [
  { q: 'Mốt năm nay của làng mình là gì?', opts: ['Quần rách gối... vá lại!', 'Áo 7 màu chói lọi', 'Đội nón lá ngược'], answer: 0 },
  { q: 'Đi thăm ruộng nên mang gì?', opts: ['Giày cao gót', 'Ủng lội bùn', 'Dép tổ ong rách'], answer: 1 },
  { q: 'Màu nào "sang" nhất khi đi casino?', opts: ['Xanh lá cây', 'Đen lịch lãm', 'Hồng cánh sen'], answer: 1 },
];

// Đơn đặt hàng nhà cô Ba: mỗi ngày 1 đơn (nguyên liệu thô -> thưởng 150% giá bán + XP)
export interface HouseOrder { pid: string; n: number }
const ORDER_POOL: HouseOrder[] = [
  { pid: 'trung', n: 3 }, { pid: 'sua', n: 2 }, { pid: 'caixanh', n: 4 },
  { pid: 'cachua', n: 3 }, { pid: 'thit', n: 2 }, { pid: 'trung', n: 4 },
  { pid: 'sua', n: 3 },
];
export function houseOrderOf(day: number): HouseOrder {
  return ORDER_POOL[((day % ORDER_POOL.length) + ORDER_POOL.length) % ORDER_POOL.length];
}

// Máy slot Xèng trong casino
export const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎'];
export const SLOT_PAY: Record<string, number> = { '🍒': 40, '🍋': 60, '🔔': 100, '⭐': 150, '💎': 300 };
export const SLOT_COST = 20;
export const SLOT_PAIR = 15; // 1 đôi bất kỳ an ủi
// Giờ vàng slot: mỗi 5 phút có 45s x2 jackpot
export const GOLDEN_PERIOD = 300000;
export const GOLDEN_LEN = 45000;
export function goldenActive(now = Date.now()): boolean {
  return (now % GOLDEN_PERIOD) < GOLDEN_LEN;
}
export function goldenIn(now = Date.now()): number {
  const r = now % GOLDEN_PERIOD;
  return r < GOLDEN_LEN ? 0 : GOLDEN_PERIOD - r;
}

// Quầy bar casino: giải khát lấy hên
export interface BarDrink { id: string; name: string; price: number; xp: number; tip: string }
export const BAR_MENU: BarDrink[] = [
  { id: 'water', name: 'Nước lọc may mắn — 5 xu', price: 5, xp: 1, tip: 'Uống cho tỉnh táo gỡ gạc!' },
  { id: 'orange', name: 'Nước cam VIP — 30 xu', price: 30, xp: 4, tip: 'Ngọt lịm, hên cả buổi!' },
  { id: 'wine', name: 'Rượu nho thượng hạng — 60 xu', price: 60, xp: 8, tip: 'Uống xong đỏ đen cũng đỏ!' },
];

// Bàn chơi nhanh trong casino -> game tương ứng
export const TABLE_GAME: Record<string, 'tienlen' | 'baicao' | 'xidach'> = {
  tableTL: 'tienlen', tableBC: 'baicao', tableXD: 'xidach',
};
export const TABLE_BETS = [20, 50, 100];
export const TABLE_META: Record<string, { name: string; emoji: string }> = {
  tableTL: { name: 'Tiến Lên', emoji: '🃏' },
  tableBC: { name: 'Bài Cào', emoji: '🎴' },
  tableXD: { name: 'Xì Dách', emoji: '🎩' },
};

// Màu đèn khán giả yêu cầu ở sân khấu (xoay mỗi 3 phút): diễn đúng màu +30% tip
export const STAGE_REQUESTS: { color: string; name: string }[] = [
  { color: '#ffd24d', name: 'Vàng' }, { color: '#ff5b5b', name: 'Đỏ' },
  { color: '#5bff8a', name: 'Xanh lá' }, { color: '#5bb8ff', name: 'Xanh dương' },
  { color: '#c58aff', name: 'Tím' },
];
export function stageRequestAt(now = Date.now()): { color: string; name: string } {
  return STAGE_REQUESTS[Math.floor(now / 180000) % STAGE_REQUESTS.length];
}

// Giờ diễn mèo ở cafe (mỗi 150s): đang trong quán được xem + thưởng
export const CAT_SHOW_PERIOD = 150000;

// Chuyện làng bên bàn nước chè (hội quán)
export const GOSSIP_LINES = [
  'Nghe nói cụ Sáu trúng mẻ dưa to, cười cả tuần chưa khép miệng!',
  'Bờ sông dạo này cá to lắm — ai siêng câu người đó giàu!',
  'Chú Tám vừa chế được cái đèn... chớp 3 màu, cả xóm qua coi!',
  'Cô Ba đang tuyển "chuột bạch" thử món mới — ăn free đó!',
  'Casino mới có máy slot, cô Đào canh giờ vàng chuẩn từng giây!',
  'Hội quán sắp thi hái dưa cuối tuần — giải nhất to lắm!',
];

// Ảnh gia đình nhà cô Ba
export const PHOTO_LINES = [
  'Ảnh cưới cô Ba chú Ba: hai đứa cười tít, chú Ba còn để tóc bổ luống!',
  'Ảnh bé Út lúc 3 tuổi ôm con gà, gà sợ hơn bé!',
  'Ảnh cả nhà đi hội làng: cô Ba bưng mâm bánh to nhất hội!',
];

// Tin tức đài radio nhà chú Tám
export const RADIO_NEWS = [
  '📻 "Dự báo: ngày mai nắng đẹp, hợp gieo hạt, phơi thóc!" (+2 XP)',
  '📻 "Giá nông sản lên xuống thất thường, bà con bình tĩnh chốt lời!" (+2 XP)',
  '📻 "Tìm thấy con diều rách bay qua 3 xã — chủ nhân lên nhận!" (+2 XP)',
  '📻 "Nhắc nhỏ: tưới nước đều, cây khô là khóc!" (+2 XP)',
  '📻 "Quán cà phê mèo tuyển người vuốt mèo chuyên nghiệp!" (+2 XP)',
];

// Đố mẹo của Nhóc Ve Chai (xoay theo ngày)
export interface Riddle { q: string; opts: string[]; answer: number }
export const NHOC_RIDDLES: Riddle[] = [
  { q: 'Cái gì càng rửa càng bẩn?', opts: ['Chén bát', 'Nước', 'Tay chân'], answer: 1 },
  { q: 'Con gì đập thì sống, không đập thì chết?', opts: ['Con tim', 'Con gà', 'Con muỗi'], answer: 0 },
  { q: 'Nhà chú Tám nhiều nhất là gì?', opts: ['Tiền', 'Ve chai', 'Gà'], answer: 1 },
];

// Vòng quay may mắn casino: 50 xu/lượt (free 1 lần/ngày)
export const WHEEL_COST = 50;
export interface WheelPrize { w: number; label: string }
export const WHEEL_PRIZES: WheelPrize[] = [
  { w: 30, label: '+15 xu' }, { w: 25, label: '+40 xu' }, { w: 15, label: '+2 mồi xịn' },
  { w: 12, label: '+2 cám xịn' }, { w: 8, label: '+100 xu' }, { w: 6, label: '+4 XP' },
  { w: 3, label: '+1 GEM' }, { w: 1, label: 'JACKPOT +300 xu' },
];

// Dấu hành trình: ghé đủ nhà trong ngày (tự đếm theo INTERIORS) -> 150 xu + 1 gem
export const STAMP_REWARD_XU = 150;
