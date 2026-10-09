import { useEffect, useState } from 'react';
import { RACE_LAPS, RACE_MAX, RACE_N, RACE_PRIZES, isRaceBot, progScore, racePct, tickRace, useRace } from '../net/race';
import { gameMe } from '../net/village';
import { useGame } from '../game/store';

/** Modal giải đua xe thật: tạo/tham gia phòng (tối đa 5) → lái xe quanh track 5 vòng */
export default function RaceModal() {
  const r = useRace();
  const [, setTick] = useState(0);
  const me = gameMe().name;

  useEffect(() => {
    const id = setInterval(() => {
      tickRace();
      setTick((x) => x + 1);
    }, 200);
    return () => clearInterval(id);
  }, []);

  const rooms = Object.entries(r.openRooms);
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);

  // --- đếm ngược: đang lùa cả phòng ra vạch xuất phát ---
  if (r.phase === 'count') {
    const left = Math.max(0, r.goAt - Date.now());
    return (
      <div className="text-center">
        <p className="font-black text-lg">🏁 XUẤT PHÁT SAU {Math.ceil(left / 1000)}…</p>
        <p className="text-[12px] font-bold opacity-70 mt-1">
          Đang đưa bạn ra vạch xuất phát ở đường đua! Lên xe sẵn đi — bảng này tự đóng khi xuất phát.
        </p>
        <div className="mt-2 space-y-1">
          {r.racers.map((n) => (
            <div key={n} className={`px-2 py-1.5 rounded-lg border-2 border-black text-[13px] font-black ${n === me ? 'bg-yellow-200' : 'bg-white'}`}>
              🏎️ {n}{n === me ? ' (bạn)' : ''}{isRaceBot(n) ? ' 🤖' : ''}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- đang đua: bảng live + nút đóng để lái ---
  if (r.phase === 'racing') {
    const sorted = [...r.racers].sort((a, b) => {
      const fa = r.finishes[a], fb = r.finishes[b];
      if (fa != null && fb != null) return fa - fb;
      if (fa != null) return -1;
      if (fb != null) return 1;
      return progScore(r.progress[b] ?? { lap: 0, cp: 0 }) - progScore(r.progress[a] ?? { lap: 0, cp: 0 });
    });
    const mine = r.progress[me];
    const myDone = r.finishes[me] != null;
    return (
      <div className="text-center">
        <p className="font-black text-lg">🏁 ĐANG ĐUA — VÒNG {Math.min(RACE_LAPS, (mine?.lap ?? 0) + 1)}/{RACE_LAPS}</p>
        <div className="mt-2 space-y-1.5 max-h-[220px] overflow-y-auto">
          {sorted.map((n, i) => {
            const p = r.progress[n];
            const fin = r.finishes[n];
            return (
              <div key={n} className={`px-2 py-1 rounded-lg border-2 border-black text-left ${n === me ? 'bg-yellow-200' : 'bg-white'}`}>
                <div className="flex justify-between text-[13px] font-black">
                  <span className="truncate">{medal(i)} {n}{n === me ? ' (bạn)' : ''}{isRaceBot(n) ? ' 🤖' : ''}</span>
                  <span>{fin != null ? `${(fin / 1000).toFixed(1)}s` : p ? `V${p.lap + 1} · ${racePct(p)}%` : '…'}</span>
                </div>
                {fin == null && (
                  <div className="h-3 rounded-full bg-black/15 overflow-hidden mt-0.5">
                    <div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 transition-all" style={{ width: `${p ? racePct(p) : 0}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={() => useGame.getState().setModal(null)}
          className="mt-3 w-full py-3 rounded-2xl bg-green-500 border-4 border-black text-white font-black text-xl active:scale-95 select-none touch-manipulation shadow-pixel"
        >
          {myDone ? 'ĐÃ VỀ ĐÍCH — ĐÓNG BẢNG CHỜ KẾT QUẢ' : 'ĐÓNG BẢNG ĐỂ LÁI XE! 🏎️💨'}
        </button>
        <p className="text-[11px] opacity-70 font-bold mt-1">Lái xe (WASD/cần gạt) cán lần lượt {RACE_N} chốt × {RACE_LAPS} vòng — xe nhau thấy trực tiếp trên đường đua!</p>
      </div>
    );
  }

  // --- kết quả ---
  if (r.phase === 'done') {
    const myRank = r.results.indexOf(me);
    return (
      <div className="text-center">
        <p className="font-black text-lg">🏁 KẾT QUẢ GIẢI ĐUA</p>
        <div className="mt-2 space-y-1">
          {r.results.map((n, i) => (
            <div key={n} className={`flex justify-between px-2 py-1 rounded-lg border-2 border-black text-[13px] font-black ${n === me ? 'bg-yellow-200' : 'bg-white'}`}>
              <span>{medal(i)} {n}{n === me ? ' (bạn)' : ''}{isRaceBot(n) ? ' 🤖' : ''}</span>
              <span>{r.finishes[n] != null ? `${(r.finishes[n] / 1000).toFixed(1)}s` : 'DNF'}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] font-bold mt-1 opacity-70">
          🥇{RACE_PRIZES[0].xu}xu+{RACE_PRIZES[0].gem}gem · 🥈{RACE_PRIZES[1].xu}xu · 🥉{RACE_PRIZES[2].xu}xu
          {myRank >= 0 && myRank < 3 ? ' — quà đã vào túi!' : ''}
        </p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => r.leave()} className="flex-1 py-2 rounded-lg bg-stone-300 border-2 border-black font-black active:scale-95">Rời phòng</button>
          {r.host === me && (
            <button onClick={() => r.start()} className="flex-1 py-2 rounded-lg bg-green-500 border-2 border-black text-white font-black active:scale-95">Đua lại!</button>
          )}
        </div>
      </div>
    );
  }

  // --- sảnh chờ ---
  if (r.phase === 'lobby') {
    const isHost = r.host === me;
    return (
      <div className="text-center">
        <p className="font-black text-lg">🏁 PHÒNG ĐUA CỦA {r.host}</p>
        <p className="text-[12px] font-bold opacity-70">{r.racers.length}/{RACE_MAX} tay lái · lái xe thật {RACE_LAPS} vòng quanh track</p>
        <div className="mt-2 space-y-1">
          {Array.from({ length: RACE_MAX }).map((_, i) => {
            const n = r.racers[i];
            return (
              <div key={i} className={`px-2 py-1.5 rounded-lg border-2 border-black text-[13px] font-black ${n ? (n === me ? 'bg-yellow-200' : 'bg-white') : 'bg-black/10 opacity-50'}`}>
                {n ? `🏎️ ${n}${n === r.host ? ' (chủ phòng)' : ''}` : '— trống —'}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => r.leave()} className="flex-1 py-2 rounded-lg bg-stone-300 border-2 border-black font-black active:scale-95">Rời</button>
          {isHost && (
            <button onClick={() => r.start()} className="flex-1 py-2 rounded-lg bg-green-500 border-2 border-black text-white font-black active:scale-95">BẮT ĐẦU!</button>
          )}
        </div>
        {!isHost && <p className="text-[11px] font-bold opacity-60 mt-1">Chờ chủ phòng bấm Bắt đầu… (nhớ vào Khu mua sắm & lên xe!)</p>}
      </div>
    );
  }

  // --- chưa vào phòng ---
  return (
    <div className="text-center">
      <p className="font-black text-lg">🏁 TRƯỜNG ĐUA XE</p>
      <p className="text-[12px] font-bold opacity-70">Tối đa {RACE_MAX} tay lái/phòng · 🥇{RACE_PRIZES[0].xu}xu+{RACE_PRIZES[0].gem}gem</p>
      <p className="text-[11px] font-bold opacity-60 mt-1">Đua thật: lái xe của bạn quanh track {RACE_LAPS} vòng, cán đủ chốt — thấy xe nhau chạy trực tiếp!</p>
      <button onClick={() => r.create()} className="mt-2 w-full py-2.5 rounded-lg bg-green-500 border-2 border-black text-white font-black active:scale-95">
        Mở phòng đua mới
      </button>
      <p className="font-black text-[13px] mt-3">PHÒNG ĐANG MỞ ({rooms.length})</p>
      {rooms.length === 0 && <p className="text-[12px] font-bold opacity-60">Chưa có phòng nào — mở phòng rủ cả làng!</p>}
      <div className="space-y-1 mt-1 max-h-[180px] overflow-y-auto">
        {rooms.map(([h, info]) => (
          <div key={h} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border-2 border-black">
            <span className="flex-1 text-left text-[13px] font-black truncate">🏎️ {h} ({info.n}/{RACE_MAX})</span>
            <button onClick={() => r.join(h)} className="px-3 py-1 rounded-lg bg-sky-500 border-2 border-black text-white font-black text-[13px] active:scale-95">
              Tham gia
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
