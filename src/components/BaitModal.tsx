import { BAIT_PRO_PRICE, BAIT_PRICE } from '../game/data';
import { useGame } from '../game/store';
import { sitAndFish } from './GameCanvas';

/** Chọn mồi trước khi ngồi câu (khi có cả 2 loại) */
export default function BaitModal({ pier }: { pier: number }) {
  const s = useGame();
  const nNormal = s.inv.bait || 0;
  const nPro = s.inv.baitPro || 0;
  return (
    <div className="flex flex-col gap-2 mt-2">
      <button
        disabled={nNormal <= 0}
        onClick={() => sitAndFish(pier, 'bait')}
        className="flex justify-between items-center p-3 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold disabled:opacity-50 hover:bg-yellow-200"
      >
        <span>🪱 Mồi thường x{nNormal}</span>
        <span className="text-xs text-stone-500">Cá rẻ dễ dính • {BAIT_PRICE}🪙/cái</span>
      </button>
      <button
        disabled={nPro <= 0}
        onClick={() => sitAndFish(pier, 'baitPro')}
        className="flex justify-between items-center p-3 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold disabled:opacity-50 hover:bg-yellow-200"
      >
        <span>🦐 Mồi ngon x{nPro}</span>
        <span className="text-xs text-stone-500">Cá hiếm x5, ít rác • {BAIT_PRO_PRICE}🪙/cái</span>
      </button>
    </div>
  );
}
