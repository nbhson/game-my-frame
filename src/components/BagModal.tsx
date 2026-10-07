import { itemName, sellPrice } from '../game/data';
import { useGame } from '../game/store';
import { GameIcon, iconForPid } from './GameIcon';

export default function BagModal() {
  const s = useGame();
  const keys = Object.keys(s.inv).sort((a, b) => s.inv[b] - s.inv[a]);
  return (
    <div>
      <p className="flex items-center gap-1.5"><GameIcon name="coin" size={16} /> <b>{s.xu}</b> • <GameIcon name="gem" size={16} /> <b>{s.gem}</b> • Lv <b>{s.level}</b></p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
        {keys.length === 0 && <p>Kho trống trơn</p>}
        {keys.map((pid) => {
          const [nm] = itemName(pid);
          const canSell = !pid.startsWith('seed:') && !pid.startsWith('baby');
          return (
            <div key={pid} className="bg-white border-[3px] border-[#2b2117] rounded-lg p-2 text-center">
              <div className="flex justify-center"><GameIcon name={iconForPid(pid)} size={34} /></div>
              <div className="font-extrabold text-xs">{nm}</div>
              <div className="text-orange-700 font-extrabold">x{s.inv[pid]}</div>
              {canSell ? (
                <button className="pixel-btn !text-[10px] !px-2 !py-1.5 mt-1 inline-flex items-center gap-1" onClick={() => s.sell(pid, false)}>
                  Bán {sellPrice(pid)}<GameIcon name="coin" size={12} />
                </button>
              ) : (
                <div className="text-[11px] text-stone-500 flex items-center justify-center gap-1">{pid.startsWith('seed:') ? (<>Ra ruộng gieo <GameIcon name="sprout" size={13} /></>) : 'Ra ao/chuồng dùng'}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="pixel-btn !text-[10px] inline-flex items-center gap-1" onClick={() => s.setShopTab('sell')}><GameIcon name="coin" size={14} /> Bán nhanh</button>
        <button className="pixel-btn !text-[10px] !bg-stone-300" onClick={() => s.setModal(null)}>Đóng</button>
      </div>
    </div>
  );
}
