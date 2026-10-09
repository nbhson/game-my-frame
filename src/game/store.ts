import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Animal, AnimalType, CoopCap, DailyState, GraphicsQuality, InAct, ModalKind, Plot, PondFish, ResMode, SceneKind, ShopTab, Stats, WeatherKind } from './types';
import {
  ANIMALS, BITE_MAX, BITE_MIN, BITE_WINDOW, CARS, CROPS, DAY_LENGTH, FEED_PRO_PRICE, FEED_PRICE,
  BAIT_PRO_PRICE, BAIT_PRICE, DEFAULT_OUTFIT, FISHES, MAX_CAP, MAX_PLOTS, MAX_POND, OUTFITS, QUESTS,
  PEST_PRICE, PEST_RATE, genBiteCombo,
  type BiteDir,
  type OutfitSlot,
  START_CAP, START_PLOTS, START_POND, animalSellPrice, capCost, capReq, plotCost, plotReq, pondCost, pondReq,
  rollRiverCatch, sellPrice,
} from './data';
import { PIERS } from './world';
import { MALL_PIERS } from './mall';
import { PETS, KEM_UID } from './systems';
import { sfx } from './audio';
import { reportContestCatch } from '../net/contest';
import { GIFTCODES, normalizeCode, rewardSummary } from './giftcodes';

// ---------- toasts (UI-only, không persist) ----------
export interface Toast { id: number; msg: string }
let toastSeq = 1;

export interface FishSpot {
  pier: number;
  x: number; y: number; // chỗ ngồi
  bx: number; by: number; // phao
  at: 'farm' | 'mall'; // ngồi câu ở sông nào
}

interface GameState {
  // profile
  started: boolean;
  name: string;
  avatar: number;
  // kinh tế
  xu: number; gem: number; level: number; xp: number;
  day: number; dayTime: number;
  // thời tiết: đổi tự động, mưa tự tưới cây, tuyết làm cây lớn chậm lại
  weather: WeatherKind; weatherLeft: number;
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
  /** code quà đã nhận (chuẩn hóa lowercase) — mỗi code 1 lần / farm, persist + sync DB */
  redeemedCodes: string[];
  // ui state (persist một phần, modal/toast không persist)
  modal: ModalKind;
  shopTab: ShopTab;
  // bản đồ đang đứng: farm riêng, thị trấn chung, hay trong nhà (không persist, luôn boot ở farm)
  scene: SceneKind;
  /** đang ở nhà nào (khi scene === 'interior'), transient */
  interiorId: string | null;
  /** overlay hành động trong nhà (timing/hold/dialog/list), transient */
  inAct: InAct | null;
  // ---- nội thất 6 nhà (persist): tình cảm cô Ba, quỹ làng, việc ngày, bới ve chai ----
  baLove: number;
  loveClaim: number[];
  fundTotal: number;
  fundClaim: number[];
  daily: DailyState;
  junkAt: number;
  // buff chạy nhanh từ cà phê (epoch ms hết hạn, transient)
  speedUntil: number | null;
  // màu đèn sân khấu hiện tại (transient, vui là chính)
  stageColor: string;
  // câu sông: transient, không persist
  fishingSpot: FishSpot | null;
  biteAt: number | null;
  biteUntil: number | null;
  fishingBait: string | null;
  // mini-game giật cá: con cá đã roll sẵn + dãy mũi tên phải bấm trong 3s
  biteCatchId: string | null;
  biteCombo: BiteDir[] | null;
  biteProgress: number;
  // hiệu ứng cá mắc trên dây khi vừa giật dính (vẽ ở world 2.5s)
  catchPop: { x: number; y: number; fishId: string; label: string; until: number } | null;
  // hiệu ứng động tác trên từng ô ruộng (cuốc/gieo/tưới/phun/thu hoạch), transient ~1.3s
  plotFx: { plot: number; kind: 'hoe' | 'plant' | 'water' | 'spray' | 'harvest'; at: number; crop?: string }[];
  // thời trang: slot -> itemId + kho đồ đã sở hữu
  outfit: Record<string, string>;
  ownedOutfits: string[];
  // ô tô: xe đã mua (gara) + xe đang lái (null = đi bộ)
  ownedCars: string[];
  activeCar: string | null;
  // cấp đồ họa: high (đủ hiệu ứng) / medium / low (máy yếu) — persist + sync
  quality: GraphicsQuality;
  // tự động chỉnh đồ họa theo FPS thật (mặc định BẬT để hết lag; tắt khi muốn cố định tay)
  autoQuality: boolean;
  // mức đang dùng khi auto (transient, không lưu) — render đọc effective = auto ? autoLevel : quality
  autoLevel: GraphicsQuality;
  // độ phân giải render (nhân với DPR): auto = theo cấp hiệu dụng (low 0.6 / med 0.85 / high 1)
  resMode: ResMode;
  // bị chó cắn khi hái trộm (epoch ms hết hạn, transient — vẽ GÂU! trên đầu)
  thiefBiteUntil: number | null;
  // đang xoa đầu / vuốt ve thú cưng: { uid pet, at } — animation 2 chiều 2.6s
  petFx: { uid: number; at: number } | null;
  toasts: Toast[];

  // actions
  /** Đăng nhập bằng username: có snapshot DB thì migrate + dùng, không thì farm mới */
  loadAccount: (name: string, avatar: number, data: {
    xu: number; gem: number; level: number; xp: number;
    day: number; dayTime: number;
    weather?: WeatherKind; weatherLeft?: number;
    inv: Record<string, number>;
    plots: Plot[]; fishes: PondFish[]; animals: Animal[];
    pondSlots?: number; coopCap?: CoopCap;
    stats: Stats; questIdx: number; uidSeq: number;
    baLove?: number; loveClaim?: number[]; fundTotal?: number; fundClaim?: number[];
    daily?: DailyState; junkAt?: number;
    redeemedCodes?: string[];
    outfit?: Record<string, string>; ownedOutfits?: string[];
    ownedCars?: string[]; activeCar?: string | null;
    quality?: GraphicsQuality; viewH?: number; kem?: boolean;
    autoQuality?: boolean; resMode?: ResMode;
    stageColor?: string;
  } | null) => void;
  toast: (msg: string) => void;
  dismissToast: (id: number) => void;
  setModal: (m: ModalKind) => void;
  setShopTab: (t: ShopTab) => void;
  setScene: (s: SceneKind) => void;
  setInteriorId: (id: string | null) => void;
  setInAct: (a: InAct | null) => void;
  /** đảm bảo daily đúng ngày hiện tại (reset flag/ngày khi sang ngày mới) */
  touchDaily: () => void;
  setDailyFlag: (k: string) => void;
  addCatGift: (cat: string) => void;
  setDailyQuests: (q: DailyState['quests']) => void;
  addLove: (n: number) => void;
  claimLove: (i: number) => void;
  addFund: (n: number) => void;
  claimFund: (i: number) => void;
  setJunkAt: (t: number) => void;
  setSpeed: (until: number | null) => void;
  setStageColor: (c: string) => void;
  addXP: (n: number) => void;
  addXu: (n: number) => void;
  addGem: (n: number) => void;
  addInv: (pid: string, n: number) => void;
  /** Nhập giftcode: trả về { ok, msg } để modal hiển thị. Mỗi code 1 lần / farm. */
  redeemCode: (raw: string) => { ok: boolean; msg: string };
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
  buyPesticide: (n: number) => void;
  exchangeGem: () => void;
  buyOutfit: (id: string) => void;
  wearOutfit: (id: string) => void;
  /** Mua ô tô ở Chợ Xe — xe cất vào gara, ra gara bấm Lái để chạy */
  buyCar: (id: string) => void;
  /** Lên/xuống xe: driveCar(id) khi sở hữu, driveCar(null) để xuống đi bộ */
  driveCar: (id: string | null) => void;
  /** Đổi cấp đồ họa (áp dụng ngay, lưu máy + tài khoản) */
  setQuality: (q: GraphicsQuality) => void;
  /** Bật/tắt tự động chỉnh đồ họa theo FPS */
  setAutoQuality: (v: boolean) => void;
  /** Mức auto dò được (game loop tự gọi khi FPS thấp/cao) */
  setAutoLevel: (q: GraphicsQuality) => void;
  /** Độ phân giải render (áp dụng ngay, lưu máy + tài khoản) */
  setResMode: (m: ResMode) => void;
  /** Độ cao khung nhìn (world units): nhỏ = gần to, lớn = xa rộng. Mặc định 1050. */
  viewH: number;
  setViewH: (h: number) => void;
  /** Bị chó nhà người ta cắn khi hái trộm → hiện GÂU! 2.5s */
  setThiefBite: () => void;
  /** Xoa đầu chó / vuốt ve mèo: animation 2 chiều giữa người và pet trong 2.6s */
  petPet: (uid: number) => void;
  /** Đã triệu hồi mèo Kem đi theo chủ chưa (lệnh kemkem, chỉ 1 con duy nhất) */
  kem: boolean;
  /** Triệu hồi Kem (true = mới triệu hồi, false = đã có rồi → không gì xảy ra) */
  summonKem: () => boolean;
  // ---- LÀM HÀNG LOẠT (⚡): 1 chạm xử lý cả farm / cả đàn ----
  /** Cuốc hết ô cỏ → đất (free) */
  bulkHoe: () => void;
  /** Gieo 1 loại hạt vào hết ô đất trống (giới hạn bởi số hạt có) */
  bulkSow: (cropId: string) => void;
  /** Tưới hết ô đang khát (free) */
  bulkWater: () => void;
  /** Phun thuốc hết ô bị sâu (giới hạn bởi số bình thuốc) */
  bulkSpray: () => void;
  /** Thu hoạch hết ô đã chín (free) */
  bulkHarvest: () => void;
  /** Cho ăn hết gia súc đang đói (ưu tiên cám thường) */
  bulkFeedAnimals: () => void;
  /** Thu hết sản phẩm gia súc đã có */
  bulkCollectAnimals: () => void;
  /** Cho ăn hết cá chưa lớn trong ao */
  bulkFeedFish: () => void;
  /** Thu hoạch hết cá đã lớn trong ao */
  bulkHarvestFish: () => void;
  /** Chủ farm bị hái trộm: mất cây ở ô plot nếu còn chín đúng loại, trả về true nếu mất */
  applyVictimSteal: (plot: number, crop: string) => boolean;
  sell: (pid: string, all: boolean) => void;
  /** Bán 1 con vật nuôi đã lớn (còn non không bán được) */
  sellAnimal: (uid: number) => void;
  /** Bán 1 con cá đã lớn trong ao */
  sellFish: (uid: number) => void;
  startRiverFishing: (pier: number, baitId: string, at?: 'farm' | 'mall') => void;
  reelRiver: () => void;
  pressBiteKey: (dir: BiteDir) => void;
  cancelRiver: (silent?: boolean) => void;
  checkQuest: () => void;
  reset: () => void;
}

