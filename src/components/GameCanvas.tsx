import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { useVillage, visiblePlayers } from '../net/village';
import type { InteractTarget } from '../game/types';
import { PIERS, WORLD, isBlocked, plotPos } from '../game/world';
import { MAX_PLOTS } from '../game/data';
import { nearestInteract } from '../game/systems';
import { renderWorld, type VisitorDraw } from '../game/render';
import { startAutoSync, stopAutoSync } from '../net/account';
import { sfx } from '../game/audio';

interface Props {
  target: InteractTarget | null;
  onTarget: (t: InteractTarget | null) => void;
}

export interface PlayerRef {
  x: number; y: number; dir: 1 | -1; moving: boolean;
  tx: number | null; ty: number | null;
}

// module-level để BottomBar nút E dùng chung
export const playerRef: PlayerRef = { x: 700, y: 600, dir: 1, moving: false, tx: null, ty: null };
export const joyRef = { x: 0, y: 0 };

export function doInteractWith(t: InteractTarget | null | undefined) {
  const s = useGame.getState();
  // đang ngồi câu: E = giật cần / thu cần
  if (s.fishingSpot) { s.reelRiver(); return; }
  const v = useVillage.getState();
  if (!t) return;
  if (v.visiting) {
    // đang thăm farm bạn: chỉ được đi dạo + chat (kiểu Avatar)
    s.toast('Đang thăm farm bạn — về farm mình để làm việc nhé!');
    return;
  }
  sfx.click();
  if (t.kind === 'plot' && t.index != null) s.interactPlot(t.index);
  else if (t.kind === 'pond') s.interactPond(t.uid);
  else if (t.kind === 'river' && t.index != null) startRiverAt(t.index);
  else if (t.kind === 'pen' && t.pen) { s.setModal({ name: 'pen', pen: t.pen }); }
  else if (t.kind === 'animal' && t.uid != null) s.interactAnimal(t.uid);
  else if (t.kind === 'shop') { s.setShopTab('seed'); s.setModal('shop'); }
}

/** Bắt đầu ngồi câu ở bến: chọn mồi (nếu có 2 loại thì mở bảng chọn) */
function startRiverAt(pier: number) {
  const s = useGame.getState();
  const hasNormal = (s.inv.bait || 0) > 0;
  const hasPro = (s.inv.baitPro || 0) > 0;
  if (!hasNormal && !hasPro) { sfx.error(); s.toast('Hết mồi câu! Mua ở cửa hàng'); return; }
  if (hasNormal && hasPro) { s.setModal({ name: 'bait', pier }); return; }
  sitAndFish(pier, hasPro ? 'baitPro' : 'bait');
}

export function sitAndFish(pier: number, baitId: string) {
  const p = PIERS[pier];
  if (!p) return;
  // ngồi xuống bến
  playerRef.x = p.x; playerRef.y = p.sitY;
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  useGame.getState().startRiverFishing(pier, baitId);
}

