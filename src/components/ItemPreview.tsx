import { useEffect, useRef } from 'react';
import { CARS, OUTFITS, DEFAULT_OUTFIT, type OutfitSlot } from '../game/data';
import { drawBikeSide, drawMotoSide, drawCarSide, drawPlayerDetailed } from '../game/render';

function setupCanvas(cv: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Hình xe vẽ tay thật trong shop/gara (thay icon emoji) — đúng thứ triển lãm ngoài bãi */
export function CarPreview({ carId, h = 64 }: { carId: string; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const car = CARS[carId];
    if (!cv || !car) return;
    const w = Math.round(h * 2.2);
    const ctx = setupCanvas(cv, w, h);
    ctx.translate(w / 2, h - 8);
    const scale = (h - 14) / 52;
    ctx.scale(scale, scale);
    if (car.kind === 'bike') drawBikeSide(ctx, car.color, 1.0, false, car.id);
    else if (car.kind === 'moto') drawMotoSide(ctx, car.color, 1.0, false, car.id);
    else drawCarSide(ctx, car.color, 1.0, false, car.id);
  }, [carId, h]);
  if (!CARS[carId]) return null;
  return <canvas ref={ref} className="block" />;
}

/** Crop xem trước món đồ đang mặc (đúng pixel ngoài đời, thay icon emoji) */
function cropFor(slot: OutfitSlot): { scale: number; tyFrac: number } {
  if (slot === 'hat' || slot === 'hair') return { scale: 2.1, tyFrac: 0.62 };
  if (slot === 'pants') return { scale: 1.7, tyFrac: 0.42 };
  if (slot === 'shoes') return { scale: 2.3, tyFrac: 0.18 };
  if (slot === 'wing') return { scale: 1.0, tyFrac: 0.55 }; // cánh xòe rộng ±34 → thu nhỏ để thấy hết
  return { scale: 1.5, tyFrac: 0.62 }; // shirt + acc: thân trên
}

/** Mặc thử món đồ lên mannequin mặc định — thấy sao mua vậy */
export function OutfitPreview({ slot, itemId, size = 76 }: { slot: OutfitSlot; itemId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !OUTFITS[itemId]) return;
    const ctx = setupCanvas(cv, size, size);
    const { scale, tyFrac } = cropFor(slot);
    ctx.translate(size / 2, size * tyFrac);
    ctx.scale(scale, scale);
    const outfit = { ...DEFAULT_OUTFIT, [slot]: itemId };
    drawPlayerDetailed(ctx, 0, 0, 1, false, '#3f9e4d', '', 1.0, outfit, null, null, null, false);
  }, [slot, itemId, size]);
  if (!OUTFITS[itemId]) return null;
  return <canvas ref={ref} className="block" />;
}