function freshPlots(): Plot[] {
  return Array.from({ length: MAX_PLOTS }, (_, i) => ({
    state: 'grass' as const, crop: null, progress: 0,
    watered: false, waterLeft: 0, locked: i >= START_PLOTS, pest: false,
  }));
}
function freshCap(): CoopCap {
  const cap = {} as CoopCap;
  for (const id of Object.keys(ANIMALS)) cap[id as AnimalType] = START_CAP;
  return cap;
}
function freshStats(): Stats {
  return { hoed: 0, planted: 0, watered: 0, harvested: 0, boughtAnimal: 0, fed: 0, collectedAnimal: 0, stockedFish: 0, earned: 0, fished: 0 };
}

/** Migrate save cũ (12 ô, ao 6 ngăn, chưa có locked/cap) lên model mới */
function migratePlots(old: Plot[] | undefined): Plot[] {
  const fresh = freshPlots();
  if (!old || !old.length) return fresh;
  if (old.length >= MAX_PLOTS) {
    return fresh.map((p, i) => ({ ...(old[i] ?? p), locked: old[i]?.locked ?? false, pest: old[i]?.pest ?? false }));
  }
  // save cũ 12 ô đều dùng được → giữ 12 ô đầu mở, còn lại khóa
  const keepOpen = Math.max(START_PLOTS, Math.min(12, old.length));
  return fresh.map((p, i) => (i < old.length
    ? { state: old[i].state, crop: old[i].crop, progress: old[i].progress, watered: old[i].watered, waterLeft: old[i].waterLeft ?? 0, locked: i >= keepOpen, pest: old[i].pest ?? false }
    : p));
}
function migrateFishes(old: PondFish[] | undefined, uidSeqRef: { v: number }): PondFish[] {
  if (!old) return [];
  return old.filter(Boolean).map((f) => ({ uid: f.uid ?? uidSeqRef.v++, type: f.type, age: f.age ?? 0, grown: !!f.grown, hunger: f.hunger ?? 80 }));
}

export const xpNeed = (level: number) => level * 100;

/** Làm hàng loạt (⚡) mở khóa từ cấp này — dưới mức này bấm vào sẽ nhận thông báo */
export const BULK_MIN_LEVEL = 10;
/** Thông báo khóa khi chưa đủ cấp mở Hàng loạt */
export const bulkLockedMsg = (level: number) =>
  `🔒 Hàng loạt mở từ Lv${BULK_MIN_LEVEL}! Bạn đang Lv${level} — lên cấp thêm nhé!`;

/** Thời tiết kế tiếp: nắng nhiều, mưa vừa, tuyết hiếm (farm nhiệt đới mà có tuyết là sự kiện!) */
export function rollWeather(): { w: WeatherKind; dur: number } {
  const r = Math.random();
  const w: WeatherKind = r < 0.62 ? 'sunny' : r < 0.85 ? 'rain' : 'snow';
  return { w, dur: 60 + Math.random() * 70 };
}
export const WEATHER_LABEL: Record<WeatherKind, string> = { sunny: 'Nắng', rain: 'Mưa', snow: 'Tuyết' };
/** Khung nhìn: 620 = gần nhất, 1600 = xa nhất (bao hết map 1320 + viền), mặc định 1050 */
export const VIEW_H_MIN = 620;
export const VIEW_H_MAX = 1600;
export const VIEW_H_DEFAULT = 1050;
/** Mặc định lần đầu theo màn hình: máy dọc (điện thoại) nhìn xa hơn để thấy rộng 2 bên */
export const defaultViewH = () => {
  if (typeof window !== 'undefined' && window.innerHeight > window.innerWidth) return 1280;
  return VIEW_H_DEFAULT;
};
export const clampViewH = (h: number) => Math.max(VIEW_H_MIN, Math.min(VIEW_H_MAX, Math.round(h)));

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

/**
 * Lưu ngay lên server + local sau khi mua/mặc/lên xe — khỏi chờ autosync 10s
 * (mua xe xong restart server liền vẫn còn). Dynamic import để tránh vòng
 * lặp module store <-> net/account (account cũng import store).
 */
