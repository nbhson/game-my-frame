import { useEffect, useState } from 'react';
import { ROLE_META, useWolf, type Role } from '../net/werewolf';
import { gameMe } from '../net/village';

/** Bàn MA SÓI (hang sói ở khu mua sắm): 5–12 người, chia vai bí mật, đêm hành động – ngày bỏ phiếu */
export default function WerewolfModal() {
  const w = useWolf();
  const [, setTick] = useState(0);
  const me = gameMe().name;
  const isHost = !!w.room && w.host === me;
  const aliveMe = w.alive[me] !== false;

  useEffect(() => {
    if (w.phase === 'idle') return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [w.phase]);

  const left = Math.max(0, w.endsAt - Date.now());
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  // ---------- IDLE: danh sách bàn đang mở ----------
  if (w.phase === 'idle') {
    const rooms = Object.entries(w.openRooms)
      .filter(([, r]) => Date.now() - r.at < 180000)
      .sort((a, b) => b[1].at - a[1].at);
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-bold">🐺 Ma sói: 5–12 người. Đêm sói thịt lén, tiên tri soi, bảo vệ cứu — ngày bàn luận + bỏ phiếu treo. Phe nào sống sót thắng (+300 xu +1 gem)!</p>
        <button
          onClick={() => w.openRoom()}
          className="w-full py-2 rounded-lg bg-purple-600 border-[3px] border-black text-white font-black text-sm hover:bg-purple-500 active:scale-95"
        >
          Mở bàn mới (bạn làm chủ bàn)
        </button>
        {rooms.length === 0 && <p className="text-center text-[12px] font-bold opacity-60">Chưa có bàn nào — mở bàn rồi rủ cả khu!</p>}
        {rooms.map(([room, r]) => (
          <button
            key={room}
            onClick={() => w.joinRoom(room)}
            className="w-full flex justify-between items-center px-3 py-2 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold text-[13px] hover:bg-purple-100 active:scale-95"
          >
            <span>🐺 Bàn của {r.host}</span>
            <span className="text-purple-700">Vào →</span>
          </button>
        ))}
        <p className="text-[11px] opacity-60 font-bold">Vai bí mật (chỉ mình bạn thấy). Chơi đẹp: đừng mở Bau-console xem trộm tin nhắn nhé!</p>
      </div>
    );
  }

  // ---------- LOBBY ----------
  if (w.phase === 'lobby') {
    return (
      <div className="space-y-2">
        <p className="font-black text-sm text-center">🐺 Bàn của {w.host} {isHost && '(bạn là chủ bàn)'}</p>
        <div className="flex flex-wrap gap-1.5">
          {w.lobby.map((n) => (
            <span key={n} className={`px-2 py-1 rounded-lg border-2 border-black font-extrabold text-[12px] ${n === me ? 'bg-yellow-300' : 'bg-white'}`}>{n}</span>
          ))}
        </div>
        <p className="text-[12px] font-bold opacity-70 text-center">{w.lobby.length}/12 người (tối thiểu 5)</p>
        <div className="flex gap-1.5">
          {isHost ? (
            <>
              <button
                disabled={w.lobby.length < 5}
                onClick={() => w.startGame()}
                className="flex-1 py-2 rounded-lg bg-green-600 border-[3px] border-black text-white font-black text-sm hover:bg-green-500 disabled:opacity-40 active:scale-95"
              >
                Bắt đầu ({w.lobby.length} người)
              </button>
              <button onClick={() => w.leaveRoom()} className="px-3 py-2 rounded-lg bg-red-500 border-[3px] border-black text-white font-black text-sm hover:bg-red-400 active:scale-95">Hủy</button>
            </>
          ) : (
            <>
              <p className="flex-1 text-center text-[13px] font-bold animate-pulse">Chờ chủ bàn bắt đầu…</p>
              <button onClick={() => w.leaveRoom()} className="px-3 py-2 rounded-lg bg-red-500 border-[3px] border-black text-white font-black text-sm hover:bg-red-400 active:scale-95">Rời</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- TRONG VÁN / KẾT THÚC ----------
  const roleMeta = w.myRole ? ROLE_META[w.myRole] : null;
  const tally = new Map<string, number>();
  for (const [voter, target] of Object.entries(w.votes)) {
    if (!w.alive[voter] || !w.alive[target] || voter === target) continue;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  const maxVote = Math.max(0, ...tally.values());

  // mục tiêu hành động đêm theo vai
  let nightTargets: string[] = [];
  if (w.phase === 'night' && aliveMe && !w.acted && w.myRole) {
    if (w.myRole === 'wolf') nightTargets = w.players.filter((p) => w.alive[p] && p !== me && !w.pack.includes(p));
    else if (w.myRole === 'seer') nightTargets = w.players.filter((p) => w.alive[p] && p !== me);
    else if (w.myRole === 'guard') nightTargets = w.players.filter((p) => w.alive[p]);
  }
  const voteTargets = w.phase === 'vote' && aliveMe ? w.players.filter((p) => w.alive[p] && p !== me) : [];

  return (
    <div className="space-y-2">
      {/* vai của mình (bí mật) */}
      {roleMeta && (
        <div className={`border-[3px] border-black rounded-lg p-2 text-center font-black ${w.myRole === 'wolf' ? 'bg-red-600 text-white' : 'bg-indigo-100'}`}>
          <span className="text-lg">{roleMeta.emoji} {roleMeta.name}</span>
          <p className="text-[11px] font-bold opacity-80">{roleMeta.desc}</p>
          {w.myRole === 'wolf' && w.pack.length > 1 && (
            <p className="text-[12px] mt-0.5">🐺 Đồng đội: {w.pack.filter((p) => p !== me).join(', ')}</p>
          )}
          {w.myRole === 'seer' && w.seerHit && (
            <p className="text-[12px] mt-0.5">🔮 Đã soi {w.seerHit.target}: {w.seerHit.wolf ? 'LÀ SÓI! 🐺' : 'không phải sói.'}</p>
          )}
        </div>
      )}
      {/* trạng thái sống/chết */}
      <div className="flex flex-wrap gap-1">
        {w.players.map((p) => (
          <span
            key={p}
            className={`px-1.5 py-0.5 rounded-md border-2 border-black font-extrabold text-[11px] ${w.alive[p] ? (p === me ? 'bg-yellow-300' : 'bg-green-200') : 'bg-gray-400 line-through opacity-70'}`}
            title={w.phase === 'end' && w.reveal[p] ? ROLE_META[w.reveal[p] as Role].name : undefined}
          >
            {w.phase === 'end' && w.reveal[p] ? `${ROLE_META[w.reveal[p] as Role].emoji} ` : ''}{p}
          </span>
        ))}
      </div>
      {!aliveMe && w.phase !== 'end' && <p className="text-center font-black text-red-600 text-[13px]">☠️ Bạn đã chết — ngồi xem + vẫn được bàn luận!</p>}

      {/* pha chơi */}
      {w.phase === 'night' && (
        <PhaseBox emoji="🌙" title={`ĐÊM ${w.night} — còn ${mm}:${String(ss).padStart(2, '0')}`}>
          {!aliveMe ? <p className="text-[12px] font-bold">Chờ trời sáng…</p>
            : w.acted ? <p className="text-[12px] font-bold animate-pulse">Đã hành động. Giữ im lặng chờ sáng… 🤫</p>
            : w.myRole === 'villager' ? <p className="text-[12px] font-bold">Dân ngủ say… 😴 (sói / tiên tri / bảo vệ chọn mục tiêu)</p>
            : (
              <div>
                <p className="text-[12px] font-bold mb-1">
                  {w.myRole === 'wolf' ? '🐺 Chọn người để thịt:' : w.myRole === 'seer' ? '🔮 Chọn người để soi:' : '🛡️ Chọn người để cứu:'}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {nightTargets.map((p) => (
                    <button key={p} onClick={() => w.nightAct(p)} className="px-1 py-1.5 rounded-lg bg-white border-2 border-black font-extrabold text-[12px] hover:bg-yellow-200 active:scale-95 truncate">{p}</button>
                  ))}
                </div>
              </div>
            )}
        </PhaseBox>
      )}
      {w.phase === 'day' && (
        <PhaseBox emoji="☀️" title={`NGÀY ${w.day} — bàn luận ${mm}:${String(ss).padStart(2, '0')}`}>
          <p className="text-[12px] font-bold">
            {w.lastCause === 'kill' && w.lastDead ? `🌅 Đêm qua: ${w.lastDead} bị sói thịt (là ${w.lastRole ? ROLE_META[w.lastRole].name : '?'})!`
              : w.lastCause === 'hang' && w.lastDead ? `⚖️ Đã treo cổ ${w.lastDead} (là ${w.lastRole ? ROLE_META[w.lastRole].name : '?'})!`
              : '🌅 Đêm qua bình yên… hoặc sói bị chặn đứng!'}
          </p>
          <p className="text-[11px] font-bold opacity-70">Bàn luận trong chat, sắp bỏ phiếu treo sói!</p>
        </PhaseBox>
      )}
      {w.phase === 'vote' && (
        <PhaseBox emoji="🗳️" title={`BỎ PHIẾU — còn ${mm}:${String(ss).padStart(2, '0')}`}>
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {[...tally.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => (
              <div key={p} className="flex items-center gap-1 text-[12px] font-extrabold">
                <span className="w-20 truncate">{p}</span>
                <div className="flex-1 h-4 bg-black/10 rounded overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(c / Math.max(1, maxVote)) * 100}%` }} />
                </div>
                <span>{c} phiếu</span>
              </div>
            ))}
            {!tally.size && <p className="text-[12px] font-bold opacity-60">Chưa có phiếu nào…</p>}
          </div>
          {voteTargets.length > 0 && (
            <div className="grid grid-cols-3 gap-1 mt-1">
              {voteTargets.map((p) => (
                <button
                  key={p}
                  onClick={() => w.vote(p)}
                  className={`px-1 py-1.5 rounded-lg border-2 border-black font-extrabold text-[12px] active:scale-95 truncate ${w.voted === p ? 'bg-red-500 text-white' : 'bg-white hover:bg-red-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {w.voted && <p className="text-[11px] font-bold text-center">Bạn vote {w.voted} (được đổi ý tới hết giờ)</p>}
        </PhaseBox>
      )}
      {w.phase === 'end' && (
        <div className="border-[3px] border-black rounded-lg p-2 text-center font-black bg-yellow-200">
          {w.winner === 'wolves' ? '🐺 ĐÀN SÓI THẮNG!' : '🧑‍🌾 DÂN LÀNG THẮNG!'}
          <p className="text-[11px] font-bold">Phe thắng mỗi người +300 xu +1 gem (tự cộng rồi nhé)</p>
        </div>
      )}

      {/* nhật ký ván */}
      {w.log.length > 0 && (
        <div className="bg-black/5 rounded-lg p-1.5 max-h-[96px] overflow-y-auto text-[11px] font-bold space-y-0.5">
          {w.log.slice(-6).map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}
      <div className="flex gap-1.5">
        {w.phase === 'end' && isHost && (
          <button onClick={() => w.newRound()} className="flex-1 py-1.5 rounded-lg bg-purple-600 border-2 border-black text-white font-black text-[13px] hover:bg-purple-500 active:scale-95">Ván mới</button>
        )}
        <button onClick={() => w.leaveRoom()} className="flex-1 py-1.5 rounded-lg bg-gray-500 border-2 border-black text-white font-black text-[13px] hover:bg-gray-400 active:scale-95">
          {w.phase === 'end' ? 'Rời bàn' : 'Rời bàn (bỏ ván)'}
        </button>
      </div>
    </div>
  );
}

function PhaseBox({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-[3px] border-black rounded-lg p-2 bg-white">
      <p className="font-black text-[13px] text-center">{emoji} {title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
