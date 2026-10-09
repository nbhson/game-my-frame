import { useState } from 'react';
import { CARS, CAR_KINDS, WALK_SPEED } from '../game/data';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { GameIcon } from './GameIcon';
import { CarPreview } from './ItemPreview';

export default function CarShopModal() {
  const s = useGame();
  const [tab, setTab] = useState<'shop' | 'garage'>('shop');
  const cars = Object.values(CARS);

  return (
    <div>
      <div className="bg-gradient-to-r from-red-600 to-orange-500 border-2 border-black rounded-xl px-3 py-2 text-white text-center mb-2">
        <div className="font-black">🚗 GARA ANH TÝ — TRONG NHÀ</div>
        <div className="text-xs opacity-90">
          Ví: <b className="text-yellow-300">{s.xu} xu</b> • <b className="text-sky-300">{s.gem} gem</b> — ra bục trưng bày <b>E</b> để lái thử ngay trong gara!
        </div>
      </div>

      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => { sfx.click(); setTab('shop'); }}
          className={`flex-1 px-2.5 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] ${tab === 'shop' ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
        >
          🛒 Cửa hàng
        </button>
        <button
          onClick={() => { sfx.click(); setTab('garage'); }}
          className={`flex-1 px-2.5 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] ${tab === 'garage' ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
        >
          🚗 Gara ({s.ownedCars.length}/{cars.length})
        </button>
      </div>

      {tab === 'shop' ? <ShopTab /> : <GarageTab goShop={() => setTab('shop')} />}

      <div className="flex items-center gap-2 mt-2 text-[12px] text-stone-500">
        <GameIcon name={`farmer${s.avatar % 4}`} size={26} />
        Tips: đang lái thì không cuốc đất được đâu — bấm X (hoặc vào Gara) để xuống xe!
      </div>
    </div>
  );
}

function speedLabel(speed: number) {
  return `⚡ ${speed} (nhanh gấp ${(speed / WALK_SPEED).toFixed(1)} lần đi bộ)`;
}

/** Tab cửa hàng: mua xe mới theo 3 dòng (đạp → máy → hơi), càng xịn càng đắt */
function ShopTab() {
  const s = useGame();
  return (
    <div className="flex flex-col gap-2">
      {CAR_KINDS.map((k) => {
        const list = Object.values(CARS).filter((c) => c.kind === k.id);
        if (!list.length) return null;
        return (
          <div key={k.id}>
            <div className="font-black text-[12px] text-stone-600 mb-1 flex items-center gap-1.5">
              <span className="bg-[#f3efe4] border-2 border-black rounded-md px-1 shrink-0"><CarPreview carId={list[0].id} h={30} /></span>
              {k.name} ({list.length} loại)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((car) => <CarCard key={car.id} carId={car.id} mode="shop" />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 1 thẻ xe dùng chung shop + gara */
function CarCard({ carId, mode }: { carId: string; mode: 'shop' | 'garage' }) {
  const s = useGame();
  const car = CARS[carId];
  if (!car) return null;
  const owned = s.ownedCars.includes(car.id);
  const driving = s.activeCar === car.id;
  const locked = s.level < (car.minLevel ?? 1);
  const price = car.priceGem ? `${car.priceGem} gem` : car.priceXu ? `${car.priceXu} xu` : 'Miễn phí';
  return (
    <div className={`border-[3px] rounded-xl p-2 ${driving ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-black'}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 bg-[#f3efe4] border-2 border-black rounded-lg px-1"><CarPreview carId={car.id} h={56} /></span>
        <span className="min-w-0">
          <span className="font-extrabold text-[13px] block">{car.name} {driving && '✅'}</span>
          <span className="text-[11px] text-stone-500 block">{car.desc}</span>
          <span className="text-[11px] font-bold text-sky-700 block">{speedLabel(car.speed)}</span>
        </span>
      </div>
      {mode === 'shop' && (
        <div className="text-[12px] font-black text-amber-600 mt-1 mb-1">
          {owned ? (driving ? 'Đang lái vi vu!' : 'Đã có trong gara 🚗') : locked ? `🔒 Mở bán từ Lv${car.minLevel}` : price}
        </div>
      )}
      {driving ? (
        <button onClick={() => s.driveCar(null)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full !bg-stone-400">Xuống xe</button>
      ) : owned ? (
        <button onClick={() => s.driveCar(car.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full mt-1">Lái ngay</button>
      ) : mode === 'garage' ? null : (
        <button disabled={locked} onClick={() => s.buyCar(car.id)} className="pixel-btn !text-[10px] !px-2 !py-1.5 w-full">Mua</button>
      )}
    </div>
  );
}

/** Tab gara: toàn bộ xe đã mua + xe đang lái, nhóm theo dòng */
function GarageTab({ goShop }: { goShop: () => void }) {
  const s = useGame();
  const owned = s.ownedCars.map((id) => CARS[id]).filter(Boolean);

  if (!owned.length) {
    return (
      <div className="text-center bg-white border-[3px] border-dashed border-stone-300 rounded-xl p-4">
        <p className="text-3xl">🚗</p>
        <p className="font-extrabold text-[13px] mt-1">Gara trống trơn</p>
        <p className="text-[12px] text-stone-500">Ghé cửa hàng rước một em về chạy cho oách!</p>
        <button onClick={() => { sfx.click(); goShop(); }} className="pixel-btn !text-[11px] mt-2">🛒 Qua cửa hàng</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {CAR_KINDS.map((k) => {
        const list = owned.filter((c) => c.kind === k.id);
        if (!list.length) return null;
        return (
          <div key={k.id}>
            <div className="font-black text-[12px] text-stone-600 mb-1 flex items-center gap-1.5">
              <span className="bg-[#f3efe4] border-2 border-black rounded-md px-1 shrink-0"><CarPreview carId={list[0].id} h={30} /></span>
              {k.name}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((car) => <CarCard key={car.id} carId={car.id} mode="garage" />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
