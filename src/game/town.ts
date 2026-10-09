// ===== Layout THỊ TRẤN — map chung cho mọi người gặp nhau realtime =====
// Cùng kích thước logic với farm (1600x1320) để tái dùng camera/zoom.
// Bố cục anime: quảng trường trung tâm + đài phun nước, xung quanh là
// hội quán / quán cafe / shop lưu niệm / nhà dân / cây anh đào / đèn / ghế đá.
export const TOWN = { w: 1600, h: 1320 };

// Quảng trường lát đá tròn ở giữa
export const PLAZA = { x: 800, y: 640, r: 300 };
// Đài phun nước trung tâm
export const FOUNTAIN = { x: 800, y: 640, r: 78 };
// Cổng về farm: mép TRÁI cùng map (đối xứng cổng farm ở mép phải farm)
export const FARM_GATE = { x: 0, y: 602, w: 86, h: 78 };
export function farmGateCenter() {
  return { x: FARM_GATE.x + FARM_GATE.w / 2, y: FARM_GATE.y + FARM_GATE.h / 2 };
}
/** Điểm spawn khi từ farm bước vào thị trấn (trên đường chính, cạnh cổng) */
export const TOWN_SPAWN = { x: 150, y: 700 };

// Nhà cửa anime quanh quảng trường (gara/casino/shop/vé số đã dọn sang Khu mua sắm & giải trí ở đông-bắc)
export const TOWN_HALL = { x: 620, y: 170, w: 360, h: 220 }; // hội quán lớn (bắc)
export const TOWN_CAFE = { x: 180, y: 220, w: 260, h: 190 }; // quán cafe (tây-bắc)
// Cổng lên Khu mua sắm & giải trí: góc ĐÔNG-BẮC (đi hết đường ngang rồi rẽ lên lối đá mới)
export const MALL_GATE = { x: 1470, y: 130, w: 90, h: 90 };
export function mallGateCenter() {
  return { x: MALL_GATE.x + MALL_GATE.w / 2, y: MALL_GATE.y + MALL_GATE.h / 2 };
}
// Vườn hoa trung tâm: lấp chỗ gara cũ phía tây (đi dạo được, không chặn)
export const TOWN_GARDEN = { x: 90, y: 700, w: 280, h: 200 };
export const TOWN_HOUSE1 = { x: 110, y: 1000, w: 240, h: 180 }; // nhà dân góc tây-nam (cửa ở y=1210, đi lại thoải mái; cách gara ~100px)
export const TOWN_HOUSE2 = { x: 1190, y: 920, w: 240, h: 180 }; // nhà dân
export const TOWN_STAGE = { x: 660, y: 1020, w: 280, h: 110 }; // sân khấu sự kiện (nam)

// Cây anh đào trang trí
export const SAKURA_SPOTS = [
  { x: 480, y: 420 }, { x: 1120, y: 420 }, { x: 380, y: 820 },
  { x: 1220, y: 820 }, { x: 800, y: 220 }, { x: 150, y: 550 },
  { x: 1450, y: 550 }, { x: 560, y: 1080 }, { x: 1040, y: 1080 },
];
// Đèn đường quanh quảng trường
export const LAMP_SPOTS = [
  { x: 560, y: 480 }, { x: 1040, y: 480 }, { x: 560, y: 800 },
  { x: 1040, y: 800 }, { x: 800, y: 380 }, { x: 800, y: 900 },
  { x: 320, y: 640 }, { x: 1280, y: 640 },
];
// Ghế đá
export const BENCH_SPOTS = [
  { x: 620, y: 560, flip: false }, { x: 980, y: 560, flip: true },
  { x: 620, y: 730, flip: false }, { x: 980, y: 730, flip: true },
];

export function isTownBlocked(x: number, y: number): boolean {
  // đài phun nước (trừ vành ngoài để đứng ngắm)
  if (Math.hypot(x - FOUNTAIN.x, y - FOUNTAIN.y) < FOUNTAIN.r - 6) return true;
  // nhà cửa còn lại (gara/casino/shop đã chuyển sang khu mua sắm)
  for (const b of [TOWN_HALL, TOWN_CAFE, TOWN_HOUSE1, TOWN_HOUSE2]) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  // sân khấu: chặn leo lên (đứng dưới xem)
  if (x > TOWN_STAGE.x && x < TOWN_STAGE.x + TOWN_STAGE.w && y > TOWN_STAGE.y && y < TOWN_STAGE.y + TOWN_STAGE.h) return true;
  // cây anh đào (gốc)
  for (const s of SAKURA_SPOTS) {
    if (Math.hypot(x - s.x, y - s.y) < 16) return true;
  }
  // đèn đường (cột)
  for (const l of LAMP_SPOTS) {
    if (Math.hypot(x - l.x, y - l.y) < 10) return true;
  }
  if (x < 20 || y < 60 || x > TOWN.w - 20 || y > TOWN.h - 20) return true;
  return false;
}

