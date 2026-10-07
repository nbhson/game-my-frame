// ===== Pixel renderer — mọi draw call canvas nằm ở đây, UI React không vẽ trực tiếp =====
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

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 12, color = '#fff') {
  ctx.font = `bold ${size}px 'Be Vietnam Pro', monospace`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Hòm thư gỗ trước ao/chuồng: bấm E xem thông tin + mở khóa */
function drawMailbox(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(X, Y + 18, 12, 5, 0, 0, 7); ctx.fill();
  // cột
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(X - 3, Y - 6, 6, 24);
  // hộp thư xanh
  ctx.fillStyle = '#1565c0'; ctx.fillRect(X - 13, Y - 22, 26, 17);
  ctx.fillStyle = '#0d47a1'; ctx.fillRect(X - 13, Y - 22, 26, 5);
  ctx.fillStyle = '#eceff1'; ctx.fillRect(X - 13, Y - 9, 26, 3);
  // cờ đỏ vẫy
  const wave = Math.sin(t * 3) * 2;
  ctx.fillStyle = '#e53935'; ctx.fillRect(X + 11, Y - 32 + wave * 0.3, 3, 12);
  ctx.fillRect(X + 11, Y - 32 + wave * 0.3, 11, 6);
  // phong bì bay
  ctx.font = '15px serif'; ctx.textAlign = 'center';
  ctx.fillText('✉️', X - 2, Y - 26 + Math.sin(t * 2) * 2);
}

export function renderWorld(ctx: CanvasRenderingContext2D, W: number, H: number, cam: { x: number; y: number }, s: RenderState, t: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#7ec850';
  ctx.fillRect(0, 0, W, H);

  // cỏ caro
  for (let gx = 0; gx < WORLD.w; gx += TILE) {
    for (let gy = 0; gy < WORLD.h; gy += TILE) {
      const odd = (gx + gy) / TILE % 2 === 0;
      ctx.fillStyle = odd ? '#7ec850' : '#76c048';
      ctx.fillRect(gx - cam.x, gy - cam.y, TILE, TILE);
    }
  }
  // đường đất: ngang giữa ruộng và chuồng + dọc bên ao
  ctx.fillStyle = '#d7b56d';
  ctx.fillRect(0 - cam.x, 735 - cam.y, WORLD.w, 48);
  ctx.fillRect(1015 - cam.x, 0 - cam.y, 40, 1060);
  ctx.fillStyle = '#c49a52';
  for (let x = 0; x < WORLD.w; x += 40) ctx.fillRect(x - cam.x, 754 - cam.y, 20, 8);
  // hoa cỏ trang trí (tránh ruộng)
  for (let i = 0; i < 40; i++) {
    const fx = (i * 211) % WORLD.w, fy = (i * 349) % WORLD.h;
    if (fx > 30 && fx < 1030 && fy > 220 && fy < 740) continue;
    if (fy > 1050) continue;
    ctx.fillStyle = '#fff'; ctx.fillRect(fx - cam.x, fy - cam.y, 4, 4);
    ctx.fillStyle = ['#ff5252', '#ffeb3b', '#e1bee7'][i % 3];
    ctx.fillRect(fx + 1 - cam.x, fy - 4 - cam.y, 2, 5);
  }

  // hàng rào quanh ruộng + chuồng
  ctx.fillStyle = '#8b5a2b';
  const f = (x: number, y: number, w: number, h: number) => ctx.fillRect(x - cam.x, y - cam.y, w, h);
  for (let x = FARM.x - 10; x < FARM.x + FARM.w + 10; x += 32) { f(x, FARM.y - 14, 24, 8); f(x, FARM.y + FARM.h + 6, 24, 8); }
  for (let y = FARM.y; y < FARM.y + FARM.h; y += 32) { f(FARM.x - 14, y, 8, 24); f(FARM.x + FARM.w + 6, y, 8, 24); }
  for (let x = COOP.x - 10; x < COOP.x + COOP.w + 10; x += 32) f(x, COOP.y - 14, 24, 8);
  for (let x = BARN.x - 10; x < BARN.x + BARN.w + 10; x += 32) f(x, BARN.y - 14, 24, 8);

  // --- chuồng gà/vịt: nền đất + máng ăn + đống rơm (không nhà, không icon) ---
  {
    const X = COOP.x - cam.x, Y = COOP.y - cam.y;
    ctx.fillStyle = '#a1887f'; ctx.fillRect(X, Y, COOP.w, COOP.h);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 6; i++) ctx.fillRect(X + 8 + i * 72, Y + 8, 56, 14);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(X + 20 + i * 105, Y + 60, 30, 18);
    }
    // máng ăn + rơm
    ctx.fillStyle = '#5d4037'; ctx.fillRect(X + COOP.w - 150, Y + COOP.h - 46, 120, 22);
    ctx.fillStyle = '#ffca28'; ctx.fillRect(X + COOP.w - 144, Y + COOP.h - 50, 108, 8);
    ctx.fillStyle = '#e8c872';
    ctx.beginPath(); ctx.arc(X + 120, Y + COOP.h - 44, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#d4af5a';
    ctx.beginPath(); ctx.arc(X + 120, Y + COOP.h - 52, 18, 0, 7); ctx.fill();
  }
  // --- trại bò/heo/cừu: nền đất + máng dài + đống cỏ (không nhà, không icon) ---
  {
    const X = BARN.x - cam.x, Y = BARN.y - cam.y;
    ctx.fillStyle = '#bcaaa4'; ctx.fillRect(X, Y, BARN.w, BARN.h);
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    for (let i = 0; i < 6; i++) ctx.fillRect(X + 10 + i * 76, Y + 8, 58, 14);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(X + 30 + i * 110, Y + 60, 34, 20);
    }
    // máng dài + đống cỏ
    ctx.fillStyle = '#5d4037'; ctx.fillRect(X + BARN.w - 200, Y + BARN.h - 48, 170, 24);
    ctx.fillStyle = '#7ec850'; ctx.fillRect(X + BARN.w - 194, Y + BARN.h - 52, 158, 8);
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(X + 120, Y + BARN.h - 48, 24, 0, 7); ctx.fill();
  }
  // --- hòm thư trước ao/chuồng ---
  drawMailbox(ctx, PEN_MB.pond.x - cam.x, PEN_MB.pond.y - cam.y, t);
  drawMailbox(ctx, PEN_MB.coop.x - cam.x, PEN_MB.coop.y - cam.y, t + 1);
  drawMailbox(ctx, PEN_MB.barn.x - cam.x, PEN_MB.barn.y - cam.y, t + 2);

  // shop
  {
    const X = SHOPD.x - cam.x, Y = SHOPD.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X + 4, Y + 6, SHOPD.w, SHOPD.h);
    ctx.fillStyle = '#ff7043'; ctx.fillRect(X, Y, SHOPD.w, SHOPD.h);
    ctx.fillStyle = '#d84315'; ctx.fillRect(X, Y, SHOPD.w, 22);
    ctx.fillStyle = '#fff'; ctx.fillRect(X + 20, Y + 40, SHOPD.w - 40, 60);
    ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.fillText('🏪', X + SHOPD.w / 2, Y + 82);
    txt(ctx, 'SHOP', X + SHOPD.w / 2, Y + 122, 14);
  }
  // cây trang trí
  const tree = (x: number, y: number, sc: number, tt: number) => {
    ctx.fillStyle = '#5d4037'; ctx.fillRect(x - 6 * sc, y - 10 * sc, 12 * sc, 44 * sc);
    ctx.fillStyle = '#2e7d32';
    const sway = Math.sin(tt) * 2;
    ctx.beginPath(); ctx.arc(x + sway, y - 30 * sc, 30 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = '#388e3c'; ctx.beginPath(); ctx.arc(x - 12 * sc + sway, y - 40 * sc, 18 * sc, 0, 7); ctx.fill();
  };
  tree(1150 - cam.x, 640 - cam.y, 1.1, t);
  tree(150 - cam.x, 120 - cam.y, 1, t + 2);
  tree(1500 - cam.x, 660 - cam.y, 1.3, t + 1);
  tree(1480 - cam.x, 900 - cam.y, 1, t + 3);

  // labels
  txt(ctx, '🌾 RUỘNG', FARM.x + FARM.w / 2 - cam.x, FARM.y - 12 - cam.y, 13);
  txt(ctx, `🐟 AO CÁ (${s.fishes.length}/${s.pondSlots})`, POND.x + POND.w / 2 - cam.x, POND.y - 12 - cam.y, 13);
  const coopN = s.animals.filter((a) => a.type === 'chicken' || a.type === 'duck').length;
  const coopMax = s.coopCap.chicken + s.coopCap.duck;
  const barnN = s.animals.length - coopN;
  const barnMax = s.coopCap.cow + s.coopCap.pig + s.coopCap.sheep;
  txt(ctx, `🐔 CHUỒNG GÀ–VỊT (${coopN}/${coopMax})`, COOP.x + COOP.w / 2 - cam.x, COOP.y - 12 - cam.y, 12);
  txt(ctx, `🐄 TRẠI BÒ–HEO–CỪU (${barnN}/${barnMax})`, BARN.x + BARN.w / 2 - cam.x, BARN.y - 12 - cam.y, 12);
  txt(ctx, '🎣 SÔNG CÂU CÁ', 800 - cam.x, 1008 - cam.y, 13);

  // --- ruộng 45 ô ---
  for (let i = 0; i < s.plots.length; i++) {
    const pp = plotPos(i), pl = s.plots[i];
    const X = pp.x - cam.x, Y = pp.y - cam.y;
    if (X < -80 || Y < -80 || X > W + 80 || Y > H + 80) continue;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X - pp.w / 2 + 2, Y - pp.h / 2 + 4, pp.w, pp.h);
    if (pl.locked) {
      ctx.fillStyle = '#4c8a34'; ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', X, Y + 2);
      const req = plotReq(i);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace';
      ctx.fillText(`Lv${req}`, X, Y + pp.h / 2 - 4);
    } else if (pl.state === 'grass') {
      ctx.fillStyle = '#5da93c'; ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      ctx.fillStyle = '#6fbf4a';
      for (let g = 0; g < 6; g++) ctx.fillRect(X - pp.w / 2 + 5 + g * 14, Y - pp.h / 2 + 6 + ((g * 23) % (pp.h - 14)), 4, 9);
    } else {
      ctx.fillStyle = pl.watered ? '#5a3a1e' : '#7a5230';
      ctx.fillRect(X - pp.w / 2, Y - pp.h / 2, pp.w, pp.h);
      ctx.fillStyle = pl.watered ? '#4a2f16' : '#6a4526';
      for (let r = 0; r < 3; r++) ctx.fillRect(X - pp.w / 2 + 6, Y - pp.h / 2 + 8 + r * ((pp.h - 14) / 3), pp.w - 12, 5);
      if ((pl.state === 'growing' || pl.state === 'ready') && pl.crop) {
        const c = CROPS[pl.crop];
        if (c) {
          const cx = X, cy = Y + 8;
          if (pl.progress < 0.33) {
            ctx.fillStyle = '#2e7d32'; ctx.fillRect(cx - 3, cy - 10, 6, 10);
            ctx.fillRect(cx - 7, cy - 7, 5, 5); ctx.fillRect(cx + 2, cy - 9, 5, 5);
          } else if (pl.progress < 0.7) {
            ctx.fillStyle = '#2e7d32'; ctx.fillRect(cx - 3, cy - 22, 6, 22);
            ctx.fillStyle = '#388e3c'; ctx.fillRect(cx - 10, cy - 17, 7, 7); ctx.fillRect(cx + 3, cy - 20, 7, 7);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(cx - 5, cy - 26, 10, 5);
          } else {
            ctx.fillStyle = '#1b5e20'; ctx.fillRect(cx - 4, cy - 28, 8, 28);
            ctx.fillStyle = '#2e7d32'; ctx.fillRect(cx - 11, cy - 22, 8, 8); ctx.fillRect(cx + 3, cy - 23, 8, 8);
            ctx.font = '22px serif'; ctx.textAlign = 'center';
            ctx.fillText(c.emoji, cx, cy - 21);
            if (pl.state === 'ready') {
              const b = Math.sin(t * 4 + i) * 2;
              ctx.font = '14px serif'; ctx.fillText('✨', cx - 17, cy - 28 + b); ctx.fillText('✨', cx + 17, cy - 28 - b);
            }
          }
          ctx.fillStyle = '#000'; ctx.fillRect(X - pp.w / 2 + 4, Y + pp.h / 2 - 12, pp.w - 8, 6);
          ctx.fillStyle = pl.state === 'ready' ? '#ffeb3b' : '#76ff03';
          ctx.fillRect(X - pp.w / 2 + 5, Y + pp.h / 2 - 11, (pp.w - 10) * Math.min(1, pl.progress), 4);
          if (!pl.watered && pl.state === 'growing') { ctx.font = '13px serif'; ctx.fillText('💧', X + pp.w / 2 - 4, Y - pp.h / 2 + 12); }
        }
      } else {
        ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillText('🕳️', X, Y + 5);
      }
    }
  }

  // --- ao vuông tự nhiên (không chia ngăn) ---
  {
    const X0 = POND.x - cam.x, Y0 = POND.y - cam.y;
    const X = X0, Y = Y0, Wp = POND.w, Hp = POND.h;
    // bờ cát
    ctx.fillStyle = '#d7b56d'; ctx.fillRect(X - 14, Y - 14, Wp + 28, Hp + 28);
    // mặt nước
    const g = ctx.createLinearGradient(0, Y, 0, Y + Hp);
    g.addColorStop(0, '#4fc3f7'); g.addColorStop(1, '#0277bd');
    ctx.fillStyle = g; ctx.fillRect(X, Y, Wp, Hp);
    // sóng + lá sen + cá (cắt trong ao)
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (let i = 0; i < 10; i++) {
      const wx = X + ((i * 97 + t * 36) % Wp);
      const wy = Y + 12 + ((i * 61) % (Hp - 24));
      ctx.fillRect(wx, wy, 24, 3);
    }
    // lá sen
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.ellipse(X + Wp * 0.2, Y + Hp * 0.25, 26, 12, 0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(X + Wp * 0.78, Y + Hp * 0.7, 30, 13, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#f48fb1';
    ctx.beginPath(); ctx.arc(X + Wp * 0.2, Y + Hp * 0.25 - 10, 6, 0, 7); ctx.fill();
    // cá bơi tự do
    s.fishes.forEach((ff) => {
      if (!ff) return; // snapshot cũ có thể chứa ô trống null
      const p = fishPos(ff, t);
      const sx = p.x - cam.x, sy = p.y - cam.y;
      const F = FISHES[ff.type];
      if (!F) return;
      ctx.font = (ff.grown ? '30px' : '22px') + ' serif'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(sx, sy + Math.sin(t * 3 + ff.uid) * 3);
      if (p.flip) ctx.scale(-1, 1);
      ctx.fillText(F.emoji, 0, 6); ctx.restore();
      if (ff.grown) {
        ctx.font = '15px serif';
        ctx.fillText('❗', sx + 16, sy - 14 + Math.sin(t * 5) * 3);
      } else if (ff.hunger < 30) {
        ctx.font = '13px serif'; ctx.fillText('🍽️', sx + 16, sy - 12);
      }
    });
    ctx.restore();
    // viền ao
    ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 4;
    ctx.strokeRect(X - 14, Y - 14, Wp + 28, Hp + 28);
    if (s.fishes.length >= s.pondSlots && s.pondSlots < MAX_POND) {
      txt(ctx, 'AO ĐẦY — mở ở hòm thư 📮', X + Wp / 2, Y - 26, 12, '#ffeb3b');
    }
  }

  // --- sông câu cá + bến ---
  {
    const wy0 = RIVER.y - cam.y, ww = RIVER_WATER_Y - cam.y;
    // bờ cát
    ctx.fillStyle = '#e0c184'; ctx.fillRect(0 - cam.x, wy0, WORLD.w, ww - wy0 + 4);
    // nước sông
    const g = ctx.createLinearGradient(0, ww, 0, ww + (RIVER.h - (RIVER_WATER_Y - RIVER.y)));
    g.addColorStop(0, '#4fc3f7'); g.addColorStop(1, '#01579b');
    ctx.fillStyle = g; ctx.fillRect(0 - cam.x, ww, WORLD.w, 600);
    // sóng sông
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 167 + t * 60) % (WORLD.w + 80)) - 40 - cam.x;
      const sy = ww + 14 + ((i * 53) % 90);
      ctx.fillRect(sx, sy, 30, 3);
    }
    // bóng cá bơi (trang trí)
    ctx.fillStyle = 'rgba(1,40,80,.35)';
    for (let i = 0; i < 6; i++) {
      const sx = ((i * 311 + t * (30 + i * 7)) % (WORLD.w + 120)) - 60 - cam.x;
      const sy = ww + 20 + ((i * 47) % 80);
      ctx.beginPath(); ctx.ellipse(sx, sy, 14, 5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + (i % 2 ? 14 : -14), sy); ctx.lineTo(sx + (i % 2 ? 22 : -22), sy - 5); ctx.lineTo(sx + (i % 2 ? 22 : -22), sy + 5); ctx.closePath(); ctx.fill();
    }
    // bến gỗ
    PIERS.forEach((pier) => {
      const X = pier.x - cam.x;
      const topY = 1020 - cam.y, botY = 1100 - cam.y;
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(X - 20, topY, 8, botY - topY);
      ctx.fillRect(X + 12, topY, 8, botY - topY);
      ctx.fillStyle = '#8b5a2b';
      for (let y = topY; y < botY; y += 12) ctx.fillRect(X - 26, y, 52, 9);
      ctx.fillStyle = '#a06a35';
      for (let y = topY; y < botY; y += 12) ctx.fillRect(X - 26, y, 52, 3);
    });
  }

  // --- vật nuôi ---
  s.animals.forEach((a) => {
    const p = animalPos(a, t);
    const X = p.x - cam.x, Y = p.y - cam.y;
    const A = ANIMALS[a.type];
    if (!A) return;
    const adult = (Date.now() - a.bornAt) / 1000 >= A.grow;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(X, Y + 16, 18, 7, 0, 0, 7); ctx.fill();
    const sc = adult ? 1 : 0.65;
    ctx.font = `${Math.round(30 * sc)}px serif`; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(X, Y);
    if (Math.sin(t * 0.5 + a.uid) > 0) ctx.scale(-1, 1);
    ctx.fillText(A.emoji, 0, 8); ctx.restore();
    ctx.fillStyle = '#000'; ctx.fillRect(X - 20, Y - 34, 40, 7);
    ctx.fillStyle = a.hunger > 50 ? '#76ff03' : a.hunger > 25 ? '#ffeb3b' : '#ff1744';
    ctx.fillRect(X - 19, Y - 33, 38 * (a.hunger / 100), 5);
    if (!adult) { txt(ctx, 'baby', X, Y - 38, 10); }
    else if (a.ready) { ctx.font = '18px serif'; ctx.fillText('❗', X + 20, Y - 20 + Math.sin(t * 5) * 3); }
    else if (a.hunger < 40) { ctx.font = '15px serif'; ctx.fillText('🍽️', X + 20, Y - 20); }
  });

  // --- người chơi (đứng hoặc ngồi câu) ---
  if (s.sit) {
    drawSittingFisher(ctx, s.sit.x - cam.x, s.sit.y - cam.y, s.sit.bx - cam.x, s.sit.by - cam.y, s, t);
  } else {
    const X = s.player.x - cam.x, Y = s.player.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(X, Y + 20, 14, 6, 0, 0, 7); ctx.fill();
    const bob = s.player.moving ? Math.sin(t * 12) * 2 : Math.sin(t * 2) * 1;
    const shirt = SHIRTS[s.avatar % SHIRTS.length];
    ctx.save(); ctx.translate(X, Y + bob);
    if (s.player.dir < 0) ctx.scale(-1, 1);
    const step = s.player.moving ? Math.sin(t * 12) * 4 : 0;
    ctx.fillStyle = '#4e342e'; ctx.fillRect(-9, 10 + step, 7, 10); ctx.fillRect(2, 10 - step, 7, 10);
    ctx.fillStyle = shirt; ctx.fillRect(-11, -8, 22, 20);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-11, -8, 22, 4);
    ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-16, -4 + step, 5, 12); ctx.fillRect(11, -4 - step, 5, 12);
    ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-9, -26, 18, 18);
    ctx.fillStyle = '#000'; ctx.fillRect(0, -20, 3, 3);
    ctx.fillStyle = '#ffca28'; ctx.fillRect(-13, -30, 26, 7);
    ctx.fillStyle = '#ffb300'; ctx.fillRect(-17, -25, 34, 4);
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(-16, -14, 4, 26);
    ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-22, -20, 10, 6);
    ctx.restore();
    txt(ctx, s.player.name, X, Y - 36, 12);
    if (s.player.tx != null && s.player.ty != null) {
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(s.player.tx - cam.x, s.player.ty - cam.y, 6 + Math.sin(t * 8) * 2, 0, 7); ctx.fill();
    }
  }

  // người chơi khác trong làng (multiplayer) + bóng chat
  if (s.visitors) {
    const nowMs = Date.now();
    for (const v of s.visitors) {
      const X = v.x - cam.x, Y = v.y - cam.y;
      if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(X, Y + 20, 14, 6, 0, 0, 7); ctx.fill();
      const bob = v.moving ? Math.sin(t * 12 + v.x) * 2 : Math.sin(t * 2 + v.x) * 1;
      const shirt = SHIRTS[(v.avatar || 0) % SHIRTS.length];
      ctx.save(); ctx.translate(X, Y + bob);
      if (v.dir < 0) ctx.scale(-1, 1);
      const step = v.moving ? Math.sin(t * 12 + v.x) * 4 : 0;
      ctx.fillStyle = '#4e342e'; ctx.fillRect(-9, 10 + step, 7, 10); ctx.fillRect(2, 10 - step, 7, 10);
      ctx.fillStyle = shirt; ctx.fillRect(-11, -8, 22, 20);
      ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-16, -4 + step, 5, 12); ctx.fillRect(11, -4 - step, 5, 12);
      ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-9, -26, 18, 18);
      ctx.fillStyle = '#000'; ctx.fillRect(0, -20, 3, 3);
      ctx.fillStyle = '#ffca28'; ctx.fillRect(-13, -30, 26, 7);
      ctx.fillStyle = '#ffb300'; ctx.fillRect(-17, -25, 34, 4);
      ctx.restore();
      txt(ctx, v.name, X, Y - 36, 11, v.self ? '#fef08a' : '#fff');
      const bub = v.self ? s.selfBubble : v.bubble;
      const at = v.self ? nowMs : (v.bubbleAt ?? 0);
      if (bub && nowMs - at < 5000) {
        ctx.font = `bold 12px 'Be Vietnam Pro', monospace`;
        const wpx = Math.min(220, ctx.measureText(bub).width + 18);
        const bx = Math.max(wpx / 2 + 4, Math.min(W - wpx / 2 - 4, X));
        const by = Y - 58;
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

  // ngày/đêm
  {
    const dt = s.dayTime;
    let dark = 0;
    if (dt < 0.2) dark = 0.55 - (dt / 0.2) * 0.45;
    else if (dt < 0.3) dark = 0.1;
    else if (dt < 0.7) dark = 0;
    else if (dt < 0.85) dark = ((dt - 0.7) / 0.15) * 0.35;
    else dark = 0.35 + ((dt - 0.85) / 0.15) * 0.25;
    if (dark > 0.02) { ctx.fillStyle = `rgba(10,10,60,${dark})`; ctx.fillRect(0, 0, W, H); }
    ctx.font = '30px serif';
    ctx.fillText(dt > 0.2 && dt < 0.78 ? '☀️' : '🌙', W - 60, 44);
  }
}

