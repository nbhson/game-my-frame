// ===== MODAL CHỢ ĐÊM: mua hàng / trả giá dice / quản lý sạp của mình =====
import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { itemName } from '../game/data';
import {
  displaySlot, isMarketOpen, loadSavedStall, marketStatus, suggestPrice, useMarket,
} from '../net/market';
import { gameMe } from '../net/village';

const btn = 'py-2.5 px-3 rounded-2xl bg-green-500 border-4 border-black text-white font-black hover:bg-green-400 disabled:opacity-40';
const btn2 = 'py-2 px-3 rounded-2xl bg-amber-400 border-4 border-black font-black hover:bg-amber-300 disabled:opacity-40';
const btnRed = 'py-2 px-3 rounded-2xl bg-red-500 border-4 border-black text-white font-black hover:bg-red-400';

function Qty({ v, max, set }: { v: number; max: number; set: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button className={btn2} onClick={() => set(Math.max(1, v - 1))}>−</button>
      <span className="font-black text-lg w-10 text-center">{v}</span>
      <button className={btn2} onClick={() => set(Math.min(max, v + 1))}>+</button>
    </div>
  );
}

function BuyPane({ seller }: { seller: string }) {
  const stalls = useMarket((s) => s.stalls);
  const hag = useMarket((s) => s.hag);
  const buy = useMarket((s) => s.buy);
  const offerHag = useMarket((s) => s.offerHag);
  const confirmCounter = useMarket((s) => s.confirmCounter);
  const cancelHag = useMarket((s) => s.cancelHag);
  const xu = useGame((s) => s.xu);
  const stall = stalls[seller];
  const [qty, setQty] = useState(1);
  const [offer, setOffer] = useState(0);
  const open = isMarketOpen();
  if (!stall) return <div className="p-4 text-center font-bold">Sạp dọn rồi, hẹn bạn phiên sau!</div>;
  const [nm, emoji] = itemName(stall.pid);
  const total = stall.price * qty;
  const active = hag.status === 'waiting' || hag.status === 'counter';
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="text-5xl">{emoji}</div>
        <div className="font-black text-lg">{nm} x{stall.qty}</div>
        <div className="text-sm font-bold text-stone-600">Sạp {displaySlot(stalls, seller) + 1} của <b>{seller}</b></div>
        <div className="font-black text-green-700 text-xl">{stall.price} xu/cái</div>
        {!open && <div className="text-sm font-bold text-red-600">🌙 {marketStatus().label} — quay lại lúc mở chợ nhé!</div>}
      </div>
      <div className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border-2 border-black">
        <span className="font-bold">Số lượng</span>
        <Qty v={qty} max={Math.min(stall.qty, 99)} set={(n) => { setQty(n); setOffer(Math.floor(stall.price * n * 0.8)); }} />
      </div>
      <button className={btn + ' w-full'} disabled={!open || xu < total} onClick={() => buy(seller, qty)}>
        MUA NGAY −{total} xu (bạn có {xu})
      </button>
      {stall.haggle ? (
        <div className="bg-amber-100 rounded-xl p-2 border-2 border-black space-y-2">
          <div className="font-black text-sm">🎲 TRẢ GIÁ (chủ sạp lắc dice: 5-6 đồng ý • 3-4 gạ giá giữa • 1-2 lắc đầu)</div>
          {hag.status === 'idle' || hag.status === 'done' || hag.status === 'declined' || hag.status === 'timeout' ? (
            <>
              {(hag.status === 'declined' || hag.status === 'timeout') && (
                <div className="text-sm font-bold text-red-600">{hag.status === 'declined' ? '😅 Bị từ chối — trả cao hơn thử!' : '⏰ Chủ sạp đi đâu mất!'}</div>
              )}
              {hag.status === 'done' && <div className="text-sm font-bold text-green-700">🎉 Chốt đơn thành công!</div>}
              <div className="flex items-center gap-2">
                <input type="number" className="w-28 px-2 py-1.5 rounded-xl border-2 border-black font-bold"
                  value={offer || Math.floor(total * 0.8)}
                  onChange={(e) => setOffer(Math.max(0, +e.target.value || 0))} />
                <span className="font-bold text-sm">xu / {qty} cái</span>
                <button className={btn2} disabled={!open} onClick={() => offerHag(seller, qty, offer || Math.floor(total * 0.8))}>🎲 TRẢ GIÁ</button>
              </div>
            </>
          ) : hag.status === 'waiting' ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-spin">🎲</span>
              <span className="font-bold text-sm">Đang chờ {hag.seller} lắc dice cho giá {hag.offer} xu…</span>
              <button className={btnRed} onClick={cancelHag}>Hủy</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-bold text-sm">🎲 {hag.seller} gạ <b className="text-green-700">{hag.offer} xu</b> cho {hag.qty} cái — chốt không?</div>
              <div className="flex gap-2">
                <button className={btn} onClick={confirmCounter}>CHỐT −{hag.offer} xu</button>
                <button className={btnRed} onClick={cancelHag}>Thôi</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm font-bold text-stone-500 text-center">Sạp này niêm yết, không trả giá.</div>
      )}
    </div>
  );
}

