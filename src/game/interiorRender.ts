// ===== Vẽ NỘI THẤT 6 nhà: sàn/tường/đồ đạc/NPC/particle, phong cách anime =====
// Tái dùng drawPlayerDetailed (người chơi) + depthScale để cùng chất với farm/town.
import { INTERIORS, SLOT_SYMBOLS, type InteriorDef } from './interiors';
import { drawBikeSide, drawCarSide, drawMotoSide, drawPlayerDetailed } from './render';
import { CARS, SHIRTS, shirtColorOf } from './data';

export interface InteriorPlayer {
  x: number; y: number; dir: 1 | -1; moving: boolean; name: string;
}
interface RenderOpts {
  player: InteriorPlayer;
  avatar: number;
  outfit?: Record<string, string>;
  /** xe đang lái (gara cho lái xe vào trong) */
  carColor?: string | null;
  carKind?: string | null;
  carId?: string | null;
  stageColor: string;
  /** đêm hay ngày (cửa sổ đổi màu kính theo) */
  night: boolean;
}

// ---------- helpers ----------
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}
const OUT = '#2b2117'; // viền anime dùng chung

// ---------- particle: tim/nốt nhạc/sao/hoa/xu/Zzz ----------
interface P { x: number; y: number; vx: number; vy: number; at: number; kind: string; txt: string }
let parts: P[] = [];
export function spawnBurst(x: number, y: number, kind: 'heart' | 'note' | 'spark' | 'flower' | 'coin' | 'zzz' | 'angry' | 'drop') {
  const TXT: Record<string, string[]> = {
    heart: ['❤️', '💕', '💗'], note: ['🎵', '🎶', '♫'], spark: ['✨', '🌟', '💫'],
    flower: ['🌸', '🌼', '💐'], coin: ['🪙', '✨', '💰'], zzz: ['💤', '💤', 'z'],
    angry: ['💢', '😾'], drop: ['💧', '💦'],
  };
  const now = performance.now() / 1000;
  const arr = TXT[kind];
  for (let i = 0; i < 10; i++) {
    parts.push({
      x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 40, vy: -50 - Math.random() * 60,
      at: now + Math.random() * 0.25, kind, txt: arr[i % arr.length],
    });
  }
  if (parts.length > 220) parts = parts.slice(-220);
}
// rung đồ khi vừa chạm (nảy 0.4s)
const pulseAt: Record<string, number> = {};
export function furnPulse(id: string) { pulseAt[id] = performance.now() / 1000; }
// fan vỗ tay + mèo khoái (mắt híp) sau khi diễn/vuốt
let cheerUntil = 0;
export function cheerFans() { cheerUntil = performance.now() / 1000 + 4; }
const petGlow: Record<string, number> = {};
export function petCat(id: string) { petGlow[id] = performance.now() / 1000 + 4; }

// ---------- NPC chibi ----------
const NPC_STYLE: Record<string, { skin: string; shirt: string; hair: string; hat?: string }> = {
  elder: { skin: '#f2c89b', shirt: '#5b7fa6', hair: '#e8e8e8' },
  barista: { skin: '#f2c89b', shirt: '#c65b7c', hair: '#5a3a22' },
  clerk: { skin: '#f7d7a8', shirt: '#7c5fc0', hair: '#2b2b2b' },
  coba: { skin: '#f2c89b', shirt: '#3f9e4d', hair: '#3a3a3a' },
  chutam: { skin: '#e8b98a', shirt: '#8a6f4d', hair: '#6b6b6b', hat: 'leaf' },
  fan: { skin: '#f2c89b', shirt: '#e8912d', hair: '#2b2b2b' },
  dealer: { skin: '#f2c89b', shirt: '#23232e', hair: '#1a1a1a' },
  guest: { skin: '#f7d7a8', shirt: '#2e7d6e', hair: '#4a3226' },
  mechanic: { skin: '#e8b98a', shirt: '#3f6fb5', hair: '#2b2b2b' },
};

function drawHuman(ctx: CanvasRenderingContext2D, x: number, y: number, look: string, name: string, t: number, seed: number) {
  const st = NPC_STYLE[look] ?? NPC_STYLE.fan;
  const bob = Math.sin(t * 2 + seed) * 2;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x, y + 2, 20, 6);
  // thân
  ctx.fillStyle = OUT; rr(ctx, x - 14, y - 44 + bob, 28, 32, 9); ctx.fill();
  ctx.fillStyle = st.shirt; rr(ctx, x - 11, y - 41 + bob, 22, 26, 7); ctx.fill();
  // tay (fan vỗ khi cheer)
  const cheering = look === 'fan' && performance.now() / 1000 < cheerUntil;
  ctx.fillStyle = st.skin;
  if (cheering) {
    const cl = Math.sin(t * 14 + seed) * 8;
    ell(ctx, x - 16, y - 30 + cl, 5, 5); ell(ctx, x + 16, y - 30 - cl, 5, 5);
  } else {
    ell(ctx, x - 15, y - 28 + bob, 5, 7); ell(ctx, x + 15, y - 28 + bob, 5, 7);
  }
  // đầu
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y - 54 + bob, 14, 0, 7); ctx.fill();
  ctx.fillStyle = st.skin; ctx.beginPath(); ctx.arc(x, y - 54 + bob, 11.5, 0, 7); ctx.fill();
  // tóc / mũ
  ctx.fillStyle = st.hair;
  if (look === 'elder') { ctx.beginPath(); ctx.arc(x, y - 58 + bob, 11, Math.PI, 0); ctx.fill(); }
  else if (look === 'coba') { ctx.beginPath(); ctx.arc(x, y - 62 + bob, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 56 + bob, 11.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); }
  else if (look === 'chutam' && st.hat === 'leaf') { ell(ctx, x, y - 64 + bob, 16, 5); }
  else if (look === 'mechanic') {
    // mũ bảo hộ vàng + vết dầu trên má thợ máy
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(x, y - 57 + bob, 11, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ell(ctx, x, y - 54 + bob, 15, 3.5); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = 'rgba(40,40,40,.7)';
    ctx.beginPath(); ctx.arc(x + 6, y - 50 + bob, 1.8, 0, 7); ctx.fill();
  }
  else { ctx.beginPath(); ctx.arc(x, y - 57 + bob, 11, Math.PI, 0); ctx.fill(); }
  // mặt (chớp mắt theo thời gian)
  const blink = (t * 0.7 + seed) % 3.4 < 0.14;
  if (blink) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 53 + bob); ctx.lineTo(x - 2, y - 53 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, y - 53 + bob); ctx.lineTo(x + 6, y - 53 + bob); ctx.stroke();
  } else {
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x - 4, y - 53 + bob, 1.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y - 53 + bob, 1.6, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#7a4a2b'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x, y - 50 + bob, 3.4, 0.2, Math.PI - 0.2); ctx.stroke();
  if (look === 'dealer') {
    // nơ đỏ + áo vest + lá bài xào trên tay
    ctx.fillStyle = '#e04848';
    ctx.beginPath(); ctx.moveTo(x, y - 42 + bob); ctx.lineTo(x - 7, y - 45 + bob); ctx.lineTo(x - 7, y - 39 + bob); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 42 + bob); ctx.lineTo(x + 7, y - 45 + bob); ctx.lineTo(x + 7, y - 39 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(x, y - 42 + bob, 2, 0, 7); ctx.fill();
    // lá bài lật qua lật lại
    const flip = Math.abs(Math.sin(t * 3 + seed));
    const cw = 4 + flip * 8;
    ctx.fillStyle = '#fff8e1'; rr(ctx, x + 16 - cw / 2, y - 36 + bob, cw, 14, 2); ctx.fill();
    if (flip > 0.5) { ctx.fillStyle = '#e04848'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('A', x + 16, y - 25 + bob); ctx.textAlign = 'left'; }
  }
  if (look === 'guest') {
    // ly nước trên tay + má hồng (đang vui)
    ctx.fillStyle = '#9fd8ff'; rr(ctx, x + 13, y - 34 + bob, 7, 9, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,130,140,.6)'; ell(ctx, x - 8, y - 49 + bob, 3, 2); ell(ctx, x + 8, y - 49 + bob, 3, 2);
  }
  if (look === 'elder') { // gậy + Zzz ngủ gật
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 18, y - 30); ctx.lineTo(x + 22, y + 2); ctx.stroke();
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#9db8dd';
    const z = (t * 0.7 + seed) % 1;
    ctx.fillText('💤', x + 16, y - 70 - z * 22);
  }
  // bảng tên
  ctx.font = 'bold 12px sans-serif';
  const w = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(20,12,6,.72)'; rr(ctx, x - w / 2 - 6, y - 100 + bob, w + 12, 18, 9); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.fillText(name, x, y - 86 + bob);
  ctx.textAlign = 'left';
}

function drawCatNpc(ctx: CanvasRenderingContext2D, x: number, y: number, fur: string, name: string, t: number, seed: number, id: string) {
  const glow = (petGlow[id] ?? 0) > performance.now() / 1000;
  const breathe = Math.sin(t * 3 + seed) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, x, y + 2, 22, 6);
  // đuôi ve vẩy
  const wag = Math.sin(t * (glow ? 9 : 3) + seed) * 10;
  ctx.strokeStyle = fur; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 16, y - 8); ctx.quadraticCurveTo(x - 34, y - 6 + wag, x - 30, y - 26 + wag); ctx.stroke();
  // thân ngồi
  ctx.fillStyle = OUT; ell(ctx, x, y - 18 + breathe * 0.4, 20, 22);
  ctx.fillStyle = fur; ell(ctx, x, y - 18 + breathe * 0.4, 17, 19);
  // đầu
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y - 42, 15, 0, 7); ctx.fill();
  ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(x, y - 42, 12.5, 0, 7); ctx.fill();
  // tai
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.moveTo(x - 11, y - 50); ctx.lineTo(x - 8, y - 62); ctx.lineTo(x - 2, y - 51); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 11, y - 50); ctx.lineTo(x + 8, y - 62); ctx.lineTo(x + 2, y - 51); ctx.closePath(); ctx.fill();
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.moveTo(x - 9.5, y - 50.5); ctx.lineTo(x - 7.5, y - 59); ctx.lineTo(x - 3.5, y - 51); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 9.5, y - 50.5); ctx.lineTo(x + 7.5, y - 59); ctx.lineTo(x + 3.5, y - 51); ctx.closePath(); ctx.fill();
  // mắt híp khi được vuốt
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  if (glow) {
    ctx.beginPath(); ctx.arc(x - 5, y - 42, 3, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 5, y - 42, 3, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,150,.6)'; ell(ctx, x - 8, y - 37, 3, 2); ell(ctx, x + 8, y - 37, 3, 2);
  } else {
    const catBlink = (t * 0.6 + seed) % 4 < 0.14;
    if (catBlink) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x - 7, y - 43); ctx.lineTo(x - 3, y - 43); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3, y - 43); ctx.lineTo(x + 7, y - 43); ctx.stroke();
    } else {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(x - 5, y - 43, 1.8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 5, y - 43, 1.8, 0, 7); ctx.fill();
    }
  }
  ctx.font = 'bold 12px sans-serif';
  const w = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(20,12,6,.72)'; rr(ctx, x - w / 2 - 6, y - 82, w + 12, 18, 9); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.fillText(name, x, y - 68);
  ctx.textAlign = 'left';
}