/** Nông dân ngồi câu: chân xếp, tay cầm cần, phao + gợn sóng, ❗ khi cắn câu */
function drawSittingFisher(
  ctx: CanvasRenderingContext2D, X: number, Y: number, BX: number, BY: number,
  s: RenderState, t: number,
) {
  const shirt = SHIRTS[s.avatar % SHIRTS.length];
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(X, Y + 14, 16, 6, 0, 0, 7); ctx.fill();
  const bob = Math.sin(t * 2) * 1;
  ctx.save(); ctx.translate(X, Y + bob);
  // chân xếp bằng
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(-16, 6, 14, 7); ctx.fillRect(2, 6, 14, 7);
  // thân ngồi
  ctx.fillStyle = shirt; ctx.fillRect(-11, -12, 22, 20);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-11, -12, 22, 4);
  // đầu + nón
  ctx.fillStyle = '#ffcc9e'; ctx.fillRect(-9, -30, 18, 18);
  ctx.fillStyle = '#000'; ctx.fillRect(0, -24, 3, 3);
  ctx.fillStyle = '#ffca28'; ctx.fillRect(-13, -34, 26, 7);
  ctx.fillStyle = '#ffb300'; ctx.fillRect(-17, -29, 34, 4);
  // tay cầm cần hướng xuống sông
  ctx.fillStyle = '#ffcc9e'; ctx.fillRect(8, -10, 12, 5);
  // cần câu
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(18, -8); ctx.lineTo(BX - X, BY - Y - 26); ctx.stroke();
  ctx.restore();
  // dây + phao
  const byBob = Math.sin(t * 3) * 2;
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(BX, BY - 26 + bob); ctx.lineTo(BX, BY + byBob); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(BX, BY + byBob, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(BX, BY + byBob - 3, 5, Math.PI, 0); ctx.fill();
  // gợn sóng quanh phao
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const rr = 8 + ((t * 14 + i * 12) % 24);
    ctx.globalAlpha = 1 - rr / 34;
    ctx.beginPath(); ctx.ellipse(BX, BY + byBob, rr, rr * 0.35, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  txt(ctx, s.player.name, X, Y - 42, 12);
  if (s.sit?.bite) {
    ctx.font = '26px serif'; ctx.textAlign = 'center';
    ctx.fillText('❗', BX, BY - 22 + Math.sin(t * 10) * 3);
  }
}
