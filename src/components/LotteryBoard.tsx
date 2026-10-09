import { useEffect, useState } from 'react';
import { fmtDraw, useLottery } from '../net/lottery';
import { useGame } from '../game/store';

/** Bảng vé số nổi ở thị trấn + khu mua sắm: đếm ngược kỳ + số vé đã mua + kết quả mới nhất */
export default function LotteryBoard() {
  const scene = useGame((s) => s.scene);
  const l = useLottery();
  const [, setTick] = useState(0);

  useEffect(() => {
    // sổ đúng giờ kể cả khi đang ở farm (bảng chỉ hiện ở thị trấn)
    const id = setInterval(() => {
      useLottery.getState().tick(Date.now());
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (scene !== 'town' && scene !== 'mall') return null;
  const left = l.countdown();
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const last = l.history[0];
  const urgent = left < 30000;

  return (
    <div className="absolute top-2 left-2 z-[6] w-[180px] md:w-[228px] bg-[#fff8dc]/95 border-[3px] border-[#2b2117] rounded-lg p-1.5 md:p-2 shadow-pixel max-h-[40%] overflow-hidden">
      <p className="font-black text-[13px] text-center">🎫 VÉ SỐ · Kỳ {fmtDraw(l.drawId)}</p>
      <p className={`text-center font-black text-[15px] tabular-nums ${urgent ? 'text-red-600 animate-pulse' : 'text-green-700'}`}>
        Sổ sau {mm}:{String(ss).padStart(2, '0')}
      </p>
      <p className="text-center text-[11px] font-extrabold opacity-80">
        {l.tickets.length > 0
          ? `Vé của bạn: ${l.tickets.map((t) => t.num).join(' · ')}`
          : '50 xu/vé · ĐB 3000 xu +1 gem'}
      </p>
      {last && (
        <p className="text-center text-[11px] font-bold opacity-70 mt-0.5 truncate">
          Kỳ {fmtDraw(last.drawId)}: <span className="text-red-600 font-black">{last.winning}</span>
          {last.prize > 0 ? ` · bạn +${last.prize}xu 🎉` : ' · trượt'}
        </p>
      )}
      <button
        onClick={() => useGame.getState().setModal('lottery')}
        className="mt-1 w-full py-1.5 rounded-lg bg-red-500 border-2 border-black text-white font-black text-[13px] hover:bg-red-400 active:scale-95"
      >
        Mua vé ngay!
      </button>
    </div>
  );
}
