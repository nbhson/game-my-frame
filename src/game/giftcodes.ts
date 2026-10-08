// ===== Giftcode: nhập code nhận quà (mỗi code 1 lần / farm) =====
// Code so khớp không phân biệt hoa/thường, có dấu cách thừa.
import { CROPS, FISHES } from './data';

export interface GiftReward {
  xu: number;
  gem: number;
  /** pid vật phẩm -> số lượng (vd 'seed:lua', 'feed', 'baitPro', 'babyfish:cakoi') */
  items: Record<string, number>;
  /** tên hiển thị + mô tả ngắn (dùng cho modal) */
  title: string;
  desc: string;
}

/** Chuẩn hóa code người dùng nhập */
export function normalizeCode(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

/** Quà code đặc biệt: mỗi vật phẩm trong game x100 (mọi thứ có trong bảng giá bán + hạt/cá con) */
function allItems100(): Record<string, number> {
  const items: Record<string, number> = {};
  // hạt giống + nông sản thu hoạch
  for (const id of Object.keys(CROPS)) {
    items['seed:' + id] = 100;
    items[id] = 100;
  }
  // cá con + cá (ao + sông)
  for (const id of Object.keys(FISHES)) {
    items['babyfish:' + id] = 100;
    items[id] = 100;
  }
  // cám, mồi, thuốc sâu
  items['feed'] = 100;
  items['feedPro'] = 100;
  items['bait'] = 100;
  items['baitPro'] = 100;
  items['pesticide'] = 100;
  // sản phẩm chăn nuôi + đồ câu được ở sông
  for (const pid of ['trung', 'trungvit', 'sua', 'thit', 'len', 'ung', 'rong']) items[pid] = 100;
  return items;
}

/** Quà farmpromax: 10000 xu + 200 gem + 25 mồi thường + 15 cho mọi vật phẩm còn lại */
function promaxItems(): Record<string, number> {
  const items: Record<string, number> = {};
  // 25 mồi câu cá (mồi thường)
  items['bait'] = 25;
  // 15 cho tất cả vật phẩm còn lại có thể mua/cất kho:
  // - toàn bộ hạt giống
  for (const id of Object.keys(CROPS)) items['seed:' + id] = 15;
  // - toàn bộ cá con
  for (const id of Object.keys(FISHES)) items['babyfish:' + id] = 15;
  // - cám, mồi xịn, thuốc sâu
  items['feed'] = 15;
  items['feedPro'] = 15;
  items['baitPro'] = 15;
  items['pesticide'] = 15;
  return items;
}

export const GIFTCODES: Record<string, GiftReward> = {
  farmtanthu: {
    xu: 1000,
    gem: 5,
    items: { 'seed:lua': 5, feed: 5, bait: 5 },
    title: 'Quà tân thủ',
    desc: 'Khởi đầu thuận lợi: phân + mồi + hạt lúa',
  },
  farm111: {
    xu: 2000,
    gem: 10,
    items: { bait: 10, feed: 5, pesticide: 3, 'seed:carot': 5 },
    title: 'Quà 111',
    desc: 'Thêm vốn + thuốc sâu + hạt cà rốt',
  },
  farmvip: {
    xu: 5000,
    gem: 50,
    items: { feedPro: 10, baitPro: 10, pesticide: 10, 'seed:dautay': 5, 'babyfish:cakoi': 2 },
    title: 'Quà VIP',
    desc: 'Cám + mồi xịn, thuốc sâu, hạt dâu, cá Koi',
  },
  farmpromax: {
    xu: 10000,
    gem: 200,
    items: promaxItems(),
    title: 'Quà PROMAX',
    desc: '10000 xu + 200 gem + 25 mồi + 15 mọi vật phẩm còn lại',
  },
  sondepchainhatduchu: {
    xu: 100000,
    gem: 10000,
    items: allItems100(),
    title: 'Quà đặc biệt',
    desc: '100000 xu + 10000 gem + 100 mỗi vật phẩm',
  },
};

/** Tóm tắt quà để toast/modal (vd "+10000 xu, +200 gem, +25 Mồi thường...") */
export function rewardSummary(r: GiftReward, maxItems = 4): string {
  const parts: string[] = [];
  if (r.xu) parts.push(`+${r.xu.toLocaleString('vi-VN')} xu`);
  if (r.gem) parts.push(`+${r.gem} gem`);
  const keys = Object.keys(r.items);
  const shown = keys.slice(0, maxItems);
  for (const k of shown) parts.push(`+${r.items[k]} ${shortItemName(k)}`);
  if (keys.length > maxItems) parts.push(`+${keys.length - maxItems} loại nữa`);
  return parts.join(', ');
}

function shortItemName(pid: string): string {
  if (pid.startsWith('seed:')) return 'hạt';
  if (pid.startsWith('babyfish:')) return 'cá con';
  if (pid === 'feed') return 'cám';
  if (pid === 'feedPro') return 'cám xịn';
  if (pid === 'bait') return 'mồi';
  if (pid === 'baitPro') return 'mồi ngon';
  if (pid === 'pesticide') return 'thuốc sâu';
  return pid;
}
