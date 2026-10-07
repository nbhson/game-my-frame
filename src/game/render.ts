// ===== Detailed farm renderer — canvas 2D vẽ tay toàn bộ, không dùng ảnh ngoài =====
// Triết lý: mỗi khu (ruộng / chuồng gà / trại bò / ao / sông / shop) có nền riêng,
// nhà cửa, đạo cụ, hiệu ứng sống động + thể hiện rõ 5 giai đoạn phát triển cây
// và 3 giai đoạn lớn của vật nuôi (non -> tơ -> trưởng thành).
import { ANIMALS, CROPS, FISHES, MAX_POND, SHIRTS, plotReq } from './data';
import type { Animal, CoopCap, Plot, PondFish } from './types';
import { BARN, COOP, FARM, PEN_MB, PIERS, POND, RIVER, RIVER_WATER_Y, SHOPD, TILE, WORLD, plotPos } from './world';
import { animalPos, fishPos } from './systems';

export interface VisitorDraw {
  x: number; y: number; dir: number; moving: boolean;
  name: string; avatar: number; bubble?: string; bubbleAt?: number;
  self?: boolean;
}

export interface RenderState {
  plots: Plot[];
  pondSlots: number;
  fishes: PondFish[];
  animals: Animal[];
  coopCap: CoopCap;
  player: { x: number; y: number; dir: number; moving: boolean; tx: number | null; ty: number | null; name: string };
  avatar: number;
  dayTime: number;
  visitors?: VisitorDraw[];
  selfBubble?: string;
  sit?: { x: number; y: number; bx: number; by: number; bite: boolean } | null;
}

// ---------- helpers ----------
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 12, color = '#fff') {
  ctx.font = `bold ${size}px 'Be Vietnam Pro', monospace`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
/** hash giả ngẫu nhiên ổn định theo seed — dùng để rải cỏ/đá không nhấp nháy */
function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000;
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cropStage(p: number): number {
  if (p < 0.15) return 0; // nảy mầm
  if (p < 0.38) return 1; // cây non
  if (p < 0.62) return 2; // trưởng thành
  if (p < 0.88) return 3; // ra hoa / trái non
  return 4; // chín
}
function cropStageName(p: number): string {
  return ['Nảy mầm', 'Cây non', 'Tươi tốt', 'Ra hoa', 'Đã chín'][cropStage(p)];
}

// ---------- bảng gỗ treo tên khu ----------
function drawWoodSign(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, t: number, accent = '#8b5a2b') {
  const w = ctx.measureText(text).width;
  void w;
  ctx.font = `bold 12px 'Be Vietnam Pro', monospace`;
  const tw = Math.min(300, ctx.measureText(text).width + 30);
  const bob = Math.sin(t * 1.4 + cx * 0.01) * 1.2;
  const yy = y + bob;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ell(ctx, cx, yy + 16, tw / 2, 5);
  // 2 dây treo
  ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 12, yy - 14); ctx.lineTo(cx - tw / 2 + 12, yy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + tw / 2 - 12, yy - 14); ctx.lineTo(cx + tw / 2 - 12, yy); ctx.stroke();
  // bảng
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(cx - tw / 2 - 2, yy - 2, tw + 4, 22);
  ctx.fillStyle = accent; ctx.fillRect(cx - tw / 2, yy, tw, 18);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(cx - tw / 2, yy, tw, 5);
  // đinh
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.arc(cx - tw / 2 + 7, yy + 9, 2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + tw / 2 - 7, yy + 9, 2, 0, 7); ctx.fill();
  txt(ctx, text, cx, yy + 14, 12, '#fff8e1');
}

// ---------- hòm thư chi tiết ----------
function drawMailbox(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number, label: string) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ell(ctx, X, Y + 20, 14, 5);
  // cột gỗ có vân
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(X - 4, Y - 4, 8, 24);
  ctx.fillStyle = '#4e342e'; ctx.fillRect(X - 4, Y - 4, 2, 24);
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(X + 1, Y - 4, 2, 24);
  // đế đá
  ctx.fillStyle = '#9e9e9e'; ctx.fillRect(X - 8, Y + 16, 16, 5);
  ctx.fillStyle = '#757575'; ctx.fillRect(X - 8, Y + 19, 16, 2);
  // thân hộp thư
  ctx.fillStyle = '#0d47a1'; ctx.fillRect(X - 15, Y - 24, 30, 19);
  ctx.fillStyle = '#1565c0'; ctx.fillRect(X - 15, Y - 24, 30, 7);
  ctx.fillStyle = '#eceff1'; ctx.fillRect(X - 15, Y - 10, 30, 3);
  ctx.fillStyle = '#90caf9'; ctx.fillRect(X - 15, Y - 24, 4, 19);
  // nắp cong
  ctx.fillStyle = '#082c6c';
  ctx.beginPath(); ctx.ellipse(X, Y - 24, 15, 6, 0, Math.PI, 0); ctx.fill();
  // khe thư + tay nắm
  ctx.fillStyle = '#002171'; ctx.fillRect(X - 10, Y - 14, 20, 3);
  ctx.fillStyle = '#ffeb3b'; ctx.fillRect(X - 2, Y - 13, 4, 5);
  // cờ đỏ vẫy theo gió
  const wave = Math.sin(t * 3.2) * 2;
  ctx.fillStyle = '#5d4037'; ctx.fillRect(X + 13, Y - 36, 3, 14);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(X + 13, Y - 36 + wave * 0.3, 13, 7);
  ctx.fillStyle = '#ff8a80'; ctx.fillRect(X + 13, Y - 36 + wave * 0.3, 13, 2);
  // phong bì lơ lửng + lấp lánh
  const fy = Y - 28 + Math.sin(t * 2.2) * 2.5;
  ctx.font = '15px serif'; ctx.textAlign = 'center';
  ctx.fillText('✉️', X - 3, fy);
  if (Math.sin(t * 4) > 0.4) { ctx.font = '10px serif'; ctx.fillText('✨', X + 12, fy - 8); }
  txt(ctx, label, X, Y + 32, 9, '#fff8e1');
}

// ============================================================
//  NỀN CỎ + ĐƯỜNG ĐẤT
// ============================================================
function drawGrassBase(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, H: number, t: number) {
  ctx.fillStyle = '#79c14d';
  ctx.fillRect(0, 0, W, H);
  const x0 = Math.floor(cam.x / TILE) * TILE, y0 = Math.floor(cam.y / TILE) * TILE;
  for (let gx = x0; gx < cam.x + W + TILE; gx += TILE) {
    for (let gy = y0; gy < cam.y + H + TILE; gy += TILE) {
      const odd = (Math.round(gx / TILE) + Math.round(gy / TILE)) % 2 === 0;
      ctx.fillStyle = odd ? '#7cc74f' : '#74bd47';
      ctx.fillRect(gx - cam.x, gy - cam.y, TILE, TILE);
      // mảng cỏ loang
      const h = hash2(gx, gy);
      if (h > 0.62) {
        ctx.fillStyle = 'rgba(46,125,50,.12)';
        ell(ctx, gx - cam.x + h * 40, gy - cam.y + (1 - h) * 40, 16, 9);
      }
    }
  }
  // bụi cỏ 3 lá + hoa dại + đá + cỏ 4 lá (deterministic, không nhấp nháy)
  for (let i = 0; i < 160; i++) {
    const fx = (i * 211.7) % WORLD.w, fy = (i * 349.3) % WORLD.h;
    if (fx > 20 && fx < 1040 && fy > 210 && fy < 750) continue; // tránh ruộng
    if (fx > 1050 && fx < 1560 && fy > 200 && fy < 660) continue; // tránh ao
    if (fx > 30 && fx < 1030 && fy > 760 && fy < 1050) continue; // tránh chuồng
    if (fy > 1010 && fy < 1200) continue; // sông
    if (fx > 1120 && fx < 1360 && fy > 790 && fy < 990) continue; // shop
    const X = fx - cam.x, Y = fy - cam.y;
    if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
    const h = hash2(i, 7);
    // bụi cỏ
    ctx.strokeStyle = h > 0.5 ? '#558b2f' : '#33691e';
    ctx.lineWidth = 2;
    const sway = Math.sin(t * 1.6 + i) * 1.5;
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 3 + sway, Y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 2, Y); ctx.lineTo(X + 2 + sway, Y - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 4, Y); ctx.lineTo(X + 7 + sway, Y - 7); ctx.stroke();
    if (i % 4 === 0) {
      // hoa dại
      ctx.fillStyle = '#33691e'; ctx.fillRect(X + 8, Y - 9, 2, 9);
      ctx.fillStyle = ['#ff5252', '#ffeb3b', '#ffffff', '#e1bee7'][i % 4];
      ctx.beginPath(); ctx.arc(X + 9, Y - 11, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(X + 9, Y - 11, 1.2, 0, 7); ctx.fill();
    } else if (i % 9 === 0) {
      // đá nhỏ
      ctx.fillStyle = '#b0bec5';
      ell(ctx, X, Y - 1, 5, 3.4);
      ctx.fillStyle = '#eceff1';
      ell(ctx, X - 1.5, Y - 2, 1.8, 1.2);
    } else if (i % 17 === 0) {
      // nấm dại
      ctx.fillStyle = '#efebe9'; ctx.fillRect(X - 1, Y - 7, 3, 7);
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(X + 0.5, Y - 7, 4.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(X - 1, Y - 10, 1.6, 1.6); ctx.fillRect(X + 2, Y - 9, 1.4, 1.4);
    }
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  // đường ngang + đường dọc
  const drawStrip = (x: number, y: number, w: number, h: number) => {
    const X = x - cam.x, Y = y - cam.y;
    ctx.fillStyle = '#c49a52'; ctx.fillRect(X - 3, Y - 3, w + 6, h + 6); // viền
    ctx.fillStyle = '#d7b56d'; ctx.fillRect(X, Y, w, h);
    ctx.fillStyle = '#cfa85f'; ctx.fillRect(X, Y, w, 6);
  };
  drawStrip(0, 735, WORLD.w, 48);
  drawStrip(1015, 0, 40, 1060);
  // vệt bánh xe + sỏi
  ctx.fillStyle = 'rgba(120,80,30,.35)';
  for (let x = 0; x < WORLD.w; x += 40) {
    ctx.fillRect(x - cam.x, 747 - cam.y, 20, 5);
    ctx.fillRect(x - cam.x, 766 - cam.y, 20, 5);
  }
  for (let i = 0; i < 46; i++) {
    const px = (i * 173) % WORLD.w, py = 738 + ((i * 97) % 42);
    ctx.fillStyle = i % 2 ? '#b78c4a' : '#e0c184';
    ell(ctx, px - cam.x, py - cam.y, 3, 2);
  }
  // cỏ ven đường đung đưa
  ctx.strokeStyle = '#558b2f'; ctx.lineWidth = 2;
  for (let x = 0; x < WORLD.w; x += 64) {
    const sway = Math.sin(t * 2 + x * 0.05) * 2;
    const X = x - cam.x;
    ctx.beginPath(); ctx.moveTo(X, 735 - cam.y); ctx.lineTo(X + sway, 727 - cam.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 20, 783 - cam.y); ctx.lineTo(X + 20 + sway, 791 - cam.y); ctx.stroke();
  }
  // biển chỉ đường
  const sx = 1052 - cam.x, sy = 700 - cam.y;
  ctx.fillStyle = '#5d4037'; ctx.fillRect(sx - 3, sy, 6, 40);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(sx - 44, sy - 18, 88, 22);
  ctx.fillStyle = '#a06a35'; ctx.fillRect(sx - 44, sy - 18, 88, 5);
  txt(ctx, '← RUỘNG · AO →', sx, sy - 3, 8, '#fff8e1');
}

// ---------- hàng rào gỗ ----------
function drawFence(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }) {
  const post = (x: number, y: number) => {
    const X = x - cam.x, Y = y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, X + 1, Y + 14, 7, 3);
    ctx.fillStyle = '#5d4037'; ctx.fillRect(X - 5, Y - 6, 10, 22);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(X - 5, Y - 6, 4, 22);
    ctx.fillStyle = '#4e342e'; ctx.fillRect(X - 6, Y - 9, 12, 5);
    ctx.fillStyle = '#a06a35'; ctx.fillRect(X - 6, Y - 9, 12, 2);
  };
  const rail = (x: number, y: number, w: number) => {
    const X = x - cam.x, Y = y - cam.y;
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(X, Y, w, 7);
    ctx.fillStyle = '#a06a35'; ctx.fillRect(X, Y, w, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(X, Y + 5, w, 2);
  };
  // quanh ruộng
  const fx0 = FARM.x - 16, fy0 = FARM.y - 20, fx1 = FARM.x + FARM.w + 16, fy1 = FARM.y + FARM.h + 14;
  rail(fx0, fy0, fx1 - fx0); rail(fx0, fy1, fx1 - fx0);
  for (let x = fx0; x <= fx1; x += 44) { post(x, fy0 + 2); post(x, fy1 + 2); }
  for (let y = fy0; y <= fy1; y += 44) {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(fx0 - cam.x, y - cam.y, 7, 30); ctx.fillRect(fx1 - cam.x, y - cam.y, 7, 30);
  }
  for (let y = fy0; y <= fy1; y += 44) { post(fx0 + 2, y + 8); post(fx1 + 2, y + 8); }
  // cổng ruộng
  const gx = FARM.x + FARM.w / 2 - cam.x, gy = FARM.y + FARM.h + 14 - cam.y;
  ctx.fillStyle = '#4e342e'; ctx.fillRect(gx - 26, gy - 22, 8, 26); ctx.fillRect(gx + 18, gy - 22, 8, 26);
  ctx.fillStyle = '#ffca28'; ctx.fillRect(gx - 26, gy - 26, 52, 8);
  txt(ctx, 'FARM', gx, gy - 19, 8, '#4e342e');
  // rào chuồng / trại (mặt trước + cọc)
  for (let x = COOP.x - 10; x < COOP.x + COOP.w + 10; x += 36) post(x, COOP.y - 12);
  rail(COOP.x - 10, COOP.y - 12, COOP.w + 20);
  for (let x = BARN.x - 10; x < BARN.x + BARN.w + 10; x += 36) post(x, BARN.y - 12);
  rail(BARN.x - 10, BARN.y - 12, BARN.w + 20);
}

// ============================================================
//  RUỘNG — 5 GIAI ĐOẠN CÂY
// ============================================================
function drawPlotSoil(ctx: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, watered: boolean, t: number, idx: number) {
  // bóng + khung gỗ
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(X - w / 2 + 3, Y - h / 2 + 5, w, h);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(X - w / 2 - 3, Y - h / 2 - 3, w + 6, h + 6);
  // nền đất
  const base = watered ? '#4a2c14' : '#7a5230';
  ctx.fillStyle = base; ctx.fillRect(X - w / 2, Y - h / 2, w, h);
  // luống (4 rãnh)
  for (let r = 0; r < 4; r++) {
    const ry = Y - h / 2 + 7 + r * ((h - 12) / 4);
    ctx.fillStyle = watered ? '#33200e' : '#5e3c1f';
    ctx.fillRect(X - w / 2 + 5, ry, w - 10, 7);
    ctx.fillStyle = watered ? 'rgba(120,180,255,.25)' : 'rgba(255,235,200,.25)';
    ctx.fillRect(X - w / 2 + 5, ry, w - 10, 2);
  }
  // sỏi + cục đất
  for (let k = 0; k < 5; k++) {
    const hsh = hash2(idx * 13, k * 31);
    const px = X - w / 2 + 6 + hsh * (w - 12);
    const py = Y - h / 2 + 6 + hash2(k, idx) * (h - 12);
    ctx.fillStyle = watered ? '#2e1c0c' : '#8d6e63';
    ell(ctx, px, py, 2.2, 1.6);
  }
  if (watered) {
    // giọt nước lấp lánh
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + idx);
    ctx.fillStyle = `rgba(130,200,255,${0.35 + tw * 0.3})`;
    ell(ctx, X - w / 2 + 10, Y - h / 2 + 8, 7, 2.5);
    ell(ctx, X + w / 4, Y + h / 2 - 8, 9, 2.5);
  } else {
    // nứt nẻ khi khô
    ctx.strokeStyle = 'rgba(40,20,5,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X - 12, Y - 4); ctx.lineTo(X - 2, Y + 1); ctx.lineTo(X + 6, Y - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 2, Y + 10); ctx.lineTo(X + 12, Y + 13); ctx.stroke();
  }
}

