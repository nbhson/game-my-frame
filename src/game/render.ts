// ===== Detailed farm renderer — canvas 2D vẽ tay toàn bộ, không dùng ảnh ngoài =====
// Triết lý: mỗi khu (ruộng / chuồng gà / trại bò / ao / sông / shop) có nền riêng,
// nhà cửa, đạo cụ, hiệu ứng sống động + thể hiện rõ 5 giai đoạn phát triển cây
// và 3 giai đoạn lớn của vật nuôi (non -> tơ -> trưởng thành).
import { ANIMALS, CROPS, FISHES, MAX_POND, OUTFITS, SHIRTS, plotReq, shirtColorOf } from './data';
import type { Animal, CoopCap, GraphicsQuality, Plot, PondFish, WeatherKind } from './types';
import type { BiteDir } from './data';
import type { FishIconId } from './icons';
import { BARN, COOP, FARM, PEN_MB, PIERS, POND, RIVER, RIVER_WATER_Y, ROAD_H, ROAD_V, SHOPD, TILE, TOWN_GATE, WORLD, plotPos, roadHCenter, roadVCenter, townGateCenter } from './world';
import { animalPos, fishPos, PETS, petPos } from './systems';
import { drawBasket, drawChickenHead, drawCowHead, drawCropGeneric, drawDrop, drawEnvelope, drawExclaimBadge, drawFeedBowl, drawFish, drawHoeMini, drawLock, drawMoon, drawPumpkin, drawSeedDot, drawSleepZ, drawSparkle, drawSprout, drawStar, drawSun, drawTreeFruit, setFxLow } from './icons';

export interface VisitorDraw {
  x: number; y: number; dir: number; moving: boolean;
  name: string; avatar: number; bubble?: string; bubbleAt?: number;
  emote?: string; emoteAt?: number;
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
  weather?: WeatherKind;
  visitors?: VisitorDraw[];
  selfBubble?: string;
  selfEmote?: string;
  sit?: { x: number; y: number; bx: number; by: number; bite: boolean; combo?: BiteDir[] | null; progress?: number; fishId?: string | null } | null;
  /** cá vừa giật dính đang giãy trên dây (world coords, có until) */
  catchPop?: { x: number; y: number; fishId: string; label: string; until: number } | null;
  /** trang phục đang mặc (slot -> itemId) */
  outfit?: Record<string, string>;
  /** hiệu ứng động tác trên ô ruộng (transient, store tự dọn) */
  plotFx?: { plot: number; kind: 'hoe' | 'plant' | 'water' | 'spray' | 'harvest'; at: number; crop?: string }[];
  /** cấp đồ họa: high đủ hiệu ứng / medium giảm một nửa / low tắt bóng + tia lửa + ambient */
  quality?: GraphicsQuality;
  /** hiệu ứng bị chó cắn khi hái trộm (epoch ms hết hạn) — vẽ GÂU! + sao xoay trên đầu */
  thiefBite?: number | null;
}

// ===== Cấp đồ họa: renderWorld đặt mỗi frame, các hàm vẽ đọc để giảm tải =====
let Q_LOW = false;
let Q_MED = false;

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

// ---------- bảng gỗ anime treo tên khu (cùng ngôn ngữ 3 nhà, viền nâu + bảng kem) ----------
type SignIcon = 'sprout' | 'fish' | 'chicken' | 'cow' | null;
function drawWoodSign(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, t: number, accent = '#8b5a2b', icon: SignIcon = null) {
  ctx.font = `bold 12px 'Be Vietnam Pro', monospace`;
  const tw = Math.min(320, ctx.measureText(text).width + (icon ? 56 : 32));
  const bob = Math.sin(t * 1.4 + cx * 0.01) * 1.4;
  const yy = y + bob;
  axShadow(ctx, cx, yy + 18, tw / 2, 5, 0.22);
  // 2 dây treo viền
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 13, yy - 15); ctx.lineTo(cx - tw / 2 + 13, yy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + tw / 2 - 13, yy - 15); ctx.lineTo(cx + tw / 2 - 13, yy); ctx.stroke();
  ctx.strokeStyle = '#a9763b'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 13, yy - 15); ctx.lineTo(cx - tw / 2 + 13, yy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + tw / 2 - 13, yy - 15); ctx.lineTo(cx + tw / 2 - 13, yy); ctx.stroke();
  // khung gỗ + bảng kem
  const g = ctx.createLinearGradient(0, yy, 0, yy + 24);
  g.addColorStop(0, '#b07a3e'); g.addColorStop(1, '#7c4f21');
  axFrame(ctx, cx - tw / 2 - 2, yy - 2, tw + 4, 26, 11, g, 3);
  void accent;
  rr(ctx, cx - tw / 2 + 3, yy + 2, tw - 6, 18, 8); ctx.fillStyle = '#fff3d6'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(cx - tw / 2 + 6, yy + 4, tw - 12, 3);
  // đinh + highlight
  ctx.fillStyle = '#4a3226';
  ctx.beginPath(); ctx.arc(cx - tw / 2 + 8, yy + 11, 2.2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + tw / 2 - 8, yy + 11, 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.arc(cx - tw / 2 + 7.4, yy + 10.2, 0.8, 0, 7); ctx.fill();
  if (icon === 'sprout') drawSprout(ctx, cx - tw / 2 + 21, yy + 13, 15, t);
  else if (icon === 'fish') drawFish(ctx, cx - tw / 2 + 21, yy + 9, 20, 'caro', t);
  else if (icon === 'chicken') drawChickenHead(ctx, cx - tw / 2 + 21, yy + 10, 15);
  else if (icon === 'cow') drawCowHead(ctx, cx - tw / 2 + 21, yy + 10, 16);
  txt(ctx, text, cx + (icon ? 11 : 0), yy + 15, 12, '#fff3d6');
  if (Math.sin(t * 2.4 + cx) > 0.7) drawSparkle(ctx, cx + tw / 2 + 8, yy + 2, 4.5, 0.9);
}

// ---------- hòm thư anime: trụ viền + hộp bo + cờ tim + nhãn pill ----------
function drawMailbox(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number, label: string) {
  axShadow(ctx, X, Y + 21, 16, 5, 0.24);
  // đế đá anime
  axFrame(ctx, X - 10, Y + 15, 20, 7, 3.5, '#b0bec5', 2.2);
  // cột gỗ viền
  const cg = ctx.createLinearGradient(X - 5, 0, X + 5, 0);
  cg.addColorStop(0, '#7c4f21'); cg.addColorStop(0.5, '#b07a3e'); cg.addColorStop(1, '#7c4f21');
  axFrame(ctx, X - 5, Y - 4, 10, 24, 4, cg, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X - 2, Y - 2, 2.4, 20);
  // thân hộp thư bo viền
  axShadow(ctx, X, Y - 6, 17, 3, 0.2);
  const bg = ctx.createLinearGradient(0, Y - 26, 0, Y - 5);
  bg.addColorStop(0, '#3f9be0'); bg.addColorStop(1, '#1565c0');
  axFrame(ctx, X - 17, Y - 26, 34, 21, 7, bg, 2.8);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(X - 14, Y - 24, 28, 4);
  ctx.fillStyle = '#0b3d7a';
  rr(ctx, X - 11, Y - 15, 22, 4, 2); ctx.fill();
  // nắp cong viền + núm vàng
  ctx.fillStyle = '#0b3d7a';
  ctx.beginPath(); ctx.ellipse(X, Y - 26, 16, 7, 0, Math.PI, 0); ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath(); ctx.arc(X, Y - 14, 3.2, 0, 7); ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // cờ anime vẫy + tim
  const wave = Math.sin(t * 3.2) * 2.2;
  rr(ctx, X + 14, Y - 38, 3.5, 15, 1.7); ctx.fillStyle = '#7c4f21'; ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  axFrame(ctx, X + 14, Y - 38 + wave * 0.3, 15, 8, 3, '#ff5b5b', 2);
  axBlush(ctx, X + 20, Y - 36 + wave * 0.3, 2.4, 1.4, 0.5);
  // phong bì lơ lửng + lấp lánh
  const fy = Y - 30 + Math.sin(t * 2.2) * 2.5;
  drawEnvelope(ctx, X - 4, fy, 18);
  if (Math.sin(t * 4) > 0.3) drawSparkle(ctx, X + 12, fy - 10, 5, 0.9);
  // hoa tí hon dưới chân + nhãn pill
  axFlower(ctx, X - 14, Y + 12, 5, '#ffffff');
  axFlower(ctx, X + 14, Y + 13, 5, '#ff8fb0');
  axNamePill(ctx, X, Y + 24, label);
}

// ============================================================
//  NỀN CỎ + ĐƯỜNG ĐẤT
// ============================================================
function drawGrassBase(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, H: number, t: number) {
  // --- đồng cỏ anime: gradient dọc + quầng nắng + caro mềm ---
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#8fd45e');
  bg.addColorStop(0.5, '#7cc74f');
  bg.addColorStop(1, '#6fb844');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const x0 = Math.floor(cam.x / TILE) * TILE, y0 = Math.floor(cam.y / TILE) * TILE;
  for (let gx = x0; gx < cam.x + W + TILE; gx += TILE) {
    for (let gy = y0; gy < cam.y + H + TILE; gy += TILE) {
      const odd = (Math.round(gx / TILE) + Math.round(gy / TILE)) % 2 === 0;
      ctx.fillStyle = odd ? 'rgba(255,255,255,.06)' : 'rgba(30,90,30,.06)';
      ctx.fillRect(gx - cam.x, gy - cam.y, TILE, TILE);
      const h = hash2(gx, gy);
      if (h > 0.55) {
        // mảng cỏ loang viền mềm
        ctx.fillStyle = h > 0.8 ? 'rgba(255,255,180,.10)' : 'rgba(46,125,50,.12)';
        ell(ctx, gx - cam.x + h * 40, gy - cam.y + (1 - h) * 40, 20, 11);
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ell(ctx, gx - cam.x + h * 40 - 6, gy - cam.y + (1 - h) * 40 - 3, 8, 4);
      }
    }
  }
  // quầng nắng di chuyển rất chậm cho cảm giác anime (Thấp: tắt)
  for (let k = 0; k < (Q_LOW ? 0 : 3); k++) {
    const sx = ((k * 640 + t * 12) % (WORLD.w + 400)) - 200 - cam.x;
    const sy = ((k * 410 + 150) % WORLD.h) - cam.y;
    if (sx < -200 || sx > W + 200) continue;
    const g2 = ctx.createRadialGradient(sx, sy, 10, sx, sy, 220);
    g2.addColorStop(0, 'rgba(255,255,200,.10)');
    g2.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(sx, sy, 220, 0, 7); ctx.fill();
  }
  // chi tiết mặt đất anime (né khu chức năng + đường; Thấp: vẽ một nửa)
  for (let i = 0; i < 170; i++) {
    if (Q_LOW && i % 2 === 1) continue;
    const fx = (i * 211.7) % WORLD.w, fy = (i * 349.3) % WORLD.h;
    if (fx > 20 && fx < 1000 && fy > 210 && fy < 710) continue; // tránh ruộng
    if (fx > 1050 && fx < 1560 && fy > 200 && fy < 660) continue; // tránh ao
    if (fx > 30 && fx < 1030 && fy > 780 && fy < 1050) continue; // tránh chuồng
    if (fx > ROAD_V.x - 16 && fx < ROAD_V.x + ROAD_V.w + 16) continue;
    if (fy > ROAD_H.y - 16 && fy < ROAD_H.y + ROAD_H.h + 16) continue;
    if (fy > 1010 && fy < WORLD.h) continue;
    if (fx > 1120 && fx < 1360 && fy > 790 && fy < 990) continue;
    const X = fx - cam.x, Y = fy - cam.y;
    if (X < -24 || Y < -24 || X > W + 24 || Y > H + 24) continue;
    const h = hash2(i, 7);
    if (i % 5 === 0) {
      axFlower(ctx, X + 9, Y - 8, 6.5, ['#ff8fb0', '#ffffff', '#ffeb3b', '#ce93d8'][i % 4]);
      axGrassTuft(ctx, X, Y, 1, t, i);
    } else if (i % 9 === 0) {
      axStone(ctx, X, Y - 1, 6, 4, i % 2 ? '#c3ced6' : '#b0bec5');
      axGrassTuft(ctx, X + 9, Y + 2, 0.8, t, i + 3);
    } else if (i % 17 === 0) {
      axMushroom(ctx, X, Y, 11);
      axGrassTuft(ctx, X - 10, Y + 1, 0.9, t, i + 7);
    } else {
      axGrassTuft(ctx, X, Y, h > 0.5 ? 1 : 0.8, t, i, h < 0.3);
      if (h > 0.86) {
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ell(ctx, X + 4, Y - 12, 1.6, 1.6);
      }
    }
  }
  // cánh bồ công anh bay (điểm nhấn anime) — world-lock, trôi theo gió trong map
  for (let i = 0; i < 5; i++) {
    const px = pmod(i * 397 + t * (18 + i * 4), WORLD.w) - cam.x;
    if (px < -40 || px > W + 40) continue;
    const py = pmod(90 + ((i * 173) % 320), WORLD.h) - cam.y;
    if (py < -40 || py > H + 40) continue;
    const pyW = py + Math.sin(t * 1.5 + i * 2) * 18;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px, pyW); ctx.lineTo(px + 5, pyW - 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2 + t * 0.8 + i;
      ell(ctx, px + 5 + Math.cos(a) * 3.4, pyW - 4 + Math.sin(a) * 3.4, 1.3, 1.3);
    }
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  // đường đất anime: viền nâu dày bo tròn + nền mật ong gradient + tim đường kawaii
  const drawStrip = (x: number, y: number, w: number, h: number) => {
    const X = x - cam.x, Y = y - cam.y;
    axShadow(ctx, X + w / 2, Y + h + 4, w / 2 + 8, 7, 0.2);
    // viền ngoài
    rr(ctx, X - 7, Y - 7, w + 14, h + 14, 12);
    ctx.fillStyle = '#6d6a6e'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    // nền đất
    const g = ctx.createLinearGradient(0, Y, 0, Y + h);
    g.addColorStop(0, '#f6e3ae'); g.addColorStop(0.5, '#eacb8a'); g.addColorStop(1, '#ddb273');
    rr(ctx, X, Y, w, h, 8); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.save();
    rr(ctx, X, Y, w, h, 8); ctx.clip();
    axGlint(ctx, X, Y, w, h);
    ctx.fillStyle = 'rgba(140,95,40,.16)'; ctx.fillRect(X, Y + h - 10, w, 10);
    ctx.restore();
  };
  drawStrip(ROAD_H.x0, ROAD_H.y, WORLD.w, ROAD_H.h);
  drawStrip(ROAD_V.x, ROAD_V.y0, ROAD_V.w, ROAD_V.y1 - ROAD_V.y0);
  const vcx = roadVCenter(), hcy = roadHCenter();
  // tim đường: viên kẹo bo tròn trắng viền nâu nhạt
  const dotH = (x: number, y: number, w: number, h: number) => {
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,85,45,.7)'; ctx.stroke();
  };
  for (let y = ROAD_V.y0 + 12; y < ROAD_V.y1 - 12; y += 36) {
    if (y + 18 > ROAD_H.y - 8 && y < ROAD_H.y + ROAD_H.h + 8) continue;
    dotH(vcx - 4 - cam.x, y - cam.y, 8, 18);
  }
  for (let x = 14; x < WORLD.w - 14; x += 40) {
    if (x + 22 > ROAD_V.x - 8 && x < ROAD_V.x + ROAD_V.w + 8) continue;
    dotH(x - cam.x, hcy - 4 - cam.y, 22, 8);
  }
  // vệt bánh xe mềm 2 bên
  ctx.fillStyle = 'rgba(140,95,40,.20)';
  for (let x = 0; x < WORLD.w; x += 46) {
    rr(ctx, x - cam.x, ROAD_H.y + 16 - cam.y, 24, 6, 3); ctx.fill();
    rr(ctx, x - cam.x, ROAD_H.y + ROAD_H.h - 22 - cam.y, 24, 6, 3); ctx.fill();
  }
  // sỏi anime có viền
  for (let i = 0; i < 34; i++) {
    const px = (i * 173) % WORLD.w - cam.x, py = ROAD_H.y + 12 + ((i * 97) % (ROAD_H.h - 24)) - cam.y;
    ctx.fillStyle = i % 2 ? '#d7b56d' : '#f4e2ac';
    ctx.beginPath(); ctx.ellipse(px, py, 3.6, 2.4, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(90,60,25,.6)'; ctx.stroke();
  }
  // đá viền anime 2 mép đường dọc
  for (let y = 0; y < ROAD_V.y1; y += 56) {
    axStone(ctx, ROAD_V.x - 11 - cam.x, y - cam.y, 8, 5.6, (y / 56) % 2 ? '#c3ced6' : '#dbe4ea');
    axStone(ctx, ROAD_V.x + ROAD_V.w + 11 - cam.x, y - cam.y, 8, 5.6, (y / 56) % 2 ? '#dbe4ea' : '#c3ced6');
  }
  // cỏ anime ven đường
  for (let x = 0; x < WORLD.w; x += 84) {
    axGrassTuft(ctx, x - cam.x, ROAD_H.y - 8 - cam.y, 0.9, t, x);
    axGrassTuft(ctx, x + 30 - cam.x, ROAD_H.y + ROAD_H.h + 8 - cam.y, 0.9, t, x + 5);
    if (x % 252 === 0) {
      axFlower(ctx, x + 46 - cam.x, ROAD_H.y - 14 - cam.y, 6, '#ff8fb0');
      axFlower(ctx, x + 12 - cam.x, ROAD_H.y + ROAD_H.h + 14 - cam.y, 6, '#ffffff');
    }
  }
  // biển chỉ đường anime treo dây (cùng ngôn ngữ 3 nhà)
  const sx = vcx + ROAD_V.w / 2 + 66 - cam.x, sy = ROAD_H.y - 40 - cam.y;
  axShadow(ctx, sx, sy + 24, 52, 5, 0.2);
  ctx.fillStyle = '#7c4f21';
  rr(ctx, sx - 4, sy - 4, 8, 30, 4); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#a9763b';
  rr(ctx, sx - 58, sy - 30, 116, 28, 10); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  rr(ctx, sx - 53, sy - 26, 106, 20, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  txt(ctx, '← RUỘNG · AO →', sx, sy - 11, 8, '#fff3d6');
  // đinh + lấp lánh
  ctx.fillStyle = '#4a3226';
  ctx.beginPath(); ctx.arc(sx - 52, sy - 16, 2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 52, sy - 16, 2, 0, 7); ctx.fill();
  if (Math.sin(t * 3) > 0.5) drawSparkle(ctx, sx + 62, sy - 26, 5, 0.9);
}

// ---------- hàng rào gỗ anime (viền nâu + đầu bo + nơ) ----------
function drawFence(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }) {
  const post = (x: number, y: number) => {
    const X = x - cam.x, Y = y - cam.y;
    axShadow(ctx, X, Y + 15, 7, 3, 0.2);
    // thân trụ gradient
    const g = ctx.createLinearGradient(X - 6, 0, X + 6, 0);
    g.addColorStop(0, '#9a6530'); g.addColorStop(0.5, '#d99a55'); g.addColorStop(1, '#9a6530');
    rr(ctx, X - 6, Y - 8, 12, 24, 5); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    // mũ trụ bo + highlight
    rr(ctx, X - 8, Y - 14, 16, 9, 4.5); ctx.fillStyle = '#7c4f21'; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(X - 5, Y - 12, 4, 2.4);
    // vân gỗ
    ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(X - 2, Y - 4); ctx.lineTo(X - 2, Y + 12); ctx.stroke();
  };
  const rail = (x: number, y: number, w: number) => {
    const X = x - cam.x, Y = y - cam.y;
    axShadow(ctx, X + w / 2, Y + 10, w / 2, 3, 0.15);
    const g = ctx.createLinearGradient(0, Y, 0, Y + 9);
    g.addColorStop(0, '#c98a4b'); g.addColorStop(1, '#8b5a2b');
    rr(ctx, X, Y, w, 9, 4.5); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X + 3, Y + 1.5, w - 6, 2.4);
  };
  const fx0 = FARM.x - 16, fy0 = FARM.y - 20, fx1 = FARM.x + FARM.w + 16, fy1 = FARM.y + FARM.h + 14;
  rail(fx0, fy0, fx1 - fx0); rail(fx0, fy1, fx1 - fx0);
  for (let x = fx0; x <= fx1; x += 46) { post(x, fy0 + 4); post(x, fy1 + 4); }
  // cổng ruộng anime: 2 trụ cao + biển mật ong
  const gx = FARM.x + FARM.w / 2 - cam.x, gy = FARM.y + FARM.h + 14 - cam.y;
  for (const ox of [-30, 22]) {
    const X = gx + ox;
    axShadow(ctx, X + 4, gy + 4, 8, 3, 0.2);
    const g = ctx.createLinearGradient(X - 5, 0, X + 5, 0);
    g.addColorStop(0, '#7c4f21'); g.addColorStop(0.5, '#b07a3e'); g.addColorStop(1, '#7c4f21');
    rr(ctx, X - 5, gy - 26, 10, 30, 5); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#ff5b8b';
    ctx.beginPath(); ctx.arc(X, gy - 28, 4.4, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  axShadow(ctx, gx - 4, gy - 18, 40, 4, 0.2);
  axFrame(ctx, gx - 34, gy - 32, 60, 15, 7, '#ffd24d', 2.6);
  txt(ctx, 'FARM', gx - 4, gy - 20, 8, '#fff3d6');
  // rào chuồng / trại: dùng chung style nhưng thấp hơn
  for (let x = COOP.x - 10; x < COOP.x + COOP.w + 10; x += 38) post(x, COOP.y - 10);
  rail(COOP.x - 10, COOP.y - 12, COOP.w + 20);
  for (let x = BARN.x - 10; x < BARN.x + BARN.w + 10; x += 38) post(x, BARN.y - 10);
  rail(BARN.x - 10, BARN.y - 12, BARN.w + 20);
}

// ============================================================
//  RUỘNG — 5 GIAI ĐOẠN CÂY
// ============================================================
function drawPlotSoil(ctx: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, watered: boolean, t: number, idx: number) {
  // --- luống anime: khung gỗ bo viền nâu + đất gradient + rãnh bo ---
  axShadow(ctx, X + 2, Y + h / 2 + 5, w / 2, 5, 0.22);
  rr(ctx, X - w / 2 - 4, Y - h / 2 - 4, w + 8, h + 8, 9);
  ctx.fillStyle = '#7c4f21'; ctx.fill();
  ctx.lineWidth = 2.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  const base = ctx.createLinearGradient(0, Y - h / 2, 0, Y + h / 2);
  if (watered) { base.addColorStop(0, '#5a3a1e'); base.addColorStop(1, '#3c2410'); }
  else { base.addColorStop(0, '#9a6a3e'); base.addColorStop(1, '#7a5230'); }
  rr(ctx, X - w / 2, Y - h / 2, w, h, 6); ctx.fillStyle = base; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.save();
  rr(ctx, X - w / 2, Y - h / 2, w, h, 6); ctx.clip();
  axGlint(ctx, X - w / 2, Y - h / 2, w, h);
  // luống 4 rãnh bo tròn
  for (let r = 0; r < 4; r++) {
    const ry = Y - h / 2 + 7 + r * ((h - 12) / 4);
    rr(ctx, X - w / 2 + 5, ry, w - 10, 7.5, 3.75);
    ctx.fillStyle = watered ? '#2c1c0c' : '#5e3c1f'; ctx.fill();
    rr(ctx, X - w / 2 + 5, ry, w - 10, 2.6, 1.3);
    ctx.fillStyle = watered ? 'rgba(140,200,255,.4)' : 'rgba(255,235,200,.4)'; ctx.fill();
  }
  // cục đất anime có viền
  for (let k = 0; k < 5; k++) {
    const hsh = hash2(idx * 13, k * 31);
    const px = X - w / 2 + 8 + hsh * (w - 16);
    const py = Y - h / 2 + 8 + hash2(k, idx) * (h - 16);
    ctx.fillStyle = watered ? '#2e1c0c' : '#b08968';
    ctx.beginPath(); ctx.ellipse(px, py, 2.6, 1.9, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,35,10,.6)'; ctx.stroke();
  }
  ctx.restore();
  if (watered) {
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + idx);
    ctx.fillStyle = `rgba(150,210,255,${0.4 + tw * 0.3})`;
    ell(ctx, X - w / 2 + 11, Y - h / 2 + 9, 7.5, 2.6);
    ell(ctx, X + w / 4, Y + h / 2 - 9, 9.5, 2.6);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ell(ctx, X - w / 2 + 9, Y - h / 2 + 8, 2, 1);
    if (tw > 0.8) drawSparkle(ctx, X + w / 2 - 8, Y - h / 2 + 10, 4.5, 0.9);
  } else {
    // nứt anime khi khô
    ctx.strokeStyle = 'rgba(50,28,8,.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X - 12, Y - 4); ctx.lineTo(X - 2, Y + 1); ctx.lineTo(X + 6, Y - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 2, Y + 10); ctx.lineTo(X + 12, Y + 13); ctx.stroke();
  }
}

