// ===== Interact system: tìm đối tượng gần player nhất =====
import type { Animal, InteractTarget, PondFish } from './types';
import { ANIMALS, COOP_TYPES, CROPS, FISHES, plotCost, plotReq } from './data';
import { BARN, COOP, PEN_MB, PIERS, SHOPD, POND, ROAD_H, ROAD_V, TOWN_GATE, isBlocked, pondInner, plotPos, RIVER_WATER_Y, roadHCenter, roadVCenter } from './world';
import { FARM_GATE, TOWN_PROPS, farmGateCenter, mallGateCenter } from './town';
import { MALL_PIERS, MALL_PROPS, mallTownGateCenter } from './mall';

export interface InteractCtx {
  px: number; py: number;
  plots: { state: string; crop: string | null; watered: boolean; locked: boolean; pest?: boolean }[];
  fishes: PondFish[];
  pondSlots: number;
  animals: Animal[];
  pesticide: number; // số thuốc trừ sâu trong kho (hiện trong nhãn)
  now: number; t: number;
  /** Kem — mèo cam đi theo chủ (lệnh kemkem). null = chưa triệu hồi */
  kem?: { x: number; y: number } | null;
}

/** uid riêng của Kem (kênh pet E + petFx dùng chung với thú farm) */
export const KEM_UID = 301;

/** hash giả ngẫu nhiên ổn định 0..1 — waypoint không nhảy khi re-render */
function hash01(seed: number): number {
  let h = (seed * 2654435761) | 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}

/** Chuồng của từng loài: nhỏ ở chuồng gà–vịt, lớn ở trại bò–heo–cừu */
export function animalHome(type: string) {
  return COOP_TYPES.includes(type) ? COOP : BARN;
}

function animalWaypoint(uid: number, seg: number, home: { x: number; y: number; w: number; h: number }) {
  const rx = hash01(uid * 131 + seg * 2 + 7);
  const ry = hash01(uid * 131 + seg * 2 + 8 + 1000);
  const mx = 52, my = 46;
  return {
    x: home.x + mx + rx * Math.max(20, home.w - mx * 2),
    y: home.y + my + ry * Math.max(20, home.h - my * 2),
  };
}

/** Thú nuôi đi lang thang RANDOM trong chuồng (waypoint ngẫu nhiên theo uid, nghỉ chân mỗi chặng).
 *  Thuần hàm theo (uid, t) nên mọi máy thấy cùng vị trí, không cần đồng bộ mạng. */
export function animalPos(a: Animal, t: number): { x: number; y: number; flip: boolean; moving: boolean } {
  const home = animalHome(a.type);
  const SEG = 8 + hash01(a.uid * 7 + 3) * 5; // mỗi chặng 8–13s, khác nhau từng con
  const tt = Math.max(0, t);
  const seg = Math.floor(tt / SEG);
  const k = (tt - seg * SEG) / SEG; // 0..1 trong chặng
  const p0 = animalWaypoint(a.uid, seg, home);
  const p1 = animalWaypoint(a.uid, seg + 1, home);
  // nghỉ chân đầu chặng rồi mới đi (tỉ lệ nghỉ khác nhau từng con)
  const rest = 0.15 + hash01(a.uid * 13 + 5) * 0.25;
  const kk = k < rest ? 0 : (k - rest) / (1 - rest);
  const e = kk <= 0 ? 0 : kk >= 1 ? 1 : kk * kk * (3 - 2 * kk); // smoothstep
  // đi vòng nhẹ cho tự nhiên (cong đường đi)
  const bend = Math.sin(e * Math.PI) * (hash01(a.uid * 29 + seg) - 0.5) * 46;
  const x = p0.x + (p1.x - p0.x) * e;
  const y = p0.y + (p1.y - p0.y) * e + bend * 0.4;
  const moving = kk > 0 && kk < 1;
  return { x, y, flip: p1.x >= p0.x, moving };
}

