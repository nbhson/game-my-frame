import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Animal, AnimalType, CoopCap, ModalKind, Plot, PondFish, ShopTab, Stats } from './types';
import {
  ANIMALS, BITE_MAX, BITE_MIN, BITE_WINDOW, CROPS, DAY_LENGTH, FEED_PRO_PRICE, FEED_PRICE,
  BAIT_PRO_PRICE, BAIT_PRICE, FISHES, MAX_CAP, MAX_PLOTS, MAX_POND, QUESTS,
  START_CAP, START_PLOTS, START_POND, capCost, capReq, plotCost, plotReq, pondCost, pondReq,
  rollRiverCatch, sellPrice,
} from './data';
import { PIERS } from './world';
import { sfx } from './audio';

// ---------- toasts (UI-only, không persist) ----------
export interface Toast { id: number; msg: string }
let toastSeq = 1;

export interface FishSpot {
  pier: number;
  x: number; y: number; // chỗ ngồi
  bx: number; by: number; // phao
}

interface GameState {
  // profile
  started: boolean;
  name: string;
  avatar: number;
  // kinh tế
  xu: number; gem: number; level: number; xp: number;
  day: number; dayTime: number;
  // world state
  inv: Record<string, number>;
  plots: Plot[];
  pondSlots: number; // số cá tối đa đang mở (<= MAX_POND)
  fishes: PondFish[];
  animals: Animal[];
  coopCap: CoopCap;
  stats: Stats;
  questIdx: number;
  uidSeq: number;
  // ui state (persist một phần, modal/toast không persist)
  modal: ModalKind;
  shopTab: ShopTab;
  // câu sông: transient, không persist
  fishingSpot: FishSpot | null;
  biteAt: number | null;
  biteUntil: number | null;
  fishingBait: string | null;
  toasts: Toast[];

  // actions
  /** Đăng nhập bằng username: có snapshot DB thì migrate + dùng, không thì farm mới */
  loadAccount: (name: string, avatar: number, data: {
    xu: number; gem: number; level: number; xp: number;
    day: number; dayTime: number;
    inv: Record<string, number>;
    plots: Plot[]; fishes: PondFish[]; animals: Animal[];
    pondSlots?: number; coopCap?: CoopCap;
    stats: Stats; questIdx: number; uidSeq: number;
  } | null) => void;
  toast: (msg: string) => void;
  dismissToast: (id: number) => void;
  setModal: (m: ModalKind) => void;
  setShopTab: (t: ShopTab) => void;
  addXP: (n: number) => void;
  addXu: (n: number) => void;
  addInv: (pid: string, n: number) => void;
  tick: (dt: number) => void;
  interactPlot: (i: number) => void;
  unlockPlot: (i: number) => void;
  plantSeed: (i: number, cropId: string) => void;
  interactPond: (uid?: number) => void;
  stockFish: (fishId: string) => void;
  unlockPondSlot: () => void;
  interactAnimal: (uid: number) => void;
  expandCap: (type: AnimalType) => void;
  buySeed: (id: string) => void;
  buyFish: (id: string) => void;
  buyAnimal: (id: string) => void;
  buyFeed: (feedId: string, n: number) => void;
  buyBait: (baitId: string, n: number) => void;
  exchangeGem: () => void;
  sell: (pid: string, all: boolean) => void;
  startRiverFishing: (pier: number, baitId: string) => void;
  reelRiver: () => void;
  cancelRiver: (silent?: boolean) => void;
  checkQuest: () => void;
  reset: () => void;
}

function freshPlots(): Plot[] {
  return Array.from({ length: MAX_PLOTS }, (_, i) => ({
    state: 'grass' as const, crop: null, progress: 0,
    watered: false, waterLeft: 0, locked: i >= START_PLOTS,
  }));
}
function freshCap(): CoopCap {
  return { chicken: START_CAP, duck: START_CAP, cow: START_CAP, pig: START_CAP, sheep: START_CAP };
}
function freshStats(): Stats {
  return { hoed: 0, planted: 0, watered: 0, harvested: 0, boughtAnimal: 0, fed: 0, collectedAnimal: 0, stockedFish: 0, earned: 0, fished: 0 };
}