/** Hiệu ứng động tác trên ô ruộng: cuốc / gieo / tưới / phun / thu hoạch.
 *  p = 0..1 tiến trình (~1.3s). Vẽ ngay trên ô đất nên màn nào cũng thấy. */
function drawPlotFx(ctx: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, kind: 'hoe' | 'plant' | 'water' | 'spray' | 'harvest', p: number, t: number, crop?: string) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  if (kind === 'hoe') {
    // cuốc bổ xuống 2 nhát: cán cuốc xoay + đất văng + bụi
    const swing = Math.sin(p * Math.PI * 2) * 0.55;
    ctx.save();
    ctx.translate(X, Y - h / 2 - 6);
    ctx.rotate(-0.5 + swing);
    drawHoeMini(ctx, 0, 26, 22);
    ctx.restore();
    for (let k = 0; k < 4; k++) {
      const ph = clamp01(p * 1.6 - k * 0.18);
      if (ph <= 0) continue;
      const cx = X - 22 + k * 14;
      const cy = Y + 6 - Math.sin(ph * Math.PI) * 30;
      ctx.globalAlpha = 1 - ph * 0.7;
      ctx.fillStyle = '#7a5230';
      ctx.beginPath(); ctx.ellipse(cx, cy, 4.5, 3.4, 0.3, 0, 7); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(60,35,10,.7)'; ctx.stroke();
      // bụi xám
      ctx.fillStyle = 'rgba(220,210,190,.7)';
      ctx.beginPath(); ctx.arc(cx - 6, cy + 8, 3 + ph * 5, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p > 0.55 && p < 0.95) drawSparkle(ctx, X, Y - h / 2 - 14, 5, 0.9);
  } else if (kind === 'plant') {
    // hạt rơi từ trên xuống đất theo đợt + mầm đội đất nhú lên cuối
    for (let k = 0; k < 4; k++) {
      const ph = clamp01(p * 1.7 - k * 0.16);
      if (ph <= 0) continue;
      const sx = X - 24 + k * 16;
      const sy = Y - 62 + ph * ph * 68;
      if (ph < 1) {
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy - 3); ctx.stroke();
      }
      drawSeedDot(ctx, sx, Math.min(sy, Y + 6), 12);
      if (ph >= 1) drawSparkle(ctx, sx, Y - 2, 4, 0.8);
    }
    if (p > 0.6) {
      const grow = clamp01((p - 0.6) / 0.4);
      ctx.save();
      ctx.translate(X, Y + 8); ctx.scale(grow, grow); ctx.translate(-X, -(Y + 8));
      drawSprout(ctx, X, Y + 8, 22, t);
      ctx.restore();
    }
  } else if (kind === 'water') {
    // bình tưới nghiêng + tia nước vòng cung + gợn sóng trên luống
    const tilt = -0.35 + Math.sin(Math.min(1, p * 1.3) * Math.PI) * 0.12;
    const canX = X - w / 2 - 6, canY = Y - h / 2 - 26;
    ctx.save();
    ctx.translate(canX, canY); ctx.rotate(tilt);
    // thân bình
    axFrame(ctx, -13, -8, 26, 20, 6, '#3b82f6', 2.2);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-10, -6, 20, 3);
    // vòi
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(12, -2); ctx.lineTo(26, 8); ctx.stroke();
    ctx.strokeStyle = '#90caf9'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, -2); ctx.lineTo(26, 8); ctx.stroke();
    ctx.restore();
    // tia nước: hạt chạy dọc đường cong từ vòi xuống luống
    const pour = clamp01(p * 1.5);
    if (pour > 0.05 && pour < 1) {
      ctx.fillStyle = 'rgba(120,190,255,.9)';
      for (let d = 0; d < 7; d++) {
        const q = (pour * 1.2 - d * 0.09 + t * 0.7) % 1;
        if (q < 0 || q > 1) continue;
        const qx = canX + 26 + q * (X - canX - 20);
        const qy = canY + 10 + q * q * (Y - canY);
        ctx.beginPath(); ctx.arc(qx, qy, 2.4, 0, 7); ctx.fill();
      }
    }
    // gợn sóng loang trên luống
    for (let r = 0; r < 2; r++) {
      const rp = clamp01(p * 1.4 - r * 0.3);
      if (rp <= 0) continue;
      ctx.globalAlpha = (1 - rp) * 0.8;
      ctx.strokeStyle = '#9fd4ff'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(X, Y + 4, 8 + rp * 34, 3 + rp * 10, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else if (kind === 'spray') {
    // mây thuốc trắng xanh lan ra + sâu rớt xuống + lấp lánh khử trùng
    for (let k = 0; k < 6; k++) {
      const ph = clamp01(p * 1.5 - k * 0.1);
      if (ph <= 0) continue;
      const px = X - 30 + k * 12 + Math.sin(t * 3 + k) * 4;
      const py = Y - 14 + Math.cos(t * 2.4 + k * 2) * 5 - ph * 10;
      ctx.globalAlpha = (1 - ph) * 0.75;
      ctx.fillStyle = k % 2 ? '#e8f5e9' : '#c8e6c9';
      ctx.beginPath(); ctx.arc(px, py, 7 + ph * 9, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // sâu bị diệt rớt bịch xuống đất
    for (let k = 0; k < 2; k++) {
      const ph = clamp01(p * 1.3 - 0.25 - k * 0.2);
      if (ph <= 0) continue;
      const bx = X - 10 + k * 22;
      const by = Y - 20 + ph * ph * 30;
      ctx.fillStyle = '#4e342e';
      ctx.beginPath(); ctx.ellipse(bx, Math.min(by, Y + 12), 3.6, 2.6, 0.3, 0, 7); ctx.fill();
      // mắt X_X
      ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(bx - 2, by - 3); ctx.lineTo(bx, by - 1); ctx.moveTo(bx, by - 3); ctx.lineTo(bx - 2, by - 1); ctx.stroke();
      if (ph >= 1) drawSparkle(ctx, bx, Y + 6, 4, 0.85);
    }
  } else {
    // thu hoạch: quả bay vòng lên giỏ + chữ +1 nảy lên
    const bx = X + w / 2 - 8, by = Y - h / 2 + 14 + Math.abs(Math.sin(t * 6)) * 3;
    for (let k = 0; k < 3; k++) {
      const ph = clamp01(p * 1.5 - k * 0.18);
      if (ph <= 0) continue;
      const sx = X + (bx - X) * ph;
      const sy = Y + 6 + (by - Y - 6) * ph - Math.sin(ph * Math.PI) * 34;
      const pulse = 0.5 + 0.5 * Math.sin(t * 8 + k * 2);
      ctx.fillStyle = `rgba(255,225,90,${1 - ph * 0.4})`;
      ctx.beginPath(); ctx.arc(sx, sy, 5 + pulse * 1.5, 0, 7); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,70,10,.8)'; ctx.stroke();
      if (crop) drawSparkle(ctx, sx, sy - 8, 4, 0.8);
    }
    // giỏ nảy ăn mừng
    const bounce = Math.abs(Math.sin(p * Math.PI * 2)) * -5;
    axFrame(ctx, bx - 10, by - 10 + bounce, 20, 20, 8, '#fff3d6', 2);
    drawBasket(ctx, bx, by + bounce, 19);
    // chữ +1 bay lên
    ctx.globalAlpha = 1 - p;
    txt(ctx, '+1', X, Y - h / 2 - 16 - p * 26, 15, '#ffeb3b');
    ctx.globalAlpha = 1;
  }
}

/** Màu hào quang chín theo từng loại cây: [màu chính, màu nhạt] ("r,g,b") */
const CROP_AURA: Record<string, [string, string]> = {
  lua: ['255,214,60', '255,242,170'],
  carot: ['255,150,40', '255,210,140'],
  caixanh: ['110,255,140', '200,255,200'],
  cachua: ['255,100,115', '255,180,180'],
  khoai: ['205,150,255', '235,210,255'],
  bap: ['255,205,80', '255,235,170'],
  dualeo: ['140,255,150', '205,255,200'],
  catim: ['185,125,255', '225,195,255'],
  dautay: ['255,95,125', '255,175,190'],
  duahau: ['110,240,140', '190,255,200'],
  nho: ['170,120,255', '215,185,255'],
  bingo: ['255,145,40', '255,205,140'],
  caphe: ['255,90,90', '255,170,170'],
  nam: ['255,115,110', '255,185,170'],
  sam: ['255,170,80', '255,220,170'],
};
const auraOf = (id: string): [string, string] => CROP_AURA[id] ?? ['255,225,80', '255,240,160'];

/** Vẽ cây theo từng loại + giai đoạn 0..4. Gốc tại (cx, baseY). */
function drawCropPlant(ctx: CanvasRenderingContext2D, cx: number, baseY: number, cropId: string, stage: number, t: number, seed: number) {
  // Phóng to 1.5x mọi giai đoạn quanh gốc (cây choán hết ô đất)
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(1.5, 1.5);
  ctx.translate(-cx, -baseY);
  try {
    drawCropPlantInner(ctx, cx, baseY, cropId, stage, t, seed);
  } finally {
    ctx.restore();
  }
}

/** Ruột vẽ cây (đã được wrapper drawCropPlant phóng 2x). Gốc tại (cx, baseY). */
function drawCropPlantInner(ctx: CanvasRenderingContext2D, cx: number, baseY: number, cropId: string, stage: number, t: number, seed: number) {
  const sway = Math.sin(t * 1.8 + seed * 1.7) * (stage >= 2 ? 1.6 : 0.8);
  ctx.lineCap = 'round';
  // bóng mềm dưới gốc cho nổi khối anime
  if (stage >= 1) axShadow(ctx, cx, baseY + 3, stage >= 4 ? 16 : 11, 3.4, 0.25);
  const leaf = (x: number, y: number, len: number, ang: number, col: string, w = 5) => {
    const ex = x + Math.cos(ang) * len + sway * 0.4, ey = y + Math.sin(ang) * len;
    const mx = x + Math.cos(ang) * len * 0.6, my = y + Math.sin(ang) * len * 0.6 - 3;
    ctx.strokeStyle = 'rgba(35,70,25,.9)'; ctx.lineWidth = w + 2.2 + (stage === 4 ? 1.4 : 0);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, (x + ex) / 2, (y + ey) / 2); ctx.stroke();
  };
  const stem = (h: number, col = '#2e7d32', w = 4) => {
    ctx.strokeStyle = 'rgba(35,70,25,.9)'; ctx.lineWidth = w + 2.2 + (stage === 4 ? 1.4 : 0);
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(cx + sway * 0.4, baseY - h * 0.6, cx + sway, baseY - h); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(cx + sway * 0.4, baseY - h * 0.6, cx + sway, baseY - h); ctx.stroke();
  };
  const dot = (x: number, y: number, r: number, c: string) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(60,30,15,.55)'; ctx.stroke();
  };
  // quả lung linh: quầng sáng + thân bóng + highlight sao — item chính của game
  const glowDot = (x: number, y: number, r: number, c: string) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + x * 0.1 + y * 0.07);
    // quầng ngoài
    const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.6);
    halo.addColorStop(0, 'rgba(255,255,220,.55)');
    halo.addColorStop(0.55, 'rgba(255,235,120,.22)');
    halo.addColorStop(1, 'rgba(255,235,120,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 7); ctx.fill();
    // thân quả căng mọng + viền nâu
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, c);
    g.addColorStop(1, c);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(60,30,15,.6)'; ctx.stroke();
    // highlight sao 4 cánh
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.28, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    const sr = r * (1.5 + pulse * 0.5);
    ctx.beginPath(); ctx.moveTo(x - sr, y); ctx.lineTo(x + sr, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - sr); ctx.lineTo(x, y + sr); ctx.stroke();
  };
  // hào quang nền siêu thực dưới cây (dùng cho GĐ3 chín non + GĐ4 chín rộ)
  const auraBloom = (cx2: number, baseY2: number, H2: number, col: string, alpha: number) => {
    const pulse2 = 0.5 + 0.5 * Math.sin(t * 3.2 + seed * 1.3);
    for (let k = 0; k < 2; k++) {
      const rr2 = (k === 0 ? 26 : 17) + pulse2 * 4;
      const g2 = ctx.createRadialGradient(cx2, baseY2 - H2 / 2, 2, cx2, baseY2 - H2 / 2, rr2);
      g2.addColorStop(0, col.replace('A', String(alpha * (k === 0 ? 0.5 : 0.75))));
      g2.addColorStop(1, col.replace('A', '0'));
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(cx2, baseY2 - H2 / 2, rr2, rr2 * 0.8, 0, 0, 7); ctx.fill();
    }
  };
  // tia lấp lánh bay quanh cây (hoa/mùi hương giai đoạn 3-4)
  const twinkles = (cx2: number, baseY2: number, H2: number, n: number, col = '#fff8b0') => {    for (let k = 0; k < n; k++) {
      const ph = seed * 2.1 + k * 2.4;
      const px = cx2 + Math.sin(t * 1.7 + ph) * (16 + (k % 3) * 6);
      const py = baseY2 - H2 - 6 + Math.cos(t * 2.2 + ph * 1.3) * 8 - (k * 5);
      const tw = Math.sin(t * 4 + ph * 2);
      if (tw > -0.1) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, tw);
        const s = 1.4 + (k % 3) * 0.7;
        ctx.fillRect(px - s / 2, py - s * 2, s, s * 4);
        ctx.fillRect(px - s * 2, py - s / 2, s * 4, s);
        ctx.globalAlpha = 1;
      }
    }
  };

  if (stage === 0) {
    // GĐ1 nảy mầm: 2 lá mầm ôm hạt + giọt sương long lanh
    stem(9, '#388e3c', 3);
    leaf(cx, baseY - 8, 8, Math.PI * 1.15, '#66bb6a', 4);
    leaf(cx, baseY - 8, 8, Math.PI * 1.85, '#66bb6a', 4);
    dot(cx + sway * 0.3, baseY - 11, 2.5, '#a5d6a7');
    const dewX = cx + 6 + Math.sin(t * 2 + seed) * 1.5, dewY = baseY - 9;
    ctx.fillStyle = 'rgba(180,230,255,.9)';
    ctx.beginPath(); ctx.arc(dewX, dewY, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dewX - 0.6, dewY - 0.6, 0.7, 0, 7); ctx.fill();
    if (Math.sin(t * 3 + seed * 2) > 0.55) drawSparkle(ctx, cx - 8, baseY - 14, 4, 0.9);
    return;
  }
  if (stage === 1) {
    // GĐ2 cây non: thân + 4 lá + chồi non phát sáng nhẹ
    stem(20, '#2e7d32', 4);
    leaf(cx, baseY - 10, 10, Math.PI * 1.2, '#43a047');
    leaf(cx, baseY - 10, 10, Math.PI * 1.8, '#43a047');
    leaf(cx, baseY - 16, 9, Math.PI * 1.35, '#66bb6a', 4);
    leaf(cx, baseY - 16, 9, Math.PI * 1.65, '#66bb6a', 4);
    dot(cx + sway, baseY - 21, 3, '#81c784');
    const gY = baseY - 21;
    const gg = ctx.createRadialGradient(cx + sway, gY, 1, cx + sway, gY, 9);
    gg.addColorStop(0, 'rgba(180,255,140,.5)'); gg.addColorStop(1, 'rgba(180,255,140,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx + sway, gY, 9, 0, 7); ctx.fill();
    twinkles(cx, baseY, 20, 2);
    return;
  }
  // FINALE chín rộ — đỉnh cao cho MỌI cây: cột sáng trời + vũng sáng gốc +
  // sóng lan mặt đất + 3 vệ tinh bay quanh + vương miện sao trên ngọn (nhuộm màu cây)
  const ripeFinale = (cx2: number, baseY2: number, H2: number, ac = '255,225,80', soft = '255,240,160') => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + seed * 1.7);
    // cột sáng từ trời chiếu xuống (mờ hơn cây để cây nổi nhất)
    const beam = ctx.createLinearGradient(0, baseY2 - H2 - 48, 0, baseY2 + 6);
    beam.addColorStop(0, `rgba(${soft},0)`);
    beam.addColorStop(0.55, `rgba(${soft},${0.13 + pulse * 0.08})`);
    beam.addColorStop(1, `rgba(${ac},${0.18 + pulse * 0.1})`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx2 - 10, baseY2 - H2 - 48);
    ctx.lineTo(cx2 + 10, baseY2 - H2 - 48);
    ctx.lineTo(cx2 + 21, baseY2 + 6);
    ctx.lineTo(cx2 - 21, baseY2 + 6);
    ctx.closePath(); ctx.fill();
    // vũng sáng dưới gốc
    const pool = ctx.createRadialGradient(cx2, baseY2 + 3, 2, cx2, baseY2 + 3, 30);
    pool.addColorStop(0, `rgba(${ac},${0.36 + pulse * 0.15})`);
    pool.addColorStop(1, `rgba(${ac},0)`);
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(cx2, baseY2 + 3, 30, 9, 0, 0, 7); ctx.fill();
    // sóng lan mặt đất 2 vòng
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.7 + seed * 0.3 + k * 0.5) % 1;
      ctx.globalAlpha = (1 - ph) * 0.55;
      ctx.strokeStyle = `rgba(${soft},.9)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx2, baseY2 + 3, 8 + ph * 26, 3 + ph * 8, 0, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 3 vệ tinh bay quanh thân (vòng rộng ôm hết tán lớn)
    for (let k = 0; k < 3; k++) {
      const a = t * 2.2 + seed + k * 2.1;
      const ox = cx2 + Math.cos(a) * 30, oy = baseY2 - H2 / 2 - 6 + Math.sin(a) * (H2 / 2 + 8);
      const og = ctx.createRadialGradient(ox, oy, 0.5, ox, oy, 7);
      og.addColorStop(0, 'rgba(255,255,255,.95)');
      og.addColorStop(0.4, `rgba(${ac},.8)`);
      og.addColorStop(1, `rgba(${ac},0)`);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(ox, oy, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ox, oy, 1.8, 0, 7); ctx.fill();
    }
    // vương miện sao trên ngọn
    const crownY = baseY2 - H2 - 12 + Math.sin(t * 3 + seed) * 2;
    drawSparkle(ctx, cx2, crownY, 8, 0.95);
    if (Math.cos(t * 3.4 + seed * 2) > 0) drawSparkle(ctx, cx2 - 12, crownY + 6, 5, 0.85);
    if (Math.sin(t * 2.8 + seed) > 0) drawSparkle(ctx, cx2 + 12, crownY + 6, 5, 0.85);
  };
  // từ GĐ3 trở đi vẽ thân chính + tán theo loại cây (tán cao, hoành tráng hơn)
  const H = stage === 2 ? 28 : stage === 3 ? 34 : 38;
  // GĐ cuối: phóng to 1.38x quanh gốc — cây choán gần hết ô đất, to và rõ hơn hào quang
  const grand = stage === 4;
  if (grand) { ctx.save(); ctx.translate(cx, baseY); ctx.scale(1.38, 1.38); ctx.translate(-cx, -baseY); }
  switch (cropId) {
    case 'lua': { // lúa: chùm 6 nhánh mảnh, bông vàng rủ lung linh khi chín
      for (let k = -2; k <= 2; k++) {
        ctx.strokeStyle = stage >= 4 ? '#c9a227' : '#7cb342'; ctx.lineWidth = stage >= 4 ? 3 : 2.5;
        ctx.beginPath(); ctx.moveTo(cx, baseY);
        ctx.quadraticCurveTo(cx + k * 4, baseY - H * 0.6, cx + k * 5 + sway, baseY - H - (k % 2) * 4); ctx.stroke();
        if (stage >= 3) {
          const gx = cx + k * 5 + sway, gy = baseY - H - (k % 2) * 4;
          if (stage >= 4) {
            const lg = ctx.createRadialGradient(gx, gy + 4, 1, gx, gy + 4, 12);
            lg.addColorStop(0, 'rgba(255,240,150,.55)'); lg.addColorStop(1, 'rgba(255,240,150,0)');
            ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(gx, gy + 4, 12, 0, 7); ctx.fill();
            ctx.fillStyle = '#fdd835';
            ell(ctx, gx, gy + 4, 3.2, 6.5);
            ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(120,80,0,.6)'; ctx.stroke();
            ctx.fillStyle = '#fff9c4';
            ell(ctx, gx - 1, gy + 1, 1.1, 2);
          } else {
            ctx.fillStyle = '#dcedc8';
            ell(ctx, gx, gy + 4, 2.4, 5);
            dot(gx, gy, 2, '#fff');
          }
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
        // trái bắp ôm thân — chín thì to, vàng óng, hạt nổi
        const ripe = stage >= 4;
        const bw = ripe ? 6.5 : 5, bh = ripe ? 11 : 9;
        if (ripe) {
          const bg2 = ctx.createRadialGradient(cx + 8, baseY - 16, 2, cx + 8, baseY - 16, 20);
          bg2.addColorStop(0, 'rgba(255,220,100,.5)'); bg2.addColorStop(1, 'rgba(255,220,100,0)');
          ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(cx + 8, baseY - 16, 20, 0, 7); ctx.fill();
        }
        ctx.fillStyle = ripe ? '#ffb300' : '#dce775';
        ell(ctx, cx + 8 + sway * 0.5, baseY - 16, bw, bh);
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,70,0,.6)'; ctx.stroke();
        ctx.fillStyle = 'rgba(51,105,30,.85)';
        ell(ctx, cx + 8 + sway * 0.5, baseY - 16, 2, bh);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ell(ctx, cx + 8 + sway * 0.5 - 2.5, baseY - 20, 1.4, 4);
        if (ripe) { glowDot(cx + 8, baseY - 24, 2.6, '#ffeb3b'); glowDot(cx + 11, baseY - 18, 2.4, '#ffeb3b'); }
      }
      break;
    }
    case 'carot': { // cà rốt: lá xẻ + củ cam bóng mọng khi chín
      stem(18, '#2e7d32', 3.5);
      for (let k = 0; k < 5; k++) leaf(cx, baseY - 14, 12, Math.PI * (1.1 + k * 0.2), k % 2 ? '#43a047' : '#66bb6a', 3.5);
      if (stage >= 3) {
        const ripe = stage >= 4;
        const w2 = ripe ? 8 : 6, deep = ripe ? 13 : 5;
        if (ripe) {
          const cg = ctx.createRadialGradient(cx, baseY, 2, cx, baseY, 20);
          cg.addColorStop(0, 'rgba(255,180,80,.5)'); cg.addColorStop(1, 'rgba(255,180,80,0)');
          ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, baseY, 20, 0, 7); ctx.fill();
        }
        const grd = ctx.createLinearGradient(cx - w2, 0, cx + w2, 0);
        grd.addColorStop(0, ripe ? '#bf360c' : '#ef6c00'); grd.addColorStop(0.45, ripe ? '#ff9800' : '#ffb74d'); grd.addColorStop(1, ripe ? '#e65100' : '#f57c00');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(cx - w2, baseY - 2); ctx.lineTo(cx + w2, baseY - 2); ctx.lineTo(cx, baseY + deep); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,50,0,.6)'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - 4, baseY - 2, 2.5, deep * 0.7);
        // vân củ
        ctx.strokeStyle = 'rgba(140,60,0,.5)'; ctx.lineWidth = 1.2;
        for (let vv = 1; vv <= 3; vv++) {
          ctx.beginPath(); ctx.moveTo(cx - w2 * (1 - vv * 0.25), baseY + vv * 3); ctx.lineTo(cx + w2 * (1 - vv * 0.25), baseY + vv * 3); ctx.stroke();
        }
        if (ripe) glowDot(cx + w2 + 4, baseY - 6, 2.2, '#ffeb3b');
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
      if (stage === 4) {
        // chùm củ bóng mọng + hoa phát sáng
        const pg = ctx.createRadialGradient(cx, baseY, 2, cx, baseY, 22);
        pg.addColorStop(0, 'rgba(220,190,160,.5)'); pg.addColorStop(1, 'rgba(220,190,160,0)');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, baseY, 22, 0, 7); ctx.fill();
        glowDot(cx - 7, baseY - 26, 3, '#fff');
        glowDot(cx + 7, baseY - 22, 3, '#e1bee7');
        for (const [ox, oy] of [[-11, -1], [11, -1], [0, 2]] as [number, number][]) {
          const grd2 = ctx.createRadialGradient(cx + ox - 2, oy - 2, 1, cx + ox, oy, 6);
          grd2.addColorStop(0, '#d7ccc8'); grd2.addColorStop(1, '#8d6e63');
          ctx.fillStyle = grd2;
          ell(ctx, cx + ox, baseY + oy, 6, 4.6);
          ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(60,35,10,.6)'; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ell(ctx, cx + ox - 2, baseY + oy - 1.5, 1.6, 1.1);
        }
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
        if (cropId === 'catim') {
          // cà tím căng bóng: quầng tím + highlight dài
          for (const [ox, oy] of [[-9, 0], [9, -2]] as [number, number][]) {
            const hg = ctx.createRadialGradient(cx + ox, fy + oy, 2, cx + ox, fy + oy, 16);
            hg.addColorStop(0, 'rgba(200,150,255,.5)'); hg.addColorStop(1, 'rgba(200,150,255,0)');
            ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx + ox, fy + oy, 16, 0, 7); ctx.fill();
            const eg = ctx.createLinearGradient(cx + ox - 5, 0, cx + ox + 5, 0);
            eg.addColorStop(0, '#4a148c'); eg.addColorStop(0.5, '#9c27b0'); eg.addColorStop(1, '#4a148c');
            ctx.fillStyle = eg;
            ell(ctx, cx + ox, fy + oy, 5.5, 8.5);
            ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(40,10,60,.65)'; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.65)'; ell(ctx, cx + ox - 2, fy + oy - 4, 1.5, 3.5);
          }
          glowDot(cx, fy - 8, 2, '#e1bee7');
        } else if (cropId === 'dualeo') {
          for (const [ox, oy] of [[-9, 2], [9, 0]] as [number, number][]) {
            const hg = ctx.createRadialGradient(cx + ox, fy + oy, 2, cx + ox, fy + oy, 15);
            hg.addColorStop(0, 'rgba(180,255,170,.5)'); hg.addColorStop(1, 'rgba(180,255,170,0)');
            ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx + ox, fy + oy, 15, 0, 7); ctx.fill();
            const eg = ctx.createLinearGradient(cx + ox - 4, 0, cx + ox + 4, 0);
            eg.addColorStop(0, '#1b5e20'); eg.addColorStop(0.5, '#66bb6a'); eg.addColorStop(1, '#1b5e20');
            ctx.fillStyle = eg;
            ell(ctx, cx + ox, fy + oy, 4.5, 8.5);
            ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(15,60,20,.65)'; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.6)'; ell(ctx, cx + ox - 1.6, fy + oy - 4, 1.3, 3);
            // gai non
            ctx.fillStyle = '#dcedc8';
            ell(ctx, cx + ox - 3, fy + oy - 1, 0.9, 0.9); ell(ctx, cx + ox + 3, fy + oy + 2, 0.9, 0.9);
          }
        } else { glowDot(cx - 9, fy, 6.2, fruitCol); glowDot(cx + 9, fy - 3, 6.8, fruitCol); glowDot(cx, fy + 4, 5.2, fruitCol); }
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
          glowDot(cx - 8, baseY - 6, 4.4, '#e53935'); glowDot(cx + 7, baseY - 5, 4.4, '#e53935'); glowDot(cx, baseY - 2, 4, '#e53935');
          // hạt dâu li ti
          ctx.fillStyle = '#ffeb3b';
          for (const [ox, oy] of [[-8, -6], [7, -5], [0, -2]] as [number, number][]) {
            ell(ctx, cx + ox - 1.5, oy + baseY + 1, 0.8, 1.1); ell(ctx, cx + ox + 1.5, oy + baseY - 1, 0.8, 1.1);
          }
        } else {
          // cải xanh: búp nõn căng + lá non óng
          const cg2 = ctx.createRadialGradient(cx, baseY - 14, 2, cx, baseY - 14, 16);
          cg2.addColorStop(0, 'rgba(200,255,170,.55)'); cg2.addColorStop(1, 'rgba(200,255,170,0)');
          ctx.fillStyle = cg2; ctx.beginPath(); ctx.arc(cx, baseY - 14, 16, 0, 7); ctx.fill();
          glowDot(cx, baseY - 14, 5, '#9ccc65');
          leaf(cx, baseY - 6, 9, Math.PI * 1.5, '#b2ff59', 5);
        }
      }
      break;
    }
    case 'duahau': case 'bingo': {
      const big = cropId === 'bingo';
      for (let k = 0; k < 5; k++) leaf(cx, baseY - 3, 15, Math.PI * (1.05 + k * 0.22), '#43a047', 6);
      if (stage === 3) { dot(cx, baseY - 16, 3.4, '#ffeb3b'); }
      if (stage === 4) {
        const r = big ? 14 : 10.5;
        const fx = cx + 11, fy = baseY - r + 2;
        const bounce = Math.abs(Math.sin(t * 2.4 + seed)) * 1.6;
        const fxb = fx, fyb = fy - bounce;
        // quầng vàng dưới quả khổng lồ
        const mg = ctx.createRadialGradient(fxb, fyb, 2, fxb, fyb, r * 2.2);
        mg.addColorStop(0, 'rgba(255,235,120,.5)'); mg.addColorStop(1, 'rgba(255,235,120,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(fxb, fyb, r * 2.2, 0, 7); ctx.fill();
        ctx.fillStyle = big ? '#ef6c00' : '#2e7d32';
        ctx.beginPath(); ctx.arc(fxb, fyb, r, 0, 7); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,30,15,.6)'; ctx.stroke();
        if (!big) { // sọc dưa hấu
          ctx.strokeStyle = '#a5d6a7'; ctx.lineWidth = 1.6;
          for (let s = -1; s <= 1; s++) { ctx.beginPath(); ctx.arc(fxb, fyb, r - 2, -0.6 + s * 0.4, 0.6 + s * 0.4); ctx.stroke(); }
        } else {
          ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(fxb, fyb - r); ctx.quadraticCurveTo(fxb - 4, fyb, fxb, fyb + r); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(fxb, fyb - r); ctx.quadraticCurveTo(fxb + 4, fyb, fxb, fyb + r); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ell(ctx, fxb - r * 0.35, fyb - r * 0.35, 3, 2);
        // cuống
        ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(fxb, fyb - r); ctx.quadraticCurveTo(cx, fyb - r - 8, cx + sway * 0.5, baseY - 14); ctx.stroke();
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
        if (stage === 4) {
          // chùm nho mọng căng từng quả
          for (let c = 0; c < 2; c++) {
            const bx = cx + (c === 0 ? -7 : 7) + sway * 0.3, by = baseY - H + 8;
            const rows: [number, number][] = [[-2, 0], [2, 0], [-3, 5], [1, 5], [-1, 10]];
            for (const [ox2, oy2] of rows) glowDot(bx + ox2, by + oy2, 3.6, cols[(ox2 + oy2 + 6) % cols.length]);
          }
          glowDot(cx - 7, baseY - H + 6, 1.6, '#fff'); glowDot(cx + 7, baseY - H + 6, 1.6, '#fff');
        } else {
          for (let c = 0; c < 2; c++) {
            const bx = cx + (c === 0 ? -6 : 6) + sway * 0.3, by = baseY - H + 10;
            for (let rr2 = 0; rr2 < 5; rr2++) dot(bx + (rr2 % 2) * 4 - 2, by + Math.floor(rr2 / 2) * 4, 3, cols[rr2 % cols.length]);
          }
        }
      }
      break;
    }
    case 'caphe': {
      stem(20, '#3e2723', 5);
      // tán lá dày 2 lớp óng ả
      ell(ctx, cx, baseY - 22, 15, 11);
      ctx.fillStyle = '#2e7d32'; ell(ctx, cx - 4, baseY - 24, 10, 8);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ell(ctx, cx - 7, baseY - 27, 5, 3);
      leaf(cx - 12, baseY - 16, 9, Math.PI * 1.25, '#43a047', 5);
      leaf(cx + 12, baseY - 16, 9, Math.PI * 1.75, '#43a047', 5);
      if (stage >= 3) { dot(cx - 6, baseY - 22, 2, '#fff'); dot(cx + 4, baseY - 25, 2, '#fff'); }
      if (stage === 4) {
        // chùm cherry đỏ rực
        glowDot(cx - 8, baseY - 20, 3.4, '#d32f2f'); glowDot(cx, baseY - 17, 3.4, '#d32f2f'); glowDot(cx + 8, baseY - 21, 3.4, '#d32f2f');
        glowDot(cx - 4, baseY - 25, 3, '#d32f2f'); glowDot(cx + 4, baseY - 14, 3, '#b71c1c');
      }
      break;
    }
    case 'nam': {
      // khúc gỗ mục + nấm linh chi đỏ bóng
      const wg2 = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
      wg2.addColorStop(0, '#4e342e'); wg2.addColorStop(0.5, '#8d6e63'); wg2.addColorStop(1, '#4e342e');
      ctx.fillStyle = wg2; ctx.fillRect(cx - 15, baseY - 8, 30, 8);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(cx - 15, baseY - 8, 30, 2);
      ctx.fillStyle = '#a1887f'; ell(ctx, cx - 15, baseY - 4, 2.5, 4); ell(ctx, cx + 15, baseY - 4, 2.5, 4);
      const shrooms: [number, number][] = stage === 2 ? [[-6, 0], [5, 0]] : stage === 3 ? [[-9, 0], [0, -2], [8, 0]] : [[-11, 0], [-4, -3], [4, -2], [11, 0]];
      for (const [ox] of shrooms.map((s) => [s[0]])) {
        const mx = cx + (ox as number), my = baseY - 8;
        const tall = stage >= 4 ? 12 : 7, cap = stage >= 4 ? 6.5 : 3.6;
        ctx.fillStyle = '#efebe9'; ctx.fillRect(mx - 2, my - tall, 4, tall);
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(80,50,40,.6)'; ctx.stroke();
        if (stage >= 4) {
          const hg = ctx.createRadialGradient(mx, my - tall, 1, mx, my - tall, cap * 2);
          hg.addColorStop(0, 'rgba(255,120,120,.5)'); hg.addColorStop(1, 'rgba(255,120,120,0)');
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(mx, my - tall, cap * 2, 0, 7); ctx.fill();
        }
        const cg3 = ctx.createRadialGradient(mx - cap * 0.3, my - tall - cap * 0.4, 1, mx, my - tall, cap);
        cg3.addColorStop(0, '#ff8a80'); cg3.addColorStop(0.55, stage >= 4 ? '#d32f2f' : '#bcaaa4'); cg3.addColorStop(1, '#7f0000');
        ctx.fillStyle = cg3;
        ctx.beginPath(); ctx.arc(mx, my - tall, cap, Math.PI, 0); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(80,20,20,.65)'; ctx.stroke();
        // chấm bi trắng + viền vàng linh chi
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(mx - cap * 0.35, my - tall - cap * 0.45, cap * 0.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + cap * 0.3, my - tall - cap * 0.3, cap * 0.15, 0, 7); ctx.fill();
        if (stage >= 4) {
          ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(mx, my - tall, cap, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        }
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
        // chùm sâm đỏ + củ vàng óng đội đất
        glowDot(cx - 5, baseY - 26, 3.2, '#d32f2f'); glowDot(cx + 5, baseY - 26, 3.2, '#d32f2f'); glowDot(cx, baseY - 30, 3.2, '#d32f2f');
        // rễ phụ lấp lánh
        ctx.strokeStyle = '#a9763b'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx - 4, baseY + 1); ctx.quadraticCurveTo(cx - 8, baseY + 5, cx - 10, baseY + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 4, baseY + 1); ctx.quadraticCurveTo(cx + 8, baseY + 5, cx + 10, baseY + 3); ctx.stroke();
        // củ sâm vàng đội đất, nứt đất xung quanh
        ctx.fillStyle = 'rgba(60,35,10,.5)';
        ell(ctx, cx - 8, baseY + 3, 3, 1.4); ell(ctx, cx + 8, baseY + 3, 3, 1.4);
        const sg = ctx.createRadialGradient(cx - 2, baseY - 1, 1, cx, baseY + 1, 8);
        sg.addColorStop(0, '#ffe9a8'); sg.addColorStop(1, '#c8912a');
        ctx.fillStyle = sg; ell(ctx, cx, baseY + 1, 6.5, 3.8);
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,70,0,.65)'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ell(ctx, cx - 2, baseY, 2, 1);
      }
      break;
    }
    default: {
      stem(H, '#2e7d32', 5);
      leaf(cx, baseY - 12, 12, Math.PI * 1.2, '#43a047', 6);
      leaf(cx, baseY - 12, 12, Math.PI * 1.8, '#43a047', 6);
      if (stage >= 3) dot(cx, baseY - H, 3, '#fff');
      if (stage === 4) drawCropGeneric(ctx, cx, baseY - H + 4, 18, t);
    }
  }
  if (grand) ctx.restore();
  // hào quang siêu thực: GĐ3 lấp lánh nhẹ, GĐ4 rực rỡ 2 lớp + hạt bay
  if (stage === 3) {
    auraBloom(cx, baseY, H, 'rgba(255,245,180,A)', 0.35);
    twinkles(cx, baseY, H, 3);
  }
  if (stage === 4) {
    const [ac, acSoft] = auraOf(cropId);
    ripeFinale(cx, baseY, H, ac, acSoft);
    // hào quang dịu lại để CÂY làm chủ — cây to, nét dày, màu đặc hơn quầng sáng
    auraBloom(cx, baseY, H, `rgba(${ac},A)`, 0.34);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + seed);
    // vòng hào quang đôi ôm tán lớn + vòng ngoài bồng bềnh (nhuộm màu cây)
    ctx.strokeStyle = `rgba(${ac},${0.55 + 0.3 * Math.sin(t * 4 + seed)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(cx, baseY - H / 2, 30, H / 2 + 12, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(cx, baseY - H / 2, 23, H / 2 + 6, 0, 0, 7); ctx.stroke();
    // vòng ngoài thứ 3 bồng bềnh
    ctx.strokeStyle = `rgba(${acSoft},${0.3 + pulse * 0.25})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(cx, baseY - H / 2, 37 + pulse * 3, H / 2 + 17 + pulse * 3, 0, 0, 7); ctx.stroke();
    twinkles(cx, baseY, H, 6, `rgb(${acSoft})`);
    twinkles(cx, baseY - 6, H - 8, 3, '#fff');
    // hạt phấn bay lên (màu cây)
    for (let k = 0; k < 3; k++) {
      const ph = seed * 3 + k * 2.1;
      const px = cx + Math.sin(t * 1.4 + ph) * 20;
      const py = baseY - ((t * 14 + ph * 10) % 44);
      ctx.fillStyle = `rgba(${acSoft},${0.75 * (1 - (baseY - py) / 48)})`;
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill();
    }
    if (Math.sin(t * 3 + seed) > 0.4) drawSparkle(ctx, cx - 24, baseY - H - 2, 6, 0.95);
    if (Math.cos(t * 2.6 + seed * 1.7) > 0.4) drawSparkle(ctx, cx + 24, baseY - H + 4, 6, 0.95);
  }
}

// ============================================================
//  NGÔN NGỮ ANIME CHUNG cho nhà gà / trại bò / shop:
//  viền nâu dày bo tròn + tường kem má hồng + mái bóng diềm vỏ sò
//  + cửa vòm + cửa sổ tròn kính bóng + biển treo dây + khói puff
// ============================================================
const ANIME_OUT = '#4a3226';
function animeRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, ow = 3) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = ow; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
}
/** Mái tam giác bo: đỉnh ridge, chân eave, diềm vỏ sò trắng */
function animeRoof(ctx: CanvasRenderingContext2D, cx: number, yRidge: number, yEave: number, halfW: number, over: number, cTop: string, cBot: string) {
  const g = ctx.createLinearGradient(0, yRidge, 0, yEave);
  g.addColorStop(0, cTop); g.addColorStop(1, cBot);
  ctx.beginPath();
  ctx.moveTo(cx - halfW - over, yEave);
  ctx.lineTo(cx - 13, yRidge);
  ctx.lineTo(cx + 13, yRidge);
  ctx.lineTo(cx + halfW + over, yEave);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = ANIME_OUT; ctx.lineJoin = 'round'; ctx.stroke();
  // vệt nắng trên mái trái
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.moveTo(cx - halfW - over + 7, yEave - 2);
  ctx.lineTo(cx - 13 + 8, yRidge + 5);
  ctx.lineTo(cx - 13 + 16, yRidge + 5);
  ctx.lineTo(cx - halfW - over + 18, yEave - 2);
  ctx.closePath(); ctx.fill();
  // diềm vỏ sò
  const n = Math.max(4, Math.floor(((halfW + over) * 2) / 17));
  for (let i = 0; i <= n; i++) {
    const sx = cx - halfW - over + ((halfW + over) * 2) * (i / n);
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath(); ctx.arc(sx, yEave + 3, 6, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // chóp mái
  animeRR(ctx, cx - 15, yRidge - 10, 30, 10, 5, '#fff8e1', 2.5);
}
/** Cửa sổ tròn kính bóng, vẽ nội thất qua callback */
function animeRoundWindow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner: () => void) {
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, cx + 1, cy + 2, r + 1, r * 0.9);
  ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#c4e9ff'); g.addColorStop(1, '#4fa8e0');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, 7); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, 7); ctx.clip();
  inner();
  ctx.restore();
  // tia sáng kính
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r - 6.5, Math.PI * 1.02, Math.PI * 1.42); ctx.stroke();
}
/** Cửa vòm gỗ + núm tròn */
function animeArchDoor(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, wood = '#d99a55', dark = '#9a6530') {
  const r = w / 2, topY = baseY - h;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, cx + 1, baseY + 2, w / 2 + 2, 4);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.lineTo(cx - w / 2, topY + r);
  ctx.arc(cx, topY + r, r, Math.PI, 0);
  ctx.lineTo(cx + w / 2, baseY);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, dark); g.addColorStop(0.5, wood); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // vân gỗ
  ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.2, topY + 8); ctx.lineTo(cx - w * 0.2, baseY - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + w * 0.2, topY + 8); ctx.lineTo(cx + w * 0.2, baseY - 4); ctx.stroke();
  // núm cửa
  ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(cx + w / 2 - 7, baseY - h / 2, 3.6, 0, 7); ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(cx + w / 2 - 8, baseY - h / 2 - 1, 1.2, 0, 7); ctx.fill();
}
/** Biển gỗ treo dây, bảng kem chữ nâu */
function animeHangSign(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, icon: 'chicken' | 'cow' | 'sprout' | null, t: number, ropes = true) {
  ctx.font = `bold 11px 'Be Vietnam Pro', monospace`;
  const tw = Math.min(220, ctx.measureText(text).width + (icon ? 48 : 28));
  const yy = y + Math.sin(t * 1.6 + cx * 0.02) * 1.2;
  if (ropes) {
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 10, yy - 13); ctx.lineTo(cx - tw / 2 + 10, yy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + tw / 2 - 10, yy - 13); ctx.lineTo(cx + tw / 2 - 10, yy); ctx.stroke();
  }
  rr(ctx, cx - tw / 2, yy, tw, 23, 10);
  const g = ctx.createLinearGradient(0, yy, 0, yy + 23);
  g.addColorStop(0, '#a9763b'); g.addColorStop(1, '#7c4f21');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  rr(ctx, cx - tw / 2 + 4, yy + 4, tw - 8, 15, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  if (icon === 'chicken') drawChickenHead(ctx, cx - tw / 2 + 16, yy + 11.5, 12);
  else if (icon === 'cow') drawCowHead(ctx, cx - tw / 2 + 16, yy + 11.5, 13);
  else if (icon === 'sprout') drawSprout(ctx, cx - tw / 2 + 15, yy + 14, 13, t);
  txt(ctx, text, cx + (icon ? 9 : 0), yy + 16, 11, '#fff3d6');
}
/** Biển dựng trên nóc nhà (2 cột + bảng treo) */
function animeBillboard(ctx: CanvasRenderingContext2D, cx: number, yBase: number, text: string, icon: 'chicken' | 'cow' | 'sprout' | null, t: number) {
  ctx.fillStyle = '#7c4f21';
  ctx.fillRect(cx - 36, yBase - 30, 7, 32); ctx.fillRect(cx + 29, yBase - 30, 7, 32);
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT;
  ctx.strokeRect(cx - 36, yBase - 30, 7, 32); ctx.strokeRect(cx + 29, yBase - 30, 7, 32);
  animeHangSign(ctx, cx, yBase - 56, text, icon, t, false);
  // nối bảng xuống cột
  ctx.fillStyle = '#7c4f21';
  ctx.fillRect(cx - 32, yBase - 36, 6, 8); ctx.fillRect(cx + 26, yBase - 36, 6, 8);
}
/** Khói puff anime bay lên */
function animeSmoke(ctx: CanvasRenderingContext2D, x: number, yBase: number, t: number, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.32 + i / 3 + seed) % 1;
    const y = yBase - p * 46, xx = x + Math.sin(t * 1.5 + i * 2 + seed) * 6 * p;
    ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - p)})`;
    ctx.beginPath(); ctx.arc(xx, y, 4 + p * 6, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
    ctx.beginPath(); ctx.arc(xx - 3, y - 2, 2.4, 0, 7); ctx.fill();
  }
}
/** Lấp lánh chữ thập */
function animePlus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col = 'rgba(255,255,255,.9)') {
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
}
/** Trái tim */
function animeHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col = '#ff5b8b') {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.35, y - s * 0.55, x, y - s * 0.15);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.55, x + s * 0.6, y - s * 0.1, x, y + s * 0.35);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ell(ctx, x - s * 0.22, y - s * 0.2, s * 0.12, s * 0.08);
}
/** Gà con trang trí (đậu mái / quanh sân) */
function animeChick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number) {
  const hop = Math.abs(Math.sin(t * 3 + seed)) * -1.6;
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ell(ctx, x, y + s * 0.55, s * 0.5, s * 0.16);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath(); ctx.arc(x, y + hop, s * 0.5, 0, 7); ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  const blink = (t + seed) % 3.2 < 0.15;
  if (blink) {
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - s * 0.28, y + hop); ctx.lineTo(x - s * 0.1, y + hop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + hop); ctx.lineTo(x + s * 0.28, y + hop); ctx.stroke();
  } else {
    ctx.fillStyle = ANIME_OUT;
    ctx.beginPath(); ctx.arc(x - s * 0.18, y + hop, s * 0.08, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.18, y + hop, s * 0.08, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - s * 0.15, y + hop - s * 0.03, s * 0.03, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#ff9a1f';
  ctx.beginPath(); ctx.moveTo(x - s * 0.12, y + hop + s * 0.12); ctx.lineTo(x + s * 0.12, y + hop + s * 0.12); ctx.lineTo(x, y + hop + s * 0.28); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5b5b';
  ctx.beginPath(); ctx.arc(x - s * 0.14, y + hop - s * 0.5, s * 0.14, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * 0.1, y + hop - s * 0.54, s * 0.15, 0, 7); ctx.fill();
}
/** Máng ăn vòm anime */
function animeTrough(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, bodyTop: string, dot: string, dots: number, seed: number) {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x + w / 2, y + 24, w / 2, 6);
  ctx.fillStyle = ANIME_OUT;
  ctx.fillRect(x + 8, y + 14, 9, 10); ctx.fillRect(x + w - 17, y + 14, 9, 10);
  rr(ctx, x, y, w, 19, 9); ctx.fillStyle = '#8b5a2b'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  rr(ctx, x + 4, y + 3, w - 8, 11, 6); ctx.fillStyle = bodyTop; ctx.fill();
  ctx.fillStyle = dot;
  for (let i = 0; i < dots; i++) {
    const h = hash2(i, seed);
    ell(ctx, x + 10 + h * (w - 20), y + 6 + hash2(i, seed + 5) * 6, 2.6, 2);
  }
  animePlus(ctx, x + w - 12, y - 4, 3.4);
}