/** Vị trí bơi của 1 con cá trong ao vuông (tự do — không chia ngăn).
 *  Mỗi con một quỹ đạo Lissajous riêng: tâm lệch + bán kính + tốc độ +
 *  chiều bơi + tần số y khác nhau (hash ổn định theo uid nên mọi máy thấy giống nhau). */
export function fishPos(f: PondFish, t: number) {
  const pc = pondInner();
  const dir = hash01(f.uid * 3 + 11) > 0.5 ? 1 : -1; // chiều bơi riêng (thuận/ngược)
  const sp = 0.22 + hash01(f.uid * 5 + 1) * 0.33; // tốc độ riêng
  const a = t * sp * dir + hash01(f.uid * 7 + 2) * Math.PI * 2; // pha riêng
  // tâm quỹ đạo lệch khỏi giữa ao (giữ trong ao: |dx| <= 0.85*hw)
  const cx = pc.x + (hash01(f.uid * 17 + 5) - 0.5) * pc.hw * 0.5;
  const cy = pc.y + (hash01(f.uid * 19 + 6) - 0.5) * pc.hh * 0.4;
  const rx = pc.hw * (0.3 + hash01(f.uid * 11 + 3) * 0.4); // 0.3..0.7 hw
  const ry = pc.hh * (0.28 + hash01(f.uid * 13 + 4) * 0.34); // 0.28..0.62 hh
  const k = 1.05 + hash01(f.uid * 23 + 7) * 0.6; // tỉ số tần số y riêng (đường bơi khác hẳn nhau)
  return {
    x: cx + Math.cos(a) * rx,
    y: cy + Math.sin(a * k) * ry,
    flip: (-Math.sin(a) * dir) > 0, // mặt hướng theo vận tốc x
  };
}

// ---------- thú cưng lang thang: 2 chó tuần tra đường + 3 mèo dạo cỏ ----------
export type PetKind = 'dog' | 'cat';
export interface PetDef { kind: PetKind; uid: number; name: string }
export const PETS: PetDef[] = [
  { kind: 'dog', uid: 101, name: 'Vàng' },
  { kind: 'dog', uid: 102, name: 'Mực' },
  { kind: 'cat', uid: 201, name: 'Mimi' },
  { kind: 'cat', uid: 202, name: 'Tom' },
  { kind: 'cat', uid: 203, name: 'Mun' },
];

/** tam giác ping-pong 0..1..0 để pet đi qua lại, không teleport */
function pingpong(t: number, speed: number, phase: number): { v: number; dir: 1 | -1 } {
  const p = (t * speed + phase) % 2;
  return p < 1 ? { v: p, dir: 1 } : { v: 2 - p, dir: -1 };
}