export default function GameCanvas({ target, onTarget }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<InteractTarget | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const cam = useRef({ x: 0, y: 0 });
  const view = useRef({ w: 1200, h: 750 });
  const zoom = useRef(1);
  // kích thước khung chứa (px css) + dpr: nguồn duy nhất để suy ra view/zoom
  const screen = useRef({ cssW: 960, cssH: 600, dpr: 1 });
  const fishingSpot = useGame((s) => s.fishingSpot);

  // giữ onTarget mới nhất
  const onTargetRef = useRef(onTarget);
  onTargetRef.current = onTarget;

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // vào làng multiplayer + autosync farm theo username
    void useVillage.getState().connect();
    startAutoSync();
    let raf = 0;
    let last = performance.now();

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      const st = useGame.getState();
      if (k === 'escape') {
        if (st.fishingSpot) st.cancelRiver();
        st.setModal(null);
        return;
      }
      if (st.modal) return;
      if (k === 'e' || k === ' ') doInteractWith(targetRef.current);
      // NOTE: không dùng S làm shortcut shop vì S là phím đi xuống (WASD)
      if (k === 'b') st.setModal('bag');
      if (k === 'q') st.setModal('quest');
      if (k === 'h') st.setModal('help');
      if (k === 'v') st.setModal('village');
    };
    const keyup = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = useGame.getState();
      const nowMs = Date.now();
      // hệ quả của cover-scale: vẽ trong đơn vị logic
      ctx.setTransform(zoom.current, 0, 0, zoom.current, 0, 0);

      // --- movement (khóa khi mở modal hoặc đang ngồi câu) ---
      if (!st.modal && !st.fishingSpot) {
        let mx = 0, my = 0;
        const K = keys.current;
        if (K['arrowup'] || K['w']) my -= 1;
        if (K['arrowdown'] || K['s']) my += 1;
        if (K['arrowleft'] || K['a']) mx -= 1;
        if (K['arrowright'] || K['d']) mx += 1;
        mx += joyRef.x; my += joyRef.y;
        const SPD = 260;
        if (mx || my) {
          playerRef.tx = null; playerRef.ty = null;
          const l = Math.hypot(mx, my) || 1;
          const nx = playerRef.x + (mx / l) * SPD * dt;
          const ny = playerRef.y + (my / l) * SPD * dt;
          if (!isBlocked(nx, playerRef.y)) playerRef.x = nx;
          if (!isBlocked(playerRef.x, ny)) playerRef.y = ny;
          playerRef.moving = true;
          if (mx !== 0) playerRef.dir = mx > 0 ? 1 : -1;
        } else if (playerRef.tx != null && playerRef.ty != null) {
          const dx = playerRef.tx - playerRef.x, dy = playerRef.ty - playerRef.y;
          const d = Math.hypot(dx, dy);
          if (d < 8) { playerRef.tx = null; playerRef.ty = null; playerRef.moving = false; }
          else {
            const nx = playerRef.x + (dx / d) * SPD * dt;
            const ny = playerRef.y + (dy / d) * SPD * dt;
            if (!isBlocked(nx, playerRef.y)) playerRef.x = nx;
            if (!isBlocked(playerRef.x, ny)) playerRef.y = ny;
            playerRef.moving = true;
            playerRef.dir = dx > 0 ? 1 : -1;
          }
        } else playerRef.moving = false;
      } else playerRef.moving = false;

      // --- viewport: cao 750 thường, zoom ra 600 khi ra bờ sông để thấy sông rộng ---
      // (máy quay lên cao / xa hơn, thấy rộng hơn; mượt bằng lerp mỗi frame)
      {
        const sc = screen.current;
        const targetH = playerRef.y > 980 ? 600 : 750;
        const k = Math.min(1, dt * 2.5);
        view.current.h += (targetH - view.current.h) * k;
        if (Math.abs(view.current.h - targetH) < 0.5) view.current.h = targetH;
        view.current.w = view.current.h * (sc.cssW / sc.cssH);
        zoom.current = (sc.cssH / view.current.h) * sc.dpr;
      }

      cam.current.x = clampCam(playerRef.x - view.current.w / 2, WORLD.w, view.current.w);
      cam.current.y = clampCam(playerRef.y - view.current.h / 2, WORLD.h, view.current.h);

      // --- tick simulation (tạm dừng khi đang thăm farm bạn) ---
      const village = useVillage.getState();
      if (!village.visiting) st.tick(dt);

      // cá chạy mất nếu không giật kịp (tự thu cần sau 2.5s quá giờ)
      if (st.fishingSpot && st.biteUntil && nowMs > st.biteUntil + 2500) st.reelRiver();

      // phát vị trí cho làng (để bạn bè thấy mình đi lại)
      village.pushPosition(playerRef.x, playerRef.y, playerRef.dir, playerRef.moving);

      // --- farm đang xem: farm mình hay farm bạn (visit) ---
      const snap = village.visiting?.snap;
      const viewPlots = snap?.plots ?? st.plots;
      const viewFishes = snap?.fishes ?? st.fishes;
      const viewAnimals = snap?.animals ?? st.animals;

      // --- interact scan (visit = chỉ xem, không tương tác) ---
      const near = village.visiting
        ? null
        : nearestInteract({
          px: playerRef.x, py: playerRef.y,
          plots: viewPlots, fishes: viewFishes, pondSlots: st.pondSlots, animals: viewAnimals,
          now: nowMs, t,
        });
      const prev = targetRef.current;
      if (JSON.stringify(prev) !== JSON.stringify(near)) {
        targetRef.current = near;
        onTargetRef.current(near);
      }

      // --- render ---
      const visitors: VisitorDraw[] = visiblePlayers(nowMs).map((p) => ({
        x: p.x, y: p.y, dir: p.dir, moving: p.moving,
        name: p.name, avatar: p.avatar, bubble: p.bubble, bubbleAt: p.bubbleAt,
        self: false,
      }));
      // bóng chat của chính mình
      if (village.selfBubble) {
        visitors.push({
          x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving,
          name: st.name, avatar: st.avatar, bubble: undefined, bubbleAt: undefined,
          self: true,
        });
      }
      const fs = st.fishingSpot;
      const biting = !!fs && st.biteAt != null && st.biteUntil != null && nowMs >= st.biteAt && nowMs <= st.biteUntil;
      renderWorld(ctx, view.current.w, view.current.h, cam.current, {
        plots: viewPlots, fishes: viewFishes, animals: viewAnimals,
        pondSlots: st.pondSlots, coopCap: st.coopCap,
        player: { x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving, tx: playerRef.tx, ty: playerRef.ty, name: st.name },
        avatar: st.avatar, dayTime: st.dayTime,
        visitors,
        selfBubble: village.selfBubble || undefined,
        sit: fs ? { x: fs.x, y: fs.y, bx: fs.bx, by: fs.by, bite: biting } : null,
      }, t);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const resize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const cssW = Math.max(320, wrap.clientWidth);
      const cssH = Math.max(320, wrap.clientHeight);
      // DPR tối đa 1.5 cho nhẹ
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      cv.style.width = '100%'; cv.style.height = '100%';
      screen.current = { cssW, cssH, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => { cancelAnimationFrame(raf); stopAutoSync(); ro.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointer = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * view.current.w;
    const sy = ((e.clientY - r.top) / r.height) * view.current.h;
    const wx = Math.max(20, Math.min(WORLD.w - 20, sx + cam.current.x));
    const wy = Math.max(60, Math.min(WORLD.h - 20, sy + cam.current.y));
    const st = useGame.getState();
    // đang câu: click = giật cần
    if (st.fishingSpot) { st.reelRiver(); return; }
    playerRef.tx = wx; playerRef.ty = wy;
    // đang thăm farm bạn: chỉ đi dạo, không chạm vào đồ của bạn
    if (useVillage.getState().visiting) return;
    // click trúng ô ruộng thì tương tác ngay nếu đủ gần
    for (let i = 0; i < MAX_PLOTS; i++) {
      const p = plotPos(i);
      if (Math.hypot(wx - p.x, wy - p.y) < 70) {
        if (Math.hypot(playerRef.x - p.x, playerRef.y - p.y) < 140) st.interactPlot(i);
        break;
      }
    }
  };

  return (
    <div ref={wrapRef} className="relative flex-1 min-h-0 w-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={960}
        height={600}
        onPointerDown={onPointer}
        className="border-4 border-black bg-[#7ec850] cursor-pointer block"
      />
      {target && !fishingSpot && <InteractHint target={target} />}
      <RiverHint />
      <Joystick />
      <div className="absolute right-3 bottom-3 flex gap-2 md:hidden">
        <button
          className="w-16 h-16 rounded-full text-2xl font-black bg-yellow-300 border-[3px] border-[#2b2117] shadow-pixel active:scale-95"
          onClick={() => doInteractWith(targetRef.current)}
        >
          E
        </button>
      </div>
    </div>
  );
}

