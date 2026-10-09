// ===== Layout KHU MUA SẮM & GIẢI TRÍ — map chung thứ 2, nằm ĐÔNG-BẮC thị trấn =====
// Cùng kích thước logic với farm/town (1600x1320) để tái dùng camera/zoom.
// Gara + casino + shop lưu niệm + vé số dạo dọn từ thị trấn sang đây, thêm:
// sông câu cá (thi câu cá tổ chức ở đây), trường đua xe (tối đa 5 người),
// hang ma sói, nhà vé số, trung tâm mua sắm.
export const MALL = { w: 1600, h: 1320 };

// Cổng về thị trấn: mép TRÁI (đối xứng cổng farm ở thị trấn)
export const MALL_TOWN_GATE = { x: 0, y: 602, w: 86, h: 78 };
export function mallTownGateCenter() {
  return { x: MALL_TOWN_GATE.x + MALL_TOWN_GATE.w / 2, y: MALL_TOWN_GATE.y + MALL_TOWN_GATE.h / 2 };
}
/** Điểm spawn khi từ thị trấn bước vào khu mua sắm (trên đường chính, cạnh cổng) */
export const MALL_SPAWN = { x: 150, y: 700 };

// Quảng trường ánh sáng ở giữa (nhỏ hơn quảng trường thị trấn)
export const MALL_PLAZA = { x: 800, y: 640, r: 220 };

// Gara Anh Tý dọn sang: showroom phía tây-bắc
export const MALL_GARAGE = { x: 90, y: 150, w: 280, h: 200 };
export const MALL_DEALER = { x: 390, y: 267 };
// Trung tâm mua sắm (shop lưu niệm + thời trang): bắc, giữa
export const MALL_MART = { x: 560, y: 150, w: 480, h: 190 };
// Casino dọn sang: đông-bắc
export const MALL_CASINO = { x: 1130, y: 150, w: 290, h: 150 };
// Nhà Vé Số (mới): tây, dưới gara — bán vé + vé cào + bảng kết quả
export const MALL_XOSO = { x: 180, y: 420, w: 260, h: 170 };
// Hang Ma Sói (mới): góc trống phía tây-nam, cạnh sông — vào đăng ký ván ma sói 5–12 người
export const MALL_WOLF = { x: 70, y: 800, w: 250, h: 170 };
// Nhà Trường Đua (mới): đông — đăng ký giải đua xe tối đa 5 người
export const MALL_RACE = { x: 1180, y: 400, w: 260, h: 190 };
// Ông bán vé số dạo: đứng cạnh nhà vé số, hướng ra quảng trường
export const MALL_LOTTERY = { x: 500, y: 560 };
// Đường đua ngoài trời: CIRCUIT uốn lượn qua khu trung tâm (rộng, quanh co, có S-cua + hairpin)
// Tim đường khép kín, xuất phát từ vạch đích (đường thẳng phía nam) chạy về hướng đông
export const MALL_TRACK = { x: 1000, y: 660, w: 460, h: 300 }; // (giữ để tương thích, không dùng vẽ nữa)
export const RACE_LINE = [
  { x: 950, y: 950 }, { x: 1200, y: 950 }, { x: 1390, y: 905 }, { x: 1470, y: 790 },
  { x: 1420, y: 665 }, { x: 1230, y: 650 }, { x: 1050, y: 660 }, { x: 900, y: 690 },
  { x: 835, y: 790 }, { x: 865, y: 895 },
];
/** VÒNG ĐUA: 10 chốt đặt trên tim đường, xuất phát/đích ở đường thẳng phía nam */
export const RACE_CPS = [...RACE_LINE];
export const RACE_CP_R = 55;
export const RACE_LAPS = 5;
/** nửa rộng mặt nhựa (vẽ) + nửa rộng cho phép xe chạy (trừ lề 8px) */
export const RACE_ROAD_HALF = 55;
export const RACE_DRIVE_HALF = 47;
/** Ô xuất phát cho slot 0–4 (xếp 2 hàng sau vạch đích, đã kiểm tra nằm trên đường + ngoài chốt 0) */
export function raceGridSlot(i: number) {
  const slots = [
    { x: 830, y: 845 }, { x: 855, y: 870 }, { x: 840, y: 895 },
    { x: 865, y: 910 }, { x: 885, y: 925 },
  ];
  return slots[((i % slots.length) + slots.length) % slots.length];
}

