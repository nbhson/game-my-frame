import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { useVillage, farmVisible, visiblePlayers } from '../net/village';
import type { InteractTarget } from '../game/types';
import { FARM_GATE_SPAWN, PIERS, WORLD, isBlocked, plotPos } from '../game/world';
import { FARM_GATE, TOWN, TOWN_PROPS, TOWN_SPAWN, isTownBlocked } from '../game/town';
import { MAX_PLOTS } from '../game/data';
import { KEM_UID, nearestInteract, nearestPet, nearestStealPlot, nearestTownInteract } from '../game/systems';
import { renderWorld, type VisitorDraw } from '../game/render';
import { renderTown } from '../game/townRender';
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
/** Kem — mèo cam đi theo chủ (lệnh kemkem). Vị trí mượt theo frame, render + interact đọc ở đây. */
export const kemRef = { x: 660, y: 630, flip: true };
let kemInit = false;

export function doInteractWith(t: InteractTarget | null | undefined) {
  const s = useGame.getState();
  // đang ngồi câu: E = thu cần (khi cá cắn phải bấm dãy mũi tên, E không giật được)
  if (s.fishingSpot) { s.reelRiver(); return; }
  const v = useVillage.getState();
  if (!t) return;
  // --- chuyển map ---
  if (t.kind === 'townGate') { goToTown(); return; }
  if (t.kind === 'farmGate') { goToFarm(); return; }
  if (t.kind === 'townProp') {
    const p = TOWN_PROPS.find((x) => x.id === t.propId);
    sfx.click();
    if (p?.id === 'casino') {
      s.setModal('casino');
      return;
    }
    if (p?.id === 'shop') {
      s.setModal('outfit');
      return;
    }
    if (p?.id === 'hall' || p?.id === 'cafe' || p?.id === 'stage' || p?.id === 'house1' || p?.id === 'house2') {
      s.setModal({ name: 'house', house: p.id });
      return;
    }
    if (p?.id === 'fountain') {
      if (s.xu >= 10) {
        s.addXu(-10);
        v.sendEmote('✨');
        s.toast('Bạn tung 10 xu ước nguyện! Chúc may mắn ✨');
        s.addXP(2);
      } else s.toast(p.hint);
    } else if (p) s.toast(`${p.label}: ${p.hint}`);
    else s.toast(t.label);
    return;
  }
  // hái trộm trong farm bạn (E khi đang visit) — cho qua trước chặn visit
  if (t.kind === 'steal' && t.index != null) { void v.stealFromVisit(t.index); return; }
  // xoa đầu / vuốt ve pet (farm mình hay farm bạn đều được) — cho qua trước chặn visit
  if (t.kind === 'pet' && t.uid != null) { s.petPet(t.uid); return; }
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

/** Vào công viên: nhớ vị trí farm, spawn ở đầu công viên, rời visit nếu có */
export function goToTown() {
  const s = useGame.getState();
  const v = useVillage.getState();
  if (s.scene === 'town') return;
  if (s.fishingSpot) s.cancelRiver(true);
  if (v.visiting) v.leaveVisit();
  farmPos.x = playerRef.x; farmPos.y = playerRef.y;
  s.setScene('town');
  playerRef.x = TOWN_SPAWN.x; playerRef.y = TOWN_SPAWN.y;
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  sfx.click();
  s.toast('Tới Công viên rồi! Gặp gỡ, chat, thả cảm xúc cùng cả làng');
}

/** Về nông trại: quay lại đúng chỗ cũ */
export function goToFarm() {
  const s = useGame.getState();
  if (s.scene === 'farm') return;
  if (s.fishingSpot) s.cancelRiver(true);
  s.setScene('farm');
  playerRef.x = farmPos.x ?? FARM_GATE_SPAWN.x;
  playerRef.y = farmPos.y ?? FARM_GATE_SPAWN.y;
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  sfx.click();
  s.toast('Về tới nông trại!');
}

// nhớ vị trí farm trước khi qua town để quay lại đúng chỗ
const farmPos: { x: number | null; y: number | null } = { x: null, y: null };

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
  const view = useRef({ w: 1360, h: 850 });
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
      // đang gõ chat/input: nhường phím cho ô nhập
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
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
      // Zoom khung nhìn: + gần lại, − xa rộng ra (lưu lại, áp dụng cả farm + công viên)
      if (k === '=' || k === '+') { st.setViewH(st.viewH - 70); return; }
      if (k === '-' || k === '_') { st.setViewH(st.viewH + 70); return; }
      // Mini-game giật cá: dãy mũi tên thay cho E (cá giá trị cao → dãy dài hơn, 3s)
      if (st.fishingSpot && (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright')) {
        const dir = k === 'arrowup' ? 'up' : k === 'arrowdown' ? 'down' : k === 'arrowleft' ? 'left' : 'right';
        st.pressBiteKey(dir as 'up' | 'down' | 'left' | 'right');
        return;
      }
      if (k === 'e' || k === ' ') doInteractWith(targetRef.current);
      // NOTE: không dùng S làm shortcut shop vì S là phím đi xuống (WASD)
      if (k === 'b') st.setModal('bag');
      if (k === 'q') st.setModal('quest');
      if (k === 'h') st.setModal('help');
      if (k === 'v') st.setModal('village');
      if (k === 'g') st.setModal('gift');
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

      // --- movement (khóa khi mở modal hoặc đang ngồi câu; town đi tự do) ---
      if (!st.modal && !st.fishingSpot) {
        let mx = 0, my = 0;
        const K = keys.current;
        if (K['arrowup'] || K['w']) my -= 1;
        if (K['arrowdown'] || K['s']) my += 1;
        if (K['arrowleft'] || K['a']) mx -= 1;
        if (K['arrowright'] || K['d']) mx += 1;
        mx += joyRef.x; my += joyRef.y;
        const SPD = 260;
        const blocked = (x: number, y: number) => (st.scene === 'town' ? isTownBlocked(x, y) : isBlocked(x, y));
        if (mx || my) {
          playerRef.tx = null; playerRef.ty = null;
          const l = Math.hypot(mx, my) || 1;
          const nx = playerRef.x + (mx / l) * SPD * dt;
          const ny = playerRef.y + (my / l) * SPD * dt;
          if (!blocked(nx, playerRef.y)) playerRef.x = nx;
          if (!blocked(playerRef.x, ny)) playerRef.y = ny;
          playerRef.moving = true;
          if (mx !== 0) playerRef.dir = mx > 0 ? 1 : -1;
        } else if (playerRef.tx != null && playerRef.ty != null) {
          const dx = playerRef.tx - playerRef.x, dy = playerRef.ty - playerRef.y;
          const d = Math.hypot(dx, dy);
          if (d < 8) { playerRef.tx = null; playerRef.ty = null; playerRef.moving = false; }
          else {
            const nx = playerRef.x + (dx / d) * SPD * dt;
            const ny = playerRef.y + (dy / d) * SPD * dt;
            if (!blocked(nx, playerRef.y)) playerRef.x = nx;
            if (!blocked(playerRef.x, ny)) playerRef.y = ny;
            playerRef.moving = true;
            playerRef.dir = dx > 0 ? 1 : -1;
          }
        } else playerRef.moving = false;
      } else playerRef.moving = false;

      // --- viewport: mặc định xa rộng (viewH), zoom ra thêm 0.8x khi ra bờ sông để thấy sông rộng ---
      // (máy quay lên cao / xa hơn, thấy rộng hơn; mượt bằng lerp mỗi frame)
      {
        const sc = screen.current;
        const base = st.viewH || 1050;
        const targetH = st.scene === 'town' ? base : (playerRef.y > 980 ? base * 0.8 : base);
        const k = Math.min(1, dt * 2.5);
        view.current.h += (targetH - view.current.h) * k;
        if (Math.abs(view.current.h - targetH) < 0.5) view.current.h = targetH;
        view.current.w = view.current.h * (sc.cssW / sc.cssH);
        zoom.current = (sc.cssH / view.current.h) * sc.dpr;
      }

      cam.current.x = clampCam(playerRef.x - view.current.w / 2, st.scene === 'town' ? TOWN.w : WORLD.w, view.current.w);
      cam.current.y = clampCam(playerRef.y - view.current.h / 2, st.scene === 'town' ? TOWN.h : WORLD.h, view.current.h);

      // --- tick simulation (tạm dừng khi đang thăm farm bạn; town vẫn tick farm ngầm) ---
      const village = useVillage.getState();
      if (!village.visiting) st.tick(dt);

      // Hết 3s chưa bấm xong dãy mũi tên → cá chạy (reelRiver xử lý fail)
      if (st.fishingSpot && st.biteUntil && nowMs > st.biteUntil) st.reelRiver();

      // phát vị trí cho làng (để bạn bè thấy mình đi lại, kèm map + emote)
      village.pushPosition(playerRef.x, playerRef.y, playerRef.dir, playerRef.moving);

      // --- Kem đi theo chủ (mèo cam lệnh kemkem): bám sau lưng, xa thì chạy, gần thì ngồi ---
      // neo sau lưng chủ 44px + lệch xuống 34px; đổi map/teleport (>550px) thì bắt kịp ngay
      const kemAnchor = st.fishingSpot ? { x: st.fishingSpot.x, y: st.fishingSpot.y } : playerRef;
      let kem: { x: number; y: number } | null = null;
      let kemMoving = false;
      if (st.kem) {
        if (!kemInit) { kemRef.x = kemAnchor.x - 40; kemRef.y = kemAnchor.y + 30; kemInit = true; }
        const kx = kemAnchor.x - playerRef.dir * 44, ky = kemAnchor.y + 34;
        const kdx = kx - kemRef.x, kdy = ky - kemRef.y;
        const kd = Math.hypot(kdx, kdy);
        if (kd > 550) { kemRef.x = kx; kemRef.y = ky; }
        else if (kd > 4) {
          const ksp = kd > 170 ? 400 : 250; // xa thì phi, gần thì đủng đỉnh đi bộ
          const kstep = Math.min(kd, ksp * dt);
          kemRef.x += (kdx / kd) * kstep;
          kemRef.y += (kdy / kd) * kstep;
        }
        if (Math.abs(kdx) > 6) kemRef.flip = kdx >= 0;
        kemMoving = Math.hypot(kx - kemRef.x, ky - kemRef.y) > 46;
        kem = { x: kemRef.x, y: kemRef.y };
      } else kemInit = false;
      const kemPos = kem ? { x: kem.x, y: kem.y, moving: kemMoving, flip: kemRef.flip, sitting: !kemMoving } : null;

      // --- interact scan ---
      // farm mình: tương tác đủ thứ; farm bạn: chỉ tìm ô chín để hái trộm (coi chừng chó!); town: luôn tương tác props/cổng
      const visitSnap = village.visiting?.snap;
      // farm bạn: ưu tiên ô chín để hái trộm, rồi pet nhà bạn, rồi Kem đi theo mình
      const visitSteal = village.visiting && visitSnap ? nearestStealPlot(visitSnap.plots, playerRef.x, playerRef.y) : null;
      const visitPet = !visitSteal && village.visiting ? nearestPet(playerRef.x, playerRef.y, t) : null;
      const visitKem = !visitSteal && (!visitPet || visitPet.d >= 95) && kem
        ? Math.hypot(playerRef.x - kem.x, playerRef.y - kem.y)
        : Infinity;
      const near = st.scene === 'town'
        ? nearestTownInteract({ px: playerRef.x, py: playerRef.y, kem })
        : village.visiting && visitSnap
          ? visitSteal ?? (visitPet && visitPet.d < 95 ? visitPet.target : null)
            ?? (visitKem < 95 ? { kind: 'pet', uid: KEM_UID, label: 'Vuốt ve Kem' } : null)
          : nearestInteract({
            px: playerRef.x, py: playerRef.y,
            plots: (visitSnap?.plots ?? st.plots), fishes: (visitSnap?.fishes ?? st.fishes), pondSlots: st.pondSlots, animals: (visitSnap?.animals ?? st.animals),
            pesticide: st.inv.pesticide || 0,
            now: nowMs, t, kem,
          });
      const prev = targetRef.current;
      if (JSON.stringify(prev) !== JSON.stringify(near)) {
        targetRef.current = near;
        onTargetRef.current(near);
      }

      // --- render (farm / town) ---
      // town: ai cũng thấy nhau; farm: riêng tư (chỉ chủ + khách cùng thăm)
      // trộm mới bị chó sủa → gắn bóng "Bị chó sủa!" trên đầu nó 5s để cả farm thấy
      const lt = village.lastThief;
      const visitors: VisitorDraw[] = (st.scene === 'town'
        ? visiblePlayers(nowMs, 'town')
        : farmVisible(nowMs, village.visiting?.code ?? null)
      ).map((p) => {
        const barked = !!lt && p.name === lt.name && nowMs - lt.at < 5000;
        return {
          x: p.x, y: p.y, dir: p.dir, moving: p.moving,
          name: p.name, avatar: p.avatar,
          bubble: barked ? 'Bị chó sủa! Gâu gâu!' : p.bubble,
          bubbleAt: barked ? lt.at : p.bubbleAt,
          emote: p.emote, emoteAt: p.emoteAt,
          self: false,
        };
      });
      // bóng chat + emote của chính mình (vẽ qua visitor self để tái dùng)
      if (village.selfBubble || village.selfEmote) {
        visitors.push({
          x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving,
          name: st.name, avatar: st.avatar, bubble: undefined, bubbleAt: undefined,
          emote: undefined, emoteAt: undefined,
          self: true,
        });
      }
      const fs = st.fishingSpot;
      const biting = !!fs && st.biteAt != null && st.biteUntil != null && nowMs >= st.biteAt && nowMs <= st.biteUntil;
      if (st.scene === 'town') {
        renderTown(ctx, view.current.w, view.current.h, cam.current, {
          player: { x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving, tx: playerRef.tx, ty: playerRef.ty, name: st.name },
          avatar: st.avatar, dayTime: st.dayTime, weather: st.weather,
          visitors,
          selfBubble: village.selfBubble || undefined,
          selfEmote: village.selfEmote || undefined,
          selfEmoteAt: village.selfEmoteAt || undefined,
          kemPos, petFx: st.petFx,
          outfit: st.outfit,
          quality: st.quality,
        }, t);
      } else {
        const snap = village.visiting?.snap;
        const viewPlots = snap?.plots ?? st.plots;
        const viewFishes = snap?.fishes ?? st.fishes;
        const viewAnimals = snap?.animals ?? st.animals;
        renderWorld(ctx, view.current.w, view.current.h, cam.current, {
          plots: viewPlots, fishes: viewFishes, animals: viewAnimals,
          pondSlots: st.pondSlots, coopCap: st.coopCap,
          player: { x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving, tx: playerRef.tx, ty: playerRef.ty, name: st.name },
          avatar: st.avatar, dayTime: st.dayTime, weather: st.weather,
          visitors,
          selfBubble: village.selfBubble || undefined,
          selfEmote: village.selfEmote || undefined,
          selfEmoteAt: village.selfEmoteAt || undefined,
          kemPos,
          sit: fs ? { x: fs.x, y: fs.y, bx: fs.bx, by: fs.by, bite: biting, combo: st.biteCombo, progress: st.biteProgress, fishId: st.biteCatchId } : null,
          catchPop: st.catchPop,
          outfit: st.outfit,
          plotFx: st.plotFx,
          quality: st.quality,
          thiefBite: st.thiefBiteUntil,
          petFx: st.petFx,
        }, t);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const resize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const cssW = Math.max(320, wrap.clientWidth);
      const cssH = Math.max(320, wrap.clientHeight);
      // DPR theo cấp đồ họa: Thấp khóa 1x, TB tối đa 1.25x, Cao tối đa 1.5x
      const q = useGame.getState().quality;
      const dpr = q === 'low' ? 1 : q === 'medium' ? Math.min(1.25, window.devicePixelRatio || 1) : Math.min(1.5, window.devicePixelRatio || 1);
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

  // đổi cấp đồ họa → dựng lại canvas (DPR) ngay, không cần reload
  const quality = useGame((s) => s.quality);
  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const cssW = Math.max(320, wrap.clientWidth);
    const cssH = Math.max(320, wrap.clientHeight);
    const dpr = quality === 'low' ? 1 : quality === 'medium' ? Math.min(1.25, window.devicePixelRatio || 1) : Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    screen.current = { cssW, cssH, dpr };
  }, [quality]);

  const onPointer = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * view.current.w;
    const sy = ((e.clientY - r.top) / r.height) * view.current.h;
    const st = useGame.getState();
    const inTown = st.scene === 'town';
    const MW = inTown ? TOWN.w : WORLD.w, MH = inTown ? TOWN.h : WORLD.h;
    const wx = Math.max(20, Math.min(MW - 20, sx + cam.current.x));
    const wy = Math.max(60, Math.min(MH - 20, sy + cam.current.y));
    // đang câu: click = thu cần (khi cá cắn phải bấm dãy mũi tên)
    if (st.fishingSpot) { st.reelRiver(); return; }
    const blocked = inTown ? isTownBlocked(wx, wy) : isBlocked(wx, wy);
    if (!blocked) { playerRef.tx = wx; playerRef.ty = wy; }
  if (inTown) return;
  // đang thăm farm bạn: click trúng ô chín + đứng gần → hái trộm (coi chừng chó!)
  const visiting = useVillage.getState().visiting;
  if (visiting) {
    const splots = visiting.snap.plots;
    for (let i = 0; i < splots.length; i++) {
      const pl = splots[i];
      if (!pl || pl.locked || pl.state !== 'ready' || !pl.crop) continue;
      const p = plotPos(i);
      if (Math.hypot(wx - p.x, wy - p.y) < 70 && Math.hypot(playerRef.x - p.x, playerRef.y - p.y) < 170) {
        void useVillage.getState().stealFromVisit(i);
        return;
      }
    }
    return;
  }
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

/** Hint khi đang ngồi câu: chờ cắn → hiện dãy mũi tên phải bấm trong 3s */
function RiverHint() {
  const spot = useGame((s) => s.fishingSpot);
  const biteAt = useGame((s) => s.biteAt);
  const biteUntil = useGame((s) => s.biteUntil);
  const combo = useGame((s) => s.biteCombo);
  const progress = useGame((s) => s.biteProgress);
  const pressBiteKey = useGame((s) => s.pressBiteKey);
  const [, force] = useState(0);
  useEffect(() => {
    if (!spot) return;
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [spot]);
  if (!spot) return null;
  const now = Date.now();
  const biting = biteAt != null && biteUntil != null && now >= biteAt && now <= biteUntil;
  if (!biting) {
    return (
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 border-[3px] border-[#2b2117] rounded-full px-5 py-2 font-extrabold shadow-pixel whitespace-nowrap z-30 bg-[#fff8dc] animate-pulse pointer-events-none max-w-[94vw] overflow-hidden text-ellipsis">
        Đang đợi cá… (E: thu cần)
      </div>
    );
  }
  const remainMs = Math.max(0, (biteUntil ?? now) - now);
  const totalMs = Math.max(1, (biteUntil ?? now) - (biteAt ?? now));
  const remainS = (remainMs / 1000).toFixed(1);
  const pct = Math.round((remainMs / totalMs) * 100);
  const urgent = remainMs < 1000;
  const pads: { dir: 'up' | 'down' | 'left' | 'right'; label: string }[] = [
    { dir: 'up', label: '↑' },
    { dir: 'down', label: '↓' },
    { dir: 'left', label: '←' },
    { dir: 'right', label: '→' },
  ];
  return (
    <div className={`absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 border-4 border-[#2b2117] rounded-2xl px-4 py-3 md:px-6 md:py-4 font-extrabold shadow-pixel z-30 text-center pointer-events-none max-w-[94vw] ${urgent ? 'bg-red-400 text-white' : 'bg-[#fff8dc]'}`}>
      <div className="text-base md:text-xl animate-bounce whitespace-nowrap">🎣 CÁ CẮN CÂU! Bấm theo thứ tự ({remainS}s)</div>
      <div className="flex gap-1.5 md:gap-2 justify-center mt-2 flex-wrap">
        {(combo ?? []).map((d, i) => (
          <span
            key={i}
            className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-2xl md:text-3xl rounded-lg border-[3px] border-[#2b2117] ${i < progress ? 'bg-green-400' : i === progress ? 'bg-yellow-300 animate-pulse scale-110' : 'bg-white'}`}
          >
            {d === 'up' ? '↑' : d === 'down' ? '↓' : d === 'left' ? '←' : '→'}
          </span>
        ))}
      </div>
      <div className="h-2 md:h-2.5 mt-2 rounded-full bg-black/20 overflow-hidden">
        <div className={`h-full ${urgent ? 'bg-red-600' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
      {/* D-pad cho mobile / click chuột — desktop bấm phím mũi tên */}
      <div className="flex gap-2 justify-center mt-2 pointer-events-auto">
        {pads.map((p) => (
          <button
            key={p.dir}
            onPointerDown={(e) => { e.stopPropagation(); pressBiteKey(p.dir); }}
            className="w-12 h-12 md:w-14 md:h-14 text-2xl md:text-3xl rounded-xl bg-sky-300 border-[3px] border-[#2b2117] active:scale-90 font-black"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] md:text-xs mt-1 opacity-80">Bấm sai 1 phím hoặc hết giờ là cá chạy!</div>
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
