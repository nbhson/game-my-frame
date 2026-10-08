import { useState } from 'react';
import { OUTFITS, OUTFIT_SLOTS, type OutfitSlot } from '../game/data';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { GameIcon } from './GameIcon';

export default function OutfitModal() {
  const s = useGame();
  const [slot, setSlot] = useState<OutfitSlot>('shirt');
  const items = Object.values(OUTFITS).filter((o) => o.slot === slot);

  return (
    <div>
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 border-2 border-black rounded-xl px-3 py-2 text-white text-center mb-2">
        <div className="font-black">👗 SHOP THỜI TRANG CÔNG VIÊN</div>
        <div className="text-xs opacity-90">
          Ví: <b className="text-yellow-300">{s.xu} xu</b> • <b className="text-sky-300">{s.gem} gem</b> — mua là mặc ngay, cả làng cùng ngắm!
        </div>
      </div>

      <div className="flex gap-1.5 mb-2 flex-wrap">
        {OUTFIT_SLOTS.map((sl) => {
          const worn = OUTFITS[s.outfit[sl.id]];
          return (
            <button
              key={sl.id}
              onClick={() => { sfx.click(); setSlot(sl.id); }}
              className={`px-2.5 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[12px] ${slot === sl.id ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
              title={worn ? `Đang mặc: ${worn.name}` : sl.name}
            >
              {sl.emoji} {sl.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((it) => {
          const owned = s.ownedOutfits.includes(it.id);
          const worn = s.outfit[it.slot] === it.id;
          const price = it.priceGem ? `${it.priceGem} gem` : it.priceXu ? `${it.priceXu} xu` : 'Miễn phí';
          return (
            <div key={it.id} className={`border-[3px] rounded-xl p-2 text-center ${worn ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-black'}`}>
              <div className="text-3xl">{it.emoji}</div>
              <div className="font-extrabold text-[13px]">{it.name} {worn && '✅'}</div>
              <div className="text-[11px] text-stone-500 min-h-[28px]">{it.desc}</div>
              <div className="text-[12px] font-black text-amber-600 mb-1">{owned ? (worn ? 'Đang mặc' : 'Đã sở hữu') : price}</div>
              {worn ? (
                <div className="text-[11px] font-bold text-green-600">Đẹp lắm, khỏi đổi!</div>
              ) : owned ? (
                <button onClick={() => s.wearOutfit(it.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full">Mặc ngay</button>
              ) : (
                <button onClick={() => s.buyOutfit(it.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full">Mua + mặc</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[12px] text-stone-500">
        <GameIcon name={`farmer${s.avatar % 4}`} size={26} />
        Tips: đồ gem chỉ để… đẹp thôi, nhưng đẹp là một loại sức mạnh 😎
      </div>
    </div>
  );
}