/** Props tương tác trong thị trấn */
export const TOWN_PROPS: { id: string; x: number; y: number; label: string; hint: string }[] = [
  { id: 'fountain', x: FOUNTAIN.x, y: FOUNTAIN.y + FOUNTAIN.r + 26, label: 'Đài phun nước', hint: 'Ước một điều! Tung 10 xu xuống đài phun?' },
  { id: 'hall', x: TOWN_HALL.x + TOWN_HALL.w / 2, y: TOWN_HALL.y + TOWN_HALL.h + 30, label: 'Hội quán', hint: 'Hội quán thị trấn: sự kiện cuối tuần, bảng xếp hạng mùa vụ!' },
  { id: 'cafe', x: TOWN_CAFE.x + TOWN_CAFE.w / 2, y: TOWN_CAFE.y + TOWN_CAFE.h + 30, label: 'Quán Cà phê Mèo', hint: 'Thơm quá! Ngồi nhâm nhi, tám chuyện với cả làng.' },
  { id: 'garden', x: TOWN_GARDEN.x + TOWN_GARDEN.w / 2, y: TOWN_GARDEN.y + TOWN_GARDEN.h / 2, label: 'Vườn hoa', hint: 'Vườn hoa mới trồng thay bãi xe cũ — ngồi đây hít hà, +2 XP mỗi ngày!' },
  { id: 'stage', x: TOWN_STAGE.x + TOWN_STAGE.w / 2, y: TOWN_STAGE.y - 20, label: 'Sân khấu', hint: 'Sân khấu sự kiện: leo lên nhảy múa, thi thố cùng bạn bè!' },
  { id: 'house1', x: TOWN_HOUSE1.x + TOWN_HOUSE1.w / 2, y: TOWN_HOUSE1.y + TOWN_HOUSE1.h + 30, label: 'Nhà cô Ba', hint: 'Nhà cô Ba: nghe đồn trong nhà có kho bánh thần thánh!' },
  { id: 'house2', x: TOWN_HOUSE2.x + TOWN_HOUSE2.w / 2, y: TOWN_HOUSE2.y + TOWN_HOUSE2.h + 30, label: 'Nhà chú Tám', hint: 'Nhà chú Tám: ông trùm chế đồ tái chế, vào xem thử!' },
];

/** Cảm xúc realtime ở thị trấn (emoji hiện trên đầu 4s, cả làng thấy) */
export const TOWN_EMOTES: { id: string; emoji: string; label: string }[] = [
  { id: 'wave', emoji: '👋', label: 'Vẫy tay' },
  { id: 'laugh', emoji: '😂', label: 'Cười' },
  { id: 'heart', emoji: '❤️', label: 'Thả tim' },
  { id: 'clap', emoji: '👏', label: 'Vỗ tay' },
  { id: 'dance', emoji: '💃', label: 'Nhảy' },
  { id: 'cool', emoji: '😎', label: 'Ngầu' },
  { id: 'sleep', emoji: '😴', label: 'Buồn ngủ' },
  { id: 'angry', emoji: '😠', label: 'Giận' },
  // --- hành động đôi / troll cạnh thanh chat ---
  // Mẹo: 2 người đứng gần nhau + cùng bấm 1 hành động → nhân vật THỰC SỰ
  // lao vào nhau diễn hoạt ảnh (đánh nhau, ôm, bắt tay, hun, chào)
  { id: 'hun', emoji: '💋', label: 'Hun gió' },
  { id: 'hug', emoji: '🤗', label: 'Ôm cái' },
  { id: 'handshake', emoji: '🤝', label: 'Bắt tay' },
  { id: 'fight', emoji: '🥊', label: 'Đánh yêu' },
  { id: 'tease', emoji: '🤪', label: 'Chọc quê' },
];