function ManagePane() {
  const own = useMarket((s) => s.own);
  const updateOwn = useMarket((s) => s.updateOwn);
  const closeStall = useMarket((s) => s.closeStall);
  const inv = useGame((s) => s.inv);
  if (!own) return null;
  const [nm, emoji] = itemName(own.pid);
  const have = inv[own.pid] || 0;
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="text-5xl">{emoji}</div>
        <div className="font-black text-lg">Sạp của bạn (ô {own.slot + 1}): {nm}</div>
        <div className="text-sm font-bold text-stone-600">Kho còn {have} — bày bán {own.qty}</div>
      </div>
      <div className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border-2 border-black">
        <span className="font-bold">Giá (xu/cái)</span>
        <Qty v={own.price} max={99999} set={(n) => updateOwn(n, own.qty, own.haggle)} />
      </div>
      <div className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border-2 border-black">
        <span className="font-bold">Số lượng bày</span>
        <Qty v={own.qty} max={Math.max(1, have)} set={(n) => updateOwn(own.price, n, own.haggle)} />
      </div>
      <label className="flex items-center gap-2 font-bold bg-white/70 rounded-xl px-3 py-2 border-2 border-black cursor-pointer">
        <input type="checkbox" className="w-5 h-5" checked={own.haggle} onChange={(e) => updateOwn(own.price, own.qty, e.target.checked)} />
        🎲 Cho khách trả giá dice
      </label>
      <button className={btnRed + ' w-full'} onClick={closeStall}>DỌN SẠP VỀ NGHỈ</button>
    </div>
  );
}

function SetupPane() {
  const openStall = useMarket((s) => s.openStall);
  const inv = useGame((s) => s.inv);
  const [pid, setPid] = useState('');
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [haggle, setHaggle] = useState(true);
  const st = marketStatus();
  const items = Object.keys(inv).filter((k) => (inv[k] || 0) > 0 && !k.startsWith('seed:') && !k.startsWith('baby'));
  const saved = loadSavedStall();
  return (
    <div className="space-y-3">
      <div className={`text-center font-black ${st.open ? 'text-green-700' : 'text-red-600'}`}>
        🌙 Chợ đêm {st.label} — dựng sạp ở bãi đông-nam, khách tự ghé mua!
      </div>
      {saved && (inv[saved.pid] || 0) > 0 && (
        <button className={btn2 + ' w-full'} onClick={() => openStall(saved.pid, saved.price, Math.min(inv[saved.pid] || 0, 10), saved.haggle)}>
          ↩️ Dựng lại sạp cũ: {itemName(saved.pid)[0]} — {saved.price} xu
        </button>
      )}
      {!pid ? (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          <div className="font-bold text-sm">1️⃣ Chọn hàng trong kho để bày:</div>
          {items.length === 0 && <div className="font-bold text-stone-500">Kho trống trơn — về farm thu hoạch đã!</div>}
          {items.map((k) => {
            const [nm, emoji] = itemName(k);
            return (
              <button key={k} className="w-full flex justify-between items-center bg-white/70 rounded-xl px-3 py-1.5 border-2 border-black font-bold hover:bg-amber-100"
                onClick={() => { setPid(k); setQty(1); setPrice(suggestPrice(k)); }}>
                <span>{emoji} {nm} x{inv[k]}</span><span className="text-green-700">Chọn →</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-center font-black text-lg">{itemName(pid)[1]} {itemName(pid)[0]} (kho: {inv[pid]})</div>
          <div className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border-2 border-black">
            <span className="font-bold">Giá (xu/cái)</span>
            <div className="flex items-center gap-2">
              <input type="number" className="w-24 px-2 py-1 rounded-xl border-2 border-black font-bold text-right"
                value={price} onChange={(e) => setPrice(Math.max(1, Math.floor(+e.target.value || 1)))} />
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border-2 border-black">
            <span className="font-bold">Số lượng bày</span>
            <Qty v={qty} max={inv[pid] || 1} set={setQty} />
          </div>
          <label className="flex items-center gap-2 font-bold bg-white/70 rounded-xl px-3 py-2 border-2 border-black cursor-pointer">
            <input type="checkbox" className="w-5 h-5" checked={haggle} onChange={(e) => setHaggle(e.target.checked)} />
            🎲 Cho khách trả giá dice
          </label>
          <div className="flex gap-2">
            <button className={btn2} onClick={() => setPid('')}>← Đổi món</button>
            <button className={btn + ' flex-1'} onClick={() => openStall(pid, price, qty, haggle)}>🏪 DỰNG SẠP!</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketModal() {
  const buyTarget = useMarket((s) => s.buyTarget);
  const own = useMarket((s) => s.own);
  const setBuyTarget = useMarket((s) => s.setBuyTarget);
  useEffect(() => () => setBuyTarget(null), [setBuyTarget]);
  const me = gameMe().name;
  if (buyTarget && buyTarget !== me) return <BuyPane seller={buyTarget} />;
  if (own) return <ManagePane />;
  return <SetupPane />;
}