/** Migrate save cũ (12 ô, ao 6 ngăn, chưa có locked/cap) lên model mới */
function migratePlots(old: Plot[] | undefined): Plot[] {
  const fresh = freshPlots();
  if (!old || !old.length) return fresh;
  if (old.length >= MAX_PLOTS) {
    return fresh.map((p, i) => ({ ...(old[i] ?? p), locked: old[i]?.locked ?? false }));
  }
  // save cũ 12 ô đều dùng được → giữ 12 ô đầu mở, còn lại khóa
  const keepOpen = Math.max(START_PLOTS, Math.min(12, old.length));
  return fresh.map((p, i) => (i < old.length
    ? { state: old[i].state, crop: old[i].crop, progress: old[i].progress, watered: old[i].watered, waterLeft: old[i].waterLeft ?? 0, locked: i >= keepOpen }
    : p));
}
function migrateFishes(old: PondFish[] | undefined, uidSeqRef: { v: number }): PondFish[] {
  if (!old) return [];
  return old.filter(Boolean).map((f) => ({ uid: f.uid ?? uidSeqRef.v++, type: f.type, age: f.age ?? 0, grown: !!f.grown, hunger: f.hunger ?? 80 }));
}

export const xpNeed = (level: number) => level * 100;

function questDone(stats: Stats, level: number, idx: number): boolean {
  switch (QUESTS[idx]?.id) {
    case 'hoe': return stats.hoed >= 1;
    case 'plant': return stats.planted >= 1;
    case 'water': return stats.watered >= 1;
    case 'harv': return stats.harvested >= 1;
    case 'chick': return stats.boughtAnimal >= 1;
    case 'feed': return stats.fed >= 1;
    case 'egg': return stats.collectedAnimal >= 1;
    case 'fish': return stats.stockedFish >= 1;
    case 'rich': return stats.earned >= 2000;
    case 'lv5': return level >= 5;
    default: return false;
  }
}

