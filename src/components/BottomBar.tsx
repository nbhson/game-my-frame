import { QUESTS } from '../game/data';
import { useGame } from '../game/store';
import type { InteractTarget } from '../game/types';
import { doInteractWith } from './GameCanvas';

export default function BottomBar({ target }: { target: InteractTarget | null }) {
  const inv = useGame((s) => s.inv);
  const questIdx = useGame((s) => s.questIdx);
  const cur = QUESTS[Math.min(questIdx, QUESTS.length - 1)];

  const seedTotal = Object.keys(inv).filter((k) => k.startsWith('seed:')).reduce((a, k) => a + inv[k], 0);
  const prodTotal = Object.keys(inv)
    .filter((k) => !k.startsWith('seed:') && !k.startsWith('baby') && k !== 'feed' && k !== 'bait')
    .reduce((a, k) => a + inv[k], 0);
  const slots: [string, string, number][] = [
    ['🌰', 'Hạt', seedTotal],
    ['🌽', 'T.ăn', inv.feed || 0],
    ['🪱', 'Mồi', inv.bait || 0],
    ['🧺', 'SP', prodTotal],
  ];

  return (
    <div className="flex gap-2 items-center bg-[#2b2117] px-2 py-1.5">
      <div className="flex gap-1.5">
        {slots.map(([e, n, c]) => (
          <div key={n} title={n} className="w-[52px] h-[52px] bg-[#3e3428] border-[3px] border-black rounded-lg flex flex-col items-center justify-center text-white cursor-pointer hover:border-yellow-300">
            <span className="text-xl leading-none">{e}</span>
            <span className="text-[10px] text-yellow-300 font-extrabold">{c}</span>
          </div>
        ))}
        <button
          onClick={() => doInteractWith(target)}
          className="h-[52px] px-4 rounded-lg bg-yellow-300 border-[3px] border-black font-black text-lg hover:bg-yellow-200 active:scale-95 max-md:hidden"
        >
          E
        </button>
      </div>
      <div className="flex-1 bg-[#fff8dc] border-2 border-yellow-300 rounded-lg px-3 py-1.5 text-[13px] font-semibold truncate">
        🌱 Nhiệm vụ: {cur ? cur.text : 'Hoàn thành tất cả! Bạn là tỷ phú 🏆'}
      </div>
    </div>
  );
}
