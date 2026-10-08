import { useEffect, useState } from 'react';
import { CONTEST_MS, useContest } from '../net/contest';
import { gameMe } from '../net/village';
import { useGame } from '../game/store';

/** Bảng giải câu cá nổi ở công viên: mở giải / đếm ngược / BXH live / kết quả */
export default function ContestBoard() {
  const scene = useGame((s) => s.scene);
  const c = useContest();
  const [, setTick] = useState(0);

  useEffect(() => {
    // chốt giải đúng giờ kể cả khi đang ở farm (bảng chỉ hiện ở công viên)
    const id = setInterval(() => {
      setTick((x) => x + 1);
      useContest.getState().tick(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (scene !== 'town') return null;
  const now = Date.now();
  const left = Math.max(0, c.endsAt - now);
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const board = c.board();
  const me = gameMe().name;
  const myRank = board.findIndex((e) => e.name === me);

  return (
    <div className="absolute top-2 right-2 z-[6] w-[228px] bg-[#fff8dc]/95 border-[3px] border-[#2b2117] rounded-lg p-2 shadow-pixel">
      {!c.running && !board.length ? (
        <div className="text-center">
          <p className="font-black text-[13px]">🏆 GIẢI CÂU CÁ</p>
          <p className="text-[11px] opacity-70 font-bold">3 phút · tổng giá trị cá · 🥇600xu+3gem</p>
          <button
            onClick={() => c.start()}
            className="mt-1 w-full py-1.5 rounded-lg bg-sky-500 border-2 border-black text-white font-black text-[13px] hover:bg-sky-400 active:scale-95"
          >
            Mở giải ngay!
          </button>
        </div>
      ) : (
        <div>
          <p className="font-black text-[13px] text-center">
            🏆 {c.running ? `CÒN ${mm}:${String(ss).padStart(2, '0')}` : 'KẾT QUẢ'} <span className="opacity-60 font-bold text-[11px]">· {c.host}</span>
          </p>
          <div className="mt-1 space-y-0.5 max-h-[168px] overflow-y-auto">
            {board.slice(0, 5).map((e, i) => (
              <div
                key={e.name}
                className={`flex justify-between items-center px-1.5 py-0.5 rounded text-[12px] font-extrabold ${e.name === me ? 'bg-yellow-300 border border-black' : ''}`}
              >
                <span className="truncate">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {e.name}</span>
                <span className="shrink-0">{e.total} <span className="opacity-60 text-[10px]">({e.count}🐟)</span></span>
              </div>
            ))}
            {!board.length && <p className="text-center text-[12px] font-bold opacity-60">Chưa ai dính cá… ra bến sông!</p>}
          </div>
          {myRank >= 0 && <p className="text-center text-[11px] font-black text-green-700 mt-0.5">Bạn hạng {myRank + 1} · {board[myRank].total}xu cá</p>}
          {!c.running && (
            <button
              onClick={() => c.start()}
              className="mt-1 w-full py-1 rounded-lg bg-sky-500 border-2 border-black text-white font-black text-[12px] hover:bg-sky-400 active:scale-95"
            >
              Mở giải mới ({Math.round(CONTEST_MS / 60000)} phút)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
