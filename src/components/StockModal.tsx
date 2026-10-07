import { FISHES, MAX_POND } from '../game/data';
import { useGame } from '../game/store';
import { GameIcon } from './GameIcon';

export default function StockModal() {
  const s = useGame();
  return (
    <div>
      <p className="text-sm flex items-center gap-1.5">Ao đang nuôi <b>{s.fishes.length}/{s.pondSlots}</b> (tối đa {MAX_POND}) — cá thả xuống sẽ tự bơi <GameIcon name="caro" size={18} /></p>
      <div className="flex flex-col gap-2 mt-2">
        {Object.values(FISHES)
          .filter((f) => s.level >= f.lv)
          .map((f) => {
            const n = s.inv['babyfish:' + f.id] || 0;
            return (
              <button
                key={f.id}
                disabled={n <= 0}
                onClick={() => s.stockFish(f.id)}
                className="flex justify-between items-center p-3 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold disabled:opacity-50 hover:bg-yellow-200"
              >
                <span className="flex items-center gap-2"><GameIcon name={f.id} size={24} /> {f.name} x{n}</span>
                <span>{f.grow}s</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
