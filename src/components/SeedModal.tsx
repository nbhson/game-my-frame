import { CROPS, FISHES } from '../game/data';
import { useGame } from '../game/store';

export function SeedModal({ plot }: { plot: number }) {
  const s = useGame();
  return (
    <div>
      <div className="flex flex-col gap-2 mt-2">
        {Object.values(CROPS)
          .filter((c) => s.level >= c.lv)
          .map((c) => {
            const n = s.inv['seed:' + c.id] || 0;
            return (
              <button
                key={c.id}
                disabled={n <= 0}
                onClick={() => s.plantSeed(plot, c.id)}
                className="flex justify-between items-center p-3 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold disabled:opacity-50 hover:bg-yellow-200"
              >
                <span>{c.emoji} {c.name} x{n}</span>
                <span>⏱{c.grow}s</span>
              </button>
            );
          })}
      </div>
      <p className="mt-2 text-sm">Hết hạt? <button className="underline font-bold" onClick={() => { s.setShopTab('seed'); s.setModal('shop'); }}>Mua ở cửa hàng</button></p>
    </div>
  );
}

export default SeedModal;
