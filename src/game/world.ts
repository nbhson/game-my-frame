// ===== Layout thế giới — tách khỏi render để dễ mở map mới =====
export const TILE = 48;
export const WORLD = { w: 1600, h: 1320 };

// Ruộng 45 ô (9 cột x 5 hàng), mở khóa dần từ 6 ô đầu
export const FARM = { x: 40, y: 230, w: 940, h: 460, cols: 9, rows: 5 };
// Đường đất rộng rãi: dọc + ngang (đủ chỗ cho 2 nhân vật + chó mèo đi qua)
export const ROAD_V = { x: 996, w: 70, y0: 0, y1: 1060 }; // 996..1066
export const ROAD_H = { y: 710, h: 70, x0: 0, x1: 1600 }; // 710..780
export function roadVCenter() { return ROAD_V.x + ROAD_V.w / 2; }
export function roadHCenter() { return ROAD_H.y + ROAD_H.h / 2; }
// Ao vuông tự nhiên (không chia ngăn, cá bơi tự do) — top ngang hàng ruộng (y=230)
export const POND = { x: 1080, y: 230, w: 440, h: 380 };
export function pondCenter() {
  return { x: POND.x + POND.w / 2, y: POND.y + POND.h / 2 };
}
/** Vùng bơi bên trong ao (trừ bờ) */
export function pondInner() {
  const c = pondCenter();
  return { ...c, hw: POND.w / 2 - 30, hh: POND.h / 2 - 30 };
}
// Chuồng gà/vịt + trại bò/heo/cừu
export const COOP = { x: 60, y: 790, w: 440, h: 230 };
export const BARN = { x: 540, y: 790, w: 460, h: 230 };
// Sông câu cá (dải nước cuối map, sâu để nhìn đã mắt) + bến câu
export const RIVER = { x: 0, y: 1022, w: 1600, h: 298 };
export const RIVER_WATER_Y = 1062; // từ đây trở xuống là nước (chặn đi) — bãi cát 40px
export const PIERS = [
  { x: 300, sitY: 1046, bobY: 1180 },
  { x: 800, sitY: 1046, bobY: 1180 },
  { x: 1300, sitY: 1046, bobY: 1180 },
];
export const SHOPD = { x: 1150, y: 820, w: 180, h: 140 };
// ---- CỔNG THỊ TRẤN: ngoài cùng BÊN PHẢI, nơi đường ngang kết thúc (cuối đường)
// Người chơi đi bộ tới đây → chuyển sang map thị trấn
export const TOWN_GATE = { x: 1498, y: 702, w: 102, h: 76 };
export function townGateCenter() {
  return { x: TOWN_GATE.x + TOWN_GATE.w / 2, y: TOWN_GATE.y + TOWN_GATE.h / 2 };
}
/** Điểm spawn khi từ thị trấn quay về farm (ngay trên đường, cạnh cổng) */
export const FARM_GATE_SPAWN = { x: 1470, y: 745 };

export function plotPos(i: number) {
  const c = i % FARM.cols, r = Math.floor(i / FARM.cols);
  const cw = FARM.w / FARM.cols, rh = FARM.h / FARM.rows;
  return { x: FARM.x + c * cw + cw / 2, y: FARM.y + r * rh + rh / 2, w: cw - 16, h: rh - 22 };
}

export function isBlocked(x: number, y: number): boolean {
  // ao vuông (trừ bờ)
  if (x > POND.x + 14 && x < POND.x + POND.w - 14 && y > POND.y + 14 && y < POND.y + POND.h - 14) return true;
  // sông
  if (y > RIVER_WATER_Y) return true;
  if (x > SHOPD.x && x < SHOPD.x + SHOPD.w && y > SHOPD.y && y < SHOPD.y + SHOPD.h) return true;
  if (x < 20 || y < 60 || x > WORLD.w - 20 || y > WORLD.h - 20) return true;
  return false;
}

/** Hòm thư trước ao/chuồng: xem thông tin + mở khóa (đặt trên cỏ, né đường đi) */
export const PEN_MB = {
  pond: { x: 1300, y: 656 },
  coop: { x: 280, y: 806 },
  barn: { x: 770, y: 806 },
};
