import { useEffect, useState } from 'react';
import {
  CONSOLATION_XU, JACKPOT_GEM, JACKPOT_XU, MAX_TICKETS_PER_DRAW,
  TICKET_PRICE, fmtDraw, useLottery,
} from '../net/lottery';
import { useGame } from '../game/store';

/** Modal mua vé số: chọn số 00-99, vé ngẫu nhiên, xem vé đã mua + lịch sử sổ */
export default function LotteryModal() {
  const l = useLottery();
  const xu = useGame((s) => s.xu);
  const [draft, setDraft] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      useLottery.getState().tick(Date.now());
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const left = l.countdown();
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const quick = ['00', '07', '13', '26', '49', '68', '88', '99'];

  const submit = () => {
    if (!draft.trim()) return;
    l.buyTicket(draft);
    setDraft('');
  };

  return (
    <div className="space-y-3">
      <div className="bg-yellow-100 border-2 border-black rounded-lg p-2 text-center">
        <p className="font-black text-sm">🎫 VÉ SỐ THỊ TRẤN · Kỳ {fmtDraw(l.drawId)}</p>
        <p className="font-black text-lg text-red-600 tabular-nums">
          Sổ sau {mm}:{String(ss).padStart(2, '0')}
        </p>
        <p className="text-[12px] font-bold opacity-80">
          {TICKET_PRICE} xu/vé · tối đa {MAX_TICKETS_PER_DRAW} vé/kỳ · ĐB {JACKPOT_XU} xu +{JACKPOT_GEM} gem · An ủi (trúng số cuối) {CONSOLATION_XU} xu
        </p>
      </div>

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); e.stopPropagation(); }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder="Số 00–99"
          inputMode="numeric"
          maxLength={2}
          className="flex-1 border-[3px] border-black rounded-lg px-3 py-2 text-center text-xl font-black tracking-widest"
        />
        <button
          onClick={submit}
          disabled={xu < TICKET_PRICE || l.tickets.length >= MAX_TICKETS_PER_DRAW}
          className="px-4 py-2 rounded-lg bg-green-600 border-[3px] border-black text-white font-black text-sm hover:bg-green-500 disabled:opacity-40 active:scale-95"
        >
          Mua {TICKET_PRICE}xu
        </button>
        <button
          onClick={() => l.buyRandom()}
          disabled={xu < TICKET_PRICE || l.tickets.length >= MAX_TICKETS_PER_DRAW}
          title="Mua 1 vé số ngẫu nhiên"
          className="px-4 py-2 rounded-lg bg-sky-500 border-[3px] border-black text-white font-black text-sm hover:bg-sky-400 disabled:opacity-40 active:scale-95"
        >
          🎲 Hên xui
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {quick.map((n) => (
          <button
            key={n}
            onClick={() => l.buyTicket(n)}
            disabled={xu < TICKET_PRICE || l.tickets.length >= MAX_TICKETS_PER_DRAW}
            className="px-2.5 py-1 rounded-lg bg-white border-2 border-black font-black text-[13px] hover:bg-yellow-200 disabled:opacity-40 active:scale-95"
          >
            {n}
          </button>
        ))}
      </div>

      <div className="bg-white border-2 border-black rounded-lg p-2">
        <p className="font-black text-[13px]">
          Vé kỳ này ({l.tickets.length}/{MAX_TICKETS_PER_DRAW}):
        </p>
        {l.tickets.length === 0
          ? <p className="text-[12px] font-bold opacity-60">Chưa mua vé nào — làm 1 vé cầu may đi!</p>
          : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {l.tickets.map((t, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-yellow-300 border-2 border-black font-black text-[15px] tracking-widest">{t.num}</span>
              ))}
            </div>
          )}
      </div>

      {l.history.length > 0 && (
        <div className="bg-white border-2 border-black rounded-lg p-2">
          <p className="font-black text-[13px]">Kết quả gần đây:</p>
          <div className="space-y-1 mt-1">
            {l.history.map((h) => (
              <div key={h.drawId} className="flex justify-between items-center text-[12px] font-extrabold bg-[#fff8dc] border border-black/20 rounded px-2 py-1">
                <span>Kỳ {fmtDraw(h.drawId)} → <span className="text-red-600 text-[14px] tracking-widest">{h.winning}</span></span>
                <span className={h.prize > 0 ? 'text-green-700' : 'opacity-60'}>
                  {h.tickets.join(' · ') || '—'} {h.prize > 0 ? `+${h.prize}xu` : 'trượt'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] opacity-60 font-bold text-center">Sổ tự động mỗi 5 phút — trúng tự cộng xu, trúng ĐB cả làng cùng chúc mừng!</p>
    </div>
  );
}