// ============================================================
//  ANIME POLISH V2 — dùng cho toàn map NGOẠI TRỪ 3 nhà giữ nguyên
//  (coop/barn/shop + helpers anime* cũ KHÔNG đụng tới)
//  Chuẩn chung: viền #4a3226 dày, fill pastel gradient, má hồng,
//  highlight trắng chéo, bóng mềm ellipse.
// ============================================================
/** Khung tròn anime mới (không đụng animeRR cũ) */
function axFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, ow = 3) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = ow; ctx.strokeStyle = ANIME_OUT; ctx.lineJoin = 'round'; ctx.stroke();
}
/** Bóng mềm dưới vật (đồ họa Thấp: tắt để nhẹ máy) */
function axShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.22) {
  if (Q_LOW) return;
  ctx.fillStyle = `rgba(30,40,20,${a})`;
  ell(ctx, x, y, rx, ry);
}
/** Vệt nắng chéo trên mặt phẳng */
function axGlint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.35, y);
  ctx.lineTo(x + w * 0.55, y);
  ctx.lineTo(x + w * 0.2, y + h);
  ctx.closePath(); ctx.fill();
}
/** Bụi cỏ anime 3 lá có viền */
function axGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number, dark = false) {
  const sway = Math.sin(t * 1.8 + seed * 1.7) * 1.8;
  const blades: [number, number][] = [[-5, -9], [0, -12], [5, -8]];
  ctx.lineCap = 'round';
  for (const [ox, hh] of blades) {
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(x + ox * s, y); ctx.lineTo(x + ox * s + sway, y + hh * s); ctx.stroke();
    ctx.strokeStyle = dark ? '#3d7a2e' : '#5da93c'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + ox * s, y); ctx.lineTo(x + ox * s + sway, y + hh * s); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ell(ctx, x + sway * 0.5, y - 10 * s, 1.6, 1);
}
/** Hoa anime 5 cánh có viền + nhụy */
function axFlower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, petal: string, center = '#ffeb3b') {
  ctx.fillStyle = 'rgba(30,60,20,.25)'; ell(ctx, x + 1, y + 3, s * 0.7, s * 0.3);
  ctx.strokeStyle = '#2f6b2f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 9); ctx.stroke();
  ctx.fillStyle = '#3d8a3d';
  ctx.beginPath(); ctx.ellipse(x - 3, y + 6, 3, 1.6, -0.5, 0, 7); ctx.fill();
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * s * 0.55, py = y + Math.sin(a) * s * 0.55;
    ctx.fillStyle = petal;
    ctx.beginPath(); ctx.arc(px, py, s * 0.42, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  ctx.fillStyle = center;
  ctx.beginPath(); ctx.arc(x, y, s * 0.34, 0, 7); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.arc(x - 1, y - 1, s * 0.1, 0, 7); ctx.fill();
}
/** Đá anime bo tròn có viền + highlight */
function axStone(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, base = '#c3ced6') {
  axShadow(ctx, x + 1, y + ry * 0.8, rx * 0.9, ry * 0.4, 0.18);
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.32, ry * 0.28, -0.4, 0, 7); ctx.fill();
}
/** Nấm anime mũ đỏ chấm bi */
function axMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  axShadow(ctx, x, y + 1, s * 0.6, s * 0.2, 0.2);
  ctx.fillStyle = '#fff6e8';
  rr(ctx, x - s * 0.18, y - s * 0.7, s * 0.36, s * 0.75, s * 0.15); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#ff5b5b';
  ctx.beginPath(); ctx.arc(x, y - s * 0.65, s * 0.62, Math.PI, 0); ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - s * 0.28, y - s * 0.95, s * 0.13, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * 0.22, y - s * 1.05, s * 0.1, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ell(ctx, x - s * 0.3, y - s * 1.05, s * 0.16, s * 0.08);
}
/** Mây anime xốp viền nâu nhạt */
function axCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a = 0.95) {
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
/** Bảng tên pill cho pet/người */
function axNamePill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = `bold 9px 'Be Vietnam Pro', monospace`;
  const w = Math.min(150, ctx.measureText(text).width + 18);
  axShadow(ctx, x, y + 9, w / 2, 3, 0.2);
  rr(ctx, x - w / 2, y, w, 15, 7.5); ctx.fillStyle = 'rgba(43,33,23,.88)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff8e1'; ctx.stroke();
  txt(ctx, text, x, y + 11, 9, '#fff8e1');
}
/** Thanh bar anime bo tròn viền nâu */
function axBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, fill: string) {
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  rr(ctx, x - w / 2 - 1, y - 1, w + 2, 8, 4); ctx.fill();
  rr(ctx, x - w / 2, y, w, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
  if (frac > 0.02) {
    rr(ctx, x - w / 2, y, Math.max(8, w * Math.min(1, frac)), 6, 3); ctx.fillStyle = fill; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(x - w / 2 + 2, y + 1, Math.max(4, w * Math.min(1, frac) - 4), 2);
  }
  rr(ctx, x - w / 2 - 1, y - 1, w + 2, 8, 4);
  ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
}
/** Má hồng anime */
function axBlush(ctx: CanvasRenderingContext2D, x: number, y: number, w = 6, h = 3.6, a = 0.5) {
  ctx.fillStyle = `rgba(255,130,140,${a})`;
  ell(ctx, x, y, w, h);
}
/** Mắt kawaii to có highlight */
function axEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, blink: boolean) {
  if (blink) {
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y + 1.5, x + r, y); ctx.stroke();
    return;
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b2117';
  ctx.beginPath(); ctx.arc(x, y + 0.5, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.25, r * 0.42, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.4, r * 0.2, 0, 7); ctx.fill();
}

