// ===== Core domain types — dễ mở rộng thêm cây/cá/vật nuôi mới =====
export type PlotState = 'grass' | 'soil' | 'growing' | 'ready';

/** Thời tiết farm: nắng / mưa / tuyết (đổi tự động theo thời gian trong game) */
export type WeatherKind = 'sunny' | 'rain' | 'snow';

export interface Plot {
  state: PlotState;
  crop: string | null; // crop id
  progress: number; // 0..1
  watered: boolean;
  waterLeft: number; // giây còn ướt
  locked: boolean; // chưa mở khóa (mua bằng xu + cấp)
}

export type AnimalType = 'chicken' | 'duck' | 'cow' | 'pig' | 'sheep';

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
export interface CoopCap {
  chicken: number; duck: number; cow: number; pig: number; sheep: number;
}

export interface Stats {
  hoed: number; planted: number; watered: number; harvested: number;
  boughtAnimal: number; fed: number; collectedAnimal: number;
  stockedFish: number; earned: number; fished: number;
}

export type ModalKind =
  | null
  | 'shop' | 'bag' | 'quest' | 'help' | 'village' | 'townChat' | 'townEmote' | 'casino'
  | { name: 'seed'; plot: number }
  | { name: 'stock' }
  | { name: 'bait'; pier: number }
  | { name: 'pen'; pen: 'pond' | 'coop' | 'barn' };

export type ShopTab = 'seed' | 'fish' | 'animal' | 'food' | 'sell';

/** Bản đồ đang đứng: farm riêng hay thị trấn chung */
export type SceneKind = 'farm' | 'town';

/** Cảm xúc / hành động realtime ở công viên */
export type TownEmote = 'wave' | 'dance' | 'sit' | 'laugh' | 'heart' | 'sleep' | 'angry' | 'clap';

export interface InteractTarget {
  kind: 'plot' | 'pond' | 'river' | 'pen' | 'animal' | 'shop' | 'townGate' | 'farmGate' | 'townProp';
  index?: number; // plot index / pier index
  uid?: number; // animal uid / fish uid
  pen?: 'pond' | 'coop' | 'barn';
  propId?: string; // townProp: fountain | board | hall | cafe | shop | sakura...
  label: string;
}
