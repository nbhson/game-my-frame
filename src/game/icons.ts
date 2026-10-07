// ===== Hand-drawn icon set — thay toàn bộ emoji font trong canvas =====
// Triết lý: vẽ bằng vector canvas 2D (ellipse/rect/arc), đồng bộ art-style farm,
// không phụ thuộc font emoji của thiết bị → nhìn chân thực, sắc nét mọi DPI.

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}

/** Lấp lánh 4 cánh (thay ✨) */
export function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r = 7, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fffde7';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.22, y - r * 0.22, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.22, y + r * 0.22, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.22, y + r * 0.22, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.22, y - r * 0.22, x, y - r);
  ctx.fill();
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, 7); ctx.fill();
  ctx.restore();
}

/** Phong bì thư (thay ✉️) */
export function drawEnvelope(ctx: CanvasRenderingContext2D, x: number, y: number, w = 18) {
  const h = w * 0.7;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ell(ctx, x, y + h / 2 + 2, w / 2, 2.5);
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  // nắp thư
  ctx.fillStyle = '#cfd8dc';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x, y + 1);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x, y + 1); ctx.lineTo(x + w / 2, y - h / 2); ctx.stroke();
  // tem đỏ
  ctx.fillStyle = '#e53935'; ctx.fillRect(x + w / 2 - 6, y - h / 2 + 2, 4, 5);
}

/** Ổ khóa đồng (thay 🔒) */
export function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, s = 22) {
  const w = s, h = s * 0.85;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ell(ctx, x + 2, y + h / 2 + 2, w / 2, 4);
  // càng khóa
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = s * 0.16;
  ctx.beginPath(); ctx.arc(x, y - h * 0.12, w * 0.32, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#eceff1'; ctx.lineWidth = s * 0.05;
  ctx.beginPath(); ctx.arc(x, y - h * 0.12, w * 0.32, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke();
  // thân khóa đồng
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(x - w / 2, y - h * 0.12, w, h + 2);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#a67c3a'); g.addColorStop(0.5, '#e8c872'); g.addColorStop(1, '#8b5f22');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2 + 2, y - h * 0.12 + 2, w - 4, h - 2);
  // rãnh + lỗ khóa
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - w / 2 + 2, y + h * 0.5, w - 4, 3);
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.arc(x, y + h * 0.22, s * 0.11, 0, 7); ctx.fill();
  ctx.fillRect(x - 1.5, y + h * 0.22, 3, s * 0.2);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - w / 2 + 4, y - h * 0.12 + 3, 3, h - 6);
}

/** Cuốc chim mini (thay ⛏️) */
export function drawHoeMini(ctx: CanvasRenderingContext2D, x: number, y: number, s = 16) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = s * 0.22;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.5); ctx.stroke();
  ctx.fillStyle = '#78909c';
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.35); ctx.lineTo(s * 0.1, -s * 0.62); ctx.lineTo(s * 0.05, -s * 0.3); ctx.lineTo(-s * 0.45, -s * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b0bec5'; ctx.fillRect(-s * 0.45, -s * 0.55, s * 0.3, s * 0.1);
  ctx.restore();
}

/** Giỏ thu hoạch (thay 🧺) */
export function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number, s = 18) {
  const w = s, h = s * 0.7;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x, y + h / 2, w / 2, 3);
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x + w / 2, y - h / 2);
  ctx.lineTo(x + w / 2 - 3, y + h / 2); ctx.lineTo(x - w / 2 + 3, y + h / 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 2, y - h / 2 + 4 + i * 5); ctx.lineTo(x + w / 2 - 2, y - h / 2 + 4 + i * 5); ctx.stroke();
  }
  ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(x, y - h / 2 + 2, w / 2 - 1, Math.PI, 0); ctx.stroke();
  // rau quả trong giỏ
  ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x - 4, y - h / 2 - 1, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x + 4, y - h / 2 - 2, 4.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#fdd835'; ctx.beginPath(); ctx.arc(x, y - h / 2 - 4, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#2e7d32'; ctx.fillRect(x - 1, y - h / 2 - 9, 2, 4);
}

/** Giọt nước (thay 💧) */
export function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, s = 15) {
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ell(ctx, x, y + s * 0.45, s * 0.32, 2);
  const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2);
  g.addColorStop(0, '#b3e5fc'); g.addColorStop(1, '#0288d1');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.55);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.05, x + s * 0.32, y + s * 0.4, x, y + s * 0.45);
  ctx.bezierCurveTo(x - s * 0.32, y + s * 0.4, x - s * 0.45, y - s * 0.05, x, y - s * 0.55);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ell(ctx, x - s * 0.12, y + s * 0.02, s * 0.09, s * 0.14);
}

