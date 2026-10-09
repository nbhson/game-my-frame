// ===== KHU MUA SẮM & GIẢI TRÍ — map chung thứ 2 (neon + sông + đường đua) =====
// Tái dùng ngôn ngữ vẽ + hàm dùng chung của townRender (đã export).
import {
  MALL, MALL_BENCHES, MALL_BRIDGE, MALL_CASINO, MALL_DEALER, MALL_GARAGE, MALL_LAMPS,
  MALL_LOTTERY, MALL_MART, MALL_PIERS, MALL_PLAZA, MALL_RACE, MALL_RIVER, MALL_SAKURA,
  MALL_TRACK, MALL_WOLF, MALL_XOSO, mallTownGateCenter,
} from './mall';
import {
  OUT, cloud, drawBench, drawBuilding, drawCarDealer, drawCasino,
  drawCritters, drawGarage, drawLamp, drawLotterySeller, drawMapActors, drawMapGate, drawSakura,
  drawSkyFx, ell, flower, frame, grassTuft, rr, setTQ, shadow, stone, stonePath,
  txt, type TownRenderState,
} from './townRender';
import { drawBiteComboHUD, drawCatchPop, drawSittingFisher, withDepth, type RenderState } from './render';
import { drawSparkle } from './icons';

// ---------- nền: cỏ xanh + gạch neon quanh quảng trường ----------
function drawMallBase(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, H: number, t: number) {
  const g = ctx.createLinearGradient(0, -cam.y, 0, MALL.h - cam.y);
  g.addColorStop(0, '#8fd45e'); g.addColorStop(0.6, '#7ec850'); g.addColorStop(1, '#6db844');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // hoa cỏ rải rác (né quảng trường + nhà + đường + sông + đường đua)
  const solids = [MALL_GARAGE, MALL_MART, MALL_CASINO, MALL_XOSO, MALL_WOLF, MALL_RACE, MALL_TRACK];
  for (let i = 0; i < 130; i++) {
    const fx = (i * 211.7) % MALL.w, fy = (i * 349.3) % MALL.h;
    if (Math.hypot(fx - MALL_PLAZA.x, fy - MALL_PLAZA.y) < MALL_PLAZA.r + 26) continue;
    if (fy > 590 && fy < 700) continue;
    if (fx > 750 && fx < 850) continue;
    if (fy > MALL_RIVER.y - 30 && fy < MALL_RIVER.y + MALL_RIVER.h + 30) continue;
    let inside = false;
    for (const b of solids) {
      if (fx > b.x - 16 && fx < b.x + b.w + 16 && fy > b.y - 16 && fy < b.y + b.h + 16) inside = true;
    }
    if (inside) continue;
    const X = fx - cam.x, Y = fy - cam.y;
    if (X < -24 || Y < -24 || X > W + 24 || Y > H + 24) continue;
    if (i % 5 === 0) {
      flower(ctx, X, Y - 8, 6.5, ['#ff8fb0', '#ffffff', '#ffeb3b', '#ce93d8'][i % 4]);
      grassTuft(ctx, X + 8, Y, 1, t, i);
    } else grassTuft(ctx, X, Y, 0.9, t, i);
  }
}

// ---------- quảng trường ánh sáng: vòng neon + bục DJ giữa ----------
function drawNeonPlaza(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const X = MALL_PLAZA.x - cam.x, Y = MALL_PLAZA.y - cam.y;
  const R = MALL_PLAZA.r;
  shadow(ctx, X, Y + 8, R + 10, 22, 0.2);
  const rings: [number, string][] = [[R, '#3d3d6e'], [R - 40, '#565694'], [R - 90, '#3d3d6e']];
  for (const [r, col] of rings) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = night ? '#ff9ebb' : OUT; ctx.stroke();
  }
  // khảm đèn led quanh bục
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + t * 0.2;
    const px = X + Math.cos(a) * 132, py = Y + Math.sin(a) * 132;
    ctx.fillStyle = ['#ff5b8b', '#ffd24d', '#3b82f6', '#43d17c'][k % 4];
    ctx.beginPath(); ctx.ellipse(px, py, 9, 5.5, a, 0, 7); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  }
  // bục DJ giữa
  frame(ctx, X - 46, Y - 30, 92, 60, 10, '#2b2b4e', 3);
  ctx.fillStyle = night ? '#ffeb3b' : '#8a8ab8';
  ctx.fillRect(X - 38, Y - 22, 76, 18);
  ctx.fillStyle = '#ff5b8b';
  for (let k = 0; k < 5; k++) {
    const bh = 4 + Math.abs(Math.sin(t * 4 + k * 1.4)) * 10;
    ctx.fillRect(X - 34 + k * 14, Y - 8 - bh, 9, bh);
  }
  txt(ctx, 'SÂN KHẤU ÁNH SÁNG', X, Y + 52, 11, night ? '#ffeb3b' : '#ffffff');
  if (Math.sin(t * 2) > 0.5) drawSparkle(ctx, X - 150, Y - 100, 5, 0.8);
  if (Math.cos(t * 1.7) > 0.5) drawSparkle(ctx, X + 150, Y + 110, 5, 0.8);
}

