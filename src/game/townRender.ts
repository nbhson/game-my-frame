// ===== Công viên anime 9/10 — cùng ngôn ngữ nông trại (viền #4a3226, pastel, má hồng,
// highlight chéo, bóng mềm, lấp lánh, khói puff, ngày/đêm, mưa/tuyết) =====
import { SHIRTS, shirtColorOf } from './data';
import type { GraphicsQuality, WeatherKind } from './types';
import {
  BENCH_SPOTS, FARM_GATE, FOUNTAIN, LAMP_SPOTS, PLAZA, SAKURA_SPOTS,
  TOWN, TOWN_BOARD, TOWN_CAFE, TOWN_CASINO, TOWN_HALL, TOWN_HOUSE1, TOWN_HOUSE2,
  TOWN_SHOP, TOWN_STAGE, farmGateCenter,
} from './town';
import { computePairOffsets, drawActionFx, drawEggThrow, drawKem, drawKiki, drawMimi, drawPairFx, drawPlayerDetailed, type PairActor, type VisitorDraw } from './render';
import { drawMoon, drawSparkle, drawSun, setFxLevel } from './icons';

export interface TownRenderState {
  player: { x: number; y: number; dir: number; moving: boolean; tx: number | null; ty: number | null; name: string };
  avatar: number;
  dayTime: number;
  weather?: WeatherKind;
  visitors?: VisitorDraw[];
  selfBubble?: string;
  selfEmote?: string;
  /** mốc giờ tự bấm emote (để animation theo thời gian chạy đúng cho chính mình) */
  selfEmoteAt?: number;
  /** Kem — mèo cam đi theo chủ (lệnh kemkem) */
  kemPos?: { x: number; y: number; moving: boolean; flip: boolean; sitting: boolean } | null;
  /** hiệu ứng vuốt ve pet (để Kem có tim + tay người ở công viên) */
  petFx?: { uid: number; at: number } | null;
  outfit?: Record<string, string>;
  /** cấp đồ họa (đồng bộ với farm) */
  quality?: GraphicsQuality;
}

// ===== Cấp đồ họa: renderTown đặt mỗi frame =====
let TQ_LOW = false;
let TQ_MED = false;

const OUT = '#4a3226';
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
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 12, color = '#fff') {
  ctx.font = `bold ${size}px 'Be Vietnam Pro', monospace`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, ow = 3) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = ow; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
}
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.22) {
  if (TQ_LOW) return; // đồ họa Thấp: tắt bóng cho nhẹ
  ctx.fillStyle = `rgba(30,40,20,${a})`;
  ell(ctx, x, y, rx, ry);
}
/** Vệt nắng chéo trên mặt phẳng */
function glint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.35, y);
  ctx.lineTo(x + w * 0.55, y);
  ctx.lineTo(x + w * 0.2, y + h);
  ctx.closePath(); ctx.fill();
}
function namePill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = `bold 9px 'Be Vietnam Pro', monospace`;
  const w = Math.min(150, ctx.measureText(text).width + 18);
  shadow(ctx, x, y + 9, w / 2, 3, 0.2);
  rr(ctx, x - w / 2, y, w, 15, 7.5); ctx.fillStyle = 'rgba(43,33,23,.88)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff8e1'; ctx.stroke();
  txt(ctx, text, x, y + 11, 9, '#fff8e1');
}
function blush(ctx: CanvasRenderingContext2D, x: number, y: number, w = 6, h = 3.6, a = 0.5) {
  ctx.fillStyle = `rgba(255,130,140,${a})`;
  ell(ctx, x, y, w, h);
}
function grassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number) {
  const sway = Math.sin(t * 1.8 + seed * 1.7) * 1.8;
  ctx.lineCap = 'round';
  for (const [ox, hh] of [[-5, -9], [0, -12], [5, -8]] as [number, number][]) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(x + ox * s, y); ctx.lineTo(x + ox * s + sway, y + hh * s); ctx.stroke();
    ctx.strokeStyle = '#5da93c'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + ox * s, y); ctx.lineTo(x + ox * s + sway, y + hh * s); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ell(ctx, x + sway * 0.5, y - 10 * s, 1.6, 1);
}
function flower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, petal: string, center = '#ffeb3b') {
  ctx.fillStyle = 'rgba(30,60,20,.25)'; ell(ctx, x + 1, y + 3, s * 0.7, s * 0.3);
  ctx.strokeStyle = '#2f6b2f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 9); ctx.stroke();
  ctx.fillStyle = '#3d8a3d';
  ctx.beginPath(); ctx.ellipse(x - 3, y + 6, 3, 1.6, -0.5, 0, 7); ctx.fill();
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = petal;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.42, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
  }
  ctx.fillStyle = center;
  ctx.beginPath(); ctx.arc(x, y, s * 0.34, 0, 7); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.arc(x - 1, y - 1, s * 0.1, 0, 7); ctx.fill();
}
function stone(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, base = '#c3ced6') {
  shadow(ctx, x + 1, y + ry * 0.8, rx * 0.9, ry * 0.4, 0.18);
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.32, ry * 0.28, -0.4, 0, 7); ctx.fill();
}
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a = 0.95) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(60,80,120,.15)'; ell(ctx, x + 2, y + 6, s * 1.5, s * 0.5);
  const puffs: [number, number, number][] = [[-s, 0, s * 0.62], [-s * 0.3, -s * 0.35, s * 0.8], [s * 0.5, -s * 0.25, s * 0.7], [s * 1.05, 0, s * 0.55]];
  for (const [ox, oy, pr] of puffs) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + ox, y + oy, pr, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(90,110,150,.85)'; ctx.stroke();
  }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s * 1.2, y - 2, s * 2.4, s * 0.62);
  ctx.fillStyle = 'rgba(180,220,255,.5)'; ell(ctx, x - s * 0.3, y + s * 0.3, s * 0.9, s * 0.28);
  ctx.restore();
}
function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000;
}
// modulo dương + quy ước layer trời (giống farm render.ts):
// mây parallax 0.2, hạt mưa/tuyết 0.3, vật bay thấp world-lock 1.0,
// mặt trời/mặt trăng/sao/vignette/phủ màu dính màn hình (vô cực)
function pmod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

// ---------- nền cỏ: gradient + mảng loang + quầng nắng + hoa cỏ ----------
function drawTownBase(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, H: number, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#93d668');
  bg.addColorStop(0.55, '#7cc74f');
  bg.addColorStop(1, '#6fb844');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const T = 48;
  const x0 = Math.floor(cam.x / T) * T, y0 = Math.floor(cam.y / T) * T;
  for (let gx = x0; gx < cam.x + W + T; gx += T) {
    for (let gy = y0; gy < cam.y + H + T; gy += T) {
      const odd = (Math.round(gx / T) + Math.round(gy / T)) % 2 === 0;
      ctx.fillStyle = odd ? 'rgba(255,255,255,.06)' : 'rgba(30,90,30,.06)';
      ctx.fillRect(gx - cam.x, gy - cam.y, T, T);
      const h = hash2(gx, gy);
      if (h > 0.72) {
        ctx.fillStyle = h > 0.88 ? 'rgba(255,255,180,.10)' : 'rgba(46,125,50,.12)';
        ell(ctx, gx - cam.x + h * 40, gy - cam.y + (1 - h) * 40, 20, 11);
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ell(ctx, gx - cam.x + h * 40 - 6, gy - cam.y + (1 - h) * 40 - 3, 8, 4);
      }
    }
  }
  // quầng nắng trôi chậm
  for (let k = 0; k < 3; k++) {
    const sx = ((k * 640 + t * 12) % (TOWN.w + 400)) - 200 - cam.x;
    const sy = ((k * 410 + 150) % TOWN.h) - cam.y;
    if (sx < -200 || sx > W + 200) continue;
    const g2 = ctx.createRadialGradient(sx, sy, 10, sx, sy, 220);
    g2.addColorStop(0, 'rgba(255,255,200,.10)');
    g2.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(sx, sy, 220, 0, 7); ctx.fill();
  }
  // hoa cỏ rải rác (né quảng trường + nhà + đường)
  for (let i = 0; i < 130; i++) {
    const fx = (i * 211.7) % TOWN.w, fy = (i * 349.3) % TOWN.h;
    if (Math.hypot(fx - PLAZA.x, fy - PLAZA.y) < PLAZA.r + 26) continue;
    if (fy > 590 && fy < 700) continue;
    if (fx > 750 && fx < 850) continue;
    let inside = false;
    for (const b of [TOWN_HALL, TOWN_CAFE, TOWN_SHOP, TOWN_CASINO, TOWN_HOUSE1, TOWN_HOUSE2, TOWN_STAGE]) {
      if (fx > b.x - 16 && fx < b.x + b.w + 16 && fy > b.y - 16 && fy < b.y + b.h + 16) inside = true;
    }
    if (inside) continue;
    const X = fx - cam.x, Y = fy - cam.y;
    if (X < -24 || Y < -24 || X > W + 24 || Y > H + 24) continue;
    if (i % 5 === 0) {
      flower(ctx, X, Y - 8, 6.5, ['#ff8fb0', '#ffffff', '#ffeb3b', '#ce93d8'][i % 4]);
      grassTuft(ctx, X + 8, Y, 1, t, i);
    } else grassTuft(ctx, X, Y, hash2(i, 7) > 0.5 ? 1 : 0.8, t, i);
  }
  // bồ công anh bay — world-lock, trôi theo gió trong map
  for (let i = 0; i < 6; i++) {
    const px = pmod(i * 397 + t * (18 + i * 4), TOWN.w) - cam.x;
    if (px < -40 || px > W + 40) continue;
    const pyBase = pmod(90 + ((i * 173) % 320), TOWN.h) - cam.y;
    if (pyBase < -40 || pyBase > H + 40) continue;
    const py = pyBase + Math.sin(t * 1.5 + i * 2) * 18;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 5, py - 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2 + t * 0.8 + i;
      ell(ctx, px + 5 + Math.cos(a) * 3.4, py - 4 + Math.sin(a) * 3.4, 1.3, 1.3);
    }
  }
}

