// ===== Core domain types — dễ mở rộng thêm cây/cá/vật nuôi mới =====
export type PlotState = 'grass' | 'soil' | 'growing' | 'ready';

/** Cấp đồ họa: cao (đủ hiệu ứng) / trung bình / thấp (máy yếu) */
export type GraphicsQuality = 'high' | 'medium' | 'low';

/** Độ phân giải render: auto (theo cấp đồ họa) / full 100% / balanced 75% / potato 50% */
export type ResMode = 'auto' | 'full' | 'med' | 'low';

/** Thời tiết farm: nắng / mưa / tuyết (đổi tự động theo thời gian trong game) */
export type WeatherKind = 'sunny' | 'rain' | 'snow';

export interface Plot {
  state: PlotState;
  crop: string | null; // crop id
  progress: number; // 0..1
  watered: boolean;
  waterLeft: number; // giây còn ướt
  locked: boolean; // chưa mở khóa (mua bằng xu + cấp)
  pest: boolean; // đang bị sâu (ngừng lớn cho tới khi phun thuốc)
}

export type AnimalType = 'chicken' | 'duck' | 'cow' | 'pig' | 'sheep'
  | 'goat' | 'buffalo' | 'rabbit' | 'goose' | 'ong' | 'bocau' | 'cut';

export interface PondFish {
  uid: number;
  type: string;
  age: number; // giây đã lớn
  grown: boolean;
  hunger: number; // 0..100
}

export interface Animal {
  uid: number;
  type: AnimalType;
  bornAt: number; // epoch ms
  hunger: number;
  productT: number;
  ready: boolean;
}

/** Sức chứa mỗi chuồng (mở rộng dần, tối đa theo MAX_CAP) */
export type CoopCap = Record<AnimalType, number>;

export interface Stats {
  hoed: number; planted: number; watered: number; harvested: number;
  boughtAnimal: number; fed: number; collectedAnimal: number;
  stockedFish: number; earned: number; fished: number;
}

export type ModalKind =
  | null
  | 'shop' | 'bag' | 'quest' | 'help' | 'village' | 'townChat' | 'townEmote' | 'casino' | 'gift' | 'outfit' | 'settings' | 'lottery' | 'carshop' | 'race'
  | { name: 'seed'; plot: number }
  | { name: 'stock' }
  | { name: 'bait'; pier: number }
  | { name: 'house'; house: string }
  | { name: 'pen'; pen: 'pond' | 'coop' | 'barn' }
  | { name: 'bulk' }
  | { name: 'wolf' };

export type ShopTab = 'seed' | 'fish' | 'animal' | 'food' | 'sell';

/** Bản đồ đang đứng: farm riêng, thị trấn chung, khu mua sắm & giải trí, hay trong nhà */
export type SceneKind = 'farm' | 'town' | 'mall' | 'interior';

/** Hành động đang mở trong nhà (overlay, không phải modal popup toàn màn hình) */
export interface InActItem { id: string; label: string; desc: string; disabled?: boolean; tag?: string }
export interface InActChoice { label: string; run: string }
export interface InAct {
  mode: 'timing' | 'hold' | 'dialog' | 'list';
  furn: string; title: string; sub?: string;
  /** dữ liệu kèm (vd món đang nấu, npc đang nói) */
  payload?: string;
  /** rhythm: gõ đúng nhịp N nốt (đàn/sân khấu) */
  rhythm?: { total: number; done: number; score: number };
  dialog?: { npc: string; lines: string[]; choices: InActChoice[] };
  /** list: chọn 1 món để làm (nấu/chế/quyên góp/tặng/nhận quest) */
  list?: { items: InActItem[]; action: string };
  holdSecs?: number;
}
export interface DailyQuestState { id: string; from: number; done: boolean; claimed: boolean }
export interface DailyState { day: number; flags: Record<string, boolean>; cats: string[]; quests: DailyQuestState[] }

/** Cảm xúc / hành động realtime ở thị trấn */
export type TownEmote = 'wave' | 'dance' | 'sit' | 'laugh' | 'heart' | 'sleep' | 'angry' | 'clap'
  | 'hun' | 'hug' | 'fight' | 'tease' | 'handshake';

export interface InteractTarget {
  kind: 'plot' | 'pond' | 'river' | 'pen' | 'animal' | 'shop' | 'townGate' | 'farmGate' | 'mallGate' | 'townProp' | 'steal' | 'pet' | 'interior';
  index?: number; // plot index / pier index
  uid?: number; // animal uid / fish uid / pet uid
  pen?: 'pond' | 'coop' | 'barn';
  propId?: string; // townProp: fountain | board | hall | cafe | shop | sakura...; interior: furnId | npc:* | door
  label: string;
}