// ---------- sông + cầu gỗ + bến câu ----------
function drawMallRiver(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const R = MALL_RIVER;
  const Y0 = R.y - cam.y;
  // bãi cát 2 bờ
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(0 - cam.x, Y0 - 20, MALL.w, 20);
  ctx.fillRect(0 - cam.x, Y0 + R.h, MALL.w, 22);
  ctx.fillStyle = 'rgba(120,90,40,.25)';
  for (let x = 0; x < MALL.w; x += 46) {
    stone(ctx, x + 12 - cam.x, Y0 - 10, 5, 3.4, '#d9c88f');
    stone(ctx, x + 30 - cam.x, Y0 + R.h + 11, 5, 3.4, '#d9c88f');
  }
  // mặt nước
  const wg = ctx.createLinearGradient(0, Y0, 0, Y0 + R.h);
  wg.addColorStop(0, '#5ec8f2'); wg.addColorStop(0.5, '#2e9fd8'); wg.addColorStop(1, '#1d7fb8');
  ctx.fillStyle = wg;
  ctx.fillRect(0 - cam.x, Y0, MALL.w, R.h);
  // sóng lăn tăn
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
  for (let k = 0; k < 24; k++) {
    const wx = ((k * 173 + t * 40) % (MALL.w + 120)) - 60 - cam.x;
    const wy = Y0 + 18 + ((k * 67) % (R.h - 36));
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 12, wy - 5, wx + 24, wy); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ell(ctx, 300 - cam.x, Y0 + 30, 60, 8);
  ell(ctx, 1100 - cam.x, Y0 + 70, 80, 9);
  // cá quẫy (bóng lưng lấp ló)
  for (let k = 0; k < 3; k++) {
    const fx = ((k * 521 + t * (30 + k * 12)) % MALL.w) - cam.x;
    const fy = Y0 + 30 + ((k * 37) % 50);
    if (fx < -20 || fx > 2000) continue;
    ctx.fillStyle = 'rgba(20,60,90,.5)';
    ctx.beginPath(); ctx.ellipse(fx, fy, 12, 5, Math.sin(t * 3 + k) * 0.3, 0, 7); ctx.fill();
    if (Math.sin(t * 2 + k * 2.4) > 0.7) drawSparkle(ctx, fx + 8, fy - 8, 4, 0.8);
  }
  // cầu gỗ giữa
  const B = MALL_BRIDGE;
  const BX = B.x - cam.x, BY = B.y - cam.y;
  for (let k = 0; k < 9; k++) {
    const py = BY + k * 17;
    frame(ctx, BX, py, B.w, 15, 4, k % 2 ? '#c98a4b' : '#d9a066', 2.2);
  }
  ctx.fillStyle = '#7c4f21';
  ctx.fillRect(BX - 6, BY, 8, B.h);
  ctx.fillRect(BX + B.w - 2, BY, 8, B.h);
  txt(ctx, 'CẦU GỖ', BX + B.w / 2, BY - 12, 11, '#5d3a1a');
  // 3 bến câu: sàn gỗ + cọc
  MALL_PIERS.forEach((p, i) => {
    const PX = p.x - cam.x, PY = p.sitY - cam.y + 24;
    shadow(ctx, PX, PY + 10, 34, 6, 0.2);
    frame(ctx, PX - 32, PY - 14, 64, 30, 5, '#c98a4b', 2.6);
    ctx.fillStyle = 'rgba(90,50,20,.4)';
    for (let k = 0; k < 4; k++) ctx.fillRect(PX - 32 + k * 17, PY - 14, 3, 30);
    for (const ox of [-26, 26]) {
      ctx.fillStyle = '#7c4f21';
      ctx.fillRect(PX + ox - 3, PY - 14, 6, 44);
    }
    txt(ctx, `BẾN ${i + 1}`, PX, PY - 24, 10, '#5d3a1a');
  });
}