/** Vẽ cây theo từng loại + giai đoạn 0..4. Gốc tại (cx, baseY). */
function drawCropPlant(ctx: CanvasRenderingContext2D, cx: number, baseY: number, cropId: string, stage: number, t: number, seed: number) {
  const sway = Math.sin(t * 1.8 + seed * 1.7) * (stage >= 2 ? 1.6 : 0.8);
  ctx.lineCap = 'round';
  const leaf = (x: number, y: number, len: number, ang: number, col: string, w = 5) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.6, y + Math.sin(ang) * len * 0.6 - 3, x + Math.cos(ang) * len + sway * 0.4, y + Math.sin(ang) * len);
    ctx.stroke();
  };
  const stem = (h: number, col = '#2e7d32', w = 4) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(cx + sway * 0.4, baseY - h * 0.6, cx + sway, baseY - h); ctx.stroke();
  };
  const dot = (x: number, y: number, r: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const glowDot = (x: number, y: number, r: number, c: string) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 7); ctx.fill();
  };

  if (stage === 0) {
    // GĐ1 nảy mầm: 2 lá mầm ôm hạt
    stem(9, '#388e3c', 3);
    leaf(cx, baseY - 8, 8, Math.PI * 1.15, '#66bb6a', 4);
    leaf(cx, baseY - 8, 8, Math.PI * 1.85, '#66bb6a', 4);
    dot(cx + sway * 0.3, baseY - 11, 2.5, '#a5d6a7');
    return;
  }
  if (stage === 1) {
    // GĐ2 cây non: thân + 4 lá
    stem(20, '#2e7d32', 4);
    leaf(cx, baseY - 10, 10, Math.PI * 1.2, '#43a047');
    leaf(cx, baseY - 10, 10, Math.PI * 1.8, '#43a047');
    leaf(cx, baseY - 16, 9, Math.PI * 1.35, '#66bb6a', 4);
    leaf(cx, baseY - 16, 9, Math.PI * 1.65, '#66bb6a', 4);
    dot(cx + sway, baseY - 21, 3, '#81c784');
    return;
  }
  // từ GĐ3 trở đi vẽ thân chính + tán theo loại cây
  const H = stage === 2 ? 26 : stage === 3 ? 30 : 32;
  switch (cropId) {
    case 'lua': { // lúa: chùm 6 nhánh mảnh, bông rủ khi chín
      for (let k = -2; k <= 2; k++) {
        ctx.strokeStyle = stage >= 4 ? '#c9a227' : '#7cb342'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx, baseY);
        ctx.quadraticCurveTo(cx + k * 4, baseY - H * 0.6, cx + k * 5 + sway, baseY - H - (k % 2) * 4); ctx.stroke();
        if (stage >= 3) {
          const gx = cx + k * 5 + sway, gy = baseY - H - (k % 2) * 4;
          ctx.fillStyle = stage >= 4 ? '#fdd835' : '#dcedc8';
          ell(ctx, gx, gy + 4, 2.4, 5);
          if (stage === 3) dot(gx, gy, 2, '#fff');
        }
      }
      break;
    }
    case 'bap': { // bắp: thân cao + lá dài + trái bắp
      stem(H + 8, '#33691e', 6);
      leaf(cx, baseY - 14, 16, Math.PI * 1.15, '#558b2f', 6);
      leaf(cx, baseY - 18, 16, Math.PI * 1.85, '#558b2f', 6);
      leaf(cx, baseY - 26, 13, Math.PI * 1.3, '#7cb342', 5);
      if (stage >= 3) {
        // râu bắp
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx + sway, baseY - H - 6); ctx.lineTo(cx + sway + 3, baseY - H - 12); ctx.stroke();
        // trái bắp ôm thân
        ctx.fillStyle = stage >= 4 ? '#ffb300' : '#dce775';
        ell(ctx, cx + 8 + sway * 0.5, baseY - 16, 5, 9);
        ctx.fillStyle = 'rgba(51,105,30,.85)';
        ell(ctx, cx + 8 + sway * 0.5, baseY - 16, 2, 9);
        if (stage >= 4) { dot(cx + 8, baseY - 22, 2, '#ffeb3b'); dot(cx + 10, baseY - 18, 2, '#ffeb3b'); }
      }
      break;
    }
    case 'carot': { // cà rốt: lá xẻ + vai củ cam khi lớn
      stem(18, '#2e7d32', 3.5);
      for (let k = 0; k < 5; k++) leaf(cx, baseY - 14, 12, Math.PI * (1.1 + k * 0.2), k % 2 ? '#43a047' : '#66bb6a', 3.5);
      if (stage >= 3) {
        ctx.fillStyle = stage >= 4 ? '#ef6c00' : '#ffB74d';
        ctx.beginPath(); ctx.moveTo(cx - 6, baseY - 2); ctx.lineTo(cx + 6, baseY - 2); ctx.lineTo(cx, baseY + (stage >= 4 ? 10 : 5)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(cx - 3, baseY - 2, 2, 5);
      }
      break;
    }
    case 'khoai': {
      stem(H, '#33691e', 5);
      leaf(cx, baseY - 12, 12, Math.PI * 1.2, '#558b2f', 6);
      leaf(cx, baseY - 12, 12, Math.PI * 1.8, '#558b2f', 6);
      leaf(cx, baseY - 22, 10, Math.PI * 1.4, '#7cb342', 5);
      leaf(cx, baseY - 22, 10, Math.PI * 1.6, '#7cb342', 5);
      if (stage >= 3) { dot(cx - 7, baseY - 24, 2.5, '#fff'); dot(cx + 7, baseY - 20, 2.5, '#e1bee7'); }
      if (stage >= 4) {
        ctx.fillStyle = '#a1887f'; ell(ctx, cx - 9, baseY - 1, 5, 4); ell(ctx, cx + 9, baseY - 1, 5, 4);
        ctx.fillStyle = '#d7ccc8'; ell(ctx, cx - 10, baseY - 2, 1.6, 1.2);
      }
      break;
    }
    case 'cachua': case 'catim': case 'dualeo': {
      const fruitCol = cropId === 'cachua' ? '#e53935' : cropId === 'catim' ? '#6a1b9a' : '#2e7d32';
      const fruitHi = cropId === 'cachua' ? '#ff8a80' : cropId === 'catim' ? '#ce93d8' : '#a5d6a7';
      stem(H, '#1b5e20', 5);
      leaf(cx, baseY - 12, 12, Math.PI * 1.2, '#388e3c', 6);
      leaf(cx, baseY - 12, 12, Math.PI * 1.8, '#388e3c', 6);
      leaf(cx, baseY - 22, 10, Math.PI * 1.5, '#43a047', 5);
      if (stage === 3) {
        dot(cx - 8, baseY - 20, 2.6, '#fff59d'); dot(cx + 8, baseY - 24, 2.6, '#fff59d');
        dot(cx, baseY - 28, 3, cropId === 'catim' ? '#ce93d8' : '#fff'); // hoa
        dot(cx - 6, baseY - 12, 3, fruitCol); // trái non xanh/nhỏ
        dot(cx + 6, baseY - 14, 3, fruitCol);
      }
      if (stage === 4) {
        const fy = baseY - 14;
        if (cropId === 'catim') { ell(ctx, cx - 8, fy, 4.5, 7); ell(ctx, cx + 8, fy - 2, 4.5, 7); }
        else if (cropId === 'dualeo') { ell(ctx, cx - 8, fy + 2, 3.5, 7); ell(ctx, cx + 8, fy, 3.5, 7); }
        else { glowDot(cx - 8, fy, 5, fruitCol); glowDot(cx + 8, fy - 3, 5.5, fruitCol); glowDot(cx, fy + 3, 4, fruitCol); }
        ctx.fillStyle = fruitHi;
        ctx.fillRect(cx - 10, fy - 3, 2, 2); ctx.fillRect(cx + 6, fy - 6, 2, 2);
        // đài hoa
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(cx - 10, fy - 8, 4, 3); ctx.fillRect(cx + 6, fy - 11, 4, 3);
      }
      break;
    }
    case 'caixanh': case 'dautay': {
      // bụi thấp xòe
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI * (1.05 + k * 0.18);
        leaf(cx, baseY - 4, stage >= 4 ? 16 : 12, ang, k % 2 ? '#43a047' : '#2e7d32', 7);
      }
      if (cropId === 'dautay' && stage >= 3) {
        dot(cx - 5, baseY - 10, 2, '#fff'); dot(cx + 5, baseY - 12, 2, '#fff');
      }
      if (stage === 4) {
        if (cropId === 'dautay') {
          glowDot(cx - 7, baseY - 6, 3.6, '#e53935'); glowDot(cx + 6, baseY - 5, 3.6, '#e53935'); glowDot(cx, baseY - 3, 3.2, '#e53935');
        } else {
          dot(cx, baseY - 14, 4, '#c5e1a5');
          leaf(cx, baseY - 6, 8, Math.PI * 1.5, '#9ccc65', 5);
        }
      }
      break;
    }
    case 'duahau': case 'bingo': {
      const big = cropId === 'bingo';
      for (let k = 0; k < 5; k++) leaf(cx, baseY - 3, 15, Math.PI * (1.05 + k * 0.22), '#43a047', 6);
      if (stage === 3) { dot(cx, baseY - 16, 3.4, '#ffeb3b'); }
      if (stage === 4) {
        const r = big ? 11 : 8;
        const fx = cx + 10, fy = baseY - r + 2;
        ctx.fillStyle = big ? '#ef6c00' : '#2e7d32';
        ctx.beginPath(); ctx.arc(fx, fy, r, 0, 7); ctx.fill();
        if (!big) { // sọc dưa hấu
          ctx.strokeStyle = '#a5d6a7'; ctx.lineWidth = 1.6;
          for (let s = -1; s <= 1; s++) { ctx.beginPath(); ctx.arc(fx, fy, r - 2, -0.6 + s * 0.4, 0.6 + s * 0.4); ctx.stroke(); }
        } else {
          ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(fx, fy - r); ctx.quadraticCurveTo(fx - 4, fy, fx, fy + r); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(fx, fy - r); ctx.quadraticCurveTo(fx + 4, fy, fx, fy + r); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ell(ctx, fx - r * 0.35, fy - r * 0.35, 2.4, 1.6);
        // cuống
        ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(fx, fy - r); ctx.quadraticCurveTo(cx, fy - r - 8, cx + sway * 0.5, baseY - 14); ctx.stroke();
      }
      break;
    }
    case 'nho': {
      // giàn nho: 2 cọc + dây + chùm
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 14, baseY); ctx.lineTo(cx - 14, baseY - H - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 14, baseY); ctx.lineTo(cx + 14, baseY - H - 6); ctx.stroke();
      ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 14, baseY - H); ctx.quadraticCurveTo(cx, baseY - H - 6, cx + 14, baseY - H); ctx.stroke();
      leaf(cx - 6, baseY - H + 4, 9, Math.PI * 1.3, '#43a047', 5);
      leaf(cx + 6, baseY - H + 4, 9, Math.PI * 1.7, '#43a047', 5);
      if (stage >= 3) {
        const cols = stage === 4 ? ['#6a1b9a', '#8e24aa', '#4a148c'] : ['#7cb342', '#9ccc65'];
        for (let c = 0; c < 2; c++) {
          const bx = cx + (c === 0 ? -6 : 6) + sway * 0.3, by = baseY - H + 10;
          for (let rr2 = 0; rr2 < 5; rr2++) dot(bx + (rr2 % 2) * 4 - 2, by + Math.floor(rr2 / 2) * 4, 3, cols[rr2 % cols.length]);
        }
        if (stage === 4) { dot(cx - 6, baseY - H + 8, 1.2, '#fff'); dot(cx + 6, baseY - H + 8, 1.2, '#fff'); }
      }
      break;
    }
    case 'caphe': {
      stem(20, '#3e2723', 5);
      ell(ctx, cx, baseY - 22, 14, 10);
      ctx.fillStyle = '#2e7d32'; ell(ctx, cx - 4, baseY - 24, 9, 7);
      if (stage >= 3) { dot(cx - 6, baseY - 22, 2, '#fff'); dot(cx + 4, baseY - 25, 2, '#fff'); }
      if (stage === 4) {
        glowDot(cx - 7, baseY - 20, 2.8, '#d32f2f'); glowDot(cx, baseY - 18, 2.8, '#d32f2f'); glowDot(cx + 7, baseY - 21, 2.8, '#d32f2f');
        glowDot(cx - 3, baseY - 24, 2.4, '#d32f2f'); glowDot(cx + 3, baseY - 15, 2.4, '#b71c1c');
      }
      break;
    }
    case 'nam': {
      // khúc gỗ + nấm
      ctx.fillStyle = '#6d4c41'; ctx.fillRect(cx - 14, baseY - 8, 28, 8);
      ctx.fillStyle = '#4e342e'; ctx.fillRect(cx - 14, baseY - 3, 28, 3);
      ctx.fillStyle = '#a1887f'; ell(ctx, cx - 14, baseY - 4, 2.5, 4); ell(ctx, cx + 14, baseY - 4, 2.5, 4);
      const shrooms: [number, number][] = stage === 2 ? [[-6, 0], [5, 0]] : stage === 3 ? [[-9, 0], [0, -2], [8, 0]] : [[-11, 0], [-4, -3], [4, -2], [11, 0]];
      for (const [ox] of shrooms.map((s) => [s[0]])) {
        const mx = cx + (ox as number), my = baseY - 8;
        ctx.fillStyle = '#efebe9'; ctx.fillRect(mx - 1.5, my - (stage >= 4 ? 10 : 7), 3, stage >= 4 ? 10 : 7);
        ctx.fillStyle = stage >= 4 ? '#d32f2f' : '#bcaaa4';
        ctx.beginPath(); ctx.arc(mx, my - (stage >= 4 ? 10 : 7), stage >= 4 ? 5 : 3.6, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(mx - 2, my - (stage >= 4 ? 13 : 9), 1.5, 1.5);
      }
      break;
    }
    case 'sam': {
      stem(H - 6, '#33691e', 4);
      leaf(cx, baseY - 12, 10, Math.PI * 1.25, '#43a047', 5);
      leaf(cx, baseY - 12, 10, Math.PI * 1.75, '#43a047', 5);
      leaf(cx, baseY - 20, 9, Math.PI * 1.5, '#66bb6a', 5);
      if (stage === 3) { dot(cx, baseY - 26, 2.5, '#fff59d'); }
      if (stage === 4) {
        glowDot(cx - 4, baseY - 26, 2.6, '#d32f2f'); glowDot(cx + 4, baseY - 26, 2.6, '#d32f2f'); glowDot(cx, baseY - 29, 2.6, '#d32f2f');
        // củ sâm ló khỏi đất
        ctx.fillStyle = '#d7b56d'; ell(ctx, cx, baseY + 1, 5, 3);
      }
      break;
    }
    default: {
      stem(H, '#2e7d32', 5);
      leaf(cx, baseY - 12, 12, Math.PI * 1.2, '#43a047', 6);
      leaf(cx, baseY - 12, 12, Math.PI * 1.8, '#43a047', 6);
      if (stage >= 3) dot(cx, baseY - H, 3, '#fff');
      if (stage === 4) { ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText(CROPS[cropId]?.emoji ?? '🌱', cx, baseY - H + 4); }
    }
  }
  // hào quang khi chín
  if (stage === 4) {
    ctx.strokeStyle = `rgba(255,235,59,${0.5 + 0.3 * Math.sin(t * 4 + seed)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, baseY - H / 2, 20, H / 2 + 6, 0, 0, 7); ctx.stroke();
  }
}

// ============================================================
//  CHUỒNG GÀ–VỊT + TRẠI BÒ–HEO–CỪU (nhà + sân chi tiết)
// ============================================================
function drawCoopDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = COOP.x - cam.x, Y = COOP.y - cam.y;
  // bóng
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X + 4, Y + 6, COOP.w, COOP.h);
  // sân đất + rơm rải
  ctx.fillStyle = '#c9a97a'; ctx.fillRect(X, Y, COOP.w, COOP.h);
  ctx.fillStyle = '#b78f5e'; ctx.fillRect(X, Y, COOP.w, 10);
  for (let i = 0; i < 26; i++) {
    const h = hash2(i, 21);
    const px = X + 8 + h * (COOP.w - 16), py = Y + 60 + hash2(i, 33) * (COOP.h - 70);
    ctx.strokeStyle = h > 0.5 ? '#d4af5a' : '#a67c3a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 7, py - 2); ctx.stroke();
  }
  // vết chân gà
  ctx.fillStyle = 'rgba(93,64,55,.4)';
  for (let i = 0; i < 10; i++) {
    const px = X + 40 + ((i * 67) % (COOP.w - 160));
    const py = Y + 90 + ((i * 41) % 90);
    ell(ctx, px, py, 2.2, 1.5); ell(ctx, px + 14, py + 8, 2.2, 1.5);
  }
  const hx = X + 22, hy = Y + 6; // nhà gà góc trái
  const hw = 150, hh = 92;
  // bóng nhà
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, hx + hw / 2, hy + hh + 8, hw / 2, 8);
  // thân nhà gỗ vàng
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(hx, hy + 30, hw, hh - 30);
  ctx.fillStyle = '#d7a75d';
  for (let yy = hy + 34; yy < hy + hh; yy += 10) ctx.fillRect(hx + 4, yy, hw - 8, 6);
  // mái đỏ 2 mái + viền trắng
  ctx.fillStyle = '#c62828';
  ctx.beginPath(); ctx.moveTo(hx - 12, hy + 34); ctx.lineTo(hx + hw / 2, hy - 14); ctx.lineTo(hx + hw + 12, hy + 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.moveTo(hx - 12, hy + 34); ctx.lineTo(hx + hw / 2, hy - 14); ctx.lineTo(hx + hw / 2, hy + 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(hx - 12, hy + 30, hw + 24, 5);
  // cửa vòm + ổ rơm lộ ra
  ctx.fillStyle = '#4e342e';
  ctx.beginPath(); ctx.arc(hx + hw / 2, hy + hh - 6, 20, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx + hw / 2 - 20, hy + hh - 26, 40, 20);
  ctx.fillStyle = '#e8c872'; ell(ctx, hx + hw / 2, hy + hh - 4, 16, 6);
  ctx.fillStyle = '#fff'; ell(ctx, hx + hw / 2 - 6, hy + hh - 7, 5, 4); ell(ctx, hx + hw / 2 + 7, hy + hh - 6, 5, 4);
  // cửa sổ tròn hình gà
  ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(hx + 30, hy + 52, 13, 0, 7); ctx.fill();
  ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(hx + 30, hy + 52, 13, 0, 7); ctx.stroke();
  ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.fillText('🐔', hx + 30, hy + 57);
  // biển tên
  ctx.fillStyle = '#4e342e'; ctx.fillRect(hx + hw / 2 - 44, hy - 8, 88, 18);
  ctx.fillStyle = '#ffca28'; ctx.fillRect(hx + hw / 2 - 44, hy - 8, 88, 4);
  txt(ctx, 'NHÀ GÀ 🐔', hx + hw / 2, hy + 5, 10, '#fff');
  // máng ăn dài + hạt bắp
  const tx = X + COOP.w - 168, ty = Y + COOP.h - 52;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, tx + 75, ty + 24, 78, 8);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(tx, ty, 150, 20);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(tx, ty, 150, 5);
  ctx.fillStyle = '#ffca28';
  for (let i = 0; i < 16; i++) ell(ctx, tx + 8 + (i * 9) % 136, ty + 6 + (i % 3) * 3, 3, 2.2);
  // máng nước xanh
  ctx.fillStyle = '#0277bd'; ctx.fillRect(tx - 56, ty + 2, 44, 16);
  ctx.fillStyle = '#4fc3f7'; ctx.fillRect(tx - 53, ty + 4, 38, 5);
  // đống rơm cuộn + chạc
  const sx2 = X + 250, sy2 = Y + COOP.h - 44;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, sx2, sy2 + 14, 34, 7);
  ctx.fillStyle = '#e8c872'; ctx.beginPath(); ctx.arc(sx2, sy2, 28, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c39a3b'; ctx.lineWidth = 1.6;
  for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.arc(sx2, sy2, 20 + a * 3, 0.4, 2.6); ctx.stroke(); }
  ctx.fillStyle = '#d4af5a'; ctx.beginPath(); ctx.arc(sx2, sy2 - 8, 18, 0, 7); ctx.fill();
  // lông gà bay
  for (let i = 0; i < 3; i++) {
    const fx = X + 120 + ((t * 12 + i * 90) % (COOP.w - 140));
    const fy = Y + 70 + Math.sin(t * 2 + i * 2) * 8 + i * 22;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ell(ctx, fx, fy, 4, 2.6);
  }
}

function drawBarnDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = BARN.x - cam.x, Y = BARN.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X + 4, Y + 6, BARN.w, BARN.h);
  // sân đất nâu + cỏ khô + vũng bùn
  ctx.fillStyle = '#b99a7a'; ctx.fillRect(X, Y, BARN.w, BARN.h);
  ctx.fillStyle = 'rgba(90,60,30,.25)';
  ell(ctx, X + 120, Y + 130, 46, 12); ell(ctx, X + 330, Y + 160, 56, 13);
  ctx.fillStyle = 'rgba(60,35,15,.35)';
  ell(ctx, X + 120, Y + 130, 30, 7); ell(ctx, X + 330, Y + 160, 36, 8);
  for (let i = 0; i < 22; i++) {
    const h = hash2(i, 77);
    ctx.strokeStyle = '#8f9a5a'; ctx.lineWidth = 1.5;
    const px = X + 10 + h * (BARN.w - 20), py = Y + 70 + hash2(i, 91) * (BARN.h - 80);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 5, py - 7); ctx.stroke();
  }
  // nhà kho đỏ mái xám
  const hx = X + 16, hy = Y + 4, hw = 170, hh = 100;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, hx + hw / 2, hy + hh + 8, hw / 2 + 6, 8);
  ctx.fillStyle = '#b71c1c'; ctx.fillRect(hx, hy + 34, hw, hh - 34);
  ctx.fillStyle = '#d32f2f'; ctx.fillRect(hx, hy + 34, 14, hh - 34);
  ctx.fillStyle = '#fff'; // nẹp trắng chữ X
  ctx.fillRect(hx + 60, hy + 44, 50, 8); ctx.fillRect(hx + 60, hy + 70, 50, 8);
  ctx.fillRect(hx + 60, hy + 44, 8, 34); ctx.fillRect(hx + 102, hy + 44, 8, 34);
  // mái
  ctx.fillStyle = '#455a64';
  ctx.beginPath(); ctx.moveTo(hx - 12, hy + 38); ctx.lineTo(hx + hw / 2, hy - 12); ctx.lineTo(hx + hw + 12, hy + 38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#607d8b';
  ctx.beginPath(); ctx.moveTo(hx - 12, hy + 38); ctx.lineTo(hx + hw / 2, hy - 12); ctx.lineTo(hx + hw / 2, hy + 38); ctx.closePath(); ctx.fill();
  // cửa lớn + đầu bò trang trí
  ctx.fillStyle = '#4e342e'; ctx.fillRect(hx + hw / 2 - 26, hy + 56, 52, hh - 56);
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(hx + hw / 2 - 2, hy + 56, 4, hh - 56);
  ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillText('🐄', hx + hw / 2, hy + 30);
  ctx.fillStyle = '#4e342e'; ctx.fillRect(hx + hw / 2 - 52, hy + 8, 104, 18);
  txt(ctx, 'TRẠI BÒ 🐄', hx + hw / 2, hy + 21, 10, '#fff');
  // silo xám bên phải nhà
  const siloX = hx + hw + 18, siloY = hy + 6;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, siloX + 18, hy + hh + 6, 22, 6);
  ctx.fillStyle = '#90a4ae'; ctx.fillRect(siloX, siloY + 12, 36, hh - 12);
  ctx.fillStyle = '#b0bec5'; ctx.fillRect(siloX, siloY + 12, 8, hh - 12);
  ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(siloX + 18, siloY + 12, 18, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#78909c'; ctx.fillRect(siloX, siloY + 30, 36, 4); ctx.fillRect(siloX, siloY + 52, 36, 4);
  // máng cỏ dài + đống cỏ
  const mx = X + BARN.w - 210, my = Y + BARN.h - 52;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, mx + 90, my + 24, 94, 8);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(mx, my, 180, 20);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(mx, my, 180, 5);
  ctx.fillStyle = '#7cb342';
  for (let i = 0; i < 20; i++) {
    const px = mx + 6 + (i * 9) % 170;
    ctx.fillRect(px, my + 2 + (i % 3) * 2, 5, 5);
  }
  ctx.strokeStyle = '#33691e'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    const px = mx + 8 + i * 14;
    ctx.beginPath(); ctx.moveTo(px, my + 4); ctx.lineTo(px + 3, my - 6 - (i % 3) * 2); ctx.stroke();
  }
  // kiện rơm vuông + tròn
  ctx.fillStyle = '#e8c872'; ctx.fillRect(X + 250, my - 26, 40, 26);
  ctx.strokeStyle = '#c39a3b'; ctx.lineWidth = 1.5;
  ctx.strokeRect(X + 250, my - 26, 40, 26);
  ctx.beginPath(); ctx.moveTo(X + 250, my - 13); ctx.lineTo(X + 290, my - 13); ctx.stroke();
  ctx.fillStyle = '#d4af5a'; ctx.beginPath(); ctx.arc(X + 320, my - 10, 16, 0, 7); ctx.fill();
  ctx.strokeStyle = '#b78c2e'; ctx.beginPath(); ctx.arc(X + 320, my - 10, 11, 0, 7); ctx.stroke();
  // khói nhẹ từ ống khói + bướm
  const smokeY = hy - 14 - ((t * 14) % 40);
  ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - ((t * 14) % 40) / 40)})`;
  ctx.beginPath(); ctx.arc(hx + hw - 30 + Math.sin(t + smokeY * 0.1) * 6, smokeY, 5, 0, 7); ctx.fill();
}

