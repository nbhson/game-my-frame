// ===== Interact system: tìm đối tượng gần player nhất =====
import type { Animal, InteractTarget, PondFish } from './types';
import { ANIMALS, CROPS, FISHES, plotCost, plotReq } from './data';
import { BARN, COOP, PEN_MB, PIERS, SHOPD, POND, pondInner, plotPos, RIVER_WATER_Y } from './world';

export interface InteractCtx {
  px: number; py: number;
  plots: { state: string; crop: string | null; watered: boolean; locked: boolean }[];
  fishes: PondFish[];
  pondSlots: number;
  animals: Animal[];
  now: number; t: number;
}

export function animalPos(a: Animal, t: number) {
  const home = a.type === 'chicken' || a.type === 'duck' ? COOP : BARN;
  const cx = home.x + home.w / 2, cy = home.y + home.h / 2;
  const wx = Math.sin(t * 0.5 + a.uid) * (home.w / 2 - 50);
  const wy = Math.cos(t * 0.35 + a.uid * 2) * (home.h / 2 - 50);
  return { x: cx + wx, y: cy + wy };
}

/** Vị trí bơi của 1 con cá trong ao vuông (tự do — không chia ngăn) */
export function fishPos(f: PondFish, t: number) {
  const pc = pondInner();
  const a = t * (0.35 + ((f.uid * 37) % 20) / 60) + f.uid * 2.4;
  return {
    x: pc.x + Math.cos(a) * pc.hw * 0.8,
    y: pc.y + Math.sin(a * 1.3) * pc.hh * 0.65,
    flip: Math.sin(a) > 0,
  };
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
      if (pl.locked) label = `Mở ô ${i + 1} (${plotCost(i)}🪙, Lv${plotReq(i)})`;
      else if (pl.state === 'grass') label = `Cuốc đất ô ${i + 1}`;
      else if (pl.state === 'soil') label = `Gieo hạt ô ${i + 1}`;
      else if (pl.state === 'growing') label = pl.watered ? `${pl.crop ? CROPS[pl.crop].name : ''} đang lớn…` : `Tưới ${pl.crop ? CROPS[pl.crop].name : ''}`;
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
        : { kind: 'pond', label: `Ao đầy (${c.pondSlots}/${c.pondSlots}) — mở rộng ở hòm thư 📮` };
      bd = dEdge;
    }
  }
  // --- hòm thư trước ao/chuồng: xem thông tin + mở khóa ---
  {
    const boxes: { pen: 'pond' | 'coop' | 'barn'; label: string }[] = [
      { pen: 'pond', label: 'Hòm thư ao cá 📮' },
      { pen: 'coop', label: 'Hòm thư chuồng gà–vịt 📮' },
      { pen: 'barn', label: 'Hòm thư trại bò–heo–cừu 📮' },
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
      best = { kind: 'river', index: pi, label: 'Ngồi câu cá 🎣 (tốn mồi)' };
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
  // --- shop ---
  {
    const sx = SHOPD.x + SHOPD.w / 2, sy = SHOPD.y + SHOPD.h + 40;
    const d = Math.hypot(c.px - sx, c.py - sy);
    if (d < 110 && (!best || d < bd)) { best = { kind: 'shop', label: 'Mở Cửa hàng 🏪' }; bd = d; }
  }
  void RIVER_WATER_Y;
  return best;
}
