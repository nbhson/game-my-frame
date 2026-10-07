// ===== Casino modal: sảnh + phòng + 3 bàn (tiến lên / bài cào / caro) =====
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { CASINO_GAMES, CASINO_MAX_BET, CASINO_MIN_BET, useCasino, type CasinoGame } from '../net/casino';
import { getPresenceId } from '../net/session';
import { cardLabel, isRed, type Card } from '../game/casino/cards';
import { comboOf } from '../game/casino/tienlen';
import { scoreHand } from '../game/casino/baicao';
import type { TienLenState } from '../game/casino/tienlen';
import type { BaiCaoState } from '../game/casino/baicao';
import type { CaroState } from '../game/casino/caro';

function myPid(): string {
  try { return getPresenceId(); } catch { return ''; }
}

export default function CasinoModal() {
  const room = useCasino((s) => s.room);
  useEffect(() => {
    useCasino.getState().ensure();
    useCasino.getState().refresh();
  }, []);
  if (!room) return <Lobby />;
  if (room.status === 'waiting') return <Waiting />;
  return <Playing />;
}

// ---------------- SẢNH ----------------
function Lobby() {
  const rooms = useCasino((s) => s.rooms);
  const transport = useCasino((s) => s.transport);
  const xu = useGame((s) => s.xu);
  const [game, setGame] = useState<CasinoGame>('tienlen');
  const [bet, setBet] = useState(20);
  const maxOf = CASINO_GAMES.find((g) => g.id === game)?.max ?? 4;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-purple-700 to-pink-600 border-2 border-black rounded-xl px-3 py-2 text-white text-center">
        <div className="font-black text-lg">🎰 CASINO CÔNG VIÊN</div>
        <div className="text-xs opacity-90">Tiến lên • Bài cào • Caro — cược {CASINO_MIN_BET}-{CASINO_MAX_BET} xu/ván • Nhất ăn tất</div>
        <div className="text-xs mt-1">Ví của bạn: <b className="text-yellow-300">{xu} xu</b> • {transport === 'socket' ? '🟢 Chơi chung LAN' : '🟡 Tab gần / máy'}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CASINO_GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            className={`border-[3px] rounded-xl px-2 py-2 text-center transition-all ${game === g.id ? 'bg-yellow-200 border-yellow-500 scale-105' : 'bg-white border-black hover:border-yellow-400'}`}
          >
            <div className="text-2xl">{g.emoji}</div>
            <div className="font-black text-sm">{g.name}</div>
            <div className="text-[11px] text-gray-600">{g.desc}</div>
          </button>
        ))}
      </div>

      <div className="bg-white border-2 border-black rounded-xl px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">Mức cược / ván (tối đa {maxOf} người)</span>
          <span className="font-black text-amber-600">{bet} xu</span>
        </div>
        <input
          type="range" min={CASINO_MIN_BET} max={CASINO_MAX_BET} step={5} value={bet}
          onChange={(e) => setBet(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex gap-2 mt-1">
          {[10, 20, 50, 100].map((v) => (
            <button key={v} onClick={() => setBet(v)} className={`flex-1 border-2 rounded-lg py-1 text-sm font-bold ${bet === v ? 'bg-amber-400 border-black' : 'bg-gray-100 border-gray-300'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => useCasino.getState().createRoom(game, bet, false)}
          className="flex-1 bg-purple-600 text-white font-black rounded-xl border-[3px] border-black py-2.5 hover:bg-purple-500 active:scale-95"
        >
          ➕ Tạo phòng
        </button>
        <button
          onClick={() => useCasino.getState().createRoom(game, bet, true)}
          className="flex-1 bg-green-600 text-white font-black rounded-xl border-[3px] border-black py-2.5 hover:bg-green-500 active:scale-95"
          title="Chơi ngay với máy, không cần chờ"
        >
          🤖 Chơi với máy
        </button>
        <button
          onClick={() => useCasino.getState().refresh()}
          className="px-3 bg-white font-black rounded-xl border-[3px] border-black py-2.5 hover:bg-gray-100 active:scale-95"
          title="Tải lại danh sách"
        >
          🔄
        </button>
      </div>

      <div>
        <div className="font-black text-sm mb-1">Phòng đang chờ ({rooms.length})</div>
        {rooms.length === 0 && (
          <div className="text-sm text-gray-500 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl px-3 py-3 text-center">
            Chưa có phòng nào — tạo phòng rồi rủ bạn vào Casino chơi cùng!
          </div>
        )}
        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {rooms.map((r) => {
            const g = CASINO_GAMES.find((x) => x.id === r.game);
            return (
              <div key={r.id} className="flex items-center gap-2 bg-white border-2 border-black rounded-xl px-2.5 py-1.5">
                <div className="text-xl">{g?.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm">#{r.id} • {g?.name} • {r.bet} xu</div>
                  <div className="text-xs text-gray-600 truncate">{r.players.map((p) => p.name).join(', ')} ({r.players.length}/{g?.max})</div>
                </div>
                <button
                  onClick={() => useCasino.getState().joinRoom(r.id)}
                  className="bg-sky-500 text-white text-sm font-black rounded-lg border-2 border-black px-3 py-1 hover:bg-sky-400 active:scale-95"
                >
                  Vào
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[11px] text-gray-500 text-center">Chơi LAN: mọi người cùng mở link server là thấy phòng nhau • 2 tab cùng máy cũng thấy nhau</div>
    </div>
  );
}

// ---------------- PHÒNG CHỜ ----------------
function Waiting() {
  const room = useCasino((s) => s.room)!;
  const g = CASINO_GAMES.find((x) => x.id === room.game)!;
  const me = myPid();
  const isHost = room.hostPid === me;
  const max = g.max;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-purple-700 to-pink-600 border-2 border-black rounded-xl px-3 py-2 text-white text-center">
        <div className="font-black">Phòng #{room.id} • {g.emoji} {g.name} • {room.bet} xu/ván</div>
        <div className="text-xs opacity-90">{room.players.length}/{max} người • {isHost ? 'Bạn là chủ phòng' : 'Chờ chủ phòng bắt đầu'}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {room.players.map((p) => (
          <div key={p.pid} className="flex items-center gap-2 bg-white border-2 border-black rounded-xl px-2.5 py-1.5">
            <div className="w-8 h-8 rounded-full bg-purple-200 border-2 border-black flex items-center justify-center font-black">{p.name.slice(0, 1)}</div>
            <div className="flex-1 font-bold text-sm truncate">
              {p.name} {p.pid === room.hostPid && '👑'} {p.bot && <span className="text-xs bg-gray-200 rounded px-1">MÁY</span>} {p.pid === me && <span className="text-xs text-green-600">(bạn)</span>}
            </div>
          </div>
        ))}
        {room.players.length < max && (
          <div className="text-xs text-gray-500 text-center">Đang chờ thêm {max - room.players.length} người… (mã phòng: <b>#{room.id}</b> — bạn bè bấm Vào)</div>
        )}
      </div>
      <div className="flex gap-2">
        {isHost && (
          <>
            {room.players.length < max && room.game !== 'caro' && (
              <button onClick={() => useCasino.getState().addBot()} className="flex-1 bg-gray-700 text-white font-black rounded-xl border-[3px] border-black py-2 hover:bg-gray-600 active:scale-95">🤖 +Máy</button>
            )}
            <button onClick={() => useCasino.getState().startRoom()} className="flex-[2] bg-green-600 text-white font-black rounded-xl border-[3px] border-black py-2 hover:bg-green-500 active:scale-95">▶ Bắt đầu (trừ {room.bet} xu)</button>
          </>
        )}
        <button onClick={() => useCasino.getState().leaveRoom()} className="flex-1 bg-white font-black rounded-xl border-[3px] border-black py-2 hover:bg-gray-100 active:scale-95">Rời</button>
      </div>
    </div>
  );
}

// ---------------- ĐANG CHƠI ----------------
function Playing() {
  const room = useCasino((s) => s.room)!;
  return (
    <div className="flex flex-col gap-2">
      <RoomHeader />
      {room.status === 'finished' && <FinishedBanner />}
      {room.game === 'tienlen' && <TienLenBoard />}
      {room.game === 'baicao' && <BaiCaoBoard />}
      {room.game === 'caro' && <CaroBoard />}
    </div>
  );
}

function RoomHeader() {
  const room = useCasino((s) => s.room)!;
  const g = CASINO_GAMES.find((x) => x.id === room.game)!;
  const pot = room.pot ?? room.bet * room.players.length;
  const me = myPid();
  const isHost = room.hostPid === me;
  return (
    <div className="flex items-center gap-2 bg-[#2b2117] text-white rounded-xl px-3 py-1.5 text-sm">
      <span className="font-black">#{room.id} {g.emoji} {g.name}</span>
      <span className="text-yellow-300 font-bold">cược {room.bet} • pot {pot}</span>
      <span className="flex-1" />
      {room.status === 'finished' && isHost && (
        <button onClick={() => useCasino.getState().rematch()} className="bg-green-500 text-xs font-black rounded-lg border-2 border-black px-2 py-1">Ván mới</button>
      )}
      <button onClick={() => useCasino.getState().leaveRoom()} className="bg-white text-black text-xs font-black rounded-lg border-2 border-black px-2 py-1">Rời</button>
    </div>
  );
}

function FinishedBanner() {
  const room = useCasino((s) => s.room)!;
  const winners = room.winners ?? [];
  const names = room.players.filter((p) => winners.includes(p.pid)).map((p) => p.name).join(', ');
  const me = myPid();
  const iWin = winners.includes(me);
  return (
    <div className={`border-[3px] border-black rounded-xl px-3 py-2 text-center font-black ${iWin ? 'bg-yellow-200' : 'bg-gray-100'}`}>
      {winners.length === 0 ? '🤝 Hòa! Hoàn cược.' : iWin ? `🎉 Bạn thắng +${Math.floor((room.pot ?? room.bet * room.players.length) / winners.length)} xu!` : `🏆 ${names} thắng ván này`}
    </div>
  );
}

// ---------------- TIẾN LÊN ----------------
function MiniCard({ c, small }: { c: Card; small?: boolean }) {
  const red = isRed(c);
  return (
    <div className={`bg-white border-2 border-black rounded-md flex flex-col items-center justify-center font-black ${red ? 'text-red-600' : 'text-gray-900'} ${small ? 'w-9 h-12 text-[11px]' : 'w-11 h-14 text-sm'}`}>
      <span>{cardLabel(c)}</span>
    </div>
  );
}

function TienLenBoard() {
  const room = useCasino((s) => s.room)!;
  const st = room.state as TienLenState;
  const me = myPid();
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { setSel([]); }, [st.turn, st.lastPlay?.length]);
  const hand = useMemo(() => (st.hands[me] ?? []).slice().sort((a, b) => a.r - b.r || a.s - b.s), [st.hands, me]);
  const isMyTurn = st.turn === me && !st.winner;
  const selCards = hand.filter((c) => sel.includes(c.id));
  const combo = selCards.length ? comboOf(selCards) : null;
  const others = room.players.filter((p) => p.pid !== me);

  const toggle = (id: string) => {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {others.map((p) => {
          const n = st.hands[p.pid]?.length ?? 0;
          const isTurn = st.turn === p.pid;
          return (
            <div key={p.pid} className={`border-2 rounded-xl px-2 py-1 text-center ${isTurn ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-black'}`}>
              <div className="font-bold text-xs truncate">{p.name} {isTurn && '⏳'}</div>
              <div className="text-lg">{n > 0 ? '🎴'.repeat(Math.min(5, n)) : '🏁'}</div>
              <div className="text-[11px] text-gray-600">{n} lá</div>
            </div>
          );
        })}
      </div>
      <div className="bg-green-800 border-2 border-black rounded-xl px-2 py-2 min-h-[76px] flex items-center justify-center gap-1 flex-wrap">
        {!st.lastPlay || st.lastPlay.length === 0 ? (
          <span className="text-green-200 text-sm">{st.firstTurn ? 'Ván mới — người có 3♠ đi trước' : isMyTurn ? 'Bạn đi đầu vòng — ra bộ bất kỳ' : 'Vòng mới…'}</span>
        ) : (
          st.lastPlay.map((c) => <MiniCard key={c.id} c={c} small />)
        )}
      </div>
      {st.lastPlayer && (
        <div className="text-[11px] text-gray-500 text-center">
          {room.players.find((p) => p.pid === st.lastPlayer)?.name} vừa ra • tới lượt {room.players.find((p) => p.pid === st.turn)?.name}
        </div>
      )}
      <div className="bg-amber-50 border-2 border-black rounded-xl p-2">
        <div className="flex flex-wrap gap-1 justify-center mb-2">
          {hand.map((c) => {
            const on = sel.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => isMyTurn && toggle(c.id)}
                className={`transition-transform ${on ? '-translate-y-2 ring-2 ring-amber-500 rounded-md' : ''} ${isMyTurn ? 'cursor-pointer' : 'opacity-90'}`}
              >
                <MiniCard c={c} />
              </button>
            );
          })}
        </div>
        {hand.length === 0 && <div className="text-center font-black text-green-600">Bạn đã về nhất! 🏁</div>}
        <div className="flex gap-2 items-center">
          <div className="flex-1 text-xs text-gray-600">
            {selCards.length === 0 ? 'Chạm bài để chọn' : combo ? `Đã chọn: ${combo.type} (${combo.len} lá)` : 'Bộ chưa hợp lệ'}
          </div>
          <button onClick={() => setSel([])} className="px-2 py-1.5 bg-white border-2 border-black rounded-lg text-sm font-bold">Xóa</button>
          <button
            onClick={() => useCasino.getState().passTurn()}
            disabled={!isMyTurn || !st.lastPlay}
            className="px-3 py-1.5 bg-gray-500 text-white border-2 border-black rounded-lg text-sm font-black disabled:opacity-40"
          >
            Bỏ qua
          </button>
          <button
            onClick={() => { useCasino.getState().playCards(selCards); setSel([]); }}
            disabled={!isMyTurn || selCards.length === 0}
            className="px-4 py-1.5 bg-red-500 text-white border-2 border-black rounded-lg text-sm font-black disabled:opacity-40"
          >
            Đánh
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- BÀI CÀO ----------------
function BaiCaoBoard() {
  const room = useCasino((s) => s.room)!;
  const st = room.state as BaiCaoState;
  const me = myPid();
  const iRevealed = st.revealed.includes(me);
  const done = room.status === 'finished';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        {room.players.map((p) => {
          const hand = st.hands[p.pid] ?? [];
          const open = done || st.revealed.includes(p.pid);
          const sc = scoreHand(hand);
          const win = (room.winners ?? []).includes(p.pid);
          return (
            <div key={p.pid} className={`border-[3px] rounded-xl px-2 py-1.5 text-center ${win ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-black'}`}>
              <div className="font-bold text-xs truncate">{p.name} {p.pid === me && '(bạn)'} {win && '🏆'}</div>
              <div className="flex gap-1 justify-center my-1">
                {hand.map((c, i) => (
                  <div key={c.id + i}>
                    {open ? <MiniCard c={c} small /> : <div className="w-9 h-12 bg-gradient-to-br from-red-500 to-purple-600 border-2 border-black rounded-md flex items-center justify-center text-white font-black">?</div>}
                  </div>
                ))}
              </div>
              <div className="text-xs font-black">
                {open ? (sc.isThreeFace ? '3 CÀO!' : `${sc.score} nút`) : (st.revealed.includes(p.pid) ? 'Đã lật' : 'Úp…')}
              </div>
            </div>
          );
        })}
      </div>
      {!done && (
        <button
          onClick={() => useCasino.getState().reveal()}
          disabled={iRevealed}
          className="bg-amber-500 text-white font-black rounded-xl border-[3px] border-black py-2 disabled:opacity-40"
        >
          {iRevealed ? 'Đã lật — chờ mọi người…' : 'Lật bài của bạn'}
        </button>
      )}
    </div>
  );
}