/** Hạt giống (thay 🌰) */
export function drawSeedDot(ctx: CanvasRenderingContext2D, x: number, y: number, s = 13) {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x, y + s * 0.4, s * 0.4, 2.4);
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.42, s * 0.5, 0.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#d7b56d';
  ctx.beginPath(); ctx.ellipse(x - s * 0.1, y - s * 0.12, s * 0.16, s * 0.24, 0.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#5d3a1a';
  ctx.beginPath(); ctx.arc(x + s * 0.14, y - s * 0.28, s * 0.09, 0, 7); ctx.fill();
}

/** Mầm non 2 lá (thay 🌱 — icon trong ảnh [Image 1]) */
export function drawSprout(ctx: CanvasRenderingContext2D, x: number, y: number, s = 22, t = 0) {
  const sway = Math.sin(t * 2 + x * 0.05) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ell(ctx, x, y + 2, s * 0.4, 2.4);
  // thân
  ctx.strokeStyle = '#33691e'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.4, y - s * 0.35, x + sway, y - s * 0.6); ctx.stroke();
  // lá trái / phải
  const leaf = (dir: 1 | -1) => {
    ctx.fillStyle = dir > 0 ? '#43a047' : '#388e3c';
    ctx.beginPath();
    ctx.ellipse(x + dir * s * 0.32 + sway * 0.6, y - s * 0.42, s * 0.3, s * 0.15, dir * 0.5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + sway * 0.5, y - s * 0.42); ctx.lineTo(x + dir * s * 0.55 + sway * 0.6, y - s * 0.42 + dir * 0.06 * s); ctx.stroke();
  };
  leaf(-1); leaf(1);
  // búp non
  ctx.fillStyle = '#81c784'; ctx.beginPath(); ctx.arc(x + sway, y - s * 0.64, s * 0.1, 0, 7); ctx.fill();
}

/** Badge chấm than (thay ❗) */
export function drawExclaimBadge(ctx: CanvasRenderingContext2D, x: number, y: number, s = 20, t = 0) {
  const pulse = 1 + Math.sin(t * 5 + x) * 0.08;
  const r = (s / 2) * pulse;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, x, y + r + 2, r, 3);
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, '#ff5252'); g.addColorStop(1, '#b71c1c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 1.8, y - r * 0.55, 3.6, r * 0.75);
  ctx.beginPath(); ctx.arc(x, y + r * 0.45, 2.2, 0, 7); ctx.fill();
}

/** Bát thức ăn (thay 🍽️) */
export function drawFeedBowl(ctx: CanvasRenderingContext2D, x: number, y: number, s = 18) {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x, y + s * 0.35, s * 0.5, 3);
  ctx.fillStyle = '#1565c0';
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.32, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath(); ctx.ellipse(x, y - 2, s * 0.42, s * 0.24, 0, 0, 7); ctx.fill();
  // hạt cám
  ctx.fillStyle = '#ffca28';
  ell(ctx, x - 4, y - 3, 2.4, 1.8); ell(ctx, x + 1, y - 4, 2.4, 1.8); ell(ctx, x + 5, y - 2, 2.2, 1.6);
  ctx.fillStyle = '#8b5a2b';
  ell(ctx, x - 1, y - 2, 1.8, 1.4); ell(ctx, x + 4, y - 4, 1.6, 1.2);
  // hơi nóng
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 3, y - 9); ctx.quadraticCurveTo(x - 4, y - 12, x - 2, y - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 3, y - 9); ctx.quadraticCurveTo(x + 4, y - 12, x + 2, y - 14); ctx.stroke();
}

/** Đầu gà (thay 🐔 — icon trong ảnh [Image 1], cửa sổ chuồng, shop) */
export function drawChickenHead(ctx: CanvasRenderingContext2D, x: number, y: number, s = 22) {
  const r = s / 2;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, x, y + r + 2, r * 0.9, 3);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.ellipse(x - r * 0.4, y + r * 0.2, r * 0.5, r * 0.4, -0.4, 0, 7); ctx.fill();
  // mào đỏ
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.95, r * 0.28, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 1.05, r * 0.3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.9, r * 0.26, 0, 7); ctx.fill();
  // mỏ + tích
  ctx.fillStyle = '#ffb300';
  ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 0.1); ctx.lineTo(x + r * 1.15, y + r * 0.12); ctx.lineTo(x + r * 0.55, y + r * 0.38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.55, r * 0.2, 0, 7); ctx.fill();
  // mắt
  ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.37, y - r * 0.22, r * 0.07, 0, 7); ctx.fill();
}

