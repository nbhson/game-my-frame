// ===== Casino modal: sảnh + phòng + 5 bàn (tiến lên / bài cào / xì dách / caro / cờ vua) =====
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { CASINO_BAICAO_MS, CASINO_GAMES, CASINO_MAX_BET, CASINO_MIN_BET, CASINO_TURN_MS, useCasino, type CasinoGame, type CasinoRoom } from '../net/casino';
import { getPresenceId } from '../net/session';
import { cardLabel, isRed, type Card } from '../game/casino/cards';
import { comboOf } from '../game/casino/tienlen';
import { scoreHand } from '../game/casino/baicao';
import { xiDachLabel, xiDachValue, type XiDachState } from '../game/casino/xidach';
import {
  CHESS_DRAW_TEXT, CHESS_WIN_TEXT, capturedOf, legalMovesFor, materialLead,
  type ChessState, type PieceType,
} from '../game/casino/chess';
import type { TienLenState } from '../game/casino/tienlen';
import type { BaiCaoState } from '../game/casino/baicao';
import type { CaroState } from '../game/casino/caro';

function myPid(): string {
  try { return getPresenceId(); } catch { return ''; }
}

/** tick mỗi 500ms để đếm ngược mượt */
function useNow(ms = 500): number {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

/** Banner lượt chung cho cả bàn: ai đang đi + đếm ngược + thanh thời gian */
function TurnBanner({ turnPid, deadline, fullMs, actionText }: { turnPid: string; deadline: number | null | undefined; fullMs: number; actionText: string }) {
  const now = useNow();
  const me = myPid();
  const room = useCasino((s) => s.room)!;
  const cur = room.players.find((p) => p.pid === turnPid);
  const remain = deadline != null ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const frac = deadline != null ? Math.max(0, Math.min(1, (deadline - now) / fullMs)) : 1;
  const urgent = remain != null && remain <= 10;
  const isMe = turnPid === me;
  return (
    <div className={`border-[3px] rounded-xl px-3 py-1.5 text-center ${isMe ? 'bg-yellow-200 border-yellow-500 animate-pulse' : urgent ? 'bg-red-100 border-red-500' : 'bg-purple-700 border-black text-white'}`}>
      <div className="font-black text-sm">
        {isMe ? '⚡ TỚI LƯỢT BẠN! ' : `⏳ ${cur?.name ?? '?'} ${actionText} `}
        {remain != null && <span className={`ml-1 px-1.5 rounded ${urgent ? 'bg-red-500 text-white' : 'bg-black/20'}`}>{remain}s</span>}
      </div>
      {remain != null && (
        <div className="h-1.5 mt-1 rounded-full bg-black/20 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${urgent ? 'bg-red-500' : 'bg-green-400'}`} style={{ width: `${frac * 100}%` }} />
        </div>
      )}
      {urgent && !isMe && <div className="text-[11px] font-bold text-red-600">Sắp hết giờ — tự đánh!</div>}
      {urgent && isMe && <div className="text-[11px] font-bold text-red-600">Nhanh lên, sắp tự đánh!</div>}
    </div>
  );
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
        <div className="text-xs opacity-90">Tiến lên • Bài cào • Xì dách • Caro • Cờ vua — cược {CASINO_MIN_BET}-{CASINO_MAX_BET} xu/ván • Nhất ăn tất</div>
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
          <div className="text-xs text-gray-500 text-center">Đủ 2 người là bắt đầu được • mã phòng: <b>#{room.id}</b> — bạn bè bấm Vào</div>
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
      {room.game === 'xidach' && <XiDachBoard />}
      {room.game === 'caro' && <CaroBoard />}
      {room.game === 'chess' && <ChessBoard />}
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
      <TurnBanner turnPid={st.turn} deadline={st.deadline} fullMs={CASINO_TURN_MS} actionText="đang nghĩ…" />
      <div className="grid grid-cols-3 gap-1.5">
        {others.map((p) => {
          const n = st.hands[p.pid]?.length ?? 0;
          const isTurn = st.turn === p.pid;
          return (
            <div key={p.pid} className={`border-[3px] rounded-xl px-2 py-1 text-center transition-all ${isTurn ? 'bg-yellow-100 border-yellow-500 scale-105 shadow-lg animate-pulse' : 'bg-white border-black'}`}>
              <div className="font-bold text-xs truncate">{isTurn ? '⏳ ' : ''}{p.name}{isTurn ? ' đang đi' : ''}</div>
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
      <div className={`bg-amber-50 border-[3px] rounded-xl p-2 transition-all ${isMyTurn ? 'border-yellow-500 shadow-[0_0_12px_rgba(234,179,8,.7)]' : 'border-black'}`}>
        <div className="text-center text-xs font-black mb-1 text-amber-700">
          {isMyTurn ? '⚡ Bài của bạn — chọn rồi Đánh / Bỏ qua' : `Bài của bạn (${hand.length} lá)`}
        </div>
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
  const now = useNow();
  const iRevealed = st.revealed.includes(me);
  const done = room.status === 'finished';
  const pending = room.players.filter((p) => !st.revealed.includes(p.pid));
  const remain = !done && st.deadline != null ? Math.max(0, Math.ceil((st.deadline - now) / 1000)) : null;
  const frac = !done && st.deadline != null ? Math.max(0, Math.min(1, (st.deadline - now) / CASINO_BAICAO_MS)) : 1;
  const urgent = remain != null && remain <= 10;

  return (
    <div className="flex flex-col gap-2">
      {!done && (
        <div className={`border-[3px] rounded-xl px-3 py-1.5 text-center ${urgent ? 'bg-red-100 border-red-500 animate-pulse' : 'bg-purple-700 border-black text-white'}`}>
          <div className="font-black text-sm">
            ⏳ Chờ {pending.length} người lật bài{remain != null && <span className={`ml-1 px-1.5 rounded ${urgent ? 'bg-red-500 text-white' : 'bg-black/20'}`}>{remain}s</span>}
          </div>
          <div className="h-1.5 mt-1 rounded-full bg-black/20 overflow-hidden">
            <div className={`h-full rounded-full ${urgent ? 'bg-red-500' : 'bg-green-400'}`} style={{ width: `${frac * 100}%` }} />
          </div>
          <div className="text-[11px] opacity-90">Hết giờ tự lật hết • {pending.map((p) => p.name).join(', ') || '—'}</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {room.players.map((p) => {
          const hand = st.hands[p.pid] ?? [];
          const open = done || st.revealed.includes(p.pid);
          const waiting = !open;
          const sc = scoreHand(hand);
          const win = (room.winners ?? []).includes(p.pid);
          return (
            <div key={p.pid} className={`border-[3px] rounded-xl px-2 py-1.5 text-center transition-all ${win ? 'bg-yellow-100 border-yellow-500 scale-105 shadow-lg' : waiting ? 'bg-orange-50 border-orange-400 animate-pulse' : 'bg-white border-black opacity-80'}`}>
              <div className="font-bold text-xs truncate">{p.name} {p.pid === me && '(bạn)'} {win && '🏆'} {waiting && '⏳'}</div>
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
  const isMyTurn = st.turn === me && !st.winner && !st.draw;
  const winSet = new Set((st.winLine ?? []).map(([r, c]) => r + ':' + c));

  return (
    <div className="flex flex-col gap-2 items-center">
      <TurnBanner turnPid={st.turn} deadline={st.deadline} fullMs={CASINO_TURN_MS} actionText="đang nghĩ nước đi…" />
      <div className="flex gap-2 w-full max-w-[420px]">
        {st.order.map((pid, idx) => {
          const p = room.players.find((x) => x.pid === pid);
          const active = st.turn === pid && !st.winner && !st.draw;
          return (
            <div key={pid} className={`flex-1 border-[3px] rounded-xl px-2 py-1 text-center font-bold text-sm transition-all ${active ? 'bg-yellow-100 border-yellow-500 scale-105 shadow-lg animate-pulse' : 'bg-white border-black opacity-80'}`}>
              {idx === 0 ? '❌' : '⭕'} {p?.name ?? '?'} {pid === me && '(bạn)'} {active && '⏳'}
            </div>
          );
        })}
      </div>
      <div className="text-sm font-bold">
        {st.winner ? `🏆 ${room.players.find((p) => p.pid === st.winner)?.name} thắng!` : st.draw ? 'Hòa!' : isMyTurn ? 'Chạm ô để đánh' : `Lượt: ${room.players.find((p) => p.pid === st.turn)?.name}`}
      </div>
      <div
        className={`grid gap-[2px] bg-amber-800 border-[3px] rounded-lg p-1 w-full max-w-[420px] transition-all ${isMyTurn ? 'border-yellow-400 shadow-[0_0_14px_rgba(234,179,8,.8)]' : 'border-black'}`}
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

// ---------------- XÌ DÁCH (đấu nhà cái) ----------------
function FaceDownCard({ small }: { small?: boolean }) {
  return (
    <div className={`bg-gradient-to-br from-red-500 to-purple-600 border-2 border-black rounded-md flex items-center justify-center text-white font-black ${small ? 'w-9 h-12 text-sm' : 'w-11 h-14 text-base'}`}>
      ?
    </div>
  );
}

function XiDachBoard() {
  const room = useCasino((s) => s.room)!;
  const st = room.state as XiDachState;
  const me = myPid();
  const done = st.phase === 'done';
  const isMyTurn = st.turn === me && !done;
  const myHand = st.hands[me] ?? [];
  const dealerOpen = done;

  return (
    <div className="flex flex-col gap-2">
      {!done && (
        <TurnBanner turnPid={st.turn} deadline={st.deadline} fullMs={CASINO_TURN_MS} actionText="đang rút/dằn…" />
      )}
      {/* nhà cái */}
      <div className={`border-[3px] rounded-xl px-2 py-1.5 text-center ${done ? 'bg-white border-black' : 'bg-slate-800 border-black text-white'}`}>
        <div className="font-bold text-xs">
          🎩 Nhà cái {dealerOpen ? `• ${xiDachLabel(st.dealer)}` : '• đang úp bài…'}
          {done && (room.winners ?? []).length === 0 && <span className="ml-1 text-red-600">ăn hết!</span>}
        </div>
        <div className="flex gap-1 justify-center my-1">
          {st.dealer.map((c, i) => (
            <div key={c.id + i}>{dealerOpen ? <MiniCard c={c} small /> : <FaceDownCard small />}</div>
          ))}
        </div>
      </div>
      {/* các nhà con */}
      <div className="grid grid-cols-2 gap-1.5">
        {room.players.map((p) => {
          const hand = st.hands[p.pid] ?? [];
          const mine = p.pid === me;
          const open = done || mine;
          const win = (room.winners ?? []).includes(p.pid);
          const stood = st.stood.includes(p.pid);
          const isTurn = st.turn === p.pid && !done;
          return (
            <div key={p.pid} className={`border-[3px] rounded-xl px-2 py-1.5 text-center transition-all ${win ? 'bg-yellow-100 border-yellow-500 scale-105 shadow-lg' : isTurn ? 'bg-amber-50 border-amber-500 animate-pulse' : 'bg-white border-black opacity-90'}`}>
              <div className="font-bold text-xs truncate">
                {p.name} {mine && '(bạn)'} {win && '🏆'} {isTurn && '⏳'}
              </div>
              <div className="flex gap-1 justify-center my-1 flex-wrap">
                {hand.map((c, i) => (
                  <div key={c.id + i}>{open ? <MiniCard c={c} small /> : <FaceDownCard small />}</div>
                ))}
                {!open && <div className="text-[11px] text-gray-500 self-center">{hand.length} lá úp</div>}
              </div>
              <div className="text-xs font-black">
                {open ? xiDachLabel(hand) : stood ? 'Đã dằn' : `${xiDachValue(hand) >= 16 ? 'Đủ tuổi' : 'Chưa đủ tuổi'}…`}
              </div>
            </div>
          );
        })}
      </div>
      {!done && (
        <div className="flex gap-2">
          <button
            onClick={() => useCasino.getState().hitOrStand(true)}
            disabled={!isMyTurn || myHand.length >= 5}
            className="flex-1 py-2 bg-red-500 text-white font-black rounded-xl border-[3px] border-black disabled:opacity-40 active:scale-95"
          >
            Rút thêm
          </button>
          <button
            onClick={() => useCasino.getState().hitOrStand(false)}
            disabled={!isMyTurn}
            className="flex-1 py-2 bg-green-600 text-white font-black rounded-xl border-[3px] border-black disabled:opacity-40 active:scale-95"
          >
            Dằn ({xiDachValue(myHand)}đ)
          </button>
        </div>
      )}
      {!done && <div className="text-[11px] text-gray-500 text-center">Đủ 16 mới dằn • Quắc/Dằn non thua luôn • Hòa nhà cái vẫn thắng • Xì bàng &gt; Xì dách &gt; Ngũ linh</div>}
    </div>
  );
}

// ---------------- CỜ VUA ----------------
const CHESS_GLYPH: Record<'w' | 'b', Record<PieceType, string>> = {
  w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const CHESS_PROMOS: PieceType[] = ['q', 'r', 'b', 'n'];

function ChessBoard() {
  const room = useCasino((s) => s.room)!;
  const st = room.state as ChessState;
  const me = myPid();
  const myColor = me === st.order[0] ? 'w' : me === st.order[1] ? 'b' : null;
  const over = !!st.winner || st.draw;
  const isMyTurn = st.turn === me && !over;
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [promo, setPromo] = useState<{ f: [number, number]; t: [number, number] } | null>(null);
  const [armResign, setArmResign] = useState(false);
  useEffect(() => { setSel(null); setPromo(null); }, [st.turn, st.history.length]);
  const targets = useMemo(
    () => (sel && isMyTurn ? legalMovesFor(st, sel[0], sel[1], me) : []),
    [st, sel, isMyTurn, me],
  );
  const targetSet = new Set(targets.map((m) => m.t[0] + ':' + m.t[1] + ':' + (m.pr ?? '')));
  const lastF = st.lastMove ? st.lastMove.f[0] + ':' + st.lastMove.f[1] : null;
  const lastT = st.lastMove ? st.lastMove.t[0] + ':' + st.lastMove.t[1] : null;
  const { lostW, lostB } = capturedOf(st.board);
  const lead = materialLead(st.board);
  const flip = myColor === 'b';
  const rows = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const nameOf = (pid: string) => room.players.find((p) => p.pid === pid)?.name ?? '?';
  const resultText = st.winner
    ? `🏆 ${nameOf(st.winner)} thắng — ${st.winReason ? (CHESS_WIN_TEXT[st.winReason] ?? st.winReason) : 'Đối thủ rời phòng'}!`
    : st.draw
      ? `🤝 Hòa — ${st.drawReason ? (CHESS_DRAW_TEXT[st.drawReason] ?? '') : ''}! Hoàn cược`
      : isMyTurn
        ? (myColor === 'w' ? 'Bạn cầm Trắng — chạm quân để đi' : 'Bạn cầm Đen — chạm quân để đi')
        : `Lượt: ${nameOf(st.turn)}`;

  const clickSq = (r: number, c: number) => {
    if (!isMyTurn || promo) return;
    const key = r + ':' + c;
    // đi tới ô đã highlight
    if (sel && targetSet.has(key + ':')) {
      const mv = targets.find((m) => m.t[0] === r && m.t[1] === c && !m.pr);
      if (mv) { useCasino.getState().chessMove(mv.f, mv.t); setSel(null); return; }
    }
    if (sel && targets.some((m) => m.t[0] === r && m.t[1] === c && m.pr)) {
      // cần chọn quân phong cấp
      setPromo({ f: sel, t: [r, c] });
      return;
    }
    const p = st.board[r][c];
    if (p && myColor && p.c === myColor) setSel(sel && sel[0] === r && sel[1] === c ? null : [r, c]);
    else setSel(null);
  };

  return (
    <div className="flex flex-col gap-2 items-center">
      {!over && (
        <TurnBanner turnPid={st.turn} deadline={st.deadline} fullMs={CASINO_TURN_MS} actionText="đang nghĩ nước đi…" />
      )}
      <div className="flex gap-2 w-full max-w-[420px] text-xs font-bold">
        <div className={`flex-1 border-2 rounded-lg px-2 py-1 text-center ${st.turn === st.order[0] && !over ? 'bg-white border-black' : 'bg-gray-100 border-gray-300 opacity-70'}`}>
          ♚ {nameOf(st.order[0])} {myColor === 'w' && '(bạn)'}
          {lead > 0 && <span className="text-green-600"> +{lead}</span>}
        </div>
        <div className={`flex-1 border-2 rounded-lg px-2 py-1 text-center ${st.turn === st.order[1] && !over ? 'bg-slate-800 text-white border-black' : 'bg-gray-100 border-gray-300 opacity-70'}`}>
          ♚ {nameOf(st.order[1])} {myColor === 'b' && '(bạn)'}
          {lead < 0 && <span className="text-green-600"> +{-lead}</span>}
        </div>
      </div>
      {st.inCheck && !over && <div className="text-sm font-black text-red-600 animate-pulse">⚠️ CHIẾU! Bảo vệ Vua ngay</div>}
      <div className="text-sm font-bold h-5">
        {resultText}
      </div>
      <div className="relative w-full max-w-[420px]">
        <div
          className={`grid grid-cols-8 gap-[2px] bg-amber-800 border-[3px] rounded-lg p-1 transition-all ${isMyTurn ? 'border-yellow-400 shadow-[0_0_14px_rgba(234,179,8,.8)]' : 'border-black'}`}
        >
          {rows.map((r) =>
            cols.map((c) => {
              const p = st.board[r][c];
              const isSel = sel?.[0] === r && sel?.[1] === c;
              const isTarget = targetSet.has(r + ':' + c + ':') || targets.some((m) => m.t[0] === r && m.t[1] === c);
              const isLast = lastF === r + ':' + c || lastT === r + ':' + c;
              const isCheckK = p?.t === 'k' && st.inCheck && ((st.turn === st.order[0] && p.c === 'w') || (st.turn === st.order[1] && p.c === 'b'));
              const light = (r + c) % 2 === 1;
              return (
                <button
                  key={r + '-' + c}
                  onClick={() => clickSq(r, c)}
                  className={`aspect-square rounded-[3px] flex items-center justify-center leading-none relative
                    ${isCheckK ? 'bg-red-500' : isSel ? 'bg-yellow-300' : isLast ? (light ? 'bg-amber-200' : 'bg-amber-400/70') : light ? 'bg-amber-100' : 'bg-amber-600/80'}
                    ${isMyTurn && (p || isTarget) ? 'cursor-pointer' : ''}`}
                >
                  {p && (
                    <span
                      className="text-2xl sm:text-3xl"
                      style={{ color: p.c === 'w' ? '#fff' : '#111', textShadow: p.c === 'w' ? '-1px -1px 0 #111,1px -1px 0 #111,-1px 1px 0 #111,1px 1px 0 #111' : '-1px -1px 0 #eee,1px -1px 0 #eee,-1px 1px 0 #eee,1px 1px 0 #eee' }}
                    >
                      {CHESS_GLYPH[p.c][p.t]}
                    </span>
                  )}
                  {!p && isTarget && <span className="w-2.5 h-2.5 rounded-full bg-green-600/80" />}
                  {p && isTarget && <span className="absolute inset-0 rounded-[3px] border-[3px] border-green-600" />}
                </button>
              );
            }),
          )}
        </div>
        {/* chọn quân phong cấp */}
        {promo && (
          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center z-10">
            <div className="bg-white border-[3px] border-black rounded-xl p-3 text-center">
              <div className="font-black text-sm mb-2">Phong cấp tốt thành:</div>
              <div className="flex gap-2">
                {CHESS_PROMOS.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      useCasino.getState().chessMove(promo.f, promo.t, t);
                      setPromo(null); setSel(null);
                    }}
                    className="w-12 h-12 text-3xl bg-amber-100 border-2 border-black rounded-lg hover:bg-yellow-200 active:scale-95"
                    style={{ color: myColor === 'w' ? '#fff' : '#111', textShadow: myColor === 'w' ? '-1px -1px 0 #111,1px -1px 0 #111,-1px 1px 0 #111,1px 1px 0 #111' : '-1px -1px 0 #eee,1px -1px 0 #eee,-1px 1px 0 #eee,1px 1px 0 #eee' }}
                  >
                    {CHESS_GLYPH[myColor ?? 'w'][t]}
                  </button>
                ))}
              </div>
              <button onClick={() => setPromo(null)} className="mt-2 text-xs underline font-bold">Hủy</button>
            </div>
          </div>
        )}
      </div>
      {/* quân đã ăn + lịch sử */}
      <div className="flex gap-2 w-full max-w-[420px]">
        <div className="flex-1 bg-white border-2 border-black rounded-lg px-2 py-1 text-xs min-h-[34px]">
          <span className="font-bold">Trắng ăn: </span>
          {lostB.map((t, i) => <span key={i} className="text-base" style={{ color: '#111' }}>{pieceMini(t, 'b')}</span>)}
          {lostB.length === 0 && <span className="opacity-50">—</span>}
        </div>
        <div className="flex-1 bg-slate-800 text-white border-2 border-black rounded-lg px-2 py-1 text-xs min-h-[34px]">
          <span className="font-bold">Đen ăn: </span>
          {lostW.map((t, i) => <span key={i} className="text-base" style={{ color: '#fff', textShadow: '-1px -1px 0 #111,1px -1px 0 #111,-1px 1px 0 #111,1px 1px 0 #111' }}>{pieceMini(t, 'w')}</span>)}
          {lostW.length === 0 && <span className="opacity-50">—</span>}
        </div>
      </div>
      {st.history.length > 0 && (
        <div className="w-full max-w-[420px] bg-white border-2 border-black rounded-lg px-2 py-1 text-xs max-h-20 overflow-y-auto">
          {pairHistory(st.history).map((pair, i) => (
            <span key={i} className="mr-2 whitespace-nowrap">
              <b>{i + 1}.</b> {pair[0]}{pair[1] ? ` ${pair[1]}` : ''}
            </span>
          ))}
        </div>
      )}
      {!over && isMyTurn && (
        <button
          onClick={() => {
            if (armResign) { useCasino.getState().resignChess(); setArmResign(false); }
            else { setArmResign(true); setTimeout(() => setArmResign(false), 3000); }
          }}
          className={`text-xs font-bold rounded-lg border-2 border-black px-3 py-1 ${armResign ? 'bg-red-500 text-white' : 'bg-white'}`}
        >
          {armResign ? 'Bấm lại để chịu thua' : 'Đầu hàng'}
        </button>
      )}
      {!over && <div className="text-[11px] text-gray-500 text-center">Nhập thành, bắt tốt qua đường, phong cấp đầy đủ • Hòa: hết nước / thiếu quân / 50 nước / lặp 3 lần</div>}
    </div>
  );
}

function pieceMini(t: PieceType, c: 'w' | 'b'): string {
  return CHESS_GLYPH[c][t];
}

function pairHistory(h: string[]): [string, string?][] {
  const out: [string, string?][] = [];
  for (let i = 0; i < h.length; i += 2) out.push([h[i], h[i + 1]]);
  return out;
}