// ============================================================
//  CHUỒNG GÀ–VỊT + TRẠI BÒ–HEO–CỪU (nhà + sân chi tiết)
//  ⚠️ GIỮ NGUYÊN 100% — KHÔNG SỬA 2 HÀM NHÀ NÀY
// ============================================================
function drawCoopDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = COOP.x - cam.x, Y = COOP.y - cam.y;
  // --- sân anime: cát mật ong + chấm bi + hoa tí hon ---
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X + 4, Y + 6, COOP.w, COOP.h);
  const yg = ctx.createLinearGradient(0, Y, 0, Y + COOP.h);
  yg.addColorStop(0, '#f2d69c'); yg.addColorStop(1, '#ddb273');
  ctx.fillStyle = yg; ctx.fillRect(X, Y, COOP.w, COOP.h);
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  for (let i = 0; i < 14; i++) {
    ell(ctx, X + 14 + hash2(i, 21) * (COOP.w - 28), Y + 66 + hash2(i, 33) * (COOP.h - 76), 5, 3.4);
  }
  for (let i = 0; i < 5; i++) {
    const px = X + 30 + ((i * 97) % (COOP.w - 60));
    const py = Y + 84 + ((i * 53) % (COOP.h - 104));
    ctx.fillStyle = '#6aa84f'; ctx.fillRect(px, py - 6, 2, 6);
    ctx.fillStyle = ['#ff8a80', '#ffffff', '#ffeb3b'][i % 3];
    ctx.beginPath(); ctx.arc(px + 1, py - 8, 2.6, 0, 7); ctx.fill();
  }
  // dấu chân gà
  ctx.fillStyle = 'rgba(120,70,30,.35)';
  for (let i = 0; i < 8; i++) {
    const px = X + 50 + ((i * 67) % (COOP.w - 170));
    const py = Y + 112 + ((i * 41) % 68);
    ell(ctx, px, py, 2.2, 1.5); ell(ctx, px + 12, py + 7, 2.2, 1.5);
  }

  // --- NHÀ GÀ anime ---
  const hx = X + 22, hy = Y + 10, hw = 150;
  const wallTop = hy + 40, wallBot = hy + 96, cx = hx + hw / 2;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ell(ctx, cx, wallBot + 8, hw / 2 + 8, 8);
  // tường kem má hồng
  animeRR(ctx, hx, wallTop, hw, wallBot - wallTop, 10, '#ffe9c4', 3.5);
  ctx.fillStyle = 'rgba(255,140,140,.32)';
  ell(ctx, hx + 24, wallTop + 18, 12, 7); ell(ctx, hx + hw - 24, wallTop + 36, 12, 7);
  // vân gỗ ngang
  ctx.strokeStyle = 'rgba(160,110,60,.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let yy = wallTop + 12; yy < wallBot - 4; yy += 12) {
    ctx.beginPath(); ctx.moveTo(hx + 10, yy); ctx.lineTo(hx + hw - 10, yy); ctx.stroke();
  }
  // mái mật ong + gà con đậu diềm trái
  animeRoof(ctx, cx, hy + 2, wallTop + 4, hw / 2, 14, '#ffd24d', '#ff9a1f');
  animeChick(ctx, hx + 12, wallTop - 2, 15, t, 1);
  // cửa sổ tròn + đầu gà
  animeRoundWindow(ctx, hx + 32, wallTop + 30, 14, () => drawChickenHead(ctx, hx + 32, wallTop + 31, 17));
  // cửa vòm + ổ rơm 2 trứng
  animeArchDoor(ctx, cx + 30, wallBot, 42, 50);
  ctx.fillStyle = '#e8c872'; ell(ctx, cx + 30, wallBot - 3, 14, 5);
  ctx.fillStyle = '#fff';
  ell(ctx, cx + 24, wallBot - 6, 4.4, 3.6); ell(ctx, cx + 36, wallBot - 5, 4.4, 3.6);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ell(ctx, cx + 23, wallBot - 7, 1.3, 1);
  // biển trên nóc
  animeBillboard(ctx, cx, hy + 2, 'NHÀ GÀ', 'chicken', t);
  animePlus(ctx, cx - 52, wallTop + 12, 3.4);
  animePlus(ctx, cx + 58, wallTop + 40, 2.6, 'rgba(255,235,150,.9)');

  // máng ăn vòm + bát nước bóng
  const tx = X + COOP.w - 168, ty = Y + COOP.h - 52;
  animeTrough(ctx, tx, ty, 150, '#ff8a7a', '#ffca28', 14, 21);
  // bát nước
  const wx = tx - 60, wy = ty + 4;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, wx + 22, wy + 14, 24, 5);
  rr(ctx, wx, wy, 44, 15, 7); ctx.fillStyle = '#4fa8e0'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  rr(ctx, wx + 4, wy + 2, 36, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
  animePlus(ctx, wx + 38, wy - 3, 3);
  // cuộn rơm nơ hồng
  const sx2 = X + 250, sy2 = Y + COOP.h - 44;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, sx2, sy2 + 14, 34, 7);
  ctx.fillStyle = '#f2d06b'; ctx.beginPath(); ctx.arc(sx2, sy2, 27, 0, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.strokeStyle = '#c39a3b'; ctx.lineWidth = 1.6;
  for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.arc(sx2, sy2, 19 + a * 3, 0.4, 2.6); ctx.stroke(); }
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath(); ctx.moveTo(sx2, sy2 - 27); ctx.lineTo(sx2 - 9, sy2 - 34); ctx.lineTo(sx2 - 2, sy2 - 25); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(sx2, sy2 - 27); ctx.lineTo(sx2 + 9, sy2 - 34); ctx.lineTo(sx2 + 2, sy2 - 25); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(sx2, sy2 - 27, 3.4, 0, 7); ctx.fill();
  // lông vũ bay
  for (let i = 0; i < 3; i++) {
    const fx = X + 120 + ((t * 12 + i * 90) % (COOP.w - 140));
    const fy = Y + 70 + Math.sin(t * 2 + i * 2) * 8 + i * 22;
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ell(ctx, fx, fy, 4.4, 2.8);
    ctx.strokeStyle = 'rgba(150,180,200,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.lineTo(fx + 4, fy); ctx.stroke();
  }
}

function drawBarnDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = BARN.x - cam.x, Y = BARN.y - cam.y;
  // --- sân anime: đất nâu ấm + vũng bùn bóng ---
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X + 4, Y + 6, BARN.w, BARN.h);
  const yg = ctx.createLinearGradient(0, Y, 0, Y + BARN.h);
  yg.addColorStop(0, '#d9b48c'); yg.addColorStop(1, '#c09a6e');
  ctx.fillStyle = yg; ctx.fillRect(X, Y, BARN.w, BARN.h);
  const puddle = (px: number, py: number, rx: number, ry: number) => {
    ctx.fillStyle = 'rgba(120,75,40,.35)'; ell(ctx, px, py, rx, ry);
    ctx.fillStyle = 'rgba(90,55,28,.4)'; ell(ctx, px, py, rx * 0.66, ry * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(ctx, px - rx * 0.3, py - ry * 0.25, rx * 0.22, ry * 0.18);
  };
  puddle(X + 120, Y + 140, 44, 11); puddle(X + 330, Y + 168, 54, 12);
  // cỏ khô lún phún
  for (let i = 0; i < 16; i++) {
    const h = hash2(i, 77);
    ctx.strokeStyle = '#9aa55a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    const px = X + 12 + h * (BARN.w - 24), py = Y + 76 + hash2(i, 91) * (BARN.h - 86);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 5, py - 7); ctx.stroke();
  }

  // --- TRẠI BÒ anime: tường kem đốm sữa + mái dâu ---
  const hx = X + 16, hy = Y + 8, hw = 170;
  const wallTop = hy + 40, wallBot = hy + 104, cx = hx + hw / 2;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ell(ctx, cx, wallBot + 8, hw / 2 + 8, 8);
  animeRR(ctx, hx, wallTop, hw, wallBot - wallTop, 10, '#fff3df', 3.5);
  // đốm bò sữa trên tường
  ctx.fillStyle = '#4a4a52';
  ctx.beginPath(); ctx.ellipse(hx + 30, wallTop + 16, 10, 7, 0.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + hw - 34, wallTop + 42, 8, 6, -0.3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + 58, wallTop + 48, 6, 4.4, 0.2, 0, 7); ctx.fill();
  // má hồng
  ctx.fillStyle = 'rgba(255,140,140,.3)';
  ell(ctx, hx + 44, wallTop + 26, 11, 6.4); ell(ctx, hx + hw - 44, wallTop + 18, 11, 6.4);
  // mái dâu đỏ
  animeRoof(ctx, cx, hy + 2, wallTop + 4, hw / 2, 14, '#ff7b7b', '#e0393e');
  // ống khói + khói puff
  ctx.fillStyle = '#b08968'; ctx.fillRect(cx + 44, hy - 6, 16, 26);
  ctx.lineWidth = 2.5; ctx.strokeStyle = ANIME_OUT; ctx.strokeRect(cx + 44, hy - 6, 16, 26);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(cx + 41, hy - 10, 22, 7);
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.strokeRect(cx + 41, hy - 10, 22, 7);
  animeSmoke(ctx, cx + 52, hy - 12, t, 0.3);
  // cửa sổ tròn + đầu bò
  animeRoundWindow(ctx, hx + 34, wallTop + 34, 14, () => drawCowHead(ctx, hx + 34, wallTop + 35, 21));
  // cửa đôi vòm + nẹp cong + tim
  animeArchDoor(ctx, cx + 32, wallBot, 56, 58, '#d99a55', '#9a6530');
  ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + 32 - 20, wallBot - 50); ctx.lineTo(cx + 32 + 20, wallBot - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 32 + 20, wallBot - 50); ctx.lineTo(cx + 32 - 20, wallBot - 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,50,20,.4)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx + 32, wallBot - 54); ctx.lineTo(cx + 32, wallBot - 6); ctx.stroke();
  animeHeart(ctx, cx + 32, wallBot - 32, 11);
  // biển trên nóc
  animeBillboard(ctx, cx, hy + 2, 'TRẠI BÒ', 'cow', t);
  animePlus(ctx, cx - 62, wallTop + 14, 3.2);

  // --- silo pastel ---
  const siloX = hx + hw + 20, siloY = hy + 8, sw = 36, sh = 88;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, siloX + sw / 2, siloY + sh + 6, sw / 2 + 4, 6);
  const sg = ctx.createLinearGradient(siloX, 0, siloX + sw, 0);
  sg.addColorStop(0, '#8fc3f0'); sg.addColorStop(0.5, '#cfe9ff'); sg.addColorStop(1, '#7fb0e0');
  rr(ctx, siloX, siloY + 12, sw, sh - 12, 8); ctx.fillStyle = sg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // đai hồng
  ctx.fillStyle = '#ff9db0';
  ctx.fillRect(siloX + 2, siloY + 34, sw - 4, 7); ctx.fillRect(siloX + 2, siloY + 56, sw - 4, 7);
  // vòm nắp
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath(); ctx.arc(siloX + sw / 2, siloY + 12, sw / 2, Math.PI, 0); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#e86a8a'; ctx.beginPath(); ctx.arc(siloX + sw / 2, siloY + 2, 4, 0, 7); ctx.fill();
  // bóng kính dọc
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(siloX + 6, siloY + 18, 5, sh - 28);
  // má hồng silo
  ctx.fillStyle = 'rgba(255,140,150,.5)';
  ell(ctx, siloX + 12, siloY + 70, 4, 2.6); ell(ctx, siloX + 24, siloY + 70, 4, 2.6);

  // máng cỏ vòm + cỏ non
  const mx = X + BARN.w - 212, my = Y + BARN.h - 52;
  animeTrough(ctx, mx, my, 180, '#7cc46a', '#2e7d32', 0, 77);
  ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const px = mx + 10 + i * 14;
    ctx.beginPath(); ctx.moveTo(px, my + 6); ctx.lineTo(px + 3, my - 5 - (i % 3) * 2); ctx.stroke();
    ctx.fillStyle = '#43a047';
    ell(ctx, px + 3, my - 6 - (i % 3) * 2, 2.4, 2);
  }
  // kiện rơm vuông nơ + cuộn tròn
  const bx = X + 252, by = my - 14;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, bx + 20, by + 16, 24, 5);
  animeRR(ctx, bx, by - 12, 40, 26, 6, '#f2d06b', 3);
  ctx.strokeStyle = '#c39a3b'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(bx + 20, by - 12); ctx.lineTo(bx + 20, by + 14); ctx.stroke();
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath(); ctx.arc(bx + 20, by - 12, 4, 0, 7); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#f7dd8f'; ctx.beginPath(); ctx.arc(bx + 62, by + 2, 15, 0, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.strokeStyle = '#c39a3b'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(bx + 62, by + 2, 10, 0, 7); ctx.stroke();
  animeHeart(ctx, bx + 62, by - 2, 8);
}