/** Đầu bò sữa (thay 🐄) */
export function drawCowHead(ctx: CanvasRenderingContext2D, x: number, y: number, s = 26) {
  const r = s / 2;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, x, y + r + 2, r, 3);
  // sừng + tai
  ctx.fillStyle = '#d7ccc8';
  ctx.fillRect(x - r * 0.75, y - r * 1.15, r * 0.22, r * 0.45);
  ctx.fillRect(x + r * 0.55, y - r * 1.15, r * 0.22, r * 0.45);
  ctx.fillStyle = '#fafafa';
  ell(ctx, x - r * 0.85, y - r * 0.35, r * 0.32, r * 0.22);
  ell(ctx, x + r * 0.85, y - r * 0.35, r * 0.32, r * 0.22);
  // mặt trắng + đốm
  ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, 7); ctx.fill();
  ctx.fillStyle = '#212121';
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.25, r * 0.28, r * 0.22, 0.4, 0, 7); ctx.fill();
  // mõm hồng
  ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.45, r * 0.5, r * 0.35, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ad1457';
  ctx.beginPath(); ctx.arc(x - r * 0.18, y + r * 0.45, r * 0.08, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.18, y + r * 0.45, r * 0.08, 0, 7); ctx.fill();
  // mắt
  ctx.fillStyle = '#212121';
  ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.05, r * 0.13, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.08, r * 0.13, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.1, r * 0.05, 0, 7); ctx.fill();
}

// ---------- cá vẽ tay: 8 loại phân biệt rõ (thay 🐟🐠🦐🦀🐡🎏🐙🦈) ----------
export type FishIconId = 'caro' | 'cachep' | 'tom' | 'cua' | 'caloc' | 'cakoi' | 'bachtuoc' | 'camap' | string;

function fishBody(ctx: CanvasRenderingContext2D, len: number, h: number, top: string, belly: string) {
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, top); g.addColorStop(0.6, belly); g.addColorStop(1, 'rgba(0,0,0,.15)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, len / 2, h / 2, 0, 0, 7);
  ctx.fill();
}

function fishTail(ctx: CanvasRenderingContext2D, x: number, len: number, h: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x - len * 0.28, -h * 0.55);
  ctx.lineTo(x - len * 0.2, 0);
  ctx.lineTo(x - len * 0.28, h * 0.55);
  ctx.closePath(); ctx.fill();
}

