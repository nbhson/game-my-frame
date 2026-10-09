import { useState } from 'react';
import { OUTFITS, OUTFIT_SLOTS, type OutfitSlot } from '../game/data';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { GameIcon } from './GameIcon';
import { OutfitPreview } from './ItemPreview';

export default function OutfitModal() {
  const s = useGame();
  const [tab, setTab] = useState<'shop' | 'box'>('shop');
  const [slot, setSlot] = useState<OutfitSlot>('shirt');
  const ownedCount = s.ownedOutfits.length;
  const totalCount = Object.keys(OUTFITS).length;

  return (
    <div>
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 border-2 border-black rounded-xl px-3 py-2 text-white text-center mb-2">
        <div className="font-black">👗 SHOP THỜI TRANG THỊ TRẤN</div>
        <div className="text-xs opacity-90">
          Ví: <b className="text-yellow-300">{s.xu} xu</b> • <b className="text-sky-300">{s.gem} gem</b> — mua là cất vào tủ, thích thì mặc!
        </div>
      </div>

      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => { sfx.click(); setTab('shop'); }}
          className={`flex-1 px-2.5 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] ${tab === 'shop' ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
        >
          🛍️ Cửa hàng
        </button>
        <button
          onClick={() => { sfx.click(); setTab('box'); }}
          className={`flex-1 px-2.5 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] ${tab === 'box' ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
        >
          🎒 Tủ đồ ({ownedCount}/{totalCount})
        </button>
      </div>

      {tab === 'shop' ? (
        <ShopTab slot={slot} setSlot={setSlot} />
      ) : (
        <WardrobeTab goShop={() => setTab('shop')} />
      )}

      <div className="flex items-center gap-2 mt-2 text-[12px] text-stone-500">
        <GameIcon name={`farmer${s.avatar % 4}`} size={26} />
        Tips: đồ gem chỉ để… đẹp thôi, nhưng đẹp là một loại sức mạnh 😎
      </div>
    </div>
  );
}

/** Tab cửa hàng: mua đồ mới — mua xong cất vào Tủ đồ */
function ShopTab({ slot, setSlot }: { slot: OutfitSlot; setSlot: (sl: OutfitSlot) => void }) {
  const s = useGame();
  const items = Object.values(OUTFITS).filter((o) => o.slot === slot);

  return (
    <div>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {OUTFIT_SLOTS.map((sl) => {
          const worn = OUTFITS[s.outfit[sl.id]];
          return (
            <button
              key={sl.id}
              onClick={() => { sfx.click(); setSlot(sl.id); }}
              className={`px-2 py-1.5 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[12px] flex items-center gap-1 ${slot === sl.id ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
              title={worn ? `Đang mặc: ${worn.name}` : sl.name}
            >
              {worn ? <OutfitPreview slot={sl.id} itemId={worn.id} size={30} /> : <span className="text-xl">{sl.emoji}</span>} {sl.name}
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
              <div className="flex justify-center bg-[#f3efe4] border-2 border-black rounded-lg py-1"><OutfitPreview slot={it.slot} itemId={it.id} size={72} /></div>
              <div className="font-extrabold text-[13px]">{it.name} {worn && '✅'}</div>
              <div className="text-[11px] text-stone-500 min-h-[28px]">{it.desc}</div>
              <div className="text-[12px] font-black text-amber-600 mb-1">{owned ? (worn ? 'Đang mặc' : 'Đã có trong tủ 🎒') : price}</div>
              {worn ? (
                <div className="text-[11px] font-bold text-green-600">Đẹp lắm, khỏi đổi!</div>
              ) : owned ? (
                <button onClick={() => s.wearOutfit(it.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full">Mặc ngay</button>
              ) : (
                <button onClick={() => s.buyOutfit(it.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full">Mua</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tab tủ đồ: toàn bộ quần áo/phụ kiện đã mua + đang mặc món nào */
function WardrobeTab({ goShop }: { goShop: () => void }) {
  const s = useGame();
  const owned = s.ownedOutfits.map((id) => OUTFITS[id]).filter(Boolean);
  const boughtExtra = owned.filter((it) => {
    const price = (it.priceXu ?? 0) + (it.priceGem ?? 0);
    return price > 0;
  });

  return (
    <div>
      <div className="bg-amber-50 border-[3px] border-black rounded-xl p-2 mb-2">
        <div className="font-black text-[13px] mb-1.5">🧍 Đang mặc trên người</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {OUTFIT_SLOTS.map((sl) => {
            const worn = OUTFITS[s.outfit[sl.id]];
            return (
              <div key={sl.id} className="bg-white border-2 border-black rounded-lg px-2 py-1.5 flex items-center gap-2">
                {worn ? <OutfitPreview slot={sl.id} itemId={worn.id} size={40} /> : <span className="text-2xl">{sl.emoji}</span>}
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold text-stone-500">{sl.name}</span>
                  <span className="block text-[12px] font-extrabold truncate">{worn?.name ?? '—'}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {boughtExtra.length === 0 ? (
        <div className="text-center bg-white border-[3px] border-dashed border-stone-300 rounded-xl p-4">
          <p className="text-3xl">🎒</p>
          <p className="font-extrabold text-[13px] mt-1">Tủ đồ mới có đồ mặc định</p>
          <p className="text-[12px] text-stone-500">Ghé Cửa hàng sắm thêm áo quần, nón, tóc, giày, phụ kiện, cánh nhé!</p>
          <button onClick={() => { sfx.click(); goShop(); }} className="pixel-btn !text-[11px] mt-2">🛍️ Qua cửa hàng</button>
        </div>
      ) : (
        OUTFIT_SLOTS.map((sl) => {
          const items = owned.filter((it) => it.slot === sl.id && ((it.priceXu ?? 0) + (it.priceGem ?? 0) > 0));
          if (!items.length) return null;
          return (
            <div key={sl.id} className="mb-2">
              <div className="font-black text-[13px] mb-1">{sl.emoji} {sl.name} ({items.length})</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {items.map((it) => {
                  const worn = s.outfit[it.slot] === it.id;
                  return (
                    <div key={it.id} className={`border-[3px] rounded-xl p-2 text-center ${worn ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-black'}`}>
                      <div className="flex justify-center bg-[#f3efe4] border-2 border-black rounded-lg py-1"><OutfitPreview slot={it.slot} itemId={it.id} size={72} /></div>
                      <div className="font-extrabold text-[13px]">{it.name} {worn && '✅'}</div>
                      {worn ? (
                        <div className="text-[11px] font-bold text-green-600 mt-1">Đang mặc</div>
                      ) : (
                        <button onClick={() => s.wearOutfit(it.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full mt-1">Mặc</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
