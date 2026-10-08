import { Home } from 'lucide-react';
import { STEAL_MAX_PER_DAY, stealCountToday, useVillage } from '../net/village';

/** Banner khi đang thăm farm bạn + nút về + số cây còn được hái trộm */
export default function VisitBanner() {
  const visiting = useVillage((s) => s.visiting);
  const leaveVisit = useVillage((s) => s.leaveVisit);
  if (!visiting) return null;
  const left = Math.max(0, STEAL_MAX_PER_DAY - stealCountToday(visiting.code));
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[6] flex items-center gap-2 bg-purple-900/90 text-white border-2 border-yellow-300 rounded-full px-4 py-1.5 text-sm font-bold shadow-lg whitespace-nowrap">
      <span>Đang thăm farm của <b>{visiting.snap.name}</b> (Lv {visiting.snap.level})</span>
      <span className="text-yellow-300 text-xs" title="Đi gần ô chín rồi bấm E (hoặc chạm vào ô) để hái trộm — chó Vàng/Mực có thể cắn!">
        Hái trộm còn {left}/{STEAL_MAX_PER_DAY} 🐕
      </span>
      <button onClick={leaveVisit} className="bg-yellow-300 text-black rounded-full px-3 py-0.5 font-extrabold flex items-center gap-1 hover:bg-yellow-200">
        <Home size={14} /> Về nhà
      </button>
    </div>
  );
}
