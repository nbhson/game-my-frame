import { useEffect, useRef, useState } from 'react';
import { useGame, VIEW_H_MAX } from '../game/store';
import { useVillage, farmVisible, gameMe, visiblePlayers } from '../net/village';
import type { InteractTarget } from '../game/types';
import { FARM_GATE_SPAWN, PIERS, WORLD, isBlocked, plotPos } from '../game/world';
import { FARM_GATE, MALL_GATE, TOWN, TOWN_PROPS, TOWN_SPAWN, isTownBlocked } from '../game/town';
import { MALL, MALL_PIERS, MALL_PROPS, MALL_SPAWN, RACE_CPS, RACE_CP_R, isMallBlocked, isOnRaceTrack, mallTownGateCenter } from '../game/mall';
import { CARS, MAX_PLOTS } from '../game/data';
import { KEM_UID, nearestInteract, nearestMallInteract, nearestPet, nearestStealPlot, nearestTownInteract } from '../game/systems';
import { renderWorld, type VisitorDraw } from '../game/render';
import { renderTown } from '../game/townRender';
import { renderMall } from '../game/mallRender';
import { INTERIORS, isInteriorBlocked, nearestInteriorInteract } from '../game/interiors';
import { renderInterior } from '../game/interiorRender';
import { openInteriorFurn, tickInteriorEvents } from '../game/interiorActions';
import { startAutoSync, stopAutoSync } from '../net/account';
import { checkRaceCp, finishRace, raceBotPos, raceGridSlot, tickRace, useRace, RACE_BOT_STYLE, RACE_LAPS } from '../net/race';
import { sfx } from '../game/audio';

/** Đưa cả người về đường đua khi giải bắt đầu (từ farm/nhà/town đều được) */
function goRaceTrack() {
  const s = useGame.getState();
  if (s.scene === 'interior') exitInterior();
  if (s.fishingSpot) s.cancelRiver(true);
  if (s.scene === 'mall') return;
  if (s.scene === 'farm') goToTown();
  if (useGame.getState().scene === 'town') goToMall();
}
/** đã xếp ô xuất phát cho lượt đếm ngược hiện tại chưa */
let raceGridDone = '';

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

/** So sánh target rẻ (thay JSON.stringify mỗi frame): đủ kind/index/uid/pen/propId/label */
function sameTarget(a: InteractTarget | null, b: InteractTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && (a.index ?? -1) === (b.index ?? -1)
    && (a.uid ?? -1) === (b.uid ?? -1) && (a.pen ?? '') === (b.pen ?? '')
    && (a.propId ?? '') === (b.propId ?? '') && a.label === b.label;
}

/** DPR theo cấp đồ họa hiệu dụng: Thấp khóa 1x, TB tối đa 1.25x, Cao tối đa 1.5x */
export function dprFor(q: string): number {
  const dpr = window.devicePixelRatio || 1;
  return q === 'low' ? 1 : q === 'medium' ? Math.min(1.25, dpr) : Math.min(1.5, dpr);
}

/** Cấp hiệu dụng = Auto ? autoLevel : quality (tay chọn) */
export function effQuality(): string {
  const s = useGame.getState();
  return s.autoQuality ? s.autoLevel : s.quality;
}

/** Tỉ lệ điểm ảnh render thêm sau DPR: auto = low 0.6 / medium 0.85 / high 1 */
export function resScaleFor(mode: string, effQ: string): number {
  if (mode === 'low') return 0.5;
  if (mode === 'med') return 0.75;
  if (mode === 'full') return 1;
  return effQ === 'low' ? 0.6 : effQ === 'medium' ? 0.85 : 1;
}

/** Dựng lại kích thước canvas theo CSS khung + DPR + scale. Trả về dpr hiệu dụng (đã nhân scale). */
export function applyCanvasSize(cv: HTMLCanvasElement, cssW: number, cssH: number): number {
  const s = useGame.getState();
  const effQ = s.autoQuality ? s.autoLevel : s.quality;
  const dpr = dprFor(effQ) * resScaleFor(s.resMode, effQ);
  cv.width = Math.max(2, Math.round(cssW * dpr));
  cv.height = Math.max(2, Math.round(cssH * dpr));
  return dpr;
}

