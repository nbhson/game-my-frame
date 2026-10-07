// ===== Core domain types — dễ mở rộng thêm cây/cá/vật nuôi mới =====
export type PlotState = 'grass' | 'soil' | 'growing' | 'ready';

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
  | 'shop' | 'bag' | 'quest' | 'help' | 'village'
  | { name: 'seed'; plot: number }
  | { name: 'stock' }
  | { name: 'bait'; pier: number }
  | { name: 'pen'; pen: 'pond' | 'coop' | 'barn' };

export type ShopTab = 'seed' | 'fish' | 'animal' | 'food' | 'sell';

export interface InteractTarget {
  kind: 'plot' | 'pond' | 'river' | 'pen' | 'animal' | 'shop';
  index?: number; // plot index / pier index
  uid?: number; // animal uid / fish uid
  pen?: 'pond' | 'coop' | 'barn';
  label: string;
}