// ---------- đường đua oval + khán đài ----------
function drawRaceTrack(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const T = MALL_TRACK;
  const X = T.x - cam.x, Y = T.y - cam.y;
  if (X + T.w < -160 || X > 4000 || Y + T.h < -200 || Y > 3000) return;
  // nền nhựa vòng oval (2 rect bo tròn lồng nhau)
  const ring = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  };
  ring(X, Y, T.w, T.h, 90, '#4a4a5e');
  ring(X + 60, Y + 60, T.w - 120, T.h - 120, 60, '#7ec850');
  // viền curb đỏ-trắng
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const ex = X + T.w / 2 + Math.cos(a) * (T.w / 2 - 30);
    const ey = Y + T.h / 2 + Math.sin(a) * (T.h / 2 - 30);
    ctx.fillStyle = k % 2 ? '#e53935' : '#ffffff';
    ctx.beginPath(); ctx.arc(ex, ey, 7, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
  }
  // vạch xuất phát/đích caro (đường thẳng phía nam)
  for (let r2 = 0; r2 < 3; r2++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r2 + c) % 2 ? '#111' : '#fff';
      ctx.fillRect(X + 270 + c * 10, Y + 245 + r2 * 10, 10, 10);
    }
  }
  // cờ 4 góc phấp phới
  const corners: [number, number][] = [[X + 20, Y + 20], [X + T.w - 20, Y + 20], [X + 20, Y + T.h - 20], [X + T.w - 20, Y + T.h - 20]];
  corners.forEach(([fx, fy], i) => {
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 46); ctx.stroke();
    const wave = Math.sin(t * 5 + i * 1.7) * 4;
    ctx.fillStyle = ['#e53935', '#ffeb3b', '#3b82f6', '#43d17c'][i];
    ctx.beginPath();
    ctx.moveTo(fx, fy - 46); ctx.lineTo(fx + 22 + wave, fy - 40); ctx.lineTo(fx, fy - 34);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  });
  // khán đài phía đông
  const GX = X + T.w + 8, GY = Y + 60;
  frame(ctx, GX, GY, 96, 200, 8, '#8d6e63', 3);
  ctx.fillStyle = night ? '#ffdf9e' : '#5d4037';
  ctx.fillRect(GX + 8, GY + 60, 80, 100);
  for (let r2 = 0; r2 < 4; r2++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = ['#ff8fb0', '#ffeb3b', '#82b1ff', '#ce93d8'][(r2 + c) % 4];
      ctx.beginPath(); ctx.arc(GX + 20 + c * 12, GY + 74 + r2 * 22, 4.6, 0, 7); ctx.fill();
    }
  }
  // mái che caro
  for (let c = 0; c < 8; c++) {
    ctx.fillStyle = c % 2 ? '#e53935' : '#ffffff';
    ctx.fillRect(GX + c * 12, GY, 12, 22);
  }
  ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.strokeRect(GX, GY, 96, 22);
  txt(ctx, 'TRƯỜNG ĐUA', X + T.w / 2, Y - 12, 13, night ? '#ffeb3b' : '#2b2117');
}