/** khoảng cách từ điểm tới đoạn thẳng */
function distSeg(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - a.x) * dx + (py - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** khoảng cách từ điểm tới tim vòng đua (vòng khép kín) */
export function distToRaceLine(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < RACE_LINE.length; i++) {
    const d = distSeg(x, y, RACE_LINE[i], RACE_LINE[(i + 1) % RACE_LINE.length]);
    if (d < best) best = d;
  }
  return best;
}

/** Xe có đang trên mặt đường đua không. Dùng để KHÓA tay lái trong vòng track suốt giải. */
export function isOnRaceTrack(x: number, y: number): boolean {
  return distToRaceLine(x, y) <= RACE_DRIVE_HALF;
}

// ---------- lấy điểm trên vòng đua (dùng chung cho vẽ đường + xe bot) ----------
const LOOP_SEGS = RACE_LINE.map((p, i) => {
  const q = RACE_LINE[(i + 1) % RACE_LINE.length];
  return { ax: p.x, ay: p.y, bx: q.x, by: q.y, len: Math.hypot(q.x - p.x, q.y - p.y) };
});
export const RACE_LOOP_TOTAL = LOOP_SEGS.reduce((s, g) => s + g.len, 0);
/** điểm trên vòng tại khoảng cách d (tự quấn vòng) + góc tiếp tuyến (hướng chạy) */
export function raceLoopPoint(d: number): { x: number; y: number; ang: number } {
  let dd = ((d % RACE_LOOP_TOTAL) + RACE_LOOP_TOTAL) % RACE_LOOP_TOTAL;
  for (const g of LOOP_SEGS) {
    if (dd <= g.len) {
      const k = g.len ? dd / g.len : 0;
      return { x: g.ax + (g.bx - g.ax) * k, y: g.ay + (g.by - g.ay) * k, ang: Math.atan2(g.by - g.ay, g.bx - g.ax) };
    }
    dd -= g.len;
  }
  const g0 = LOOP_SEGS[0];
  return { x: g0.ax, y: g0.ay, ang: Math.atan2(g0.by - g0.ay, g0.bx - g0.ax) };
}

// Sông câu cá phía nam (giống sông farm): mặt nước + 3 bến + cầu gỗ giữa
export const MALL_RIVER = { x: 0, y: 1022, w: 1600, h: 110 };
export const MALL_BRIDGE = { x: 740, y: 1000, w: 120, h: 155 };
export const MALL_PIERS = [
  { x: 300, sitY: 986, bobY: 1075 },
  { x: 800, sitY: 986, bobY: 1075 },
  { x: 1300, sitY: 986, bobY: 1075 },
];

// Cây anh đào + đèn + ghế đá trang trí
export const MALL_SAKURA = [
  { x: 480, y: 300 }, { x: 1120, y: 300 }, { x: 120, y: 640 },
  { x: 1200, y: 800 }, { x: 620, y: 880 }, { x: 980, y: 870 },
  { x: 450, y: 950 }, { x: 1520, y: 980 },
];
export const MALL_LAMPS = [
  { x: 560, y: 480 }, { x: 1040, y: 480 }, { x: 560, y: 800 },
  { x: 1050, y: 880 }, { x: 800, y: 380 }, { x: 780, y: 910 },
  { x: 320, y: 640 }, { x: 1150, y: 800 },
];
export const MALL_BENCHES = [
  { x: 640, y: 560, flip: false }, { x: 960, y: 560, flip: true },
  { x: 640, y: 730, flip: false }, { x: 1150, y: 850, flip: true },
];

