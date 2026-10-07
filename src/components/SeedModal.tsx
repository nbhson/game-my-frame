import { useEffect } from 'react';
import { CROPS } from '../game/data';
import { useGame } from '../game/store';
import { GameIcon } from './GameIcon';

export function SeedModal({ plot }: { plot: number }) {
  const s = useGame();
  const crops = Object.values(CROPS).filter((c) => s.level >= c.lv);

  // Phím tắt 1–9: chọn nhanh hạt giống theo thứ tự trong bảng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (!/^[1-9]$/.test(e.key)) return;
      const st = useGame.getState();
      if (!(typeof st.modal === 'object' && st.modal?.name === 'seed' && st.modal.plot === plot)) return;
      const list = Object.values(CROPS).filter((c) => st.level >= c.lv).slice(0, 9);
      const c = list[Number(e.key) - 1];
      if (!c || (st.inv['seed:' + c.id] || 0) <= 0) return;
      e.preventDefault();
      st.plantSeed(plot, c.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [plot]);

  return (
    <div>
      <p className="text-xs opacity-70 -mb-1">Bấm phím 1–{Math.min(9, crops.length)} để gieo nhanh</p>
      <div className="flex flex-col gap-2 mt-2">
        {crops
          .map((c, idx) => {
            const n = s.inv['seed:' + c.id] || 0;
            return (
              <button
                key={c.id}
                disabled={n <= 0}
                onClick={() => s.plantSeed(plot, c.id)}
                className="flex justify-between items-center p-3 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold disabled:opacity-50 hover:bg-yellow-200"
              >
                <span className="flex items-center gap-2">
                  {idx < 9 && (
                    <kbd className="min-w-6 h-6 px-1 flex items-center justify-center rounded-md bg-[#2b2117] text-yellow-300 text-sm">
                      {idx + 1}
                    </kbd>
                  )}
                  <GameIcon name={c.id} size={24} /> {c.name} x{n}
                </span>
                <span>{c.grow}s</span>
              </button>
            );
          })}
      </div>
      <p className="mt-2 text-sm">Hết hạt? <button className="underline font-bold" onClick={() => { s.setShopTab('seed'); s.setModal('shop'); }}>Mua ở cửa hàng</button></p>
    </div>
  );
}

export default SeedModal;