/** Lấy thức ăn: ưu tiên cám thường, hết mới dùng cám cao cấp */
function takeFeed(s: { inv: Record<string, number> }): 'feed' | 'feedPro' | null {
  if ((s.inv.feed || 0) > 0) return 'feed';
  if ((s.inv.feedPro || 0) > 0) return 'feedPro';
  return null;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      started: false,
      name: 'NôngDân', avatar: 0,
      xu: 500, gem: 5, level: 1, xp: 0,
      day: 1, dayTime: 0.3,
      inv: { 'seed:lua': 3, feed: 3, bait: 3 },
      plots: freshPlots(),
      pondSlots: START_POND,
      fishes: [],
      animals: [],
      coopCap: freshCap(),
      stats: freshStats(),
      questIdx: 0, uidSeq: 1,
      modal: null, shopTab: 'seed',
      fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null,
      toasts: [],

      loadAccount: (name, avatar, data) => {
        if (data) {
          const uidRef = { v: data.uidSeq };
          const fishes = migrateFishes(data.fishes, uidRef);
          const cap = data.coopCap ?? freshCap();
          // đảm bảo cap không nhỏ hơn số con đang có
          for (const t of ['chicken', 'duck', 'cow', 'pig', 'sheep'] as AnimalType[]) {
            const n = data.animals.filter((a) => a.type === t).length;
            if (cap[t] < Math.max(START_CAP, n)) cap[t] = Math.max(START_CAP, n);
          }
          set({
            started: true, name, avatar,
            xu: data.xu, gem: data.gem, level: data.level, xp: data.xp,
            day: data.day, dayTime: data.dayTime,
            inv: data.inv, plots: migratePlots(data.plots), fishes,
            pondSlots: Math.min(MAX_POND, Math.max(START_POND, data.pondSlots ?? (data.fishes?.length >= 6 ? 6 : START_POND))),
            animals: data.animals, coopCap: cap,
            stats: data.stats, questIdx: data.questIdx, uidSeq: uidRef.v,
            modal: null, fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null,
          });
        } else {
          set({
            started: true, name, avatar,
            xu: 500, gem: 5, level: 1, xp: 0, day: 1, dayTime: 0.3,
            inv: { 'seed:lua': 4, feed: 4, bait: 4 },
            plots: freshPlots(), pondSlots: START_POND, fishes: [], animals: [],
            coopCap: freshCap(),
            stats: freshStats(), questIdx: 0, uidSeq: 1,
            modal: null, fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null,
          });
        }
      },

      toast: (msg) => {
        const id = toastSeq++;
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, msg }] }));
        setTimeout(() => get().dismissToast(id), 2300);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      setModal: (m) => set({ modal: m }),
      setShopTab: (t) => set({ shopTab: t }),

      addXP: (n) => {
        let { xp, level, xu, gem } = get();
        xp += n;
        let leveled = false;
        while (xp >= xpNeed(level)) {
          xp -= xpNeed(level); level++;
          xu += level * 50; gem += 1; leveled = true;
        }
        set({ xp, level, xu, gem });
        if (leveled) { sfx.lvup(); get().toast(`🎉 LÊN CẤP ${level}! +${level * 50} xu +1💎`); get().checkQuest(); }
      },
      addXu: (n) => set((s) => ({ xu: s.xu + n, stats: { ...s.stats, earned: s.stats.earned + Math.max(0, n) } })),
      addInv: (pid, n) => set((s) => {
        const inv = { ...s.inv };
        inv[pid] = (inv[pid] || 0) + n;
        if (inv[pid] <= 0) delete inv[pid];
        return { inv };
      }),

      tick: (dt) => {
        const s = get();
        if (!s.started) return;
        let dayTime = s.dayTime + dt / DAY_LENGTH;
        let day = s.day;
        if (dayTime >= 1) { dayTime = 0; day++; s.toast(`📅 Ngày mới: ngày ${day}`); }
        // cây
        let changed = false;
        const plots = s.plots.map((pl) => {
          if (pl.locked || pl.state !== 'growing' || !pl.crop) return pl;
          const c = CROPS[pl.crop];
          if (!c) return pl;
          let { progress, watered, waterLeft } = pl;
          if (watered) {
            waterLeft -= dt;
            if (waterLeft <= 0) { watered = false; waterLeft = 0; }
            else {
              progress += dt / c.grow;
              if (progress >= 1) {
                progress = 1;
                sfx.harvest();
                get().toast(`✅ ${c.name} đã chín! Ra thu hoạch 🌱`);
                return { ...pl, state: 'ready' as const, progress, watered, waterLeft };
              }
            }
          }
          if (progress !== pl.progress || watered !== pl.watered) { changed = true; return { ...pl, progress, watered, waterLeft }; }
          return pl;
        });
        // cá
        const fishes = s.fishes.map((f) => {
          if (f.grown) return f;
          const F = FISHES[f.type];
          if (!F) return f;
          const hunger = Math.max(0, f.hunger - dt * 3);
          let age = f.age;
          if (hunger > 20) age += dt;
          if (age >= F.grow) { get().toast(`🐟 ${F.name} đã lớn!`); sfx.catch_(); return { ...f, hunger, age, grown: true }; }
          return { ...f, hunger, age };
        });
        // vật nuôi
        const now = Date.now();
        const animals = s.animals.map((a) => {
          const A = ANIMALS[a.type];
          if (!A) return a;
          const hunger = Math.max(0, a.hunger - dt * 2.2);
          const adult = (now - a.bornAt) / 1000 >= A.grow;
          let { productT, ready } = a;
          if (adult && hunger > 30 && !ready) {
            productT += dt;
            if (productT >= A.cycle) { ready = true; get().toast(`${A.emoji} ${A.name} có ${A.product} rồi!`); }
          }
          return { ...a, hunger, productT, ready };
        });
        if (changed || day !== s.day || dayTime !== s.dayTime) set({ plots, fishes, animals, day, dayTime });
        else set({ fishes, animals });
      },

      interactPlot: (i) => {
        const s = get();
        const pl = s.plots[i];
        if (!pl) return;
        if (pl.locked) { get().unlockPlot(i); return; }
        if (pl.state === 'grass') {
          const plots = s.plots.slice(); plots[i] = { ...pl, state: 'soil' };
          set((st) => ({ plots, stats: { ...st.stats, hoed: st.stats.hoed + 1 } }));
          sfx.plant(); get().toast('⛏️ Đã cuốc đất!'); get().addXP(3); get().checkQuest();
        } else if (pl.state === 'soil') {
          set({ modal: { name: 'seed', plot: i } });
        } else if (pl.state === 'growing') {
          if (!pl.watered) {
            const plots = s.plots.slice(); plots[i] = { ...pl, watered: true, waterLeft: 45 };
            set((st) => ({ plots, stats: { ...st.stats, watered: st.stats.watered + 1 } }));
            sfx.water(); get().toast('💧 Đã tưới nước!'); get().addXP(2); get().checkQuest();
          } else get().toast('Cây đang lớn... ráng đợi nhé!');
        } else if (pl.state === 'ready' && pl.crop) {
          const c = CROPS[pl.crop];
          if (!c) return;
          get().addInv(pl.crop, 1);
          const plots = s.plots.slice(); plots[i] = { ...pl, state: 'soil', crop: null, progress: 0, watered: false, waterLeft: 0 };
          set((st) => ({ plots, stats: { ...st.stats, harvested: st.stats.harvested + 1 } }));
          sfx.harvest(); get().toast(`🧺 Thu hoạch +1 ${c.name} ${c.emoji}!`); get().addXP(c.xp); get().checkQuest();
        }
      },

      unlockPlot: (i) => {
        const s = get();
        const pl = s.plots[i];
        if (!pl || !pl.locked) return;
        const cost = plotCost(i), req = plotReq(i);
        if (s.level < req) { sfx.error(); get().toast(`🔒 Ô ${i + 1} cần đạt Lv${req}!`); return; }
        if (s.xu < cost) { sfx.error(); get().toast(`Cần ${cost}🪙 để mở ô ${i + 1}!`); return; }
        const plots = s.plots.slice(); plots[i] = { ...pl, locked: false };
        set({ plots, xu: s.xu - cost });
        sfx.coin(); get().toast(`🏞️ Đã mở ô đất ${i + 1}!`);
      },

      plantSeed: (i, cropId) => {
        const s = get();
        const pl = s.plots[i];
        if (!pl || pl.locked || pl.state !== 'soil') return;
        if ((s.inv['seed:' + cropId] || 0) <= 0) { sfx.error(); get().toast('Hết hạt! Mua thêm ở cửa hàng'); set({ modal: 'shop', shopTab: 'seed' }); return; }
        get().addInv('seed:' + cropId, -1);
        const plots = s.plots.slice(); plots[i] = { ...pl, state: 'growing', crop: cropId, progress: 0, watered: false, waterLeft: 0 };
        set((st) => ({ plots, modal: null, stats: { ...st.stats, planted: st.stats.planted + 1 } }));
        sfx.plant(); get().toast(`Đã gieo ${CROPS[cropId].name}! Tưới nước ngay 💧`);
        get().addXP(4); get().checkQuest();
      },

      interactPond: (uid) => {
        const s = get();
        if (uid == null) {
          // đứng gần ao: mở thả cá hoặc báo đầy
          if (s.fishes.length >= s.pondSlots) {
            sfx.error(); get().toast(`Ao đầy (${s.pondSlots}/${MAX_POND}) — mở rộng ở shop 🏪`);
          } else {
            set({ modal: { name: 'stock' } });
          }
          return;
        }
        const idx = s.fishes.findIndex((f) => f.uid === uid);
        if (idx < 0) return;
        const f = s.fishes[idx];
        if (!f.grown) {
          const feed = takeFeed(s);
          if (!feed) { sfx.error(); get().toast('Hết thức ăn! Mua ở cửa hàng 🏪'); return; }
          get().addInv(feed, -1);
          const F = FISHES[f.type];
          let { hunger, age } = f;
          let grown: boolean = f.grown;
          if (feed === 'feedPro') {
            hunger = 100; age += F.grow * 0.25;
            if (!f.grown && age >= F.grow) { grown = true; get().toast(`🐟 ${F.name} lớn vọt nhờ cám cao cấp!`); }
          } else hunger = Math.min(100, hunger + 45);
          const fishes = s.fishes.slice(); fishes[idx] = { ...f, hunger, age, grown };
          set((st) => ({ fishes, stats: { ...st.stats, fed: st.stats.fed + 1 } }));
          sfx.eat(); get().toast(feed === 'feedPro' ? '🐟 Cá khoái cám cao cấp!' : '🐟 Cá ăn ngon lành!');
          get().addXP(3); get().checkQuest();
        } else {
          const F = FISHES[f.type];
          get().addInv(f.type, 1);
          const fishes = s.fishes.slice(); fishes.splice(idx, 1);
          set((st) => ({ fishes, stats: { ...st.stats, harvested: st.stats.harvested + 1, collectedAnimal: st.stats.collectedAnimal + 1 } }));
          sfx.harvest(); get().toast(`🎣 Thu hoạch +1 ${F.name}!`); get().addXP(F.xp); get().checkQuest();
        }
      },

      stockFish: (fishId) => {
        const s = get();
        if (s.fishes.length >= s.pondSlots) { sfx.error(); get().toast('Ao đầy rồi!'); return; }
        if ((s.inv['babyfish:' + fishId] || 0) <= 0) { sfx.error(); set({ modal: 'shop', shopTab: 'fish' }); return; }
        get().addInv('babyfish:' + fishId, -1);
        const fishes = [...s.fishes, { uid: s.uidSeq, type: fishId, age: 0, grown: false, hunger: 80 }];
        set((st) => ({ fishes, uidSeq: st.uidSeq + 1, modal: null, stats: { ...st.stats, stockedFish: st.stats.stockedFish + 1 } }));
        sfx.splash(); get().toast(`Đã thả ${FISHES[fishId].name} xuống ao!`);
        get().addXP(5); get().checkQuest();
      },

      unlockPondSlot: () => {
        const s = get();
        if (s.pondSlots >= MAX_POND) { get().toast('Ao đã tối đa!'); return; }
        const k = s.pondSlots, cost = pondCost(k), req = pondReq(k);
        if (s.level < req) { sfx.error(); get().toast(`🔒 Cần đạt Lv${req} để mở thêm chỗ nuôi!`); return; }
        if (s.xu < cost) { sfx.error(); get().toast(`Cần ${cost}🪙 để mở thêm chỗ nuôi!`); return; }
        set({ pondSlots: k + 1, xu: s.xu - cost });
        sfx.coin(); get().toast(`🐟 Ao rộng thêm! Sức chứa ${k + 1}/${MAX_POND}`);
      },

      interactAnimal: (uid) => {
        const s = get();
        const a = s.animals.find((x) => x.uid === uid);
        if (!a) return;
        const A = ANIMALS[a.type];
        if (a.hunger < 60) {
          const feed = takeFeed(s);
          if (!feed) { sfx.error(); get().toast('Hết thức ăn! Mua ở cửa hàng 🏪'); return; }
          get().addInv(feed, -1);
          const adult = (Date.now() - a.bornAt) / 1000 >= A.grow;
          const boost = feed === 'feedPro' && adult ? A.cycle * 0.5 : 0;
          set((st) => ({
            animals: st.animals.map((x) => (x.uid === uid ? { ...x, hunger: 100, productT: x.productT + boost } : x)),
            stats: { ...st.stats, fed: st.stats.fed + 1 },
          }));
          sfx.eat();
          if (a.type === 'chicken' || a.type === 'duck') sfx.cluck();
          if (a.type === 'cow' || a.type === 'sheep') sfx.moo();
          get().toast(feed === 'feedPro' ? `${A.emoji} ${A.name} khoái cám cao cấp, ra sản phẩm nhanh hơn!` : `${A.emoji} ${A.name} ăn no nê!`);
          get().addXP(4); get().checkQuest();
          return;
        }
        const adult = (Date.now() - a.bornAt) / 1000 >= A.grow;
        if (a.ready && adult) {
          get().addInv(A.productId, 1);
          set((st) => ({
            animals: st.animals.map((x) => (x.uid === uid ? { ...x, ready: false, productT: 0 } : x)),
            stats: { ...st.stats, collectedAnimal: st.stats.collectedAnimal + 1 },
          }));
          sfx.harvest(); get().toast(`🎁 Thu được ${A.product}!`);
          get().addXP(A.xp); get().checkQuest();
        } else {
          get().toast(`${A.name}: ${adult ? 'đang tạo sản phẩm…' : 'còn non, cho ăn đều nhé!'} (No ${a.hunger | 0}%)`);
        }
      },

      expandCap: (type) => {
        const s = get();
        const A = ANIMALS[type];
        if (!A) return;
        const cur = s.coopCap[type];
        if (cur >= A.max) { get().toast(`${A.name} đã tối đa ${A.max} con!`); return; }
        const next = cur + 1, cost = capCost(type, next), req = capReq(type, next);
        if (s.level < req) { sfx.error(); get().toast(`🔒 Cần đạt Lv${req} để nới chuồng!`); return; }
        if (s.xu < cost) { sfx.error(); get().toast(`Cần ${cost}🪙 để nới chuồng!`); return; }
        set({ coopCap: { ...s.coopCap, [type]: next }, xu: s.xu - cost });
        sfx.coin(); get().toast(`🏠 Chuồng ${A.name} lên ${next}/${A.max} chỗ!`);
      },

      buySeed: (id) => {
        const c = CROPS[id]; const s = get();
        if (!c) return;
        if (s.level < c.lv) { sfx.error(); get().toast(`🔒 ${c.name} cần đạt Lv${c.lv}!`); return; }
        if (s.xu < c.seedPrice) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set({ xu: s.xu - c.seedPrice }); get().addInv('seed:' + id, 1);
        sfx.coin(); get().toast(`Mua hạt ${c.name}!`);
      },
      buyFish: (id) => {
        const f = FISHES[id]; const s = get();
        if (!f) return;
        if (s.level < f.lv) { sfx.error(); get().toast(`🔒 ${f.name} cần đạt Lv${f.lv}!`); return; }
        if (s.xu < f.babyPrice) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set({ xu: s.xu - f.babyPrice }); get().addInv('babyfish:' + id, 1);
        sfx.coin(); get().toast(`Mua cá con ${f.name}! Ra ao thả nhé 🐟`);
      },
      buyAnimal: (id) => {
        const a = ANIMALS[id]; const s = get();
        if (!a) return;
        if (s.level < a.lv) { sfx.error(); get().toast(`🔒 ${a.name} cần đạt Lv${a.lv}! Trồng trọt lên cấp trước nhé 🌱`); return; }
        const cap = s.coopCap[id as AnimalType] ?? START_CAP;
        const count = s.animals.filter((x) => x.type === id).length;
        if (count >= cap) { sfx.error(); get().toast(`Chuồng ${a.name} đầy (${cap}/${a.max})! Nới chuồng ở shop 🏪`); return; }
        if (s.xu < a.babyPrice) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set((st) => ({
          xu: st.xu - a.babyPrice,
          animals: [...st.animals, { uid: st.uidSeq, type: a.id as AnimalType, bornAt: Date.now(), hunger: 90, productT: 0, ready: false }],
          uidSeq: st.uidSeq + 1,
          stats: { ...st.stats, boughtAnimal: st.stats.boughtAnimal + 1 },
        }));
        sfx.coin(); get().toast(`Mua ${a.name}! Cho ăn đều nhé 🐾`); get().checkQuest();
      },
      buyFeed: (feedId, n) => {
        const price = feedId === 'feedPro' ? FEED_PRO_PRICE : FEED_PRICE;
        const s = get();
        const cost = price * n;
        if (s.xu < cost) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set({ xu: s.xu - cost }); get().addInv(feedId, n); sfx.coin();
      },
      buyBait: (baitId, n) => {
        const price = baitId === 'baitPro' ? BAIT_PRO_PRICE : BAIT_PRICE;
        const s = get();
        const cost = price * n;
        if (s.xu < cost) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set({ xu: s.xu - cost }); get().addInv(baitId, n); sfx.coin();
      },
      exchangeGem: () => {
        const s = get();
        if (s.gem < 5) { sfx.error(); get().toast('Cần 5 💎!'); return; }
        set({ gem: s.gem - 5, xu: s.xu + 500 }); sfx.coin();
      },
      sell: (pid, all) => {
        const s = get();
        const n = s.inv[pid] || 0;
        if (!n) return;
        const k = all ? n : 1;
        get().addInv(pid, -k);
        get().addXu(sellPrice(pid) * k);
        get().addXP(Math.min(40, k * 2));
        sfx.coin(); get().toast(`+${sellPrice(pid) * k} xu!`); get().checkQuest();
      },

      startRiverFishing: (pier, baitId) => {
        const s = get();
        if ((s.inv[baitId] || 0) <= 0) { sfx.error(); get().toast('Hết mồi! Mua ở cửa hàng 🏪'); return; }
        const p = PIERS[pier];
        if (!p) return;
        const wait = BITE_MIN * 1000 + Math.random() * (BITE_MAX - BITE_MIN) * 1000;
        const biteAt = Date.now() + wait;
        set({
          fishingSpot: { pier, x: p.x, y: p.sitY, bx: p.x + 14, by: p.bobY },
          biteAt, biteUntil: biteAt + BITE_WINDOW * 1000,
          fishingBait: baitId, modal: null,
        });
        sfx.splash(); get().toast('🎣 Đã thả cần… đợi cá cắn câu! (E để giật / thu cần)');
      },
      reelRiver: () => {
        const s = get();
        if (!s.fishingSpot) return;
        const now = Date.now();
        if (s.biteAt != null && s.biteUntil != null && now >= s.biteAt && now <= s.biteUntil) {
          // DÍNH!
          const baitId = s.fishingBait ?? 'bait';
          if ((s.inv[baitId] || 0) <= 0) { sfx.error(); get().toast('Hết mồi rồi!'); set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null }); return; }
          get().addInv(baitId, -1);
          const premium = baitId === 'baitPro';
          const id = rollRiverCatch(s.level, premium);
          const nm = id === 'ung' ? 'Ủng cũ 🥾' : id === 'rong' ? 'Rong biển 🌿' : `${FISHES[id].name} ${FISHES[id].emoji}`;
          get().addInv(id, 1);
          const xp = FISHES[id] ? FISHES[id].xp : 2;
          set((st) => ({
            fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null,
            stats: { ...st.stats, fished: st.stats.fished + 1 },
          }));
          sfx.catch_(); sfx.coin();
          get().toast(`🎉 Giật dính ${nm}!`);
          get().addXP(xp); get().checkQuest();
        } else if (s.biteUntil != null && now > s.biteUntil) {
          set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null });
          sfx.splash(); get().toast('💦 Chậm tay quá, cá chạy mất!');
        } else {
          set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null });
          sfx.click(); get().toast('Thu cần về.');
        }
      },
      cancelRiver: (silent) => {
        set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null });
        if (!silent) get().toast('Thu cần về.');
      },

      checkQuest: () => {
        const s = get();
        let { questIdx, stats, level } = s;
        let changed = false;
        while (questIdx < QUESTS.length && questDone(stats, level, questIdx)) {
          const q = QUESTS[questIdx];
          stats = { ...get().stats };
          if (q.reward.xu) { set({ xu: get().xu + (q.reward.xu || 0) }); stats.earned = get().stats.earned; }
          if (q.reward.gem) set({ gem: get().gem + (q.reward.gem || 0) });
          if (q.reward.xp) { get().addXP(q.reward.xp || 0); }
          questIdx++;
          changed = true;
          // toast sau khi cộng để tránh loop
          setTimeout(((qq) => () => get().toast(`📜 Xong NV: ${qq.text} 🎁`))(q), 50);
          const cur = get();
          stats = cur.stats; level = cur.level;
        }
        if (changed) set({ questIdx });
      },

      reset: () => {
        localStorage.removeItem('nongtrai-store');
        set({
          started: false, name: 'NôngDân', avatar: 0,
          xu: 500, gem: 5, level: 1, xp: 0, day: 1, dayTime: 0.3,
          inv: { 'seed:lua': 3, feed: 3, bait: 3 },
          plots: freshPlots(), pondSlots: START_POND, fishes: [], animals: [],
          coopCap: freshCap(),
          stats: freshStats(), questIdx: 0, uidSeq: 1,
          modal: null, fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, toasts: [],
        });
      },
    }),
    {
      name: 'nongtrai-store',
      // KHÔNG persist `started` và trạng thái câu: luôn boot về màn hình login,
      // farm lấy từ DB theo username (server hoặc localStorage theo user).
      partialize: (s) => ({
        name: s.name, avatar: s.avatar,
        xu: s.xu, gem: s.gem, level: s.level, xp: s.xp,
        day: s.day, dayTime: s.dayTime,
        inv: s.inv, plots: s.plots, pondSlots: s.pondSlots, fishes: s.fishes, animals: s.animals,
        coopCap: s.coopCap,
        stats: s.stats, questIdx: s.questIdx, uidSeq: s.uidSeq,
      }),
    }
  )
);