// ================= RENDER CHÍNH =================
export function renderMall(ctx: CanvasRenderingContext2D, W: number, H: number, cam: { x: number; y: number }, s: TownRenderState, t: number) {
  setTQ(s.quality ?? 'medium');
  const dt = s.dayTime;
  const night = dt < 0.2 || dt > 0.8;
  const isDay = dt > 0.2 && dt < 0.78;
  ctx.clearRect(0, 0, W, H);
  drawMallBase(ctx, cam, W, H, t);
  // đường chính + đường dọc ra cầu
  stonePath(ctx, cam, 0, 606, MALL.w, 68, t, 1);
  stonePath(ctx, cam, 766, 60, 68, 962, t, 2);
  drawNeonPlaza(ctx, cam, t, night);
  drawMallRiver(ctx, cam, t);
  drawRaceTrack(ctx, cam, t, night);
  // nhà cửa
  drawBuilding(ctx, cam, t, MALL_MART, { id: 'shop', roof: 'double', wall: '#fffdf5', roofTop: '#ff9ebb', roofBot: '#c2185b', sign: 'MUA SẮM', noren: ['買', '物', '街'] }, night);
  drawBuilding(ctx, cam, t, MALL_XOSO, { id: 'shop', roof: 'lean', wall: '#fff8e1', roofTop: '#ff5b5b', roofBot: '#8e0000', sign: 'NHÀ VÉ SỐ' }, night);
  drawBuilding(ctx, cam, t, MALL_WOLF, { id: 'house', roof: 'thatch', wall: '#4a4a6e', roofTop: '#2e2e4e', roofBot: '#121224', sign: 'HANG SÓI' }, night);
  drawBuilding(ctx, cam, t, MALL_RACE, { id: 'hall', roof: 'tile', wall: '#e3f2fd', roofTop: '#e53935', roofBot: '#8e0000', sign: 'TRƯỜNG ĐUA', chimney: true }, night);
  drawGarage(ctx, cam, t, night, MALL_GARAGE);
  drawCarDealer(ctx, cam, t, MALL_DEALER.x, MALL_DEALER.y);
  drawCasino(ctx, cam, t, night, MALL_CASINO);
  drawLotterySeller(ctx, cam, t, night, MALL_LOTTERY.x, MALL_LOTTERY.y);
  // cổng về thị trấn (mép trái)
  {
    const gc = mallTownGateCenter();
    drawMapGate(ctx, cam, t, gc.x, gc.y, 'THỊ TRẤN', 'về làng cũ', { pillar: '#8fd45e', pillarDark: '#1b5e20', board: '#2e7d32' });
  }
  for (let i = 0; i < MALL_SAKURA.length; i++) {
    const p = MALL_SAKURA[i];
    drawSakura(ctx, cam, p.x, p.y, t, i * 1.7);
  }
  for (const l of MALL_LAMPS) drawLamp(ctx, cam, l.x, l.y, t, night);
  for (const b of MALL_BENCHES) drawBench(ctx, cam, b.x, b.y, b.flip, t);
  drawCritters(ctx, cam, W, t, MALL_MART.x + MALL_MART.w / 2, MALL_MART.y - 80);
  // đang ngồi câu ở sông mall: cần + phao + cá giãy (tái dùng đồ họa farm)
  if (s.sit) {
    const rs = { avatar: s.avatar, outfit: s.outfit, sit: s.sit, player: { name: s.player.name } } as unknown as RenderState;
    withDepth(ctx, s.sit.x - cam.x, s.sit.y - cam.y, s.sit.y, () => drawSittingFisher(ctx, s.sit!.x - cam.x, s.sit!.y - cam.y, s.sit!.bx - cam.x, s.sit!.by - cam.y, rs, t));
  }
  drawMapActors(ctx, cam, W, H, s, t);
  if (s.sit?.bite && s.sit.combo && s.sit.combo.length > 0) {
    drawBiteComboHUD(ctx, W, H, s.sit.combo, s.sit.progress ?? 0, t);
  }
  if (s.catchPop && Date.now() < s.catchPop.until) {
    const cx = s.catchPop.x - cam.x, cy = s.catchPop.y - cam.y;
    if (cx > -80 && cx < W + 80 && cy > -120 && cy < H + 80) {
      drawCatchPop(ctx, cx, cy, s.catchPop.fishId, s.catchPop.label, t);
    }
  }
  drawSkyFx(ctx, cam, W, H, s, t, night, isDay, MALL.w, MALL.h, MALL_LAMPS, [
    { x: MALL_PLAZA.x, y: MALL_PLAZA.y - 20, r: 110, c: '255,160,220' },
    { x: MALL_CASINO.x + MALL_CASINO.w / 2, y: MALL_CASINO.y + MALL_CASINO.h, r: 100 },
    { x: MALL_RACE.x + MALL_RACE.w / 2, y: MALL_RACE.y, r: 110 },
  ]);
}