export function petPos(pet: PetDef, t: number): { x: number; y: number; flip: boolean; moving: boolean; sitting: boolean } {
  const vc = roadVCenter(), hc = roadHCenter();
  if (pet.kind === 'dog') {
    if (pet.uid === 101) {
      // Vàng: tuần tra ĐƯỜNG DỌC (lên/xuống), hơi lượn sóng cho tự nhiên
      const { v } = pingpong(t, 0.07, 0.2);
      const y = 110 + v * 880;
      const x = vc + Math.sin(t * 1.8 + pet.uid) * 18;
      // thỉnh thoảng ngồi nghỉ 3s mỗi ~20s
      const sitting = (t + pet.uid) % 22 < 2.5;
      return { x, y, flip: Math.cos(t * 1.8 + pet.uid) > 0, moving: !sitting, sitting };
    }
    // Mực: tuần tra ĐƯỜNG NGANG (trái/phải)
    const { v, dir } = pingpong(t, 0.055, 0.7);
    const x = 90 + v * 1420;
    const y = hc + Math.sin(t * 2.1 + pet.uid) * 18;
    const sitting = (t + pet.uid) % 26 < 2.5;
    return { x, y, flip: dir > 0, moving: !sitting, sitting };
  }
  // mèo: đi dạo vòng tròn nhỏ quanh bãi cỏ, thỉnh thoảng ngồi liếm lông
  const spots: Record<number, { cx: number; cy: number; rx: number; ry: number; sp: number }> = {
    201: { cx: 320, cy: 130, rx: 150, ry: 42, sp: 0.35 },
    202: { cx: 1380, cy: 690, rx: 90, ry: 55, sp: 0.28 },
    203: { cx: 1420, cy: 985, rx: 110, ry: 26, sp: 0.42 },
  };
  const s = spots[pet.uid] ?? spots[201];
  const a = t * s.sp + pet.uid * 1.7;
  let x = s.cx + Math.cos(a) * s.rx + Math.sin(t * 0.9 + pet.uid) * 12;
  let y = s.cy + Math.sin(a * 1.25) * s.ry;
  // tránh đi vào ao / shop / sông: đẩy nhẹ ra nếu bị chặn
  if (isBlocked(x, y)) {
    if (x > POND.x - 30 && x < POND.x + POND.w + 30 && y > POND.y - 30 && y < POND.y + POND.h + 30) {
      y = POND.y + POND.h + 34;
    } else {
      x = Math.max(40, Math.min(1560, x));
      y = Math.max(80, Math.min(1000, y));
    }
  }
  // né đường đi một chút để không dẫm vạch giữa (trừ chó tuần tra)
  if (x > ROAD_V.x - 6 && x < ROAD_V.x + ROAD_V.w + 6) x += x < vc ? -12 : 12;
  const sitting = (t * 0.5 + pet.uid) % 18 < 3;
  return { x, y, flip: Math.sin(a) > 0, moving: !sitting && Math.abs(Math.cos(a)) > 0.08, sitting };
}