// ---------- đồ đạc ----------
function drawFurn(ctx: CanvasRenderingContext2D, d: InteriorDef, f: InteriorDef['furns'][number], t: number, stageColor: string) {
  const X = f.x, Y = f.y;
  const age = performance.now() / 1000 - (pulseAt[d.id + ':' + f.id] ?? -99);
  const pop = age < 0.4 ? 1 + 0.07 * Math.sin((age / 0.4) * Math.PI) : 1;
  ctx.save();
  ctx.translate(X + f.w / 2, Y + f.h);
  ctx.scale(pop, pop);
  ctx.translate(-(X + f.w / 2), -(Y + f.h));
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, X + f.w / 2, Y + f.h - 2, f.w / 2, 8);
  switch (f.look) {
    case 'counter': {
      ctx.fillStyle = OUT; rr(ctx, X, Y + 20, f.w, f.h - 20, 8); ctx.fill();
      ctx.fillStyle = '#a06a35'; rr(ctx, X + 4, Y + 24, f.w - 8, f.h - 28, 6); ctx.fill();
      ctx.fillStyle = '#7c4f24';
      for (let i = 1; i < 4; i++) ctx.fillRect(X + 8, Y + 24 + ((f.h - 28) / 4) * i, f.w - 16, 3);
      ctx.fillStyle = OUT; rr(ctx, X - 6, Y, f.w + 12, 30, 8); ctx.fill();
      ctx.fillStyle = '#e8c98a'; rr(ctx, X - 2, Y + 4, f.w + 4, 22, 6); ctx.fill();
      // ly cà phê bốc khói
      ctx.fillStyle = '#fff'; rr(ctx, X + 30, Y - 22, 22, 20, 4); ctx.fill();
      ctx.fillStyle = '#6f4a2a'; rr(ctx, X + 33, Y - 19, 16, 8, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const sx = X + 36 + i * 9 + Math.sin(t * 2 + i) * 2;
        ctx.beginPath(); ctx.moveTo(sx, Y - 24); ctx.quadraticCurveTo(sx + 4, Y - 34, sx, Y - 42); ctx.stroke();
      }
      // menu treo
      ctx.fillStyle = OUT; rr(ctx, X + f.w - 110, Y - 44, 100, 40, 6); ctx.fill();
      ctx.fillStyle = '#2b2117'; rr(ctx, X + f.w - 106, Y - 40, 92, 32, 4); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('MENU ☕', X + f.w - 96, Y - 18);
      break;
    }
    case 'table': {
      ctx.fillStyle = OUT; ell(ctx, X + f.w / 2, Y + f.h - 14, f.w / 2, 14); ctx.fill();
      ctx.fillStyle = '#c98f4e'; ell(ctx, X + f.w / 2, Y + f.h - 18, f.w / 2 - 4, 11);
      ctx.fillStyle = '#7c4f24'; ctx.fillRect(X + f.w / 2 - 8, Y + 30, 16, f.h - 50);
      // khăn + tách trà
      ctx.fillStyle = '#fff5e0'; ell(ctx, X + f.w / 2, Y + f.h - 20, f.w / 2 - 14, 8);
      ctx.fillStyle = '#fff'; ell(ctx, X + f.w / 2 - 20, Y + f.h - 26, 10, 6); ctx.fill();
      ctx.fillStyle = '#c65b7c'; ell(ctx, X + f.w / 2 + 22, Y + f.h - 26, 10, 6); ctx.fill();
      break;
    }
    case 'stove': {
      // thân bếp gạch
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, f.h, 10); ctx.fill();
      ctx.fillStyle = '#9a5a3a'; rr(ctx, X + 4, Y + 4, f.w - 8, f.h - 8, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,15,.5)'; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X + 6, Y + (f.h / 4) * i); ctx.lineTo(X + f.w - 6, Y + (f.h / 4) * i); ctx.stroke(); }
      // cửa lửa
      ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 - 45, Y + f.h - 62, 90, 56, 10); ctx.fill();
      ctx.fillStyle = '#2b1608'; rr(ctx, X + f.w / 2 - 39, Y + f.h - 56, 78, 44, 8); ctx.fill();
      const fl = 0.7 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.08;
      ctx.fillStyle = '#ff7a1f'; ell(ctx, X + f.w / 2, Y + f.h - 30, 26 * fl, 15 * fl);
      ctx.fillStyle = '#ffd24d'; ell(ctx, X + f.w / 2, Y + f.h - 28, 15 * fl, 9 * fl);
      // nồi trên bếp + hơi nóng
      ctx.fillStyle = OUT; ell(ctx, X + f.w / 2, Y - 2, 46, 12); ctx.fill();
      ctx.fillStyle = '#4a4a55'; ell(ctx, X + f.w / 2, Y - 6, 42, 10);
      ctx.fillStyle = '#6b6b78'; ell(ctx, X + f.w / 2, Y - 9, 42, 6);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const sx = X + f.w / 2 - 20 + i * 20 + Math.sin(t * 2.4 + i * 2) * 3;
        ctx.beginPath(); ctx.moveTo(sx, Y - 14); ctx.quadraticCurveTo(sx + 5, Y - 28, sx, Y - 40); ctx.stroke();
      }
      break;
    }
    case 'cabinet': {
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, f.h, 10); ctx.fill();
      ctx.fillStyle = '#b97f2a'; rr(ctx, X + 4, Y + 4, f.w - 8, f.h - 8, 8); ctx.fill();
      // kính trưng bánh
      ctx.fillStyle = 'rgba(200,235,255,.85)'; rr(ctx, X + 14, Y + 14, f.w - 28, f.h - 60, 6); ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['#ff9ec6', '#ffd24d', '#9be08a'][i];
        ell(ctx, X + 40 + i * 48, Y + f.h - 62, 18, 12);
        ctx.fillStyle = '#fff'; ell(ctx, X + 40 + i * 48, Y + f.h - 68, 18, 6); ctx.fill();
      }
      ctx.fillStyle = '#7c4f24'; ctx.font = 'bold 15px sans-serif';
      ctx.fillText('🍪 TỦ BÁNH', X + 34, Y + f.h - 14);
      break;
    }
    case 'piano': {
      ctx.fillStyle = OUT; rr(ctx, X, Y + 20, f.w, f.h - 20, 10); ctx.fill();
      ctx.fillStyle = '#3a3a48'; rr(ctx, X + 4, Y + 24, f.w - 8, f.h - 28, 8); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, X + 14, Y + f.h - 52, f.w - 28, 26, 4); ctx.fill();
      ctx.fillStyle = '#222';
      for (let i = 0; i < 12; i++) ctx.fillRect(X + 22 + i * ((f.w - 44) / 12), Y + f.h - 52, 5, 14);
      ctx.fillStyle = '#222'; ctx.fillRect(X + 20, Y + 30, 10, f.h - 40); ctx.fillRect(X + f.w - 30, Y + 30, 10, f.h - 40);
      // nốt nhạc bay
      ctx.font = '18px sans-serif'; ctx.fillStyle = '#ffd24d';
      const n = Math.floor(t * 1.5) % 3;
      ctx.fillText(['🎵', '🎶', '♫'][n], X + f.w / 2 - 10 + Math.sin(t * 2) * 8, Y - 6 - (t * 8 % 20));
      break;
    }
    case 'rack': {
      ctx.strokeStyle = OUT; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(X + 10, Y + f.h); ctx.lineTo(X + 10, Y); ctx.lineTo(X + f.w - 10, Y); ctx.lineTo(X + f.w - 10, Y + f.h); ctx.stroke();
      const cols = ['#e75480', '#3b82f6', '#3f9e4d', '#ffd24d', '#b45309'];
      for (let i = 0; i < 5; i++) {
        const hx = X + 30 + i * ((f.w - 60) / 4);
        ctx.fillStyle = cols[i];
        rr(ctx, hx - 16, Y + 14 + (i % 2) * 6, 32, 52, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, hx - 16, Y + 14 + (i % 2) * 6, 10, 52, 5); ctx.fill();
      }
      break;
    }
    case 'mirror': {
      ctx.fillStyle = OUT; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 40); ctx.fill();
      ctx.fillStyle = '#c9759a'; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 40); ctx.fill();
      const g = ctx.createLinearGradient(X, Y, X + f.w, Y + f.h);
      g.addColorStop(0, '#cdeffd'); g.addColorStop(0.5, '#f4fbff'); g.addColorStop(1, '#aedcf5');
      ctx.fillStyle = g; rr(ctx, X, Y, f.w, f.h, 34); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.moveTo(X + 18, Y + f.h - 10); ctx.lineTo(X + 44, Y + 10); ctx.lineTo(X + 58, Y + 10); ctx.lineTo(X + 32, Y + f.h - 10); ctx.closePath(); ctx.fill();
      ctx.font = '22px sans-serif'; ctx.fillText('✨', X + f.w - 34, Y + 30 + Math.sin(t * 2) * 3);
      break;
    }
    case 'mannequin': {
      ctx.strokeStyle = OUT; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(X + f.w / 2, Y + f.h - 8); ctx.lineTo(X + f.w / 2, Y + 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X + f.w / 2 - 24, Y + f.h - 8); ctx.lineTo(X + f.w / 2 + 24, Y + f.h - 8); ctx.stroke();
      const sway = Math.sin(t * 1.4) * 4;
      ctx.fillStyle = OUT; ell(ctx, X + f.w / 2 + sway, Y + 30, 13, 13); ctx.fill();
      ctx.fillStyle = '#e8c39a'; ell(ctx, X + f.w / 2 + sway, Y + 30, 10, 10);
      ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 - 22 + sway, Y + 42, 44, 70, 14); ctx.fill();
      ctx.fillStyle = (Math.floor(t * 0.5) % 4 === 0) ? '#e75480' : (Math.floor(t * 0.5) % 4 === 1 ? '#3b82f6' : (Math.floor(t * 0.5) % 4 === 2 ? '#3f9e4d' : '#ffd24d'));
      rr(ctx, X + f.w / 2 - 18 + sway, Y + 46, 36, 62, 12); ctx.fill();
      break;
    }
    case 'board': {
      ctx.fillStyle = OUT; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 8); ctx.fill();
      ctx.fillStyle = '#7c4f24'; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 8); ctx.fill();
      ctx.fillStyle = '#fff8dc'; rr(ctx, X, Y, f.w, f.h, 5); ctx.fill();
      ctx.fillStyle = '#b3392e'; ctx.font = 'bold 16px sans-serif';
      ctx.fillText('📌 VIỆC NGÀY', X + 70, Y + 26);
      ctx.fillStyle = '#5a7fa6'; ctx.font = '13px sans-serif';
      ctx.fillText('• Thu hoạch  • Câu cá  • Cho ăn', X + 30, Y + 50);
      break;
    }
    case 'donate': {
      ctx.fillStyle = OUT; rr(ctx, X, Y + 30, f.w, f.h - 30, 10); ctx.fill();
      ctx.fillStyle = '#b3392e'; rr(ctx, X + 4, Y + 34, f.w - 8, f.h - 38, 8); ctx.fill();
      ctx.fillStyle = '#7c241d'; rr(ctx, X + 4, Y + 34, f.w - 8, 26, 8); ctx.fill();
      ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 - 35, Y, 70, 44, 8); ctx.fill();
      ctx.fillStyle = '#ffd24d'; rr(ctx, X + f.w / 2 - 30, Y + 5, 60, 34, 6); ctx.fill();
      ctx.fillStyle = '#2b2117'; ctx.font = 'bold 15px sans-serif';
      ctx.fillText('GÓP LÀNG', X + f.w / 2 - 34, Y + 28);
      ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText('❤️', X + f.w / 2 - 12, Y + 96 + Math.sin(t * 3) * 3);
      break;
    }
    case 'stageplat': {
      ctx.fillStyle = OUT; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 10); ctx.fill();
      ctx.fillStyle = '#8a5a2e'; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 10); ctx.fill();
      ctx.fillStyle = '#a06a35';
      for (let i = 0; i < 8; i++) ctx.fillRect(X - 2, Y + i * ((f.h + 4) / 8), f.w + 4, 3);
      // rèm 2 bên
      ctx.fillStyle = '#b3392e';
      rr(ctx, X - 6, Y - 40, 44, f.h + 40, 8); ctx.fill();
      rr(ctx, X + f.w - 38, Y - 40, 44, f.h + 40, 8); ctx.fill();
      // mic giữa
      ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(X + f.w / 2, Y + 60); ctx.lineTo(X + f.w / 2, Y + 10); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(X + f.w / 2, Y, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#9db8dd'; ctx.beginPath(); ctx.arc(X + f.w / 2, Y, 8, 0, 7); ctx.fill();
      // chùm sáng theo màu đèn
      const beam = ctx.createLinearGradient(0, Y - 90, 0, Y + f.h);
      beam.addColorStop(0, stageColor + 'aa'); beam.addColorStop(1, stageColor + '11');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(X + f.w / 2 - 40, Y - 90); ctx.lineTo(X + f.w / 2 + 40, Y - 90);
      ctx.lineTo(X + f.w / 2 + 130, Y + f.h); ctx.lineTo(X + f.w / 2 - 130, Y + f.h); ctx.closePath(); ctx.fill();
      break;
    }
    case 'lights': {
      ctx.strokeStyle = OUT; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(X + 10, Y + f.h); ctx.lineTo(X + 10, Y + 10); ctx.lineTo(X + f.w - 10, Y + 10); ctx.stroke();
      const cols = ['#ff5b5b', stageColor, '#5bff8a', '#5bb8ff'];
      for (let i = 0; i < 4; i++) {
        const lx = X + 18 + i * ((f.w - 36) / 3);
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(lx, Y + 22, 11, 0, 7); ctx.fill();
        ctx.fillStyle = (Math.floor(t * 2 + i) % 2 === 0) ? cols[i] : '#555';
        ctx.beginPath(); ctx.arc(lx, Y + 22, 8, 0, 7); ctx.fill();
      }
      break;
    }
    case 'giftbox': {
      ctx.fillStyle = OUT; rr(ctx, X, Y + 40, f.w, f.h - 40, 8); ctx.fill();
      ctx.fillStyle = '#c65b7c'; rr(ctx, X + 4, Y + 44, f.w - 8, f.h - 48, 6); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(X + f.w / 2 - 8, Y + 44, 16, f.h - 48);
      ctx.font = '24px sans-serif';
      ctx.fillText('🌸', X + 12, Y + 30 + Math.sin(t * 2) * 3);
      ctx.fillText('💐', X + f.w - 40, Y + 26 - Math.sin(t * 2) * 3);
      break;
    }
    case 'junk': {
      ctx.fillStyle = '#8a7a5f';
      ell(ctx, X + f.w * 0.3, Y + f.h - 20, 70, 44);
      ell(ctx, X + f.w * 0.65, Y + f.h - 26, 80, 52);
      ctx.fillStyle = '#6e6250';
      ell(ctx, X + f.w * 0.45, Y + f.h - 50, 55, 36);
      // đồ lẫn: TV, bánh xe, nồi
      ctx.fillStyle = OUT; rr(ctx, X + 30, Y + f.h - 110, 56, 44, 6); ctx.fill();
      ctx.fillStyle = '#9db8dd'; rr(ctx, X + 35, Y + f.h - 105, 46, 34, 4); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(X + f.w - 70, Y + f.h - 70, 24, 0, 7); ctx.stroke();
      ctx.fillStyle = '#4a4a55'; ell(ctx, X + f.w * 0.5, Y + f.h - 84, 22, 10);
      const gl = (Math.sin(t * 2.2) + 1) / 2;
      ctx.fillStyle = `rgba(255,210,77,${0.25 + gl * 0.4})`;
      ctx.font = '20px sans-serif'; ctx.fillText('✨', X + f.w * 0.55, Y + f.h - 100);
      break;
    }
    case 'bench': {
      ctx.fillStyle = OUT; rr(ctx, X, Y + 40, f.w, f.h - 40, 8); ctx.fill();
      ctx.fillStyle = '#7c5a36'; rr(ctx, X + 4, Y + 44, f.w - 8, f.h - 48, 6); ctx.fill();
      // đe + búa + mồi mẫu
      ctx.fillStyle = '#4a4a55'; rr(ctx, X + 30, Y + 20, 60, 26, 4); ctx.fill();
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 7;
      const hb = Math.sin(t * 6) > 0.6 ? -8 : 0;
      ctx.beginPath(); ctx.moveTo(X + f.w - 80, Y + 44); ctx.lineTo(X + f.w - 50, Y + 10 + hb); ctx.stroke();
      ctx.fillStyle = '#ff8a5b'; ell(ctx, X + 130, Y + 52, 14, 8);
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('🔨 BÀN CHẾ', X + f.w / 2 - 40, Y + f.h - 12);
      break;
    }
    case 'shelf':
    case 'bedbox': {
      const isShelf = f.look === 'shelf';
      ctx.fillStyle = OUT; rr(ctx, X, Y + (isShelf ? 10 : 20), f.w, f.h - (isShelf ? 10 : 20), 8); ctx.fill();
      ctx.fillStyle = isShelf ? '#7c5a36' : '#a06a35';
      rr(ctx, X + 4, Y + (isShelf ? 14 : 24), f.w - 8, f.h - (isShelf ? 18 : 28), 6); ctx.fill();
      if (isShelf) {
        ctx.fillStyle = '#5a4028'; ctx.fillRect(X + 8, Y + f.h / 2, f.w - 16, 6);
        ctx.font = '22px sans-serif';
        ctx.fillText('📻', X + 18, Y + 44); ctx.fillText('🏺', X + 70, Y + 44);
        ctx.fillText('📼', X + 18, Y + 88); ctx.fillText('🪆', X + 70, Y + 88);
        ctx.fillText('🚲', X + 122, Y + 88);
      } else {
        ctx.fillStyle = '#fff'; ell(ctx, X + 45, Y + 48, 16, 12); ctx.fill();
        ctx.fillStyle = '#9db8dd'; ell(ctx, X + 100, Y + 48, 16, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X + 8, Y + 70); ctx.lineTo(X + f.w - 8, Y + 70); ctx.stroke();
      }
      break;
    }
    case 'trophy': {
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, f.h, 8); ctx.fill();
      ctx.fillStyle = 'rgba(180,220,255,.8)'; rr(ctx, X + 4, Y + 4, f.w - 8, f.h - 8, 6); ctx.fill();
      ctx.font = '30px sans-serif';
      ctx.fillText('🏆', X + 30, Y + 62);
      ctx.fillText('🏆', X + 90, Y + 62 + Math.sin(t * 2) * 2);
      ctx.fillText('🏆', X + 150, Y + 62);
      break;
    }
    case 'cardtable': {
      // ghế + bàn bầu dục nỉ xanh + tụ bài + chip
      for (const gx of [0.2, 0.5, 0.8]) {
        const sx = X + f.w * gx;
        ctx.fillStyle = OUT; ell(ctx, sx, Y + f.h - 4, 15, 7); ctx.fill();
        ctx.fillStyle = '#7c4f21'; ell(ctx, sx, Y + f.h - 7, 13, 6);
      }
      ctx.fillStyle = OUT; ell(ctx, X + f.w / 2, Y + f.h / 2 + 8, f.w / 2 + 4, f.h / 2 - 2);
      ctx.fillStyle = '#5a3a1e'; ell(ctx, X + f.w / 2, Y + f.h / 2 + 8, f.w / 2 + 4, 10);
      ctx.fillStyle = '#0d6e3f'; ell(ctx, X + f.w / 2, Y + f.h / 2 + 4, f.w / 2, f.h / 2 - 8);
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(X + f.w / 2, Y + f.h / 2 + 4, f.w / 2 - 12, f.h / 2 - 18, 0, 0, 7); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const cxp = X + 42 + i * ((f.w - 84) / 2);
        ctx.save(); ctx.translate(cxp, Y + f.h / 2 + 2 + Math.sin(t * 2 + i * 2) * 2); ctx.rotate((i - 1) * 0.28);
        ctx.fillStyle = '#fff8e1'; rr(ctx, -9, -13, 18, 26, 3); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = '#e04848'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 5); ctx.textAlign = 'left';
        ctx.restore();
        ctx.fillStyle = ['#e04848', '#3b82f6', '#ffd24d'][i];
        ctx.beginPath(); ctx.arc(cxp + 16, Y + f.h - 26 - (i % 2) * 9, 7, 0, 7); ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
      if (Math.sin(t * 2.5) > 0.55) { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText('✨', X + f.w - 24, Y + 18); }
      break;
    }
    case 'boardgame': {
      // 2 ghế đẩu + bàn cờ: nửa caro, nửa cờ vua
      for (const gx of [0.18, 0.82]) {
        const sx = X + f.w * gx;
        ctx.fillStyle = OUT; rr(ctx, sx - 13, Y + f.h - 26, 26, 22, 5); ctx.fill();
        ctx.fillStyle = '#8b5a2b'; rr(ctx, sx - 10, Y + f.h - 23, 20, 16, 4); ctx.fill();
      }
      ctx.fillStyle = OUT; rr(ctx, X + 20, Y + 18, f.w - 40, f.h - 46, 8); ctx.fill();
      ctx.fillStyle = '#a9763b'; rr(ctx, X + 24, Y + 22, f.w - 48, f.h - 54, 6); ctx.fill();
      // bàn cờ caro mini 5x5
      const bx = X + 36, by = Y + 32, cell = 13;
      ctx.fillStyle = '#fff8e1'; ctx.fillRect(bx, by, cell * 5, cell * 5);
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      for (let k = 0; k <= 5; k++) {
        ctx.beginPath(); ctx.moveTo(bx + k * cell, by); ctx.lineTo(bx + k * cell, by + cell * 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, by + k * cell); ctx.lineTo(bx + cell * 5, by + k * cell); ctx.stroke();
      }
      ctx.fillStyle = '#e04848'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('X', bx + cell * 1.5, by + cell * 1.9); ctx.fillText('O', bx + cell * 3.5, by + cell * 3.9);
      ctx.fillStyle = '#23232e'; ctx.fillText('X', bx + cell * 2.5, by + cell * 2.9);
      ctx.textAlign = 'left';
      // 2 quân cờ vua mẫu
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#fff'; ctx.fillText('♞', X + f.w - 66, Y + 62);
      ctx.fillStyle = '#111'; ctx.fillText('♜', X + f.w - 40, Y + 62 + Math.sin(t * 2) * 2);
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('♟ CARO • CỜ', X + f.w / 2 - 42, Y + f.h - 8);
      break;
    }
    case 'slot': {
      // thân máy tím + 3 guồng quay + cần gạt + khay xu
      const sh = Math.sin(t * 5) > 0 ? 1 : 0;
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, f.h, 12); ctx.fill();
      const bg = ctx.createLinearGradient(0, Y, 0, Y + f.h);
      bg.addColorStop(0, '#6a3fb5'); bg.addColorStop(1, '#3b1d5e');
      ctx.fillStyle = bg; rr(ctx, X + 4, Y + 4, f.w - 8, f.h - 8, 10); ctx.fill();
      // bảng 777 nhấp nháy
      const blink = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('777', X + f.w / 2 - 14, Y + 34);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      // 3 ô guồng quay xoay liên tục
      for (let i = 0; i < 3; i++) {
        const rx = X + 22 + i * ((f.w - 44) / 3);
        ctx.fillStyle = OUT; rr(ctx, rx - 2, Y + 44, (f.w - 44) / 3 + 4, 52, 6); ctx.fill();
        ctx.fillStyle = '#fff8e1'; rr(ctx, rx, Y + 46, (f.w - 44) / 3, 48, 5); ctx.fill();
        const sym = SLOT_SYMBOLS[Math.floor(t * 4 + i * 2 + X) % SLOT_SYMBOLS.length];
        ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(sym, rx + (f.w - 44) / 6, Y + 82);
        ctx.textAlign = 'left';
      }
      // cần gạt (bóng đỏ nảy)
      ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X + f.w - 4, Y + 70); ctx.lineTo(X + f.w + 16, Y + 44 + sh * -14); ctx.stroke();
      ctx.fillStyle = '#e04848';
      ctx.beginPath(); ctx.arc(X + f.w + 16, Y + 40 + sh * -14, 9, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      // khay xu
      ctx.fillStyle = OUT; rr(ctx, X + 20, Y + f.h - 34, f.w - 40, 26, 8); ctx.fill();
      ctx.fillStyle = '#23232e'; rr(ctx, X + 24, Y + f.h - 30, f.w - 48, 18, 6); ctx.fill();
      ctx.fillStyle = '#ffd24d';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.ellipse(X + 44 + k * 24, Y + f.h - 21 + Math.sin(t * 3 + k) * 1.5, 6, 4, 0, 0, 7); ctx.fill();
      }
      if (Math.sin(t * 3) > 0.5) { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText('✨', X + 8, Y + 30); }
      break;
    }
    case 'bar': {
      // kệ rượu + quầy + ghế + biển neon BAR
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, 54, 8); ctx.fill();
      ctx.fillStyle = '#2a1a3e'; rr(ctx, X + 4, Y + 4, f.w - 8, 46, 6); ctx.fill();
      const cols = ['#e04848', '#3b82f6', '#43d17c', '#ffd24d'];
      for (let i = 0; i < 4; i++) {
        const bx = X + 26 + i * ((f.w - 52) / 3);
        ctx.fillStyle = cols[i];
        rr(ctx, bx - 8, Y + 12, 16, 26, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bx - 8, Y + 14, 5, 22);
        ctx.fillStyle = '#d9d9d9'; ctx.fillRect(bx - 3, Y + 6, 6, 7);
      }
      ctx.fillStyle = OUT; rr(ctx, X, Y + 60, f.w, f.h - 60, 8); ctx.fill();
      ctx.fillStyle = '#7c4f21'; rr(ctx, X + 4, Y + 64, f.w - 8, f.h - 68, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(X + 8, Y + 66, f.w - 16, 4);
      // 2 ly cocktail
      for (const gx of [0.3, 0.65]) {
        const lx = X + f.w * gx, ly = Y + 52;
        ctx.fillStyle = gx < 0.5 ? '#ff9ebb' : '#ffd24d';
        ctx.beginPath(); ctx.moveTo(lx - 8, ly); ctx.lineTo(lx + 8, ly); ctx.lineTo(lx, ly + 12); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
      }
      for (const gx of [0.25, 0.75]) {
        const sx = X + f.w * gx;
        ctx.fillStyle = OUT; rr(ctx, sx - 12, Y + f.h - 24, 24, 20, 5); ctx.fill();
        ctx.fillStyle = '#e04848'; rr(ctx, sx - 9, Y + f.h - 21, 18, 14, 4); ctx.fill();
      }
      const glow = 0.7 + 0.3 * Math.sin(t * 3);
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#ff5b8b'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🍹 BAR', X + f.w / 2, Y - 8);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      break;
    }
    case 'vault': {
      // quầy chip: két + chồng chip + biển hiệu vàng
      const pulse = 0.65 + 0.35 * Math.sin(t * 2.5);
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.ellipse(X + f.w / 2, Y + 10, f.w / 2, 16, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 - 66, Y - 22, 132, 30, 10); ctx.fill();
      ctx.fillStyle = '#2b2117'; rr(ctx, X + f.w / 2 - 61, Y - 18, 122, 22, 8); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★ QUẦY CHIP ★', X + f.w / 2, Y - 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = OUT; rr(ctx, X, Y + 34, f.w, f.h - 34, 8); ctx.fill();
      ctx.fillStyle = '#8a1f2e'; rr(ctx, X + 4, Y + 38, f.w - 8, f.h - 42, 6); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(X + 8, Y + 40, f.w - 16, 4);
      // 3 chồng chip
      const chipCols = ['#e04848', '#3b82f6', '#43d17c'];
      for (let i = 0; i < 3; i++) {
        const cxp = X + 44 + i * ((f.w - 88) / 2);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = chipCols[i];
          ctx.beginPath(); ctx.ellipse(cxp, Y + f.h - 22 - k * 9, 20, 7, 0, 0, 7); ctx.fill();
          ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(cxp, Y + f.h - 22 - 3 * 9, 10, 3.6, 0, 0, 7); ctx.fill();
      }
      // két sắt mini
      ctx.fillStyle = OUT; rr(ctx, X + f.w - 58, Y + f.h - 62, 44, 40, 6); ctx.fill();
      ctx.fillStyle = '#6a6a75'; rr(ctx, X + f.w - 54, Y + f.h - 58, 36, 32, 5); ctx.fill();
      ctx.fillStyle = '#d9d9d9';
      ctx.beginPath(); ctx.arc(X + f.w - 36, Y + f.h - 42, 7, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      break;
    }
    case 'orderboard': {
      ctx.fillStyle = OUT; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 8); ctx.fill();
      ctx.fillStyle = '#2e7d32'; rr(ctx, X - 6, Y - 6, f.w + 12, f.h + 12, 8); ctx.fill();
      ctx.fillStyle = '#fff8dc'; rr(ctx, X, Y, f.w, f.h, 5); ctx.fill();
      ctx.fillStyle = '#2e7d32'; ctx.font = 'bold 16px sans-serif';
      ctx.fillText('📦 ĐẶT HÀNG', X + 22, Y + 28);
      ctx.fillStyle = '#5a7fa6'; ctx.font = '13px sans-serif';
      ctx.fillText('• Giao nông sản', X + 18, Y + 54);
      ctx.fillText('• Lấy thưởng to', X + 18, Y + 74);
      ctx.font = '22px sans-serif';
      ctx.fillText('🥕', X + 30, Y + 112 + Math.sin(t * 2) * 2);
      ctx.fillText('🥚', X + 70, Y + 112 - Math.sin(t * 2) * 2);
      ctx.fillText('🥛', X + 110, Y + 112 + Math.sin(t * 2) * 2);
      break;
    }
    case 'cattree': {
      // cây mèo: đế + trụ cào dây + 2 tầng + đồ chơi treo + mèo ngủ trên đỉnh
      ctx.fillStyle = OUT; rr(ctx, X + 8, Y + f.h - 22, f.w - 16, 18, 8); ctx.fill();
      ctx.fillStyle = '#8b5a2b'; rr(ctx, X + 12, Y + f.h - 18, f.w - 24, 11, 6); ctx.fill();
      const px = X + f.w / 2;
      ctx.fillStyle = OUT; ctx.fillRect(px - 11, Y + 30, 22, f.h - 52);
      ctx.fillStyle = '#c9a06a'; ctx.fillRect(px - 8, Y + 30, 16, f.h - 52);
      ctx.strokeStyle = 'rgba(120,80,40,.6)'; ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) {
        ctx.beginPath(); ctx.moveTo(px - 8, Y + 38 + k * 14); ctx.lineTo(px + 8, Y + 44 + k * 14); ctx.stroke();
      }
      // tầng giữa + tầng đỉnh (nệm)
      for (const [ty, ww] of [[Y + 96, 86], [Y + 26, 100]] as [number, number][]) {
        ctx.fillStyle = OUT; rr(ctx, px - ww / 2 - 3, ty - 3, ww + 6, 20, 9); ctx.fill();
        ctx.fillStyle = '#ff9ebb'; rr(ctx, px - ww / 2, ty, ww, 14, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 4; k++) ctx.fillRect(px - ww / 2 + 6 + k * 20, ty, 8, 14);
      }
      // đồ chơi treo đung đưa
      const sw = Math.sin(t * 2.4) * 8;
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px - 30, Y + 96); ctx.lineTo(px - 30 + sw, Y + 128); ctx.stroke();
      ctx.fillStyle = '#e04848';
      ctx.beginPath(); ctx.arc(px - 30 + sw, Y + 134, 7, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(px - 32 + sw, Y + 132, 2, 0, 7); ctx.fill();
      // mèo mướp cuộn tròn ngủ trên đỉnh
      const mx = px + 8, my = Y + 16 + Math.sin(t * 1.4) * 1;
      ctx.fillStyle = OUT; ell(ctx, mx, my, 24, 11); ctx.fill();
      ctx.fillStyle = '#e8963e'; ell(ctx, mx, my, 21, 9);
      ctx.strokeStyle = 'rgba(120,60,10,.5)'; ctx.lineWidth = 1.4;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(mx + k * 8, my - 8); ctx.lineTo(mx + k * 8, my + 8); ctx.stroke();
      }
      ctx.fillStyle = '#e8963e';
      ctx.beginPath(); ctx.arc(mx + 22, my - 2, 8, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(mx + 18, my - 2); ctx.lineTo(mx + 22, my - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + 24, my - 2); ctx.lineTo(mx + 28, my - 2); ctx.stroke();
      ctx.fillStyle = 'rgba(120,120,180,.8)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('z', mx + 32, my - 12 - ((t * 9) % 10));
      ctx.textAlign = 'left';
      break;
    }
    case 'tipjar': {
      // hũ thủy tinh + xu + khe bỏ tiền + bảng TIP
      ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 - 52, Y - 26, 104, 26, 8); ctx.fill();
      ctx.fillStyle = '#7c4f21'; rr(ctx, X + f.w / 2 - 47, Y - 22, 94, 18, 6); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TIP ❤', X + f.w / 2, Y - 8);
      ctx.textAlign = 'left';
      ctx.fillStyle = OUT; rr(ctx, X + 8, Y + 6, f.w - 16, f.h - 12, 12); ctx.fill();
      ctx.fillStyle = 'rgba(200,235,255,.75)'; rr(ctx, X + 12, Y + 10, f.w - 24, f.h - 20, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath(); ctx.moveTo(X + 22, Y + f.h - 8); ctx.lineTo(X + 34, Y + 12); ctx.lineTo(X + 42, Y + 12); ctx.lineTo(X + 30, Y + f.h - 8); ctx.closePath(); ctx.fill();
      // xu trong hũ (nhiều dần theo tip? vẽ tĩnh 5 xu + lấp lánh)
      for (let k = 0; k < 5; k++) {
        const cxp = X + 26 + (k * 37) % (f.w - 52), cyp = Y + f.h - 26 - (k % 2) * 10;
        ctx.fillStyle = '#ffd24d';
        ctx.beginPath(); ctx.ellipse(cxp, cyp, 7, 5, 0, 0, 7); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,70,0,.7)'; ctx.stroke();
      }
      // xu rơi vào hũ (bay theo thời gian)
      const fall = (t * 30) % 46;
      ctx.globalAlpha = Math.max(0, 1 - fall / 46);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.ellipse(X + f.w / 2 + Math.sin(t * 3) * 4, Y - 30 + fall, 5, 3.6, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.sin(t * 3) > 0.5) { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText('✨', X + f.w - 16, Y + 20); }
      break;
    }
    case 'wheel': {
      // chân chữ A + bánh xe 6 ô + kim + bóng đèn nhấp nháy
      const cx = X + f.w / 2, cy = Y + 62, rad = 52;
      ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 34, Y + f.h - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx + 34, Y + f.h - 4); ctx.stroke();
      ctx.strokeStyle = '#7c4f21'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - 34, Y + f.h - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx + 34, Y + f.h - 4); ctx.stroke();
      const cols = ['#e04848', '#ffd24d', '#3b82f6', '#43d17c', '#c58aff', '#ff9e2c'];
      const spin = t * 0.8;
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = cols[k];
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rad, spin + (k / 6) * Math.PI * 2, spin + ((k + 1) / 6) * Math.PI * 2);
        ctx.closePath(); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx - 14, cy - rad + 22); ctx.lineTo(cx + 2, cy - rad + 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#b3392e'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★', cx, cy + 4);
      ctx.textAlign = 'left';
      // kim chỉ
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy - rad - 14); ctx.lineTo(cx + 8, cy - rad - 14); ctx.lineTo(cx, cy - rad + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx - 4, cy - rad - 12); ctx.lineTo(cx + 4, cy - rad - 12); ctx.lineTo(cx, cy - rad - 2); ctx.closePath(); ctx.fill();
      // bóng đèn quanh viền
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const on = Math.floor(t * 3 + k) % 2 === 0;
        ctx.fillStyle = on ? '#fff59d' : '#6a6a75';
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (rad + 9), cy + Math.sin(a) * (rad + 9), 3.4, 0, 7); ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
      }
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('QUAY LÀ TRÚNG', cx, Y + f.h - 8);
      ctx.textAlign = 'left';
      break;
    }
    case 'bell': {
      // khung gỗ + chuông đồng đung đưa + sóng âm + bảng
      ctx.fillStyle = OUT; rr(ctx, X + 8, Y + 10, 16, f.h - 16, 6); ctx.fill();
      ctx.fillStyle = OUT; rr(ctx, X + f.w - 24, Y + 10, 16, f.h - 16, 6); ctx.fill();
      ctx.fillStyle = '#7c4f21'; rr(ctx, X + 11, Y + 13, 10, f.h - 22, 4); ctx.fill();
      ctx.fillStyle = '#7c4f21'; rr(ctx, X + f.w - 21, Y + 13, 10, f.h - 22, 4); ctx.fill();
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, 22, 8); ctx.fill();
      ctx.fillStyle = '#a9763b'; rr(ctx, X + 3, Y + 3, f.w - 6, 16, 6); ctx.fill();
      const sway = Math.sin(t * 2.2) * 0.22;
      const bx = X + f.w / 2, by = Y + 22;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(sway);
      const bg = ctx.createLinearGradient(-24, 0, 24, 0);
      bg.addColorStop(0, '#8a6d00'); bg.addColorStop(0.5, '#ffe9a8'); bg.addColorStop(1, '#8a6d00');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(24, 52); ctx.quadraticCurveTo(0, 60, -24, 52); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#7c5a00';
      ctx.beginPath(); ctx.arc(0, 56, 6, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.restore();
      // sóng âm lan ra
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.9 + k / 2) % 1;
        ctx.globalAlpha = 0.6 * (1 - p);
        ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(bx, by + 40, 20 + p * 34, -0.6, 0.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(bx, by + 40, 20 + p * 34, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = OUT; rr(ctx, bx - 52, Y + f.h - 26, 104, 22, 7); ctx.fill();
      ctx.fillStyle = '#fff3d6'; rr(ctx, bx - 48, Y + f.h - 23, 96, 16, 5); ctx.fill();
      ctx.fillStyle = '#b3392e'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CHUÔNG HỌP LÀNG', bx, Y + f.h - 10);
      ctx.textAlign = 'left';
      break;
    }
    case 'radio': {
      // đài gỗ + loa + núm dò + ăng-ten + nốt nhạc
      ctx.fillStyle = OUT; rr(ctx, X, Y + 20, f.w, f.h - 20, 10); ctx.fill();
      ctx.fillStyle = '#8b5a2b'; rr(ctx, X + 4, Y + 24, f.w - 8, f.h - 28, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(X + 8, Y + 26, f.w - 16, 4);
      // loa trái (lưới chấm)
      ctx.fillStyle = '#3a2a1a'; rr(ctx, X + 12, Y + 40, 56, f.h - 64, 8); ctx.fill();
      ctx.fillStyle = '#c9a06a';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        ctx.beginPath(); ctx.arc(X + 22 + c * 12, Y + 50 + r * 12, 2.4, 0, 7); ctx.fill();
      }
      // mặt sóng + kim dò chạy
      ctx.fillStyle = '#2b3a2a'; rr(ctx, X + 78, Y + 40, f.w - 90, 26, 5); ctx.fill();
      ctx.fillStyle = '#5bff8a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const wave = Math.sin(t * 6) > 0 ? '▂▄▆▄▂' : '▂▆▄▂▄';
      ctx.fillText(wave, X + 78 + (f.w - 90) / 2, Y + 58);
      ctx.textAlign = 'left';
      // 2 núm vặn
      for (const nx of [X + 96, X + 126]) {
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(nx, Y + f.h - 32, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#d9d9d9'; ctx.beginPath(); ctx.arc(nx, Y + f.h - 32, 7, 0, 7); ctx.fill();
        const na = t * 1.5 + nx;
        ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(nx, Y + f.h - 32); ctx.lineTo(nx + Math.cos(na) * 7, Y + f.h - 32 + Math.sin(na) * 7); ctx.stroke();
      }
      // ăng-ten
      ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X + f.w - 18, Y + 22); ctx.lineTo(X + f.w + 6, Y - 18); ctx.stroke();
      ctx.fillStyle = '#e04848';
      ctx.beginPath(); ctx.arc(X + f.w + 6, Y - 18, 4, 0, 7); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.font = '15px sans-serif';
      ctx.fillText('🎵', X + f.w - 30 + Math.sin(t * 2) * 4, Y + 6 - (t * 10 % 14));
      break;
    }
    case 'drum': {
      // trống chầu đỏ + đinh vàng + dây + 2 dùi (1 dùi gõ theo nhịp)
      for (const gx of [0.25, 0.75]) {
        const sx = X + f.w * gx;
        ctx.fillStyle = OUT; rr(ctx, sx - 9, Y + f.h - 26, 18, 22, 5); ctx.fill();
        ctx.fillStyle = '#7c4f21'; rr(ctx, sx - 6, Y + f.h - 23, 12, 16, 4); ctx.fill();
      }
      const dx = X + f.w / 2, dy = Y + 40, dw = 56, dh = 56;
      ctx.fillStyle = OUT; ell(ctx, dx, dy + dh, dw + 4, 12); ctx.fill();
      ctx.fillStyle = '#b3392e'; ell(ctx, dx, dy + dh, dw, 10);
      const dg = ctx.createLinearGradient(dx - dw, 0, dx + dw, 0);
      dg.addColorStop(0, '#7c241d'); dg.addColorStop(0.5, '#e04848'); dg.addColorStop(1, '#7c241d');
      ctx.fillStyle = dg;
      ctx.fillRect(dx - dw, dy, dw * 2, dh);
      ctx.fillStyle = OUT; ell(ctx, dx, dy, dw, 12); ctx.fill();
      ctx.fillStyle = '#f5e6c8'; ell(ctx, dx, dy, dw - 4, 10);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ell(ctx, dx - 16, dy - 3, 14, 4);
      // đinh vàng quanh tang
      ctx.fillStyle = '#ffd24d';
      for (let k = 0; k < 6; k++) {
        ctx.beginPath(); ctx.arc(dx - dw + 8 + k * ((dw * 2 - 16) / 5), dy + dh / 2, 3, 0, 7); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = OUT; ctx.stroke();
      }
      // dây chằng chéo
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.moveTo(dx - dw + 6 + k * 26, dy + 4); ctx.lineTo(dx - dw + 19 + k * 26, dy + dh - 4); ctx.stroke();
      }
      // 2 dùi trống, dùi phải gõ theo nhịp
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(dx - 70, dy - 34); ctx.lineTo(dx - 34, dy - 6); ctx.stroke();
      const hit = Math.sin(t * 5) > 0.55 ? 10 : 0;
      ctx.beginPath(); ctx.moveTo(dx + 70, dy - 44 + hit); ctx.lineTo(dx + 30, dy - 8); ctx.stroke();
      ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(dx - 70, dy - 34); ctx.lineTo(dx - 34, dy - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dx + 70, dy - 44 + hit); ctx.lineTo(dx + 30, dy - 8); ctx.stroke();
      if (hit > 0) {
        ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('TÙNG!', dx + 30, dy - 16);
        ctx.textAlign = 'left';
      }
      break;
    }
    case 'disco': {
      // giá treo + cầu gương xoay + tia sáng quét
      ctx.strokeStyle = OUT; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(X + f.w / 2, Y); ctx.lineTo(X + f.w / 2, Y + 22); ctx.stroke();
      const bx = X + f.w / 2, by = Y + 52, br = 26;
      const glintA = t * 2;
      const bg = ctx.createRadialGradient(bx - 8, by - 8, 4, bx, by, br);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#bfe6ff'); bg.addColorStop(1, '#5a7fa6');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = 'rgba(60,80,120,.5)'; ctx.lineWidth = 1.2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath(); ctx.arc(bx, by, (br / 4) * k, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - br, by - br + (k * br) / 2); ctx.lineTo(bx + br, by - br + (k * br) / 2); ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bx + Math.cos(glintA) * 12, by + Math.sin(glintA) * 12, 3.4, 0, 7); ctx.fill();
      // tia sáng quét sàn
      for (let k = 0; k < 3; k++) {
        const a = t * 1.4 + (k * Math.PI * 2) / 3;
        const ex = bx + Math.cos(a) * 90, ey = by + 70 + Math.sin(a) * 24;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ['#ff5b8b', '#ffd24d', '#5bb8ff'][k];
        ctx.beginPath(); ctx.ellipse(ex, ey, 12, 5, a, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#c58aff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🪩 DISCO', bx, Y + f.h - 6);
      ctx.textAlign = 'left';
      break;
    }
    case 'costume': {
      // tủ quần áo (1 cánh mở) + mũ + mặt nạ
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w, f.h, 10); ctx.fill();
      ctx.fillStyle = '#6d4c9e'; rr(ctx, X + 4, Y + 4, f.w - 8, f.h - 8, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(X + 8, Y + 6, f.w - 16, 5);
      // cánh trái đóng, cánh phải mở hé lộ đồ
      ctx.fillStyle = '#4e3572'; rr(ctx, X + 10, Y + 12, f.w / 2 - 16, f.h - 24, 6); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      const cols = ['#e75480', '#3b82f6', '#ffd24d'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        rr(ctx, X + f.w / 2 - 2 + i * 4, Y + 20 + i * 26, f.w / 2 - 14, 40, 6); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
      }
      // mũ trên nóc tủ
      ctx.fillStyle = OUT; ell(ctx, X + 36, Y - 2, 26, 7); ctx.fill();
      ctx.fillStyle = '#23232e'; ell(ctx, X + 36, Y - 4, 24, 6);
      ctx.fillStyle = OUT; rr(ctx, X + 24, Y - 30, 24, 28, 4); ctx.fill();
      ctx.fillStyle = '#23232e'; rr(ctx, X + 26, Y - 28, 20, 24, 3); ctx.fill();
      ctx.fillStyle = '#e04848'; ctx.fillRect(X + 26, Y - 12, 20, 5);
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath(); ctx.arc(X + f.w - 36, Y - 8, 12, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#c9a06a'; ctx.fillRect(X + f.w - 44, Y - 12, 16, 4);
      // mặt nạ treo
      const mw = Math.sin(t * 2) * 2;
      for (const [i, col] of [['🎭', '#ffd24d'], ['👺', '#e04848']].entries()) {
        void col;
        ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(i === 0 ? '🎭' : '👺', X + 40 + i * 60, Y + f.h - 16 + (i === 0 ? mw : -mw));
        ctx.textAlign = 'left';
      }
      if (Math.sin(t * 2.5) > 0.5) { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText('✨', X + f.w - 20, Y + 30); }
      break;
    }
    case 'salebin': {
      // thùng carton + đống đồ + biển sale
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, X + f.w / 2, Y + f.h - 2, f.w / 2, 8);
      ctx.fillStyle = OUT; rr(ctx, X + 10, Y + 40, f.w - 20, f.h - 46, 8); ctx.fill();
      ctx.fillStyle = '#c9a06a'; rr(ctx, X + 14, Y + 44, f.w - 28, f.h - 54, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,40,.5)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(X + 14, Y + 44 + (f.h - 54) / 2); ctx.lineTo(X + f.w - 14, Y + 44 + (f.h - 54) / 2); ctx.stroke();
      // nắp thùng mở
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.moveTo(X + 10, Y + 44); ctx.lineTo(X - 12, Y + 22); ctx.lineTo(X + 30, Y + 22); ctx.lineTo(X + 40, Y + 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b98d55';
      ctx.beginPath(); ctx.moveTo(X + 13, Y + 42); ctx.lineTo(X - 6, Y + 25); ctx.lineTo(X + 26, Y + 25); ctx.lineTo(X + 34, Y + 42); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X + f.w - 10, Y + 44); ctx.lineTo(X + f.w + 12, Y + 22); ctx.lineTo(X + f.w - 30, Y + 22); ctx.lineTo(X + f.w - 40, Y + 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b98d55';
      ctx.beginPath(); ctx.moveTo(X + f.w - 13, Y + 42); ctx.lineTo(X + f.w + 6, Y + 25); ctx.lineTo(X + f.w - 26, Y + 25); ctx.lineTo(X + f.w - 34, Y + 42); ctx.closePath(); ctx.fill();
      // đống đồ nhô lên
      const pile: [number, string][] = [[-34, '#e75480'], [-12, '#3b82f6'], [10, '#3f9e4d'], [30, '#ffd24d']];
      for (const [ox, col] of pile) {
        ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 + ox - 14, Y + 8 + (ox % 3) * 3, 30, 30, 8); ctx.fill();
        ctx.fillStyle = col; rr(ctx, X + f.w / 2 + ox - 11, Y + 11 + (ox % 3) * 3, 24, 24, 6); ctx.fill();
      }
      // biển SALE cắm trên thùng
      ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X + f.w - 30, Y + 44); ctx.lineTo(X + f.w - 30, Y + 2); ctx.stroke();
      ctx.fillStyle = OUT; rr(ctx, X + f.w - 66, Y - 30, 72, 34, 7); ctx.fill();
      ctx.fillStyle = '#e04848'; rr(ctx, X + f.w - 62, Y - 26, 64, 26, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('-50%!', X + f.w - 30, Y - 8);
      ctx.textAlign = 'left';
      break;
    }
    case 'photoframe': {
      // khung vàng + ảnh 3 người + tim + caption
      ctx.fillStyle = OUT; rr(ctx, X - 4, Y - 4, f.w + 8, f.h - 6, 8); ctx.fill();
      ctx.fillStyle = '#c9a227'; rr(ctx, X - 4, Y - 4, f.w + 8, f.h - 6, 8); ctx.fill();
      ctx.fillStyle = '#8a6d00'; rr(ctx, X, Y, f.w, f.h - 14, 5); ctx.fill();
      const sg = ctx.createLinearGradient(0, Y + 4, 0, Y + f.h - 14);
      sg.addColorStop(0, '#bfe6ff'); sg.addColorStop(1, '#8fc3e8');
      ctx.fillStyle = sg; ctx.fillRect(X + 4, Y + 4, f.w - 8, f.h - 22);
      ctx.fillStyle = '#7cc74f'; ctx.fillRect(X + 4, Y + f.h - 32, f.w - 8, 14);
      // 3 người: bố cao, mẹ, bé út
      const person = (px: number, skin: string, hair: string, r: number, tall: number) => {
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.arc(px, Y + f.h - 34 - tall, r, 0, 7); ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.arc(px, Y + f.h - 32 - tall, r - 2, 0, 7); ctx.fill();
      };
      person(X + f.w / 2 - 34, '#f2c89b', '#3a3a3a', 11, 14);
      person(X + f.w / 2, '#f2c89b', '#5a3a22', 10, 10);
      person(X + f.w / 2 + 32, '#f7d7a8', '#2b2b2b', 8, 2);
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('❤️', X + f.w / 2, Y + 22 + Math.sin(t * 3) * 1.5);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a3a1a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('GIA ĐÌNH', X + f.w / 2, Y + f.h + 2);
      ctx.textAlign = 'left';
      break;
    }
    case 'machine': {
      // xe máy ve chai: 2 bánh + thân rỉ + giỏ đồ + khói
      const wy = Y + f.h - 22;
      for (const wx of [X + 42, X + f.w - 42]) {
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(wx, wy, 22, 0, 7); ctx.fill();
        ctx.fillStyle = '#3a3a42'; ctx.beginPath(); ctx.arc(wx, wy, 18, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8d8d94'; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + 0.4;
          ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * 15, wy + Math.sin(a) * 15); ctx.stroke();
        }
        ctx.fillStyle = '#d9d9d9'; ctx.beginPath(); ctx.arc(wx, wy, 4, 0, 7); ctx.fill();
      }
      // thân xe rỉ sét
      ctx.fillStyle = OUT; rr(ctx, X + 50, Y + 40, f.w - 100, 44, 12); ctx.fill();
      ctx.fillStyle = '#a34a2e'; rr(ctx, X + 54, Y + 44, f.w - 108, 36, 10); ctx.fill();
      ctx.fillStyle = 'rgba(90,50,20,.55)';
      ctx.beginPath(); ctx.ellipse(X + 90, Y + 66, 14, 8, 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(X + f.w - 70, Y + 58, 10, 6, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(X + 60, Y + 46, f.w - 120, 5);
      // yên + tay lái + đèn
      ctx.fillStyle = OUT; rr(ctx, X + f.w / 2 - 26, Y + 28, 52, 14, 7); ctx.fill();
      ctx.fillStyle = '#3a3a42'; rr(ctx, X + f.w / 2 - 23, Y + 30, 46, 10, 5); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X + f.w - 52, wy - 8); ctx.lineTo(X + f.w - 30, Y + 30); ctx.stroke();
      ctx.strokeStyle = '#8d8d94'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X + f.w - 52, wy - 8); ctx.lineTo(X + f.w - 30, Y + 30); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(X + f.w - 44, Y + 44, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(X + f.w - 44, Y + 44, 6, 0, 7); ctx.fill();
      // giỏ trước đựng ve chai
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
      ctx.strokeRect(X + 26, Y + 46, 30, 24);
      ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X + 26, Y + 54); ctx.lineTo(X + 56, Y + 54); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X + 26, Y + 62); ctx.lineTo(X + 56, Y + 62); ctx.stroke();
      ctx.fillStyle = '#6e6250'; ell(ctx, X + 41, Y + 44, 12, 7);
      ctx.fillStyle = '#ff8a5b'; ell(ctx, X + 36, Y + 40, 5, 4);
      // khói pô lười biếng
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.4 + i / 2) % 1;
        ctx.fillStyle = `rgba(160,160,160,${0.4 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(X + 30 - p * 22, wy - 6 - p * 26, 3 + p * 5, 0, 7); ctx.fill();
      }
      break;
    }
    case 'carcatalog': {
      // quầy catalog: tủ gỗ + sổ xe + chùm chìa khóa + bảng giá
      ctx.fillStyle = OUT; rr(ctx, X, Y + 30, f.w, f.h - 30, 8); ctx.fill();
      ctx.fillStyle = '#6b4a2e'; rr(ctx, X + 4, Y + 34, f.w - 8, f.h - 38, 6); ctx.fill();
      ctx.fillStyle = '#8a5f3a';
      for (let i = 1; i < 3; i++) ctx.fillRect(X + 10, Y + 30 + ((f.h - 30) / 3) * i, f.w - 20, 3);
      ctx.fillStyle = OUT; rr(ctx, X - 6, Y + 8, f.w + 12, 30, 8); ctx.fill();
      ctx.fillStyle = '#3f6fb5'; rr(ctx, X - 2, Y + 12, f.w + 4, 22, 6); ctx.fill();
      // sổ catalog mở + xe mini
      ctx.fillStyle = '#fff8dc'; rr(ctx, X + 22, Y - 24, 64, 34, 3); ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X + 54, Y - 24); ctx.lineTo(X + 54, Y + 10); ctx.stroke();
      ctx.font = '13px sans-serif';
      ctx.fillText('🚲', X + 28, Y + 2); ctx.fillText('🏎️', X + 58, Y + 2);
      // chùm chìa khóa treo đung đưa
      const kw = Math.sin(t * 2.2) * 3;
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X + f.w - 50, Y + 12); ctx.lineTo(X + f.w - 50 + kw, Y + 26); ctx.stroke();
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(X + f.w - 50 + kw, Y + 30, 4, 0, 7); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(X + f.w - 52 + kw, Y + 33, 4, 8);
      // bảng giá treo
      ctx.fillStyle = OUT; rr(ctx, X + f.w - 116, Y - 40, 108, 36, 6); ctx.fill();
      ctx.fillStyle = '#2b2117'; rr(ctx, X + f.w - 112, Y - 36, 100, 28, 4); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('XE ĐẠP 10K', X + f.w - 104, Y - 16);
      break;
    }
    case 'cardisplay': {
      // bục trưng bày xoay xe: bục tròn + xe trên bục + vòng hào quang
      const pick = f.id === 'display3' ? CARS.car_sieuxe : f.id === 'display2' ? CARS.moto_the : CARS.bike_dia;
      const cx = X + f.w / 2, base = Y + f.h - 8;
      ctx.fillStyle = 'rgba(255,215,80,.18)';
      ctx.beginPath(); ctx.ellipse(cx, base - 6, f.w / 2, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = OUT; ell(ctx, cx, base - 4, f.w / 2, 12); ctx.fill();
      ctx.fillStyle = '#c0c8d0'; ell(ctx, cx, base - 8, f.w / 2 - 5, 9);
      ctx.fillStyle = '#e04848'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(pick.emoji + ' ' + pick.name.toUpperCase(), cx, Y + 4);
      ctx.textAlign = 'left';
      ctx.save();
      ctx.translate(cx, base - 14);
      const sc = Math.min(1.15, f.w / 170);
      ctx.scale(sc, sc);
      if (pick.kind === 'bike') drawBikeSide(ctx, pick.color, t, false, pick.id);
      else if (pick.kind === 'moto') drawMotoSide(ctx, pick.color, t, false, pick.id);
      else drawCarSide(ctx, pick.color, t, false, pick.id);
      ctx.restore();
      if (Math.sin(t * 2.4 + X) > 0.5) {
        ctx.fillStyle = '#fff';
        ctx.font = '13px sans-serif';
        ctx.fillText('✨', cx - f.w / 2 + 8, Y + 30 + Math.sin(t * 3) * 2);
      }
      break;
    }
    case 'lift': {
      // cầu nâng: 2 trụ + sàn nâng + xe nằm trên + tia lửa hàn
      const top = Y + 34;
      ctx.fillStyle = OUT;
      ctx.fillRect(X + 18, Y, 16, f.h - 10);
      ctx.fillRect(X + f.w - 34, Y, 16, f.h - 10);
      ctx.fillStyle = '#d7a21f';
      ctx.fillRect(X + 20, Y + 2, 12, f.h - 14);
      ctx.fillRect(X + f.w - 32, Y + 2, 12, f.h - 14);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(X + 20, Y + 12 + i * ((f.h - 20) / 6), 12, 3);
        ctx.fillRect(X + f.w - 32, Y + 12 + i * ((f.h - 20) / 6), 12, 3);
      }
      // sàn nâng + xe bán tải trên sàn
      ctx.fillStyle = OUT; rr(ctx, X + 8, top, f.w - 16, 14, 4); ctx.fill();
      ctx.fillStyle = '#54616c'; rr(ctx, X + 12, top + 2, f.w - 24, 10, 3); ctx.fill();
      ctx.save();
      ctx.translate(X + f.w / 2, top + 2);
      ctx.scale(0.95, 0.95);
      drawCarSide(ctx, CARS.car_bantai.color, t, false, 'car_bantai');
      ctx.restore();
      // tia lửa bảo dưỡng + xô nước rửa xe
      if (Math.sin(t * 7) > 0.4) {
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(X + f.w - 60, top + 34, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff9800';
        ctx.beginPath(); ctx.arc(X + f.w - 60, top + 34, 1.6, 0, 7); ctx.fill();
      }
      ctx.fillStyle = OUT; rr(ctx, X + 34, Y + f.h - 34, 30, 28, 5); ctx.fill();
      ctx.fillStyle = '#3f6fb5'; rr(ctx, X + 37, Y + f.h - 31, 24, 22, 4); ctx.fill();
      ctx.fillStyle = 'rgba(190,230,255,.9)'; ell(ctx, X + 49, Y + f.h - 31, 12, 4);
      break;
    }
    case 'toolboard': {
      // bảng đồ nghề: pegboard + cờ lê/búa/lốp + chồng lốp bên cạnh
      ctx.fillStyle = OUT; rr(ctx, X, Y, f.w - 60, f.h, 8); ctx.fill();
      ctx.fillStyle = '#8a5f3a'; rr(ctx, X + 4, Y + 4, f.w - 68, f.h - 8, 6); ctx.fill();
      ctx.fillStyle = 'rgba(60,35,15,.5)';
      for (let ry = 0; ry < 4; ry++) for (let rx = 0; rx < 6; rx++) {
        ctx.beginPath(); ctx.arc(X + 20 + rx * ((f.w - 100) / 5), Y + 20 + ry * ((f.h - 40) / 3), 2, 0, 7); ctx.fill();
      }
      // cờ lê + búa + kìm treo
      ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X + 34, Y + 24); ctx.lineTo(X + 34, Y + 62); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(X + 70, Y + 24); ctx.lineTo(X + 70, Y + 56); ctx.stroke();
      ctx.strokeStyle = '#a34a2e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(X + 70, Y + 24); ctx.lineTo(X + 70, Y + 56); ctx.stroke();
      ctx.fillStyle = '#54616c';
      ctx.beginPath(); ctx.arc(X + 104, Y + 36, 7, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.arc(X + 104, Y + 36, 3, 0, 7); ctx.fill();
      // chồng lốp xe bên cạnh
      for (let i = 0; i < 3; i++) {
        const ty = Y + f.h - 16 - i * 20;
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(X + f.w - 30, ty, 17, 0, 7); ctx.fill();
        ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(X + f.w - 30, ty, 14, 0, 7); ctx.fill();
        ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(X + f.w - 30, ty, 5.5, 0, 7); ctx.fill();
      }
      break;
    }
    case 'plantpot': {
      // chậu sành + rau thơm + bình tưới mini + bọ rùa
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, X + f.w / 2, Y + f.h - 4, f.w / 2 - 6, 8);
      ctx.fillStyle = OUT; rr(ctx, X + 12, Y + f.h - 52, f.w - 24, 44, 8); ctx.fill();
      ctx.fillStyle = '#b5651d'; rr(ctx, X + 16, Y + f.h - 48, f.w - 32, 36, 6); ctx.fill();
      ctx.fillStyle = '#8a4a12'; ctx.fillRect(X + 16, Y + f.h - 48, f.w - 32, 8);
      ctx.fillStyle = '#5d3a1a'; ell(ctx, X + f.w / 2, Y + f.h - 50, f.w / 2 - 20, 8);
      // 5 ngọn rau đung đưa
      for (let i = 0; i < 5; i++) {
        const hx = X + 26 + i * ((f.w - 52) / 4);
        const hh = 30 + (i % 2) * 12;
        const sway = Math.sin(t * 1.8 + i * 1.4) * 3;
        ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, Y + f.h - 52); ctx.quadraticCurveTo(hx + sway, Y + f.h - 52 - hh * 0.6, hx + sway * 1.6, Y + f.h - 52 - hh); ctx.stroke();
        ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hx, Y + f.h - 52); ctx.quadraticCurveTo(hx + sway, Y + f.h - 52 - hh * 0.6, hx + sway * 1.6, Y + f.h - 52 - hh); ctx.stroke();
        ctx.fillStyle = '#43d17c';
        ctx.beginPath(); ctx.ellipse(hx + sway * 1.6 - 5, Y + f.h - 52 - hh + 4, 6, 3.4, -0.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx + sway * 1.6 + 5, Y + f.h - 52 - hh + 6, 6, 3.4, 0.5, 0, 7); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = OUT; ctx.stroke();
      }
      // bọ rùa đậu trên lá
      const ladyX = X + f.w / 2 + Math.sin(t * 0.9) * 14;
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(ladyX, Y + f.h - 88, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#e04848'; ctx.beginPath(); ctx.arc(ladyX, Y + f.h - 88, 3.6, 0, 7); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ladyX, Y + f.h - 92); ctx.lineTo(ladyX, Y + f.h - 84); ctx.stroke();
      // giọt sương lấp lánh
      if (Math.sin(t * 2.4) > 0.4) {
        ctx.fillStyle = '#bfe6ff';
        ctx.beginPath(); ctx.arc(X + f.w - 28, Y + f.h - 96, 2.6, 0, 7); ctx.fill();
      }
      break;
    }
    case 'rug': {
      ctx.fillStyle = 'rgba(150,60,60,.55)'; rr(ctx, X, Y, f.w, f.h, 40); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,150,.7)'; ctx.lineWidth = 4;
      rr(ctx, X + 12, Y + 12, f.w - 24, f.h - 24, 30); ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ---------- ambient: mỗi phòng có "hơi thở" riêng (bay lơ lửng theo thời gian) ----------
function furnXY(d: InteriorDef, id: string): { x: number; y: number; w: number; h: number } | null {
  const f = d.furns.find((v) => v.id === id);
  return f ? { x: f.x + f.w / 2, y: f.y, w: f.w, h: f.h } : null;
}
function drawAmbient(ctx: CanvasRenderingContext2D, X0: number, Y0: number, d: InteriorDef, t: number) {
  ctx.textAlign = 'center';
  const bob = (i: number, amp = 6, sp = 1.2) => Math.sin(t * sp + i * 2.1) * amp;
  const put = (x: number, y: number, s: string, size = 16, alpha = 0.9) => {
    ctx.globalAlpha = alpha; ctx.font = `${size}px sans-serif`; ctx.fillText(s, X0 + x, Y0 + y); ctx.globalAlpha = 1;
  };
  switch (d.id) {
    case 'cafe': {
      const c = furnXY(d, 'counter'); if (c) put(c.x - 90, c.y - 34 + bob(1, 4), '☕', 17);
      const p = furnXY(d, 'piano'); if (p) put(p.x + 50, p.y - 24 - ((t * 14) % 40), '🎵', 15, 0.8);
      const s = furnXY(d, 'shelf'); if (s) put(s.x + 20, s.y - 14 + bob(3, 3), '🍰', 16);
      break;
    }
    case 'hall': {
      const tr = furnXY(d, 'trophy'); if (tr && Math.sin(t * 2) > 0.4) put(tr.x, tr.y - 18, '✨', 15);
      const dn = furnXY(d, 'donate'); if (dn) put(dn.x, dn.y - 12 + bob(2, 4), '❤️', 14, 0.75);
      break;
    }
    case 'shop': {
      for (let i = 0; i < 4; i++) {
        if (Math.sin(t * 1.5 + i * 2) > 0) put(220 + i * 220, 300 - ((t * 10 + i * 45) % 120), '✨', 13, 0.7);
      }
      const m = furnXY(d, 'mirror'); if (m) put(m.x, m.y - 14 + bob(1, 3), '✨', 15);
      break;
    }
    case 'stage': {
      for (let i = 0; i < 8; i++) {
        const fx = 250 + ((i * 97 + t * 22) % 600);
        const fy = 140 + ((t * 30 + i * 53) % 260);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = ['#ff5b8b', '#ffd24d', '#5bb8ff', '#5bff8a'][i % 4];
        ctx.fillRect(X0 + fx, Y0 + fy, 5, 7);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'house1': {
      const st = furnXY(d, 'stove');
      if (st) for (let i = 0; i < 2; i++) put(st.x - 20 + i * 40, st.y - 48 - ((t * 18 + i * 20) % 30), '🔥', 13, 0.8);
      const cb = furnXY(d, 'cabinet'); if (cb && Math.sin(t * 2 + 1) > 0.5) put(cb.x, cb.y - 14, '✨', 14);
      break;
    }
    case 'house2': {
      const j = furnXY(d, 'junk');
      if (j) {
        if (Math.sin(t * 2.2) > 0.3) put(j.x + j.w / 4, j.y - 18, '✨', 14, 0.8);
        ctx.fillStyle = 'rgba(40,40,40,.6)';
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(X0 + j.x + 60 + Math.sin(t * 5 + i * 3) * 26, Y0 + j.y + 60 + Math.cos(t * 6 + i * 2) * 14, 1.8, 0, 7);
          ctx.fill();
        }
      }
      break;
    }
    case 'casino': {
      const v = furnXY(d, 'vault'); if (v) put(v.x, v.y - 32 + bob(1, 3), '🪙', 16);
      const sl = furnXY(d, 'slot'); if (sl && Math.sin(t * 3) > 0.4) put(sl.x + sl.w / 2 - 30, sl.y - 16, '✨', 14);
      const b = furnXY(d, 'bar'); if (b) put(b.x, b.y - 36 + bob(3, 3), '🍹', 15, 0.85);
      break;
    }
    default: break;
  }
  ctx.textAlign = 'left';
}

// ---------- trang trí tường riêng từng phòng (vẽ trên mảng tường Y0+40..132) ----------
function drawRoomDecor(ctx: CanvasRenderingContext2D, X0: number, Y0: number, d: InteriorDef, t: number, night: boolean) {
  const paw = (x: number, y: number, s: number, a: number) => {
    ctx.save(); ctx.translate(X0 + x, Y0 + y); ctx.rotate(a); ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0, 0, 5 * s, 4 * s, 0, 0, 7); ctx.fill();
    for (const [ox, oy] of [[-6, -6], [-2, -8], [2, -8], [6, -6]] as [number, number][]) {
      ctx.beginPath(); ctx.arc(ox * s, oy * s, 1.8 * s, 0, 7); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  };
  switch (d.id) {
    case 'cafe': {
      // dấu chân mèo trên tường + bảng phấn món hôm nay
      const spots: [number, number, number][] = [[300, 70, 0.4], [340, 85, -0.3], [380, 70, 0.4], [700, 70, -0.4], [740, 85, 0.3], [780, 70, -0.4]];
      for (const [x, y, a] of spots) paw(x, y, 1, a);
      ctx.fillStyle = OUT; rr(ctx, X0 + 660, Y0 + 56, 120, 60, 6); ctx.fill();
      ctx.fillStyle = '#3a4a3a'; rr(ctx, X0 + 664, Y0 + 60, 112, 52, 4); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('HÔM NAY ⭐', X0 + 720, Y0 + 78);
      ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
      ctx.fillText('món đặc biệt x2 XP', X0 + 720, Y0 + 94);
      ctx.textAlign = 'left';
      break;
    }
    case 'hall': {
      // đồng hồ treo tường chạy giờ thật + 2 băng rôn đỏ + khung ảnh làng
      const cx = X0 + 390, cy = Y0 + 88;
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, 7); ctx.fill();
      const nowD = new Date();
      const ha = ((nowD.getHours() % 12) + nowD.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
      const ma = (nowD.getMinutes() + nowD.getSeconds() / 60) / 60 * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * 9, cy + Math.sin(ha) * 9); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * 13, cy + Math.sin(ma) * 13); ctx.stroke();
      for (const bx of [X0 + 700, X0 + 830]) {
        ctx.fillStyle = '#b3392e'; rr(ctx, bx, Y0 + 52, 44, 66, 5); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('ĐOÀN', bx + 22, Y0 + 80);
        ctx.fillText('KẾT', bx + 22, Y0 + 100);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = OUT; rr(ctx, X0 + 30, Y0 + 56, 76, 60, 5); ctx.fill();
      ctx.fillStyle = '#c98f4e'; rr(ctx, X0 + 34, Y0 + 60, 68, 52, 4); ctx.fill();
      ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🌾', X0 + 68, Y0 + 100);
      ctx.textAlign = 'left';
      break;
    }
    case 'shop': {
      // chấm bi + dây sao
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 24; i++) {
        const dx = 30 + ((i * 167) % 1040), dy = 52 + ((i * 89) % 64);
        ctx.beginPath(); ctx.arc(X0 + dx, Y0 + dy, 3, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,60,120,.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(X0 + 20, Y0 + 122); ctx.quadraticCurveTo(X0 + 550, Y0 + 140, X0 + 1080, Y0 + 122); ctx.stroke();
      for (let i = 0; i < 11; i++) {
        const sx = X0 + 60 + i * 96, sy = Y0 + 124 + Math.sin(i * 1.2) * 4;
        ctx.fillStyle = i % 2 ? '#ffd24d' : '#ff9ebb';
        ctx.save(); ctx.translate(sx, sy + Math.sin(t * 2 + i) * 1.5); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8); ctx.restore();
      }
      break;
    }
    case 'stage': {
      // sao vàng + 2 poster show
      ctx.fillStyle = 'rgba(255,210,77,.85)';
      for (let i = 0; i < 14; i++) {
        const dx = 40 + ((i * 211) % 1020), dy = 48 + ((i * 137) % 70);
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.7);
        ctx.globalAlpha = tw;
        ctx.save(); ctx.translate(X0 + dx, Y0 + dy); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-3.4, -3.4, 6.8, 6.8); ctx.restore();
      }
      ctx.globalAlpha = 1;
      const poster = (px: number, emoji: string, label: string) => {
        ctx.fillStyle = OUT; rr(ctx, X0 + px, Y0 + 50, 90, 70, 6); ctx.fill();
        ctx.fillStyle = night ? '#3a2a5e' : '#fff3d6'; rr(ctx, X0 + px + 4, Y0 + 54, 82, 62, 4); ctx.fill();
        ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(emoji, X0 + px + 45, Y0 + 90);
        ctx.fillStyle = night ? '#ffd24d' : '#b3392e'; ctx.font = 'bold 10px sans-serif';
        ctx.fillText(label, X0 + px + 45, Y0 + 110);
        ctx.textAlign = 'left';
      };
      poster(300, '🎤', 'ĐÊM NHẠC');
      poster(710, '🎸', 'HỘI ROCK');
      break;
    }
    case 'house1': {
      // đĩa trang trí + lịch + rèm caro 3 cửa sổ
      for (let i = 0; i < 3; i++) {
        const dx = X0 + 300 + i * 26, dy = Y0 + 88;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx, dy, 11, 0, 7); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = ['#e75480', '#3b82f6', '#3f9e4d'][i];
        ctx.beginPath(); ctx.arc(dx, dy, 5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = OUT; rr(ctx, X0 + 700, Y0 + 56, 64, 62, 5); ctx.fill();
      ctx.fillStyle = '#fff8dc'; rr(ctx, X0 + 704, Y0 + 60, 56, 54, 4); ctx.fill();
      ctx.fillStyle = '#b3392e'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      const dd = new Date();
      ctx.fillText('LỊCH', X0 + 732, Y0 + 74);
      ctx.fillStyle = '#2b2117'; ctx.font = 'bold 16px sans-serif';
      ctx.fillText(String(dd.getDate()), X0 + 732, Y0 + 98);
      ctx.textAlign = 'left';
      // rèm caro 2 bên mỗi cửa sổ
      for (let i = 0; i < 3; i++) {
        const wx = X0 + 140 + i * 380;
        for (const sgn of [-1, 1]) {
          const cx = wx + (sgn < 0 ? -8 : 128);
          ctx.fillStyle = (i + (sgn > 0 ? 1 : 0)) % 2 ? '#e75480' : '#fff';
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = (k + i + (sgn > 0 ? 1 : 0)) % 2 ? '#e75480' : '#fff8e1';
            ctx.fillRect(cx + (sgn < 0 ? -14 : 0) + (k % 2) * 7, Y0 + 52 + Math.floor(k / 2) * 32, 7, 32);
          }
          ctx.lineWidth = 1.6; ctx.strokeStyle = OUT;
          ctx.strokeRect(cx + (sgn < 0 ? -14 : 0), Y0 + 52, 14, 64);
        }
      }
      break;
    }
    case 'house2': {
      // nứt tường + vết ố + mạng nhện + cờ lê treo
      ctx.strokeStyle = 'rgba(60,50,45,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X0 + 420, Y0 + 48); ctx.lineTo(X0 + 432, Y0 + 70); ctx.lineTo(X0 + 424, Y0 + 92); ctx.lineTo(X0 + 436, Y0 + 116); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X0 + 760, Y0 + 52); ctx.lineTo(X0 + 752, Y0 + 80); ctx.lineTo(X0 + 762, Y0 + 104); ctx.stroke();
      ctx.fillStyle = 'rgba(120,90,40,.18)';
      ctx.beginPath(); ctx.ellipse(X0 + 560, Y0 + 100, 34, 14, 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(X0 + 120, Y0 + 95, 22, 10, -0.2, 0, 7); ctx.fill();
      for (const [cx, cy] of [[X0 + 8, Y0 + 44], [X0 + 1092, Y0 + 44]] as [number, number][]) {
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.arc(cx, cy, 10 + k * 10, 0, Math.PI / 2); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (cx < 500 ? 30 : -30), cy + 30); ctx.stroke();
      }
      // cờ lê treo đung đưa
      const sway = Math.sin(t * 1.8) * 3;
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X0 + 660, Y0 + 48); ctx.lineTo(X0 + 660 + sway, Y0 + 66); ctx.stroke();
      ctx.strokeStyle = '#8d8d94'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X0 + 660 + sway, Y0 + 66); ctx.lineTo(X0 + 660 + sway, Y0 + 92); ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(X0 + 660 + sway, Y0 + 96, 5, 0.6, Math.PI * 2 - 0.6); ctx.stroke();
      break;
    }
    case 'casino': {
      // nẹp vàng + đèn tường + biển JACKPOT
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(X0, Y0 + 44, d.w, 4);
      ctx.fillRect(X0, Y0 + 124, d.w, 4);
      for (const sx of [X0 + 390, X0 + 770]) {
        ctx.fillStyle = OUT; rr(ctx, sx - 10, Y0 + 62, 20, 34, 6); ctx.fill();
        const glow = 0.7 + 0.3 * Math.sin(t * 4 + sx);
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#ffe9a8'; rr(ctx, sx - 6, Y0 + 66, 12, 26, 5); ctx.fill();
        ctx.globalAlpha = 1;
        const halo = ctx.createRadialGradient(sx, Y0 + 79, 2, sx, Y0 + 79, 40);
        halo.addColorStop(0, 'rgba(255,210,120,.4)'); halo.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sx, Y0 + 79, 40, 0, 7); ctx.fill();
      }
      const blink = 0.75 + 0.25 * Math.sin(t * 5);
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#b3392e'; rr(ctx, X0 + 660, Y0 + 58, 220, 62, 10); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffd24d'; ctx.stroke();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★ JACKPOT ★', X0 + 770, Y0 + 97);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      break;
    }
    case 'garage': {
      // cờ ca-rô + biển GARA + áp phích xe
      for (let i = 0; i < 22; i++) {
        const fx = X0 + 20 + i * 50, fy = Y0 + 46 + (i % 2) * 8;
        ctx.fillStyle = i % 2 ? '#2b2117' : '#fff';
        ctx.save(); ctx.translate(fx, fy + Math.sin(t * 2 + i) * 1.5); ctx.rotate(0.2);
        ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      }
      ctx.fillStyle = OUT; rr(ctx, X0 + 420, Y0 + 58, 260, 62, 10); ctx.fill();
      ctx.fillStyle = '#d32f2f'; rr(ctx, X0 + 424, Y0 + 62, 252, 54, 8); ctx.fill();
      ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🚗 GARA ANH TÝ', X0 + 550, Y0 + 97);
      ctx.textAlign = 'left';
      // áp phích 2 bên: xe đạp + siêu xe
      const poster = (px: number, emoji: string, label: string) => {
        ctx.fillStyle = OUT; rr(ctx, X0 + px, Y0 + 50, 90, 70, 6); ctx.fill();
        ctx.fillStyle = night ? '#3a4a5c' : '#fff3d6'; rr(ctx, X0 + px + 4, Y0 + 54, 82, 62, 4); ctx.fill();
        ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(emoji, X0 + px + 45, Y0 + 90);
        ctx.fillStyle = night ? '#ffd24d' : '#37474f'; ctx.font = 'bold 10px sans-serif';
        ctx.fillText(label, X0 + px + 45, Y0 + 110);
        ctx.textAlign = 'left';
      };
      poster(300, '🚲', 'XE ĐẠP 10K');
      poster(710, '🏎️', 'SIÊU XE');
      break;
    }
    default: break;
  }
}

// ---------- bụi bay trong phòng ----------
function drawDustMotes(ctx: CanvasRenderingContext2D, X0: number, Y0: number, d: InteriorDef, t: number) {
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) {
    const mx = X0 + ((i * 197 + t * 10) % d.w);
    const my = Y0 + 150 + ((i * 131 + t * 6 + i * 40) % (d.h - 200));
    ctx.globalAlpha = 0.1 + 0.08 * Math.sin(t * 2 + i * 1.3);
    ctx.beginPath(); ctx.arc(mx, my, 1.5 + (i % 3), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ================= RENDER CHÍNH =================
export function renderInterior(
  ctx: CanvasRenderingContext2D, vw: number, vh: number,
  cam: { x: number; y: number }, id: string, o: RenderOpts, t: number,
) {
  const d: InteriorDef | undefined = INTERIORS[id];
  if (!d) return;
  const X0 = -cam.x, Y0 = -cam.y;
  // nền ngoài phòng (viền tối)
  ctx.fillStyle = '#241a10'; ctx.fillRect(0, 0, vw, vh);
  // --- sàn gỗ/thảm (vẽ phủ cả viewport để zoom xa không lộ viền) ---
  const fw = 76;
  for (let yy = -fw; yy < vh + fw; yy += 22) {
    for (let xx = -fw; xx < vw + fw; xx += fw) {
      const wx = xx + X0, wy = yy + Y0;
      const inRoom = wx > 0 && wx < d.w && wy > 120 && wy < d.h;
      if (!inRoom) continue;
      const odd = (Math.floor((wx + 2000) / fw) + Math.floor((wy + 2000) / 22)) % 2 === 0;
      if (d.floorKind === 'tile') {
        ctx.fillStyle = odd ? d.floorA : d.floorB;
        ctx.fillRect(xx, yy, fw, 22);
        ctx.strokeStyle = 'rgba(120,90,140,.25)'; ctx.lineWidth = 1;
        ctx.strokeRect(xx, yy, fw, 22);
      } else {
        ctx.fillStyle = odd ? d.floorA : d.floorB;
        ctx.fillRect(xx, yy, fw, 22);
        ctx.fillStyle = 'rgba(90,55,25,.25)';
        ctx.fillRect(xx, yy + 19, fw, 3);
      }
    }
  }
  // --- tường sau + cửa sổ + đèn treo ---
  ctx.fillStyle = d.wallDark; ctx.fillRect(X0, Y0 + 40, d.w, 92);
  ctx.fillStyle = d.wall; ctx.fillRect(X0, Y0 + 48, d.w, 76);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X0, Y0 + 116, d.w, 16);
  for (let i = 0; i < 3; i++) {
    const wx = X0 + 140 + i * 380;
    ctx.fillStyle = OUT; rr(ctx, wx, Y0 + 52, 120, 64, 6); ctx.fill();
    // kính đổi màu theo ngày/đêm: đêm thấy trăng + sao
    if (o.night) {
      ctx.fillStyle = '#2b3a6b'; rr(ctx, wx + 5, Y0 + 57, 110, 54, 4); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(wx + 88, Y0 + 74, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) {
        const sx = wx + 14 + ((k * 29 + i * 17) % 70), sy = Y0 + 64 + ((k * 23 + i * 31) % 36);
        ctx.fillRect(sx, sy, 1.8, 1.8);
      }
    } else {
      ctx.fillStyle = '#bfe6ff'; rr(ctx, wx + 5, Y0 + 57, 110, 54, 4); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.moveTo(wx + 20, Y0 + 111); ctx.lineTo(wx + 45, Y0 + 57); ctx.lineTo(wx + 60, Y0 + 57); ctx.lineTo(wx + 35, Y0 + 111); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(wx + 60, Y0 + 57); ctx.lineTo(wx + 60, Y0 + 111); ctx.stroke();
  }
  // đèn treo giữa
  const lx = X0 + d.w / 2;
  ctx.strokeStyle = OUT; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(lx, Y0 + 40); ctx.lineTo(lx, Y0 + 66); ctx.stroke();
  ctx.fillStyle = OUT; ell(ctx, lx, Y0 + 76, 18, 12); ctx.fill();
  const flick = 0.85 + Math.sin(t * 7) * 0.05;
  ctx.fillStyle = `rgba(255,220,130,${0.9 * flick})`; ell(ctx, lx, Y0 + 78, 12, 8);
  ctx.fillStyle = 'rgba(255,220,130,.12)'; ell(ctx, lx, Y0 + 220, 220, 130);
  // --- trang trí tường riêng từng phòng ---
  drawRoomDecor(ctx, X0, Y0, d, t, o.night);
  // --- thảm cửa ra (đáy) ---
  const dr = d.door;
  ctx.fillStyle = '#7c4f24'; rr(ctx, X0 + dr.x - 20, Y0 + dr.y - 26, dr.w + 40, 60, 12); ctx.fill();
  ctx.fillStyle = '#b3392e'; rr(ctx, X0 + dr.x - 12, Y0 + dr.y - 18, dr.w + 24, 44, 9); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('LỐI RA ▼', X0 + dr.x + dr.w / 2, Y0 + dr.y + 10);
  ctx.textAlign = 'left';

  // --- xếp lớp theo y: đồ, NPC, người chơi ---
  interface D { y: number; fn: () => void }
  const layers: D[] = [];
  for (const f of d.furns) layers.push({ y: f.y + f.h, fn: () => drawFurn(ctx, d, f, t, o.stageColor) });
  for (const n of d.npcs) {
    layers.push({
      y: n.y, fn: () => {
        // NPC biết "sống": mèo đi dạo quanh, fan nhún nhảy, khách đung đưa, dealer đứng yên xào bài
        let ox = 0, oy = 0;
        if (n.look === 'cat') {
          ox = Math.sin(t * 0.5 + n.x * 0.3) * 24;
          oy = Math.cos(t * 0.4 + n.x) * 12;
        } else if (n.look === 'fan') {
          const cheering = performance.now() / 1000 < cheerUntil;
          oy = -Math.abs(Math.sin(t * (cheering ? 6 : 2.5) + n.x)) * (cheering ? 14 : 6);
          ox = Math.sin(t * 2 + n.x) * 6;
        } else if (n.look === 'guest') {
          ox = Math.sin(t * 1.6 + n.x) * 8;
          oy = Math.sin(t * 3.2 + n.x) * -2;
        }
        if (n.look === 'cat') drawCatNpc(ctx, X0 + n.x + ox, Y0 + n.y + oy, n.fur ?? '#f5f5f5', n.name, t, n.x, n.id);
        else drawHuman(ctx, X0 + n.x + ox, Y0 + n.y + oy, n.look, n.name, t, n.x);
      },
    });
  }
  const shirt = shirtColorOf(o.outfit, SHIRTS[o.avatar % SHIRTS.length]);
  layers.push({
    y: o.player.y, fn: () => {
      // bụi bước chân khi di chuyển
      if (o.player.moving) {
        const p1 = (t * 5) % 1;
        ctx.fillStyle = 'rgba(210,190,160,.55)';
        ell(ctx, X0 + o.player.x - o.player.dir * 12, Y0 + o.player.y - 2 - p1 * 7, 5 * (1 - p1) + 2, 3);
      }
      drawPlayerDetailed(ctx, X0 + o.player.x, Y0 + o.player.y, o.player.dir, o.player.moving, shirt, o.player.name, t, o.outfit, o.carColor, o.carKind, o.carId, false);
    },
  });
  layers.sort((a, b) => a.y - b.y).forEach((l) => l.fn());

  // --- bụi bay + hơi thở ambient riêng từng phòng ---
  drawDustMotes(ctx, X0, Y0, d, t);
  drawAmbient(ctx, X0, Y0, d, t);

  // --- particle ---
  const now = performance.now() / 1000;
  ctx.font = '17px sans-serif';
  parts = parts.filter((p) => now - p.at < 1.6);
  for (const p of parts) {
    const age = now - p.at;
    if (age < 0) continue;
    ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
    ctx.fillText(p.txt, X0 + p.x + p.vx * age, Y0 + p.y + p.vy * age - 20 * age * age);
  }
  ctx.globalAlpha = 1;

  // --- ánh sáng ấm trong nhà + tối viền ---
  ctx.fillStyle = 'rgba(255,186,92,.07)'; ctx.fillRect(0, 0, vw, vh);
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,0,.34)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
}
