// ===== Layout CÔNG VIÊN — map chung cho mọi người gặp nhau realtime =====
// Cùng kích thước logic với farm (1600x1320) để tái dùng camera/zoom.
// Bố cục anime: quảng trường trung tâm + đài phun nước, xung quanh là
// hội quán / quán cafe / shop lưu niệm / nhà dân / cây anh đào / đèn / ghế đá.
export const TOWN = { w: 1600, h: 1320 };

// Quảng trường lát đá tròn ở giữa
export const PLAZA = { x: 800, y: 640, r: 300 };
// Đài phun nước trung tâm
export const FOUNTAIN = { x: 800, y: 640, r: 78 };
// Bảng chào công viên (đầu đường vào từ farm)
export const TOWN_BOARD = { x: 250, y: 640 };
// Cổng về farm: mép TRÁI cùng map (đối xứng cổng farm ở mép phải farm)
export const FARM_GATE = { x: 0, y: 602, w: 86, h: 78 };
export function farmGateCenter() {
  return { x: FARM_GATE.x + FARM_GATE.w / 2, y: FARM_GATE.y + FARM_GATE.h / 2 };
}
/** Điểm spawn khi từ farm bước vào công viên (trên đường chính, cạnh cổng) */
export const TOWN_SPAWN = { x: 150, y: 700 };

// Nhà cửa anime quanh quảng trường
export const TOWN_HALL = { x: 620, y: 170, w: 360, h: 220 }; // hội quán lớn (bắc)
export const TOWN_CAFE = { x: 180, y: 220, w: 260, h: 190 }; // quán cafe (tây-bắc)
export const TOWN_SHOP = { x: 1160, y: 220, w: 260, h: 190 }; // shop lưu niệm (đông-bắc)
// Casino: phía đông-bắc, dưới shop lưu niệm, trên đường ngang (không lấn đường)
export const TOWN_CASINO = { x: 1130, y: 436, w: 290, h: 150 };
export function casinoCenter() {
  return { x: TOWN_CASINO.x + TOWN_CASINO.w / 2, y: TOWN_CASINO.y + TOWN_CASINO.h / 2 };
}
/** Điểm đứng chơi casino (trên đường ngang, trước cửa) */
export const CASINO_DOOR = { x: TOWN_CASINO.x + TOWN_CASINO.w / 2, y: TOWN_CASINO.y + TOWN_CASINO.h + 30 };
export const TOWN_HOUSE1 = { x: 170, y: 920, w: 240, h: 180 }; // nhà dân
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
  // nhà cửa (kể cả casino)
  for (const b of [TOWN_HALL, TOWN_CAFE, TOWN_SHOP, TOWN_HOUSE1, TOWN_HOUSE2, TOWN_CASINO]) {
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

/** Props tương tác trong công viên */
export const TOWN_PROPS: { id: string; x: number; y: number; label: string; hint: string }[] = [
  { id: 'fountain', x: FOUNTAIN.x, y: FOUNTAIN.y + FOUNTAIN.r + 26, label: 'Đài phun nước', hint: 'Ước một điều! Tung 10 xu xuống đài phun?' },
  { id: 'board', x: TOWN_BOARD.x, y: TOWN_BOARD.y, label: 'Bảng chào công viên', hint: 'Chào mừng tới Công viên Nông Trại — nơi mọi nông dân gặp nhau!' },
  { id: 'hall', x: TOWN_HALL.x + TOWN_HALL.w / 2, y: TOWN_HALL.y + TOWN_HALL.h + 30, label: 'Hội quán', hint: 'Hội quán công viên: sự kiện cuối tuần, bảng xếp hạng mùa vụ!' },
  { id: 'cafe', x: TOWN_CAFE.x + TOWN_CAFE.w / 2, y: TOWN_CAFE.y + TOWN_CAFE.h + 30, label: 'Quán Cà phê Mèo', hint: 'Thơm quá! Ngồi nhâm nhi, tám chuyện với cả làng.' },
  { id: 'shop', x: TOWN_SHOP.x + TOWN_SHOP.w / 2, y: TOWN_SHOP.y + TOWN_SHOP.h + 30, label: 'Shop Lưu niệm', hint: 'Shop lưu niệm: đổi gem lấy đồ trang trí (sắp mở)!' },
  { id: 'casino', x: TOWN_CASINO.x + TOWN_CASINO.w / 2, y: TOWN_CASINO.y + TOWN_CASINO.h + 30, label: 'Casino', hint: 'Tiến lên • Bài cào • Xì dách • Caro • Cờ vua — cược 10-100 xu/ván!' },
  { id: 'stage', x: TOWN_STAGE.x + TOWN_STAGE.w / 2, y: TOWN_STAGE.y - 20, label: 'Sân khấu', hint: 'Sân khấu sự kiện: leo lên nhảy múa, thi thố cùng bạn bè!' },
];

/** Cảm xúc realtime ở công viên (emoji hiện trên đầu 4s, cả làng thấy) */
export const TOWN_EMOTES: { id: string; emoji: string; label: string }[] = [
  { id: 'wave', emoji: '👋', label: 'Vẫy tay' },
  { id: 'laugh', emoji: '😂', label: 'Cười' },
  { id: 'heart', emoji: '❤️', label: 'Thả tim' },
  { id: 'clap', emoji: '👏', label: 'Vỗ tay' },
  { id: 'dance', emoji: '💃', label: 'Nhảy' },
  { id: 'cool', emoji: '😎', label: 'Ngầu' },
  { id: 'sleep', emoji: '😴', label: 'Buồn ngủ' },
  { id: 'angry', emoji: '😠', label: 'Giận' },
];