export function nearestInteract(c: InteractCtx): InteractTarget | null {
  let best: InteractTarget | null = null;
  let bd = 110;
  // --- ruộng ---
  for (let i = 0; i < c.plots.length; i++) {
    const p = plotPos(i);
    const d = Math.hypot(c.px - p.x, c.py - p.y);
    if (d < bd) {
      const pl = c.plots[i];
      let label = '';
      if (pl.locked) label = `Mở ô ${i + 1} (${plotCost(i)} xu, Lv${plotReq(i)})`;
      else if (pl.state === 'grass') label = `Cuốc đất ô ${i + 1}`;
      else if (pl.state === 'soil') label = `Gieo hạt ô ${i + 1}`;
      else if (pl.state === 'growing') label = pl.pest
        ? (c.pesticide > 0 ? `Phun thuốc ${pl.crop ? CROPS[pl.crop].name : ''} (còn ${c.pesticide})` : 'Hết thuốc! Mua ở cửa hàng')
        : pl.watered ? `${pl.crop ? CROPS[pl.crop].name : ''} đang lớn…` : `Tưới ${pl.crop ? CROPS[pl.crop].name : ''}`;
      else label = `Thu hoạch ${pl.crop ? CROPS[pl.crop].name : ''} ${pl.crop ? CROPS[pl.crop].emoji : ''}`;
      bd = d; best = { kind: 'plot', index: i, label };
    }
  }
  // --- ao: con cá bơi gần nhất ---
  for (const f of c.fishes) {
    if (!f) continue; // snapshot cũ có thể chứa ô trống null
    const p = fishPos(f, c.t);
    const d = Math.hypot(c.px - p.x, c.py - p.y);
    if (d < 95 && d < bd) {
      const F = FISHES[f.type];
      const label = f.grown ? `Thu hoạch ${F.name} ${F.emoji}` : `Cho ${F.name} ăn`;
      best = { kind: 'pond', uid: f.uid, label }; bd = d;
    }
  }
  // đứng gần ao mà không gần con nào → thả cá / báo đầy
  {
    const dx = Math.max(POND.x - c.px, 0, c.px - (POND.x + POND.w));
    const dy = Math.max(POND.y - c.py, 0, c.py - (POND.y + POND.h));
    const dEdge = Math.hypot(dx, dy);
    if (!best && dEdge < 60) {
      best = c.fishes.length < c.pondSlots
        ? { kind: 'pond', label: `Thả cá xuống ao (${c.fishes.length}/${c.pondSlots})` }
        : { kind: 'pond', label: `Ao đầy (${c.pondSlots}/${c.pondSlots}) — mở rộng ở hòm thư` };
      bd = dEdge;
    }
  }
  // --- hòm thư trước ao/chuồng: xem thông tin + mở khóa ---
  {
    const boxes: { pen: 'pond' | 'coop' | 'barn'; label: string }[] = [
      { pen: 'pond', label: 'Hòm thư ao cá' },
      { pen: 'coop', label: 'Hòm thư chuồng gà–vịt' },
      { pen: 'barn', label: 'Hòm thư trại bò–heo–cừu' },
    ];
    for (const b of boxes) {
      const m = PEN_MB[b.pen];
      const d = Math.hypot(c.px - m.x, c.py - m.y);
      if (d < 100 && (!best || d < bd)) { best = { kind: 'pen', pen: b.pen, label: b.label }; bd = d; }
    }
  }
  // --- bến sông (câu cá, KHÔNG câu ở ao nuôi) ---
  PIERS.forEach((pier, pi) => {
    const d = Math.hypot(c.px - pier.x, c.py - (pier.sitY + 20));
    if (d < 105 && (!best || d < bd)) {
      best = { kind: 'river', index: pi, label: 'Ngồi câu cá (tốn mồi)' };
      bd = d;
    }
  });
  // --- vật nuôi ---
  c.animals.forEach((a) => {
    const p = animalPos(a, c.t);
    const d = Math.hypot(c.px - p.x, c.py - p.y);
    if (d < 90 && d < bd) {
      const A = ANIMALS[a.type];
      const adult = (c.now - a.bornAt) / 1000 >= A.grow;
      let label = '';
      if (a.hunger < 60) label = `Cho ${A.name} ăn`;
      else if (a.ready && adult) label = `Thu ${A.product}`;
      else label = `${A.name} ${adult ? '' : '(con non)'} • No ${a.hunger | 0}%`;
      best = { kind: 'animal', uid: a.uid, label }; bd = d;
    }
  });
  // --- thú cưng: đứng gần chó/mèo → xoa đầu / vuốt ve ---
  const pet = nearestPet(c.px, c.py, c.t);
  if (pet && pet.d < 95 && pet.d < bd) { best = pet.target; bd = pet.d; }
  // --- Kem: mèo cam đi theo chủ (model mèo farm, vuốt ve được như pet) ---
  if (c.kem) {
    const d = Math.hypot(c.px - c.kem.x, c.py - c.kem.y);
    if (d < 95 && d < bd) { best = { kind: 'pet', uid: KEM_UID, label: 'Vuốt ve Kem' }; bd = d; }
  }
  // --- shop ---
  {
    const sx = SHOPD.x + SHOPD.w / 2, sy = SHOPD.y + SHOPD.h + 40;
    const d = Math.hypot(c.px - sx, c.py - sy);
    if (d < 110 && (!best || d < bd)) { best = { kind: 'shop', label: 'Mở Cửa hàng' }; bd = d; }
  }
  // --- cổng thị trấn (ngoài cùng bên phải, cuối đường ngang) ---
  {
    const gx = TOWN_GATE.x + TOWN_GATE.w / 2, gy = TOWN_GATE.y + TOWN_GATE.h / 2;
    const d = Math.hypot(c.px - gx, c.py - gy);
    if (d < 120 && (!best || d < bd)) { best = { kind: 'townGate', label: 'Vào Thị trấn' }; bd = d; }
  }
  void RIVER_WATER_Y;
  return best;
}