export function doInteractWith(t: InteractTarget | null | undefined) {
  const s = useGame.getState();
  // đang ngồi câu: E = thu cần (khi cá cắn phải bấm dãy mũi tên, E không giật được)
  if (s.fishingSpot) { s.reelRiver(); return; }
  const v = useVillage.getState();
  if (!t) return;
  // --- chuyển map ---
  if (t.kind === 'townGate') { goToTown(); return; }
  if (t.kind === 'farmGate') { goToFarm(); return; }
  if (t.kind === 'mallGate') { goToMall(); return; }
  if (t.kind === 'interior') {
    if (t.propId === 'door') { exitInterior(); return; }
    if (t.propId) { sfx.click(); openInteriorFurn(t.propId, playerRef.x, playerRef.y); }
    return;
  }
  if (t.kind === 'townProp') {
    const p = TOWN_PROPS.find((x) => x.id === t.propId) ?? MALL_PROPS.find((x) => x.id === t.propId);
    sfx.click();
    if (p?.id === 'casino' || p?.id === 'garage' || p?.id === 'mart') {
      goToInterior(p.id === 'mart' ? 'shop' : p.id);
      return;
    }
    if (p?.id === 'xoso' || p?.id === 'race' || p?.id === 'wolf') {
      goToInterior(p.id === 'race' ? 'racehouse' : p.id === 'wolf' ? 'wolfhouse' : p.id);
      return;
    }
    if (p?.id === 'lottery') {
      s.setModal('lottery');
      return;
    }
    if (p?.id === 'hall' || p?.id === 'cafe' || p?.id === 'stage' || p?.id === 'house1' || p?.id === 'house2') {
      goToInterior(p.id);
      return;
    }
    if (p?.id === 'garden') {
      if (!s.daily.flags['garden']) {
        s.setDailyFlag('garden');
        s.addXP(2);
        s.toast('Bạn ngồi vườn hoa hít hà hương đồng gió nội! (+2 XP)');
      } else s.toast('Vườn hoa thơm ngát — mai quay lại hít tiếp nhé!');
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
  // đang lái ô tô: xuống xe (X / Gara) rồi hẵng làm ruộng — lái xe chỉ để vi vu
  if (s.activeCar) {
    s.toast('Đang lái xe! Bấm X (hoặc vào Gara) để xuống xe rồi làm nhé 🚗');
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

/** Vào thị trấn: nhớ vị trí farm/mall, spawn ở đầu thị trấn (hoặc về chỗ cũ nếu từ khu mua sắm sang), rời visit nếu có */
export function goToTown() {
  const s = useGame.getState();
  const v = useVillage.getState();
  if (s.scene === 'interior') exitInterior();
  if (s.scene === 'town') return;
  if (s.fishingSpot) s.cancelRiver(true);
  if (v.visiting) v.leaveVisit();
  if (s.scene === 'farm') { farmPos.x = playerRef.x; farmPos.y = playerRef.y; }
  if (s.scene === 'mall') { mallPos.x = playerRef.x; mallPos.y = playerRef.y; }
  const fromMall = s.scene === 'mall';
  s.setScene('town');
  if (fromMall && townPos.x != null && townPos.y != null) { playerRef.x = townPos.x; playerRef.y = townPos.y; }
  else { playerRef.x = TOWN_SPAWN.x; playerRef.y = TOWN_SPAWN.y; }
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  sfx.click();
  s.toast(fromMall ? 'Về tới Thị trấn!' : 'Tới Thị trấn rồi! Gặp gỡ, chat, thả cảm xúc cùng cả làng');
}

/** Lên Khu mua sắm & Giải trí (chỉ đi từ thị trấn): nhớ chỗ town, spawn ở cổng khu mới */
export function goToMall() {
  const s = useGame.getState();
  const v = useVillage.getState();
  if (s.scene === 'interior') exitInterior();
  if (s.scene === 'mall') return;
  if (s.scene !== 'town') return;
  if (s.fishingSpot) s.cancelRiver(true);
  if (v.visiting) v.leaveVisit();
  townPos.x = playerRef.x; townPos.y = playerRef.y;
  s.setScene('mall');
  playerRef.x = MALL_SPAWN.x; playerRef.y = MALL_SPAWN.y;
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  sfx.click();
  s.toast('Tới Khu Mua sắm & Giải trí! Gara, casino, vé số, sông câu cá, trường đua, hang sói!');
}

/** Về nông trại: quay lại đúng chỗ cũ */
export function goToFarm() {
  const s = useGame.getState();
  if (s.scene === 'farm') return;
  if (s.scene === 'interior') exitInterior();
  if (s.scene === 'mall') { mallPos.x = playerRef.x; mallPos.y = playerRef.y; }
  if (s.scene === 'town') { townPos.x = playerRef.x; townPos.y = playerRef.y; }
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
// nhớ vị trí town trước khi vào nhà / sang khu mua sắm để về đúng chỗ
const townPos: { x: number | null; y: number | null } = { x: null, y: null };
// nhớ vị trí khu mua sắm trước khi vào nhà / về town / về farm
const mallPos: { x: number | null; y: number | null } = { x: null, y: null };

/** Vào nhà: nhớ chỗ map ngoài, teleport vào cửa phòng, khóa câu cá */
export function goToInterior(id: string) {
  const s = useGame.getState();
  const d = INTERIORS[id];
  if (!d) return;
  if (s.scene !== 'town' && s.scene !== 'mall') return;
  if (s.fishingSpot) s.cancelRiver(true);
  // gara cho lái xe vào thẳng trong (showroom lái thử); nhà khác thì xuống xe ở cửa
  if (s.activeCar && id !== 'garage') s.driveCar(null);
  if (s.scene === 'mall') { mallPos.x = playerRef.x; mallPos.y = playerRef.y; }
  else { townPos.x = playerRef.x; townPos.y = playerRef.y; }
  s.setScene('interior');
  s.setInteriorId(id);
  s.setInAct(null);
  // dấu hành trình: ghé nhà nào đóng dấu nhà đó (nhận thưởng ở bảng hội quán)
  s.setDailyFlag('visit:' + id);
  playerRef.x = d.spawn.x; playerRef.y = d.spawn.y;
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  sfx.click();
  s.toast(`Vào ${d.name}! Đi lại + bấm E vào đồ đạc để tương tác`);
}

/** Ra khỏi nhà: về đúng map + đúng chỗ lúc vào */
export function exitInterior() {
  const s = useGame.getState();
  if (s.scene !== 'interior') return;
  const d = INTERIORS[s.interiorId ?? ''];
  const via = d?.via ?? 'town';
  s.setScene(via);
  s.setInteriorId(null);
  s.setInAct(null);
  const saved = via === 'mall' ? mallPos : townPos;
  if (saved.x != null && saved.y != null) { playerRef.x = saved.x; playerRef.y = saved.y; }
  else if (d) {
    const p = (via === 'mall' ? MALL_PROPS : TOWN_PROPS).find((x) => x.id === d.id)
      ?? (via === 'mall' ? MALL_PROPS : TOWN_PROPS).find((x) => (via === 'mall' ? mallPropToInterior(x.id) : x.id) === d.id);
    if (p) { playerRef.x = p.x; playerRef.y = p.y; }
  }
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  sfx.click();
  s.toast(via === 'mall' ? 'Ra ngoài khu mua sắm!' : 'Ra ngoài thị trấn!');
}

/** prop ngoài map -> interior tương ứng (mart=shop, race=racehouse, wolf=wolfhouse) */
function mallPropToInterior(propId: string): string {
  if (propId === 'mart') return 'shop';
  if (propId === 'race') return 'racehouse';
  if (propId === 'wolf') return 'wolfhouse';
  return propId;
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
  const st = useGame.getState();
  const inMall = st.scene === 'mall' || pier >= 100;
  const p = inMall ? MALL_PIERS[pier >= 100 ? pier - 100 : pier] : PIERS[pier];
  if (!p) return;
  // ngồi câu thì phải xuống xe trước
  if (useGame.getState().activeCar) useGame.getState().driveCar(null);
  // ngồi xuống bến
  playerRef.x = p.x; playerRef.y = p.sitY;
  playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
  useGame.getState().startRiverFishing(pier, baitId, inMall ? 'mall' : 'farm');
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
  // HUD hiệu năng: fps + cấp đang chạy (cập nhật 1s/lần, rẻ)
  const [perf, setPerf] = useState({ fps: 0, q: 'medium' });
  const perfRef = useRef(setPerf);
  perfRef.current = setPerf;

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
    // --- auto quality theo FPS thật: <42 hạ 1 cấp (3s cooldown), >57 bền 8s tăng 1 cấp ---
    let acc = 0, n = 0, lastAdj = 0, goodSince = 0, lastPerfPush = 0;
    // --- interact scan throttle: quét lại khi quá 120ms hoặc đi xa 8px ---
    let scanAt = 0, scanX = 0, scanY = 0;

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
        st.setInAct(null);
        return;
      }
      if (st.modal) return;
      // đang mở panel hành động trong nhà: overlay tự xử lý E/Space, game nhường phím
      if (st.inAct) return;
      // Zoom khung nhìn: + gần lại, − xa rộng ra (lưu lại, áp dụng cả farm + thị trấn)
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
      // X: đang lái thì xuống xe; chưa lái thì mở Gara (có xe) / chỉ đường ra Gara (chưa có xe)
      if (k === 'x') {
        if (st.activeCar) st.driveCar(null);
        else if (st.ownedCars.length) st.setModal('carshop');
        else st.toast('Chưa có xe! Ghé Gara Anh Tý ở Khu mua sắm (đi thị trấn rồi lên đông-bắc) nhé 🚗');
      }
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
      const effQ = (st.autoQuality ? st.autoLevel : st.quality) as 'low' | 'medium' | 'high';
      // --- đo FPS + tự chỉnh cấp (chỉ khi bật Auto) ---
      acc += dt; n++;
      if (acc >= 1) {
        const fps = n / acc;
        acc = 0; n = 0;
        if (nowMs - lastPerfPush > 1000) {
          lastPerfPush = nowMs;
          perfRef.current({ fps: Math.round(fps), q: effQ });
        }
        if (st.autoQuality) {
          const order: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
          const idx = order.indexOf(st.autoLevel);
          if (fps < 42 && idx > 0 && nowMs - lastAdj > 3000) {
            st.setAutoLevel(order[idx - 1]);
            lastAdj = nowMs; goodSince = 0;
          } else if (fps > 57 && idx < 2) {
            if (!goodSince) goodSince = nowMs;
            if (nowMs - goodSince > 8000 && nowMs - lastAdj > 3000) {
              st.setAutoLevel(order[idx + 1]);
              lastAdj = nowMs; goodSince = 0;
            }
          } else if (fps <= 57) {
            goodSince = 0;
          }
        }
      }
      // hệ quả của cover-scale: vẽ trong đơn vị logic
      ctx.setTransform(zoom.current, 0, 0, zoom.current, 0, 0);

      // --- movement (khóa khi mở modal/panel, đang ngồi câu, hoặc đang đếm ngược xuất phát) ---
      const racePhase = useRace.getState().phase;
      if (!st.modal && !st.fishingSpot && !st.inAct && racePhase !== 'count') {
        let mx = 0, my = 0;
        const K = keys.current;
        if (K['arrowup'] || K['w']) my -= 1;
        if (K['arrowdown'] || K['s']) my += 1;
        if (K['arrowleft'] || K['a']) mx -= 1;
        if (K['arrowright'] || K['d']) mx += 1;
        mx += joyRef.x; my += joyRef.y;
        // đang lái ô tô: chạy theo tốc độ xe (nhanh hơn đi bộ nhiều);
        // cà phê trứng: chạy nhanh 60s
        const car = st.activeCar ? CARS[st.activeCar] : null;
        const SPD = car ? car.speed : st.speedUntil && Date.now() < st.speedUntil ? 330 : 260;
        const iid = st.scene === 'interior' ? st.interiorId : null;
        // đang đua: khóa xe trong vòng track (khỏi chạy lạc ra ngoài)
        const racing = st.scene === 'mall' && useRace.getState().phase === 'racing';
        const blocked = racing
          ? (x: number, y: number) => !isOnRaceTrack(x, y)
          : (x: number, y: number) => (st.scene === 'town' ? isTownBlocked(x, y) : st.scene === 'mall' ? isMallBlocked(x, y) : st.scene === 'interior' && iid ? isInteriorBlocked(iid, x, y) : isBlocked(x, y));
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

      // --- đua xe thật: đếm ngược thì lùa về vạch xuất phát, đang đua thì chấm chốt ---
      {
        const rz = useRace.getState();
        if (rz.phase === 'count') {
          const key = `${rz.host}|${rz.goAt}`;
          goRaceTrack();
          if (useGame.getState().scene === 'mall' && raceGridDone !== key) {
            raceGridDone = key;
            const slot = Math.max(0, rz.racers.indexOf(gameMe().name));
            const g = raceGridSlot(slot);
            playerRef.x = g.x; playerRef.y = g.y;
            playerRef.tx = null; playerRef.ty = null; playerRef.moving = false;
          }
        } else {
          if (rz.phase !== 'racing') raceGridDone = '';
          if (rz.phase === 'racing' && useGame.getState().scene === 'mall') {
            const next = checkRaceCp(playerRef.x, playerRef.y);
            if (next && next.lap >= RACE_LAPS) finishRace();
          }
        }
        tickRace(nowMs);
      }

      // --- viewport: khung nhìn theo cài đặt (viewH); ra bờ sông / đang ngồi câu thì
      // thu xa để thấy sông rộng + cả người + cần + phao, kẹp trong max (mượt bằng lerp) ---
      {
        const sc = screen.current;
        const base = st.viewH || 1050;
        const fs0 = st.fishingSpot;
        // ra bờ sông thì thu xa 1.15x — riêng khi đã ngồi câu thì giữ đúng zoom của
        // người chơi (không ép zoom-out) để framing bên dưới tính chính xác
        let targetH = st.scene === 'town' || st.scene === 'mall' || fs0 ? base : (playerRef.y > 980 ? Math.min(VIEW_H_MAX, base * 1.15) : base);
        // đang ngồi câu: đảm bảo span (đầu người → phao + margin) lọt trong 70% màn hình
        // ở mọi resolution / mức zoom (kể cả zoom gần nhất 620)
        if (fs0) {
          const fTop = Math.min(fs0.y, fs0.by) - 170;
          const fBottom = Math.max(fs0.y, fs0.by) + 120;
          targetH = Math.min(VIEW_H_MAX, Math.max(targetH, (fBottom - fTop) / 0.7));
        }
        const k = Math.min(1, dt * 2.5);
        view.current.h += (targetH - view.current.h) * k;
        if (Math.abs(view.current.h - targetH) < 0.5) view.current.h = targetH;
        view.current.w = view.current.h * (sc.cssW / sc.cssH);
        zoom.current = (sc.cssH / view.current.h) * sc.dpr;
      }

      {
        // trong nhà: giữa phòng (phòng nhỏ hơn viewport thì clampCam tự giữa)
        const idef = st.scene === 'interior' ? INTERIORS[st.interiorId ?? ''] : undefined;
        const mapW = idef ? idef.w : st.scene === 'town' ? TOWN.w : st.scene === 'mall' ? MALL.w : WORLD.w;
        cam.current.x = clampCam(playerRef.x - view.current.w / 2, mapW, view.current.w);
      }
      // đang ngồi câu: căn khung theo điểm câu (đáy span ở 80% màn hình) + cho phép
      // tràn nhẹ 10% qua mép nam để cần + phao + sông luôn full hình ở mọi resolution
      {
        const fs = st.fishingSpot;
        const idef = st.scene === 'interior' ? INTERIORS[st.interiorId ?? ''] : undefined;
        const mapH = idef ? idef.h : st.scene === 'town' ? TOWN.h : st.scene === 'mall' ? MALL.h : WORLD.h;
        if (idef) {
          cam.current.y = clampCam(playerRef.y - view.current.h / 2, idef.h, view.current.h);
        } else if (fs && view.current.h < mapH) {
          const fBottom = Math.max(fs.y, fs.by) + 120;
          const minY = -view.current.h * 0.45;
          const maxY = mapH - view.current.h + view.current.h * 0.1;
          cam.current.y = Math.max(minY, Math.min(maxY, fBottom - view.current.h * 0.8));
        } else if (fs) {
          cam.current.y = (mapH - view.current.h) / 2;
        } else {
          // 2.5D Hay Day: player nằm ở 60% chiều cao màn hình + cho camera ngó lên trên
          // vùng trời (cam.y âm) để nửa trên luôn là background như ảnh mẫu
          cam.current.y = clampCamY(playerRef.x, playerRef.y, st.scene === 'town' ? TOWN.h : st.scene === 'mall' ? MALL.h : WORLD.h, view.current.h);
        }
      }

      // --- tick simulation (tạm dừng khi đang thăm farm bạn; town vẫn tick farm ngầm) ---
      const village = useVillage.getState();
      if (!village.visiting) st.tick(dt);

      // Hết 3s chưa bấm xong dãy mũi tên → cá chạy (reelRiver xử lý fail)
      if (st.fishingSpot && st.biteUntil && nowMs > st.biteUntil) st.reelRiver();

      // sự kiện theo giờ trong nhà (giờ diễn mèo, giờ vàng slot, đèn yêu cầu)
      if (st.scene === 'interior' && st.interiorId) tickInteriorEvents(playerRef.x, playerRef.y);

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

      // --- interact scan (throttle 120ms / 8px di chuyển — trước đây quét full + JSON.stringify mỗi frame) ---
      // đứng yên vẫn quét lại mỗi 120ms để bắt kịp cây chín/pet đi ngang
      const moved = Math.hypot(playerRef.x - scanX, playerRef.y - scanY);
      if (targetRef.current == null || nowMs - scanAt > 120 || moved > 8) {
        scanAt = nowMs; scanX = playerRef.x; scanY = playerRef.y;
      const visitSnap = village.visiting?.snap;
      // farm bạn: ưu tiên ô chín để hái trộm, rồi pet nhà bạn, rồi Kem đi theo mình
      const visitSteal = village.visiting && visitSnap ? nearestStealPlot(visitSnap.plots, playerRef.x, playerRef.y) : null;
      const visitPet = !visitSteal && village.visiting ? nearestPet(playerRef.x, playerRef.y, t) : null;
      const visitKem = !visitSteal && (!visitPet || visitPet.d >= 95) && kem
        ? Math.hypot(playerRef.x - kem.x, playerRef.y - kem.y)
        : Infinity;
      const near = st.scene === 'interior' && st.interiorId
        ? nearestInteriorInteract(st.interiorId, playerRef.x, playerRef.y)
        : st.scene === 'town'
        ? nearestTownInteract({ px: playerRef.x, py: playerRef.y, kem })
        : st.scene === 'mall'
        ? nearestMallInteract({ px: playerRef.x, py: playerRef.y, kem })
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
      if (!sameTarget(prev, near)) {
        targetRef.current = near;
        onTargetRef.current(near);
      }
      } // end interact scan throttle

      // --- render (farm / town) ---
      // town: ai cũng thấy nhau; farm: riêng tư (chỉ chủ + khách cùng thăm)
      // trộm mới bị chó sủa → gắn bóng "Bị chó sủa!" trên đầu nó 5s để cả farm thấy
      const lt = village.lastThief;
      const visitors: VisitorDraw[] = (st.scene === 'town'
        ? visiblePlayers(nowMs, 'town')
        : st.scene === 'mall'
        ? visiblePlayers(nowMs, 'mall')
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
      if (st.scene === 'interior' && st.interiorId && INTERIORS[st.interiorId]) {
        // trong nhà: phòng riêng, không vẽ khách + không câu cá
        renderInterior(ctx, view.current.w, view.current.h, cam.current, st.interiorId, {
          player: { x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving, name: st.name },
          avatar: st.avatar, outfit: st.outfit,
          carColor: st.activeCar ? CARS[st.activeCar]?.color ?? null : null,
          carKind: st.activeCar ? CARS[st.activeCar]?.kind ?? null : null,
          carId: st.activeCar ?? null,
          stageColor: st.stageColor,
          night: st.dayTime < 0.2 || st.dayTime > 0.8,
        }, t);
      } else if (st.scene === 'town') {
        renderTown(ctx, view.current.w, view.current.h, cam.current, {
          player: { x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving, tx: playerRef.tx, ty: playerRef.ty, name: st.name },
          avatar: st.avatar, dayTime: st.dayTime, weather: st.weather,
          visitors,
          selfBubble: village.selfBubble || undefined,
          selfEmote: village.selfEmote || undefined,
          selfEmoteAt: village.selfEmoteAt || undefined,
          kemPos, petFx: st.petFx,
          outfit: st.outfit,
          carColor: st.activeCar ? CARS[st.activeCar]?.color ?? null : null,
          carKind: st.activeCar ? CARS[st.activeCar]?.kind ?? null : null,
          carId: st.activeCar ?? null,
          quality: effQ,
        }, t);
      } else if (st.scene === 'mall') {
        const mallSit = fs && fs.at === 'mall'
          ? { x: fs.x, y: fs.y, bx: fs.bx, by: fs.by, bite: biting, combo: st.biteCombo, progress: st.biteProgress, fishId: st.biteCatchId }
          : null;
        // đang đua / đếm ngược: hiện cọc số các chốt + mũi tên chỉ chốt tiếp + xe bot
        const rz2 = useRace.getState();
        const racingLive = rz2.phase === 'count' || rz2.phase === 'racing' || rz2.phase === 'done';
        const raceHud = racingLive
          ? (() => {
            const mine = rz2.progress[gameMe().name] ?? { lap: 0, cp: 0 };
            return { cps: RACE_CPS, next: mine.cp, r: RACE_CP_R, lap: mine.lap, laps: RACE_LAPS };
          })()
          : null;
        const raceBots = racingLive
          ? raceBotPos().map((b) => ({ ...b, ...(RACE_BOT_STYLE[b.name] ?? { color: '#999999', shirt: '#666666' }) }))
          : null;
        renderMall(ctx, view.current.w, view.current.h, cam.current, {
          player: { x: playerRef.x, y: playerRef.y, dir: playerRef.dir, moving: playerRef.moving, tx: playerRef.tx, ty: playerRef.ty, name: st.name },
          avatar: st.avatar, dayTime: st.dayTime, weather: st.weather,
          visitors,
          selfBubble: village.selfBubble || undefined,
          selfEmote: village.selfEmote || undefined,
          selfEmoteAt: village.selfEmoteAt || undefined,
          kemPos, petFx: st.petFx,
          outfit: st.outfit,
          carColor: st.activeCar ? CARS[st.activeCar]?.color ?? null : null,
          carKind: st.activeCar ? CARS[st.activeCar]?.kind ?? null : null,
          carId: st.activeCar ?? null,
          quality: effQ,
          sit: mallSit,
          catchPop: st.catchPop,
          race: raceHud,
          raceBots,
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
          carColor: st.activeCar ? CARS[st.activeCar]?.color ?? null : null,
          carKind: st.activeCar ? CARS[st.activeCar]?.kind ?? null : null,
          carId: st.activeCar ?? null,
          plotFx: st.plotFx,
          quality: effQ,
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
      // DPR hiệu dụng = DPR(cấp đồ họa) x scale(độ phân giải); canvas nhỏ hơn CSS rồi upscale
      const dpr = applyCanvasSize(cv, cssW, cssH);
      const ctx2 = cv.getContext('2d');
      // upscale thì bật smoothing cho đỡ vỡ chữ/đường, còn lại giữ nét pixel
      if (ctx2) ctx2.imageSmoothingEnabled = dpr < (window.devicePixelRatio || 1);
      cv.style.width = '100%'; cv.style.height = '100%';
      screen.current = { cssW, cssH, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => { cancelAnimationFrame(raf); stopAutoSync(); ro.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi cấp đồ họa (tay hay auto) / độ phân giải → dựng lại canvas ngay, không cần reload
  const quality = useGame((s) => s.quality);
  const autoQuality = useGame((s) => s.autoQuality);
  const autoLevel = useGame((s) => s.autoLevel);
  const resMode = useGame((s) => s.resMode);
  // đang thăm farm bạn thì banner chiếm top-center → FPS lùi xuống dưới banner
  const visiting = useVillage((v) => !!v.visiting);
  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const cssW = Math.max(320, wrap.clientWidth);
    const cssH = Math.max(320, wrap.clientHeight);
    const dpr = applyCanvasSize(cv, cssW, cssH);
    const ctx2 = cv.getContext('2d');
    if (ctx2) ctx2.imageSmoothingEnabled = dpr < (window.devicePixelRatio || 1);
    screen.current = { cssW, cssH, dpr };
  }, [quality, autoQuality, autoLevel, resMode]);

  const onPointer = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * view.current.w;
    const sy = ((e.clientY - r.top) / r.height) * view.current.h;
    const st = useGame.getState();
    const scene = st.scene;
    const idef = scene === 'interior' ? INTERIORS[st.interiorId ?? ''] : undefined;
    const MW = idef ? idef.w : scene === 'town' ? TOWN.w : scene === 'mall' ? MALL.w : WORLD.w;
    const MH = idef ? idef.h : scene === 'town' ? TOWN.h : scene === 'mall' ? MALL.h : WORLD.h;
    const wx = Math.max(20, Math.min(MW - 20, sx + cam.current.x));
    const wy = Math.max(60, Math.min(MH - 20, sy + cam.current.y));
    // đang câu: click = thu cần (khi cá cắn phải bấm dãy mũi tên)
    if (st.fishingSpot) { st.reelRiver(); return; }
    const blocked = idef && st.interiorId ? isInteriorBlocked(st.interiorId, wx, wy) : scene === 'town' ? isTownBlocked(wx, wy) : scene === 'mall' ? isMallBlocked(wx, wy) : isBlocked(wx, wy);
    if (!blocked) { playerRef.tx = wx; playerRef.ty = wy; }
  if (scene === 'town' || scene === 'mall' || idef) return;
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
      {/* HUD hiệu năng: để TOP-CENTER cho chắc chắn thấy ở mọi bản đồ —
          top-2 left-2 bị bảng vé số đè, top-2 right-2 bị bảng đua top đè,
          bottom-2 left bị joystick đè (mobile), bottom-2 right bị nút E đè (mobile),
          bottom-center thì canvas tràn là bị thanh chat đè mất */}
      <div className={`absolute left-1/2 -translate-x-1/2 z-[6] pointer-events-none select-none rounded-md border-2 border-black/60 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white/90 whitespace-nowrap ${visiting ? 'top-11 md:top-12' : 'top-2'}`}>
        {perf.fps > 0 ? `${perf.fps}fps · ` : ''}{perf.q === 'low' ? 'Thấp' : perf.q === 'medium' ? 'TB' : 'Cao'}{autoQuality ? ' · Auto' : ''}
      </div>
      <div className="absolute right-3 bottom-3 flex gap-2 md:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          className="w-14 h-14 rounded-full text-xl font-black bg-yellow-300 border-[3px] border-[#2b2117] shadow-pixel active:scale-95 touch-manipulation select-none"
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
      <div className="absolute top-14 left-1/2 -translate-x-1/2 border-[3px] border-[#2b2117] rounded-full px-5 py-2 font-extrabold shadow-pixel whitespace-nowrap z-30 bg-[#fff8dc] animate-pulse pointer-events-none max-w-[94vw] overflow-hidden text-ellipsis">
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
// 2.5D: camera Y ngó lên vùng trời (âm tới 45% viewH) để nửa trên là background;
// ở khu nam (chuồng/sông, y>850) neo player thấp (~42%) + cho tràn nhẹ 6% qua mép
// nam để sông + bến luôn lọt khung ở mọi mức zoom
function clampCamY(_px: number, py: number, worldH: number, viewH: number): number {
  const minY = -viewH * 0.45;
  const maxY = Math.max(minY, worldH - viewH + viewH * 0.06);
  const anchor = py > 850 ? 0.42 : 0.6;
  return Math.max(minY, Math.min(maxY, py - viewH * anchor));
}

function InteractHint({ target }: { target: InteractTarget }) {
  return (
    <div className="absolute bottom-[5.5rem] md:bottom-20 left-1/2 -translate-x-1/2 bg-[#fff8dc] border-[3px] border-[#2b2117] rounded-full px-3 md:px-5 py-1.5 md:py-2 text-[12px] md:text-base font-extrabold shadow-pixel animate-bounce whitespace-nowrap z-[5] max-w-[92vw] overflow-hidden text-ellipsis pointer-events-none">
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
      className="absolute left-3 bottom-3 w-24 h-24 md:w-28 md:h-28 rounded-full border-[3px] border-white/50 bg-white/10 hidden max-md:block touch-none select-none"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); setFromEvent(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) setFromEvent(e.clientX, e.clientY); }}
      onPointerUp={() => { id.current = null; joyRef.x = 0; joyRef.y = 0; if (knob.current) knob.current.style.transform = 'translate(-50%,-50%)'; }}
      onPointerCancel={() => { id.current = null; joyRef.x = 0; joyRef.y = 0; }}
    >
      <div ref={knob} className="absolute left-1/2 top-1/2 w-12 h-12 bg-yellow-300 border-[3px] border-[#2b2117] rounded-full" style={{ transform: 'translate(-50%,-50%)' }} />
    </div>
  );
}