// ---------- đường lát đá: viền + tim đường + sỏi + cỏ ven ----------
function stonePath(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, x: number, y: number, w: number, h: number, t: number, seed: number) {
  const X = x - cam.x, Y = y - cam.y;
  shadow(ctx, X + w / 2, Y + h + 3, w / 2 + 7, 6, 0.18);
  rr(ctx, X - 5, Y - 5, w + 10, h + 10, 12);
  ctx.fillStyle = '#8d8d94'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  const g = ctx.createLinearGradient(0, Y, 0, Y + h);
  g.addColorStop(0, '#ece7db'); g.addColorStop(0.5, '#ddd6c4'); g.addColorStop(1, '#c4bba6');
  rr(ctx, X, Y, w, h, 8); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.save();
  rr(ctx, X, Y, w, h, 8); ctx.clip();
  glint(ctx, X, Y, w, h);
  // vân đá lát
  ctx.strokeStyle = 'rgba(90,80,60,.25)'; ctx.lineWidth = 1.4;
  const step = 64;
  if (w >= h) {
    for (let vx = X + step; vx < X + w; vx += step) {
      ctx.beginPath(); ctx.moveTo(vx, Y); ctx.lineTo(vx, Y + h); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(X, Y + h / 2); ctx.lineTo(X + w, Y + h / 2); ctx.stroke();
  } else {
    for (let vy = Y + step; vy < Y + h; vy += step) {
      ctx.beginPath(); ctx.moveTo(X, vy); ctx.lineTo(X + w, vy); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(X + w / 2, Y); ctx.lineTo(X + w / 2, Y + h); ctx.stroke();
  }
  ctx.restore();
  void t; void seed;
}

function drawStreets(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  stonePath(ctx, cam, 0, 606, TOWN.w, 68, t, 1);
  stonePath(ctx, cam, 766, 60, 68, 1200, t, 2);
  // tim đường kẹo trắng
  const dotH = (x: number, y: number, w: number, h: number) => {
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,85,45,.7)'; ctx.stroke();
  };
  for (let x = 120; x < TOWN.w - 60; x += 64) {
    if (x + 22 > 758 && x < 842) continue;
    dotH(x - cam.x, 636 - cam.y, 26, 8);
  }
  for (let y = 120; y < 1240; y += 60) {
    if (y + 18 > 598 && y < 682) continue;
    dotH(796 - cam.x, y - cam.y, 8, 20);
  }
  // vạch qua đường trước quảng trường (đông + tây)
  for (const zx of [440, 1090]) {
    for (let k = 0; k < 4; k++) {
      const X = zx + k * 18 - cam.x, Y = 610 - cam.y;
      rr(ctx, X, Y, 11, 60, 4); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(90,80,60,.6)'; ctx.stroke();
    }
  }
  // sỏi + đá viền + cỏ ven đường
  for (let i = 0; i < 26; i++) {
    const px = (i * 173) % TOWN.w - cam.x, py = 616 + ((i * 97) % 48) - cam.y;
    ctx.fillStyle = i % 2 ? '#c9c2b2' : '#efe9da';
    ctx.beginPath(); ctx.ellipse(px, py, 3.4, 2.3, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(90,80,60,.6)'; ctx.stroke();
  }
  for (let x = 40; x < TOWN.w; x += 120) {
    grassTuft(ctx, x - cam.x, 600 - cam.y, 0.9, t, x);
    grassTuft(ctx, x + 50 - cam.x, 680 - cam.y, 0.9, t, x + 5);
    if (x % 360 === 40) {
      flower(ctx, x + 70 - cam.x, 594 - cam.y, 6, '#ff8fb0');
      flower(ctx, x + 20 - cam.x, 686 - cam.y, 6, '#ffffff');
    }
  }
  for (let y = 120; y < 1200; y += 140) {
    stone(ctx, 758 - cam.x, y - cam.y, 7, 5);
    stone(ctx, 842 - cam.x, y - cam.y, 7, 5);
  }
}

// ---------- quảng trường: 3 vòng đá + khảm sao + bồn hoa ----------
function drawPlaza(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = PLAZA.x - cam.x, Y = PLAZA.y - cam.y;
  shadow(ctx, X, Y + 8, PLAZA.r + 10, 22, 0.2);
  const rings: [number, string][] = [[PLAZA.r, '#d9d2c2'], [PLAZA.r - 40, '#ece7db'], [PLAZA.r - 90, '#d9d2c2']];
  for (const [r, col] of rings) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  }
  // khảm cánh sao quanh đài phun nước
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const px = X + Math.cos(a) * 132, py = Y + Math.sin(a) * 132;
    ctx.fillStyle = k % 2 ? '#ffd24d' : '#ff9ebb';
    ctx.beginPath(); ctx.ellipse(px, py, 9, 5.5, a, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(px - 2, py - 1.5, 2.6, 1.4, a, 0, 7); ctx.fill();
  }
  // vân đá lát nan quạt
  ctx.strokeStyle = 'rgba(90,80,60,.3)'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.2;
    ctx.beginPath(); ctx.moveTo(X + Math.cos(a) * 170, Y + Math.sin(a) * 170);
    ctx.lineTo(X + Math.cos(a) * PLAZA.r, Y + Math.sin(a) * PLAZA.r); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(90,80,60,.25)';
  for (const r of [200, 250]) {
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke();
  }
  // bồn hoa 4 góc chéo
  for (const [ox, oy, col] of [[-225, -175, '#ff8fb0'], [225, -175, '#ffffff'], [-225, 175, '#ffeb3b'], [225, 175, '#ce93d8']] as [number, number, string][]) {
    const bx = X + ox, by = Y + oy;
    shadow(ctx, bx, by + 12, 26, 6, 0.2);
    frame(ctx, bx - 28, by - 6, 56, 20, 8, '#9a6530', 2.6);
    frame(ctx, bx - 24, by - 10, 48, 10, 5, '#5da93c', 2);
    flower(ctx, bx - 14, by - 16, 7, col);
    flower(ctx, bx, by - 20, 7.5, '#ffffff');
    flower(ctx, bx + 14, by - 16, 7, col);
    grassTuft(ctx, bx - 20, by - 8, 0.9, t, ox);
  }
  if (Math.sin(t * 2) > 0.5) drawSparkle(ctx, X - 180, Y - 120, 5, 0.8);
  if (Math.cos(t * 1.7) > 0.5) drawSparkle(ctx, X + 170, Y + 130, 5, 0.8);
}

// ---------- đài phun nước: bể 2 tầng + xu ước nguyện + cầu vồng ----------
function drawFountain(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const X = FOUNTAIN.x - cam.x, Y = FOUNTAIN.y - cam.y;
  shadow(ctx, X, Y + FOUNTAIN.r * 0.5, FOUNTAIN.r + 8, 12, 0.25);
  const stoneRings: [number, number][] = [[FOUNTAIN.r, 0], [FOUNTAIN.r - 26, -6]];
  for (const [r, dy] of stoneRings) {
    const g = ctx.createLinearGradient(0, Y - r * 0.4 + dy, 0, Y + r * 0.4 + dy);
    g.addColorStop(0, '#e6edf2'); g.addColorStop(0.5, '#b9c9d4'); g.addColorStop(1, '#8fa5b3');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(X, Y + dy, r, r * 0.55, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(X - r * 0.4, Y + dy - r * 0.18, r * 0.3, r * 0.1, -0.3, 0, 7); ctx.fill();
  }
  // mặt nước
  const wg = ctx.createRadialGradient(X, Y - 2, 4, X, Y - 2, FOUNTAIN.r - 30);
  wg.addColorStop(0, '#c8f4ff'); wg.addColorStop(0.6, '#4fc3f7'); wg.addColorStop(1, '#1d7fb8');
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.ellipse(X, Y - 6, FOUNTAIN.r - 34, (FOUNTAIN.r - 34) * 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ell(ctx, X - 20, Y - 14, 15, 4);
  ell(ctx, X + 12, Y - 2, 9, 2.6);
  // đồng xu ước nguyện lấp lánh dưới đáy
  for (let k = 0; k < 5; k++) {
    const h = hash2(k, 11);
    const cxp = X - 26 + h * 52, cyp = Y - 8 + hash2(k, 23) * 12;
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.ellipse(cxp, cyp, 3.4, 2.4, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(120,70,0,.7)'; ctx.stroke();
    if (Math.sin(t * 3 + k * 2) > 0.6) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cxp - 1, cyp - 0.8, 0.9, 0, 7); ctx.fill();
    }
  }
  // cột giữa + chim đá + 3 tia nước
  frame(ctx, X - 10, Y - 52, 20, 52, 8, '#cfd8dc', 2.6);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(X - 7, Y - 50, 5, 48);
  ctx.fillStyle = '#90a4ae';
  ctx.beginPath(); ctx.arc(X, Y - 58, 7, 0, 7); ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = '#78909c';
  ctx.beginPath(); ctx.moveTo(X - 7, Y - 58); ctx.lineTo(X - 12, Y - 64); ctx.lineTo(X - 6, Y - 62); ctx.closePath(); ctx.fill();
  for (const [ox, hh, ph] of [[-22, 44, 0], [0, 58, 2], [22, 44, 4]] as [number, number, number][]) {
    const topY = Y - 52 - hh + Math.sin(t * 3 + ph) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X + ox * 0.3, Y - 52); ctx.quadraticCurveTo(X + ox * 0.7, Y - 52 - hh * 0.6, X + ox, topY); ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,.95)';
    ell(ctx, X + ox, topY, 4, 6);
    for (let d = 0; d < 3; d++) {
      const dy = ((t * 40 + d * 16 + ph * 9) % 30);
      ctx.fillStyle = 'rgba(190,235,255,.85)';
      ell(ctx, X + ox * 0.8, topY + 8 + dy, 1.8, 2.6);
    }
    // gợn sóng nơi tia rơi
    const rad = 8 + ((t * 18 + ph * 7) % 14);
    ctx.globalAlpha = Math.max(0, 1 - rad / 24);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(X + ox * 0.8, Y - 2, rad, rad * 0.36, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // cầu vồng mờ + tia lấp lánh xoay
  ctx.globalAlpha = 0.35;
  for (let b = 0; b < 3; b++) {
    ctx.strokeStyle = ['#ff8a80', '#ffd54f', '#80d8ff'][b];
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(X + 30, Y - 10, 26 - b * 5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 3; k++) {
    const a = t * 0.9 + k * 2.1;
    const sx = X + Math.cos(a) * (FOUNTAIN.r + 8), sy = Y + Math.sin(a) * (FOUNTAIN.r * 0.5 + 6);
    if (Math.sin(t * 2 + k * 2) > 0.1) drawSparkle(ctx, sx, sy, 5, 0.85);
  }
  if (night) {
    const g = ctx.createRadialGradient(X, Y - 10, 4, X, Y - 10, 110);
    g.addColorStop(0, 'rgba(140,220,255,.4)'); g.addColorStop(1, 'rgba(140,220,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y - 10, 110, 0, 7); ctx.fill();
  }
  namePill(ctx, X, Y + FOUNTAIN.r * 0.5 + 26, 'Đài phun ước nguyện');
}

// ---------- nhà anime cao cấp: half-timber + mái ngói + cửa sổ lattice + cửa đôi ----------
// Mỗi nhà có id riêng để vẽ chi tiết đặc trưng (cột hội quán / hiên cafe / mái hiên shop / vườn nhà dân)
interface BuildingOpts {
  id: 'hall' | 'cafe' | 'shop' | 'house';
  /** dáng mái riêng từng nhà: ngói / tai mèo / 2 tầng / rơm / mái lệch */
  roof?: 'tile' | 'catear' | 'double' | 'thatch' | 'lean';
  /** màu tường riêng (mặc định kem) */
  wall?: string;
  roofTop: string; roofBot: string; sign: string;
  noren?: [string, string, string]; // rèm 3 mảnh (cafe/shop)
  chimney?: boolean;
}
/** Mái ngói vảy cá dùng chung (tam giác + vệt nắng + 3 hàng ngói + diềm vỏ sò + sống mái) */
function tileRoof(ctx: CanvasRenderingContext2D, cx: number, ridge: number, eave: number, halfW: number, over: number, top: string, bot: string, t: number, seedX: number) {
  const g = ctx.createLinearGradient(0, ridge, 0, eave);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.beginPath();
  ctx.moveTo(cx - halfW - over, eave);
  ctx.lineTo(cx - 13, ridge);
  ctx.lineTo(cx + 13, ridge);
  ctx.lineTo(cx + halfW + over, eave);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - halfW - over, eave);
  ctx.lineTo(cx - 13, ridge);
  ctx.lineTo(cx + 13, ridge);
  ctx.lineTo(cx + halfW + over, eave);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.38)';
  ctx.beginPath();
  ctx.moveTo(cx - halfW - over + 10, eave);
  ctx.lineTo(cx - 6, ridge + 4);
  ctx.lineTo(cx + 4, ridge + 4);
  ctx.lineTo(cx - halfW + over + 2, eave);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,15,.4)'; ctx.lineWidth = 1.8;
  for (let row = 0; row < 3; row++) {
    const yy = ridge + 12 + row * 14;
    const spread = (halfW + over) * ((yy - ridge) / Math.max(1, eave - ridge));
    ctx.beginPath(); ctx.moveTo(cx - spread, yy); ctx.lineTo(cx + spread, yy); ctx.stroke();
    for (let vx = -Math.floor(spread / 13); vx <= Math.floor(spread / 13); vx++) {
      ctx.beginPath(); ctx.arc(cx + vx * 13, yy, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
  const n = Math.max(4, Math.floor(((halfW + over) * 2) / 20));
  for (let i = 0; i <= n; i++) {
    const sx = cx - halfW - over + ((halfW + over) * 2) * (i / n);
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath(); ctx.arc(sx, eave + 3, 6.5, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  }
  frame(ctx, cx - 20, ridge - 12, 40, 12, 6, '#fff8e1', 2.6);
  for (const ex of [-1, 1]) {
    ctx.fillStyle = bot;
    ctx.beginPath(); ctx.ellipse(cx + ex * 26, ridge - 12, 6, 12, ex * 0.35, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.ellipse(cx + ex * 26 - 2, ridge - 16, 2, 4, ex * 0.35, 0, 7); ctx.fill();
  }
  if (Math.sin(t * 2 + seedX) > 0.55) drawSparkle(ctx, cx + halfW - 6, ridge + 8, 4.5, 0.85);
}
function drawBuilding(
  ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number,
  b: { x: number; y: number; w: number; h: number },
  opts: BuildingOpts, night: boolean,
) {
  const X = b.x - cam.x, Y = b.y - cam.y;
  if (X + b.w < -80 || X > 3000 || Y + b.h < -120 || Y > 2000) return;
  const cx = X + b.w / 2;
  shadow(ctx, X + b.w / 2, Y + b.h + 4, b.w / 2 + 6, 8, 0.24);
  // móng đá cao có vân
  frame(ctx, X - 6, Y + b.h - 10, b.w + 12, 16, 5, '#aeb9c2', 2.4);
  ctx.strokeStyle = 'rgba(70,85,95,.5)'; ctx.lineWidth = 1.4;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath(); ctx.moveTo(X - 6 + (b.w + 12) * k / 4, Y + b.h - 8); ctx.lineTo(X - 6 + (b.w + 12) * k / 4, Y + b.h + 4); ctx.stroke();
  }
  // tường + má hồng + vệt nắng (màu tường riêng từng nhà)
  frame(ctx, X, Y, b.w, b.h, 10, opts.wall ?? '#fff3d6', 3.2);
  ctx.save();
  rr(ctx, X, Y, b.w, b.h, 10); ctx.clip();
  glint(ctx, X, Y, b.w, b.h);
  // chân tường gỗ wainscot + vân ván
  ctx.fillStyle = '#c98a4b';
  ctx.fillRect(X, Y + b.h - 46, b.w, 46);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(X, Y + b.h - 46, b.w, 4);
  ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(X, Y + b.h - 46); ctx.lineTo(X + b.w, Y + b.h - 46); ctx.stroke();
  for (let vx = X + 24; vx < X + b.w; vx += 26) {
    ctx.beginPath(); ctx.moveTo(vx, Y + b.h - 42); ctx.lineTo(vx, Y + b.h); ctx.stroke();
  }
  ctx.restore();
  // dầm gỗ half-timber dọc
  for (const bx of [X + 14, X + b.w - 14]) {
    const bgBeam = ctx.createLinearGradient(bx - 5, 0, bx + 5, 0);
    bgBeam.addColorStop(0, '#7c4f21'); bgBeam.addColorStop(0.5, '#a9763b'); bgBeam.addColorStop(1, '#7c4f21');
    frame(ctx, bx - 5, Y + 6, 10, b.h - 58, 4, bgBeam, 2.2);
  }
  ctx.fillStyle = 'rgba(255,180,190,.28)';
  ell(ctx, X + 60, Y + b.h - 58, 14, 7);
  ell(ctx, X + b.w - 60, Y + b.h - 58, 14, 7);
  // ---- mái: mỗi nhà một dáng ----
  const ridge = Y - 52, eave = Y + 4, halfW = b.w / 2;
  // bóng mái hắt lên tường
  ctx.fillStyle = 'rgba(60,30,15,.25)';
  ctx.fillRect(X + 4, Y, b.w - 8, 10);
  const roofKind = opts.roof ?? 'tile';
  if (roofKind === 'double') {
    // SHOP: mái 2 tầng kiểu tháp — tầng dưới xòe + tường hồi + tầng trên nhỏ
    tileRoof(ctx, cx, Y - 30, eave, halfW, 24, opts.roofTop, opts.roofBot, t, X);
    frame(ctx, cx - halfW * 0.52, Y - 52, halfW * 1.04, 24, 6, opts.wall ?? '#fff3d6', 2.6);
    ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(cx, Y - 40, 9, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#9ecfff'; ctx.beginPath(); ctx.arc(cx, Y - 40, 6.5, 0, 7); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(cx - 6.5, Y - 40); ctx.lineTo(cx + 6.5, Y - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, Y - 46.5); ctx.lineTo(cx, Y - 33.5); ctx.stroke();
    tileRoof(ctx, cx, Y - 78, Y - 50, halfW * 0.52, 12, opts.roofTop, opts.roofBot, t, X + 40);
  } else if (roofKind === 'catear') {
    // CAFE MÈO: mái ngói + 2 tai mèo + chuông
    tileRoof(ctx, cx, ridge, eave, halfW, 20, opts.roofTop, opts.roofBot, t, X);
    for (const ex of [-1, 1]) {
      const exx = cx + ex * halfW * 0.52, eyy = ridge - 4;
      ctx.fillStyle = opts.roofBot;
      ctx.beginPath(); ctx.moveTo(exx - 16, eyy + 6); ctx.lineTo(exx - 8, eyy - 22); ctx.lineTo(exx + 8, eyy); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = '#ffc2d4';
      ctx.beginPath(); ctx.moveTo(exx - 9, eyy + 2); ctx.lineTo(exx - 6, eyy - 12); ctx.lineTo(exx + 1, eyy - 1); ctx.closePath(); ctx.fill();
    }
    // chuông mèo giữa 2 tai
    const swayB = Math.sin(t * 2.4 + X) * 2;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, ridge - 10); ctx.lineTo(cx + swayB, ridge - 2); ctx.stroke();
    const bgBell = ctx.createRadialGradient(cx + swayB - 2, ridge, 1, cx + swayB, ridge + 4, 9);
    bgBell.addColorStop(0, '#fff3b0'); bgBell.addColorStop(1, '#d99a00');
    ctx.fillStyle = bgBell;
    ctx.beginPath(); ctx.arc(cx + swayB, ridge + 4, 7, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#7c4f21';
    ctx.beginPath(); ctx.arc(cx + swayB, ridge + 9, 2, 0, 7); ctx.fill();
  } else if (roofKind === 'thatch') {
    // NHÀ RƠM: mái tranh dày + vân rơm + chùm hồng khô treo diềm
    const g2 = ctx.createLinearGradient(0, ridge, 0, eave);
    g2.addColorStop(0, '#f0d48a'); g2.addColorStop(0.6, '#d9a94f'); g2.addColorStop(1, '#9a7030');
    ctx.beginPath();
    ctx.moveTo(cx - halfW - 18, eave);
    ctx.lineTo(cx - 11, ridge);
    ctx.lineTo(cx + 11, ridge);
    ctx.lineTo(cx + halfW + 18, eave);
    ctx.closePath();
    ctx.fillStyle = g2; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
    // vân rơm xiên
    ctx.strokeStyle = 'rgba(120,80,20,.45)'; ctx.lineWidth = 1.6;
    for (let row = 0; row < 4; row++) {
      const yy = ridge + 10 + row * 11;
      const spread = (halfW + 18) * ((yy - ridge) / Math.max(1, eave - ridge));
      for (let vx = -Math.floor(spread / 16); vx <= Math.floor(spread / 16); vx++) {
        ctx.beginPath(); ctx.moveTo(cx + vx * 16, yy); ctx.lineTo(cx + vx * 16 - 5, yy + 9); ctx.stroke();
      }
    }
    // gờ rơm cuộn chân mái
    frame(ctx, cx - halfW - 20, eave - 2, (halfW + 20) * 2, 12, 6, '#c8912a', 2.6);
    ctx.strokeStyle = 'rgba(120,80,20,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx - halfW - 20, eave + 4); ctx.lineTo(cx + halfW + 20, eave + 4); ctx.stroke();
    // dây buộc + chùm hồng khô
    for (const bx of [-halfW * 0.5, 0, halfW * 0.5]) {
      ctx.strokeStyle = '#7c4f21'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(cx + bx, ridge + 2); ctx.lineTo(cx + bx, eave + 10); ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const px = cx + bx + (k - 1) * 2, py = eave + 14 + k * 7 + Math.sin(t * 2 + bx + k) * 1.2;
        const pg = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 6);
        pg.addColorStop(0, '#ffb74d'); pg.addColorStop(1, '#e65100');
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = '#4a3226';
        ctx.fillRect(px - 1.5, py - 7, 3, 2.5);
      }
    }
    frame(ctx, cx - 16, ridge - 12, 32, 12, 6, '#e8c872', 2.4);
  } else if (roofKind === 'lean') {
    // NHÀ MÁI LỆCH: một mái dốc + diềm gỗ + chong chóng quay
    const g3 = ctx.createLinearGradient(0, Y - 58, 0, Y + 2);
    g3.addColorStop(0, opts.roofTop); g3.addColorStop(1, opts.roofBot);
    ctx.beginPath();
    ctx.moveTo(cx - halfW - 18, Y - 18);
    ctx.lineTo(cx + halfW + 18, Y - 58);
    ctx.lineTo(cx + halfW + 18, Y - 46);
    ctx.lineTo(cx - halfW - 18, Y - 6);
    ctx.closePath();
    ctx.fillStyle = g3; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,15,.4)'; ctx.lineWidth = 1.6;
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - halfW - 14 + k * 8, Y - 14);
      ctx.lineTo(cx + halfW + 14 + k * 8, Y - 54);
      ctx.stroke();
    }
    // diềm gỗ mặt dốc thấp
    frame(ctx, cx - halfW - 20, Y - 12, 26, 10, 4, '#7c4f21', 2.4);
    // chong chóng quay trên đỉnh
    const wx = cx + halfW * 0.4, wy = Y - 72;
    ctx.fillStyle = '#5d4037';
    rr(ctx, wx - 2.5, wy, 5, 18, 2.5); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    const spin = t * 3 + X;
    ctx.save(); ctx.translate(wx, wy - 4); ctx.rotate(spin % (Math.PI * 2));
    ctx.fillStyle = '#ff5b5b';
    for (let k = 0; k < 3; k++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath(); ctx.ellipse(8, 0, 7, 3.4, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(wx, wy - 4, 3.4, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  } else {
    tileRoof(ctx, cx, ridge, eave, halfW, 20, opts.roofTop, opts.roofBot, t, X);
  }
  // ống khói + khói puff
  if (opts.chimney) {
    frame(ctx, cx + halfW - 52, ridge - 34, 22, 30, 4, '#b0bec5', 2.6);
    frame(ctx, cx + halfW - 56, ridge - 38, 30, 8, 4, '#78909c', 2.4);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.32 + i / 3) % 1;
      const yy = ridge - 40 - p * 42, xx = cx + halfW - 41 + Math.sin(t * 1.5 + i * 2) * 6 * p;
      ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(xx, yy, 4 + p * 6, 0, 7); ctx.fill();
    }
  }
  // cửa đôi vòm + bậc thềm đá + thảm + vòng hoa
  {
    const dx = cx, dy = Y + b.h;
    // bậc thềm 2 cấp + thảm
    frame(ctx, dx - 32, dy + 2, 64, 8, 4, '#c3ced6', 2.2);
    frame(ctx, dx - 26, dy - 4, 52, 8, 4, '#dbe4ea', 2.2);
    ctx.fillStyle = opts.id === 'hall' ? '#d6336c' : '#3b82f6';
    rr(ctx, dx - 16, dy - 4, 32, 8, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(dx - 16, dy - 4, 32, 2.5);
    // khung vòm
    ctx.beginPath();
    ctx.moveTo(dx - 23, dy - 4);
    ctx.lineTo(dx - 23, dy - 52);
    ctx.arc(dx, dy - 52, 23, Math.PI, 0);
    ctx.lineTo(dx + 23, dy - 4);
    ctx.closePath();
    ctx.fillStyle = '#6d4c41'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    // 2 cánh cửa có panel
    for (const sgn of [-1, 1]) {
      const dg = ctx.createLinearGradient(dx + sgn * 21 - 10, 0, dx + sgn * 21 + 10, 0);
      dg.addColorStop(0, '#8b5a2b'); dg.addColorStop(0.5, '#d99a55'); dg.addColorStop(1, '#8b5a2b');
      ctx.fillStyle = dg;
      if (sgn < 0) {
        ctx.beginPath();
        ctx.moveTo(dx - 20, dy - 4);
        ctx.lineTo(dx - 20, dy - 50);
        ctx.arc(dx, dy - 50, 20, Math.PI, Math.PI * 1.5);
        ctx.lineTo(dx, dy - 4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(dx, dy - 4);
        ctx.lineTo(dx, dy - 70 + 20);
        ctx.arc(dx, dy - 50, 20, Math.PI * 1.5, 0);
        ctx.lineTo(dx + 20, dy - 4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.lineWidth = 2.4; ctx.strokeStyle = OUT;
      // panel lõm
      rr(ctx, dx + sgn * 15 - 5, dy - 44, 10, 18, 4);
      ctx.strokeStyle = 'rgba(90,50,20,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
      rr(ctx, dx + sgn * 15 - 5, dy - 22, 10, 12, 4); ctx.stroke();
      // núm đồng
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(dx + sgn * 4, dy - 30, 3.2, 0, 7); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(dx + sgn * 4 - 1, dy - 31, 1, 0, 7); ctx.fill();
    }
    // vòng hoa treo cửa
    const swayW = Math.sin(t * 1.8 + X) * 1.2;
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(dx, dy - 70); ctx.lineTo(dx + swayW, dy - 62); ctx.stroke();
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(dx + swayW, dy - 54, 7, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ff5b5b';
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4;
      ctx.beginPath(); ctx.arc(dx + swayW + Math.cos(a) * 7, dy - 54 + Math.sin(a) * 7, 2, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath(); ctx.moveTo(dx + swayW - 3, dy - 46); ctx.lineTo(dx + swayW + 3, dy - 46); ctx.lineTo(dx + swayW, dy - 41); ctx.closePath(); ctx.fill();
    if (night) {
      ctx.fillStyle = 'rgba(255,200,100,.35)';
      ctx.beginPath(); ctx.ellipse(dx, dy + 8, 34, 6, 0, 0, 7); ctx.fill();
    }
  }
  // cửa sổ gác mái tròn có nan chữ thập
  {
    const ax = cx, ay = Y + 18;
    ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(ax, ay, 13, 0, 7); ctx.fill();
    ctx.lineWidth = 2.8; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = night ? '#ffd98a' : '#bfe6ff';
    ctx.beginPath(); ctx.arc(ax, ay, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax - 10, ay); ctx.lineTo(ax + 10, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay - 10); ctx.lineTo(ax, ay + 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(ax, ay, 7, Math.PI * 1.05, Math.PI * 1.4); ctx.stroke();
  }
  // cửa sổ lattice 2 bên: nan gỗ + rèm + bồn hoa, đêm sáng ấm
  for (const wx of [X + 52, X + b.w - 52]) {
    const wy = Y + 62, ww = 34, wh = 40;
    shadow(ctx, wx, wy + wh / 2 + 3, ww / 2, 4, 0.18);
    frame(ctx, wx - ww / 2 - 3, wy - 3, ww + 6, wh + 6, 7, '#8b5a2b', 2.6);
    if (night) {
      const wg2 = ctx.createLinearGradient(0, wy, 0, wy + wh);
      wg2.addColorStop(0, '#ffedb0'); wg2.addColorStop(1, '#ff9e4d');
      ctx.fillStyle = wg2; ctx.fillRect(wx - ww / 2, wy, ww, wh);
    } else {
      const wg2 = ctx.createLinearGradient(0, wy, 0, wy + wh);
      wg2.addColorStop(0, '#d8f1ff'); wg2.addColorStop(1, '#5aa9dd');
      ctx.fillStyle = wg2; ctx.fillRect(wx - ww / 2, wy, ww, wh);
    }
    // rèm vải trên
    ctx.fillStyle = 'rgba(255,110,140,.9)';
    ctx.beginPath();
    ctx.moveTo(wx - ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2 - 4, wy + 12 + Math.sin(t * 2 + wx) * 1.5);
    ctx.lineTo(wx - ww / 2 + 4, wy + 12 + Math.sin(t * 2 + wx + 1) * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
    // nan lattice
    ctx.strokeStyle = '#fff8e1'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(wx, wy + 10); ctx.lineTo(wx, wy + wh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx - ww / 2, wy + wh * 0.62); ctx.lineTo(wx + ww / 2, wy + wh * 0.62); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(wx, wy + 10); ctx.lineTo(wx, wy + wh); ctx.stroke();
    // bóng mèo ngó ra
    ctx.fillStyle = night ? 'rgba(90,50,20,.75)' : 'rgba(40,80,140,.55)';
    const lookX = wx + Math.sin(t * 1.1 + wx * 0.1) * 6;
    ctx.beginPath(); ctx.arc(lookX, wy + wh - 8, 5.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(lookX - 5, wy + wh - 11); ctx.lineTo(lookX - 3, wy + wh - 17); ctx.lineTo(lookX - 1, wy + wh - 11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(lookX + 1, wy + wh - 11); ctx.lineTo(lookX + 3, wy + wh - 17); ctx.lineTo(lookX + 5, wy + wh - 11); ctx.closePath(); ctx.fill();
    // bồn hoa dưới cửa
    frame(ctx, wx - 20, wy + wh + 6, 40, 11, 4, '#9a6530', 2.2);
    flower(ctx, wx - 12, wy + wh + 2, 5, '#ff8fb0');
    flower(ctx, wx, wy + wh - 1, 5.5, '#ffffff');
    flower(ctx, wx + 12, wy + wh + 2, 5, '#ffeb3b');
    if (night) {
      const halo = ctx.createRadialGradient(wx, wy + wh / 2, 2, wx, wy + wh / 2, 40);
      halo.addColorStop(0, 'rgba(255,205,100,.35)'); halo.addColorStop(1, 'rgba(255,205,100,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(wx, wy + wh / 2, 40, 0, 7); ctx.fill();
    }
  }
  // rèm noren 3 mảnh cho cafe/shop
  if (opts.noren) {
    const ny = Y + b.h - 46;
    const labels = opts.noren;
    for (let k = 0; k < 3; k++) {
      const fx = cx - 30 + k * 20;
      const sway = Math.sin(t * 2.2 + k * 1.5 + X * 0.01) * 1.6;
      ctx.fillStyle = ['#ff5b8b', '#fff8e1', '#3b82f6'][k % 3];
      ctx.beginPath();
      ctx.moveTo(fx, ny);
      ctx.lineTo(fx + 18, ny);
      ctx.lineTo(fx + 18 + sway, ny + 22);
      ctx.lineTo(fx + sway, ny + 22);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      if (k !== 1) txt(ctx, labels[k], fx + 9 + sway * 0.5, ny + 15, 9, k === 0 ? '#fff' : '#2b2117');
    }
  }
  // lồng đèn treo cạnh cửa + chậu hoa 2 bên
  {
    const lx = cx - 44 + Math.sin(t * 2 + X) * 1.5, ly = Y + 66;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 44, Y + 52); ctx.lineTo(lx, ly - 9); ctx.stroke();
    const lg = ctx.createLinearGradient(0, ly - 9, 0, ly + 9);
    lg.addColorStop(0, night ? '#fff3b0' : '#ffe9a8'); lg.addColorStop(1, '#ff9e2c');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(lx, ly, 7.5, 9, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath(); ctx.arc(lx, ly + 11, 2, 0, 7); ctx.fill();
    if (night) {
      const halo = ctx.createRadialGradient(lx, ly, 2, lx, ly, 44);
      halo.addColorStop(0, 'rgba(255,205,90,.55)'); halo.addColorStop(1, 'rgba(255,205,90,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(lx, ly, 44, 0, 7); ctx.fill();
    }
    for (const px of [X + 16, X + b.w - 16]) {
      frame(ctx, px - 9, Y + b.h - 16, 18, 13, 4, '#b5651d', 2.2);
      flower(ctx, px - 4, Y + b.h - 20, 5.5, '#ff8fb0');
      flower(ctx, px + 4, Y + b.h - 22, 5.5, '#ffffff');
      grassTuft(ctx, px, Y + b.h - 14, 0.8, t, px);
    }
  }
  // ---- chi tiết đặc trưng từng nhà ----
  drawBuildingExtra(ctx, X, Y, b.w, b.h, cx, opts, t, night);
  // biển treo tên có dây
  ctx.font = `bold 11px 'Be Vietnam Pro', monospace`;
  const tw = Math.min(230, ctx.measureText(opts.sign).width + 32);
  const yy = Y + 24 + Math.sin(t * 1.6 + X * 0.02) * 1.2;
  ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 10, yy - 12); ctx.lineTo(cx - tw / 2 + 10, yy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + tw / 2 - 10, yy - 12); ctx.lineTo(cx + tw / 2 - 10, yy); ctx.stroke();
  rr(ctx, cx - tw / 2, yy, tw, 23, 10);
  const sg = ctx.createLinearGradient(0, yy, 0, yy + 23);
  sg.addColorStop(0, '#a9763b'); sg.addColorStop(1, '#7c4f21');
  ctx.fillStyle = sg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  rr(ctx, cx - tw / 2 + 4, yy + 4, tw - 8, 15, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(cx - tw / 2 + 7, yy + 6, tw - 14, 2.5);
  txt(ctx, opts.sign, cx, yy + 16, 11, '#fff3d6');
}

// ---------- chi tiết riêng từng nhà: cột / hiên / mái hiên / vườn ----------
function drawBuildingExtra(
  ctx: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, cx: number,
  opts: BuildingOpts, t: number, night: boolean,
) {
  const dy = Y + h;
  if (opts.id === 'hall') {
    // 2 cột hiên + đầu cột + đèn đá 2 bên thềm
    for (const ox of [-56, 56]) {
      const px = cx + ox;
      shadow(ctx, px, dy + 4, 10, 3, 0.2);
      const cg = ctx.createLinearGradient(px - 8, 0, px + 8, 0);
      cg.addColorStop(0, '#b0a89a'); cg.addColorStop(0.5, '#efe9da'); cg.addColorStop(1, '#b0a89a');
      frame(ctx, px - 8, dy - 78, 16, 78, 5, cg, 2.6);
      frame(ctx, px - 12, dy - 86, 24, 10, 4, '#8b5a2b', 2.4);
      frame(ctx, px - 12, dy - 6, 24, 8, 3, '#8b5a2b', 2.2);
    }
    // mái hiên tam giác trên cột
    ctx.beginPath();
    ctx.moveTo(cx - 76, dy - 78);
    ctx.lineTo(cx, dy - 112);
    ctx.lineTo(cx + 76, dy - 78);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, dy - 112, 0, dy - 78);
    pg.addColorStop(0, '#ff7a6b'); pg.addColorStop(1, '#a02318');
    ctx.fillStyle = pg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
    // cờ hội quán tung bay
    const fx = cx, fy = dy - 132;
    ctx.fillStyle = '#5d4037';
    rr(ctx, fx - 3, fy, 6, 34, 3); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    const wave = Math.sin(t * 3) * 3;
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(fx + 3, fy + 1);
    ctx.quadraticCurveTo(fx + 22, fy + 3 + wave, fx + 38, fy + 1 + wave);
    ctx.lineTo(fx + 38, fy + 15 + wave);
    ctx.quadraticCurveTo(fx + 22, fy + 13 + wave, fx + 3, fy + 15);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#d6336c';
    ctx.beginPath(); ctx.arc(fx + 16, fy + 8 + wave * 0.5, 4, 0, 7); ctx.fill();
    // đồng hồ mặt tiền chạy giờ thật
    {
      const clockX = cx, clockY = dy - 95;
      ctx.fillStyle = '#fff8e1';
      ctx.beginPath(); ctx.arc(clockX, clockY, 12, 0, 7); ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.arc(clockX + Math.cos(a) * 9, clockY + Math.sin(a) * 9, k % 3 === 0 ? 1.4 : 0.8, 0, 7); ctx.fill();
      }
      const nowD = new Date();
      const ha = ((nowD.getHours() % 12) + nowD.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
      const ma = (nowD.getMinutes() + nowD.getSeconds() / 60) / 60 * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = OUT; ctx.lineCap = 'round';
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(ha) * 5.5, clockY + Math.sin(ha) * 5.5); ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(ma) * 8, clockY + Math.sin(ma) * 8); ctx.stroke();
      ctx.fillStyle = '#d6336c';
      ctx.beginPath(); ctx.arc(clockX, clockY, 1.8, 0, 7); ctx.fill();
    }
    // đèn đá tōrō 2 bên
    for (const ox of [-44, 44]) {
      const lx = cx + ox, ly = dy + 2;
      frame(ctx, lx - 7, ly + 8, 14, 6, 3, '#8d8d94', 2);
      frame(ctx, lx - 4, ly - 6, 8, 14, 3, '#b0a89a', 2);
      frame(ctx, lx - 11, ly - 14, 22, 9, 4, '#8d8d94', 2.2);
      frame(ctx, lx - 8, ly - 20, 16, 7, 3, '#6a6a75', 2);
      if (night) {
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(lx - 6, ly - 13, 12, 6);
        const halo = ctx.createRadialGradient(lx, ly - 10, 2, lx, ly - 10, 34);
        halo.addColorStop(0, 'rgba(255,210,120,.5)'); halo.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(lx, ly - 10, 34, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = '#4a4a52';
        ctx.fillRect(lx - 6, ly - 13, 12, 6);
      }
    }
  } else if (opts.id === 'cafe') {
    // hiên gỗ + 2 bàn dù + bảng menu + mèo nằm trên mái hiên
    frame(ctx, cx - 66, dy + 2, 132, 14, 6, '#b07a3e', 2.6);
    ctx.strokeStyle = 'rgba(90,50,20,.4)'; ctx.lineWidth = 1.4;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath(); ctx.moveTo(cx - 66 + k * 22, dy + 3); ctx.lineTo(cx - 66 + k * 22, dy + 15); ctx.stroke();
    }
    for (const ox of [-40, 40]) {
      const tx = cx + ox, ty = dy + 16;
      // ghế
      frame(ctx, tx - 22, ty - 2, 12, 12, 3, '#7c4f21', 2);
      // bàn tròn + tách cà phê bốc khói
      ctx.fillStyle = '#fff8e1';
      ctx.beginPath(); ctx.ellipse(tx + 8, ty - 4, 13, 5, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#7c4f21';
      rr(ctx, tx + 6, ty - 8, 4, 8, 2); ctx.fill();
      frame(ctx, tx + 3, ty - 16, 10, 8, 3, '#fff', 1.8);
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath(); ctx.ellipse(tx + 8, ty - 16, 5, 2, 0, 0, 7); ctx.fill();
      for (let s = 0; s < 2; s++) {
        const p = (t * 0.5 + s / 2) % 1;
        ctx.fillStyle = `rgba(200,180,160,${0.5 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(tx + 8 + Math.sin(t * 2 + s) * 2, ty - 18 - p * 10, 1.8, 0, 7); ctx.fill();
      }
      // dù che bàn
      ctx.fillStyle = '#ff5b8b';
      ctx.beginPath(); ctx.ellipse(tx + 8, ty - 40, 20, 7, 0, Math.PI, 0); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx + 8, ty - 40); ctx.lineTo(tx + 8, ty - 6); ctx.stroke();
    }
    // bảng menu chân chữ A
    {
      const mx = cx + 78, my = dy + 2;
      ctx.fillStyle = '#5d4037';
      ctx.beginPath(); ctx.moveTo(mx - 12, my + 26); ctx.lineTo(mx, my - 2); ctx.lineTo(mx + 12, my + 26); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
      frame(ctx, mx - 14, my - 4, 28, 24, 4, '#2b2117', 2.4);
      txt(ctx, 'MENU', mx, my + 7, 7, '#ffeb3b');
      ctx.fillStyle = '#ff9ebb';
      ctx.fillRect(mx - 10, my + 10, 20, 2);
    }
    // mèo mướp nằm dài trên mái hiên
    {
      const mx = cx - 52, my = dy - 84 + Math.sin(t * 1.4) * 1;
      const tailWag = Math.sin(t * 3) * 4;
      ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mx + 20, my); ctx.quadraticCurveTo(mx + 32, my - 2, mx + 30, my - 12 + tailWag); ctx.stroke();
      ctx.strokeStyle = '#e8963e'; ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(mx + 20, my); ctx.quadraticCurveTo(mx + 32, my - 2, mx + 30, my - 12 + tailWag); ctx.stroke();
      ctx.fillStyle = '#e8963e';
      ctx.beginPath(); ctx.ellipse(mx, my, 22, 9, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,60,10,.5)'; ctx.lineWidth = 1.4;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(mx + k * 8, my - 8); ctx.lineTo(mx + k * 8, my + 8); ctx.stroke();
      }
      ctx.fillStyle = '#e8963e';
      ctx.beginPath(); ctx.arc(mx + 24, my - 4, 8, 0, 7); ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
      for (const ex of [-3, 3]) {
        ctx.fillStyle = '#e8963e';
        ctx.beginPath(); ctx.moveTo(mx + 24 + ex - 2, my - 10); ctx.lineTo(mx + 24 + ex, my - 16); ctx.lineTo(mx + 24 + ex + 2, my - 10); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
      }
      // mắt lim dim ngủ
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(mx + 20, my - 4); ctx.lineTo(mx + 24, my - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + 26, my - 4); ctx.lineTo(mx + 30, my - 4); ctx.stroke();
      blush(ctx, mx + 22, my - 1, 2.4, 1.4, 0.6);
      // chữ Z ngủ bay
      const zy = my - 16 - ((t * 10) % 12);
      ctx.fillStyle = `rgba(120,120,180,${1 - (my - 16 - zy) / 14})`;
      ctx.font = `bold 10px 'Be Vietnam Pro', monospace`; ctx.textAlign = 'center';
      ctx.fillText('z', mx + 30, zy);
    }
  } else if (opts.id === 'shop') {
    // mái hiên sọc + thùng hàng + biển dọc + dây lồng đèn
    const ay = dy - 66;
    for (let k = 0; k < 8; k++) {
      const fx = cx - 70 + k * 20;
      ctx.fillStyle = k % 2 ? '#fff8e1' : '#e04848';
      ctx.beginPath();
      ctx.moveTo(fx, ay);
      ctx.lineTo(fx + 20, ay);
      ctx.lineTo(fx + 20, ay + 22);
      ctx.quadraticCurveTo(fx + 15, ay + 27, fx + 10, ay + 22);
      ctx.quadraticCurveTo(fx + 5, ay + 27, fx, ay + 22);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(cx - 74, ay - 8); ctx.lineTo(cx - 70, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 74, ay - 8); ctx.lineTo(cx + 70, ay); ctx.stroke();
    // thùng gỗ đựng hàng 2 bên cửa
    const goods: ['pot' | 'daruma', number][] = [['pot', -1], ['daruma', 1]];
    for (const [kind, sgn] of goods) {
      const gx = cx + sgn * 52, gy = dy - 2;
      frame(ctx, gx - 16, gy - 16, 32, 18, 4, '#a9763b', 2.4);
      ctx.strokeStyle = 'rgba(90,50,20,.4)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gx - 16, gy - 7); ctx.lineTo(gx + 16, gy - 7); ctx.stroke();
      if (kind === 'pot') {
        for (const ox of [-8, 0, 8]) {
          ctx.fillStyle = '#b5651d';
          ctx.beginPath(); ctx.ellipse(gx + ox, gy - 20, 6, 7, 0, 0, 7); ctx.fill();
          ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
          flower(ctx, gx + ox, gy - 30, 5, ['#ff8fb0', '#fff', '#ffeb3b'][(ox + 8) / 8]);
        }
      } else {
        // búp bê daruma đỏ
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath(); ctx.arc(gx, gy - 24, 9, 0, 7); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath(); ctx.arc(gx, gy - 22, 5.5, 0, 7); ctx.fill();
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.arc(gx - 2.5, gy - 23, 1.6, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 2.5, gy - 23, 1.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd24d';
        ctx.fillRect(gx - 4, gy - 34, 8, 3);
      }
    }
    // biển dọc tanzaku bên phải
    {
      const sx = cx + 92, sy = dy - 92;
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy - 16); ctx.lineTo(sx, sy); ctx.stroke();
      frame(ctx, sx - 13, sy, 26, 52, 6, '#1565c0', 2.6);
      txt(ctx, '土', sx, sy + 20, 12, '#fff');
      txt(ctx, '産', sx, sy + 38, 12, '#fff');
    }
    // dây 3 lồng đèn giấy trước hiên
    for (let k = -1; k <= 1; k++) {
      const lx = cx + k * 30 + Math.sin(t * 2 + k) * 1.5, ly = ay + 34;
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(lx, ay + 22); ctx.lineTo(lx, ly - 7); ctx.stroke();
      ctx.fillStyle = k === 0 ? '#ffe9a8' : '#ffcdd2';
      ctx.beginPath(); ctx.ellipse(lx, ly, 6.5, 8, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      if (night) {
        const halo = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26);
        halo.addColorStop(0, 'rgba(255,200,110,.5)'); halo.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(lx, ly, 26, 0, 7); ctx.fill();
      }
    }
  } else {
    // nhà dân: hàng rào + vườn hoa + hòm thư + đá bước
    for (const sgn of [-1, 1]) {
      const fx = cx + sgn * (w / 2 + 22);
      for (let k = 0; k < 3; k++) {
        const px = fx + sgn * k * -14;
        frame(ctx, px - 4, dy - 26, 8, 28, 3, '#d9c8a9', 2);
        ctx.beginPath(); ctx.moveTo(px - 4, dy - 26); ctx.lineTo(px, dy - 32); ctx.lineTo(px + 4, dy - 26); ctx.closePath();
        ctx.fillStyle = '#b07a3e'; ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
      }
      const rx = fx - (sgn > 0 ? 34 : -6);
      frame(ctx, Math.min(rx, rx + 34), dy - 20, 34, 6, 3, '#b07a3e', 2);
    }
    // vườn hoa trước nhà
    const gx = cx - w / 2 + 34, gy = dy + 4;
    frame(ctx, gx - 30, gy - 4, 60, 12, 5, '#7c4f21', 2.2);
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(gx - 27, gy - 2, 54, 8);
    const cols = ['#ff8fb0', '#ffffff', '#ffeb3b', '#ce93d8'];
    for (let k = 0; k < 4; k++) flower(ctx, gx - 20 + k * 13, gy - 8, 5.5, cols[k % 4]);
    // hòm thư + đá bước tới cửa
    {
      const mx = cx + w / 2 - 20, my = dy + 2;
      frame(ctx, mx - 4, my - 16, 8, 18, 3, '#7c4f21', 2);
      frame(ctx, mx - 11, my - 30, 22, 15, 5, '#3f9be0', 2.2);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(mx, my - 22, 2.6, 0, 7); ctx.fill();
      for (let k = 0; k < 2; k++) stone(ctx, cx - 8 + k * 16, dy + 22 + (k % 2) * 4, 9, 5.5);
    }
  }
  void FARM_GATE;
}

// ---------- anh đào: thân viền + tán 5 chùm + hoa rơi + thảm hoa ----------
function drawSakura(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, x: number, y: number, t: number, seed: number) {
  const X = x - cam.x, Y = y - cam.y;
  if (X < -80 || X > 3000 || Y < -100 || Y > 2000) return;
  shadow(ctx, X, Y + 4, 20, 5, 0.22);
  // thảm cánh hoa dưới gốc
  for (let k = 0; k < 4; k++) {
    const h = hash2(seed * 10 + k, 3);
    ctx.fillStyle = 'rgba(255,170,200,.7)';
    ctx.beginPath(); ctx.ellipse(X - 18 + h * 36, Y + 2 + hash2(k, seed) * 5, 3, 1.8, h, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#6d4c41';
  rr(ctx, X - 6, Y - 34, 12, 38, 5); ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(X - 4, Y - 32, 3, 34);
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X, Y - 30); ctx.lineTo(X - 14, Y - 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X, Y - 30); ctx.lineTo(X + 14, Y - 46); ctx.stroke();
  const blobs: [number, number, number][] = [[0, -52, 27], [-21, -42, 19], [21, -42, 19], [-10, -63, 17], [13, -61, 16]];
  for (const [ox, oy, r] of blobs) {
    const bx = X + ox + Math.sin(t * 1.2 + seed + ox) * 1.5;
    const by = Y + oy;
    shadow(ctx, bx, by + r * 0.7, r * 0.7, r * 0.25, 0.12);
    const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.2, bx, by, r);
    g.addColorStop(0, '#fff0f6'); g.addColorStop(0.55, '#ff9ebb'); g.addColorStop(1, '#ef5d92');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.ellipse(bx - r * 0.35, by - r * 0.4, r * 0.3, r * 0.18, -0.4, 0, 7); ctx.fill();
    blush(ctx, bx - 6, by + 2, 4, 2.4, 0.5);
    blush(ctx, bx + 7, by + 1, 3.4, 2, 0.45);
  }
  for (let k = 0; k < 4; k++) {
    const ph = seed + k * 2.3;
    const px = X + Math.sin(t * 0.9 + ph) * 32;
    const py = Y - 30 - ((t * 16 + ph * 12) % 64);
    ctx.fillStyle = `rgba(255,170,200,${0.85 * (1 - (Y - 30 - py) / 74)})`;
    ctx.beginPath(); ctx.ellipse(px, py, 3.4, 2.2, Math.sin(t * 2 + ph), 0, 7); ctx.fill();
  }
  if (Math.sin(t * 2 + seed) > 0.6) drawSparkle(ctx, X + 24, Y - 66, 5, 0.85);
}

// ---------- đèn đường: đế đá + giỏ hoa + halo đêm + bướm đêm ----------
function drawLamp(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, x: number, y: number, t: number, night: boolean) {
  const X = x - cam.x, Y = y - cam.y;
  shadow(ctx, X, Y + 4, 9, 3, 0.2);
  frame(ctx, X - 9, Y - 2, 18, 7, 3, '#b0bec5', 2.2);
  const pg = ctx.createLinearGradient(X - 4, 0, X + 4, 0);
  pg.addColorStop(0, '#3a3a42'); pg.addColorStop(0.5, '#6a6a75'); pg.addColorStop(1, '#3a3a42');
  frame(ctx, X - 4, Y - 56, 8, 56, 4, pg, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(X - 2, Y - 54, 2.5, 52);
  // giỏ hoa treo
  const sway = Math.sin(t * 2 + x * 0.05) * 1.6;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(X, Y - 40); ctx.lineTo(X + sway, Y - 32); ctx.stroke();
  frame(ctx, X + sway - 9, Y - 32, 18, 9, 4, '#9a6530', 2);
  flower(ctx, X + sway - 4, Y - 36, 4.5, '#ff8fb0');
  flower(ctx, X + sway + 4, Y - 36, 4.5, '#ffffff');
  // đầu đèn
  frame(ctx, X - 12, Y - 80, 24, 26, 7, night ? '#ffe9a8' : '#cfd8dc', 2.6);
  frame(ctx, X - 8, Y - 86, 16, 7, 3, OUT, 1.8);
  if (night) {
    const g = ctx.createRadialGradient(X, Y - 67, 2, X, Y - 67, 64);
    g.addColorStop(0, 'rgba(255,210,100,.6)'); g.addColorStop(1, 'rgba(255,210,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y - 67, 64, 0, 7); ctx.fill();
    // bướm đêm bay quanh đèn
    for (let k = 0; k < 2; k++) {
      const a = t * 2.4 + k * 3.1 + x;
      const bx = X + Math.cos(a) * 18, by = Y - 67 + Math.sin(a * 1.4) * 12;
      ctx.fillStyle = 'rgba(255,240,200,.9)';
      ctx.beginPath(); ctx.ellipse(bx, by, 2.2, 1.4, a, 0, 7); ctx.fill();
    }
  } else if (Math.sin(t * 2 + x) > 0.7) drawSparkle(ctx, X + 14, Y - 76, 4, 0.8);
}

// ---------- ghế đá: tựa lưng + nệm kẻ ----------
function drawBench(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, x: number, y: number, flip: boolean, t: number) {
  const X = x - cam.x, Y = y - cam.y;
  shadow(ctx, X, Y + 10, 32, 5, 0.2);
  const s = flip ? -1 : 1;
  ctx.save(); ctx.translate(X, Y); ctx.scale(s, 1);
  // tựa lưng
  frame(ctx, -30, -30, 60, 12, 6, '#b07a3e', 2.6);
  frame(ctx, -26, -18, 6, 14, 3, '#7c4f21', 2);
  frame(ctx, 20, -18, 6, 14, 3, '#7c4f21', 2);
  // mặt ngồi + nệm kẻ hồng
  frame(ctx, -32, -6, 64, 10, 5, '#c98a4b', 2.6);
  ctx.fillStyle = '#ff9ebb';
  ctx.fillRect(-26, -5, 52, 8);
  ctx.fillStyle = '#fff';
  for (let k = 0; k < 4; k++) ctx.fillRect(-26 + k * 14, -5, 5, 8);
  ctx.lineWidth = 2; ctx.strokeStyle = OUT;
  rr(ctx, -26, -5, 52, 8, 3); ctx.stroke();
  // chân
  frame(ctx, -28, 4, 7, 8, 3, '#7c4f21', 2);
  frame(ctx, 21, 4, 7, 8, 3, '#7c4f21', 2);
  ctx.restore();
  if (Math.sin(t * 2.4 + x) > 0.75) drawSparkle(ctx, X + 26, Y - 28, 4, 0.7);
  void t;
}

// ---------- sân khấu: thảm đỏ + backdrop lễ hội + loa + đèn rọi + dây đèn ----------
function drawStage(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const X = TOWN_STAGE.x - cam.x, Y = TOWN_STAGE.y - cam.y;
  const w = TOWN_STAGE.w, h = TOWN_STAGE.h;
  // thảm đỏ từ quảng trường tới sân khấu
  ctx.fillStyle = '#d6336c';
  rr(ctx, X + w / 2 - 26, Y - 66, 52, 66, 8); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(X + w / 2 - 26, Y - 66, 52, 5);
  ctx.fillRect(X + w / 2 - 26, Y - 10, 52, 5);
  shadow(ctx, X + w / 2, Y + h + 4, w / 2, 8, 0.22);
  frame(ctx, X, Y + 20, w, h - 20, 8, '#c98a4b', 3);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(X + 8, Y + 26, w - 16, 6);
  ctx.strokeStyle = 'rgba(90,50,20,.4)'; ctx.lineWidth = 1.4;
  for (let k = 1; k < 5; k++) {
    ctx.beginPath(); ctx.moveTo(X + (w / 5) * k, Y + 30); ctx.lineTo(X + (w / 5) * k, Y + h); ctx.stroke();
  }
  // backdrop lễ hội
  frame(ctx, X + 30, Y - 52, w - 60, 66, 10, '#e04848', 3);
  ctx.fillStyle = '#fff3d6';
  ctx.fillRect(X + 38, Y - 46, w - 76, 30);
  txt(ctx, 'LỄ HỘI CÔNG VIÊN', X + w / 2, Y - 24, 13, '#fff3d6');
  for (let k = 0; k < 5; k++) {
    const bob = Math.abs(Math.sin(t * 3 + k)) * -3;
    ctx.fillStyle = k % 2 ? '#ffd24d' : '#fff';
    ctx.beginPath(); ctx.arc(X + 52 + k * ((w - 104) / 4), Y + 2 + bob, 5, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  }
  // loa 2 bên
  for (const ox of [8, w - 32]) {
    frame(ctx, X + ox, Y + 44, 24, 34, 5, '#3a3a42', 2.6);
    ctx.fillStyle = '#6a6a75';
    ctx.beginPath(); ctx.arc(X + ox + 12, Y + 55, 7, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(X + ox + 12, Y + 69, 4.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    const pul = 1 + Math.sin(t * 8 + ox) * 0.15;
    ctx.beginPath(); ctx.arc(X + ox + 12, Y + 55, 7 * pul, 0, 7); ctx.stroke();
  }
  // cột đèn rọi + chùm sáng
  for (const ox of [10, w - 10]) {
    frame(ctx, X + ox - 5, Y - 30, 10, 56, 4, '#7c4f21', 2.4);
    const on = Math.sin(t * 3 + ox) > -0.2;
    frame(ctx, X + ox - 9, Y - 44, 18, 16, 6, on ? '#fff59d' : '#b0bec5', 2.4);
    if (on) {
      ctx.fillStyle = night ? 'rgba(255,245,150,.35)' : 'rgba(255,245,150,.22)';
      ctx.beginPath(); ctx.moveTo(X + ox, Y - 28); ctx.lineTo(X + ox - 44, Y + 60); ctx.lineTo(X + ox + 44, Y + 60); ctx.closePath(); ctx.fill();
    }
  }
  // nốt nhạc bay
  ctx.font = 'bold 18px serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    const nx = X + w / 2 + Math.sin(t * 1.5 + i * 2) * 70;
    const ny = Y - 56 - ((t * 20 + i * 22) % 54);
    ctx.fillStyle = `rgba(60,40,80,${1 - (Y - 56 - ny) / 70})`;
    ctx.fillText(['♪', '♫', '♩', '♬'][i % 4], nx, ny);
  }
  namePill(ctx, X + w / 2, Y + h + 10, 'Sân khấu sự kiện');
}

// ---------- dây cờ phướn giăng qua quảng trường ----------
function drawBunting(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const lines: [number, number, number, number][] = [
    [480, 420, 1120, 420],
    [420, 640, 560, 480],
    [1180, 640, 1040, 480],
  ];
  const cols = ['#ff5b8b', '#ffd24d', '#3b82f6', '#43d17c', '#fff'];
  for (const [x1, y1, x2, y2] of lines) {
    const X1 = x1 - cam.x, Y1 = y1 - cam.y, X2 = x2 - cam.x, Y2 = y2 - cam.y;
    if (Math.max(X1, X2) < -40 || Math.min(X1, X2) > 3000) continue;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(X1, Y1);
    ctx.quadraticCurveTo((X1 + X2) / 2, Math.max(Y1, Y2) + 46, X2, Y2); ctx.stroke();
    const n = 12;
    for (let i = 1; i < n; i++) {
      const p = i / n;
      const bx = X1 + (X2 - X1) * p;
      const by = (Y1 + (Y2 - Y1) * p) + 46 * 2 * p * (1 - p) * 2 * 0.5 + 20 * p * (1 - p);
      const sway = Math.sin(t * 2.4 + i * 1.3 + X1 * 0.01) * 2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.lineTo(bx + 6, by);
      ctx.lineTo(bx + sway, by + 12);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
    }
  }
}

// ---------- bảng chào công viên ----------
function drawBoard(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const X = TOWN_BOARD.x - cam.x, Y = TOWN_BOARD.y - cam.y;
  shadow(ctx, X, Y + 30, 66, 6, 0.2);
  for (const ox of [-48, 40]) {
    const g = ctx.createLinearGradient(X + ox, 0, X + ox + 9, 0);
    g.addColorStop(0, '#7c4f21'); g.addColorStop(0.5, '#b07a3e'); g.addColorStop(1, '#7c4f21');
    frame(ctx, X + ox, Y - 34, 9, 66, 4, g, 2.4);
  }
  frame(ctx, X - 66, Y - 62, 132, 42, 10, '#ffd24d', 3);
  rr(ctx, X - 61, Y - 58, 122, 34, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(X - 58, Y - 56, 116, 3);
  txt(ctx, 'CÔNG VIÊN', X, Y - 34, 14, '#fff3d6');
  // vòng hoa 2 bên + mặt trời mascot
  flower(ctx, X - 62, Y - 40, 6, '#ff8fb0');
  flower(ctx, X + 62, Y - 40, 6, '#ffffff');
  ctx.fillStyle = '#ff9e2c';
  ctx.beginPath(); ctx.arc(X - 52, Y - 66, 8, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.strokeStyle = '#ff9e2c'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + t * 0.5;
    ctx.beginPath(); ctx.moveTo(X - 52 + Math.cos(a) * 10, Y - 66 + Math.sin(a) * 10);
    ctx.lineTo(X - 52 + Math.cos(a) * 13, Y - 66 + Math.sin(a) * 13); ctx.stroke();
  }
  if (night) {
    const halo = ctx.createRadialGradient(X, Y - 41, 2, X, Y - 41, 60);
    halo.addColorStop(0, 'rgba(255,210,100,.4)'); halo.addColorStop(1, 'rgba(255,210,100,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(X, Y - 41, 60, 0, 7); ctx.fill();
  }
  flower(ctx, X - 58, Y + 28, 6, '#ff8fb0');
  flower(ctx, X + 58, Y + 28, 6, '#fff');
  grassTuft(ctx, X - 48, Y + 30, 1, t, 3);
  grassTuft(ctx, X + 48, Y + 30, 1, t, 9);
  if (Math.sin(t * 3) > 0.5) drawSparkle(ctx, X + 72, Y - 56, 5, 0.9);
}

// ---------- cổng về farm (mép trái): torii xanh + mũi tên ----------
function drawFarmGate(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const c = farmGateCenter();
  const X = c.x - cam.x, Y = c.y - cam.y;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  ctx.fillStyle = `rgba(150,255,170,${0.16 + pulse * 0.1})`;
  ctx.beginPath(); ctx.ellipse(X + 60, Y + 6, 66, 20, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) {
    if (Math.sin(t * 3 + i * 2) > 0.2) drawSparkle(ctx, X + 30 + i * 26, Y - 8 + Math.cos(t * 2.4 + i * 2) * 4, 5, 0.9);
  }
  shadow(ctx, X, Y + 44, 52, 8, 0.26);
  for (const ox of [-38, 38]) {
    const px = X + ox;
    const g = ctx.createLinearGradient(px - 9, 0, px + 9, 0);
    g.addColorStop(0, '#1b5e20'); g.addColorStop(0.5, '#43d17c'); g.addColorStop(1, '#1b5e20');
    frame(ctx, px - 9, Y - 52, 18, 96, 7, g, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(px - 5, Y - 49, 4, 90);
    frame(ctx, px - 13, Y + 36, 26, 10, 4, '#b0bec5', 2.4);
    const sway = Math.sin(t * 2 + ox) * 2.4;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, Y - 44); ctx.lineTo(px + sway * 0.4, Y - 30); ctx.stroke();
    const lx = px + sway * 0.4, ly = Y - 20;
    const lg = ctx.createLinearGradient(0, ly - 12, 0, ly + 12);
    lg.addColorStop(0, '#ffe9a8'); lg.addColorStop(1, '#ffb300');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(lx, ly, 10, 12, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.strokeStyle = 'rgba(150,60,0,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lx - 9, ly - 4); ctx.lineTo(lx + 9, ly - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 9, ly + 4); ctx.lineTo(lx + 9, ly + 4); ctx.stroke();
    frame(ctx, lx - 4, ly - 17, 8, 5, 2, OUT, 1.6);
    ctx.fillStyle = '#43d17c';
    ctx.beginPath(); ctx.arc(lx, ly + 15, 2.6, 0, 7); ctx.fill();
    const gl = ctx.createRadialGradient(lx, ly, 2, lx, ly, 28);
    gl.addColorStop(0, 'rgba(255,200,80,.5)'); gl.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, ly, 28, 0, 7); ctx.fill();
  }
  const topG = ctx.createLinearGradient(0, Y - 72, 0, Y - 48);
  topG.addColorStop(0, '#0d3b1e'); topG.addColorStop(1, '#2e7d32');
  frame(ctx, X - 58, Y - 72, 116, 18, 8, topG, 3.2);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(X - 52, Y - 70, 104, 4);
  frame(ctx, X - 46, Y - 50, 92, 10, 5, '#1b5e20', 2.6);
  for (const ex of [-58, 58]) {
    ctx.fillStyle = '#2b2117';
    ctx.beginPath(); ctx.ellipse(X + ex, Y - 70, 8, 12, ex > 0 ? 0.5 : -0.5, 0, 7); ctx.fill();
  }
  const bob = Math.sin(t * 1.6) * 1.4;
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(X - 30, Y - 54); ctx.lineTo(X - 30, Y - 38 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X + 30, Y - 54); ctx.lineTo(X + 30, Y - 38 + bob); ctx.stroke();
  frame(ctx, X - 44, Y - 38 + bob, 88, 26, 9, '#7fd08a', 2.8);
  rr(ctx, X - 40, Y - 35 + bob, 80, 20, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  txt(ctx, 'NÔNG TRẠI', X, Y - 20 + bob, 12, '#fff3d6');
  // mũi tên chỉ về cổng (người chơi tới từ phía đông)
  const ay = Y + 22 + Math.sin(t * 4) * 3;
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.moveTo(X + 52, ay - 8); ctx.lineTo(X + 38, ay); ctx.lineTo(X + 52, ay + 8);
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  flower(ctx, X - 52, Y + 40, 6, '#ff8fb0');
  flower(ctx, X + 52, Y + 40, 6, '#ffffff');
}

// ---------- xe hàng rong: kem + bong bóng (công viên sống động) ----------
function drawVendor(
  ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number,
  x: number, y: number, kind: 'kem' | 'bongbong', name: string, seed: number,
) {
  const X = x - cam.x, Y = y - cam.y;
  if (X < -120 || X > 3000) return;
  const bob = Math.sin(t * 2 + seed) * 1.5;
  shadow(ctx, X, Y + 14, 34, 6, 0.24);
  // dù che
  const ug = ctx.createLinearGradient(0, Y - 66, 0, Y - 44);
  if (kind === 'kem') { ug.addColorStop(0, '#ff9ebb'); ug.addColorStop(1, '#d6336c'); }
  else { ug.addColorStop(0, '#80d8ff'); ug.addColorStop(1, '#1565c0'); }
  ctx.fillStyle = ug;
  ctx.beginPath(); ctx.ellipse(X, Y - 52 + bob * 0.4, 40, 13, 0, 0, 7); ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
  for (let k = -2; k <= 2; k++) {
    ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.15)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X, Y - 52 + bob * 0.4); ctx.lineTo(X + k * 16, Y - 50 + bob * 0.4); ctx.stroke();
  }
  ctx.fillStyle = '#7c4f21';
  rr(ctx, X - 3, Y - 52, 6, 44, 3); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  // tủ xe
  frame(ctx, X - 30, Y - 12, 60, 24, 6, kind === 'kem' ? '#fff3d6' : '#e3f2fd', 2.8);
  ctx.fillStyle = kind === 'kem' ? '#ff5b8b' : '#3b82f6';
  ctx.fillRect(X - 26, Y - 8, 52, 8);
  for (const wx of [-22, 22]) {
    ctx.fillStyle = '#4a3226';
    ctx.beginPath(); ctx.arc(X + wx, Y + 16, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#8d8d94';
    ctx.beginPath(); ctx.arc(X + wx, Y + 16, 3, 0, 7); ctx.fill();
  }
  if (kind === 'kem') {
    // 3 cây kem ốc quế
    for (let k = -1; k <= 1; k++) {
      const kx = X + k * 14;
      ctx.fillStyle = '#d99a55';
      ctx.beginPath(); ctx.moveTo(kx - 5, Y - 12); ctx.lineTo(kx + 5, Y - 12); ctx.lineTo(kx, Y - 2); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = ['#ff8fb0', '#fff', '#8b5a2b'][k + 1];
      ctx.beginPath(); ctx.arc(kx, Y - 16, 5.5, 0, 7); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#ff5b5b';
      ctx.beginPath(); ctx.arc(kx, Y - 21, 1.8, 0, 7); ctx.fill();
    }
  } else {
    // chùm bong bóng bay
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.35;
      const bx = X + Math.cos(a) * 26, by = Y - 30 + Math.sin(a) * 26 + Math.sin(t * 2 + k) * 2;
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X, Y - 30); ctx.lineTo(bx, by + 7); ctx.stroke();
      ctx.fillStyle = ['#ff5b8b', '#ffd24d', '#3b82f6', '#43d17c', '#ce93d8'][k];
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(bx - 2.5, by - 2.5, 2, 0, 7); ctx.fill();
    }
  }
  // cô bán hàng chibi sau xe
  const vx = X - 2, vy = Y - 6 + bob;
  ctx.fillStyle = '#ffcf9e';
  ctx.beginPath(); ctx.arc(vx, vy - 22, 9, 0, 7); ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
  blush(ctx, vx - 4, vy - 19, 2.6, 1.6, 0.6);
  blush(ctx, vx + 4, vy - 19, 2.6, 1.6, 0.6);
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(vx - 3, vy - 22, 1.6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(vx + 3, vy - 22, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(vx, vy - 18.5, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
  // tóc + tạp dề
  ctx.fillStyle = '#5d4037';
  ctx.beginPath(); ctx.arc(vx, vy - 24, 9.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  frame(ctx, vx - 8, vy - 14, 16, 14, 5, kind === 'kem' ? '#ff9ebb' : '#80d8ff', 2);
  namePill(ctx, X, Y + 26, name);
  if (Math.sin(t * 2.6 + seed) > 0.55) drawSparkle(ctx, X + 34, Y - 44, 5, 0.85);
}

// ---------- bướm + chim trời ----------
function drawCritters(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, t: number) {
  // bướm công viên (Thấp: tắt, TB: 2 con)
  for (let i = 0; i < (TQ_LOW ? 0 : TQ_MED ? 2 : 4); i++) {
    const bx = 480 + ((t * (24 + i * 8) + i * 160) % 640) - cam.x;
    const by = 480 + ((i * 127) % 300) + Math.sin(t * 3 + i * 2) * 14 - cam.y;
    if (bx < -10 || bx > W + 10) continue;
    const flap = Math.abs(Math.sin(t * 14 + i * 2));
    const col = ['#ff8fb0', '#82b1ff', '#ffeb3b', '#ce93d8'][i % 4];
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(bx + sgn * (3 + flap * 2.4), by, 4.6, 3, sgn * 0.35, 0, 7); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.fillStyle = '#3e2723';
    rr(ctx, bx - 1.4, by - 3.4, 2.8, 7, 1.4); ctx.fill();
  }
  // chim bay vòng trên hội quán (Thấp: tắt)
  if (TQ_LOW) return;
  for (let i = 0; i < 3; i++) {
    const a = t * 0.5 + i * 2.1;
    const bx = TOWN_HALL.x + TOWN_HALL.w / 2 + Math.cos(a) * 160 - cam.x;
    const by = TOWN_HALL.y - 80 + Math.sin(a * 1.6) * 22 - cam.y;
    const flap2 = Math.sin(t * 10 + i * 2) * 4;
    ctx.strokeStyle = '#4a3226'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx - 7, by + flap2 * 0.4); ctx.quadraticCurveTo(bx, by - 2, bx, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 7, by + flap2 * 0.4); ctx.quadraticCurveTo(bx, by - 2, bx, by); ctx.stroke();
  }
}

// ---------- casino: neon tím-vàng + chip + xúc xắc + biển CASINO nhấp nháy ----------
function drawCasino(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const b = TOWN_CASINO;
  const X = b.x - cam.x, Y = b.y - cam.y;
  if (X + b.w < -120 || X > 3000 || Y + b.h < -160 || Y > 2000) return;
  const cx = X + b.w / 2;
  shadow(ctx, X + b.w / 2, Y + b.h + 4, b.w / 2 + 6, 8, 0.26);
  // thân tím sang trọng + viền vàng
  frame(ctx, X, Y, b.w, b.h, 12, '#3b1d5e', 3.2);
  ctx.save();
  rr(ctx, X, Y, b.w, b.h, 12); ctx.clip();
  // dải vàng kim trên dưới
  ctx.fillStyle = '#ffd24d';
  ctx.fillRect(X, Y, b.w, 10);
  ctx.fillRect(X, Y + b.h - 12, b.w, 12);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(X, Y + 12, b.w, 5);
  // đèn neon chạy quanh (ngày cũng sáng nhẹ, đêm rực)
  const neon = ['#ff5b8b', '#ffd24d', '#3b82f6', '#43d17c'];
  const nn = 14;
  for (let i = 0; i <= nn; i++) {
    const px = X + 8 + ((b.w - 16) * i) / nn;
    const on = Math.sin(t * 3 + i * 0.9) > -0.3;
    ctx.fillStyle = on ? neon[i % neon.length] : 'rgba(120,90,140,.5)';
    ctx.beginPath(); ctx.arc(px, Y + 22, on ? 4 : 2.6, 0, 7); ctx.fill();
    if (night && on) {
      const g = ctx.createRadialGradient(px, Y + 22, 1, px, Y + 22, 12);
      g.addColorStop(0, neon[i % neon.length] + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, Y + 22, 12, 0, 7); ctx.fill();
    }
  }
  // cửa kính lớn giữa
  frame(ctx, cx - 44, Y + b.h - 72, 88, 60, 8, '#9fd8ff', 2.6);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.moveTo(cx - 40, Y + b.h - 14);
  ctx.lineTo(cx - 10, Y + b.h - 68);
  ctx.lineTo(cx + 6, Y + b.h - 68);
  ctx.lineTo(cx - 24, Y + b.h - 14);
  ctx.closePath(); ctx.fill();
  // thảm đỏ + 2 chậu kim tiền
  ctx.fillStyle = '#d6336c';
  rr(ctx, cx - 20, Y + b.h - 12, 40, 14, 4); ctx.fill();
  for (const px of [X + 22, X + b.w - 22]) {
    frame(ctx, px - 10, Y + b.h - 30, 20, 18, 4, '#7c4f21', 2.2);
    ctx.fillStyle = '#43d17c';
    ctx.beginPath(); ctx.arc(px, Y + b.h - 36, 9, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(px, Y + b.h - 36, 3.4, 0, 7); ctx.fill();
  }
  // chip poker 2 bên cửa
  const chip = (px: number, py: number, col: string, spin: number) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(t * 1.5 + spin) * 0.15);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    ctx.restore();
  };
  chip(X + 44, Y + 68, '#e04848', 1);
  chip(X + 44, Y + 96, '#3b82f6', 2);
  chip(X + b.w - 44, Y + 68, '#3b82f6', 3);
  chip(X + b.w - 44, Y + 96, '#e04848', 4);
  // xúc xắc trên mái
  const dice = (px: number, py: number, v: number, rot: number) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot + Math.sin(t * 2 + px) * 0.08);
    frame(ctx, -11, -11, 22, 22, 5, '#fff8e1', 2.4);
    ctx.fillStyle = '#2b2117';
    const dots: Record<number, [number, number][]> = {
      1: [[0, 0]], 2: [[-5, -5], [5, 5]], 3: [[-5, -5], [0, 0], [5, 5]],
      4: [[-5, -5], [5, -5], [-5, 5], [5, 5]], 5: [[-5, -5], [5, -5], [0, 0], [-5, 5], [5, 5]],
      6: [[-5, -5], [5, -5], [-5, 0], [5, 0], [-5, 5], [5, 5]],
    };
    for (const [dx, dy] of dots[v] ?? dots[1]) {
      ctx.beginPath(); ctx.arc(dx, dy, 2, 0, 7); ctx.fill();
    }
    ctx.restore();
  };
  // mái vòm + xúc xắc
  ctx.fillStyle = '#2a1445';
  ctx.beginPath();
  ctx.moveTo(X - 6, Y + 2);
  ctx.lineTo(cx, Y - 34);
  ctx.lineTo(X + b.w + 6, Y + 2);
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffd24d'; ctx.lineJoin = 'round'; ctx.stroke();
  dice(cx - 30, Y - 34, 5, 0.2);
  dice(cx + 30, Y - 34, 3, -0.25);
  ctx.restore();
  // biển CASINO to, nhấp nháy
  const blink = 0.75 + 0.25 * Math.sin(t * 4);
  ctx.font = `bold 26px 'Be Vietnam Pro', monospace`;
  const label = '🎰 CASINO';
  const tw = ctx.measureText(label).width + 36;
  const by = Y + 44;
  ctx.globalAlpha = blink;
  rr(ctx, cx - tw / 2, by, tw, 36, 12);
  const sg = ctx.createLinearGradient(0, by, 0, by + 36);
  sg.addColorStop(0, '#ff9e2c'); sg.addColorStop(1, '#c2185b');
  ctx.fillStyle = sg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff8e1'; ctx.stroke();
  ctx.globalAlpha = 1;
  txt(ctx, label, cx, by + 25, 22, '#fff');
  txt(ctx, 'TIẾN LÊN • BÀI CÀO • CARO', cx, by + 50, 10, '#ffe9a8');
  namePill(ctx, cx, Y + b.h + 14, 'Casino (cược 10-10k xu)');
  if (night) {
    const g = ctx.createRadialGradient(cx, Y + 60, 4, cx, Y + 60, 150);
    g.addColorStop(0, 'rgba(255,120,200,.28)'); g.addColorStop(1, 'rgba(255,120,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, Y + 60, 150, 0, 7); ctx.fill();
  }
}

// ---------- render chính ----------
export function renderTown(ctx: CanvasRenderingContext2D, W: number, H: number, cam: { x: number; y: number }, s: TownRenderState, t: number) {
  // cấp đồ họa áp dụng ngay cho cả frame công viên
  TQ_LOW = s.quality === 'low';
  TQ_MED = s.quality === 'medium';
  setFxLevel(TQ_LOW ? 0 : TQ_MED ? 1 : 2);
  const dt = s.dayTime;
  const night = dt < 0.2 || dt > 0.8;
  const isDay = dt > 0.2 && dt < 0.78;
  ctx.clearRect(0, 0, W, H);
  drawTownBase(ctx, cam, W, H, t);
  drawStreets(ctx, cam, t);
  drawPlaza(ctx, cam, t);
  drawFountain(ctx, cam, t, night);
  drawBuilding(ctx, cam, t, TOWN_HALL, { id: 'hall', roof: 'tile', wall: '#ffffff', roofTop: '#ff7a6b', roofBot: '#a02318', sign: 'HỘI QUÁN', chimney: true }, night);
  drawBuilding(ctx, cam, t, TOWN_CAFE, { id: 'cafe', roof: 'catear', wall: '#ffeef4', roofTop: '#ff9ebb', roofBot: '#c2185b', sign: 'CÀ PHÊ MÈO', noren: ['喫', '茶', '店'] }, night);
  drawBuilding(ctx, cam, t, TOWN_SHOP, { id: 'shop', roof: 'double', wall: '#fffdf5', roofTop: '#64b5f6', roofBot: '#0d47a1', sign: 'LƯU NIỆM', noren: ['土', '産', '店'] }, night);
  drawBuilding(ctx, cam, t, TOWN_HOUSE1, { id: 'house', roof: 'thatch', wall: '#ffe9c4', roofTop: '#f0d48a', roofBot: '#9a7030', sign: 'NHÀ RƠM', chimney: true }, night);
  drawBuilding(ctx, cam, t, TOWN_HOUSE2, { id: 'house', roof: 'lean', wall: '#e8f0f8', roofTop: '#90caf9', roofBot: '#1565c0', sign: 'NHÀ XANH', chimney: true }, night);
  drawCasino(ctx, cam, t, night);
  drawStage(ctx, cam, t, night);
  drawBoard(ctx, cam, t, night);
  drawFarmGate(ctx, cam, t);
  for (let i = 0; i < SAKURA_SPOTS.length; i++) {
    const p = SAKURA_SPOTS[i];
    drawSakura(ctx, cam, p.x, p.y, t, i * 1.7);
  }
  for (const l of LAMP_SPOTS) drawLamp(ctx, cam, l.x, l.y, t, night);
  for (const b of BENCH_SPOTS) drawBench(ctx, cam, b.x, b.y, b.flip, t);
  drawBunting(ctx, cam, t);
  drawVendor(ctx, cam, t, 500, 470, 'kem', 'Bà Hoa · Kem', 1.3);
  drawVendor(ctx, cam, t, 1100, 470, 'bongbong', 'Chú Tám · Bóng bay', 4.1);
  drawCritters(ctx, cam, W, t);
  // mèo công viên dạo quảng trường (chi tiết hơn: tai + sọc + đuôi)
  for (let i = 0; i < 2; i++) {
    const a = t * 0.3 + i * 3.1;
    const flip = Math.sin(a) > 0;
    const cxm = PLAZA.x + Math.cos(a) * (PLAZA.r - 60) - cam.x;
    const cym = PLAZA.y + Math.sin(a * 1.3) * (PLAZA.r - 90) - cam.y;
    shadow(ctx, cxm, cym + 8, 11, 3, 0.2);
    const coat = i ? '#8d8d94' : '#ff9e4d';
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(cxm, cym, 11, 8, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    // đuôi cong
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cxm + (flip ? -10 : 10), cym); ctx.quadraticCurveTo(cxm + (flip ? -18 : 18), cym - 4, cxm + (flip ? -16 : 16), cym - 12); ctx.stroke();
    ctx.strokeStyle = coat; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cxm + (flip ? -10 : 10), cym); ctx.quadraticCurveTo(cxm + (flip ? -18 : 18), cym - 4, cxm + (flip ? -16 : 16), cym - 12); ctx.stroke();
    // đầu + tai
    const hx = cxm + (flip ? 9 : -9);
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.arc(hx, cym - 8, 6.5, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    for (const ex of [-4, 4]) {
      ctx.fillStyle = coat;
      ctx.beginPath(); ctx.moveTo(hx + ex - 2.5, cym - 12); ctx.lineTo(hx + ex, cym - 18); ctx.lineTo(hx + ex + 2.5, cym - 12); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.fillStyle = '#2b2117';
    ctx.beginPath(); ctx.arc(hx - 2.5, cym - 8, 1.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 2.5, cym - 8, 1.2, 0, 7); ctx.fill();
    if (i === 0) namePill(ctx, cxm, cym - 26, i ? 'Tom' : 'Mimi');
  }

  // --- người chơi + làng ---
  const nowMs = Date.now();
  // hành động đôi: 2 người cùng emote + đứng gần → lao vào nhau diễn hoạt ảnh
  const pairActors: PairActor[] = [
    { x: s.player.x, y: s.player.y, emote: s.selfEmote, at: s.selfEmoteAt ?? nowMs },
    ...(s.visitors ?? []).map((v) => ({
      x: v.x, y: v.y,
      emote: v.self ? s.selfEmote : v.emote,
      at: v.self ? (s.selfEmoteAt ?? nowMs) : (v.emoteAt ?? 0),
    })),
  ];
  const pairRes = computePairOffsets(pairActors, nowMs, t);
  {
    const X = s.player.x - cam.x + pairRes.offsets[0].dx, Y = s.player.y - cam.y + pairRes.offsets[0].dy;
    const shirt = shirtColorOf(s.outfit, SHIRTS[s.avatar % SHIRTS.length]);
    drawPlayerDetailed(ctx, X, Y, s.player.dir, s.player.moving, shirt, s.player.name, t, s.outfit);
    if (s.player.tx != null && s.player.ty != null) {
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 6 + Math.sin(t * 8) * 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 9 + Math.sin(t * 8) * 2, 0, 7); ctx.stroke();
    }
  }
  if (s.visitors) {
    let vi = 0;
    for (const v of s.visitors) {
      vi++;
      const off = pairRes.offsets[vi] ?? { dx: 0, dy: 0 };
      const X = v.x - cam.x + off.dx, Y = v.y - cam.y + off.dy;
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
      const em = v.self ? s.selfEmote : v.emote;
      const emAt = v.self ? (s.selfEmoteAt ?? nowMs) : (v.emoteAt ?? 0);
      if (em && nowMs - emAt < 4000) {
        const bounce = Math.abs(Math.sin(t * 6)) * -6;
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText(em.slice(0, 4), X + 22, Y - 58 + bounce);
        drawActionFx(ctx, X, Y, em, t);
      }
      // PUPU v2: ném trứng THẬT vào người đứng gần nhất (bay vòng cung → vỡ → dính bết)
      // đứng một mình thì... tự ném tự dính cho vui
      if (em && em.includes('🥚') && nowMs - emAt < 4000) {
        let tv: { x: number; y: number } | null = null;
        let bd = 420;
        if (!v.self) {
          const pd = Math.hypot(s.player.x - v.x, s.player.y - v.y);
          if (pd >= 8 && pd < bd) { bd = pd; tv = { x: s.player.x, y: s.player.y }; }
        }
        if (s.visitors) {
          for (const o of s.visitors) {
            if (o === v) continue;
            const d = Math.hypot(o.x - v.x, o.y - v.y);
            if (d >= 8 && d < bd) { bd = d; tv = { x: o.x, y: o.y }; }
          }
        }
        drawEggThrow(ctx, X, Y, tv ? { x: tv.x - cam.x, y: tv.y - cam.y } : { x: X, y: Y }, Math.max(0, (nowMs - emAt) / 1000), v.x * 0.37 + v.y * 0.73, t);
      }
      // KIKI: chó khổng lồ chạy quanh chủ rồi chạy đi / MIMI: đàn mèo vây quanh
      if (em && em.includes('🐕') && nowMs - emAt < 4600) {
        drawKiki(ctx, X, Y, W, Math.max(0, (nowMs - emAt) / 1000), v.x * 0.53 + v.y * 0.29, t);
      }
      if (em && em.includes('🐈') && nowMs - emAt < 4500) {
        drawMimi(ctx, X, Y, W, H, Math.max(0, (nowMs - emAt) / 1000), (v.x + v.y) % 6.28, t);
      }
    }
  }
  // Kem: mèo cam đi theo chủ ra cả công viên (vẽ sau người, trước FX va chạm)
  if (s.kemPos) {
    drawKem(ctx, cam, W, H, s.kemPos, t, s.petFx ?? null, { x: s.player.x, y: s.player.y });
  }
  // FX va chạm của các cặp hành động đôi
  for (const pr of pairRes.pairs) {    const A = pairActors[pr.a], B = pairActors[pr.b];
    const oa = pairRes.offsets[pr.a], ob = pairRes.offsets[pr.b];
    drawPairFx(ctx, A.x - cam.x + oa.dx, A.y - cam.y + oa.dy, B.x - cam.x + ob.dx, B.y - cam.y + ob.dy, pr.act, t);
  }

  // --- ngày/đêm + thời tiết ---
  let dark = 0;
  if (dt < 0.2) dark = 0.55 - (dt / 0.2) * 0.45;
  else if (dt < 0.3) dark = 0.1;
  else if (dt < 0.7) dark = 0;
  else if (dt < 0.85) dark = ((dt - 0.7) / 0.15) * 0.35;
  else dark = 0.35 + ((dt - 0.85) / 0.15) * 0.25;
  if (dark > 0.02) { ctx.fillStyle = `rgba(8,8,50,${dark})`; ctx.fillRect(0, 0, W, H); }
  if (night) {
    // quầng đèn + cửa sổ làng (Thấp: tắt quầng gradient cho nhẹ)
    const glow = (wx: number, wy: number, r: number, c = '255,200,80') => {
      if (TQ_LOW) return;
      const X = wx - cam.x, Y = wy - cam.y;
      if (X < -r || Y < -r || X > W + r || Y > H + r) return;
      const g2 = ctx.createRadialGradient(X, Y, 2, X, Y, r);
      g2.addColorStop(0, `rgba(${c},.55)`); g2.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    };
    for (const l of LAMP_SPOTS) glow(l.x, l.y - 67, 60);
    glow(FOUNTAIN.x, FOUNTAIN.y - 20, 90, '140,220,255');
    glow(TOWN_STAGE.x + TOWN_STAGE.w / 2, TOWN_STAGE.y, 120);
    // đom đóm + sao (Thấp: tắt đom đóm + thưa sao, TB: một nửa)
    for (let i = 0; i < (TQ_LOW ? 0 : TQ_MED ? 12 : 24); i++) {
      const fx = (i * 257 + t * (10 + (i % 5) * 4)) % TOWN.w - cam.x;
      const fy = (i * 173 + Math.sin(t * 1.5 + i) * 30) % TOWN.h - cam.y;
      if (fx < 0 || fy < 0 || fx > W || fy > H) continue;
      const tw2 = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.4 + i * 1.7));
      ctx.fillStyle = `rgba(255,255,150,${tw2})`;
      ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < (TQ_LOW ? 12 : TQ_MED ? 20 : 30); i++) {
      const sx = (i * 311) % W, sy = (i * 167) % Math.max(80, H * 0.4);
      if (Math.sin(t * 2 + i) > 0.2) ctx.fillRect(sx, sy, 2, 2);
    }
  }
  if (isDay) {
    ctx.fillStyle = 'rgba(255,220,100,.25)';
    ctx.beginPath(); ctx.arc(W - 60, 44, 30, 0, 7); ctx.fill();
    drawSun(ctx, W - 60, 44, 15, t);
    if (Math.sin(t * 2) > 0.4) drawSparkle(ctx, W - 92, 30 + Math.sin(t) * 3, 5, 0.9);
    // mây ngày: Thấp tắt, TB 2 đám
    for (let i = 0; i < (TQ_LOW ? 0 : TQ_MED ? 2 : 4); i++) {
      // mây ngày: layer trời xa (parallax 0.2 + tự trôi)
      const cxm = pmod(t * 9 + i * 420 - cam.x * 0.2, W + 260) - 130;
      cloud(ctx, cxm, 54 + i * 24, 15, 0.92);
    }
  } else drawMoon(ctx, W - 60, 44, 14);
  if (TQ_LOW) {
    // đồ họa Thấp: bỏ vignette + bớt mưa/tuyết
  } else {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, night ? 'rgba(5,5,25,.32)' : 'rgba(90,60,20,.14)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  const w = s.weather ?? 'sunny';
  const rainN = TQ_LOW ? 24 : TQ_MED ? 40 : 70;
  const snowN = TQ_LOW ? 20 : TQ_MED ? 36 : 60;
  if (w === 'rain') {
    // mây mưa: Thấp 2, TB 3
    for (let i = 0; i < (TQ_LOW ? 2 : TQ_MED ? 3 : 5); i++) {
      // mây mưa: layer trời xa
      const cxm = pmod(t * 22 + i * 340 - cam.x * 0.2, W + 300) - 150;
      cloud(ctx, cxm, 26 + (i % 3) * 26, 22, 0.95);
    }
    ctx.strokeStyle = 'rgba(170,210,255,.6)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < rainN; i++) {
      // hạt mưa: layer hạt rơi (parallax 0.3)
      const rx = pmod(i * 97 + t * 300 - cam.x * 0.3, W + 40) - 20;
      const ry = pmod(i * 211 + t * 700 - cam.y * 0.3, H + 40) - 20;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 14); ctx.stroke();
    }
  } else if (w === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < snowN; i++) {
      // tuyết: layer hạt rơi (parallax 0.3 + lượn)
      const sx = pmod(i * 131 + Math.sin(t * 0.8 + i) * 30 - cam.x * 0.3, W + 8) - 4;
      const sy = pmod(i * 197 + t * 40 - cam.y * 0.3, H + 8) - 4;
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, 7); ctx.fill();
    }
    const sg = ctx.createLinearGradient(0, H - 60, 0, H);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(1, 'rgba(255,255,255,.22)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, H - 60, W, 60);
  }
}
