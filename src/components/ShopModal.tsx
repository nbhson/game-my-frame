import {
  ANIMALS, BAIT_PRO_PRICE, BAIT_PRICE, CROPS, FEED_PRO_PRICE, FEED_PRICE, FISHES,
  MAX_CAP, MAX_PLOTS, MAX_POND, START_CAP, START_PLOTS, START_POND,
  capCost, capReq, itemName, plotCost, plotReq, pondCost, pondReq, sellPrice,
} from '../game/data';
import { useGame } from '../game/store';
import type { AnimalType, ShopTab } from '../game/types';
import { sfx } from '../game/audio';

const TABS: [ShopTab, string][] = [
  ['seed', '🌱 Hạt'], ['fish', '🐟 Cá'], ['animal', '🐔 Vật nuôi'], ['food', '🍞 Thức ăn'], ['sell', '💰 Bán'],
];

export default function ShopModal() {
  const s = useGame();
  const tab = s.shopTab;
  const unlockedPlots = s.plots.filter((p) => !p.locked).length;

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => { sfx.click(); s.setShopTab(k); }}
            className={`px-3 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] ${tab === k ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'seed' && (
        <div>
          <ExpandCard
            emoji="🏞️" title={`Mở rộng ruộng (${unlockedPlots}/${MAX_PLOTS})`}
            desc={unlockedPlots >= MAX_PLOTS ? 'Đã tối đa!' : `Ô tiếp theo: ${plotCost(unlockedPlots)}🪙 • cần Lv${plotReq(unlockedPlots)}`}
            btn={unlockedPlots >= MAX_PLOTS ? null : 'Mở ô đất'}
            onBuy={() => s.unlockPlot(unlockedPlots)}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {Object.values(CROPS).map((c) => {
              const lock = s.level < c.lv;
              return (
                <Card key={c.id} emoji={c.emoji} title={`${c.name} ${lock ? '🔒Lv' + c.lv : ''}`} desc={`${c.desc} • ⏱${c.grow}s • Bán ${c.sell}🪙 • +${c.xp}XP`} price={`🌰 ${c.seedPrice}🪙`}>
                  <button disabled={lock} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buySeed(c.id)}>Mua</button>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'fish' && (
        <div>
          <ExpandCard
            emoji="🐟" title={`Mở rộng ao (${s.fishes.length}/${s.pondSlots}${s.pondSlots < MAX_POND ? ` → ${s.pondSlots + 1}` : ''})`}
            desc={s.pondSlots >= MAX_POND ? `Đã tối đa ${MAX_POND}!` : `Chỗ nuôi tiếp theo: ${pondCost(s.pondSlots)}🪙 • cần Lv${pondReq(s.pondSlots)}`}
            btn={s.pondSlots >= MAX_POND ? null : 'Mở rộng ao'}
            onBuy={() => s.unlockPondSlot()}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {Object.values(FISHES).map((ff) => {
              const lock = s.level < ff.lv;
              return (
                <Card key={ff.id} emoji={ff.emoji} title={`${ff.name} ${lock ? '🔒Lv' + ff.lv : ''}`} desc={`${ff.desc} • ⏱${ff.grow}s • Bán ${ff.sell}🪙 • +${ff.xp}XP`} price={`${ff.babyPrice}🪙`}>
                  <button disabled={lock} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFish(ff.id)}>Mua con</button>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'animal' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.values(ANIMALS).map((a) => {
            const lock = s.level < a.lv;
            const cap = s.coopCap[a.id as AnimalType] ?? START_CAP;
            const count = s.animals.filter((x) => x.type === a.id).length;
            const maxed = cap >= (MAX_CAP[a.id] ?? a.max);
            const nextCost = capCost(a.id, cap + 1);
            const nextReq = capReq(a.id, cap + 1);
            return (
              <Card key={a.id} emoji={a.emoji} title={`${a.name} ${lock ? '🔒Lv' + a.lv : ''}`} desc={`${a.desc} • SP: ${a.product} (${a.sell}🪙) • Chuồng ${count}/${cap}`} price={`${a.babyPrice}🪙`}>
                <div className="flex gap-1 justify-center flex-wrap">
                  <button disabled={lock} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyAnimal(a.id)}>Mua</button>
                  {!maxed && (
                    <button className="pixel-btn !text-[10px] !px-2 !py-2 !bg-sky-300" title={`Cần Lv${nextReq}`} onClick={() => s.expandCap(a.id as AnimalType)}>
                      +Chuồng {nextCost}🪙
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {tab === 'food' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card emoji="🌽" title="Cám thường" desc="Cho mọi vật nuôi & cá. Hết cám thường sẽ tự dùng cám cao cấp" price={`${FEED_PRICE}🪙`}>
            <div className="flex gap-1 justify-center">
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feed', 1)}>Mua</button>
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feed', 5)}>x5</button>
            </div>
          </Card>
          <Card emoji="🥜" title="Cám cao cấp 🔒Lv8" desc="No căng + tăng tốc ra sản phẩm / cá lớn vọt" price={`${FEED_PRO_PRICE}🪙`}>
            <div className="flex gap-1 justify-center">
              <button disabled={s.level < 8} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feedPro', 1)}>Mua</button>
              <button disabled={s.level < 8} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feedPro', 5)}>x5</button>
            </div>
          </Card>
          <Card emoji="🪱" title="Mồi thường" desc="Câu ở sông. Cá rẻ dễ dính" price={`${BAIT_PRICE}🪙`}>
            <div className="flex gap-1 justify-center">
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('bait', 1)}>Mua</button>
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('bait', 5)}>x5</button>
            </div>
          </Card>
          <Card emoji="🦐" title="Mồi ngon 🔒Lv10" desc="Tỉ lệ cá hiếm x5, ít dính rác" price={`${BAIT_PRO_PRICE}🪙`}>
            <div className="flex gap-1 justify-center">
              <button disabled={s.level < 10} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('baitPro', 1)}>Mua</button>
              <button disabled={s.level < 10} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('baitPro', 5)}>x5</button>
            </div>
          </Card>
          <Card emoji="💎" title="Đổi gem" desc="5 💎 = 500 🪙" price="5💎">
            <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.exchangeGem()}>Đổi</button>
          </Card>
        </div>
      )}
      {tab === 'sell' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.keys(s.inv).length === 0 && <p>Kho trống! Thu hoạch rồi quay lại bán nhé 🌾</p>}
          {Object.keys(s.inv)
            .filter((pid) => !pid.startsWith('seed:') && !pid.startsWith('baby'))
            .map((pid) => {
              const [nm, em] = itemName(pid);
              return (
                <Card key={pid} emoji={em} title={`${nm} x${s.inv[pid]}`} desc="" price={`${sellPrice(pid)}🪙 / cái`}>
                  <div className="flex gap-1 justify-center">
                    <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.sell(pid, false)}>Bán 1</button>
                    <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.sell(pid, true)}>Hết</button>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
      <p className="mt-3 font-extrabold">🪙 {s.xu} • 💎 {s.gem} • Lv {s.level} • 🌾 {s.plots.filter((p) => !p.locked).length}/{MAX_PLOTS} ô • 🐟 {s.fishes.length}/{s.pondSlots} cá</p>
      <p className="text-[11px] text-stone-500">Mặc định: {START_PLOTS} ô đất • {START_POND} chỗ nuôi cá • mỗi chuồng 3 con</p>
    </div>
  );
}

function ExpandCard({ emoji, title, desc, btn, onBuy }: { emoji: string; title: string; desc: string; btn: string | null; onBuy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-sky-100 border-[3px] border-sky-600 rounded-lg p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{emoji}</span>
        <div>
          <div className="font-extrabold text-[13px]">{title}</div>
          <div className="text-[11px] text-stone-600">{desc}</div>
        </div>
      </div>
      {btn && <button className="pixel-btn !text-[10px] !px-3 !py-2 !bg-sky-400 shrink-0" onClick={onBuy}>{btn}</button>}
    </div>
  );
}

function Card({ emoji, title, desc, price, children }: { emoji: string; title: string; desc: string; price: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-[3px] border-[#2b2117] rounded-lg p-2.5 text-center">
      <div className="text-4xl">{emoji}</div>
      <h4 className="text-[13px] font-extrabold my-1">{title}</h4>
      <p className="text-[11px] text-stone-500 min-h-8">{desc}</p>
      <div className="font-extrabold text-orange-700 my-1">{price}</div>
      <div className="flex gap-1 justify-center">{children}</div>
    </div>
  );
}