function saveSoon() {
  void import('../net/account').then((m) => m.syncNow()).catch(() => {});
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      started: false,
      name: 'NôngDân', avatar: 0,
      xu: 500, gem: 5, level: 1, xp: 0,
      day: 1, dayTime: 0.3,
      weather: 'sunny', weatherLeft: 90,
      inv: { 'seed:lua': 3, feed: 3, bait: 3 },
      plots: freshPlots(),
      pondSlots: START_POND,
      fishes: [],
      animals: [],
      coopCap: freshCap(),
      stats: freshStats(),
      questIdx: 0, uidSeq: 1,
      redeemedCodes: [],
      modal: null, shopTab: 'seed', scene: 'farm',
      interiorId: null, inAct: null,
      baLove: 0, loveClaim: [], fundTotal: 0, fundClaim: [],
      daily: { day: 1, flags: {}, cats: [], quests: [] },
      junkAt: 0, speedUntil: null, stageColor: '#ffd24d',
      fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null,
      biteCatchId: null, biteCombo: null, biteProgress: 0,
      catchPop: null, outfit: { ...DEFAULT_OUTFIT }, ownedOutfits: Object.keys(DEFAULT_OUTFIT).map((k) => DEFAULT_OUTFIT[k as OutfitSlot]),
      ownedCars: [], activeCar: null,
      quality: 'high', autoQuality: true, autoLevel: 'medium', resMode: 'auto', thiefBiteUntil: null,
      viewH: defaultViewH(),
      kem: false,
      petFx: null,
      plotFx: [],
      toasts: [],

      loadAccount: (name, avatar, data) => {
        if (data) {
          const uidRef = { v: data.uidSeq };
          const fishes = migrateFishes(data.fishes, uidRef);
          const cap = data.coopCap ?? freshCap();
          // đảm bảo cap không nhỏ hơn số con đang có (+ save cũ thiếu loài mới → bù START_CAP)
          for (const t of Object.keys(ANIMALS) as AnimalType[]) {
            if (cap[t] == null) cap[t] = START_CAP;
            const n = data.animals.filter((a) => a.type === t).length;
            if (cap[t] < Math.max(START_CAP, n)) cap[t] = Math.max(START_CAP, n);
          }
          set({
            started: true, name, avatar,
            xu: data.xu, gem: data.gem, level: data.level, xp: data.xp,
            day: data.day, dayTime: data.dayTime,
            weather: data.weather ?? 'sunny', weatherLeft: data.weatherLeft ?? 90,
            inv: data.inv, plots: migratePlots(data.plots), fishes,
            pondSlots: Math.min(MAX_POND, Math.max(START_POND, data.pondSlots ?? (data.fishes?.length >= 6 ? 6 : START_POND))),
            animals: data.animals, coopCap: cap,
            stats: data.stats, questIdx: data.questIdx, uidSeq: uidRef.v,
            baLove: data.baLove ?? 0, fundTotal: data.fundTotal ?? 0,
            loveClaim: Array.isArray(data.loveClaim) ? data.loveClaim : [],
            fundClaim: Array.isArray(data.fundClaim) ? data.fundClaim : [],
            daily: data.daily ?? { day: data.day, flags: {}, cats: [], quests: [] },
            junkAt: data.junkAt ?? 0,
            redeemedCodes: Array.isArray(data.redeemedCodes) ? data.redeemedCodes.map((c) => String(c).toLowerCase()) : [],
            outfit: { ...DEFAULT_OUTFIT, ...(data.outfit ?? {}) },
            ownedOutfits: Array.isArray(data.ownedOutfits) && data.ownedOutfits.length > 0
              ? [...new Set([...Object.values(DEFAULT_OUTFIT), ...data.ownedOutfits])]
              : Object.values(DEFAULT_OUTFIT),
            ownedCars: Array.isArray(data.ownedCars) ? data.ownedCars.filter((id) => !!CARS[id]) : [],
            activeCar: data.activeCar && CARS[data.activeCar] && (data.ownedCars ?? []).includes(data.activeCar) ? data.activeCar : null,
            quality: data.quality === 'low' || data.quality === 'medium' ? data.quality : 'high',
            autoQuality: data.autoQuality !== false,
            autoLevel: data.quality === 'low' ? 'low' : 'medium',
            resMode: data.resMode === 'full' || data.resMode === 'med' || data.resMode === 'low' ? data.resMode : 'auto',
            viewH: clampViewH(data.viewH ?? VIEW_H_DEFAULT),
            kem: !!data.kem,
            stageColor: data.stageColor ?? '#ffd24d',
            modal: null, fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0, catchPop: null, petFx: null, plotFx: [], scene: 'farm',
          });
        } else {
          set({
            started: true, name, avatar,
            xu: 500, gem: 5, level: 1, xp: 0, day: 1, dayTime: 0.3,
            weather: 'sunny', weatherLeft: 90,
            inv: { 'seed:lua': 4, feed: 4, bait: 4 },
            plots: freshPlots(), pondSlots: START_POND, fishes: [], animals: [],
            coopCap: freshCap(),
            stats: freshStats(), questIdx: 0, uidSeq: 1,
            redeemedCodes: [],
            outfit: { ...DEFAULT_OUTFIT }, ownedOutfits: Object.values(DEFAULT_OUTFIT),
            ownedCars: [], activeCar: null,
            quality: 'high', autoQuality: true, autoLevel: 'medium', resMode: 'auto', viewH: defaultViewH(), kem: false,
            modal: null, fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0, catchPop: null, petFx: null, plotFx: [], scene: 'farm',
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
      setScene: (scene) => set({ scene, modal: null }),
      setInteriorId: (id) => set({ interiorId: id }),
      setInAct: (a) => set({ inAct: a }),
      touchDaily: () => {
        const s = get();
        if (s.daily.day !== s.day) set({ daily: { day: s.day, flags: {}, cats: [], quests: [] } });
      },
      setDailyFlag: (k) => {
        get().touchDaily();
        set((s) => ({ daily: { ...s.daily, flags: { ...s.daily.flags, [k]: true } } }));
      },
      addCatGift: (cat) => {
        get().touchDaily();
        set((s) => ({ daily: { ...s.daily, cats: [...s.daily.cats, cat] } }));
      },
      setDailyQuests: (q) => {
        get().touchDaily();
        set((s) => ({ daily: { ...s.daily, quests: q } }));
      },
      addLove: (n) => set((s) => ({ baLove: s.baLove + n })),
      claimLove: (i) => set((s) => ({ loveClaim: [...s.loveClaim, i] })),
      addFund: (n) => set((s) => ({ fundTotal: s.fundTotal + n })),
      claimFund: (i) => set((s) => ({ fundClaim: [...s.fundClaim, i] })),
      setJunkAt: (t) => set({ junkAt: t }),
      setSpeed: (until) => set({ speedUntil: until }),
      setStageColor: (c) => set({ stageColor: c }),

      addXP: (n) => {
        let { xp, level, xu, gem } = get();
        xp += n;
        let leveled = false;
        while (xp >= xpNeed(level)) {
          xp -= xpNeed(level); level++;
          xu += level * 50; gem += 1; leveled = true;
        }
        set({ xp, level, xu, gem });
        if (leveled) { sfx.lvup(); get().toast(`LÊN CẤP ${level}! +${level * 50} xu +1 gem`); get().checkQuest(); }
      },
      addXu: (n) => set((s) => ({ xu: s.xu + n, stats: { ...s.stats, earned: s.stats.earned + Math.max(0, n) } })),
      addGem: (n) => set((s) => ({ gem: s.gem + n })),
      addInv: (pid, n) => set((s) => {
        const inv = { ...s.inv };
        inv[pid] = (inv[pid] || 0) + n;
        if (inv[pid] <= 0) delete inv[pid];
        return { inv };
      }),

      redeemCode: (raw) => {
        const code = normalizeCode(raw);
        if (!code) return { ok: false, msg: 'Nhập code đã nhé!' };
        const reward = GIFTCODES[code];
        if (!reward) return { ok: false, msg: 'Code không tồn tại!' };
        const s = get();
        if (s.redeemedCodes.includes(code)) return { ok: false, msg: 'Code này đã nhận rồi!' };
        const inv = { ...s.inv };
        for (const [pid, n] of Object.entries(reward.items)) inv[pid] = (inv[pid] || 0) + n;
        set({
          inv,
          xu: s.xu + reward.xu,
          gem: s.gem + reward.gem,
          stats: { ...s.stats, earned: s.stats.earned + Math.max(0, reward.xu) },
          redeemedCodes: [...s.redeemedCodes, code],
        });
        sfx.coin();
        const msg = `Nhận quà ${reward.title}! ${rewardSummary(reward)}`;
        get().toast(msg);
        return { ok: true, msg };
      },

      tick: (dt) => {
        const s = get();
        if (!s.started) return;
        // cá vừa giật dính: hết 2.5s thì dọn hiệu ứng
        if (s.catchPop && Date.now() > s.catchPop.until) set({ catchPop: null });
        // bị chó cắn: hết 2.5s thì dọn hiệu ứng GÂU!
        if (s.thiefBiteUntil && Date.now() > s.thiefBiteUntil) set({ thiefBiteUntil: null });
        // xoa đầu / vuốt ve: hết 2.6s thì dọn
        if (s.petFx && Date.now() - s.petFx.at > 2600) set({ petFx: null });
        // dọn hiệu ứng động tác ruộng đã quá 1.5s
        if (s.plotFx.length > 0) {
          const now = Date.now();
          if (now - s.plotFx[0].at > 1500) set({ plotFx: s.plotFx.filter((f) => now - f.at < 1500) });
        }
        let dayTime = s.dayTime + dt / DAY_LENGTH;
        let day = s.day;
        if (dayTime >= 1) { dayTime = 0; day++; s.toast(`Ngày mới: ngày ${day}`); }
        // --- thời tiết: đếm ngược rồi đổi ngẫu nhiên ---
        let { weather, weatherLeft } = s;
        weatherLeft -= dt;
        if (weatherLeft <= 0) {
          const r = rollWeather();
          // tránh lặp lại thời tiết cũ liên tục
          weather = (r.w === weather && Math.random() < 0.5) ? 'sunny' : r.w;
          weatherLeft = r.dur;
          if (weather === 'rain') s.toast('Trời mưa! Cây được tưới tự động');
          else if (weather === 'snow') s.toast('Tuyết rơi! Cây lớn chậm lại');
          else if (s.weather !== 'sunny') s.toast('Trời nắng trở lại!');
        }
        const raining = weather !== 'sunny'; // mưa + tuyết đều giữ ẩm đất
        const growthMul = weather === 'snow' ? 0.5 : 1;
        // cây
        let changed = false;
        let pestToast: string | null = null;
        const plots = s.plots.map((pl) => {
          if (pl.locked || pl.state !== 'growing' || !pl.crop) return pl;
          const c = CROPS[pl.crop];
          if (!c) return pl;
          let { progress, watered, waterLeft, pest } = pl;
          if (raining) { watered = true; waterLeft = Math.max(waterLeft, 12); }
          // cây bị sâu thì ngừng lớn cho tới khi phun thuốc
          if (watered && !pest) {
            waterLeft -= dt;
            if (waterLeft <= 0) { watered = false; waterLeft = 0; }
            else {
              progress += (dt * growthMul) / c.grow;
              if (progress >= 1) {
                progress = 1;
                sfx.harvest();
                get().toast(`${c.name} đã chín! Ra thu hoạch`);
                return { ...pl, state: 'ready' as const, progress, watered, waterLeft };
              }
            }
          } else if (watered) {
            waterLeft -= dt;
            if (waterLeft <= 0) { watered = false; waterLeft = 0; }
          }
          // sâu xuất hiện ngẫu nhiên trên cây đang lớn (chưa bị + đã lên mầm)
          if (!pest && progress > 0.05 && Math.random() < dt * PEST_RATE) {
            pest = true;
            changed = true;
            if (!pestToast) pestToast = `${c.name} bị sâu! Bấm E để phun thuốc`;
            return { ...pl, progress, watered, waterLeft, pest };
          }
          if (progress !== pl.progress || watered !== pl.watered) { changed = true; return { ...pl, progress, watered, waterLeft, pest }; }
          return pl;
        });
        if (pestToast) get().toast(pestToast);
        const fishes = s.fishes.map((f) => {
          if (f.grown) return f;
          const F = FISHES[f.type];
          if (!F) return f;
          // no 15 phút: 100 -> 0 trong 900s
          const hunger = Math.max(0, f.hunger - dt * (100 / 900));
          let age = f.age;
          if (hunger > 20) age += dt;
          if (age >= F.grow) { get().toast(`${F.name} đã lớn!`); sfx.catch_(); return { ...f, hunger, age, grown: true }; }
          return { ...f, hunger, age };
        });
        // vật nuôi
        const now = Date.now();
        const animals = s.animals.map((a) => {
          const A = ANIMALS[a.type];
          if (!A) return a;
          // no 15 phút: 100 -> 0 trong 900s
          const hunger = Math.max(0, a.hunger - dt * (100 / 900));
          const adult = (now - a.bornAt) / 1000 >= A.grow;
          let { productT, ready } = a;
          if (adult && hunger > 30 && !ready) {
            productT += dt;
            if (productT >= A.cycle) { ready = true; get().toast(`${A.name} có ${A.product} rồi!`); }
          }
          return { ...a, hunger, productT, ready };
        });
        if (changed || day !== s.day || dayTime !== s.dayTime || weather !== s.weather) set({ plots, fishes, animals, day, dayTime, weather, weatherLeft });
        else if (weatherLeft !== s.weatherLeft) set({ fishes, animals, weatherLeft });
        else set({ fishes, animals });
      },

      interactPlot: (i) => {
        const s = get();
        const pl = s.plots[i];
        if (!pl) return;
        if (pl.locked) { get().unlockPlot(i); return; }
        if (pl.state === 'grass') {
          const plots = s.plots.slice(); plots[i] = { ...pl, state: 'soil' };
          set((st) => ({
            plots,
            stats: { ...st.stats, hoed: st.stats.hoed + 1 },
            plotFx: [...st.plotFx.slice(-7), { plot: i, kind: 'hoe' as const, at: Date.now() }],
          }));
          sfx.plant(); get().toast('Đã cuốc đất!'); get().addXP(3); get().checkQuest();
        } else if (pl.state === 'soil') {
          set({ modal: { name: 'seed', plot: i } });
        } else if (pl.state === 'growing') {
          if (pl.pest) {
            // cây bị sâu: phun thuốc trước, hết thuốc thì mở shop
            if ((s.inv.pesticide || 0) <= 0) { sfx.error(); get().toast('Hết thuốc trừ sâu! Mua ở cửa hàng'); set({ modal: 'shop', shopTab: 'food' }); return; }
            get().addInv('pesticide', -1);
            const plots = s.plots.slice(); plots[i] = { ...pl, pest: false };
            set((st) => ({ plots, plotFx: [...st.plotFx.slice(-7), { plot: i, kind: 'spray' as const, at: Date.now(), crop: pl.crop ?? undefined }] }));
            sfx.spray(); get().toast('Đã phun thuốc, cây hết sâu!');
            get().addXP(2); get().checkQuest();
          } else if (!pl.watered) {
            const plots = s.plots.slice(); plots[i] = { ...pl, watered: true, waterLeft: 45 };
            set((st) => ({
              plots,
              stats: { ...st.stats, watered: st.stats.watered + 1 },
              plotFx: [...st.plotFx.slice(-7), { plot: i, kind: 'water' as const, at: Date.now(), crop: pl.crop ?? undefined }],
            }));
            sfx.water(); get().toast('Đã tưới nước!'); get().addXP(2); get().checkQuest();
          } else get().toast('Cây đang lớn... ráng đợi nhé!');
        } else if (pl.state === 'ready' && pl.crop) {
          const c = CROPS[pl.crop];
          if (!c) return;
          get().addInv(pl.crop, 1);
          const plots = s.plots.slice(); plots[i] = { ...pl, state: 'soil', crop: null, progress: 0, watered: false, waterLeft: 0, pest: false };
          set((st) => ({
            plots,
            stats: { ...st.stats, harvested: st.stats.harvested + 1 },
            plotFx: [...st.plotFx.slice(-7), { plot: i, kind: 'harvest' as const, at: Date.now(), crop: pl.crop ?? undefined }],
          }));
          sfx.harvest(); get().toast(`Thu hoạch +1 ${c.name}!`); get().addXP(c.xp); get().checkQuest();
        }
      },

      unlockPlot: (i) => {
        const s = get();
        const pl = s.plots[i];
        if (!pl || !pl.locked) return;
        const cost = plotCost(i), req = plotReq(i);
        if (s.level < req) { sfx.error(); get().toast(`Ô ${i + 1} cần đạt Lv${req}!`); return; }
        if (s.xu < cost) { sfx.error(); get().toast(`Cần ${cost} xu để mở ô ${i + 1}!`); return; }
        const plots = s.plots.slice(); plots[i] = { ...pl, locked: false };
        set({ plots, xu: s.xu - cost });
        sfx.coin(); get().toast(`Đã mở ô đất ${i + 1}!`);
      },

      plantSeed: (i, cropId) => {
        const s = get();
        const pl = s.plots[i];
        if (!pl || pl.locked || pl.state !== 'soil') return;
        if ((s.inv['seed:' + cropId] || 0) <= 0) { sfx.error(); get().toast('Hết hạt! Mua thêm ở cửa hàng'); set({ modal: 'shop', shopTab: 'seed' }); return; }
        get().addInv('seed:' + cropId, -1);
        const plots = s.plots.slice(); plots[i] = { ...pl, state: 'growing', crop: cropId, progress: 0, watered: false, waterLeft: 0 };
        set((st) => ({
          plots, modal: null,
          stats: { ...st.stats, planted: st.stats.planted + 1 },
          plotFx: [...st.plotFx.slice(-7), { plot: i, kind: 'plant' as const, at: Date.now(), crop: cropId }],
        }));
        sfx.plant(); get().toast(`Đã gieo ${CROPS[cropId].name}! Tưới nước ngay`);
        get().addXP(4); get().checkQuest();
      },

      // ================= LÀM HÀNG LOẠT =================
      bulkHoe: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const targets = s.plots.map((pl, i) => ({ pl, i })).filter(({ pl }) => !pl.locked && pl.state === 'grass');
        if (!targets.length) { sfx.error(); get().toast('Không còn ô cỏ nào để cuốc!'); return; }
        const plots = s.plots.slice();
        const fx: { plot: number; kind: 'hoe'; at: number }[] = [];
        for (const { pl, i } of targets) { plots[i] = { ...pl, state: 'soil' }; fx.push({ plot: i, kind: 'hoe', at: Date.now() }); }
        set((st) => ({ plots, stats: { ...st.stats, hoed: st.stats.hoed + targets.length }, plotFx: [...st.plotFx, ...fx].slice(-8) }));
        sfx.plant(); get().toast(`⚡ Đã cuốc ${targets.length} ô đất!`);
        get().addXP(3 * targets.length); get().checkQuest();
      },

      bulkSow: (cropId) => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const c = CROPS[cropId];
        if (!c) return;
        const empties = s.plots.map((pl, i) => ({ pl, i })).filter(({ pl }) => !pl.locked && pl.state === 'soil');
        if (!empties.length) { sfx.error(); get().toast('Không còn ô đất trống nào!'); return; }
        const seeds = s.inv['seed:' + cropId] || 0;
        if (seeds <= 0) { sfx.error(); get().toast(`Hết hạt ${c.name}! Mua thêm ở cửa hàng`); set({ modal: 'shop', shopTab: 'seed' }); return; }
        const n = Math.min(empties.length, seeds);
        const plots = s.plots.slice();
        const fx: { plot: number; kind: 'plant'; at: number; crop: string }[] = [];
        for (let k = 0; k < n; k++) {
          const { pl, i } = empties[k];
          plots[i] = { ...pl, state: 'growing', crop: cropId, progress: 0, watered: false, waterLeft: 0 };
          fx.push({ plot: i, kind: 'plant', at: Date.now(), crop: cropId });
        }
        const inv = { ...s.inv, ['seed:' + cropId]: seeds - n };
        set((st) => ({ plots, inv, stats: { ...st.stats, planted: st.stats.planted + n }, plotFx: [...st.plotFx, ...fx].slice(-8) }));
        sfx.plant();
        get().toast(n < empties.length ? `⚡ Đã gieo ${n}/${empties.length} ô ${c.name} (hết hạt!) — nhớ tưới nước` : `⚡ Đã gieo ${n} ô ${c.name}! Nhớ tưới nước`);
        get().addXP(4 * n); get().checkQuest();
      },

      bulkWater: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const targets = s.plots.map((pl, i) => ({ pl, i })).filter(({ pl }) => !pl.locked && pl.state === 'growing' && !pl.watered);
        if (!targets.length) { sfx.error(); get().toast('Mọi cây đều đã đủ nước!'); return; }
        const plots = s.plots.slice();
        const fx: { plot: number; kind: 'water'; at: number; crop?: string }[] = [];
        for (const { pl, i } of targets) {
          plots[i] = { ...pl, watered: true, waterLeft: 45 };
          fx.push({ plot: i, kind: 'water', at: Date.now(), crop: pl.crop ?? undefined });
        }
        set((st) => ({ plots, stats: { ...st.stats, watered: st.stats.watered + targets.length }, plotFx: [...st.plotFx, ...fx].slice(-8) }));
        sfx.water(); get().toast(`⚡ Đã tưới ${targets.length} ô!`);
        get().addXP(2 * targets.length); get().checkQuest();
      },

      bulkSpray: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const targets = s.plots.map((pl, i) => ({ pl, i })).filter(({ pl }) => !pl.locked && pl.state === 'growing' && pl.pest);
        if (!targets.length) { sfx.error(); get().toast('Không cây nào bị sâu!'); return; }
        const bottles = s.inv.pesticide || 0;
        if (bottles <= 0) { sfx.error(); get().toast('Hết thuốc trừ sâu! Mua ở cửa hàng'); set({ modal: 'shop', shopTab: 'food' }); return; }
        const n = Math.min(targets.length, bottles);
        const plots = s.plots.slice();
        const fx: { plot: number; kind: 'spray'; at: number; crop?: string }[] = [];
        for (let k = 0; k < n; k++) {
          const { pl, i } = targets[k];
          plots[i] = { ...pl, pest: false };
          fx.push({ plot: i, kind: 'spray', at: Date.now(), crop: pl.crop ?? undefined });
        }
        const inv = { ...s.inv, pesticide: bottles - n };
        set((st) => ({ plots, inv, plotFx: [...st.plotFx, ...fx].slice(-8) }));
        sfx.spray();
        get().toast(n < targets.length ? `⚡ Đã phun ${n}/${targets.length} ô (hết thuốc!)` : `⚡ Đã phun thuốc ${n} ô, cây hết sâu!`);
        get().addXP(2 * n); get().checkQuest();
      },

      bulkHarvest: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const targets = s.plots.map((pl, i) => ({ pl, i })).filter(({ pl }) => !pl.locked && pl.state === 'ready' && pl.crop);
        if (!targets.length) { sfx.error(); get().toast('Chưa có ô nào chín!'); return; }
        const plots = s.plots.slice();
        const inv = { ...s.inv };
        const fx: { plot: number; kind: 'harvest'; at: number; crop?: string }[] = [];
        let xp = 0;
        for (const { pl, i } of targets) {
          const c = CROPS[pl.crop!];
          inv[pl.crop!] = (inv[pl.crop!] || 0) + 1;
          if (c) xp += c.xp;
          plots[i] = { ...pl, state: 'soil', crop: null, progress: 0, watered: false, waterLeft: 0, pest: false };
          fx.push({ plot: i, kind: 'harvest', at: Date.now(), crop: pl.crop ?? undefined });
        }
        set((st) => ({ plots, inv, stats: { ...st.stats, harvested: st.stats.harvested + targets.length }, plotFx: [...st.plotFx, ...fx].slice(-8) }));
        sfx.harvest(); get().toast(`⚡ Thu hoạch ${targets.length} ô! Bán ở shop nhé`);
        get().addXP(xp); get().checkQuest();
      },

      bulkFeedAnimals: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const now = Date.now();
        const targets = s.animals.filter((a) => a.hunger < 60);
        if (!targets.length) { sfx.error(); get().toast('Cả đàn đều no nê!'); return; }
        let feed = s.inv.feed || 0, pro = s.inv.feedPro || 0;
        let n = 0, proUsed = 0;
        const fedUids = new Set<number>();
        const boosted = new Set<number>();
        for (const a of targets) {
          const A = ANIMALS[a.type];
          if (!A) continue;
          if (feed > 0) feed--;
          else if (pro > 0) {
            pro--; proUsed++;
            if ((now - a.bornAt) / 1000 >= A.grow) boosted.add(a.uid);
          } else break;
          fedUids.add(a.uid);
          n++;
        }
        if (!n) { sfx.error(); get().toast('Hết thức ăn! Mua ở cửa hàng'); return; }
        const animals = s.animals.map((x) => {
          if (!fedUids.has(x.uid)) return x;
          const A = ANIMALS[x.type];
          const boost = boosted.has(x.uid) && A ? A.cycle * 0.5 : 0;
          return { ...x, hunger: 100, productT: x.productT + boost };
        });
        const inv = { ...s.inv, feed, feedPro: pro };
        set((st) => ({ animals, inv, stats: { ...st.stats, fed: st.stats.fed + n } }));
        sfx.eat();
        get().toast(n < targets.length ? `⚡ Cho ăn ${n}/${targets.length} con (hết thức ăn!)` : `⚡ Cả đàn ${n} con ăn no nê!`);
        get().addXP(4 * n); get().checkQuest();
        void proUsed;
      },

      bulkCollectAnimals: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const now = Date.now();
        const targets = s.animals.filter((a) => {
          const A = ANIMALS[a.type];
          return A && a.ready && (now - a.bornAt) / 1000 >= A.grow;
        });
        if (!targets.length) { sfx.error(); get().toast('Chưa có sản phẩm nào để thu!'); return; }
        const inv = { ...s.inv };
        const got = new Set<number>();
        let xp = 0;
        for (const a of targets) {
          const A = ANIMALS[a.type];
          if (!A) continue;
          inv[A.productId] = (inv[A.productId] || 0) + 1;
          xp += A.xp;
          got.add(a.uid);
        }
        const animals = s.animals.map((x) => (got.has(x.uid) ? { ...x, ready: false, productT: 0 } : x));
        set((st) => ({ animals, inv, stats: { ...st.stats, collectedAnimal: st.stats.collectedAnimal + got.size } }));
        sfx.harvest(); get().toast(`⚡ Thu ${got.size} sản phẩm chăn nuôi!`);
        get().addXP(xp); get().checkQuest();
      },

      bulkFeedFish: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const targets = s.fishes.filter((f) => !f.grown);
        if (!targets.length) { sfx.error(); get().toast('Cá đều đã lớn, thu hoạch thôi!'); return; }
        let feed = s.inv.feed || 0, pro = s.inv.feedPro || 0;
        const fishes = s.fishes.slice();
        let n = 0;
        for (const f of targets) {
          const idx = fishes.findIndex((x) => x.uid === f.uid);
          if (idx < 0) continue;
          const F = FISHES[f.type];
          if (!F) continue;
          let hunger = f.hunger, age = f.age, grown = f.grown;
          if (feed > 0) { feed--; hunger = Math.min(100, hunger + 45); }
          else if (pro > 0) {
            pro--; hunger = 100; age += F.grow * 0.25;
            if (age >= F.grow) { grown = true; get().toast(`${F.name} lớn vọt nhờ cám cao cấp!`); }
          } else break;
          fishes[idx] = { ...f, hunger, age, grown };
          n++;
        }
        if (!n) { sfx.error(); get().toast('Hết thức ăn! Mua ở cửa hàng'); return; }
        const inv = { ...s.inv, feed, feedPro: pro };
        set((st) => ({ fishes, inv, stats: { ...st.stats, fed: st.stats.fed + n } }));
        sfx.eat();
        get().toast(n < targets.length ? `⚡ Cho ${n}/${targets.length} con cá ăn (hết thức ăn!)` : `⚡ Cả đàn ${n} con cá ăn ngon lành!`);
        get().addXP(3 * n); get().checkQuest();
      },

      bulkHarvestFish: () => {
        const s = get();
        if (s.level < BULK_MIN_LEVEL) { sfx.error(); get().toast(bulkLockedMsg(s.level)); return; }
        const targets = s.fishes.filter((f) => f.grown);
        if (!targets.length) { sfx.error(); get().toast('Chưa có con cá nào lớn!'); return; }
        const inv = { ...s.inv };
        const got = new Set<number>();
        let xp = 0;
        for (const f of targets) {
          const F = FISHES[f.type];
          if (!F) continue;
          inv[f.type] = (inv[f.type] || 0) + 1;
          xp += F.xp;
          got.add(f.uid);
        }
        const fishes = s.fishes.filter((f) => !got.has(f.uid));
        set((st) => ({ fishes, inv, stats: { ...st.stats, harvested: st.stats.harvested + got.size, collectedAnimal: st.stats.collectedAnimal + got.size } }));
        sfx.harvest(); get().toast(`⚡ Thu hoạch ${got.size} con cá!`);
        get().addXP(xp); get().checkQuest();
      },

      interactPond: (uid) => {
        const s = get();
        if (uid == null) {
          // đứng gần ao: mở thả cá hoặc báo đầy
          if (s.fishes.length >= s.pondSlots) {
            sfx.error(); get().toast(`Ao đầy (${s.pondSlots}/${MAX_POND}) — mở rộng ở shop`);
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
          if (!feed) { sfx.error(); get().toast('Hết thức ăn! Mua ở cửa hàng'); return; }
          get().addInv(feed, -1);
          const F = FISHES[f.type];
          let { hunger, age } = f;
          let grown: boolean = f.grown;
          if (feed === 'feedPro') {
            hunger = 100; age += F.grow * 0.25;
            if (!f.grown && age >= F.grow) { grown = true; get().toast(`${F.name} lớn vọt nhờ cám cao cấp!`); }
          } else hunger = Math.min(100, hunger + 45);
          const fishes = s.fishes.slice(); fishes[idx] = { ...f, hunger, age, grown };
          set((st) => ({ fishes, stats: { ...st.stats, fed: st.stats.fed + 1 } }));
          sfx.eat(); get().toast(feed === 'feedPro' ? 'Cá khoái cám cao cấp!' : 'Cá ăn ngon lành!');
          get().addXP(3); get().checkQuest();
        } else {
          const F = FISHES[f.type];
          get().addInv(f.type, 1);
          const fishes = s.fishes.slice(); fishes.splice(idx, 1);
          set((st) => ({ fishes, stats: { ...st.stats, harvested: st.stats.harvested + 1, collectedAnimal: st.stats.collectedAnimal + 1 } }));
          sfx.harvest(); get().toast(`Thu hoạch +1 ${F.name}!`); get().addXP(F.xp); get().checkQuest();
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
        if (s.level < req) { sfx.error(); get().toast(`Cần đạt Lv${req} để mở thêm chỗ nuôi!`); return; }
        if (s.xu < cost) { sfx.error(); get().toast(`Cần ${cost} xu để mở thêm chỗ nuôi!`); return; }
        set({ pondSlots: k + 1, xu: s.xu - cost });
        sfx.coin(); get().toast(`Ao rộng thêm! Sức chứa ${k + 1}/${MAX_POND}`);
      },

      interactAnimal: (uid) => {
        const s = get();
        const a = s.animals.find((x) => x.uid === uid);
        if (!a) return;
        const A = ANIMALS[a.type];
        if (a.hunger < 60) {
          const feed = takeFeed(s);
          if (!feed) { sfx.error(); get().toast('Hết thức ăn! Mua ở cửa hàng'); return; }
          get().addInv(feed, -1);
          const adult = (Date.now() - a.bornAt) / 1000 >= A.grow;
          const boost = feed === 'feedPro' && adult ? A.cycle * 0.5 : 0;
          set((st) => ({
            animals: st.animals.map((x) => (x.uid === uid ? { ...x, hunger: 100, productT: x.productT + boost } : x)),
            stats: { ...st.stats, fed: st.stats.fed + 1 },
          }));
          sfx.eat();
          if (a.type === 'chicken' || a.type === 'duck' || a.type === 'cut' || a.type === 'bocau') sfx.cluck();
          if (a.type === 'cow' || a.type === 'sheep' || a.type === 'goat' || a.type === 'buffalo') sfx.moo();
          get().toast(feed === 'feedPro' ? `${A.name} khoái cám cao cấp, ra sản phẩm nhanh hơn!` : `${A.name} ăn no nê!`);
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
          sfx.harvest(); get().toast(`Thu được ${A.product}!`);
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
        if (s.level < req) { sfx.error(); get().toast(`Cần đạt Lv${req} để nới chuồng!`); return; }
        if (s.xu < cost) { sfx.error(); get().toast(`Cần ${cost} xu để nới chuồng!`); return; }
        set({ coopCap: { ...s.coopCap, [type]: next }, xu: s.xu - cost });
        sfx.coin(); get().toast(`Chuồng ${A.name} lên ${next}/${A.max} chỗ!`);
      },

      buySeed: (id) => {
        const c = CROPS[id]; const s = get();
        if (!c) return;
        if (s.level < c.lv) { sfx.error(); get().toast(`${c.name} cần đạt Lv${c.lv}!`); return; }
        if (s.xu < c.seedPrice) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set({ xu: s.xu - c.seedPrice }); get().addInv('seed:' + id, 1);
        sfx.coin(); get().toast(`Mua hạt ${c.name}!`);
      },
      buyFish: (id) => {
        const f = FISHES[id]; const s = get();
        if (!f) return;
        if (s.level < f.lv) { sfx.error(); get().toast(`${f.name} cần đạt Lv${f.lv}!`); return; }
        if (s.xu < f.babyPrice) { sfx.error(); get().toast('Không đủ xu!'); return; }
        // Mua là thả thẳng xuống ao nếu còn chỗ (giống mua vật nuôi là thấy ngay),
        // hết chỗ mới giữ cá con trong kho để thả sau.
        if (s.fishes.length < s.pondSlots) {
          const fishes = [...s.fishes, { uid: s.uidSeq, type: id, age: 0, grown: false, hunger: 80 }];
          set((st) => ({ xu: st.xu - f.babyPrice, fishes, uidSeq: st.uidSeq + 1, stats: { ...st.stats, stockedFish: st.stats.stockedFish + 1 } }));
          sfx.splash(); sfx.coin();
          get().toast(`Đã thả ${f.name} xuống ao! (${fishes.length}/${s.pondSlots})`);
          get().addXP(5); get().checkQuest();
        } else {
          set({ xu: s.xu - f.babyPrice }); get().addInv('babyfish:' + id, 1);
          sfx.coin(); get().toast(`Ao đầy! Giữ cá con ${f.name} trong kho — mở rộng ao rồi ra ao thả`);
        }
      },
      buyAnimal: (id) => {
        const a = ANIMALS[id]; const s = get();
        if (!a) return;
        if (s.level < a.lv) { sfx.error(); get().toast(`${a.name} cần đạt Lv${a.lv}! Trồng trọt lên cấp trước nhé`); return; }
        const cap = s.coopCap[id as AnimalType] ?? START_CAP;
        const count = s.animals.filter((x) => x.type === id).length;
        if (count >= cap) { sfx.error(); get().toast(`Chuồng ${a.name} đầy (${cap}/${a.max})! Nới chuồng ở shop`); return; }
        if (s.xu < a.babyPrice) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set((st) => ({
          xu: st.xu - a.babyPrice,
          animals: [...st.animals, { uid: st.uidSeq, type: a.id as AnimalType, bornAt: Date.now(), hunger: 90, productT: 0, ready: false }],
          uidSeq: st.uidSeq + 1,
          stats: { ...st.stats, boughtAnimal: st.stats.boughtAnimal + 1 },
        }));
        sfx.coin(); get().toast(`Mua ${a.name}! Cho ăn đều nhé`); get().checkQuest();
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
      buyPesticide: (n) => {
        const s = get();
        const cost = PEST_PRICE * n;
        if (s.xu < cost) { sfx.error(); get().toast('Không đủ xu!'); return; }
        set({ xu: s.xu - cost }); get().addInv('pesticide', n); sfx.coin();
        get().toast(`Mua ${n} thuốc trừ sâu!`);
      },
      exchangeGem: () => {
        const s = get();
        if (s.gem < 5) { sfx.error(); get().toast('Cần 5 gem!'); return; }
        set({ gem: s.gem - 5, xu: s.xu + 500 }); sfx.coin();
      },
      buyOutfit: (id) => {
        const s = get();
        const it = OUTFITS[id];
        if (!it) return;
        if (s.ownedOutfits.includes(id)) { get().wearOutfit(id); return; }
        const px = it.priceXu ?? 0, pg = it.priceGem ?? 0;
        if (s.xu < px) { sfx.error(); get().toast('Không đủ xu!'); return; }
        if (s.gem < pg) { sfx.error(); get().toast('Không đủ gem!'); return; }
        set({ xu: s.xu - px, gem: s.gem - pg, ownedOutfits: [...s.ownedOutfits, id] });
        sfx.coin(); get().toast(`Đã mua ${it.emoji} ${it.name}! Đồ đã cất vào Tủ đồ 🎒`);
        get().addXP(5);
        saveSoon();
      },
      wearOutfit: (id) => {
        const s = get();
        const it = OUTFITS[id];
        if (!it) return;
        if (!s.ownedOutfits.includes(id)) { sfx.error(); get().toast('Chưa sở hữu món này!'); return; }
        if (s.outfit[it.slot] === id) return;
        set({ outfit: { ...s.outfit, [it.slot]: id } });
        sfx.click();
        get().toast(`Đã mặc ${it.emoji} ${it.name}!`);
        saveSoon();
      },
      buyCar: (id) => {
        const s = get();
        const car = CARS[id];
        if (!car) return;
        if (s.ownedCars.includes(id)) { get().toast(`${car.emoji} ${car.name} đã có trong gara rồi!`); return; }
        if (s.level < (car.minLevel ?? 1)) { sfx.error(); get().toast(`🔒 ${car.name} mở bán từ Lv${car.minLevel}! Bạn đang Lv${s.level}`); return; }
        const px = car.priceXu ?? 0, pg = car.priceGem ?? 0;
        if (s.xu < px) { sfx.error(); get().toast('Không đủ xu rước xe!'); return; }
        if (s.gem < pg) { sfx.error(); get().toast('Không đủ gem rước xe!'); return; }
        set({ xu: s.xu - px, gem: s.gem - pg, ownedCars: [...s.ownedCars, id] });
        sfx.coin(); get().toast(`Đã mua ${car.emoji} ${car.name}! Xe cất trong gara 🚗`);
        get().addXP(20);
        saveSoon();
      },
      driveCar: (id) => {
        const s = get();
        if (id == null) {
          if (!s.activeCar) return;
          set({ activeCar: null });
          sfx.click(); get().toast('Đã xuống xe, đi bộ cho khỏe! 🚶');
          saveSoon();
          return;
        }
        const car = CARS[id];
        if (!car) return;
        if (!s.ownedCars.includes(id)) { sfx.error(); get().toast('Chưa sở hữu xe này!'); return; }
        if (s.fishingSpot) { sfx.error(); get().toast('Đang câu cá, thu cần rồi hẵng lái!'); return; }
        if (s.activeCar === id) return;
        set({ activeCar: id });
        sfx.click(); get().toast(`Lên xe ${car.emoji} ${car.name}! Chạy nhanh gấp ${(car.speed / 260).toFixed(1)} lần đi bộ`);
        saveSoon();
      },
      setQuality: (q) => {
        // chọn tay = tắt Auto để giữ đúng ý người chơi
        set({ quality: q, autoQuality: false });
        sfx.click();
        get().toast(q === 'high' ? 'Đồ họa: Cao (lung linh nhất)' : q === 'medium' ? 'Đồ họa: Trung bình' : 'Đồ họa: Thấp (mượt nhất)');
      },
      setAutoQuality: (v) => {
        set({ autoQuality: v });
        sfx.click();
        get().toast(v ? 'Đồ họa: Tự động (game tự chỉnh theo FPS)' : 'Đã tắt Tự động — giữ mức tay đang chọn');
      },
      setAutoLevel: (q) => {
        if (get().autoLevel !== q) set({ autoLevel: q });
      },
      setResMode: (m) => {
        set({ resMode: m });
        sfx.click();
        get().toast(m === 'low' ? 'Độ phân giải: Siêu nhẹ 50% (mượt nhất, hơi mờ)' : m === 'med' ? 'Độ phân giải: Nhẹ 75%' : m === 'full' ? 'Độ phân giải: Chuẩn 100% (nét nhất)' : 'Độ phân giải: Tự động theo cấp đồ họa');
      },
      setViewH: (h) => set({ viewH: clampViewH(h) }),
      setThiefBite: () => set({ thiefBiteUntil: Date.now() + 2500 }),
      summonKem: () => {
        if (get().kem) return false; // đã có Kem rồi → không gì xảy ra
        set({ kem: true });
        return true;
      },
      petPet: (uid) => {
        if (uid === KEM_UID) {
          // Kem — mèo cam đi theo chủ: vuốt ve được y như pet farm
          if (!get().kem) return;
          set({ petFx: { uid, at: Date.now() } });
          sfx.pet();
          get().toast('Kem lim dim mắt: Meo~ thích quá 🐱');
          get().addXP(2);
          return;
        }
        const pet = PETS.find((p) => p.uid === uid);
        if (!pet) return;
        set({ petFx: { uid, at: Date.now() } });
        if (pet.kind === 'dog') { sfx.bark(); get().toast(`${pet.name} thích lắm! Gâu gâu! đuôi vẫy tít 🐶`); }
        else { sfx.pet(); get().toast(`${pet.name} lim dim mắt: Meo~ thích quá 🐱`); }
        get().addXP(2);
      },
      applyVictimSteal: (plot, crop) => {
        const s = get();
        const pl = s.plots[plot];
        if (!pl || pl.locked || pl.state !== 'ready' || pl.crop !== crop) return false;
        const plots = s.plots.slice();
        plots[plot] = { ...pl, state: 'soil', crop: null, progress: 0, watered: false, waterLeft: 0, pest: false };
        set({ plots });
        return true;
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
      sellAnimal: (uid) => {
        const s = get();
        const a = s.animals.find((x) => x.uid === uid);
        if (!a) return;
        const A = ANIMALS[a.type];
        const adult = (Date.now() - a.bornAt) / 1000 >= A.grow;
        if (!adult) { sfx.error(); get().toast(`${A.name} còn non, nuôi lớn rồi hẵng bán!`); return; }
        const price = animalSellPrice(a.type);
        set((st) => ({ animals: st.animals.filter((x) => x.uid !== uid) }));
        get().addXu(price);
        sfx.coin(); get().toast(`Bán ${A.name} +${price} xu!`);
        get().addXP(10); get().checkQuest();
      },
      sellFish: (uid) => {
        const s = get();
        const f = s.fishes.find((x) => x.uid === uid);
        if (!f) return;
        if (!f.grown) { sfx.error(); get().toast('Cá còn nhỏ, nuôi lớn rồi hẵng bán!'); return; }
        const F = FISHES[f.type];
        const fishes = s.fishes.slice().filter((x) => x.uid !== uid);
        set({ fishes });
        get().addXu(F.sell);
        sfx.coin(); get().toast(`Bán ${F.name} +${F.sell} xu!`);
        get().addXP(8); get().checkQuest();
      },

      startRiverFishing: (pier, baitId, at) => {
        const s = get();
        if ((s.inv[baitId] || 0) <= 0) { sfx.error(); get().toast('Hết mồi! Mua ở cửa hàng'); return; }
        const inMall = at === 'mall' || pier >= 100;
        const p = inMall ? MALL_PIERS[pier >= 100 ? pier - 100 : pier] : PIERS[pier];
        if (!p) return;
        const wait = BITE_MIN * 1000 + Math.random() * (BITE_MAX - BITE_MIN) * 1000;
        const biteAt = Date.now() + wait;
        // Roll sẵn con cá sẽ cắn + sinh dãy mũi tên theo giá trị của nó.
        // Cá giá trị càng lớn → dãy càng dài (3–8 phím), phải bấm đúng trong 3s.
        const premium = baitId === 'baitPro';
        const pending = rollRiverCatch(s.level, premium);
        const combo = genBiteCombo(sellPrice(pending));
        set({
          fishingSpot: { pier, x: p.x, y: p.sitY, bx: p.x + 14, by: p.bobY, at: inMall ? 'mall' : 'farm' },
          biteAt, biteUntil: biteAt + BITE_WINDOW * 1000,
          fishingBait: baitId, modal: null,
          biteCatchId: pending, biteCombo: combo, biteProgress: 0,
          catchPop: null,
        });
        sfx.splash(); get().toast('Đã thả cần… đợi cá cắn câu! (E: thu cần)');
      },
      reelRiver: () => {
        const s = get();
        if (!s.fishingSpot) return;
        const now = Date.now();
        const biting = s.biteAt != null && s.biteUntil != null && now >= s.biteAt && now <= s.biteUntil;
        if (biting) {
          // Đang cắn câu: E không giật được nữa — phải bấm dãy mũi tên.
          sfx.error();
          get().toast('Cá cắn câu! Bấm phím mũi tên theo thứ tự trên màn hình!');
          return;
        }
        if (s.biteUntil != null && now > s.biteUntil) {
          set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0 });
          sfx.splash(); get().toast('Chậm tay quá, cá chạy mất!');
        } else {
          set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0 });
          sfx.click(); get().toast('Thu cần về.');
        }
      },
      pressBiteKey: (dir) => {
        const s = get();
        if (!s.fishingSpot) return;
        const now = Date.now();
        const biting = s.biteAt != null && s.biteUntil != null && now >= s.biteAt && now <= s.biteUntil;
        if (!biting || !s.biteCombo || !s.biteCatchId) return;
        const expected = s.biteCombo[s.biteProgress];
        if (dir !== expected) {
          // Bấm sai 1 phím → sảy cá (không tốn mồi)
          set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0 });
          sfx.splash(); get().toast('Bấm sai phím! Cá chạy mất!');
          return;
        }
        const next = s.biteProgress + 1;
        if (next >= s.biteCombo.length) {
          // Hoàn thành dãy trong 3s → DÍNH!
          const baitId = s.fishingBait ?? 'bait';
          if ((s.inv[baitId] || 0) <= 0) { sfx.error(); get().toast('Hết mồi rồi!'); set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0 }); return; }
          get().addInv(baitId, -1);
          const id = s.biteCatchId;
          const nm = id === 'ung' ? 'Ủng cũ' : id === 'rong' ? 'Rong biển' : `${FISHES[id].name}`;
          get().addInv(id, 1);
          const xp = FISHES[id] ? FISHES[id].xp : 2;
          const bx = s.fishingSpot?.bx ?? 0;
          const by = s.fishingSpot?.by ?? 0;
          set((st) => ({
            fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null,
            biteCatchId: null, biteCombo: null, biteProgress: 0,
            // cá giãy trên dây 2.5s ở ngay chỗ phao vừa giật
            catchPop: { x: bx, y: by, fishId: id, label: nm, until: Date.now() + 2500 },
            stats: { ...st.stats, fished: st.stats.fished + 1 },
          }));
          sfx.catch_(); sfx.coin();
          get().toast(`Giật dính ${nm}!`);
          // đang thi câu cá thị trấn → tự báo điểm cho cả làng
          try { reportContestCatch(id); } catch { /* ignore */ }
          get().addXP(xp); get().checkQuest();
        } else {
          set({ biteProgress: next });
          sfx.click();
        }
      },
      cancelRiver: (silent) => {
        set({ fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0 });
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
          setTimeout(((qq) => () => get().toast(`Xong NV: ${qq.text}`))(q), 50);
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
          weather: 'sunny', weatherLeft: 90,
          inv: { 'seed:lua': 3, feed: 3, bait: 3 },
          plots: freshPlots(), pondSlots: START_POND, fishes: [], animals: [],
          coopCap: freshCap(),
          stats: freshStats(), questIdx: 0, uidSeq: 1,
          redeemedCodes: [],
          outfit: { ...DEFAULT_OUTFIT }, ownedOutfits: Object.values(DEFAULT_OUTFIT),
          ownedCars: [], activeCar: null,
          quality: 'high', autoQuality: true, autoLevel: 'medium', resMode: 'auto', kem: false,
          modal: null, fishingSpot: null, biteAt: null, biteUntil: null, fishingBait: null, biteCatchId: null, biteCombo: null, biteProgress: 0, catchPop: null, petFx: null, plotFx: [], toasts: [], scene: 'farm',
          interiorId: null, inAct: null, baLove: 0, loveClaim: [], fundTotal: 0, fundClaim: [],
          daily: { day: 1, flags: {}, cats: [], quests: [] },
          junkAt: 0, speedUntil: null, stageColor: '#ffd24d',
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
        weather: s.weather, weatherLeft: s.weatherLeft,
        inv: s.inv, plots: s.plots, pondSlots: s.pondSlots, fishes: s.fishes, animals: s.animals,
        coopCap: s.coopCap,
        stats: s.stats, questIdx: s.questIdx, uidSeq: s.uidSeq,
        redeemedCodes: s.redeemedCodes,
        baLove: s.baLove, loveClaim: s.loveClaim, fundTotal: s.fundTotal, fundClaim: s.fundClaim,
        daily: s.daily, junkAt: s.junkAt,
        outfit: s.outfit, ownedOutfits: s.ownedOutfits,
        ownedCars: s.ownedCars, activeCar: s.activeCar,
        quality: s.quality, autoQuality: s.autoQuality, resMode: s.resMode, viewH: s.viewH, kem: s.kem,
        stageColor: s.stageColor,
      }),
    }
  )
);
