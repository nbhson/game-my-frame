// ===== KHU MUA SẮM & GIẢI TRÍ — map chung thứ 2 (neon + sông + đường đua) =====
// Tái dùng ngôn ngữ vẽ + hàm dùng chung của townRender (đã export).
import {
  MALL, MALL_BENCHES, MALL_BRIDGE, MALL_CASINO, MALL_DEALER, MALL_GARAGE, MALL_LAMPS,
  MALL_LOTTERY, MALL_MART, MALL_PIERS, MALL_RACE, MALL_RIVER, MALL_SAKURA,
  MALL_WOLF, MALL_XOSO, RACE_LINE, RACE_LOOP_TOTAL, RACE_ROAD_HALF, distToRaceLine, raceLoopPoint, mallTownGateCenter,
} from './mall';
import {
  OUT, cloud, drawBench, drawBuilding, drawCarDealer, drawCasino,
  drawCritters, drawGarage, drawLamp, drawLotterySeller, drawMapActors, drawMapGate, drawSakura,
  drawSkyFx, ell, flower, frame, grassTuft, setTQ, shadow, stone, stonePath,
  txt, type TownRenderState,
} from './townRender';
import { drawBiteComboHUD, drawCatchPop, drawPlayerDetailed, drawSittingFisher, withDepth, type RenderState } from './render';
import { drawSparkle } from './icons';

// ---------- nền: cỏ xanh + gạch neon quanh quảng trường ----------
function drawMallBase(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, W: number, H: number, t: number) {
  const g = ctx.createLinearGradient(0, -cam.y, 0, MALL.h - cam.y);
  g.addColorStop(0, '#8fd45e'); g.addColorStop(0.6, '#7ec850'); g.addColorStop(1, '#6db844');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // hoa cỏ rải rác (né nhà + đường + sông + mặt đường đua)
  const solids = [MALL_GARAGE, MALL_MART, MALL_CASINO, MALL_XOSO, MALL_WOLF, MALL_RACE];
  for (let i = 0; i < 130; i++) {
    const fx = (i * 211.7) % MALL.w, fy = (i * 349.3) % MALL.h;
    if (distToRaceLine(fx, fy) < RACE_ROAD_HALF + 22) continue;
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

// ---------- circuit đua uốn lượn + khán đài ----------
// Vẽ theo tim đường RACE_LINE: viền → nhựa → curb đỏ trắng → vạch giữa → vạch đích caro
/** lấy điểm trên vòng (khép kín) tại khoảng cách d + góc tiếp tuyến */
function loopPoint(d: number): { x: number; y: number; ang: number } {
  return raceLoopPoint(d);
}

function traceLoop(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }) {
  ctx.beginPath();
  RACE_LINE.forEach((p, i) => {
    const X = p.x - cam.x, Y = p.y - cam.y;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  });
  ctx.closePath();
}

function drawCircuit(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean) {
  const RW = RACE_ROAD_HALF;
  // viền + mặt nhựa
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  traceLoop(ctx, cam);
  ctx.lineWidth = RW * 2 + 14; ctx.strokeStyle = OUT; ctx.stroke();
  traceLoop(ctx, cam);
  ctx.lineWidth = RW * 2; ctx.strokeStyle = '#4a4a5e'; ctx.stroke();
  // curb đỏ-trắng 2 mép
  for (let d = 0; d < RACE_LOOP_TOTAL; d += 30) {
    const p = loopPoint(d);
    const nx = Math.cos(p.ang + Math.PI / 2), ny = Math.sin(p.ang + Math.PI / 2);
    for (const side of [-1, 1]) {
      const cx = p.x + nx * side * (RW - 4) - cam.x, cy = p.y + ny * side * (RW - 4) - cam.y;
      ctx.fillStyle = (Math.round(d / 30) + (side > 0 ? 1 : 0)) % 2 ? '#e53935' : '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
    }
  }
  // vạch trắng giữa đường
  traceLoop(ctx, cam);
  ctx.setLineDash([20, 26]);
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke();
  ctx.setLineDash([]);
  // vạch xuất phát/đích caro (vuông góc hướng chạy tại chốt 0)
  {
    const p0 = RACE_LINE[0];
    const ang = Math.atan2(RACE_LINE[1].y - p0.y, RACE_LINE[1].x - p0.x);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
    for (let r2 = 0; r2 < 11; r2++) {
      for (let c = 0; c < 3; c++) {
        const wx = p0.x + dx * (c * 10 - 15) + nx * (r2 * 10 - RW) - cam.x;
        const wy = p0.y + dy * (c * 10 - 15) + ny * (r2 * 10 - RW) - cam.y;
        ctx.fillStyle = (r2 + c) % 2 ? '#111' : '#fff';
        ctx.fillRect(wx, wy, 10, 10);
      }
    }
  }
  // cờ 4 góc phấp phới (rải quanh vòng)
  [0.12, 0.36, 0.62, 0.86].forEach((f, i) => {
    const p = loopPoint(RACE_LOOP_TOTAL * f);
    const fx = p.x - cam.x, fy = p.y - cam.y - 40;
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 46); ctx.stroke();
    const wave = Math.sin(t * 5 + i * 1.7) * 4;
    ctx.fillStyle = ['#e53935', '#ffeb3b', '#3b82f6', '#43d17c'][i];
    ctx.beginPath();
    ctx.moveTo(fx, fy - 46); ctx.lineTo(fx + 22 + wave, fy - 40); ctx.lineTo(fx, fy - 34);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  });
  txt(ctx, 'TRƯỜNG ĐUA', 1150 - cam.x, 800 - cam.y - 40, 14, night ? '#ffeb3b' : '#2b2117');
  // khán đài phía bắc đường thẳng trên
  drawTribune(ctx, cam, t, night, 1000, 548, 150);
}

