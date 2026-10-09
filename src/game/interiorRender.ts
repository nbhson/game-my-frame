// ===== Vẽ NỘI THẤT 6 nhà: sàn/tường/đồ đạc/NPC/particle, phong cách anime =====
// Tái dùng drawPlayerDetailed (người chơi) + depthScale để cùng chất với farm/town.
import { INTERIORS, type InteriorDef } from './interiors';
import { drawPlayerDetailed } from './render';
import { SHIRTS, shirtColorOf } from './data';

export interface InteriorPlayer {
  x: number; y: number; dir: 1 | -1; moving: boolean; name: string;
}
interface RenderOpts {
  player: InteriorPlayer;
  avatar: number;
  outfit?: Record<string, string>;
  stageColor: string;
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
  else { ctx.beginPath(); ctx.arc(x, y - 57 + bob, 11, Math.PI, 0); ctx.fill(); }
  // mặt
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x - 4, y - 53 + bob, 1.6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4, y - 53 + bob, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a4a2b'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x, y - 50 + bob, 3.4, 0.2, Math.PI - 0.2); ctx.stroke();
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
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x - 5, y - 43, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5, y - 43, 1.8, 0, 7); ctx.fill();
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
    ctx.fillStyle = '#bfe6ff'; rr(ctx, wx + 5, Y0 + 57, 110, 54, 4); ctx.fill();
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
        if (n.look === 'cat') drawCatNpc(ctx, X0 + n.x, Y0 + n.y, n.fur ?? '#f5f5f5', n.name, t, n.x, n.id);
        else drawHuman(ctx, X0 + n.x, Y0 + n.y, n.look, n.name, t, n.x);
      },
    });
  }
  const shirt = shirtColorOf(o.outfit, SHIRTS[o.avatar % SHIRTS.length]);
  layers.push({
    y: o.player.y, fn: () => drawPlayerDetailed(ctx, X0 + o.player.x, Y0 + o.player.y, o.player.dir, o.player.moving, shirt, o.player.name, t, o.outfit),
  });
  layers.sort((a, b) => a.y - b.y).forEach((l) => l.fn());

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
