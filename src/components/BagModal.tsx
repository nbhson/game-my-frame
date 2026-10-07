import { itemName, sellPrice } from '../game/data';
import { useGame } from '../game/store';

export default function BagModal() {
  const s = useGame();
  const keys = Object.keys(s.inv).sort((a, b) => s.inv[b] - s.inv[a]);
  return (
    <div>
      <p>🪙 <b>{s.xu}</b> • 💎 <b>{s.gem}</b> • Lv <b>{s.level}</b></p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
        {keys.length === 0 && <p>Kho trống trơn 🕸️</p>}
        {keys.map((pid) => {
          const [nm, em] = itemName(pid);
          const canSell = !pid.startsWith('seed:') && !pid.startsWith('baby');
          return (
            <div key={pid} className="bg-white border-[3px] border-[#2b2117] rounded-lg p-2 text-center">
              <div className="text-3xl">{em}</div>
              <div className="font-extrabold text-xs">{nm}</div>
              <div className="text-orange-700 font-extrabold">x{s.inv[pid]}</div>
              {canSell ? (
                <button className="pixel-btn !text-[10px] !px-2 !py-1.5 mt-1" onClick={() => s.sell(pid, false)}>
                  Bán {sellPrice(pid)}🪙
                </button>
              ) : (
                <div className="text-[11px] text-stone-500">{pid.startsWith('seed:') ? 'Ra ruộng gieo 🌱' : 'Ra ao/chuồng dùng'}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="pixel-btn !text-[10px]" onClick={() => s.setShopTab('sell')}>💰 Bán nhanh</button>
        <button className="pixel-btn !text-[10px] !bg-stone-300" onClick={() => s.setModal(null)}>Đóng</button>
      </div>
    </div>
  );
}
