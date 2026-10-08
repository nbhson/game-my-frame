import { useState } from 'react';
import { ANIMALS, CROPS, FISHES } from '../game/data';
import { useGame } from '../game/store';
import { GameIcon } from './GameIcon';

/** Làm hàng loạt: 1 chạm xử lý cả farm / cả đàn — đỡ mỏi tay khi farm to */
export default function BulkModal() {
  const s = useGame();
  const [seedId, setSeedId] = useState<string | null>(null);

  // --- đếm việc cần làm: NHÓM NÔNG TRẠI ---
  let grass = 0, empty = 0, thirsty = 0, buggy = 0, ripe = 0;
  for (const pl of s.plots) {
    if (pl.locked) continue;
    if (pl.state === 'grass') grass++;
    else if (pl.state === 'soil') empty++;
    else if (pl.state === 'growing') {
      if (pl.pest) buggy++;
      else if (!pl.watered) thirsty++;
    } else if (pl.state === 'ready' && pl.crop) ripe++;
  }
  // --- đếm việc cần làm: NHÓM GIA SÚC / CÁ ---
  const now = Date.now();
  let hungryAnimals = 0, readyAnimals = 0;
  for (const a of s.animals) {
    const A = ANIMALS[a.type];
    if (!A) continue;
    if (a.hunger < 60) hungryAnimals++;
    else if (a.ready && (now - a.bornAt) / 1000 >= A.grow) readyAnimals++;
  }
  let hungryFish = 0, grownFish = 0;
  for (const f of s.fishes) {
    if (!FISHES[f.type]) continue;
    if (f.grown) grownFish++;
    else hungryFish++;
  }
  const seeds = Object.values(CROPS)
    .filter((c) => s.level >= c.lv)
    .map((c) => ({ c, n: s.inv['seed:' + c.id] || 0 }));
  const selSeeds = seedId ? s.inv['seed:' + seedId] || 0 : 0;
  const sowN = Math.min(empty, selSeeds);
  const feedHave = (s.inv.feed || 0) + (s.inv.feedPro || 0);
  const sprayHave = s.inv.pesticide || 0;

  return (
    <div className="space-y-3">
      {/* NHÓM 1: NÔNG TRẠI */}
      <div className="bg-green-50 border-2 border-green-600 rounded-lg p-2">
        <p className="font-black text-green-800 text-sm mb-1.5">🌱 NHÓM NÔNG TRẠI</p>
        <div className="grid grid-cols-2 gap-1.5">
          <BulkBtn label="Cuốc đất" count={grass} icon="hoe" onClick={() => s.bulkHoe()} />
          <BulkBtn label="Tưới nước" count={thirsty} icon="drop" onClick={() => s.bulkWater()} />
          <BulkBtn label={`Phun thuốc (${sprayHave}🧪)`} count={buggy} icon="pesticide" onClick={() => s.bulkSpray()} />
          <BulkBtn label="Thu hoạch" count={ripe} icon="basket" onClick={() => s.bulkHarvest()} />
        </div>
        {/* gieo hàng loạt: chọn hạt rồi gieo hết ô trống */}
        <p className="font-black text-green-800 text-xs mt-2 mb-1">Gieo hàng loạt ({empty} ô trống):</p>
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
          {seeds.map(({ c, n }) => (
            <button
              key={c.id}
              disabled={n <= 0}
              onClick={() => setSeedId(c.id)}
              className={`shrink-0 flex flex-col items-center px-2 py-1 border-2 rounded-lg font-bold text-[11px] disabled:opacity-40 ${seedId === c.id ? 'border-green-700 bg-green-200' : 'border-[#2b2117] bg-white'}`}
              title={c.name}
            >
              <GameIcon name={c.id} size={22} />
              <span>x{n}</span>
            </button>
          ))}
        </div>
        <button
          disabled={!seedId || sowN <= 0}
          onClick={() => seedId && s.bulkSow(seedId)}
          className="mt-1 w-full py-2 rounded-lg bg-green-600 border-[3px] border-black text-white font-black text-sm hover:bg-green-500 disabled:opacity-40 active:scale-95"
        >
          {seedId ? `Gieo ${CROPS[seedId].name} vào ${sowN} ô` : 'Chọn 1 loại hạt ở trên để gieo'}
        </button>
      </div>

      {/* NHÓM 2: GIA SÚC / CÁ */}
      <div className="bg-amber-50 border-2 border-amber-600 rounded-lg p-2">
        <p className="font-black text-amber-800 text-sm mb-1.5">🐄🐟 NHÓM GIA SÚC / CÁ</p>
        <p className="text-[11px] font-bold opacity-70 -mt-1 mb-1.5">Thức ăn đang có: {feedHave} 🍖</p>
        <div className="grid grid-cols-2 gap-1.5">
          <BulkBtn label="Cho thú ăn" count={hungryAnimals} icon="feed" onClick={() => s.bulkFeedAnimals()} />
          <BulkBtn label="Thu sản phẩm" count={readyAnimals} icon="basket" onClick={() => s.bulkCollectAnimals()} />
          <BulkBtn label="Cho cá ăn" count={hungryFish} icon="feed" onClick={() => s.bulkFeedFish()} />
          <BulkBtn label="Thu hoạch cá" count={grownFish} icon="pond" onClick={() => s.bulkHarvestFish()} />
        </div>
      </div>
      <p className="text-[11px] opacity-60 font-bold">Hết hạt / thức ăn / thuốc? Sang cửa hàng mua rồi quay lại làm tiếp 1 chạm!</p>
    </div>
  );
}

function BulkBtn({ label, count, icon, onClick }: { label: string; count: number; icon: string; onClick: () => void }) {
  return (
    <button
      disabled={count <= 0}
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-2 py-2 border-[3px] border-[#2b2117] rounded-lg bg-white font-extrabold text-[13px] hover:bg-yellow-200 disabled:opacity-40 active:scale-95"
    >
      <GameIcon name={icon} size={22} />
      <span className="truncate">{label}</span>
      <span className="ml-auto min-w-6 h-6 px-1 flex items-center justify-center rounded-md bg-[#2b2117] text-yellow-300 text-xs">
        {count}
      </span>
    </button>
  );
}