/** Interact ở khu mua sắm & giải trí: cổng về thị trấn + props + bến sông câu cá */
export function nearestMallInteract(c: { px: number; py: number; kem?: { x: number; y: number } | null }): InteractTarget | null {
  let best: InteractTarget | null = null;
  let bd = 120;
  {
    const g = mallTownGateCenter();
    const d = Math.hypot(c.px - g.x, c.py - g.y);
    if (d < 130) { best = { kind: 'townGate', label: 'Về Thị trấn' }; bd = d; }
  }
  for (const p of MALL_PROPS) {
    const d = Math.hypot(c.px - p.x, c.py - p.y);
    if (d < 100 && d < bd) { best = { kind: 'townProp', propId: p.id, label: p.label }; bd = d; }
  }
  // bến sông mall (câu cá, tính giải như sông farm)
  MALL_PIERS.forEach((pier, pi) => {
    const d = Math.hypot(c.px - pier.x, c.py - (pier.sitY + 20));
    if (d < 105 && d < bd) {
      best = { kind: 'river', index: 100 + pi, label: 'Ngồi câu cá (tốn mồi)' };
      bd = d;
    }
  });
  // Kem đi theo chủ ra cả khu mua sắm → vuốt ve được ở đây luôn
  if (c.kem) {
    const d = Math.hypot(c.px - c.kem.x, c.py - c.kem.y);
    if (d < 95 && d < bd) { best = { kind: 'pet', uid: KEM_UID, label: 'Vuốt ve Kem' }; bd = d; }
  }
  return best;
}

/** Thú cưng gần người nhất (để xoa đầu / vuốt ve) — dùng cả ở farm mình lẫn farm đang thăm */
export function nearestPet(px: number, py: number, t: number): { target: InteractTarget; d: number } | null {
  let best: InteractTarget | null = null;
  let bd = Infinity;
  for (const pet of PETS) {
    const p = petPos(pet, t);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < bd) {
      bd = d;
      best = { kind: 'pet', uid: pet.uid, label: pet.kind === 'dog' ? `Xoa đầu ${pet.name}` : `Vuốt ve ${pet.name}` };
    }
  }
  return best ? { target: best, d: bd } : null;
}

/** Ô chín có thể hái trộm trong farm đang thăm (chỉ ô ready, đứng gần mới hái được) */
export function nearestStealPlot(
  plots: { state: string; crop: string | null; locked: boolean }[],
  px: number, py: number,
): InteractTarget | null {
  let best: InteractTarget | null = null;
  let bd = 150;
  for (let i = 0; i < plots.length; i++) {
    const pl = plots[i];
    if (!pl || pl.locked || pl.state !== 'ready' || !pl.crop) continue;
    const p = plotPos(i);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < bd) {
      const c = CROPS[pl.crop];
      bd = d;
      best = { kind: 'steal', index: i, label: `Hái trộm ${c ? c.name : ''} ${c ? c.emoji : ''} (coi chừng chó!)` };
    }
  }
  return best;
}

/** Interact trong thị trấn: cổng về farm + cổng lên khu mua sắm + các điểm check-in */
export function nearestTownInteract(c: { px: number; py: number; kem?: { x: number; y: number } | null }): InteractTarget | null {
  let best: InteractTarget | null = null;
  let bd = 120;
  {
    const g = farmGateCenter();
    const d = Math.hypot(c.px - g.x, c.py - g.y);
    if (d < 130) { best = { kind: 'farmGate', label: 'Về Nông trại' }; bd = d; }
  }
  {
    const g = mallGateCenter();
    const d = Math.hypot(c.px - g.x, c.py - g.y);
    if (d < 130 && d < bd) { best = { kind: 'mallGate', label: 'Lên Khu Mua sắm & Giải trí' }; bd = d; }
  }
  for (const p of TOWN_PROPS) {
    const d = Math.hypot(c.px - p.x, c.py - p.y);
    if (d < 100 && d < bd) { best = { kind: 'townProp', propId: p.id, label: p.label }; bd = d; }
  }
  // Kem đi theo chủ ra cả thị trấn → vuốt ve được ở đây luôn
  if (c.kem) {
    const d = Math.hypot(c.px - c.kem.x, c.py - c.kem.y);
    if (d < 95 && d < bd) { best = { kind: 'pet', uid: KEM_UID, label: 'Vuốt ve Kem' }; bd = d; }
  }
  void FARM_GATE;
  return best;
}