// ============================================================
//  AO CÁ — bờ cát + đá + sen + cá 3 cỡ
// ============================================================
function drawPondDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, s: RenderState, t: number) {
  const X = POND.x - cam.x, Y = POND.y - cam.y, Wp = POND.w, Hp = POND.h;
  // bóng + bờ cát + viền đá
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X - 12, Y - 8, Wp + 28, Hp + 28);
  ctx.fillStyle = '#e0c184'; ctx.fillRect(X - 14, Y - 14, Wp + 28, Hp + 28);
  ctx.fillStyle = '#d7b56d';
  for (let i = 0; i < 30; i++) {
    const h = hash2(i, 5);
    ell(ctx, X - 10 + h * (Wp + 20), Y - 10 + hash2(i, 9) * (Hp + 20), 3, 2);
  }
  // mặt nước gradient sâu ở giữa
  const g = ctx.createLinearGradient(0, Y, 0, Y + Hp);
  g.addColorStop(0, '#6fd3f7'); g.addColorStop(0.45, '#29b6f6'); g.addColorStop(1, '#01579b');
  ctx.fillStyle = g; ctx.fillRect(X, Y, Wp, Hp);
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
  // vệt sáng sâu
  ctx.fillStyle = 'rgba(1,60,110,.35)';
  ell(ctx, X + Wp / 2, Y + Hp * 0.62, Wp * 0.32, Hp * 0.2);
  // sóng lăn tăn
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 12; i++) {
    const wx = X + ((i * 97 + t * 30) % (Wp + 60)) - 30;
    const wy = Y + 14 + ((i * 61) % (Hp - 28));
    const len = 18 + (i % 3) * 10;
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2 + i);
    ctx.fillRect(wx, wy, len, 2.5);
  }
  ctx.globalAlpha = 1;
  // hoa sen: 3 lá + 2 hoa
  const lotus = (lx: number, ly: number, sc: number, tt: number) => {
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath(); ctx.ellipse(lx, ly + Math.sin(tt) * 1.5, 26 * sc, 11 * sc, 0.3, 0.4, 6.6); ctx.fill();
    // khía lá
    ctx.fillStyle = '#0277bd';
    ctx.beginPath(); ctx.moveTo(lx + 8 * sc, ly); ctx.lineTo(lx + 24 * sc, ly - 4 * sc); ctx.lineTo(lx + 22 * sc, ly + 4 * sc); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#33691e'; ctx.lineWidth = 1.2;
    for (let v = -1; v <= 1; v++) { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + v * 12 * sc, ly - 8 * sc); ctx.stroke(); }
  };
  const flower = (fx: number, fy: number, sc: number) => {
    ctx.fillStyle = '#f48fb1';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + Math.sin(t) * 0.05;
      ell(ctx, fx + Math.cos(a) * 6 * sc, fy + Math.sin(a) * 6 * sc, 5 * sc, 3.4 * sc);
    }
    ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(fx, fy, 3.4 * sc, 0, 7); ctx.fill();
  };
  lotus(X + Wp * 0.2, Y + Hp * 0.28, 1, t);
  flower(X + Wp * 0.2 + 6, Y + Hp * 0.28 - 12, 1);
  lotus(X + Wp * 0.78, Y + Hp * 0.7, 1.15, t + 2);
  flower(X + Wp * 0.78 - 8, Y + Hp * 0.7 - 13, 0.8);
  lotus(X + Wp * 0.55, Y + Hp * 0.5, 0.7, t + 1);
  // sậy góc ao
  const reed = (rx: number, ry: number, h: number) => {
    ctx.strokeStyle = '#33691e'; ctx.lineWidth = 3;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(rx + k * 5, ry); ctx.quadraticCurveTo(rx + k * 5 + Math.sin(t * 2 + k) * 3, ry - h * 0.6, rx + k * 6, ry - h); ctx.stroke();
      if (k % 2 === 0) {
        ctx.fillStyle = '#6d4c41'; ell(ctx, rx + k * 6, ry - h - 4, 3, 7);
      }
    }
  };
  reed(X + 18, Y + 22, 34); reed(X + Wp - 20, Y + Hp - 8, 40);
  // bóng cá + cá bơi (cỡ theo grown/hunger) + bọt
  s.fishes.forEach((ff) => {
    if (!ff) return;
    const p = fishPos(ff, t);
    const sx = p.x - cam.x, sy = p.y - cam.y;
    const F = FISHES[ff.type];
    if (!F) return;
    // bóng dưới nước
    ctx.fillStyle = 'rgba(1,40,80,.3)';
    ell(ctx, sx, sy + 10, 14, 4);
    const big = ff.grown ? 1.15 : ff.age > 20 ? 0.9 : 0.65;
    const fs = Math.round((ff.grown ? 30 : 22) * (0.8 + big * 0.35));
    ctx.font = `${fs}px serif`; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(sx, sy + Math.sin(t * 3 + ff.uid) * 3);
    if (p.flip) ctx.scale(-1, 1);
    // viền trắng nhẹ khi đói để dễ thấy
    if (!ff.grown && ff.hunger < 30) {
      ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 10;
    }
    ctx.fillText(F.emoji, 0, 6);
    ctx.restore();
    ctx.shadowBlur = 0;
    // bọt thở
    if ((ff.uid + Math.floor(t * 1.4)) % 4 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(sx + 8, sy - 8 - ((t * 10 + ff.uid) % 10), 1.8, 0, 7); ctx.fill();
    }
    if (ff.grown) {
      ctx.font = '15px serif';
      ctx.fillText('❗', sx + 17, sy - 15 + Math.sin(t * 5) * 3);
      // vòng vàng nhấp nháy báo thu hoạch
      ctx.strokeStyle = `rgba(255,235,59,${0.6 + 0.4 * Math.sin(t * 5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, 22, 12, 0, 0, 7); ctx.stroke();
    } else if (ff.hunger < 30) {
      ctx.font = '13px serif'; ctx.fillText('🍽️', sx + 17, sy - 13);
    }
  });
  // chuồn chuồn lượn trên ao
  for (let i = 0; i < 2; i++) {
    const dx = X + Wp / 2 + Math.cos(t * 0.9 + i * 2.4) * Wp * 0.32;
    const dy = Y + Hp / 2 + Math.sin(t * 1.3 + i * 1.8) * Hp * 0.3;
    const flap = Math.abs(Math.sin(t * 18 + i));
    ctx.fillStyle = 'rgba(200,240,255,.9)';
    ell(ctx, dx - 5 - flap * 2, dy - 3, 5, 2);
    ell(ctx, dx + 5 + flap * 2, dy - 3, 5, 2);
    ctx.fillStyle = '#0288d1'; ctx.fillRect(dx - 1, dy - 6, 2.5, 12);
  }
  ctx.restore();
  // viền đá quanh ao
  for (let i = 0; i < 22; i++) {
    const per = i / 22;
    const bx = X - 7 + per * (Wp + 14);
    ctx.fillStyle = i % 2 ? '#9e9e9e' : '#b0bec5';
    ell(ctx, bx, Y - 10, 9, 6); ell(ctx, bx, Y + Hp + 10, 9, 6);
  }
  for (let i = 0; i < 12; i++) {
    const per = i / 12;
    const by = Y - 7 + per * (Hp + 14);
    ctx.fillStyle = i % 2 ? '#9e9e9e' : '#cfd8dc';
    ell(ctx, X - 10, by, 6, 9); ell(ctx, X + Wp + 10, by, 6, 9);
  }
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
  ctx.strokeRect(X - 14, Y - 14, Wp + 28, Hp + 28);
  if (s.fishes.length >= s.pondSlots && s.pondSlots < MAX_POND) {
    txt(ctx, 'AO ĐẦY — mở ở hòm thư 📮', X + Wp / 2, Y - 28, 12, '#ffeb3b');
  }
}

// ============================================================
//  SÔNG + BẾN CÂU chi tiết
// ============================================================
function drawRiverDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, t: number) {
  const wy0 = RIVER.y - cam.y, ww = RIVER_WATER_Y - cam.y;
  // bãi cát + cát ướt
  ctx.fillStyle = '#e0c184'; ctx.fillRect(0 - cam.x, wy0, WORLD.w, ww - wy0 + 6);
  ctx.fillStyle = '#c8a45e'; ctx.fillRect(0 - cam.x, ww - 4, WORLD.w, 8);
  for (let i = 0; i < 60; i++) {
    const px = (i * 97) % WORLD.w - cam.x, py = wy0 + 4 + ((i * 53) % Math.max(8, ww - wy0 - 4));
    ctx.fillStyle = i % 2 ? '#cfa85f' : '#f0d49a';
    ell(ctx, px, py, 2.6, 1.8);
  }
  // lau sậy + đá ven bờ
  for (let i = 0; i < 14; i++) {
    const rx = (i * 173 + 60) % WORLD.w - cam.x;
    if (rx < -20 || rx > W + 20) continue;
    const ry = wy0 + 6;
    ctx.strokeStyle = '#558b2f'; ctx.lineWidth = 2.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(rx + k * 5, ry); ctx.quadraticCurveTo(rx + k * 5 + Math.sin(t * 2 + i + k) * 3, ry - 14, rx + k * 6, ry - 24 - (k + 1) * 3); ctx.stroke();
    }
    if (i % 3 === 0) { ctx.fillStyle = '#9e9e9e'; ell(ctx, rx + 18, ry + 2, 8, 5); }
  }
  // nước sông
  const g = ctx.createLinearGradient(0, ww, 0, ww + 160);
  g.addColorStop(0, '#5ecbf5'); g.addColorStop(0.4, '#29b6f6'); g.addColorStop(1, '#013a6b');
  ctx.fillStyle = g; ctx.fillRect(0 - cam.x, ww, WORLD.w, 600);
  // dải chảy + bọt
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 26; i++) {
    const sx = ((i * 167 + t * 70) % (WORLD.w + 120)) - 60 - cam.x;
    const sy = ww + 12 + ((i * 53) % 110);
    ctx.globalAlpha = 0.3 + 0.25 * Math.sin(t * 3 + i);
    ctx.fillRect(sx, sy, 26 + (i % 3) * 10, 2.6);
  }
  ctx.globalAlpha = 1;
  // bóng cá lớn bơi + rùa trang trí
  ctx.fillStyle = 'rgba(1,40,80,.35)';
  for (let i = 0; i < 6; i++) {
    const sx = ((i * 311 + t * (34 + i * 7)) % (WORLD.w + 140)) - 70 - cam.x;
    const sy = ww + 22 + ((i * 47) % 90);
    ctx.beginPath(); ctx.ellipse(sx, sy, 15, 5.5, 0, 0, 7); ctx.fill();
    const dir = i % 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(sx + dir * 15, sy); ctx.lineTo(sx + dir * 24, sy - 6); ctx.lineTo(sx + dir * 24, sy + 6); ctx.closePath(); ctx.fill();
  }
  // bến gỗ chi tiết
  PIERS.forEach((pier, pi) => {
    const X = pier.x - cam.x;
    const topY = 1018 - cam.y, botY = 1104 - cam.y;
    // cọc
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(X - 24, topY - 6, 9, botY - topY + 6);
    ctx.fillRect(X + 15, topY - 6, 9, botY - topY + 6);
    // ván
    for (let y = topY; y < botY; y += 13) {
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(X - 30, y, 60, 10);
      ctx.fillStyle = '#a06a35'; ctx.fillRect(X - 30, y, 60, 3);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X - 30, y + 8, 60, 2);
      // đinh
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(X - 26, y + 4, 2, 2); ctx.fillRect(X + 24, y + 4, 2, 2);
    }
    // lan can đầu bến + đèn lồng
    ctx.fillStyle = '#5d4037'; ctx.fillRect(X - 28, topY - 22, 6, 24); ctx.fillRect(X + 22, topY - 22, 6, 24);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(X - 28, topY - 24, 56, 5);
    const lx = X + 30, ly = topY - 26;
    ctx.fillStyle = '#4e342e'; ctx.fillRect(lx - 2, ly - 14, 4, 16);
    ctx.fillStyle = '#ff6f00';
    rr(ctx, lx - 8, ly - 26, 16, 14, 4); ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    rr(ctx, lx - 5, ly - 23, 10, 8, 3); ctx.fill();
    // cuộn dây + xô
    ctx.strokeStyle = '#d7b56d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(X - 18, topY + 6, 7, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(X - 18, topY + 6, 4, 0, 7); ctx.stroke();
    ctx.fillStyle = '#78909c'; ctx.fillRect(X + 10, topY + 2, 12, 10);
    // số bến
    txt(ctx, `${pi + 1}`, X, topY - 32, 10, '#fff');
  });
}

// ---------- shop chi tiết ----------
function drawShopDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = SHOPD.x - cam.x, Y = SHOPD.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X + 5, Y + 8, SHOPD.w, SHOPD.h);
  // thân nhà cam + chân gạch
  ctx.fillStyle = '#ff7043'; ctx.fillRect(X, Y + 22, SHOPD.w, SHOPD.h - 22);
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(X, Y + SHOPD.h - 18, SHOPD.w, 18);
  ctx.fillStyle = '#6d4c41';
  for (let i = 0; i < 6; i++) ctx.fillRect(X + 6 + i * 30, Y + SHOPD.h - 14, 14, 10);
  // mái + mái hiên sọc
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(X - 8, Y, SHOPD.w + 16, 26);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#efebe9' : '#e53935';
    ctx.fillRect(X - 8 + i * ((SHOPD.w + 16) / 9), Y + 26, (SHOPD.w + 16) / 9, 16);
  }
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X - 8, Y + 38, SHOPD.w + 16, 4);
  // biển SHOP
  ctx.fillStyle = '#4e342e'; ctx.fillRect(X + SHOPD.w / 2 - 52, Y + 4, 104, 20);
  ctx.fillStyle = '#ffca28'; ctx.fillRect(X + SHOPD.w / 2 - 52, Y + 4, 104, 4);
  txt(ctx, '★ SHOP ★', X + SHOPD.w / 2, Y + 18, 12, '#fff');
  // cửa kính trưng bày
  ctx.fillStyle = '#4e342e'; ctx.fillRect(X + 14, Y + 54, SHOPD.w - 28, 56);
  ctx.fillStyle = '#b3e5fc'; ctx.fillRect(X + 17, Y + 57, SHOPD.w - 34, 50);
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(X + 22, Y + 60, 18, 44);
  ctx.font = '22px serif'; ctx.textAlign = 'center';
  ctx.fillText('🌱', X + 52, Y + 90); ctx.fillText('🐟', X + 90, Y + 90); ctx.fillText('🐔', X + 128, Y + 90);
  // cửa ra vào
  ctx.fillStyle = '#4e342e'; ctx.fillRect(X + SHOPD.w / 2 - 18, Y + SHOPD.h - 52, 36, 36);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(X + SHOPD.w / 2 - 15, Y + SHOPD.h - 49, 30, 33);
  ctx.fillStyle = '#ffeb3b'; ctx.fillRect(X + SHOPD.w / 2 + 6, Y + SHOPD.h - 34, 5, 5);
  // thùng + bao bên cạnh + đèn
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(X - 26, Y + SHOPD.h - 34, 22, 22);
  ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2; ctx.strokeRect(X - 26, Y + SHOPD.h - 34, 22, 22);
  ctx.fillStyle = '#d7b56d'; ctx.beginPath(); ctx.arc(X + SHOPD.w + 14, Y + SHOPD.h - 12, 12, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8b5a2b'; ctx.beginPath(); ctx.arc(X + SHOPD.w + 14, Y + SHOPD.h - 12, 12, 0, 7); ctx.stroke();
  ctx.font = '16px serif'; ctx.fillText('🎃', X - 15, Y + SHOPD.h - 16);
  const lx = X + SHOPD.w - 14, ly = Y + 48;
  ctx.fillStyle = '#4e342e'; ctx.fillRect(lx - 1, ly - 12, 3, 8);
  ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(255,200,60,${0.18 + 0.08 * Math.sin(t * 3)})`;
  ctx.beginPath(); ctx.arc(lx, ly, 16, 0, 7); ctx.fill();
  // khói ống khói
  ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - ((t * 12) % 36) / 36)})`;
  ctx.beginPath(); ctx.arc(X + 30 + Math.sin(t) * 4, Y - 8 - ((t * 12) % 36), 4.5, 0, 7); ctx.fill();
}

// ---------- cây trang trí nhiều tầng ----------
function drawTreeDetailed(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number, fruit: string | null) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ell(ctx, x, y + 4, 26 * sc, 8 * sc);
  // rễ
  ctx.fillStyle = '#4e342e';
  ell(ctx, x - 10 * sc, y, 8 * sc, 4 * sc); ell(ctx, x + 10 * sc, y, 8 * sc, 4 * sc);
  // thân có vân
  ctx.fillStyle = '#5d4037'; ctx.fillRect(x - 7 * sc, y - 46 * sc, 14 * sc, 48 * sc);
  ctx.fillStyle = '#4e342e'; ctx.fillRect(x - 7 * sc, y - 46 * sc, 3 * sc, 48 * sc);
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(x + 2 * sc, y - 46 * sc, 2.5 * sc, 48 * sc);
  // cành
  ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 5 * sc;
  ctx.beginPath(); ctx.moveTo(x, y - 36 * sc); ctx.lineTo(x - 18 * sc, y - 52 * sc); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - 40 * sc); ctx.lineTo(x + 18 * sc, y - 56 * sc); ctx.stroke();
  const sway = Math.sin(t * 1.2 + x * 0.01) * 2.4;
  // 3 tầng tán
  const blob = (bx: number, by: number, r: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); };
  blob(x + sway * 0.5, y - 62 * sc, 30 * sc, '#1b5e20');
  blob(x - 16 * sc + sway, y - 52 * sc, 20 * sc, '#2e7d32');
  blob(x + 16 * sc + sway, y - 54 * sc, 20 * sc, '#2e7d32');
  blob(x - 6 * sc + sway, y - 72 * sc, 18 * sc, '#388e3c');
  blob(x + 8 * sc + sway, y - 70 * sc, 15 * sc, '#43a047');
  // điểm sáng lá
  ctx.fillStyle = 'rgba(165,214,167,.5)';
  ell(ctx, x - 8 * sc + sway, y - 76 * sc, 7 * sc, 4 * sc);
  if (fruit) {
    ctx.font = `${Math.round(11 * sc)}px serif`; ctx.textAlign = 'center';
    ctx.fillText(fruit, x - 12 * sc + sway, y - 58 * sc);
    ctx.fillText(fruit, x + 10 * sc + sway, y - 64 * sc);
    ctx.fillText(fruit, x + sway, y - 48 * sc);
  }
  // lá rơi
  const lt = (t * 0.5 + x * 0.01) % 1;
  ctx.fillStyle = 'rgba(67,160,71,.85)';
  ell(ctx, x + Math.sin(t * 2 + x) * 18 * sc, y - 40 * sc - lt * 30, 3, 2);
}

// ============================================================
//  VẬT NUÔI — 3 GIAI ĐOẠN: non / tơ / trưởng thành
//  age01 = (now-bornAt)/grow ; <0.35 non, <1 tơ, >=1 trưởng thành
// ============================================================
function drawAnimalDetailed(ctx: CanvasRenderingContext2D, X: number, Y: number, type: string, age01: number, ready: boolean, hunger: number, t: number, uid: number, flip: boolean) {
  const walk = Math.sin(t * 9 + uid * 1.3) * (ready ? 1 : 2.2);
  const sc = age01 < 0.35 ? 0.62 : age01 < 1 ? 0.85 : 1.05;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ell(ctx, X, Y + 15 * sc, 19 * sc, 7 * sc);
  ctx.save();
  ctx.translate(X, Y);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.scale(sc, sc);
  const legSwing = walk;
  if (type === 'chicken') {
    const chick = age01 < 0.35;
    // chân
    ctx.strokeStyle = '#ef6c00'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-4 + legSwing, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 8); ctx.lineTo(5 - legSwing, 15); ctx.stroke();
    // thân tròn
    ctx.fillStyle = chick ? '#ffeb3b' : '#fff';
    ctx.beginPath(); ctx.ellipse(0, 0, chick ? 11 : 15, chick ? 10 : 12, 0, 0, 7); ctx.fill();
    if (!chick) {
      // cánh + đuôi
      ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.ellipse(-3, 1, 8, 5.5, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#cfd8dc';
      for (let k = 0; k < 3; k++) { ctx.fillRect(10 + k * 2, -10 + k * 3, 7, 3); }
    } else {
      // lông tơ xù
      ctx.fillStyle = '#fff9c4';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(-8 + k * 4, -6 + (k % 2) * 3, 2.4, 0, 7); ctx.fill(); }
    }
    // đầu + mào + mỏ
    ctx.fillStyle = chick ? '#ffeb3b' : '#fff';
    ctx.beginPath(); ctx.arc(9, -9, chick ? 7 : 8.5, 0, 7); ctx.fill();
    if (!chick) {
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(6, -17, 3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -18.5, 3.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -17, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(11, -3, 2.4, 0, 7); ctx.fill(); // tích
    } else {
      ctx.fillStyle = '#ff8f00'; ctx.beginPath(); ctx.arc(9, -15, 2.2, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#fb8c00';
    ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(21, -8); ctx.lineTo(16, -5.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(11, -10, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(11.6, -10.6, 0.7, 0, 7); ctx.fill();
  } else if (type === 'duck') {
    const baby = age01 < 0.35;
    ctx.strokeStyle = '#ef6c00'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(-5 + legSwing, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 8); ctx.lineTo(5 - legSwing, 15); ctx.stroke();
    ctx.fillStyle = baby ? '#fff176' : '#eceff1';
    ctx.beginPath(); ctx.ellipse(0, 1, baby ? 12 : 16, baby ? 10 : 12, 0, 0, 7); ctx.fill();
    // cánh xám
    if (!baby) { ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.ellipse(-2, 2, 9, 6, -0.3, 0, 7); ctx.fill(); }
    // đuôi nhọn
    ctx.fillStyle = baby ? '#fff176' : '#90a4ae';
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-22, -8); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
    // đầu + mỏ dẹt
    ctx.fillStyle = baby ? '#ffeb3b' : age01 >= 1 ? '#2e7d32' : '#78909c';
    ctx.beginPath(); ctx.arc(10, -10, baby ? 7.5 : 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.ellipse(19, -9, 5.5, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(11, -11, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(11.7, -11.7, 0.8, 0, 7); ctx.fill();
  } else if (type === 'cow') {
    const baby = age01 < 0.35;
    // chân
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(-12, 2 + legSwing * 0.5, 6, 13); ctx.fillRect(-3, 2 - legSwing * 0.5, 6, 13);
    ctx.fillRect(5, 2 + legSwing * 0.5, 6, 13); ctx.fillRect(12, 2 - legSwing * 0.5, 6, 13);
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-12, 12 + legSwing * 0.5, 6, 3); ctx.fillRect(-3, 12 - legSwing * 0.5, 6, 3);
    ctx.fillRect(5, 12 + legSwing * 0.5, 6, 3); ctx.fillRect(12, 12 - legSwing * 0.5, 6, 3);
    // thân + đốm
    ctx.fillStyle = '#fafafa';
    rr(ctx, -18, -12, 34, 18, 8); ctx.fill();
    ctx.fillStyle = '#212121';
    if (!baby) {
      ctx.beginPath(); ctx.ellipse(-8, -5, 5, 4, 0.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, -6, 4, 3, -0.3, 0, 7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(-4, -5, 3.4, 2.6, 0.4, 0, 7); ctx.fill();
    }
    // đầu
    ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(21, -8, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.ellipse(24, -3, 5.5, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ad1457';
    ctx.beginPath(); ctx.arc(22, -3, 1.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(26, -3, 1.2, 0, 7); ctx.fill();
    // sừng + tai + chuông
    if (age01 >= 1) {
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(15, -20, 3, 6); ctx.fillRect(24, -20, 3, 6);
    }
    ctx.fillStyle = '#eceff1';
    ell(ctx, 13, -10, 3.5, 2.5); ell(ctx, 29, -10, 3.5, 2.5);
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(22, -10, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(22.7, -10.7, 0.8, 0, 7); ctx.fill();
    if (age01 >= 1) {
      ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(21, 2, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(20, -1, 2, 2);
    }
    // đuôi ve vẩy + bầu sữa khi trưởng thành
    const wag = Math.sin(t * 5 + uid) * 4;
    ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-18, -8); ctx.quadraticCurveTo(-24, -2, -23 + wag, 4); ctx.stroke();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(-23 + wag, 5, 2, 0, 7); ctx.fill();
    if (age01 >= 1) { ctx.fillStyle = '#f8bbd0'; ell(ctx, 2, 8, 7, 4.5); }
  } else if (type === 'pig') {
    const baby = age01 < 0.35;
    ctx.fillStyle = baby ? '#f8bbd0' : '#f48fb1';
    ctx.fillRect(-12, 2 + legSwing * 0.5, 6, 11); ctx.fillRect(6, 2 - legSwing * 0.5, 6, 11);
    ctx.fillStyle = '#ad1457';
    ctx.fillRect(-12, 10 + legSwing * 0.5, 6, 3); ctx.fillRect(6, 10 - legSwing * 0.5, 6, 3);
    // thân tròn
    ctx.fillStyle = baby ? '#f8bbd0' : '#f06292';
    ctx.beginPath(); ctx.ellipse(0, -2, baby ? 14 : 18, baby ? 10 : 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-4, -7, 8, 4, -0.3, 0, 7); ctx.fill();
    // đầu dính liền + mõm + tai
    ctx.fillStyle = baby ? '#f8bbd0' : '#f06292';
    ctx.beginPath(); ctx.arc(15, -6, baby ? 8 : 10, 0, 7); ctx.fill();
    ctx.fillStyle = baby ? '#f48fb1' : '#ec407a';
    ctx.beginPath(); ctx.moveTo(8, -15); ctx.lineTo(11, -21); ctx.lineTo(14, -15); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(17, -15); ctx.lineTo(20, -21); ctx.lineTo(22, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.ellipse(21, -5, 5, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#880e4f';
    ctx.beginPath(); ctx.arc(19.5, -5, 1.3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(22.5, -5, 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(14, -9, 1.9, 0, 7); ctx.fill();
    // đuôi xoắn
    ctx.strokeStyle = '#ec407a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-18, -4 + Math.sin(t * 6 + uid) * 1.5, 3.4, 0, 5.5); ctx.stroke();
  } else { // sheep
    const baby = age01 < 0.35;
    // chân đen
    ctx.fillStyle = '#212121';
    ctx.fillRect(-10, 4 + legSwing * 0.5, 5, 11); ctx.fillRect(5, 4 - legSwing * 0.5, 5, 11);
    // len xù nhiều cục
    const puffs: [number, number, number][] = baby
      ? [[-6, -6, 7], [0, -9, 8], [6, -6, 7], [0, -3, 8]]
      : [[-12, -6, 8], [-4, -11, 9], [4, -11, 9], [12, -6, 8], [0, -4, 10], [-6, -2, 8], [7, -2, 8]];
    for (const [px, py, pr] of puffs) {
      ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
      ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(px - 2, py - 2, pr * 0.45, 0, 7); ctx.fill();
    }
    // mặt đen + tai + mắt to
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(15, -4, 6, 7, 0, 0, 7); ctx.fill();
    ell(ctx, 9, -8, 3, 2); ell(ctx, 9, 0, 3, 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(16.5, -6, 1.7, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(16.8, -6, 0.9, 0, 7); ctx.fill();
    if (age01 >= 1) {
      // nơ len trên đầu
      ctx.fillStyle = '#e1bee7'; ctx.beginPath(); ctx.arc(4, -17, 4, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  // thanh no + trạng thái
  const bw = 40 * sc;
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(X - bw / 2 - 1, Y - 36 * sc - 1, bw + 2, 8);
  ctx.fillStyle = hunger > 50 ? '#76ff03' : hunger > 25 ? '#ffeb3b' : '#ff1744';
  ctx.fillRect(X - bw / 2, Y - 36 * sc, bw * (Math.max(0, hunger) / 100), 6);
  if (age01 < 0.35) {
    txt(ctx, '🍼 non', X, Y - 40 * sc, 10, '#fff9c4');
  } else if (age01 < 1) {
    const pct = Math.round(Math.min(1, age01) * 100);
    txt(ctx, `đang lớn ${pct}%`, X, Y - 40 * sc, 9, '#e1f5fe');
  } else if (ready) {
    ctx.font = '18px serif'; ctx.textAlign = 'center';
    ctx.fillText('❗', X + 21, Y - 22 + Math.sin(t * 5 + uid) * 3);
    // vòng sáng báo thu
    ctx.strokeStyle = `rgba(255,235,59,${0.6 + 0.4 * Math.sin(t * 5)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(X, Y, 24 * sc, 20 * sc, 0, 0, 7); ctx.stroke();
  } else if (hunger < 40) {
    ctx.font = '15px serif'; ctx.textAlign = 'center';
    ctx.fillText('🍽️', X + 21, Y - 22);
  }
}