// ---------------- CARO ----------------
function CaroBoard() {
  const room = useCasino((s) => s.room)!;
  const st = room.state as CaroState;
  const me = myPid();
  const myIdx = st.order.indexOf(me);
  const isMyTurn = st.turn === me && !st.winner && !st.draw;
  const winSet = new Set((st.winLine ?? []).map(([r, c]) => r + ':' + c));

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="text-sm font-bold">
        {st.winner ? `🏆 ${room.players.find((p) => p.pid === st.winner)?.name} thắng!` : st.draw ? 'Hòa!' : isMyTurn ? 'Tới lượt bạn — chạm ô để đánh' : `Lượt: ${room.players.find((p) => p.pid === st.turn)?.name}`}
        <span className="text-xs text-gray-500"> (Bạn: {myIdx === 0 ? '❌ X đi trước' : myIdx === 1 ? '⭕ O' : 'khán giả'})</span>
      </div>
      <div
        className="grid gap-[2px] bg-amber-800 border-[3px] border-black rounded-lg p-1 w-full max-w-[420px]"
        style={{ gridTemplateColumns: `repeat(${st.size}, minmax(0,1fr))` }}
      >
        {st.board.map((row, r) =>
          row.map((v, c) => {
            const win = winSet.has(r + ':' + c);
            return (
              <button
                key={r + '-' + c}
                onClick={() => isMyTurn && useCasino.getState().moveCaro(r, c)}
                className={`aspect-square rounded-[3px] flex items-center justify-center text-sm font-black leading-none ${win ? 'bg-yellow-300' : 'bg-amber-50 hover:bg-amber-100'} ${isMyTurn && v === null ? 'cursor-pointer' : ''}`}
              >
                {v === 0 ? '❌' : v === 1 ? '⭕' : ''}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