/** khán đài mini: mái caro + 3 hàng khán giả */
function drawTribune(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number, night: boolean, x: number, y: number, w: number) {
  const X = x - cam.x, Y = y - cam.y;
  const h = 72;
  shadow(ctx, X + w / 2, Y + h, w / 2, 10, 0.2);
  frame(ctx, X, Y + 18, w, h - 18, 6, '#8d6e63', 3);
  for (let r2 = 0; r2 < 3; r2++) {
    for (let c = 0; c < Math.floor((w - 20) / 13); c++) {
      const bounce = Math.sin(t * 3 + (r2 * 7 + c) * 1.3) > 0.6 ? -2 : 0;
      ctx.fillStyle = ['#ff8fb0', '#ffeb3b', '#82b1ff', '#ce93d8'][(r2 + c) % 4];
      ctx.beginPath(); ctx.arc(X + 12 + c * 13, Y + 30 + r2 * 15 + bounce, 4.6, 0, 7); ctx.fill();
    }
  }
  // mái che caro
  for (let c = 0; c < Math.floor(w / 14); c++) {
    ctx.fillStyle = c % 2 ? '#e53935' : '#ffffff';
    ctx.fillRect(X + c * 14, Y, 14, 18);
  }
  ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.strokeRect(X, Y, w, 18);
  txt(ctx, 'KHÁN ĐÀI', X + w / 2, Y + h + 14, 11, night ? '#ffeb3b' : '#2b2117');
}

// ---------- cọc số các chốt đua + mũi tên chỉ chốt tiếp theo ----------
// Hiện suốt giải để tay lái thấy rõ phải chạy đâu (không còn mù đường).
function drawRaceCps(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, s: TownRenderState, t: number) {
  const rc = s.race;
  if (!rc || rc.cps.length === 0) return;
  rc.cps.forEach((p, i) => {
    const X = p.x - cam.x, Y = p.y - cam.y;
    if (X < -60 || X > 4000 || Y < -80 || Y > 3000) return;
    const isNext = i === rc.next;
    const pulse = isNext ? 1 + Math.sin(t * 6) * 0.15 : 1;
    const r = (isNext ? 24 : 16) * pulse;
    // cọc
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(X, Y + 4, r, r * 0.45, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(X - 4, Y - 46, 8, 50);
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.strokeRect(X - 4, Y - 46, 8, 50);
    // biển số tròn
    ctx.fillStyle = isNext ? '#ffeb3b' : '#ffffff';
    ctx.beginPath(); ctx.arc(X, Y - 56, r * 0.85, 0, 7); ctx.fill();
    ctx.lineWidth = isNext ? 4 : 2.5; ctx.strokeStyle = isNext ? '#e53935' : OUT; ctx.stroke();
    txt(ctx, i === 0 ? '🏁' : `${i + 1}`, X, Y - 56, isNext ? 17 : 14, '#2b2117');
    // vòng sáng quanh chốt tiếp theo
    if (isNext) {
      ctx.strokeStyle = `rgba(229,57,53,${0.55 + Math.sin(t * 6) * 0.3})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(X, Y, rc.r * (1 + Math.sin(t * 6) * 0.06), 0, 7); ctx.stroke();
    }
  });
  // mũi tên nảy trên đầu người chơi, chỉ hướng chốt tiếp theo
  const np = rc.cps[rc.next];
  if (np) {
    const px = s.player.x - cam.x, py = s.player.y - cam.y;
    const ang = Math.atan2(np.y - s.player.y, np.x - s.player.x);
    const bob = Math.sin(t * 6) * 5;
    const ax = px + Math.cos(ang) * 46, ay = py - 78 + bob + Math.sin(ang) * 20;
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
    txt(ctx, `CHỐT ${rc.next + 1} · VÒNG ${Math.min(rc.laps, rc.lap + 1)}/${rc.laps}`, px, py - 108 + bob, 13, '#ffeb3b');
  }
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
  drawMallRiver(ctx, cam, t);
  drawCircuit(ctx, cam, t, night);
  drawRaceCps(ctx, cam, s, t);
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
  // xe các tay đua máy (có tên + 🤖 để phân biệt với người chơi thật)
  if (s.raceBots) {
    for (const b of s.raceBots) {
      const X = b.x - cam.x, Y = b.y - cam.y;
      if (X < -80 || X > W + 80 || Y < -140 || Y > H + 80) continue;
      withDepth(ctx, X, Y, b.y, () =>
        drawPlayerDetailed(ctx, X, Y, b.dir, b.moving, b.shirt, `${b.name} 🤖`, t + b.x * 0.01, undefined, b.color, 'car', 'car_sieuxe', false));
    }
  }
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
    { x: 1150, y: 790, r: 130, c: '255,160,220' },
    { x: MALL_CASINO.x + MALL_CASINO.w / 2, y: MALL_CASINO.y + MALL_CASINO.h, r: 100 },
    { x: MALL_RACE.x + MALL_RACE.w / 2, y: MALL_RACE.y, r: 110 },
  ]);
}