// ---------- người nông dân chi tiết ----------
function drawPlayerDetailed(ctx: CanvasRenderingContext2D, X: number, Y: number, dir: number, moving: boolean, shirt: string, name: string, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ell(ctx, X, Y + 21, 15, 6);
  const bob = moving ? Math.abs(Math.sin(t * 12)) * -2.5 : Math.sin(t * 2) * 1;
  const step = moving ? Math.sin(t * 12) * 5 : 0;
  ctx.save(); ctx.translate(X, Y + bob);
  if (dir < 0) ctx.scale(-1, 1);
  // ủng + quần yếm
  ctx.fillStyle = '#3e2723'; ctx.fillRect(-9, 10 + step * 0.6, 8, 10); ctx.fillRect(2, 10 - step * 0.6, 8, 10);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(-9, 16 + step * 0.6, 8, 4); ctx.fillRect(2, 16 - step * 0.6, 8, 4);
  ctx.fillStyle = '#1e63a6'; ctx.fillRect(-10, -2, 20, 14);
  ctx.fillStyle = '#164e86'; ctx.fillRect(-10, 8, 20, 4);
  ctx.fillStyle = '#ffca28'; ctx.fillRect(-10, -2, 4, 4); ctx.fillRect(6, -2, 4, 4);
  // áo + tay
  ctx.fillStyle = shirt; ctx.fillRect(-12, -10, 24, 12);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-12, -10, 24, 4);
  ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-17, -8 + step * 0.7, 6, 12); ctx.fillRect(11, -8 - step * 0.7, 6, 12);
  // ba lô + cuốc sau lưng
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-20, -9, 6, 12);
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-24, -26); ctx.stroke();
  ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-28, -30, 9, 6);
  // đầu + nón lá
  ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-9, -28, 18, 18);
  ctx.fillStyle = '#f0986c'; ctx.fillRect(-9, -16, 18, 3); // má hồng nhẹ
  ctx.fillStyle = '#212121';
  ctx.fillRect(dir > 0 ? 1 : -4, -22, 3.4, 4); // mắt nhìn theo hướng
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(-4, -12, 8, 2); // miệng
  ctx.fillStyle = '#ffca28';
  ctx.beginPath(); ctx.ellipse(0, -29, 15, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe082';
  ctx.beginPath(); ctx.ellipse(0, -31, 9, 3.4, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(0, -33, 1.8, 0, 7); ctx.fill();
  ctx.restore();
  txt(ctx, name, X, Y - 40 + bob * 0.3, 12);
}

// ============================================================
//  RENDER CHÍNH
// ============================================================
export function renderWorld(ctx: CanvasRenderingContext2D, W: number, H: number, cam: { x: number; y: number }, s: RenderState, t: number) {
  ctx.clearRect(0, 0, W, H);
  drawGrassBase(ctx, cam, W, H, t);
  drawRoad(ctx, cam, t);
  drawFence(ctx, cam);
  drawCoopDetailed(ctx, cam, t);
  drawBarnDetailed(ctx, cam, t);
  drawRiverDetailed(ctx, cam, W, t);
  drawPondDetailed(ctx, cam, s, t);
  drawShopDetailed(ctx, cam, t);
  // cây trang trí
  drawTreeDetailed(ctx, 1062 - cam.x, 690 - cam.y, 1.1, t, '🍎');
  drawTreeDetailed(ctx, 150 - cam.x, 120 - cam.y, 1, t + 2, null);
  drawTreeDetailed(ctx, 1500 - cam.x, 660 - cam.y, 1.3, t + 1, '🍊');
  drawTreeDetailed(ctx, 1480 - cam.x, 900 - cam.y, 1, t + 3, null);
  drawTreeDetailed(ctx, 1090 - cam.x, 120 - cam.y, 0.85, t + 4, null);
  drawTreeDetailed(ctx, 60 - cam.x, 980 - cam.y, 0.9, t + 5, '🥭');
  // hòm thư
  drawMailbox(ctx, PEN_MB.pond.x - cam.x, PEN_MB.pond.y - cam.y, t, 'AO CÁ');
  drawMailbox(ctx, PEN_MB.coop.x - cam.x, PEN_MB.coop.y - cam.y, t + 1, 'GÀ–VỊT');
  drawMailbox(ctx, PEN_MB.barn.x - cam.x, PEN_MB.barn.y - cam.y, t + 2, 'BÒ–HEO');
  // bảng tên khu
  drawWoodSign(ctx, FARM.x + FARM.w / 2 - cam.x, FARM.y - 34 - cam.y, '🌾 RUỘNG', t);
  const coopN = s.animals.filter((a) => a.type === 'chicken' || a.type === 'duck').length;
  const coopMax = s.coopCap.chicken + s.coopCap.duck;
  const barnN = s.animals.length - coopN;
  const barnMax = s.coopCap.cow + s.coopCap.pig + s.coopCap.sheep;
  drawWoodSign(ctx, POND.x + POND.w / 2 - cam.x, POND.y - 34 - cam.y, `🐟 AO CÁ (${s.fishes.length}/${s.pondSlots})`, t + 1, '#0277bd');
  drawWoodSign(ctx, COOP.x + COOP.w / 2 - cam.x, COOP.y - 34 - cam.y, `🐔 GÀ–VỊT (${coopN}/${coopMax})`, t + 2);
  drawWoodSign(ctx, BARN.x + BARN.w / 2 - cam.x, BARN.y - 34 - cam.y, `🐄 BÒ–HEO–CỪU (${barnN}/${barnMax})`, t + 3, '#b71c1c');
  txt(ctx, '🎣 SÔNG CÂU CÁ', 800 - cam.x, 1006 - cam.y, 13);

  // --- ruộng ---
  for (let i = 0; i < s.plots.length; i++) {
    const pp = plotPos(i), pl = s.plots[i];
    const X = pp.x - cam.x, Y = pp.y - cam.y;
    if (X < -80 || Y < -80 || X > W + 80 || Y > H + 80) continue;
    if (pl.locked) {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X - pp.w / 2 + 2, Y - pp.h / 2 + 4, pp.w, pp.h);
      ctx.fillStyle = '#4c8a34'; ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      ctx.fillStyle = 'rgba(27,94,32,.55)'; ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      // cỏ dại um tùm
      ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
      for (let g = 0; g < 7; g++) {
        const gx = X - pp.w / 2 + 6 + ((g * 13 + i * 7) % (pp.w - 12));
        const sway = Math.sin(t * 1.8 + g + i) * 2;
        ctx.beginPath(); ctx.moveTo(gx, Y + pp.h / 2 - 6); ctx.quadraticCurveTo(gx + sway, Y - 4, gx + sway * 1.5, Y - pp.h / 2 + 8 + (g % 3) * 4); ctx.stroke();
      }
      ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', X, Y + 4);
      const req = plotReq(i);
      ctx.fillStyle = '#5d4037';
      rr(ctx, X - 26, Y + pp.h / 2 - 18, 52, 14, 4); ctx.fill();
      txt(ctx, `Lv${req}`, X, Y + pp.h / 2 - 7, 9, '#ffeb3b');
    } else if (pl.state === 'grass') {
      ctx.fillStyle = '#5da93c'; ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      ctx.fillStyle = '#6fbf4a';
      for (let g = 0; g < 6; g++) ctx.fillRect(X - pp.w / 2 + 5 + g * 14, Y - pp.h / 2 + 6 + ((g * 23 + i * 5) % (pp.h - 14)), 4, 9);
      // hoa cỏ nhỏ + bướm đậu
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(X - 10, Y - 6, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(X - 10, Y - 6, 1, 0, 7); ctx.fill();
      ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillText('⛏️', X + pp.w / 2 - 8, Y - pp.h / 2 + 14);
    } else if ((pl.state === 'growing' || pl.state === 'ready') && pl.crop) {
      const c = CROPS[pl.crop];
      if (!c) continue;
      drawPlotSoil(ctx, X, Y, pp.w, pp.h, pl.watered, t, i);
      const stage = pl.state === 'ready' ? 4 : cropStage(pl.progress);
      drawCropPlant(ctx, X, Y + 10, pl.crop, stage, t, i);
      // thanh tăng trưởng + tên giai đoạn
      const bw = pp.w - 10;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      rr(ctx, X - bw / 2 - 1, Y + pp.h / 2 - 13, bw + 2, 8, 3); ctx.fill();
      ctx.fillStyle = pl.state === 'ready' ? '#ffeb3b' : stage <= 1 ? '#8cff49' : stage === 2 ? '#39d353' : '#00bfa5';
      const frac = pl.state === 'ready' ? 1 : Math.min(1, pl.progress);
      if (frac > 0.02) { rr(ctx, X - bw / 2, Y + pp.h / 2 - 12, Math.max(6, bw * frac), 6, 2); ctx.fill(); }
      const label = pl.state === 'ready' ? `${c.name} chín!` : `${c.name} · ${cropStageName(pl.progress)} ${Math.round(pl.progress * 100)}%`;
      txt(ctx, label, X, Y - pp.h / 2 - 6, 8, pl.state === 'ready' ? '#ffeb3b' : '#fff');
      if (pl.state === 'ready') {
        const b = Math.sin(t * 4 + i) * 2.5;
        ctx.font = '14px serif'; ctx.textAlign = 'center';
        ctx.fillText('✨', X - 24, Y - 22 + b); ctx.fillText('✨', X + 24, Y - 22 - b);
        ctx.fillText('🧺', X + pp.w / 2 - 6, Y - pp.h / 2 + 16 + b * 0.4);
      } else if (!pl.watered) {
        const jump = Math.abs(Math.sin(t * 3 + i)) * 3;
        ctx.font = '14px serif'; ctx.fillText('💧', X + pp.w / 2 - 6, Y - pp.h / 2 + 16 - jump);
      } else {
        // hạt nước rơi khi vừa tưới
        ctx.fillStyle = 'rgba(140,200,255,.8)';
        for (let d = 0; d < 3; d++) {
          const dy = ((t * 30 + d * 12 + i * 7) % 26);
          ell(ctx, X - 14 + d * 14, Y - pp.h / 2 + 4 + dy, 1.8, 2.6);
        }
      }
    } else {
      // đất trống chờ gieo: luống + hạt giống gợi ý
      drawPlotSoil(ctx, X, Y, pp.w, pp.h, false, t, i);
      ctx.font = '15px serif'; ctx.textAlign = 'center';
      const bobY = Math.sin(t * 2.4 + i) * 2;
      ctx.fillText('🌰', X, Y + 6 + bobY);
      txt(ctx, 'gieo hạt', X, Y - pp.h / 2 - 6, 8, '#ffecb3');
    }
  }

  // bướm bay trên ruộng
  for (let i = 0; i < 3; i++) {
    const bx = FARM.x + ((t * (24 + i * 8) + i * 300) % FARM.w) - cam.x;
    const by = FARM.y + 60 + ((i * 137) % (FARM.h - 120)) + Math.sin(t * 3 + i * 2) * 14 - cam.y;
    if (bx < 0 || bx > W) continue;
    const flap = Math.abs(Math.sin(t * 14 + i * 2));
    const col = ['#ff80ab', '#82b1ff', '#ffeb3b'][i % 3];
    ctx.fillStyle = col;
    ell(ctx, bx - 3 - flap * 2, by, 4, 2.6);
    ell(ctx, bx + 3 + flap * 2, by, 4, 2.6);
    ctx.fillStyle = '#3e2723'; ctx.fillRect(bx - 1, by - 3, 2, 6);
  }

  // --- vật nuôi ---
  const nowMs = Date.now();
  s.animals.forEach((a) => {
    const p = animalPos(a, t);
    const X = p.x - cam.x, Y = p.y - cam.y;
    if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) return;
    const A = ANIMALS[a.type];
    if (!A) return;
    const age01 = (nowMs - a.bornAt) / 1000 / A.grow;
    const flip = Math.sin(t * 0.5 + a.uid) > 0;
    drawAnimalDetailed(ctx, X, Y, a.type, age01, a.ready && age01 >= 1, a.hunger, t, a.uid, flip);
  });

  // --- người chơi ---
  if (s.sit) {
    drawSittingFisher(ctx, s.sit.x - cam.x, s.sit.y - cam.y, s.sit.bx - cam.x, s.sit.by - cam.y, s, t);
  } else {
    const X = s.player.x - cam.x, Y = s.player.y - cam.y;
    const shirt = SHIRTS[s.avatar % SHIRTS.length];
    drawPlayerDetailed(ctx, X, Y, s.player.dir, s.player.moving, shirt, s.player.name, t);
    if (s.player.tx != null && s.player.ty != null) {
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 6 + Math.sin(t * 8) * 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 9 + Math.sin(t * 8) * 2, 0, 7); ctx.stroke();
    }
  }

  // người chơi khác
  if (s.visitors) {
    for (const v of s.visitors) {
      const X = v.x - cam.x, Y = v.y - cam.y;
      if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
      const shirt = SHIRTS[(v.avatar || 0) % SHIRTS.length];
      drawPlayerDetailed(ctx, X, Y, v.dir, v.moving, shirt, v.name, t + v.x * 0.01);
      const bub = v.self ? s.selfBubble : v.bubble;
      const at = v.self ? nowMs : (v.bubbleAt ?? 0);
      if (bub && nowMs - at < 5000) {
        ctx.font = `bold 12px 'Be Vietnam Pro', monospace`;
        const wpx = Math.min(220, ctx.measureText(bub).width + 18);
        const bx = Math.max(wpx / 2 + 4, Math.min(W - wpx / 2 - 4, X));
        const by = Y - 62;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#2b2117'; ctx.lineWidth = 2;
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect?.(bx - wpx / 2, by - 18, wpx, 24, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b2117'; ctx.textAlign = 'center';
        ctx.fillText(bub.slice(0, 26), bx, by - 1);
      }
    }
  }

  // đom đóm + đèn bến ban đêm được vẽ trong lớp ngày/đêm
  {
    const dt = s.dayTime;
    let dark = 0;
    if (dt < 0.2) dark = 0.55 - (dt / 0.2) * 0.45;
    else if (dt < 0.3) dark = 0.1;
    else if (dt < 0.7) dark = 0;
    else if (dt < 0.85) dark = ((dt - 0.7) / 0.15) * 0.35;
    else dark = 0.35 + ((dt - 0.85) / 0.15) * 0.25;
    const night = dark > 0.25;
    if (dark > 0.02) { ctx.fillStyle = `rgba(8,8,50,${dark})`; ctx.fillRect(0, 0, W, H); }
    if (night) {
      // quầng đèn bến + shop + hòm thư
      const glow = (wx: number, wy: number, r: number, c = '255,200,80') => {
        const X = wx - cam.x, Y = wy - cam.y;
        if (X < -r || Y < -r || X > W + r || Y > H + r) return;
        const g2 = ctx.createRadialGradient(X, Y, 2, X, Y, r);
        g2.addColorStop(0, `rgba(${c},.55)`); g2.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
      };
      PIERS.forEach((p) => glow(p.x + 30, 992, 70));
      glow(SHOPD.x + SHOPD.w - 14, SHOPD.y + 48, 60);
      glow(PEN_MB.pond.x, PEN_MB.pond.y - 16, 44);
      // đom đóm
      for (let i = 0; i < 24; i++) {
        const fx = (i * 257 + t * (10 + (i % 5) * 4)) % WORLD.w - cam.x;
        const fy = (i * 173 + Math.sin(t * 1.5 + i) * 30) % WORLD.h - cam.y;
        if (fx < 0 || fy < 0 || fx > W || fy > H) continue;
        const tw2 = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.4 + i * 1.7));
        ctx.fillStyle = `rgba(255,255,150,${tw2})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, 7); ctx.fill();
      }
      // sao
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 311) % W, sy = (i * 167) % Math.max(80, H * 0.4);
        if (Math.sin(t * 2 + i) > 0.2) ctx.fillRect(sx, sy, 2, 2);
      }
    }
    // mặt trời / mặt trăng + mây
    ctx.font = '30px serif'; ctx.textAlign = 'center';
    const isDay = dt > 0.2 && dt < 0.78;
    ctx.fillText(isDay ? '☀️' : '🌙', W - 60, 44);
    if (isDay) {
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 4; i++) {
        const cxm = ((t * 8 + i * 420) % (W + 240)) - 120;
        ell(ctx, cxm, 52 + i * 22, 30, 10);
        ell(ctx, cxm + 22, 56 + i * 22, 22, 8);
      }
    }
  }
}

/** Nông dân ngồi câu chi tiết: nón, áo, cần trúc, phao, gợn sóng, ❗ khi cắn */
function drawSittingFisher(
  ctx: CanvasRenderingContext2D, X: number, Y: number, BX: number, BY: number,
  s: RenderState, t: number,
) {
  const shirt = SHIRTS[s.avatar % SHIRTS.length];
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ell(ctx, X, Y + 15, 17, 6);
  // chiếu cói
  ctx.fillStyle = '#d7b56d'; ell(ctx, X, Y + 12, 20, 7);
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(X, Y + 12, 14, 4.5, 0, 0, 7); ctx.stroke();
  const bob = Math.sin(t * 2) * 1;
  ctx.save(); ctx.translate(X, Y + bob);
  // chân xếp bằng + dép
  ctx.fillStyle = '#1e63a6'; ctx.fillRect(-17, 4, 14, 8); ctx.fillRect(3, 4, 14, 8);
  ctx.fillStyle = '#4e342e'; ctx.fillRect(-17, 10, 14, 3); ctx.fillRect(3, 10, 14, 3);
  // thân + tay cầm cần
  ctx.fillStyle = shirt; ctx.fillRect(-11, -12, 22, 19);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-11, -12, 22, 4);
  ctx.fillStyle = '#ffcc9e'; ctx.fillRect(9, -10, 13, 6);
  // đầu + nón lá rộng
  ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-9, -30, 18, 18);
  ctx.fillStyle = '#212121'; ctx.fillRect(1, -24, 3.4, 4);
  ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.ellipse(0, -31, 17, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe082'; ctx.beginPath(); ctx.ellipse(0, -33.5, 10, 3.6, 0, Math.PI, 0); ctx.fill();
  // cần trúc nhiều đốt hướng ra sông
  const tipX = BX - X, tipY = BY - Y - 30;
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(18, -8); ctx.quadraticCurveTo((18 + tipX) / 2, (-8 + tipY) / 2 - 8, tipX, tipY); ctx.stroke();
  ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 1.4;
  for (let k = 1; k <= 3; k++) {
    const px = 18 + (tipX - 18) * (k / 4), py = -8 + (tipY + 8) * (k / 4) - 6 * (1 - k / 4);
    ctx.beginPath(); ctx.moveTo(px - 3, py - 3); ctx.lineTo(px + 3, py + 3); ctx.stroke();
  }
  ctx.restore();
  // dây + phao 2 màu
  const byBob = Math.sin(t * 3) * 2;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(BX, BY - 30 + bob); ctx.lineTo(BX, BY + byBob); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(BX, BY + byBob, 5.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(BX, BY + byBob - 3, 5.5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#212121'; ctx.fillRect(BX - 1, BY + byBob - 8, 2, 5);
  // gợn sóng lan ra
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const rad = 9 + ((t * 16 + i * 13) % 27);
    ctx.globalAlpha = Math.max(0, 1 - rad / 38);
    ctx.beginPath(); ctx.ellipse(BX, BY + byBob, rad, rad * 0.36, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // xô cá bên cạnh
  ctx.fillStyle = '#78909c'; ctx.fillRect(X - 30, Y + 2, 14, 12);
  ctx.fillStyle = '#4fc3f7'; ctx.fillRect(X - 28, Y + 4, 10, 4);
  txt(ctx, s.player.name, X, Y - 44, 12);
  if (s.sit?.bite) {
    ctx.font = '28px serif'; ctx.textAlign = 'center';
    ctx.fillText('❗', BX, BY - 24 + Math.sin(t * 10) * 3);
    ctx.fillText('🐟', BX + 14, BY + 2 + Math.sin(t * 8) * 2);
  }
}