/** Vẽ cá mini nhìn ngang (mặt hướng phải). Caller flip qua scale nếu cần. */
export function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, len = 30, id: FishIconId = 'caro', t = 0) {
  const wig = Math.sin(t * 6 + x * 0.1) * 1.5;
  ctx.save(); ctx.translate(x, y + wig * 0.3);
  const eye = (ex: number, ey: number, r: number) => {
    ctx.fillStyle = '#102027'; ctx.beginPath(); ctx.arc(ex, ey, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.3, ey - r * 0.3, r * 0.35, 0, 7); ctx.fill();
  };
  switch (id) {
    case 'cachep': { // chép vàng
      fishTail(ctx, -len / 2, len, 14, '#ef6c00');
      fishBody(ctx, len, 15, '#ffb300', '#ffe082');
      ctx.strokeStyle = 'rgba(180,100,0,.5)'; ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 6, 0, 5, 0, 7); ctx.stroke(); }
      ctx.fillStyle = '#ef6c00';
      ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(4, -13); ctx.lineTo(6, -6); ctx.closePath(); ctx.fill();
      eye(len * 0.32, -2, 2.6);
      // râu chép
      ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(len * 0.48, 3); ctx.quadraticCurveTo(len * 0.58, 5, len * 0.55, 8); ctx.stroke();
      break;
    }
    case 'tom': { // tôm cong
      ctx.strokeStyle = '#ff8a65'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 2, len * 0.28, 0.3, 5.4); ctx.stroke();
      ctx.strokeStyle = '#ffab91'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 2, len * 0.28, 0.5, 5.0); ctx.stroke();
      ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 6, -6); ctx.lineTo(-4 + i * 6, 2); ctx.stroke(); }
      // đầu + râu dài + đuôi quạt
      ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(len * 0.32, -2, 5, 0, 7); ctx.fill();
      eye(len * 0.36, -3, 1.8);
      ctx.strokeStyle = '#ffccbc'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(len * 0.4, -4); ctx.lineTo(len * 0.7, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(len * 0.4, -2); ctx.lineTo(len * 0.68, -6); ctx.stroke();
      ctx.fillStyle = '#d84315';
      ctx.beginPath(); ctx.moveTo(-len * 0.32, 4); ctx.lineTo(-len * 0.5, -2); ctx.lineTo(-len * 0.48, 9); ctx.closePath(); ctx.fill();
      break;
    }
    case 'cua': { // cua đỏ
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath(); ctx.ellipse(0, 0, len * 0.32, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ef5350';
      ctx.beginPath(); ctx.ellipse(-2, -3, len * 0.24, 6, 0, 0, 7); ctx.fill();
      // càng
      ctx.fillStyle = '#b71c1c';
      ctx.beginPath(); ctx.arc(len * 0.42, -6, 5.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(len * 0.42, 6, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.arc(len * 0.44, -7, 2, 0, 7); ctx.fill();
      // chân
      ctx.strokeStyle = '#b71c1c'; ctx.lineWidth = 1.8;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(-8 + k * 7, 8); ctx.lineTo(-11 + k * 7, 14); ctx.stroke();
      }
      eye(-3, -3, 2); eye(4, -3, 2);
      break;
    }
    case 'caloc': { // lóc xanh đen dài
      fishTail(ctx, -len / 2, len, 12, '#37474f');
      fishBody(ctx, len * 1.15, 12, '#455a64', '#b0bec5');
      ctx.fillStyle = '#263238';
      for (let i = 0; i < 4; i++) ell(ctx, -8 + i * 7, -1, 2.4, 1.8);
      ctx.fillStyle = '#37474f';
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(2, -12); ctx.lineTo(6, -5); ctx.closePath(); ctx.fill();
      eye(len * 0.4, -2, 2.4);
      ctx.strokeStyle = '#263238'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(len * 0.5, 1); ctx.lineTo(len * 0.58, 1); ctx.stroke();
      break;
    }
    case 'cakoi': { // koi trắng đốm đỏ
      fishTail(ctx, -len / 2, len, 14, '#e53935');
      fishBody(ctx, len, 14, '#fafafa', '#ffebee');
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.ellipse(-2, -3, 5, 3.4, 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, 2, 3.4, 2.4, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(2, -12); ctx.lineTo(5, -6); ctx.closePath(); ctx.fill();
      eye(len * 0.33, -2, 2.4);
      ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(len * 0.46, 2); ctx.quadraticCurveTo(len * 0.56, 3, len * 0.55, 6); ctx.stroke();
      break;
    }
    case 'bachtuoc': { // bạch tuộc tím
      ctx.fillStyle = '#7b1fa2';
      ctx.beginPath(); ctx.arc(4, -4, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#ab47bc';
      ctx.beginPath(); ctx.arc(1, -7, 5, 0, 7); ctx.fill();
      // 5 xúc tu
      ctx.strokeStyle = '#7b1fa2'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const sx = -4 + k * 4;
        ctx.beginPath(); ctx.moveTo(sx, 3);
        ctx.quadraticCurveTo(sx + Math.sin(t * 5 + k) * 3, 8, sx - 2 + Math.cos(t * 4 + k) * 3, 12);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -6, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(6.6, -6, 1.5, 0, 7); ctx.fill();
      break;
    }
    case 'camap': { // mập xám
      fishTail(ctx, -len / 2, len * 1.1, 15, '#546e7a');
      fishBody(ctx, len * 1.1, 15, '#78909c', '#eceff1');
      // vây lưng + vây ngực
      ctx.fillStyle = '#455a64';
      ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(3, -15); ctx.lineTo(8, -6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(8, 11); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill();
      // mang + răng
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(6 + i * 3, -4); ctx.lineTo(6 + i * 3, 3); ctx.stroke(); }
      eye(len * 0.36, -3, 2.4);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(len * 0.42, 3); ctx.lineTo(len * 0.52, 3); ctx.lineTo(len * 0.47, 5.5); ctx.closePath(); ctx.fill();
      break;
    }
    default: { // caro xanh (mặc định)
      fishTail(ctx, -len / 2, len, 13, '#1565c0');
      fishBody(ctx, len, 14, '#42a5f5', '#e1f5fe');
      ctx.fillStyle = '#1e88e5';
      ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(3, -12); ctx.lineTo(6, -6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(13,71,161,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-len * 0.3, 0); ctx.lineTo(len * 0.3, 0); ctx.stroke();
      eye(len * 0.32, -2, 2.8);
      break;
    }
  }
  ctx.restore();
}

// ---------- quả trên cây (thay 🍎🍊🥭) ----------
export type TreeFruitKind = 'apple' | 'orange' | 'mango' | string;
export function drawTreeFruit(ctx: CanvasRenderingContext2D, x: number, y: number, r = 6, kind: TreeFruitKind = 'apple') {
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ell(ctx, x + 1, y + r * 0.9, r * 0.8, r * 0.3);
  if (kind === 'orange') {
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r + 1);
    g.addColorStop(0, '#ffe0b2'); g.addColorStop(0.5, '#fb8c00'); g.addColorStop(1, '#ef6c00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    // lỗ cam
    ctx.fillStyle = '#bf360c'; ctx.beginPath(); ctx.arc(x, y - r + 1, 1.4, 0, 7); ctx.fill();
  } else if (kind === 'mango') {
    const g = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, r + 2);
    g.addColorStop(0, '#fff59d'); g.addColorStop(0.55, '#ffb300'); g.addColorStop(1, '#f4511e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r * 1.1, 0.3, 0, 7); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r + 1);
    g.addColorStop(0, '#ffcdd2'); g.addColorStop(0.5, '#e53935'); g.addColorStop(1, '#b71c1c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // cuống + lá + bóng
  ctx.strokeStyle = '#33691e'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + 1, y - r - 3); ctx.stroke();
  ctx.fillStyle = '#43a047';
  ctx.beginPath(); ctx.ellipse(x + 3.5, y - r - 2.5, 3, 1.6, 0.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ell(ctx, x - r * 0.35, y - r * 0.3, r * 0.28, r * 0.18);
}

/** Bí ngô trang trí shop (thay 🎃) */
export function drawPumpkin(ctx: CanvasRenderingContext2D, x: number, y: number, s = 18) {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x, y + s * 0.42, s * 0.5, 3);
  const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2);
  g.addColorStop(0, '#ffb74d'); g.addColorStop(1, '#ef6c00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.42, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.42); ctx.quadraticCurveTo(x - 4, y, x, y + s * 0.42); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.42); ctx.quadraticCurveTo(x + 4, y, x, y + s * 0.42); ctx.stroke();
  ctx.fillStyle = '#33691e'; ctx.fillRect(x - 1.5, y - s * 0.42 - 5, 3, 6);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ell(ctx, x - s * 0.2, y - s * 0.15, 2.6, 1.8);
}

/** Mặt trời / mặt trăng vẽ tay (thay ☀️🌙) */
export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r = 15, t = 0) {
  const rot = t * 0.2;
  ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
    ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r + 1);
  g.addColorStop(0, '#fffde7'); g.addColorStop(0.6, '#ffeb3b'); g.addColorStop(1, '#ff9800');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  // mặt cười
  ctx.fillStyle = '#e65100';
  ctx.beginPath(); ctx.arc(x - 5, y - 2, 1.8, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 2, 1.8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(x, y + 1, 6, 0.3, Math.PI - 0.3); ctx.stroke();
}
export function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r = 14) {
  ctx.fillStyle = '#fffde7';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(8,8,50,.28)';
  ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4, y + 2, 2.2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 1, y + 6, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,253,231,.35)';
  ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#fffde7';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}

/** Zzz khi pet ngủ (thay 💤) */
export function drawSleepZ(ctx: CanvasRenderingContext2D, x: number, y: number, s = 13, t = 0) {
  const bob = Math.sin(t * 3) * 1.5;
  ctx.font = `bold ${s}px 'Be Vietnam Pro', monospace`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
  const zs: [number, number, number, string][] = [
    [0, 0, 1, '#90caf9'],
    [9, -9 + bob, 0.8, '#64b5f6'],
    [16, -17 + bob * 1.4, 0.62, '#42a5f5'],
  ];
  for (const [dx, dy, sc, col] of zs) {
    ctx.font = `bold ${Math.round(s * sc)}px 'Be Vietnam Pro', monospace`;
    ctx.strokeText('Z', x + dx, y + dy);
    ctx.fillStyle = col;
    ctx.fillText('Z', x + dx, y + dy);
  }
}

/** Ngôi sao vàng (thay ★ text) */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r = 7) {
  ctx.fillStyle = '#ffca28';
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ell(ctx, x - r * 0.2, y - r * 0.2, r * 0.16, r * 0.12);
}

/** Rau mầm generic khi crop lạ (fallback, thay emoji crop) */
export function drawCropGeneric(ctx: CanvasRenderingContext2D, x: number, y: number, s = 18, t = 0) {
  drawSprout(ctx, x, y + 4, s + 6, t);
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.28, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.12, 0, 7); ctx.fill();
}