export function isMallBlocked(x: number, y: number): boolean {
  // ông bán vé số đứng cố định
  if (Math.hypot(x - MALL_LOTTERY.x, y - MALL_LOTTERY.y) < 18) return true;
  // anh Tý bán xe đứng ở cửa bãi
  if (Math.hypot(x - MALL_DEALER.x, y - MALL_DEALER.y) < 18) return true;
  // nhà cửa (gara + mart + casino + vé số + ma sói + trường đua)
  for (const b of [MALL_GARAGE, MALL_MART, MALL_CASINO, MALL_XOSO, MALL_WOLF, MALL_RACE]) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  // sông: chặn xuống nước, trừ dải cầu gỗ ở giữa
  if (y > MALL_RIVER.y && y < MALL_RIVER.y + MALL_RIVER.h) {
    if (x < MALL_BRIDGE.x || x > MALL_BRIDGE.x + MALL_BRIDGE.w) return true;
  }
  // cây anh đào (gốc)
  for (const s of MALL_SAKURA) {
    if (Math.hypot(x - s.x, y - s.y) < 16) return true;
  }
  // đèn đường (cột)
  for (const l of MALL_LAMPS) {
    if (Math.hypot(x - l.x, y - l.y) < 10) return true;
  }
  if (x < 20 || y < 60 || x > MALL.w - 20 || y > MALL.h - 20) return true;
  return false;
}

/** Props tương tác ở khu mua sắm & giải trí */
export const MALL_PROPS: { id: string; x: number; y: number; label: string; hint: string }[] = [
  { id: 'garage', x: MALL_GARAGE.x + MALL_GARAGE.w / 2, y: MALL_GARAGE.y + MALL_GARAGE.h + 30, label: 'Gara Anh Tý', hint: 'Dọn sang khu mới khang trang! Xe đạp chỉ từ 10.000 xu — lái xe vào thẳng cũng được!' },
  { id: 'mart', x: MALL_MART.x + MALL_MART.w / 2, y: MALL_MART.y + MALL_MART.h + 30, label: 'Trung tâm Mua sắm', hint: 'Shop lưu niệm + thời trang: áo quần nón tóc giày phụ kiện cánh bằng xu/gem!' },
  { id: 'casino', x: MALL_CASINO.x + MALL_CASINO.w / 2, y: MALL_CASINO.y + MALL_CASINO.h + 30, label: 'Sảnh Casino', hint: 'Vào trong chơi Tiến lên • Bài cào • Xì dách • Caro • Cờ vua + máy slot giờ vàng!' },
  { id: 'xoso', x: MALL_XOSO.x + MALL_XOSO.w / 2, y: MALL_XOSO.y + MALL_XOSO.h + 30, label: 'Nhà Vé Số', hint: 'Mua vé 50 xu, cào vé 20 xu trúng liền! Sổ mỗi 5 phút — ĐB 3000 xu +1 gem!' },
  { id: 'lottery', x: MALL_LOTTERY.x, y: MALL_LOTTERY.y + 34, label: 'Ông bán vé số', hint: 'Vé 2 số 50 xu — sổ mỗi 5 phút! Trúng 2 số ăn 3000 xu +1 gem!' },
  { id: 'wolf', x: MALL_WOLF.x + MALL_WOLF.w / 2, y: MALL_WOLF.y + MALL_WOLF.h + 30, label: 'Hang Ma Sói', hint: 'Vào hang lập đội 5–12 người: đêm hành động, ngày bỏ phiếu!' },
  { id: 'race', x: MALL_RACE.x + MALL_RACE.w / 2, y: MALL_RACE.y + MALL_RACE.h + 30, label: 'Nhà Trường Đua', hint: 'Đăng ký giải đua xe tối đa 5 người! Vô địch +300 xu +1 gem!' },
  { id: 'track', x: 1010, y: 1005, label: 'Đường đua', hint: 'Circuit quanh co 10 chốt! Lái xe chạy thử vài vòng cho nóng máy — muốn thi đấu thì vào Nhà Trường Đua.' },
  { id: 'bridge', x: MALL_BRIDGE.x + MALL_BRIDGE.w / 2, y: MALL_BRIDGE.y + MALL_BRIDGE.h + 16, label: 'Cầu gỗ', hint: 'Cầu gỗ bắc qua sông — đứng đây ngắm cá quẫy!' },
];
