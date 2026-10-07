import {
  ANIMALS, BAIT_PRO_PRICE, BAIT_PRICE, CROPS, FEED_PRO_PRICE, FEED_PRICE, FISHES,
  MAX_CAP, MAX_PLOTS, MAX_POND, PEST_PRICE, START_CAP, START_PLOTS, START_POND,
  capCost, capReq, itemName, plotCost, plotReq, pondCost, pondReq, sellPrice,
} from '../game/data';
import { useGame } from '../game/store';
import type { AnimalType, ShopTab } from '../game/types';
import { sfx } from '../game/audio';
import { GameIcon, iconForPid } from './GameIcon';

const TABS: [ShopTab, string, string][] = [
  ['seed', 'sprout', 'Hạt'], ['fish', 'caro', 'Cá'], ['animal', 'chicken', 'Vật nuôi'], ['food', 'feed', 'Thức ăn'], ['sell', 'coin', 'Bán'],
];

function Coin({ v }: { v: number | string }) {
  return (<span className="inline-flex items-center gap-0.5">{v}<GameIcon name="coin" size={13} /></span>);
}

export default function ShopModal() {
  const s = useGame();
  const tab = s.shopTab;
  const unlockedPlots = s.plots.filter((p) => !p.locked).length;

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {TABS.map(([k, ic, l]) => (
          <button
            key={k}
            onClick={() => { sfx.click(); s.setShopTab(k); }}
            className={`px-3 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] flex items-center gap-1.5 ${tab === k ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}
          >
            <GameIcon name={ic} size={18} />{l}
          </button>
        ))}
      </div>

      {tab === 'seed' && (
        <div>
          <ExpandCard
            icon="field" title={`Mở rộng ruộng (${unlockedPlots}/${MAX_PLOTS})`}
            desc={unlockedPlots >= MAX_PLOTS ? 'Đã tối đa!' : (<>Ô tiếp theo: <Coin v={plotCost(unlockedPlots)} /> • cần Lv{plotReq(unlockedPlots)}</>)}
            btn={unlockedPlots >= MAX_PLOTS ? null : 'Mở ô đất'}
            onBuy={() => s.unlockPlot(unlockedPlots)}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {Object.values(CROPS).map((c) => {
              const lock = s.level < c.lv;
              return (
                <Card key={c.id} icon={c.id} title={<>{c.name} {lock && (<span className="inline-flex items-center gap-0.5"><GameIcon name="lock" size={12} />Lv{c.lv}</span>)}</>} desc={<>{c.desc} • {c.grow}s • Bán <Coin v={c.sell} /> • +{c.xp}XP</>} price={<><GameIcon name="seed" size={14} /> <Coin v={c.seedPrice} /></>}>
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
            icon="pond" title={`Mở rộng ao (${s.fishes.length}/${s.pondSlots}${s.pondSlots < MAX_POND ? ` → ${s.pondSlots + 1}` : ''})`}
            desc={s.pondSlots >= MAX_POND ? `Đã tối đa ${MAX_POND}!` : (<>Chỗ nuôi tiếp theo: <Coin v={pondCost(s.pondSlots)} /> • cần Lv{pondReq(s.pondSlots)}</>)}
            btn={s.pondSlots >= MAX_POND ? null : 'Mở rộng ao'}
            onBuy={() => s.unlockPondSlot()}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {Object.values(FISHES).map((ff) => {
              const lock = s.level < ff.lv;
              return (
                <Card key={ff.id} icon={ff.id} title={<>{ff.name} {lock && (<span className="inline-flex items-center gap-0.5"><GameIcon name="lock" size={12} />Lv{ff.lv}</span>)}</>} desc={<>{ff.desc} • {ff.grow}s • Bán <Coin v={ff.sell} /> • +{ff.xp}XP • Mua là thả thẳng xuống ao</>} price={<Coin v={ff.babyPrice} />}>
                  <button disabled={lock} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFish(ff.id)}>Mua + thả ao</button>
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
              <Card key={a.id} icon={a.id} title={<>{a.name} {lock && (<span className="inline-flex items-center gap-0.5"><GameIcon name="lock" size={12} />Lv{a.lv}</span>)}</>} desc={<>{a.desc} • SP: {a.product} (<Coin v={a.sell} />) • Chuồng {count}/{cap}</>} price={<Coin v={a.babyPrice} />}>
                <div className="flex gap-1 justify-center flex-wrap">
                  <button disabled={lock} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyAnimal(a.id)}>Mua</button>
                  {!maxed && (
                    <button className="pixel-btn !text-[10px] !px-2 !py-2 !bg-sky-300" title={`Cần Lv${nextReq}`} onClick={() => s.expandCap(a.id as AnimalType)}>
                      +Chuồng <Coin v={nextCost} />
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
          <Card icon="feed" title="Cám thường" desc="Cho mọi vật nuôi & cá. Hết cám thường sẽ tự dùng cám cao cấp" price={<Coin v={FEED_PRICE} />}>
            <div className="flex gap-1 justify-center">
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feed', 1)}>Mua</button>
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feed', 5)}>x5</button>
            </div>
          </Card>
          <Card icon="feedPro" title={<>Cám cao cấp <GameIcon name="lock" size={12} />Lv8</>} desc="No căng + tăng tốc ra sản phẩm / cá lớn vọt" price={<Coin v={FEED_PRO_PRICE} />}>
            <div className="flex gap-1 justify-center">
              <button disabled={s.level < 8} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feedPro', 1)}>Mua</button>
              <button disabled={s.level < 8} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyFeed('feedPro', 5)}>x5</button>
            </div>
          </Card>
          <Card icon="bait" title="Mồi thường" desc="Câu ở sông. Cá rẻ dễ dính" price={<Coin v={BAIT_PRICE} />}>
            <div className="flex gap-1 justify-center">
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('bait', 1)}>Mua</button>
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('bait', 5)}>x5</button>
            </div>
          </Card>
          <Card icon="baitPro" title={<>Mồi ngon <GameIcon name="lock" size={12} />Lv10</>} desc="Tỉ lệ cá hiếm x5, ít dính rác" price={<Coin v={BAIT_PRO_PRICE} />}>
            <div className="flex gap-1 justify-center">
              <button disabled={s.level < 10} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('baitPro', 1)}>Mua</button>
              <button disabled={s.level < 10} className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyBait('baitPro', 5)}>x5</button>
            </div>
          </Card>
          <Card icon="pesticide" title="Thuốc trừ sâu" desc="Cây bị sâu sẽ ngừng lớn — bấm E vào cây để phun" price={<Coin v={PEST_PRICE} />}>
            <div className="flex gap-1 justify-center">
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyPesticide(1)}>Mua</button>
              <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.buyPesticide(5)}>x5</button>
            </div>
          </Card>
          <Card icon="gem" title="Đổi gem" desc="5 gem = 500 xu" price={<span className="inline-flex items-center gap-0.5">5<GameIcon name="gem" size={13} /></span>}>
            <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.exchangeGem()}>Đổi</button>
          </Card>
        </div>
      )}
      {tab === 'sell' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.keys(s.inv).length === 0 && <p>Kho trống! Thu hoạch rồi quay lại bán nhé</p>}
          {Object.keys(s.inv)
            .filter((pid) => !pid.startsWith('seed:') && !pid.startsWith('baby'))
            .map((pid) => {
              const [nm] = itemName(pid);
              return (
                <Card key={pid} icon={iconForPid(pid)} title={`${nm} x${s.inv[pid]}`} desc="" price={<><Coin v={sellPrice(pid)} /> / cái</>}>
                  <div className="flex gap-1 justify-center">
                    <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.sell(pid, false)}>Bán 1</button>
                    <button className="pixel-btn !text-[10px] !px-2 !py-2" onClick={() => s.sell(pid, true)}>Hết</button>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
      <p className="mt-3 font-extrabold flex items-center gap-1.5 flex-wrap"><Coin v={s.xu} /> • <span className="inline-flex items-center gap-0.5"><GameIcon name="gem" size={14} /> {s.gem}</span> • Lv {s.level} • <GameIcon name="field" size={15} /> {s.plots.filter((p) => !p.locked).length}/{MAX_PLOTS} ô • <GameIcon name="pond" size={15} /> {s.fishes.length}/{s.pondSlots} cá</p>
      <p className="text-[11px] text-stone-500">Mặc định: {START_PLOTS} ô đất • {START_POND} chỗ nuôi cá • mỗi chuồng 3 con</p>
    </div>
  );
}

function ExpandCard({ icon, title, desc, btn, onBuy }: { icon: string; title: string; desc: React.ReactNode; btn: string | null; onBuy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-sky-100 border-[3px] border-sky-600 rounded-lg p-2.5">
      <div className="flex items-center gap-2">
        <GameIcon name={icon} size={34} />
        <div>
          <div className="font-extrabold text-[13px]">{title}</div>
          <div className="text-[11px] text-stone-600">{desc}</div>
        </div>
      </div>
      {btn && <button className="pixel-btn !text-[10px] !px-3 !py-2 !bg-sky-400 shrink-0" onClick={onBuy}>{btn}</button>}
    </div>
  );
}

function Card({ icon, title, desc, price, children }: { icon: string; title: React.ReactNode; desc: React.ReactNode; price: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border-[3px] border-[#2b2117] rounded-lg p-2.5 text-center">
      <div className="flex justify-center"><GameIcon name={icon} size={40} /></div>
      <h4 className="text-[13px] font-extrabold my-1">{title}</h4>
      <p className="text-[11px] text-stone-500 min-h-8">{desc}</p>
      <div className="font-extrabold text-orange-700 my-1 flex items-center justify-center gap-1">{price}</div>
      <div className="flex gap-1 justify-center">{children}</div>
    </div>
  );
}