// ============================================================
//  AO CÁ — bờ cát + đá + sen + cá 3 cỡ
// ============================================================
function drawPondDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, s: RenderState, t: number) {
  const X = POND.x - cam.x, Y = POND.y - cam.y, Wp = POND.w, Hp = POND.h;
  // --- bờ cát anime: viền nâu dày + cát gradient + sỏi viền ---
  axShadow(ctx, X + Wp / 2, Y + Hp + 14, Wp / 2 + 16, 10, 0.22);
  rr(ctx, X - 18, Y - 18, Wp + 36, Hp + 36, 22);
  ctx.fillStyle = '#8d8d8d'; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  const sand = ctx.createLinearGradient(0, Y - 18, 0, Y + Hp + 18);
  sand.addColorStop(0, '#f2ddab'); sand.addColorStop(0.5, '#e8c98d'); sand.addColorStop(1, '#d9b273');
  rr(ctx, X - 14, Y - 14, Wp + 28, Hp + 28, 18); ctx.fillStyle = sand; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.save();
  rr(ctx, X - 14, Y - 14, Wp + 28, Hp + 28, 18); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const h = hash2(i, 5);
    const px = X - 10 + h * (Wp + 20), py = Y - 10 + hash2(i, 9) * (Hp + 20);
    ctx.fillStyle = i % 2 ? '#c9a35e' : '#f4e2ac';
    ctx.beginPath(); ctx.ellipse(px, py, 3.4, 2.2, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(110,75,30,.5)'; ctx.stroke();
  }
  ctx.restore();
  // --- mặt nước anime: gradient ngọc + quầng sâu + nắng chéo ---
  const g = ctx.createLinearGradient(0, Y, 0, Y + Hp);
  g.addColorStop(0, '#8fe3ff'); g.addColorStop(0.35, '#3fbdf2'); g.addColorStop(0.7, '#0e86c8'); g.addColorStop(1, '#01579b');
  rr(ctx, X, Y, Wp, Hp, 14); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
  ctx.fillStyle = 'rgba(1,60,110,.32)';
  ell(ctx, X + Wp / 2, Y + Hp * 0.64, Wp * 0.34, Hp * 0.22);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ell(ctx, X + Wp * 0.3, Y + Hp * 0.2, Wp * 0.26, Hp * 0.1);
  // nắng chéo trên mặt nước
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath();
  ctx.moveTo(X + 30, Y + Hp); ctx.lineTo(X + 150, Y); ctx.lineTo(X + 210, Y); ctx.lineTo(X + 90, Y + Hp);
  ctx.closePath(); ctx.fill();
  // sóng anime: vạch bo + lấp lánh
  for (let i = 0; i < 14; i++) {
    const wx = X + ((i * 97 + t * 34) % (Wp + 60)) - 30;
    const wy = Y + 14 + ((i * 61) % (Hp - 28));
    const len = 20 + (i % 3) * 10;
    ctx.globalAlpha = 0.4 + 0.22 * Math.sin(t * 2.4 + i);
    rr(ctx, wx, wy, len, 4, 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  }
  ctx.globalAlpha = 1;
  // vòng lan tỏa chậm giữa ao
  for (let i = 0; i < 2; i++) {
    const rad = 26 + ((t * 14 + i * 46) % 90);
    ctx.globalAlpha = Math.max(0, 0.4 - rad / 240);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(X + Wp / 2, Y + Hp / 2, rad, rad * 0.42, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // --- sen anime: lá viền nâu + hoa 5 cánh viền + nhụy vàng ---
  const lotus = (lx: number, ly: number, sc: number, tt: number) => {
    const bob = Math.sin(tt) * 1.6;
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ell(ctx, lx, ly + 4, 27 * sc, 6 * sc);
    ctx.fillStyle = '#2e9e4f';
    ctx.beginPath(); ctx.ellipse(lx, ly + bob, 26 * sc, 11 * sc, 0.15, 0.4, 6.6); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    // khía + gân lá
    ctx.fillStyle = '#0277bd';
    ctx.beginPath(); ctx.moveTo(lx + 8 * sc, ly + bob); ctx.lineTo(lx + 24 * sc, ly + bob - 4 * sc); ctx.lineTo(lx + 22 * sc, ly + bob + 4 * sc); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.4;
    for (let v = -1; v <= 1; v++) { ctx.beginPath(); ctx.moveTo(lx, ly + bob); ctx.lineTo(lx + v * 12 * sc, ly + bob - 7 * sc); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ell(ctx, lx - 10 * sc, ly + bob - 4 * sc, 7 * sc, 2.6 * sc);
  };
  const flower = (fx: number, fy: number, sc: number) => {
    const bob = Math.sin(t * 1.8 + fx * 0.02) * 1.5;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      const px = fx + Math.cos(a) * 6.5 * sc, py = fy + bob + Math.sin(a) * 6.5 * sc;
      ctx.fillStyle = '#ff9db0';
      ctx.beginPath(); ctx.arc(px, py, 5.4 * sc, 0, 7); ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    }
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.arc(fx, fy + bob, 3.8 * sc, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(fx - 1, fy + bob - 1, 1.2, 0, 7); ctx.fill();
  };
  lotus(X + Wp * 0.2, Y + Hp * 0.28, 1, t);
  flower(X + Wp * 0.2 + 6, Y + Hp * 0.28 - 12, 1);
  lotus(X + Wp * 0.78, Y + Hp * 0.7, 1.15, t + 2);
  flower(X + Wp * 0.78 - 8, Y + Hp * 0.7 - 13, 0.8);
  lotus(X + Wp * 0.55, Y + Hp * 0.5, 0.7, t + 1);
  // lau sậy anime góc ao: thân viền + bông nâu viền
  const reed = (rx: number, ry: number, h: number) => {
    for (let k = -2; k <= 2; k++) {
      const tipX = rx + k * 6, tipY = ry - h - (k % 2) * 4;
      const midX = rx + k * 5 + Math.sin(t * 2 + k) * 3;
      ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx + k * 5, ry); ctx.quadraticCurveTo(midX, ry - h * 0.6, tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#4a9e4d'; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(rx + k * 5, ry); ctx.quadraticCurveTo(midX, ry - h * 0.6, tipX, tipY); ctx.stroke();
      if (k % 2 === 0) {
        axShadow(ctx, tipX, tipY + 6, 3.4, 1.6, 0.2);
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath(); ctx.ellipse(tipX, tipY - 4, 3.4, 7.5, 0, 0, 7); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ell(ctx, tipX - 1, tipY - 8, 1.2, 3);
      }
    }
  };
  reed(X + 22, Y + 26, 36); reed(X + Wp - 24, Y + Hp - 6, 42);
  // bóng cá + cá bơi vẽ tay (cỡ theo grown/hunger) + bọt
  s.fishes.forEach((ff) => {
    if (!ff) return;
    const p = fishPos(ff, t);
    const sx = p.x - cam.x, sy = p.y - cam.y;
    if (!FISHES[ff.type]) return;
    // bóng dưới nước
    ctx.fillStyle = 'rgba(1,40,80,.3)';
    ell(ctx, sx, sy + 10, 14, 4);
    const big = ff.grown ? 1.15 : ff.age > 20 ? 0.9 : 0.65;
    const flen = (ff.grown ? 34 : 26) * (0.8 + big * 0.35);
    ctx.save(); ctx.translate(sx, sy + Math.sin(t * 3 + ff.uid) * 3);
    if (p.flip) ctx.scale(-1, 1);
    // hào quang khi đói để dễ thấy
    if (!ff.grown && ff.hunger < 30) {
      ctx.fillStyle = 'rgba(255,235,59,.35)';
      ctx.beginPath(); ctx.ellipse(0, 0, flen * 0.75, 12, 0, 0, 7); ctx.fill();
    }
    drawFish(ctx, 0, 0, flen, ff.type, t + ff.uid);
    ctx.restore();
    // bọt thở
    if ((ff.uid + Math.floor(t * 1.4)) % 4 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(sx + 8, sy - 8 - ((t * 10 + ff.uid) % 10), 1.8, 0, 7); ctx.fill();
    }
    if (ff.grown) {
      drawExclaimBadge(ctx, sx + 19, sy - 16 + Math.sin(t * 5) * 3, 17, t);
      // vòng vàng nhấp nháy báo thu hoạch
      ctx.strokeStyle = `rgba(255,235,59,${0.6 + 0.4 * Math.sin(t * 5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, 22, 12, 0, 0, 7); ctx.stroke();
    } else if (ff.hunger < 30) {
      drawFeedBowl(ctx, sx + 19, sy - 14, 17);
    }
  });
  // chuồn chuồn anime: cánh viền + thân viền + mắt to
  for (let i = 0; i < 2; i++) {
    const dx = X + Wp / 2 + Math.cos(t * 0.9 + i * 2.4) * Wp * 0.32;
    const dy = Y + Hp / 2 + Math.sin(t * 1.3 + i * 1.8) * Hp * 0.3 - 6;
    const flap = Math.abs(Math.sin(t * 18 + i));
    ctx.fillStyle = 'rgba(220,245,255,.95)';
    for (const sgn of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(dx + sgn * (5 + flap * 2), dy - 3, 6, 2.4, sgn * 0.2, 0, 7); ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(60,90,130,.8)'; ctx.stroke();
    }
    ctx.fillStyle = i ? '#ff8fb0' : '#29b6f6';
    rr(ctx, dx - 1.6, dy - 7, 3.4, 14, 1.7); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#2b2117';
    ctx.beginPath(); ctx.arc(dx, dy - 8, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(dx - 0.8, dy - 8.8, 0.9, 0, 7); ctx.fill();
  }
  ctx.restore();
  // viền đá anime quanh ao: tròn có viền + highlight so le to nhỏ
  for (let i = 0; i < 22; i++) {
    const per = i / 22;
    const bx = X - 7 + per * (Wp + 14);
    const big = i % 2 === 0;
    axStone(ctx, bx, Y - 12, big ? 10 : 8, big ? 7 : 5.6, big ? '#dbe4ea' : '#b9c6cf');
    axStone(ctx, bx, Y + Hp + 12, big ? 10 : 8, big ? 7 : 5.6, big ? '#b9c6cf' : '#dbe4ea');
  }
  for (let i = 0; i < 12; i++) {
    const per = i / 12;
    const by = Y - 7 + per * (Hp + 14);
    axStone(ctx, X - 12, by, 6.5, 9, i % 2 ? '#c3ced6' : '#dbe4ea');
    axStone(ctx, X + Wp + 12, by, 6.5, 9, i % 2 ? '#dbe4ea' : '#c3ced6');
  }
  if (s.fishes.length >= s.pondSlots && s.pondSlots < MAX_POND) {
    txt(ctx, 'AO ĐẦY — mở ở hòm thư', X + Wp / 2 - 12, Y - 28, 12, '#ffeb3b');
    drawEnvelope(ctx, X + Wp / 2 + 118, Y - 32, 16);
  }
}

// ============================================================
//  SÔNG + BẾN CÂU chi tiết
// ============================================================
function drawRiverDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, t: number) {
  const wy0 = RIVER.y - cam.y, ww = RIVER_WATER_Y - cam.y;
  // --- bãi cát anime + mép ướt bóng ---
  const sandG = ctx.createLinearGradient(0, wy0, 0, ww + 6);
  sandG.addColorStop(0, '#f2ddab'); sandG.addColorStop(1, '#e0bd7e');
  ctx.fillStyle = sandG; ctx.fillRect(0 - cam.x, wy0, WORLD.w, ww - wy0 + 6);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0 - cam.x, wy0, WORLD.w, 5);
  rr(ctx, 0 - cam.x, ww - 5, WORLD.w, 10, 5); ctx.fillStyle = '#b98f52'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  for (let i = 0; i < 60; i++) {
    // đồ họa Thấp/TB: bớt sỏi cát cho nhẹ
    if (Q_LOW ? i % 3 !== 0 : Q_MED && i % 2 !== 0) continue;
    const px = (i * 97) % WORLD.w - cam.x, py = wy0 + 6 + ((i * 53) % Math.max(10, ww - wy0 - 6));
    ctx.fillStyle = i % 2 ? '#cfa85f' : '#f4e2ac';
    ctx.beginPath(); ctx.ellipse(px, py, 2.8, 1.9, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(110,75,30,.4)'; ctx.stroke();
  }
  // lau sậy anime ven bờ + đá anime
  for (let i = 0; i < 14; i++) {
    const rx = (i * 173 + 60) % WORLD.w - cam.x;
    if (rx < -24 || rx > W + 24) continue;
    const ry = wy0 + 8;
    for (let k = -1; k <= 1; k++) {
      const tipX = rx + k * 6, tipY = ry - 26 - (k + 1) * 3;
      ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx + k * 5, ry); ctx.quadraticCurveTo(rx + k * 5 + Math.sin(t * 2 + i + k) * 3, ry - 14, tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#4a9e4d'; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(rx + k * 5, ry); ctx.quadraticCurveTo(rx + k * 5 + Math.sin(t * 2 + i + k) * 3, ry - 14, tipX, tipY); ctx.stroke();
    }
    if (i % 2 === 0) axFlower(ctx, rx + 12, ry - 6, 5.5, i % 4 ? '#ffffff' : '#ff8fb0');
    if (i % 3 === 0) axStone(ctx, rx + 24, ry + 1, 8, 5, '#c3ced6');
    else axGrassTuft(ctx, rx - 12, ry + 2, 0.85, t, i * 3);
  }
  // --- nước sông anime: ngọc sâu + sóng sin + bọt ---
  const g = ctx.createLinearGradient(0, ww, 0, ww + 170);
  g.addColorStop(0, '#8fe3ff'); g.addColorStop(0.35, '#3fbdf2'); g.addColorStop(0.7, '#0e86c8'); g.addColorStop(1, '#013a6b');
  ctx.fillStyle = g; ctx.fillRect(0 - cam.x, ww, WORLD.w, 600);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath();
  ctx.moveTo(0 - cam.x, ww + 40);
  for (let x = 0; x <= WORLD.w; x += 40) ctx.lineTo(x - cam.x, ww + 34 + Math.sin(t * 1.6 + x * 0.02) * 5);
  ctx.lineTo(WORLD.w - cam.x, ww + 60); ctx.lineTo(0 - cam.x, ww + 60);
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 26; i++) {
    // bọt sóng: Thấp vẽ thưa, TB một nửa
    if (Q_LOW ? i % 3 !== 0 : Q_MED && i % 2 !== 0) continue;
    const sx = ((i * 167 + t * 74) % (WORLD.w + 120)) - 60 - cam.x;
    const sy = ww + 14 + ((i * 53) % 110);
    ctx.globalAlpha = 0.35 + 0.28 * Math.sin(t * 3 + i);
    rr(ctx, sx, sy, 28 + (i % 3) * 10, 4.4, 2.2); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
    if (i % 4 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(sx + 30, sy - 4, 1.8, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // bóng cá anime bơi (ellipse + đuôi + vây, có viền sáng)
  for (let i = 0; i < 6; i++) {
    const sx = ((i * 311 + t * (36 + i * 7)) % (WORLD.w + 140)) - 70 - cam.x;
    const sy = ww + 24 + ((i * 47) % 90);
    ctx.fillStyle = 'rgba(1,40,80,.32)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 16, 6, 0, 0, 7); ctx.fill();
    const dir = i % 2 ? 1 : -1;
    ctx.fillStyle = 'rgba(10,60,110,.55)';
    ctx.beginPath(); ctx.ellipse(sx, sy - 1, 11, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + dir * 11, sy - 1); ctx.lineTo(sx + dir * 20, sy - 6); ctx.lineTo(sx + dir * 20, sy + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ell(ctx, sx - dir * 3, sy - 3, 4, 1.4);
  }
  // --- bến gỗ anime: trụ viền + ván gradient + đèn lồng giấy phát sáng ---
  PIERS.forEach((pier, pi) => {
    const X = pier.x - cam.x;
    const topY = 1018 - cam.y, botY = 1152 - cam.y;
    axShadow(ctx, X, botY + 6, 36, 6, 0.25);
    // cọc tròn viền
    for (const ox of [-24, 15]) {
      const g = ctx.createLinearGradient(X + ox, 0, X + ox + 9, 0);
      g.addColorStop(0, '#6d4c41'); g.addColorStop(0.5, '#a9763b'); g.addColorStop(1, '#5d4037');
      rr(ctx, X + ox, topY - 6, 9, botY - topY + 8, 4); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(X + ox + 2, topY - 4, 2.4, botY - topY + 2);
    }
    // ván bo viền từng tấm
    for (let y = topY; y < botY; y += 13) {
      const g = ctx.createLinearGradient(0, y, 0, y + 10);
      g.addColorStop(0, '#d99a55'); g.addColorStop(1, '#9a6530');
      rr(ctx, X - 32, y, 64, 10, 4); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X - 29, y + 1.5, 58, 2);
      ctx.fillStyle = '#3e2723';
      ctx.beginPath(); ctx.arc(X - 26, y + 5, 1.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(X + 26, y + 5, 1.4, 0, 7); ctx.fill();
    }
    // lan can + tay vịn bo
    for (const ox of [-28, 22]) {
      rr(ctx, X + ox, topY - 24, 6, 26, 3); ctx.fillStyle = '#7c4f21'; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    }
    axFrame(ctx, X - 30, topY - 28, 60, 7, 3.5, '#a9763b', 2.2);
    // đèn lồng giấy phát sáng
    const lx = X + 32 + Math.sin(t * 1.8 + pi) * 1.5, ly = topY - 28;
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(lx, topY - 22); ctx.lineTo(lx, ly - 9); ctx.stroke();
    const glow = 0.26 + 0.1 * Math.sin(t * 3 + pi);
    ctx.fillStyle = `rgba(255,190,80,${glow})`;
    ctx.beginPath(); ctx.arc(lx, ly, 19, 0, 7); ctx.fill();
    const lg = ctx.createLinearGradient(lx - 9, 0, lx + 9, 0);
    lg.addColorStop(0, '#ff9a3c'); lg.addColorStop(0.5, '#ffe082'); lg.addColorStop(1, '#ff9a3c');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 9.5, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = ANIME_OUT; ctx.fillRect(lx - 4.5, ly - 12.5, 9, 3.6); ctx.fillRect(lx - 4.5, ly + 8.9, 9, 3.6);
    ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lx - 9, ly - 3); ctx.lineTo(lx + 9, ly - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 9, ly + 3); ctx.lineTo(lx + 9, ly + 3); ctx.stroke();
    // cuộn dây anime + xô anime
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(X - 18, topY + 8, 7.5, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#f2d06b'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(X - 18, topY + 8, 7.5, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(X - 18, topY + 8, 4, 0, 7); ctx.stroke();
    axShadow(ctx, X + 16, topY + 14, 9, 2.6, 0.2);
    axFrame(ctx, X + 9, topY + 2, 14, 11, 3, '#90a4ae', 2.2);
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(X + 11, topY + 4, 10, 4);
    // huy hiệu số bến
    ctx.fillStyle = pi === 1 ? '#ff5b8b' : '#29b6f6';
    ctx.beginPath(); ctx.arc(X, topY - 38, 9, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    txt(ctx, `${pi + 1}`, X, topY - 34.5, 10, '#fff');
    if (Math.sin(t * 3 + pi * 2) > 0.6) drawSparkle(ctx, X - 34, topY - 20, 5, 0.9);
  });
}

// ---------- shop anime: tường kem + mái bạc hà + mái hiên dâu ---
function drawShopDetailed(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const X = SHOPD.x - cam.x, Y = SHOPD.y - cam.y, cx = X + SHOPD.w / 2;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X + 5, Y + 8, SHOPD.w, SHOPD.h);
  // thân kem má hồng
  const bodyTop = Y + 30, bodyBot = Y + SHOPD.h;
  animeRR(ctx, X, bodyTop, SHOPD.w, bodyBot - bodyTop, 10, '#ffedd6', 3.5);
  ctx.fillStyle = 'rgba(255,140,140,.3)';
  ell(ctx, X + 28, bodyTop + 66, 13, 7); ell(ctx, X + SHOPD.w - 28, bodyTop + 30, 13, 7);
  // chân gạch bo
  animeRR(ctx, X + 6, bodyBot - 18, SHOPD.w - 12, 14, 5, '#c9a186', 2.5);
  ctx.fillStyle = 'rgba(90,50,20,.25)';
  for (let i = 0; i < 5; i++) ctx.fillRect(X + 14 + i * 32, bodyBot - 12, 3, 8);
  // mái bạc hà
  animeRoof(ctx, cx, Y - 4, bodyTop + 2, SHOPD.w / 2, 12, '#6fe3c6', '#2aa88f');
  // ống khói + khói puff
  ctx.fillStyle = '#b08968'; ctx.fillRect(X + 26, Y - 12, 15, 24);
  ctx.lineWidth = 2.5; ctx.strokeStyle = ANIME_OUT; ctx.strokeRect(X + 26, Y - 12, 15, 24);
  animeSmoke(ctx, X + 33, Y - 14, t, 0.6);
  // biển SHOP treo dưới mái
  ctx.font = `bold 12px 'Be Vietnam Pro', monospace`;
  const btw = 116;
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - btw / 2 + 12, bodyTop + 2); ctx.lineTo(cx - btw / 2 + 12, bodyTop + 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + btw / 2 - 12, bodyTop + 2); ctx.lineTo(cx + btw / 2 - 12, bodyTop + 10); ctx.stroke();
  animeRR(ctx, cx - btw / 2, bodyTop + 8, btw, 23, 10, '#7c4f21', 3);
  animeRR(ctx, cx - btw / 2 + 5, bodyTop + 12, btw - 10, 15, 7, '#fff3d6', 2);
  drawStar(ctx, cx - btw / 2 + 16, bodyTop + 19.5, 6);
  txt(ctx, 'SHOP', cx + 6, bodyTop + 24, 12, '#fff3d6');
  drawStar(ctx, cx + btw / 2 - 16, bodyTop + 19.5, 6);
  // mái hiên sọc dâu vỏ sò
  const awY = bodyTop + 34, awH = 15, awX0 = X - 8, awX1 = X + SHOPD.w + 8;
  const stripes = 10, sw = (awX1 - awX0) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#fff5f5' : '#ff6b7a';
    ctx.fillRect(awX0 + i * sw, awY, sw + 0.5, awH);
  }
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT;
  ctx.strokeRect(awX0, awY, awX1 - awX0, awH);
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#fff5f5' : '#ff6b7a';
    ctx.beginPath(); ctx.arc(awX0 + i * sw + sw / 2, awY + awH, sw / 2, 0, Math.PI); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // cửa kính trưng bày vòm
  const wx = X + 12, wy = awY + awH + 12, ww = 102, wh = 50;
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ell(ctx, wx + ww / 2, wy + wh + 4, ww / 2, 5);
  animeRR(ctx, wx - 3, wy - 3, ww + 6, wh + 6, 12, '#8b5a2b', 3);
  const gg = ctx.createLinearGradient(0, wy, 0, wy + wh);
  gg.addColorStop(0, '#c4e9ff'); gg.addColorStop(1, '#7cc4ef');
  animeRR(ctx, wx, wy, ww, wh, 9, gg, 2.5);
  // tia sáng kính
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(wx + 12, wy + wh - 8); ctx.lineTo(wx + 30, wy + 8); ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(wx + 22, wy + wh - 8); ctx.lineTo(wx + 34, wy + 8); ctx.stroke();
  // kệ gỗ + 3 món + thẻ giá
  ctx.fillStyle = '#8b5a2b';
  rr(ctx, wx + 4, wy + wh - 10, ww - 8, 6, 3); ctx.fill();
  drawSprout(ctx, wx + 22, wy + wh - 12, 20, t);
  drawFish(ctx, wx + 52, wy + wh - 22, 24, 'caro', t);
  drawChickenHead(ctx, wx + 82, wy + wh - 24, 21);
  ctx.fillStyle = '#ffca28';
  for (const tagX of [wx + 22, wx + 52, wx + 82]) {
    rr(ctx, tagX - 7, wy + wh - 8, 14, 7, 2.5); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // cửa vòm kính + chuông
  const dx = X + SHOPD.w - 44, dw = 36, dbY = bodyBot - 4, dh = 62;
  const dr = dw / 2, dTop = dbY - dh;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, dx + dw / 2, dbY + 3, dw / 2 + 2, 4);
  ctx.beginPath();
  ctx.moveTo(dx, dbY); ctx.lineTo(dx, dTop + dr); ctx.arc(dx + dr, dTop + dr, dr, Math.PI, 0);
  ctx.lineTo(dx + dw, dbY); ctx.closePath();
  const dg = ctx.createLinearGradient(0, dTop, 0, dbY);
  dg.addColorStop(0, '#bfe6ff'); dg.addColorStop(1, '#6fb6e8');
  ctx.fillStyle = dg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // khung gỗ cửa
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(dx + 4, dbY); ctx.lineTo(dx + 4, dTop + dr + 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dx + dw - 4, dbY); ctx.lineTo(dx + dw - 4, dTop + dr + 4); ctx.stroke();
  // chuông vàng
  const bellBob = Math.sin(t * 2.2) * 1.5;
  ctx.fillStyle = '#ffca28';
  ctx.beginPath(); ctx.arc(dx + dw / 2, dTop + dr + 8 + bellBob, 5, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + dw / 2 - 1.5, dTop + dr + 6.5 + bellBob, 1.5, 0, 7); ctx.fill();
  // núm cửa tim
  animeHeart(ctx, dx + dw - 9, dbY - 26, 9);
  // đèn lồng giấy treo mái hiên
  const lx = X + SHOPD.w - 6 + Math.sin(t * 1.8) * 1.5, ly = awY + awH + 8;
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(lx, awY + awH - 2); ctx.lineTo(lx, ly - 8); ctx.stroke();
  const glow = 0.22 + 0.08 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,190,80,${glow})`;
  ctx.beginPath(); ctx.arc(lx, ly, 17, 0, 7); ctx.fill();
  const lg = ctx.createLinearGradient(lx - 8, 0, lx + 8, 0);
  lg.addColorStop(0, '#ff9a3c'); lg.addColorStop(0.5, '#ffd24d'); lg.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 8.5, 0, 7); ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = ANIME_OUT; ctx.fillRect(lx - 4, ly - 11, 8, 3.4); ctx.fillRect(lx - 4, ly + 7.6, 8, 3.4);
  // thùng gỗ nơ + bao tải mặt cười + bí ngô
  const cxr = X - 26, cyr = bodyBot - 34;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, cxr + 11, cyr + 24, 14, 4);
  animeRR(ctx, cxr, cyr, 22, 22, 5, '#c98a4b', 2.5);
  ctx.strokeStyle = 'rgba(90,50,20,.5)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cxr, cyr + 11); ctx.lineTo(cxr + 22, cyr + 11); ctx.stroke();
  animeHeart(ctx, cxr + 11, cyr + 11, 8);
  drawPumpkin(ctx, cxr + 11, cyr - 8, 15);
  // bao tải
  const sx = X + SHOPD.w + 14, sy = bodyBot - 12;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, sx, sy + 2, 13, 4);
  ctx.fillStyle = '#e6c98f';
  ctx.beginPath();
  ctx.moveTo(sx - 11, sy); ctx.quadraticCurveTo(sx - 12, sy - 18, sx - 5, sy - 22);
  ctx.lineTo(sx + 5, sy - 22); ctx.quadraticCurveTo(sx + 12, sy - 18, sx + 11, sy);
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.strokeStyle = '#c39a3b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx - 7, sy - 18); ctx.lineTo(sx + 7, sy - 18); ctx.stroke();
  // mặt cười trên bao
  ctx.fillStyle = ANIME_OUT;
  ctx.beginPath(); ctx.arc(sx - 3.4, sy - 10, 1.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 3.4, sy - 10, 1.4, 0, 7); ctx.fill();
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(sx, sy - 10, 4.6, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,150,.55)';
  ell(ctx, sx - 6.4, sy - 6, 2, 1.4); ell(ctx, sx + 6.4, sy - 6, 2, 1.4);
}

// ---------- cây anime: thân viền + tán viền nâu + highlight xốp ----------
function drawTreeDetailed(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number, fruit: 'apple' | 'orange' | 'mango' | null) {
  axShadow(ctx, x, y + 5, 28 * sc, 8 * sc, 0.24);
  // rễ anime
  ctx.fillStyle = '#6d4c41';
  for (const ox of [-11, 11]) {
    ctx.beginPath(); ctx.ellipse(x + ox * sc, y + 1, 9 * sc, 4.5 * sc, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2 * sc; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // thân viền + vân + highlight
  const tx = x - 8 * sc, tw = 16 * sc, th = 50 * sc;
  rr(ctx, tx, y - th, tw, th + 4, 6 * sc); ctx.fillStyle = '#8b5a2b'; ctx.fill();
  ctx.lineWidth = 2.6 * sc; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  rr(ctx, tx + 3 * sc, y - th + 3 * sc, 4 * sc, th - 6 * sc, 2 * sc); ctx.fillStyle = '#5d3a1a'; ctx.fill();
  rr(ctx, tx + tw - 6 * sc, y - th + 4 * sc, 3 * sc, th - 8 * sc, 1.5 * sc); ctx.fillStyle = 'rgba(255,235,200,.55)'; ctx.fill();
  // hốc cây kawaii
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.ellipse(x, y - 14 * sc, 4.5 * sc, 6 * sc, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ell(ctx, x - 1.5 * sc, y - 16 * sc, 1.4 * sc, 2.4 * sc);
  // cành viền
  ctx.lineCap = 'round';
  for (const [ex, ey] of [[-19, -54], [19, -58]]) {
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 7 * sc;
    ctx.beginPath(); ctx.moveTo(x, y - 38 * sc); ctx.lineTo(x + (ex as number) * sc, y + (ey as number) * sc); ctx.stroke();
    ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 4 * sc;
    ctx.beginPath(); ctx.moveTo(x, y - 38 * sc); ctx.lineTo(x + (ex as number) * sc, y + (ey as number) * sc); ctx.stroke();
  }
  const sway = Math.sin(t * 1.2 + x * 0.01) * 2.6;
  // tán: vẽ viền trước rồi fill pastel từng lớp
  const blob = (bx: number, by: number, r: number, c: string, hi = false) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.lineWidth = 2.6 * sc; ctx.strokeStyle = 'rgba(45,70,30,.9)'; ctx.stroke();
    if (hi) {
      ctx.fillStyle = 'rgba(220,255,220,.55)';
      ctx.beginPath(); ctx.ellipse(bx - r * 0.3, by - r * 0.35, r * 0.4, r * 0.24, -0.4, 0, 7); ctx.fill();
    }
  };
  blob(x + sway * 0.5, y - 62 * sc, 31 * sc, '#2e7d32');
  blob(x - 17 * sc + sway, y - 52 * sc, 21 * sc, '#388e3c', true);
  blob(x + 17 * sc + sway, y - 54 * sc, 21 * sc, '#388e3c', true);
  blob(x - 6 * sc + sway, y - 73 * sc, 19 * sc, '#4a9e4d', true);
  blob(x + 9 * sc + sway, y - 71 * sc, 16 * sc, '#5cb85c', true);
  // chùm sáng trên tán
  ctx.fillStyle = 'rgba(255,255,220,.35)';
  ell(ctx, x - 8 * sc + sway, y - 80 * sc, 9 * sc, 4.5 * sc);
  if (fruit) {
    drawTreeFruit(ctx, x - 12 * sc + sway, y - 58 * sc, 6 * sc, fruit);
    drawTreeFruit(ctx, x + 10 * sc + sway, y - 64 * sc, 6 * sc, fruit);
    drawTreeFruit(ctx, x + sway, y - 48 * sc, 6.5 * sc, fruit);
    if (Math.sin(t * 2 + x) > 0.6) drawSparkle(ctx, x + 14 * sc + sway, y - 70 * sc, 5, 0.9);
  }
  // cánh hoa / lá rơi anime
  for (let k = 0; k < 2; k++) {
    const lt = (t * 0.4 + x * 0.01 + k * 0.5) % 1;
    const lx = x + Math.sin(t * 2 + x + k * 2) * 20 * sc;
    const ly = y - 44 * sc - lt * 34;
    ctx.fillStyle = fruit ? 'rgba(255,255,255,.9)' : 'rgba(120,200,120,.9)';
    ctx.beginPath(); ctx.ellipse(lx, ly, 3.2 * sc, 2.2 * sc, 0.6, 0, 7); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,90,50,.6)'; ctx.stroke();
  }
  // hoa cỏ dưới gốc
  axFlower(ctx, x - 22 * sc, y - 2, 5.5, '#ffffff');
  axFlower(ctx, x + 22 * sc, y - 1, 5.5, '#ff8fb0');
}

// ============================================================
//  VẬT NUÔI — 3 GIAI ĐOẠN: non / tơ / trưởng thành
//  age01 = (now-bornAt)/grow ; <0.35 non, <1 tơ, >=1 trưởng thành
// ============================================================
function drawAnimalDetailed(ctx: CanvasRenderingContext2D, X: number, Y: number, type: string, age01: number, ready: boolean, hunger: number, t: number, uid: number, flip: boolean) {
  const walk = Math.sin(t * 9 + uid * 1.3) * (ready ? 1 : 2.2);
  const sc = age01 < 0.35 ? 0.62 : age01 < 1 ? 0.85 : 1.05;
  axShadow(ctx, X, Y + 15 * sc, 20 * sc, 7 * sc, 0.26);
  // bụi bước chạy anime khi di chuyển
  if (Math.abs(walk) > 1.4) {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ell(ctx, X + (flip ? 10 : -10) * sc, Y + 13 * sc, 4 * sc, 2.4 * sc);
  }
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
  // má hồng anime phủ lên mặt (vị trí tương đối theo loài)
  {
    const dir = flip ? -1 : 1;
    ctx.save();
    ctx.translate(X, Y); ctx.scale(sc, sc);
    if (type === 'chicken' || type === 'duck') {
      axBlush(ctx, (9 + 5) * dir, -7, 3.6, 2.2, 0.55);
    } else if (type === 'cow' || type === 'pig') {
      axBlush(ctx, 15 * dir, -6, 4, 2.6, 0.5);
      axBlush(ctx, 26 * dir, -6, 3, 2, 0.4);
    } else {
      axBlush(ctx, 18 * dir, -3, 3.4, 2.2, 0.5);
    }
    ctx.restore();
  }
  ctx.restore();
  // thanh no anime + trạng thái
  const bw = 42 * sc;
  axBar(ctx, X, Y - 38 * sc, bw, Math.max(0, hunger) / 100, hunger > 50 ? '#7CFC6a' : hunger > 25 ? '#ffeb3b' : '#ff5b5b');
  if (age01 < 0.35) {
    // bình sữa non anime: viền nâu + núm + nhãn
    const bx = X, by = Y - 46 * sc;
    axShadow(ctx, bx, by + 9, 8, 2.6, 0.2);
    axFrame(ctx, bx - 7, by - 7, 14, 14, 4, '#ffffff', 2.2);
    axFrame(ctx, bx - 7, by - 2, 14, 5, 2, '#7cc4ef', 1.6);
    axFrame(ctx, bx - 3, by - 12, 6, 5, 2, '#b0bec5', 1.8);
    ctx.fillStyle = '#ff8fb0';
    ctx.beginPath(); ctx.arc(bx, by - 12, 2, 0, 7); ctx.fill();
    txt(ctx, 'non', X, Y - 56 * sc, 9, '#fff9c4');
    if (Math.sin(t * 4 + uid) > 0.5) drawSparkle(ctx, bx + 10, by - 8, 4.5, 0.9);
  } else if (age01 < 1) {
    const pct = Math.round(Math.min(1, age01) * 100);
    axNamePill(ctx, X, Y - 50 * sc, `đang lớn ${pct}%`);
  } else if (ready) {
    drawExclaimBadge(ctx, X + 24, Y - 26 + Math.sin(t * 5 + uid) * 3, 19, t + uid);
    // vòng sáng anime 2 lớp báo thu
    ctx.strokeStyle = `rgba(255,235,59,${0.65 + 0.35 * Math.sin(t * 5)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(X, Y, 26 * sc, 21 * sc, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(X, Y, 29 * sc, 23.5 * sc, 0, 0, 7); ctx.stroke();
    drawSparkle(ctx, X - 22 * sc, Y - 20 + Math.sin(t * 4) * 3, 6, 0.95);
  } else if (hunger < 40) {
    drawFeedBowl(ctx, X + 24, Y - 26, 18);
    if (Math.sin(t * 5 + uid) > 0.4) txt(ctx, 'đói…', X, Y - 52 * sc, 9, '#ffccbc');
  }
}

// ============================================================
//  THÚ CƯNG LANG THANG — 2 chó tuần tra đường + 3 mèo dạo cỏ
// ============================================================
function drawDogDetailed(ctx: CanvasRenderingContext2D, X: number, Y: number, flip: boolean, moving: boolean, sitting: boolean, t: number, uid: number, coat: string, dark: string) {
  const step = moving ? Math.sin(t * 11 + uid) * 4 : 0;
  const wag = Math.sin(t * (sitting ? 4 : 9) + uid) * (sitting ? 5 : 3);
  axShadow(ctx, X, Y + 14, 19, 6, 0.26);
  if (moving && Math.abs(step) > 2) {
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ell(ctx, X + (flip ? 12 : -12), Y + 11, 4, 2.2);
  }
  ctx.save();
  ctx.translate(X, Y + (sitting ? 2 : Math.abs(Math.sin(t * 11 + uid)) * -1.5));
  ctx.scale(flip ? -1 : 1, 1);
  if (sitting) {
    // ngồi: thân dựng + 2 chân trước thẳng
    ctx.fillStyle = dark;
    ctx.fillRect(-9, 2, 5, 10); ctx.fillRect(4, 2, 5, 10);
    ctx.fillStyle = coat;
    rr(ctx, -13, -14, 24, 20, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(ctx, -4, -6, 6, 8);
    // đầu to + tai rủ + lưỡi thè
    ctx.fillStyle = coat; ctx.beginPath(); ctx.arc(4, -20, 11, 0, 7); ctx.fill();
    ctx.fillStyle = dark; ell(ctx, -4, -24, 4, 7); ell(ctx, 12, -24, 4, 7);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -22, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(7.4, -22, 1.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(1, -15, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff8a80'; ctx.fillRect(-1, -13, 4, 6); // lưỡi
    // đuôi vẫy mạnh khi ngồi
    ctx.strokeStyle = coat; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-13, -2); ctx.quadraticCurveTo(-20, -4, -19 + wag, -12); ctx.stroke();
  } else {
    // đứng/chạy: 4 chân so le + thân dài + đuôi vẫy
    ctx.fillStyle = dark;
    ctx.fillRect(-11, 2 + step * 0.6, 5, 10); ctx.fillRect(-2, 2 - step * 0.6, 5, 10);
    ctx.fillRect(5, 2 + step * 0.6, 5, 10); ctx.fillRect(12, 2 - step * 0.6, 5, 10);
    ctx.fillStyle = coat;
    rr(ctx, -16, -12, 32, 16, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(ctx, -4, -6, 8, 4);
    // đầu + mõm + tai
    ctx.fillStyle = coat; ctx.beginPath(); ctx.arc(19, -10, 9.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f5f0e6'; ell(ctx, 24, -5, 5, 4);
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(25, -6, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(12, -18); ctx.lineTo(15, -26); ctx.lineTo(19, -18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(21, -18); ctx.lineTo(24, -26); ctx.lineTo(27, -17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, -12, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(20.4, -12, 1.1, 0, 7); ctx.fill();
    // đuôi
    ctx.strokeStyle = coat; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-16, -8); ctx.quadraticCurveTo(-22, -12, -21 + wag, -18); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-21 + wag, -18, 2.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawCatDetailed(ctx: CanvasRenderingContext2D, X: number, Y: number, flip: boolean, moving: boolean, sitting: boolean, t: number, uid: number, coat: string, stripe: string) {
  const step = moving ? Math.sin(t * 12 + uid * 2) * 3.5 : 0;
  const tailWag = Math.sin(t * 3.2 + uid) * 5;
  axShadow(ctx, X, Y + 12, 15, 5, 0.24);
  if (moving && Math.abs(step) > 1.8) {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ell(ctx, X + (flip ? 10 : -10), Y + 9, 3.4, 2);
  }
  ctx.save();
  ctx.translate(X, Y + (moving ? Math.abs(Math.sin(t * 12 + uid)) * -1.2 : 0));
  ctx.scale((flip ? -1 : 1) * 0.92, 0.92);
  if (sitting) {
    // ngồi liếm lông: thân tam giác + đuôi cuộn + mắt híp
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 13, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = stripe; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-2, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-2, -2); ctx.stroke();
    // đầu + tai nhọn + vằn
    ctx.fillStyle = coat; ctx.beginPath(); ctx.arc(0, -16, 9.5, 0, 7); ctx.fill();
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(-11, -30); ctx.lineTo(-3, -23); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -20); ctx.lineTo(11, -30); ctx.lineTo(3, -23); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8bbd0';
    ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-9, -27); ctx.lineTo(-5, -23); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(9, -27); ctx.lineTo(5, -23); ctx.closePath(); ctx.fill();
    // mắt híp + ria
    ctx.strokeStyle = '#212121'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-3.5, -16, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(3.5, -16, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12, -13); ctx.lineTo(-18, -14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -11); ctx.lineTo(-18, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -13); ctx.lineTo(18, -14); ctx.stroke();
    // đuôi cuộn quanh thân
    ctx.strokeStyle = coat; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(2, 6, 10, 0.3, 2.4); ctx.stroke();
    ctx.fillStyle = stripe; ctx.beginPath(); ctx.arc(11 + tailWag * 0.3, 1, 2.4, 0, 7); ctx.fill();
  } else {
    // đi/chạy: thân dài + 4 chân + đuôi dựng vẫy
    ctx.fillStyle = coat;
    ctx.fillRect(-10, 0 + step * 0.5, 4, 10); ctx.fillRect(-2, 0 - step * 0.5, 4, 10);
    ctx.fillRect(5, 0 + step * 0.5, 4, 10); ctx.fillRect(10, 0 - step * 0.5, 4, 10);
    ctx.fillStyle = coat; rr(ctx, -13, -10, 26, 13, 6); ctx.fill();
    ctx.fillStyle = stripe;
    ctx.fillRect(-8, -10, 3, 6); ctx.fillRect(0, -10, 3, 6); ctx.fillRect(8, -10, 3, 6);
    // đầu + tai + mắt tròn + mũi hồng
    ctx.fillStyle = coat; ctx.beginPath(); ctx.arc(15, -12, 8.5, 0, 7); ctx.fill();
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.moveTo(8, -16); ctx.lineTo(7, -25); ctx.lineTo(13, -19); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(20, -17); ctx.lineTo(22, -26); ctx.lineTo(25, -18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7bff62'; ctx.beginPath(); ctx.arc(13.5, -13, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(18, -13, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#212121';
    ctx.beginPath(); ctx.arc(13.5, -13, 0.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(18, -13, 0.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#f48fb1';
    ctx.beginPath(); ctx.moveTo(15, -8); ctx.lineTo(17, -8); ctx.lineTo(16, -6.5); ctx.closePath(); ctx.fill();
    // ria mép
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, -9); ctx.lineTo(1, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, -9); ctx.lineTo(29, -10); ctx.stroke();
    // đuôi dựng vẫy
    ctx.strokeStyle = coat; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-13, -6); ctx.quadraticCurveTo(-20, -14, -17 + tailWag, -22); ctx.stroke();
    ctx.fillStyle = stripe; ctx.beginPath(); ctx.arc(-17 + tailWag, -22, 2.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawPets(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, H: number, t: number) {
  const coats: Record<number, [string, string]> = {
    101: ['#e8b34a', '#8b5a2b'], // Vàng
    102: ['#4e4e4e', '#212121'], // Mực đen
    201: ['#ff9e3d', '#b26a1b'], // cam
    202: ['#9e9e9e', '#616161'], // xám
    203: ['#212121', '#000000'], // mun đen
  };
  for (const pet of PETS) {
    // đồ họa Thấp: chỉ vẽ 2 chó giữ nhà (mèo nghỉ), vẫn thấy chó bắt trộm
    if (Q_LOW && pet.kind === 'cat') continue;
    const p = petPos(pet, t);
    const X = p.x - cam.x, Y = p.y - cam.y;
    if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
    const [coat, dark] = coats[pet.uid] ?? ['#e8b34a', '#8b5a2b'];
    if (pet.kind === 'dog') drawDogDetailed(ctx, X, Y, p.flip, p.moving, p.sitting, t, pet.uid, coat, dark);
    else drawCatDetailed(ctx, X, Y, p.flip, p.moving, p.sitting, t, pet.uid, coat, dark);
    // tên pill anime + tai mini viền
    axNamePill(ctx, X, Y - 40, pet.name);
    ctx.lineWidth = 1.6; ctx.strokeStyle = ANIME_OUT;
    if (pet.kind === 'dog') {
      ctx.fillStyle = dark;
      for (const ox of [-13, 13]) {
        ctx.beginPath(); ctx.moveTo(X + ox - 3, Y - 30); ctx.lineTo(X + ox, Y - 36); ctx.lineTo(X + ox + 3, Y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else {
      ctx.fillStyle = coat;
      for (const ox of [-11, 11]) {
        ctx.beginPath(); ctx.moveTo(X + ox - 3, Y - 30); ctx.lineTo(X + ox, Y - 36); ctx.lineTo(X + ox + 3, Y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (p.sitting) {
      if (pet.kind === 'dog') drawSleepZ(ctx, X + 8, Y - 18, 13, t);
      else drawSparkle(ctx, X + 16, Y - 20 + Math.sin(t * 3) * 2, 6, 0.9);
    }
  }
}

// ---------- nông dân chibi anime: đầu to + mắt kawaii + nón lá viền ----------
export function drawPlayerDetailed(ctx: CanvasRenderingContext2D, X: number, Y: number, dir: number, moving: boolean, shirt: string, name: string, t: number, outfit?: Record<string, string>) {
  axShadow(ctx, X, Y + 22, 16, 6, 0.3);
  if (moving && Math.abs(Math.sin(t * 12)) > 0.6) {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ell(ctx, X - dir * 10, Y + 19, 4.4, 2.4);
    ell(ctx, X - dir * 16, Y + 18, 2.6, 1.6);
  }
  const bob = moving ? Math.abs(Math.sin(t * 12)) * -2.6 : Math.sin(t * 2) * 1;
  const step = moving ? Math.sin(t * 12) * 5 : 0;
  // --- trang phục đang mặc ---
  const fit = outfit ?? {};
  const shirtC = shirtColorOf(fit, shirt);
  const pantsC = (fit.pants && OUTFITS[fit.pants]?.color) || '#2f7fc4';
  const shoesC = (fit.shoes && OUTFITS[fit.shoes]?.color) || '#5d4037';
  const hairC = (fit.hair && OUTFITS[fit.hair]?.color) || '#1f2937';
  const hatId = fit.hat ?? 'hat_la';
  const accId = fit.acc ?? 'acc_none';
  ctx.save(); ctx.translate(X, Y + bob);
  if (dir < 0) ctx.scale(-1, 1);
  // ủng/giày anime bo viền (màu theo giày đang mang)
  for (const [ox, sw] of [[-9, step * 0.6], [2, -step * 0.6]] as [number, number][]) {
    axShadow(ctx, (ox as number) + 4, 21 + (sw as number) * 0.6, 5, 2, 0.2);
    rr(ctx, ox as number, 10 + (sw as number) * 0.6, 8, 11, 3.5); ctx.fillStyle = shoesC; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    rr(ctx, (ox as number) - 1, 17 + (sw as number) * 0.6, 10, 4.5, 2); ctx.fillStyle = '#3e2723'; ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // quần yếm anime + nút vàng viền (màu theo quần)
  axFrame(ctx, -11, -2, 22, 15, 5, pantsC, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-8, 0, 16, 3);
  for (const ox of [-8, 8]) {
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(ox, 1, 2.6, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // áo + tay da bo viền (màu theo áo đang mặc)
  axFrame(ctx, -13, -11, 26, 13, 6, shirtC, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-10, -9, 20, 3.4);
  for (const [ox, sw] of [[-18, step * 0.7], [12, -step * 0.7]] as [number, number][]) {
    rr(ctx, ox as number, -9 + (sw as number), 6, 13, 3); ctx.fillStyle = '#ffcf9e'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#ffcf9e';
    ctx.beginPath(); ctx.arc((ox as number) + 3, 5 + (sw as number), 3, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // ba lô anime + cuốc viền
  axShadow(ctx, -20, 4, 5, 2, 0.2);
  axFrame(ctx, -24, -10, 8, 14, 3.5, '#b07a3e', 2.2);
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 4.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-19, -8); ctx.lineTo(-25, -27); ctx.stroke();
  ctx.strokeStyle = '#a9763b'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-19, -8); ctx.lineTo(-25, -27); ctx.stroke();
  axFrame(ctx, -30, -32, 10, 7, 2.5, '#cfd8dc', 2);
  // đầu chibi to + viền
  ctx.fillStyle = '#ffcf9e';
  ctx.beginPath(); ctx.arc(0, -20, 11, 0, 7); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // má hồng + mắt kawaii nhìn theo hướng
  axBlush(ctx, -6, -16, 3.4, 2, 0.6);
  axBlush(ctx, 7, -16, 3.4, 2, 0.6);
  const ex = dir > 0 ? 3.4 : -3.4;
  axEye(ctx, ex - 3.5, -20, 2.6, moving && Math.sin(t * 12) > 0.95);
  axEye(ctx, ex + 3.5, -20, 2.6, moving && Math.sin(t * 12) > 0.95);
  // miệng cười
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(ex * 0.4, -14.5, 3.4, 0.3, Math.PI - 0.3); ctx.stroke();
  // --- tóc mái theo màu tóc đang nhuộm ---
  ctx.fillStyle = hairC;
  ctx.beginPath(); ctx.ellipse(0, -28.5, 9.5, 4.2, 0, Math.PI, 0); ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // --- mũ / nón theo trang phục ---
  if (hatId === 'hat_none') {
    // không đội: tóc bồng bềnh
    ctx.fillStyle = hairC;
    ctx.beginPath(); ctx.arc(0, -26, 10.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  } else if (hatId === 'hat_luoi') {
    axShadow(ctx, 0, -27, 13, 3, 0.2);
    ctx.fillStyle = (OUTFITS[hatId]?.color) || '#ef4444';
    ctx.beginPath(); ctx.ellipse(0, -29, 11, 6, 0, Math.PI, 0); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = (OUTFITS[hatId]?.color) || '#ef4444';
    ctx.beginPath(); ctx.ellipse(7, -28.5, 8, 2.6, 0.15, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  } else if (hatId === 'hat_cao') {
    axShadow(ctx, 0, -27, 15, 3, 0.2);
    ctx.fillStyle = (OUTFITS[hatId]?.color) || '#92400e';
    ctx.beginPath(); ctx.ellipse(0, -28, 16, 4.6, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = (OUTFITS[hatId]?.color) || '#92400e';
    ctx.beginPath(); ctx.ellipse(0, -35, 8, 6, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(-8, -34, 16, 2.6);
  } else if (hatId === 'hat_vuong') {
    // vương miện củ cải vàng chóe
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-9, -28); ctx.lineTo(-9, -38); ctx.lineTo(-4.5, -31);
    ctx.lineTo(0, -40); ctx.lineTo(4.5, -31); ctx.lineTo(9, -38); ctx.lineTo(9, -28);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(0, -33, 2, 0, 7); ctx.fill();
  } else {
    // nón lá anime viền + quai + nơ đỏ (mặc định)
    axShadow(ctx, 0, -27, 15, 3, 0.2);
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.ellipse(0, -29.5, 16.5, 5, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.ellipse(0, -32, 10, 4, 0, Math.PI, 0); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(-11, -24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -32); ctx.lineTo(11, -24); ctx.stroke();
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath(); ctx.arc(0, -35.5, 2.4, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }
  // --- phụ kiện ---
  if (accId === 'acc_kinh') {
    ctx.fillStyle = 'rgba(20,20,30,.92)';
    rr(ctx, -9.5, -23.5, 8, 5.5, 2); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#111'; ctx.stroke();
    rr(ctx, 1.5, -23.5, 8, 5.5, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-1.5, -21); ctx.lineTo(1.5, -21); ctx.stroke();
  } else if (accId === 'acc_hoa') {
    ctx.fillStyle = '#fff';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(10 + Math.cos(a) * 3, -30 + Math.sin(a) * 3, 2.2, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(10, -30, 2, 0, 7); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  } else if (accId === 'acc_sao') {
    drawStar(ctx, -14, -30, 5);
  }
  ctx.restore();
  axNamePill(ctx, X, Y - 52 + bob * 0.3, name);
}

/** Hiệu ứng hành động công viên: hun/ôm/đánh yêu/chọc + trứng pupu (dùng chung farm + town) */
export function drawActionFx(ctx: CanvasRenderingContext2D, X: number, Y: number, emote: string, t: number) {
  if (emote.includes('💋') || emote.includes('🤗') || emote.includes('❤️')) {
    // chùm tim bay
    for (let i = 0; i < 3; i++) {
      const ph = t * 3 + i * 2.1;
      const hx = X - 14 + i * 13 + Math.sin(ph) * 4;
      const hy = Y - 66 - ((ph * 14) % 26);
      const s = 7 - i;
      ctx.font = `${s + 8}px serif`; ctx.textAlign = 'center';
      ctx.fillText(i === 1 ? '💖' : '💕', hx, hy);
    }
  }
  if (emote.includes('🥊') || emote.includes('👊')) {
    // chưởng yêu: tia lửa + chữ BỐP
    const j = Math.sin(t * 14) * 2;
    ctx.font = "bold 13px 'Be Vietnam Pro', sans-serif"; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#7c2d12';
    ctx.strokeText('BỐP!', X + 30, Y - 52 + j);
    ctx.fillStyle = '#fde047'; ctx.fillText('BỐP!', X + 30, Y - 52 + j);
    drawSparkle(ctx, X + 22, Y - 46 + j, 7, 1);
    drawSparkle(ctx, X + 36, Y - 42 - j, 5, 0.9);
  }
  if (emote.includes('🤪')) {
    ctx.font = "bold 12px 'Be Vietnam Pro', sans-serif"; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText('êu êu~', X - 26, Y - 56 + Math.sin(t * 6) * 2);
    ctx.fillStyle = '#a78bfa'; ctx.fillText('êu êu~', X - 26, Y - 56 + Math.sin(t * 6) * 2);
  }
  if (emote.includes('🥚')) {
    // mưa trứng thối bay vòng quanh kẻ ném
    for (let i = 0; i < 4; i++) {
      const a = t * 4 + (i * Math.PI) / 2;
      const ex = X + Math.cos(a) * 34;
      const ey = Y - 30 + Math.sin(a) * 20 - 8;
      // vỏ trứng
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath(); ctx.ellipse(ex, ey, 5, 6.4, Math.cos(a) * 0.4, 0, 7); ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#78350f'; ctx.stroke();
      // lòng đỏ chảy
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(ex, ey + 5, 2.6, 0, 7); ctx.fill();
      // vệt bay
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(X, Y - 34); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.font = "bold 12px 'Be Vietnam Pro', sans-serif"; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText('PUPU! 🥚💨', X, Y - 70 + Math.sin(t * 8) * 2);
    ctx.fillStyle = '#fde047'; ctx.fillText('PUPU! 🥚💨', X, Y - 70 + Math.sin(t * 8) * 2);
  }
}
/** Vết trứng dính trên nạn nhân đứng gần kẻ ném pupu */
export function drawEggSplat(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number, seed: number) {
  const drip = (Math.sin(t * 3 + seed) + 1) / 2;
  ctx.fillStyle = 'rgba(251,191,36,.9)';
  ctx.beginPath(); ctx.ellipse(X + 4, Y - 30, 6, 7.5, 0.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.ellipse(X + 4, Y - 26 + drip * 3, 2.4, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath(); ctx.ellipse(X - 2, Y - 34, 3.4, 2.6, -0.5, 0, 7); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#78350f'; ctx.stroke();
}

// ============================================================
//  RENDER CHÍNH
// ============================================================
// ============================================================
//  THỜI TIẾT — mưa / tuyết phủ toàn màn hình (không gian màn hình)
//  Mưa: vệt xiên + mây xám + lớp phủ lạnh. Tuyết: bông bay lượn + phủ trắng.
// ------------------------------------------------------------
//  QUY ƯỚC LAYER (trời tách biệt nhân vật):
//  - layer 0 (vô cực: mặt trời/mặt trăng/sao/vignette/phủ màu): dính màn hình
//  - layer trời xa (mây): parallax 0.2 theo camera + tự trôi theo gió
//  - layer hạt rơi (mưa/tuyết): parallax 0.3 — trượt nhẹ khi đi, không dính theo
//  - layer mặt đất (gợn mưa, bồ công anh): world-lock 1.0 như mọi vật thể
// ============================================================
/** modulo dương (ôm vòng quanh, không nhảy số khi camera/gió âm) */
function pmod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
function drawWeather(ctx: CanvasRenderingContext2D, W: number, H: number, cam: { x: number; y: number }, w: WeatherKind, t: number) {
  if (w === 'sunny') return;
  if (w === 'rain') {
    // mây mưa xám trôi trên đỉnh màn hình (layer trời xa)
    for (let i = 0; i < 5; i++) {
      const cxm = pmod(i * 340 + t * 22 - cam.x * 0.2, W + 300) - 150;
      axCloud(ctx, cxm, 26 + (i % 3) * 26, 22, 0.95);
      ctx.fillStyle = 'rgba(120,140,170,.35)';
      ell(ctx, cxm, 26 + (i % 3) * 26 + 12, 30, 9);
    }
    ctx.fillStyle = 'rgba(60,90,140,.10)';
    ctx.fillRect(0, 0, W, H);
    // hạt mưa xiên (layer hạt rơi; Thấp: 1/3, TB: 1/2)
    ctx.lineCap = 'round';
    const N = Math.floor(Math.min(140, Math.floor(W / 9)) / (Q_LOW ? 3 : Q_MED ? 2 : 1));
    for (let i = 0; i < N; i++) {
      const speed = 620 + (i % 5) * 90;
      const xx = pmod(i * 97.3 + t * 60 - cam.x * 0.3, W + 60) - 30;
      const yy = pmod(i * 181.7 + t * speed - cam.y * 0.3, H + 60) - 30;
      const len = 13 + (i % 4) * 3;
      ctx.strokeStyle = i % 7 === 0 ? 'rgba(200,230,255,.85)' : 'rgba(150,200,245,.55)';
      ctx.lineWidth = i % 7 === 0 ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx - 4, yy + len);
      ctx.stroke();
    }
    // tia chớp thỉnh thoảng
    const bolt = Math.sin(t * 0.7) + Math.sin(t * 1.9);
    if (bolt > 1.92) {
      ctx.fillStyle = 'rgba(255,255,220,.18)';
      ctx.fillRect(0, 0, W, H);
    }
    // gợn nước dưới đất (vài vòng tròn loang) — world-lock như mặt đất; Thấp: tắt
    ctx.strokeStyle = 'rgba(180,220,255,.4)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < (Q_LOW ? 0 : Q_MED ? 4 : 8); i++) {
      const px = pmod(i * 211 + 80, WORLD.w) - cam.x;
      const py = pmod(i * 347 + 120, WORLD.h) - cam.y;
      if (px < -30 || py < -20 || px > W + 30 || py > H + 20) continue;
      const r = 6 + ((t * 22 + i * 9) % 16);
      ctx.globalAlpha = Math.max(0, 0.5 - r / 44);
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.35, 0, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  // tuyết (Thấp: 1/3 hạt + không vẽ nhánh, TB: 1/2)
  ctx.fillStyle = 'rgba(220,235,255,.08)';
  ctx.fillRect(0, 0, W, H);
  const N = Math.floor(Math.min(120, Math.floor(W / 10)) / (Q_LOW ? 3 : Q_MED ? 2 : 1));
  for (let i = 0; i < N; i++) {
    const fall = 40 + (i % 5) * 14;
    const swayAmp = 18 + (i % 3) * 10;
    const xx = pmod(i * 127.3 - cam.x * 0.3 + Math.sin(t * (0.8 + (i % 4) * 0.25) + i * 1.7) * swayAmp, W + 40) - 20;
    const yy = pmod(i * 251.9 + t * fall - cam.y * 0.3, H + 40) - 20;
    const r = 1.6 + (i % 4) * 0.9;
    ctx.fillStyle = `rgba(255,255,255,${0.65 + (i % 3) * 0.12})`;
    ctx.beginPath(); ctx.arc(xx, yy, r, 0, 7); ctx.fill();
    // nhánh bông tuyết cho hạt to (Thấp: bỏ)
    if (i % 6 === 0 && !Q_LOW) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xx - r * 1.8, yy); ctx.lineTo(xx + r * 1.8, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xx, yy - r * 1.8); ctx.lineTo(xx, yy + r * 1.8); ctx.stroke();
    }
  }
  // đọng tuyết nhẹ 2 mép dưới (viền trắng mờ)
  const sg = ctx.createLinearGradient(0, H - 60, 0, H);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(1, 'rgba(255,255,255,.22)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, H - 60, W, 60);
}

// ============================================================
//  CỔNG CÔNG VIÊN — ngoài cùng bên phải, nơi đường ngang kết thúc
//  Torii gỗ anime + đèn lồng 2 bên + biển treo + vệt sáng dẫn lối
// ============================================================
function drawTownGate(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const c = townGateCenter();
  const X = c.x - cam.x, Y = c.y - cam.y;
  if (X < -160 || X > 3000) return;
  // vệt sáng dẫn từ đường ra cổng (mời gọi)
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  ctx.fillStyle = `rgba(255,235,150,${0.18 + pulse * 0.12})`;
  ctx.beginPath(); ctx.ellipse(X + 60, Y + 6, 70, 22, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const ax = X + 30 + i * 30 + Math.sin(t * 2 + i) * 3;
    const ay = Y - 8 + Math.cos(t * 2.4 + i * 2) * 4;
    if (Math.sin(t * 3 + i * 2) > 0.2) drawSparkle(ctx, ax, ay, 5, 0.9);
  }
  axShadow(ctx, X, Y + 44, 52, 8, 0.26);
  // 2 trụ gỗ đỏ torii
  for (const ox of [-38, 38]) {
    const px = X + ox;
    const g = ctx.createLinearGradient(px - 9, 0, px + 9, 0);
    g.addColorStop(0, '#8f1d1d'); g.addColorStop(0.5, '#e04848'); g.addColorStop(1, '#8f1d1d');
    axFrame(ctx, px - 9, Y - 52, 18, 96, 7, g, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(px - 5, Y - 49, 4, 90);
    // đế đá
    axFrame(ctx, px - 13, Y + 36, 26, 10, 4, '#b0bec5', 2.4);
    // đèn lồng treo
    const sway = Math.sin(t * 2 + ox) * 2.4;
    ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, Y - 44); ctx.lineTo(px + sway * 0.4, Y - 30); ctx.stroke();
    const lx = px + sway * 0.4, ly = Y - 20;
    const lg = ctx.createLinearGradient(0, ly - 12, 0, ly + 12);
    lg.addColorStop(0, '#ffe9a8'); lg.addColorStop(1, '#ffb300');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(lx, ly, 10, 12, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
    ctx.strokeStyle = 'rgba(150,60,0,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lx - 9, ly - 4); ctx.lineTo(lx + 9, ly - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 9, ly + 4); ctx.lineTo(lx + 9, ly + 4); ctx.stroke();
    axFrame(ctx, lx - 4, ly - 17, 8, 5, 2, ANIME_OUT, 1.6);
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath(); ctx.arc(lx, ly + 15, 2.6, 0, 7); ctx.fill();
    // quầng sáng đèn
    const gl = ctx.createRadialGradient(lx, ly, 2, lx, ly, 30);
    gl.addColorStop(0, 'rgba(255,200,80,.5)'); gl.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, ly, 30, 0, 7); ctx.fill();
  }
  // xà ngang đôi torii
  const topG = ctx.createLinearGradient(0, Y - 72, 0, Y - 48);
  topG.addColorStop(0, '#5a1111'); topG.addColorStop(1, '#b32727');
  axFrame(ctx, X - 58, Y - 72, 116, 18, 8, topG, 3.2);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(X - 52, Y - 70, 104, 4);
  axFrame(ctx, X - 46, Y - 50, 92, 10, 5, '#7c1a1a', 2.6);
  // ngói cong 2 đầu
  for (const ex of [-58, 58]) {
    ctx.fillStyle = '#2b2117';
    ctx.beginPath(); ctx.ellipse(X + ex, Y - 70, 8, 12, ex > 0 ? 0.5 : -0.5, 0, 7); ctx.fill();
  }
  // biển treo CÔNG VIÊN
  const bob = Math.sin(t * 1.6) * 1.4;
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(X - 30, Y - 54); ctx.lineTo(X - 30, Y - 38 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X + 30, Y - 54); ctx.lineTo(X + 30, Y - 38 + bob); ctx.stroke();
  axFrame(ctx, X - 44, Y - 38 + bob, 88, 26, 9, '#ffd24d', 2.8);
  rr(ctx, X - 40, Y - 35 + bob, 80, 20, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  txt(ctx, 'CÔNG VIÊN', X, Y - 20 + bob, 12, '#fff3d6');
  // mũi tên nhấp nháy mời vào
  const ay = Y + 22 + Math.sin(t * 4) * 3;
  ctx.fillStyle = '#ff5b5b';
  ctx.beginPath();
  ctx.moveTo(X - 52, ay - 8); ctx.lineTo(X - 38, ay); ctx.lineTo(X - 52, ay + 8);
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  // hoa + cỏ 2 bên chân cổng
  axFlower(ctx, X - 52, Y + 40, 6, '#ff8fb0');
  axFlower(ctx, X + 52, Y + 40, 6, '#ffffff');
  axGrassTuft(ctx, X - 46, Y + 44, 1, t, 3);
  axGrassTuft(ctx, X + 46, Y + 44, 1, t, 9);
}

/** Sâu bò trên cây bị bệnh: 3 con tằm xanh ngọ nguậy + dấu "!" đỏ */
function drawPests(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number, seed: number) {
  // biển cảnh báo đỏ treo trên cây
  const bob = Math.sin(t * 4 + seed) * 2;
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(X + 30, Y - 44 + bob, 8, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#4a3226'; ctx.stroke();
  txt(ctx, '!', X + 30, Y - 38 + bob, 11, '#fff');
  for (let k = 0; k < 3; k++) {
    const wig = Math.sin(t * 6 + seed * 2 + k * 2.1);
    const px = X + [-22, 2, 24][k] + wig * 2.5;
    const py = Y - 12 - (k % 2) * 12 + Math.cos(t * 5 + k) * 1.5;
    // thân tằm: 3 đốt xanh + viền nâu
    ctx.fillStyle = '#7cb342';
    ctx.beginPath(); ctx.ellipse(px, py, 7, 4.5, wig * 0.2, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#4a3226'; ctx.stroke();
    ctx.strokeStyle = 'rgba(46,90,20,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px - 2, py - 4); ctx.lineTo(px - 2, py + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 2, py - 4); ctx.lineTo(px + 2, py + 4); ctx.stroke();
    // đầu + râu
    ctx.fillStyle = '#33691e';
    ctx.beginPath(); ctx.arc(px + 7, py - 1, 2.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#33691e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px + 8, py - 3); ctx.lineTo(px + 10, py - 6 + wig); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 9, py - 3); ctx.lineTo(px + 12, py - 5 - wig); ctx.stroke();
  }
}

export function renderWorld(ctx: CanvasRenderingContext2D, W: number, H: number, cam: { x: number; y: number }, s: RenderState, t: number) {
  // cấp đồ họa áp dụng ngay: đặt cờ cho cả frame này
  Q_LOW = s.quality === 'low';
  Q_MED = s.quality === 'medium';
  setFxLow(Q_LOW);
  ctx.clearRect(0, 0, W, H);
  drawGrassBase(ctx, cam, W, H, t);
  drawRoad(ctx, cam, t);
  drawTownGate(ctx, cam, t);
  drawFence(ctx, cam);
  drawCoopDetailed(ctx, cam, t);
  drawBarnDetailed(ctx, cam, t);
  drawRiverDetailed(ctx, cam, W, t);
  drawPondDetailed(ctx, cam, s, t);
  drawShopDetailed(ctx, cam, t);
  // cây trang trí (né đường đi để lối luôn thoáng)
  drawTreeDetailed(ctx, 1150 - cam.x, 660 - cam.y, 1.1, t, 'apple');
  drawTreeDetailed(ctx, 150 - cam.x, 120 - cam.y, 1, t + 2, null);
  drawTreeDetailed(ctx, 1500 - cam.x, 660 - cam.y, 1.3, t + 1, 'orange');
  drawTreeDetailed(ctx, 1480 - cam.x, 900 - cam.y, 1, t + 3, null);
  drawTreeDetailed(ctx, 950 - cam.x, 110 - cam.y, 0.85, t + 4, null);
  drawTreeDetailed(ctx, 60 - cam.x, 980 - cam.y, 0.9, t + 5, 'mango');
  // hòm thư
  drawMailbox(ctx, PEN_MB.pond.x - cam.x, PEN_MB.pond.y - cam.y, t, 'AO CÁ');
  drawMailbox(ctx, PEN_MB.coop.x - cam.x, PEN_MB.coop.y - cam.y, t + 1, 'GÀ–VỊT');
  drawMailbox(ctx, PEN_MB.barn.x - cam.x, PEN_MB.barn.y - cam.y, t + 2, 'BÒ–HEO');
  // bảng tên khu (icon vẽ tay)
  drawWoodSign(ctx, FARM.x + FARM.w / 2 - cam.x, FARM.y - 34 - cam.y, 'RUỘNG', t, '#8b5a2b', 'sprout');
  const coopN = s.animals.filter((a) => a.type === 'chicken' || a.type === 'duck').length;
  const coopMax = s.coopCap.chicken + s.coopCap.duck;
  const barnN = s.animals.length - coopN;
  const barnMax = s.coopCap.cow + s.coopCap.pig + s.coopCap.sheep;
  drawWoodSign(ctx, POND.x + POND.w / 2 - cam.x, POND.y - 34 - cam.y, `AO CÁ (${s.fishes.length}/${s.pondSlots})`, t + 1, '#0277bd', 'fish');
  drawWoodSign(ctx, COOP.x + COOP.w / 2 - cam.x, COOP.y - 34 - cam.y, `GÀ–VỊT (${coopN}/${coopMax})`, t + 2, '#8b5a2b', 'chicken');
  drawWoodSign(ctx, BARN.x + BARN.w / 2 - cam.x, BARN.y - 34 - cam.y, `BÒ–HEO–CỪU (${barnN}/${barnMax})`, t + 3, '#b71c1c', 'cow');
  // biển sông anime + cá minh họa viền
  drawWoodSign(ctx, 800 - cam.x, 992 - cam.y, 'SÔNG CÂU CÁ', t, '#0277bd', 'fish');
  drawFish(ctx, 800 - 88 - cam.x, 1014 - cam.y, 24, 'caro', t);
  if (Math.sin(t * 3) > 0.5) drawSparkle(ctx, 800 + 88 - cam.x, 1010 - cam.y, 5, 0.9);

  // --- ruộng ---
  const nowMs = Date.now();
  for (let i = 0; i < s.plots.length; i++) {
    const pp = plotPos(i), pl = s.plots[i];
    const X = pp.x - cam.x, Y = pp.y - cam.y;
    if (X < -80 || Y < -80 || X > W + 80 || Y > H + 80) continue;
    if (pl.locked) {
      axShadow(ctx, X + 2, Y + pp.h / 2 + 4, pp.w / 2, 5, 0.22);
      axFrame(ctx, X - pp.w / 2 - 3, Y - pp.h / 2 - 3, pp.w + 6, pp.h + 6, 9, '#33582a', 2.6);
      const lg = ctx.createLinearGradient(0, Y - pp.h / 2, 0, Y + pp.h / 2);
      lg.addColorStop(0, '#5da93c'); lg.addColorStop(1, '#3d7a2e');
      rr(ctx, X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h, 6); ctx.fillStyle = lg; ctx.fill();
      // cỏ dại anime
      for (let g = 0; g < 6; g++) {
        const gx = X - pp.w / 2 + 8 + ((g * 15 + i * 7) % (pp.w - 16));
        axGrassTuft(ctx, gx, Y + pp.h / 2 - 7, 0.85, t, g * 2 + i);
      }
      if (i % 3 === 0) axFlower(ctx, X - 18, Y - 4, 5.5, '#ffffff');
      if (i % 4 === 0) axMushroom(ctx, X + 18, Y + 8, 9);
      drawLock(ctx, X, Y - 2, 15);
      const req = plotReq(i);
      axFrame(ctx, X - 28, Y + pp.h / 2 - 20, 56, 16, 8, '#5d4037', 2.2);
      txt(ctx, `Lv${req}`, X, Y + pp.h / 2 - 8, 9, '#ffeb3b');
    } else if (pl.state === 'grass') {
      axShadow(ctx, X + 2, Y + pp.h / 2 + 4, pp.w / 2, 5, 0.2);
      axFrame(ctx, X - pp.w / 2 - 3, Y - pp.h / 2 - 3, pp.w + 6, pp.h + 6, 9, '#7c4f21', 2.6);
      const gg = ctx.createLinearGradient(0, Y - pp.h / 2, 0, Y + pp.h / 2);
      gg.addColorStop(0, '#7ccf57'); gg.addColorStop(1, '#5da93c');
      rr(ctx, X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h, 6); ctx.fillStyle = gg; ctx.fill();
      for (let g = 0; g < 5; g++) {
        const gx = X - pp.w / 2 + 10 + g * 15;
        axGrassTuft(ctx, gx, Y + 4, 0.9, t, g + i * 3);
      }
      axFlower(ctx, X - 14, Y - 6, 5.5, '#ffeb3b');
      // cuốc gợi ý: vòng pill + icon
      axFrame(ctx, X + pp.w / 2 - 20, Y - pp.h / 2 + 4, 18, 18, 9, '#fff3d6', 2);
      drawHoeMini(ctx, X + pp.w / 2 - 11, Y - pp.h / 2 + 13, 14);
      if (Math.sin(t * 3 + i) > 0.6) drawSparkle(ctx, X - 14, Y - 12, 4.5, 0.9);
    } else if ((pl.state === 'growing' || pl.state === 'ready') && pl.crop) {
      const c = CROPS[pl.crop];
      if (!c) continue;
      drawPlotSoil(ctx, X, Y, pp.w, pp.h, pl.watered, t, i);
      const stage = pl.state === 'ready' ? 4 : cropStage(pl.progress);
      drawCropPlant(ctx, X, Y + 10, pl.crop, stage, t, i);
      if (pl.pest) drawPests(ctx, X, Y + 10, t, i);
      // thanh tăng trưởng anime + nhãn pill
      const bw = pp.w - 10;
      axBar(ctx, X, Y + pp.h / 2 - 10, bw, pl.state === 'ready' ? 1 : Math.min(1, pl.progress), pl.pest ? '#e53935' : pl.state === 'ready' ? '#ffeb3b' : stage <= 1 ? '#8cff49' : stage === 2 ? '#39d353' : '#00e0b0');
      const label = pl.pest ? `${c.name} BỊ SÂU!` : pl.state === 'ready' ? `${c.name} chín!` : `${c.name} · ${cropStageName(pl.progress)} ${Math.round(pl.progress * 100)}%`;
      axNamePill(ctx, X, Y - pp.h / 2 - 22, label);
      if (pl.state === 'ready') {
        const b = Math.sin(t * 4 + i) * 2.5;
        const pulseR = 0.5 + 0.5 * Math.sin(t * 4 + i);
        const [rac, racSoft] = auraOf(pl.crop ?? '');
        // vũng sáng dưới luống chín (màu cây; Thấp: tắt)
        if (!Q_LOW) {
          const poolR = ctx.createRadialGradient(X, Y + 6, 4, X, Y + 6, pp.w * 0.75);
          poolR.addColorStop(0, `rgba(${rac},${0.35 + pulseR * 0.2})`);
          poolR.addColorStop(1, `rgba(${rac},0)`);
          ctx.fillStyle = poolR;
          ctx.beginPath(); ctx.ellipse(X, Y + 6, pp.w * 0.75, pp.h * 0.6, 0, 0, 7); ctx.fill();
        }
        // hào quang chín 3 lớp (ôm vừa tán cây lớn, màu cây)
        ctx.strokeStyle = `rgba(${rac},${0.55 + 0.3 * Math.sin(t * 4 + i)})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(X, Y, 30, 24, 0, 0, 7); ctx.stroke();
        if (!Q_LOW) {
          ctx.strokeStyle = `rgba(255,255,255,${0.45 + pulseR * 0.35})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(X, Y, 37 + pulseR * 3, 30 + pulseR * 3, 0, 0, 7); ctx.stroke();
        }
        // sao xoay quanh ô (Thấp: tắt, TB: 2)
        for (let k = 0; k < (Q_LOW ? 0 : Q_MED ? 2 : 4); k++) {
          const a = t * 1.8 + i + k * 1.57;
          const sx = X + Math.cos(a) * 38, sy = Y - 4 + Math.sin(a) * 28;
          if (Math.sin(t * 3 + i * 2 + k) > -0.2) drawSparkle(ctx, sx, sy, 5, 0.9);
        }
        drawSparkle(ctx, X - 26, Y - 22 + b, 7, 0.95);
        drawSparkle(ctx, X + 26, Y - 22 - b, 7, 0.95);
        // hạt bay lên từ luống (màu cây; Thấp: tắt, TB: 2)
        for (let k = 0; k < (Q_LOW ? 0 : Q_MED ? 2 : 3); k++) {
          const ph = i * 2.4 + k * 2.1;
          const px = X + Math.sin(t * 1.4 + ph) * 30;
          const py = Y + 10 - ((t * 16 + ph * 9) % 52);
          ctx.fillStyle = `rgba(${racSoft},${0.8 * (1 - (Y + 10 - py) / 56)})`;
          ctx.beginPath(); ctx.arc(px, py, 1.7, 0, 7); ctx.fill();
        }
        // giỏ thu hoạch nảy + quầng vàng (Thấp: bỏ quầng)
        const bx = X + pp.w / 2 - 8, by = Y - pp.h / 2 + 14 + b * 0.4;
        if (!Q_LOW) {
          const bgR = ctx.createRadialGradient(bx, by, 2, bx, by, 20);
          bgR.addColorStop(0, 'rgba(255,230,120,.6)'); bgR.addColorStop(1, 'rgba(255,230,120,0)');
          ctx.fillStyle = bgR; ctx.beginPath(); ctx.arc(bx, by, 20, 0, 7); ctx.fill();
        }
        axFrame(ctx, X + pp.w / 2 - 18, Y - pp.h / 2 + 2, 20, 20, 8, '#fff3d6', 2);
        drawBasket(ctx, bx, by, 19);
      } else if (!pl.watered) {
        const jump = Math.abs(Math.sin(t * 3 + i)) * 3;
        drawDrop(ctx, X + pp.w / 2 - 8, Y - pp.h / 2 + 14 - jump, 15);
      } else {
        // hạt nước rơi khi vừa tưới
        ctx.fillStyle = 'rgba(140,200,255,.8)';
        for (let d = 0; d < 3; d++) {
          const dy = ((t * 30 + d * 12 + i * 7) % 26);
          ell(ctx, X - 14 + d * 14, Y - pp.h / 2 + 4 + dy, 1.8, 2.6);
        }
      }
    } else {
      // đất trống chờ gieo: luống + hạt giống gợi ý (vẽ tay)
      drawPlotSoil(ctx, X, Y, pp.w, pp.h, false, t, i);
      const bobY = Math.sin(t * 2.4 + i) * 2;
      drawSeedDot(ctx, X, Y + 4 + bobY, 13);
      txt(ctx, 'gieo hạt', X, Y - pp.h / 2 - 6, 8, '#ffecb3');
    }
    // --- hiệu ứng động tác vừa thực hiện trên ô này (cuốc/gieo/tưới/phun/thu) ---
    if (s.plotFx) {
      for (const fx of s.plotFx) {
        if (fx.plot !== i) continue;
        const age = nowMs - fx.at;
        if (age < 0 || age > 1300) continue;
        drawPlotFx(ctx, X, Y, pp.w, pp.h, fx.kind, age / 1300, t, fx.crop);
      }
    }
  }

  // bướm anime: cánh viền + thân viền + vệt bay (Thấp: tắt, TB: 2 con)
  for (let i = 0; i < (Q_LOW ? 0 : Q_MED ? 2 : 4); i++) {
    const bx = FARM.x + ((t * (24 + i * 8) + i * 260) % FARM.w) - cam.x;
    const by = FARM.y + 60 + ((i * 127) % (FARM.h - 120)) + Math.sin(t * 3 + i * 2) * 14 - cam.y;
    if (bx < -10 || bx > W + 10) continue;
    const flap = Math.abs(Math.sin(t * 14 + i * 2));
    const col = ['#ff8fb0', '#82b1ff', '#ffeb3b', '#ce93d8'][i % 4];
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ell(ctx, bx - 8, by + 4, 6, 2);
    }
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(bx + sgn * (3 + flap * 2.4), by, 4.6, 3, sgn * 0.35, 0, 7); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.beginPath(); ctx.arc(bx + sgn * (3 + flap * 2.4) - 1, by - 1, 1.1, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#3e2723';
    rr(ctx, bx - 1.4, by - 3.4, 2.8, 7, 1.4); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  }

  // --- vật nuôi ---
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

  // --- thú cưng lang thang (2 chó + 3 mèo, không cần sở hữu) ---
  drawPets(ctx, cam, W, H, t);

  // --- người chơi ---
  if (s.sit) {
    drawSittingFisher(ctx, s.sit.x - cam.x, s.sit.y - cam.y, s.sit.bx - cam.x, s.sit.by - cam.y, s, t);
  } else {
    const X = s.player.x - cam.x, Y = s.player.y - cam.y;
    const shirt = SHIRTS[s.avatar % SHIRTS.length];
    drawPlayerDetailed(ctx, X, Y, s.player.dir, s.player.moving, shirt, s.player.name, t, s.outfit);
    if (s.player.tx != null && s.player.ty != null) {
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 6 + Math.sin(t * 8) * 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 9 + Math.sin(t * 8) * 2, 0, 7); ctx.stroke();
    }
  }

  // --- bị chó cắn khi hái trộm: GÂU! + sao xoay trên đầu ---
  if (s.thiefBite && nowMs < s.thiefBite) {
    const bX = s.sit ? s.sit.x - cam.x : s.player.x - cam.x;
    const bY = (s.sit ? s.sit.y - cam.y : s.player.y - cam.y) - 66;
    const jig = Math.sin(t * 30) * 3;
    ctx.globalAlpha = 0.22 + 0.12 * Math.sin(t * 20);
    ctx.fillStyle = '#ff0000';
    ctx.beginPath(); ctx.arc(bX, bY + 22, 32, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      const a = t * 6 + (k * Math.PI * 2) / 3;
      drawSparkle(ctx, bX + Math.cos(a) * 26, bY + 22 + Math.sin(a) * 8, 5, 1);
    }
    txt(ctx, 'GÂU GÂU!', bX + jig, bY, 16, '#ff5252');
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
      // emote realtime (công viên): emoji nảy trên đầu 4s + FX hành động
      const em = v.self ? s.selfEmote : v.emote;
      const emAt = v.self ? nowMs : (v.emoteAt ?? 0);
      if (em && nowMs - emAt < 4000) {
        const bounce = Math.abs(Math.sin(t * 6)) * -6;
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText(em.slice(0, 4), X + 22, Y - 58 + bounce);
        drawActionFx(ctx, X, Y, em, t);
      }
      // dính trứng thối từ đứa ném pupu gần đó
      if (s.visitors) {
        for (const o of s.visitors) {
          if (o === v) continue;
          const oem = o.self ? s.selfEmote : o.emote;
          const oat = o.self ? nowMs : (o.emoteAt ?? 0);
          if (oem && oem.includes('🥚') && nowMs - oat < 4000) {
            const d = Math.hypot((o.x - v.x), (o.y - v.y));
            if (d < 220) { drawEggSplat(ctx, X, Y, t, v.x); break; }
          }
        }
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
      // đom đóm (Thấp: tắt, TB: một nửa)
      for (let i = 0; i < (Q_LOW ? 0 : Q_MED ? 12 : 24); i++) {
        const fx = (i * 257 + t * (10 + (i % 5) * 4)) % WORLD.w - cam.x;
        const fy = (i * 173 + Math.sin(t * 1.5 + i) * 30) % WORLD.h - cam.y;
        if (fx < 0 || fy < 0 || fx > W || fy > H) continue;
        const tw2 = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.4 + i * 1.7));
        ctx.fillStyle = `rgba(255,255,150,${tw2})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, 7); ctx.fill();
      }
      // sao (Thấp: thưa một nửa)
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < (Q_LOW ? 15 : 30); i++) {
        const sx = (i * 311) % W, sy = (i * 167) % Math.max(80, H * 0.4);
        if (Math.sin(t * 2 + i) > 0.2) ctx.fillRect(sx, sy, 2, 2);
      }
    }
    // mặt trời / mặt trăng + mây anime xốp
    const isDay = dt > 0.2 && dt < 0.78;
    if (isDay) {
      ctx.fillStyle = 'rgba(255,220,100,.25)';
      ctx.beginPath(); ctx.arc(W - 60, 44, 30, 0, 7); ctx.fill();
      drawSun(ctx, W - 60, 44, 15, t);
      if (Math.sin(t * 2) > 0.4) drawSparkle(ctx, W - 92, 30 + Math.sin(t) * 3, 5, 0.9);
    } else drawMoon(ctx, W - 60, 44, 14);
    if (isDay) {
      for (let i = 0; i < 4; i++) {
        // mây ngày: layer trời xa (parallax 0.2 + tự trôi)
        const cxm = pmod(t * 9 + i * 420 - cam.x * 0.2, W + 260) - 130;
        axCloud(ctx, cxm, 54 + i * 24, 15, 0.92);
      }
    }
    // vignette anime: tối 4 góc nhẹ cho sâu + ấm (Thấp: tắt)
    if (!Q_LOW) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, night ? 'rgba(5,5,25,.32)' : 'rgba(90,60,20,.14)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }
  // lớp thời tiết phủ cuối cùng (layer trời riêng, parallax theo camera)
  drawWeather(ctx, W, H, cam, s.weather ?? 'sunny', t);
  // HUD mini-game câu cá vẽ TRỰC TIẾP trong canvas (fallback khi overlay DOM bị che):
  // luôn nằm giữa màn hình theo đơn vị logic nên màn to/nhỏ đều thấy.
  if (s.sit?.bite && s.sit.combo && s.sit.combo.length > 0) {
    drawBiteComboHUD(ctx, W, H, s.sit.combo, s.sit.progress ?? 0, t);
  }
  // cá vừa giật dính giãy trên dây ở chỗ phao cũ
  if (s.catchPop && Date.now() < s.catchPop.until) {
    const cx = s.catchPop.x - cam.x, cy = s.catchPop.y - cam.y;
    if (cx > -80 && cx < W + 80 && cy > -120 && cy < H + 80) {
      drawCatchPop(ctx, cx, cy, s.catchPop.fishId, s.catchPop.label, t);
    }
  }
}

/** HUD dãy mũi tên khi cá cắn — vẽ giữa màn hình trong canvas để màn to vẫn thấy */
function drawBiteComboHUD(ctx: CanvasRenderingContext2D, W: number, H: number, combo: BiteDir[], progress: number, t: number) {
  const arrows: Record<BiteDir, string> = { up: '↑', down: '↓', left: '←', right: '→' };
  const n = combo.length;
  const cell = n > 6 ? 44 : 52;
  const gap = 8;
  const padX = 22;
  const boxW = Math.min(W * 0.9, n * (cell + gap) - gap + padX * 2);
  const boxH = 118;
  const bx = W / 2;
  // đặt ở 1/3 trên màn hình — không bao giờ bị sông/BottomBar che
  const by = H * 0.32;
  ctx.save();
  // nền
  ctx.fillStyle = 'rgba(255,248,220,.96)';
  ctx.strokeStyle = '#2b2117'; ctx.lineWidth = 4;
  ctx.beginPath();
  const rx = bx - boxW / 2, ry = by - boxH / 2;
  if (typeof (ctx as unknown as { roundRect?: Function }).roundRect === 'function') {
    (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(rx, ry, boxW, boxH, 14);
  } else {
    ctx.rect(rx, ry, boxW, boxH);
  }
  ctx.fill(); ctx.stroke();
  // tiêu đề nhấp nháy
  const blink = Math.sin(t * 8) > -0.2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(22, W * 0.028)}px 'Be Vietnam Pro', sans-serif`;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
  const title = '🎣 CÁ CẮN! BẤM THEO THỨ TỰ';
  if (blink) { ctx.strokeText(title, bx, ry + 24); ctx.fillStyle = '#b71c1c'; ctx.fillText(title, bx, ry + 24); }
  // các ô mũi tên
  const totalW = n * (cell + gap) - gap;
  let ax = bx - totalW / 2;
  const ay = ry + 56;
  ctx.font = `bold ${Math.round(cell * 0.62)}px 'Be Vietnam Pro', sans-serif`;
  combo.forEach((d, i) => {
    const cx = ax + cell / 2, cy = ay + cell / 2;
    ctx.fillStyle = i < progress ? '#4ade80' : i === progress ? '#facc15' : '#ffffff';
    ctx.strokeStyle = '#2b2117'; ctx.lineWidth = 3;
    const pulse = i === progress ? 1 + Math.sin(t * 10) * 0.06 : 1;
    const s2 = (cell / 2) * pulse;
    ctx.beginPath();
    ctx.rect(cx - s2, cy - s2, s2 * 2, s2 * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2117';
    ctx.fillText(arrows[d], cx, cy + 1);
    ax += cell + gap;
  });
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/** Nông dân ngồi câu chi tiết: nón, áo, cần trúc, phao, gợn sóng, báo cắn vẽ tay */
function drawSittingFisher(
  ctx: CanvasRenderingContext2D, X: number, Y: number, BX: number, BY: number,
  s: RenderState, t: number,
) {
  const shirt = shirtColorOf(s.outfit, SHIRTS[s.avatar % SHIRTS.length]);
  axShadow(ctx, X, Y + 16, 19, 6, 0.28);
  // chiếu cói anime viền
  ctx.fillStyle = '#f2d06b';
  ctx.beginPath(); ctx.ellipse(X, Y + 12, 21, 7.5, 0, 0, 7); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.strokeStyle = 'rgba(140,95,40,.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(X, Y + 12, 15, 5, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(X, Y + 12, 9, 3, 0, 0, 7); ctx.stroke();
  const bob = Math.sin(t * 2) * 1;
  ctx.save(); ctx.translate(X, Y + bob);
  // chân xếp bằng anime + dép viền
  for (const ox of [-17, 3]) {
    axFrame(ctx, ox, 4, 14, 9, 4, '#2f7fc4', 2.2);
    axFrame(ctx, ox, 10, 14, 4, 2, '#5d4037', 1.8);
  }
  // thân anime + tay
  axFrame(ctx, -12, -13, 24, 21, 8, shirt, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-9, -11, 18, 3.6);
  axFrame(ctx, 9, -11, 14, 7, 3.5, '#ffcf9e', 2);
  // đầu chibi + má hồng + mắt
  ctx.fillStyle = '#ffcf9e';
  ctx.beginPath(); ctx.arc(0, -21, 10.5, 0, 7); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  axBlush(ctx, -5.5, -17, 3.2, 2, 0.6);
  axEye(ctx, 3, -21, 2.4, false);
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(1, -16, 3, 0.3, Math.PI - 0.3); ctx.stroke();
  // nón lá anime
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath(); ctx.ellipse(0, -31.5, 18, 5.4, 0, 0, 7); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.ellipse(0, -34, 10.5, 4, 0, Math.PI, 0); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  // cần trúc anime nhiều đốt hướng ra sông
  const tipX = BX - X, tipY = BY - Y - 30;
  ctx.strokeStyle = ANIME_OUT; ctx.lineWidth = 5.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(18, -8); ctx.quadraticCurveTo((18 + tipX) / 2, (-8 + tipY) / 2 - 8, tipX, tipY); ctx.stroke();
  ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(18, -8); ctx.quadraticCurveTo((18 + tipX) / 2, (-8 + tipY) / 2 - 8, tipX, tipY); ctx.stroke();
  ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = 1.6;
  for (let k = 1; k <= 3; k++) {
    const px = 18 + (tipX - 18) * (k / 4), py = -8 + (tipY + 8) * (k / 4) - 6 * (1 - k / 4);
    ctx.beginPath(); ctx.moveTo(px - 3.4, py - 3.4); ctx.lineTo(px + 3.4, py + 3.4); ctx.stroke();
  }
  // cong cần khi cắn câu
  if (s.sit?.bite) {
    ctx.strokeStyle = '#ff5b5b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tipX - 6, tipY - 4); ctx.quadraticCurveTo(tipX, tipY + 6, tipX + 6, tipY - 2); ctx.stroke();
  }
  ctx.restore();
  // dây + phao anime viền
  const byBob = Math.sin(t * (s.sit?.bite ? 10 : 3)) * (s.sit?.bite ? 3.4 : 2);
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(BX, BY - 30 + bob); ctx.lineTo(BX, BY + byBob); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(BX, BY + byBob, 6, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ANIME_OUT; ctx.stroke();
  ctx.fillStyle = '#ff5b5b';
  ctx.beginPath(); ctx.arc(BX, BY + byBob - 3, 6, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(BX - 2, BY + byBob - 5, 1.6, 0, 7); ctx.fill();
  // gợn sóng anime 3 vòng + lấp lánh
  for (let i = 0; i < 3; i++) {
    const rad = 10 + ((t * (s.sit?.bite ? 30 : 16) + i * 13) % 28);
    ctx.globalAlpha = Math.max(0, 1 - rad / 40);
    ctx.strokeStyle = s.sit?.bite ? '#ffeb3b' : '#fff'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(BX, BY + byBob, rad, rad * 0.36, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // xô cá anime bên cạnh
  axShadow(ctx, X - 32, Y + 15, 10, 3, 0.2);
  axFrame(ctx, X - 40, Y + 2, 16, 12, 3.5, '#90a4ae', 2.2);
  ctx.fillStyle = '#4fc3f7'; ctx.fillRect(X - 38, Y + 4, 12, 4);
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(X - 38, Y + 4, 12, 1.6);
  axNamePill(ctx, X, Y - 48, s.player.name);
  if (s.sit?.bite) {
    const fid = (s.sit.fishId && FISHES[s.sit.fishId] ? s.sit.fishId : 'caro') as FishIconId;
    drawExclaimBadge(ctx, BX, BY - 26 + Math.sin(t * 10) * 3, 24, t);
    // cá đang giãy trên lưỡi câu: vẽ đúng loại sắp dính, to + giãy mạnh
    const struggle = Math.sin(t * 16) * 4;
    ctx.save();
    ctx.translate(BX, BY - 14 + Math.sin(t * 10) * 3);
    ctx.rotate(-0.5 + Math.sin(t * 12) * 0.25);
    // dây câu từ đầu cần xuống miệng cá
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(6, -2); ctx.stroke();
    drawFish(ctx, 10 + struggle * 0.4, 4, 30, fid, t);
    ctx.restore();
    drawSparkle(ctx, BX - 18, BY - 20 + Math.sin(t * 9) * 3, 5, 0.9);
  }
}

/** Cá vừa giật dính giãy trên dây ở chỗ phao (world coords) + bảng tên */
function drawCatchPop(ctx: CanvasRenderingContext2D, X: number, Y: number, fishId: string, label: string, t: number) {
  const fid = (FISHES[fishId] ? fishId : 'caro') as FishIconId;
  const jump = Math.abs(Math.sin(t * 7)) * -10;
  const wig = Math.sin(t * 18) * 0.3;
  ctx.save();
  ctx.translate(X, Y - 30 + jump);
  // dây từ trên trời xuống (vừa giật lên)
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -14); ctx.stroke();
  // lưỡi câu
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, -10, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.rotate(wig);
  drawFish(ctx, 0, 0, 44, fid, t);
  ctx.restore();
  // tia nước + lấp lánh
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + t * 3;
    drawSparkle(ctx, X + Math.cos(a) * 30, Y - 30 + jump + Math.sin(a) * 16, 5, 0.9);
  }
  ctx.font = `bold 15px 'Be Vietnam Pro', sans-serif`;
  ctx.textAlign = 'center';
  const wpx = Math.min(260, ctx.measureText(`DÍNH ${label}!`).width + 26);
  ctx.fillStyle = 'rgba(255,248,220,.96)';
  ctx.strokeStyle = '#2b2117'; ctx.lineWidth = 3;
  ctx.beginPath();
  (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect?.(X - wpx / 2, Y - 96 + jump, wpx, 26, 10);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b71c1c';
  ctx.fillText(`DÍNH ${label}!`, X, Y - 78 + jump);
}