/** Hint khi đang ngồi câu: cập nhật theo nhịp cắn câu */
function RiverHint() {
  const spot = useGame((s) => s.fishingSpot);
  const biteAt = useGame((s) => s.biteAt);
  const biteUntil = useGame((s) => s.biteUntil);
  const [, force] = useState(0);
  useEffect(() => {
    if (!spot) return;
    const id = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [spot]);
  if (!spot) return null;
  const now = Date.now();
  const biting = biteAt != null && biteUntil != null && now >= biteAt && now <= biteUntil;
  return (
    <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 border-[3px] border-[#2b2117] rounded-full px-5 py-2 font-extrabold shadow-pixel whitespace-nowrap z-[5] ${biting ? 'bg-red-400 text-white animate-bounce text-lg' : 'bg-[#fff8dc] animate-pulse'}`}>
      {biting ? 'GIẬT NGAY (E)!' : 'Đang đợi cá… (E: thu cần)'}
    </div>
  );
}

// giữ camera trong map (giữa màn hình nếu viewport lớn hơn map)
function clampCam(c: number, worldSize: number, viewSize: number): number {
  if (viewSize >= worldSize) return (worldSize - viewSize) / 2;
  return Math.max(0, Math.min(worldSize - viewSize, c));
}

function InteractHint({ target }: { target: InteractTarget }) {
  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#fff8dc] border-[3px] border-[#2b2117] rounded-full px-5 py-2 font-extrabold shadow-pixel animate-bounce whitespace-nowrap z-[5]">
      E: {target.label}
    </div>
  );
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);

  const setFromEvent = (cx: number, cy: number) => {
    const el = base.current!;
    const r = el.getBoundingClientRect();
    const bx = r.left + r.width / 2, by = r.top + r.height / 2;
    let dx = (cx - bx) / (r.width / 2), dy = (cy - by) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    joyRef.x = dx; joyRef.y = dy;
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx * 30}px), calc(-50% + ${dy * 30}px))`;
  };

  return (
    <div
      ref={base}
      className="absolute left-3 bottom-3 w-28 h-28 rounded-full border-[3px] border-white/50 bg-white/10 hidden max-md:block touch-none"
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); setFromEvent(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) setFromEvent(e.clientX, e.clientY); }}
      onPointerUp={() => { id.current = null; joyRef.x = 0; joyRef.y = 0; if (knob.current) knob.current.style.transform = 'translate(-50%,-50%)'; }}
      onPointerCancel={() => { id.current = null; joyRef.x = 0; joyRef.y = 0; }}
    >
      <div ref={knob} className="absolute left-1/2 top-1/2 w-12 h-12 bg-yellow-300 border-[3px] border-[#2b2117] rounded-full" style={{ transform: 'translate(-50%,-50%)' }} />
    </div>
  );
}
