import { ANIMALS, FISHES, MAX_CAP, MAX_POND, capCost, capReq, pondCost, pondReq } from '../game/data';
import { useGame } from '../game/store';
import type { AnimalType } from '../game/types';

export type PenId = 'pond' | 'coop' | 'barn';

const PEN_META: Record<PenId, { title: string; types: AnimalType[] }> = {
  pond: { title: '📮 AO CÁ', types: [] },
  coop: { title: '📮 CHUỒNG GÀ–VỊT', types: ['chicken', 'duck'] },
  barn: { title: '📮 TRẠI BÒ–HEO–CỪU', types: ['cow', 'pig', 'sheep'] },
};

export default function PenModal({ pen }: { pen: PenId }) {
  const s = useGame();
  const meta = PEN_META[pen];

  return (
    <div>
      {pen === 'pond' && <PondBody />}
      {pen !== 'pond' && (
        <div className="flex flex-col gap-3">
          {meta.types.map((t) => (
            <SpeciesBlock key={t} type={t} />
          ))}
        </div>
      )}
      <p className="text-[11px] text-stone-500 mt-2">💡 Đứng gần ao/chuồng rồi bấm <b>E</b> cũng cho ăn / thu hoạch trực tiếp.</p>
    </div>
  );
}

function PondBody() {
  const s = useGame();
  const full = s.fishes.length >= s.pondSlots;
  const maxed = s.pondSlots >= MAX_POND;
  const sorted = [...s.fishes].sort((a, b) => Number(b.grown) - Number(a.grown));
  return (
    <div>
      <div className="flex items-center justify-between gap-2 bg-sky-100 border-[3px] border-sky-600 rounded-lg p-2.5 mb-2 flex-wrap">
        <div className="font-extrabold text-sm">🐟 Đang nuôi {s.fishes.length}/{s.pondSlots} (tối đa {MAX_POND})</div>
        {!maxed ? (
          <button
            className="pixel-btn !text-[10px] !px-3 !py-2 !bg-sky-400"
            title={`Cần Lv${pondReq(s.pondSlots)}`}
            onClick={() => s.unlockPondSlot()}
          >
            +1 chỗ {pondCost(s.pondSlots)}🪙
          </button>
        ) : (
          <span className="text-xs font-bold text-green-700">Đã tối đa!</span>
        )}
      </div>
      {sorted.length === 0 && <p className="text-sm text-stone-500">Ao trống — mua cá con ở shop rồi ra ao thả nhé! 🐟</p>}
      <div className="flex flex-col gap-1.5">
        {sorted.map((f) => {
          const F = FISHES[f.type];
          if (!F) return null;
          const pct = Math.min(100, (f.age / F.grow) * 100);
          return (
            <div key={f.uid} className="flex items-center justify-between gap-2 bg-white border-2 border-[#2b2117] rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{F.emoji}</span>
                <div className="min-w-0">
                  <div className="font-extrabold text-[13px]">{F.name} {f.grown ? '✅' : `${pct | 0}%`}</div>
                  <div className="h-1.5 w-24 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-lime-500" style={{ width: `${f.hunger}%` }} />
                  </div>
                </div>
              </div>
              <button
                className="pixel-btn !text-[10px] !px-2 !py-1.5 shrink-0"
                onClick={() => s.interactPond(f.uid)}
              >
                {f.grown ? 'Thu hoạch' : 'Cho ăn'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeciesBlock({ type }: { type: AnimalType }) {
  const s = useGame();
  const A = ANIMALS[type];
  if (!A) return null;
  const list = s.animals.filter((a) => a.type === type);
  const cap = s.coopCap[type] ?? 3;
  const max = MAX_CAP[type] ?? A.max;
  const maxed = cap >= max;
  return (
    <div className="bg-white border-[3px] border-[#2b2117] rounded-lg p-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-extrabold text-sm">{A.emoji} {A.name}: {list.length}/{cap} (tối đa {max})</div>
        {!maxed ? (
          <button
            className="pixel-btn !text-[10px] !px-2 !py-1.5 !bg-sky-300"
            title={`Cần Lv${capReq(type, cap + 1)}`}
            onClick={() => s.expandCap(type)}
          >
            +1 chỗ {capCost(type, cap + 1)}🪙
          </button>
        ) : (
          <span className="text-xs font-bold text-green-700">Tối đa!</span>
        )}
      </div>
      {list.length === 0 && <p className="text-xs text-stone-500 mt-1">Chưa có con nào — mua ở shop 🏪</p>}
      <div className="flex flex-col gap-1.5 mt-1.5">
        {list.map((a) => (
          <div key={a.uid} className="flex items-center justify-between gap-2 bg-stone-50 border-2 border-stone-300 rounded-lg px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{A.emoji}</span>
              <div>
                <div className="text-xs font-bold">{a.ready ? 'Có sản phẩm ✅' : a.hunger < 60 ? 'Đói 🍽️' : `No ${a.hunger | 0}%`}</div>
                <div className="h-1.5 w-20 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-lime-500" style={{ width: `${a.hunger}%` }} />
                </div>
              </div>
            </div>
            <button
              className="pixel-btn !text-[10px] !px-2 !py-1 shrink-0"
              onClick={() => s.interactAnimal(a.uid)}
            >
              {a.ready ? 'Thu' : a.hunger < 60 ? 'Cho ăn' : 'Xem'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
