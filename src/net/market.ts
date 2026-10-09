// ===== CHỢ ĐÊM CUỐI TUẦN (map thị trấn) =====
// Họp tối T7–CN 18h–24h (giờ thật). Mỗi người dựng 1 sạp ở 1 trong 8 ô,
// bày nông sản + giá tự đặt. Người khác đi ngang bấm E mua trực tiếp,
// hoặc bấm "Trả giá" → chủ sạp lắc dice tự động: 5-6 đồng ý, 3-4 trả giá
// giữa, 1-2 từ chối. Chủ sạp là trọng tài của sạp mình (mẫu ma sói):
// ai tới trước mua trước, hết hàng người sau nhận NOPE.
// Khách NPC đi chợ (local) thỉnh thoảng mua ủng hộ sạp của chính mình.
import { create } from 'zustand';
import { gameMe, markSeen, onGameMsg, sendGameMsg } from './village';
import { useGame } from '../game/store';
import { itemName, sellPrice } from '../game/data';
import { NIGHT_MARKET, marketSlotPos } from '../game/town';
import { sfx } from '../game/audio';

const MK = '🏪MK|';
const seen = new Set<string>();
const STALL_KEY = 'nongtrai-stall';
const STALL_TTL = 20000;
const RESEND_MS = 5000;

export const MARKET_SLOTS = 8;
/** tọa độ 8 ô sạp (2 hàng x 4 cột) trong bãi chợ */
export function slotPos(i: number): { x: number; y: number } {
  return marketSlotPos(i);
}

export interface StallInfo {
  seller: string;
  slot: number;
  pid: string;
  price: number;
  qty: number;
  haggle: boolean;
  updatedAt: number;
}

export interface CrowdNpc {
  x: number; y: number; dir: 1 | -1; moving: boolean;
  name: string; bubble: string;
}

type HagStatus = 'idle' | 'waiting' | 'counter' | 'done' | 'declined' | 'timeout';

interface MarketState {
  stalls: Record<string, StallInfo>;
  own: { slot: number; pid: string; price: number; qty: number; haggle: boolean } | null;
  buyTarget: string | null;
  hag: { status: HagStatus; seller: string; qty: number; offer: number; until: number };
  crowd: CrowdNpc[];
  announced: boolean;
  setBuyTarget: (s: string | null) => void;
  openStall: (pid: string, price: number, qty: number, haggle: boolean) => void;
  updateOwn: (price: number, qty: number, haggle: boolean) => void;
  closeStall: () => void;
  buy: (seller: string, qty: number) => void;
  offerHag: (seller: string, qty: number, offer: number) => void;
  confirmCounter: () => void;
  cancelHag: () => void;
  tick: (now: number) => void;
}

const clean = (s: string) => s.replace(/[|]/g, '').trim();

function loadOwn(): { slot: number; pid: string; price: number; haggle: boolean } | null {
  try {
    const o = JSON.parse(localStorage.getItem(STALL_KEY) ?? 'null');
    if (o && typeof o.pid === 'string' && typeof o.price === 'number') return o;
  } catch { /* ignore */ }
  return null;
}

/** setup sạp đã lưu (để nút "Dựng lại sạp cũ" trong modal) */
export function loadSavedStall(): { slot: number; pid: string; price: number; haggle: boolean } | null {
  return loadOwn();
}

/** giờ họp chợ: tối T7 + CN, 18h–24h (giờ thật) */
export function isMarketOpen(d = new Date()): boolean {
  const day = d.getDay();
  return (day === 0 || day === 6) && d.getHours() >= 18;
}

const DAY_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
/** nhãn trạng thái chợ + giờ mở kế tiếp */
export function marketStatus(d = new Date()): { open: boolean; label: string } {
  if (isMarketOpen(d)) return { open: true, label: 'ĐANG MỞ 🌙 (đến 24h)' };
  for (let i = 0; i < 8; i++) {
    const c = new Date(d);
    c.setDate(d.getDate() + i);
    c.setHours(18, 0, 0, 0);
    const dw = c.getDay();
    if ((dw === 0 || dw === 6) && c.getTime() > d.getTime()) {
      const ms = c.getTime() - d.getTime();
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      const when = h >= 24 ? `${DAY_VN[dw]} 18:00` : `18:00 hôm nay`;
      return { open: false, label: `mở ${when} (còn ${h}h${m}p)` };
    }
  }
  return { open: false, label: 'mở 18:00 cuối tuần' };
}

/** ô hiển thị thực tế: 2 người giành 1 ô thì tên nhỏ hơn giữ, người thua dạt ô trống kế tiếp (quy tắc giống nhau mọi máy) */
export function displaySlot(stalls: Record<string, StallInfo>, seller: string): number {
  const mine = stalls[seller];
  if (!mine) return 0;
  const groups = new Map<number, string[]>();
  for (const s of Object.values(stalls)) {
    const arr = groups.get(s.slot) ?? [];
    arr.push(s.seller);
    groups.set(s.slot, arr);
  }
  const taken = new Set<number>();
  const losers: string[] = [];
  for (const slot of [...groups.keys()].sort((a, b) => a - b)) {
    const names = (groups.get(slot) ?? []).sort();
    taken.add(slot); // ô thuộc về người thắng (tên nhỏ nhất)
    losers.push(...names.slice(1));
  }
  losers.sort();
  const fallback = new Map<string, number>();
  for (const l of losers) {
    for (let i = 0; i < MARKET_SLOTS; i++) {
      if (!taken.has(i)) { fallback.set(l, i); taken.add(i); break; }
    }
  }
  return fallback.get(seller) ?? mine.slot;
}

/** sạp gần nhất trong tầm với (để bấm E) */
export function nearestStall(px: number, py: number): { seller: string; d: number } | null {
  const stalls = useMarket.getState().stalls;
  let best: { seller: string; d: number } | null = null;
  for (const seller of Object.keys(stalls)) {
    const p = slotPos(displaySlot(stalls, seller));
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < 110 && (!best || d < best.d)) best = { seller, d };
  }
  return best;
}

/** gợi ý giá bán = giá shop thu mua */
export function suggestPrice(pid: string): number {
  return Math.max(1, sellPrice(pid));
}

let lastResend = 0;
let nextNpcBuy = 0;
/** chủ sạp chốt kèo trả giá đang chờ (buyer → {qty, total, hạn}) */
const pendingCounter: Record<string, { qty: number; total: number; until: number }> = {};

function broadcastOwn() {
  const { own } = useMarket.getState();
  if (!own) return;
  const me = gameMe().name;
  sendGameMsg(`${MK}STALL|${me}|${own.slot}|${clean(own.pid)}|${own.price}|${own.qty}|${own.haggle ? 1 : 0}`);
}

function execSale(buyer: string, pid: string, qty: number, total: number) {
  // chạy trên máy CHỦ SẠP: trừ hàng + cộng xu + báo cả làng
  const st = useMarket.getState();
  const own = st.own;
  if (!own) return;
  useMarket.setState({ own: { ...own, qty: own.qty - qty } });
  useGame.getState().addXu(total);
  const [nm] = itemName(pid);
  useGame.getState().toast(`💰 Bán ${qty} ${nm} cho ${buyer} +${total} xu!`);
  sfx.coin();
  sendGameMsg(`${MK}SOLD|${gameMe().name}|${clean(buyer)}|${clean(pid)}|${qty}|${total}`);
  broadcastOwn();
}

function applyBought(pid: string, qty: number, total: number, seller: string) {
  // chạy trên máy NGƯỜI MUA (nhận SOLD/HAGOK)
  const g = useGame.getState();
  g.addInv(pid, qty);
  g.addXu(-total);
  const [nm] = itemName(pid);
  g.toast(`🛍️ Mua ${qty} ${nm} của ${seller} −${total} xu!`);
  sfx.coin();
}

function handleMsg(m: { id: string; fromName: string; text: string }) {
  if (!markSeen(seen, m.id)) return;
  const parts = m.text.slice(MK.length).split('|');
  const kind = parts[0];
  const me = gameMe().name;
  const now = Date.now();

  if (kind === 'STALL') {
    const [, seller, slot, pid, price, qty, hag] = parts;
    if (!seller || !pid) return;
    useMarket.setState((s) => ({
      stalls: {
        ...s.stalls,
        [seller]: {
          seller, slot: Math.max(0, Math.min(MARKET_SLOTS - 1, +slot || 0)),
          pid: clean(pid), price: Math.max(1, +price || 1), qty: Math.max(0, +qty || 0),
          haggle: hag === '1', updatedAt: now,
        },
      },
    }));
    return;
  }
  if (kind === 'UNSTALL') {
    const [, seller] = parts;
    if (!seller || seller === me) return;
    useMarket.setState((s) => {
      const stalls = { ...s.stalls };
      delete stalls[seller];
      return { stalls };
    });
    return;
  }
  if (kind === 'BUY') {
    // chỉ chủ sạp xử lý
    const [, seller, buyer, qtyRaw] = parts;
    if (seller !== me || !buyer) return;
    const qty = Math.max(1, +qtyRaw || 1);
    const own = useMarket.getState().own;
    if (!own || own.qty < qty) {
      sendGameMsg(`${MK}NOPE|${me}|${clean(buyer)}|hết hàng`);
      return;
    }
    execSale(buyer, own.pid, qty, own.price * qty);
    return;
  }
  if (kind === 'SOLD') {
    const [, , buyer, pid, qty, total] = parts;
    if (buyer !== me) return;
    applyBought(pid, +qty || 0, +total || 0, parts[1]);
    useMarket.setState((s) => (s.hag.status === 'waiting' ? { hag: { ...s.hag, status: 'done' } } : s));
    return;
  }
  if (kind === 'NOPE') {
    const [, , buyer, reason] = parts;
    if (buyer !== me) return;
    useGame.getState().toast(`😅 ${parts[1]}: ${reason || 'không bán được'}!`);
    sfx.error();
    return;
  }
  if (kind === 'HAG') {
    // chỉ chủ sạp lắc dice
    const [, seller, buyer, qtyRaw, offerRaw] = parts;
    if (seller !== me || !buyer) return;
    const qty = Math.max(1, +qtyRaw || 1);
    const offer = Math.max(0, +offerRaw || 0);
    const own = useMarket.getState().own;
    const ask = (own?.price ?? 0) * qty;
    const decline = (why: string) => sendGameMsg(`${MK}HAGNO|${me}|${clean(buyer)}|${why}`);
    if (!own || own.qty < qty) { decline('hết hàng'); return; }
    if (!own.haggle) { decline('sạp này không trả giá'); return; }
    if (offer < Math.ceil(ask / 2)) { decline('trả rẻ quá!'); return; }
    const roll = 1 + Math.floor(Math.random() * 6);
    const [nm] = itemName(own.pid);
    if (roll >= 5) {
      useGame.getState().toast(`🎲 Dice ${roll}: chốt ${offer} xu cho ${qty} ${nm}!`);
      execSale(buyer, own.pid, qty, offer);
    } else if (roll >= 3) {
      const mid = Math.round((ask + offer) / 2);
      pendingCounter[buyer] = { qty, total: mid, until: now + 60000 };
      useGame.getState().toast(`🎲 Dice ${roll}: trả giá giữa ${mid} xu, chờ ${buyer} chốt…`);
      sendGameMsg(`${MK}HAGCT|${me}|${clean(buyer)}|${qty}|${mid}|${roll}`);
    } else {
      useGame.getState().toast(`🎲 Dice ${roll}: không bớt được!`);
      decline(`dice ra ${roll}, chủ sạp lắc đầu`);
    }
    return;
  }
  if (kind === 'HAGOK') {
    const [, , buyer, pid, qty, total] = parts;
    if (buyer !== me) return;
    applyBought(pid, +qty || 0, +total || 0, parts[1]);
    useMarket.setState({ hag: { status: 'done', seller: parts[1], qty: +qty || 0, offer: +total || 0, until: 0 } });
    return;
  }
  if (kind === 'HAGCT') {
    const [, seller, buyer, qty, total, roll] = parts;
    if (buyer !== me) return;
    useMarket.setState({
      hag: { status: 'counter', seller, qty: +qty || 0, offer: +total || 0, until: now + 60000 },
    });
    useGame.getState().toast(`🎲 Dice ${roll}: ${seller} gạ ${total} xu — chốt không?`);
    return;
  }
  if (kind === 'HAGNO') {
    const [, seller, buyer, why] = parts;
    if (buyer !== me) return;
    useMarket.setState((s) => (s.hag.status === 'waiting'
      ? { hag: { status: 'declined', seller, qty: 0, offer: 0, until: 0 } } : s));
    useGame.getState().toast(`😅 ${seller} không bớt: ${why || ''}`);
    return;
  }
  if (kind === 'HAGYES') {
    // người mua chốt giá giữa → chủ sạp thực hiện
    const [, seller, buyer, qtyRaw, totalRaw] = parts;
    if (seller !== me || !buyer) return;
    const qty = +qtyRaw || 0, total = +totalRaw || 0;
    const pc = pendingCounter[buyer];
    const own = useMarket.getState().own;
    delete pendingCounter[buyer];
    if (!pc || pc.qty !== qty || pc.total !== total || now > pc.until) return;
    if (!own || own.qty < qty) {
      sendGameMsg(`${MK}NOPE|${me}|${clean(buyer)}|hết hàng`);
      return;
    }
    execSale(buyer, own.pid, qty, total);
    return;
  }
}

onGameMsg(MK, handleMsg);

const CROWD_NAMES = ['Cô Tư 🚶', 'Chú Sáu 🎩', 'Bé Na 🎀'];
const CROWD_WANTS = ['lua', 'carot', 'trung', 'sua', 'cam', 'dua', 'táo', 'caro'];

function randSpot() {
  return {
    x: NIGHT_MARKET.x + 30 + Math.random() * (NIGHT_MARKET.w - 60),
    y: NIGHT_MARKET.y + 30 + Math.random() * (NIGHT_MARKET.h - 60),
  };
}

export const useMarket = create<MarketState>()((set, get) => ({
  stalls: {},
  own: null,
  buyTarget: null,
  hag: { status: 'idle', seller: '', qty: 0, offer: 0, until: 0 },
  crowd: [],
  announced: false,

  setBuyTarget: (s) => set({ buyTarget: s }),

  openStall: (pid, price, qty, haggle) => {
    const g = useGame.getState();
    const have = g.inv[pid] || 0;
    if (have < qty || qty <= 0) { sfx.error(); g.toast('Không đủ hàng để bày sạp!'); return; }
    if (price < 1) { sfx.error(); g.toast('Giá phải từ 1 xu!'); return; }
    // ô trống đầu tiên (tránh ô người khác đang dùng)
    const used = new Set(Object.values(get().stalls).map((s) => displaySlot(get().stalls, s.seller)));
    let slot = 0;
    while (used.has(slot) && slot < MARKET_SLOTS - 1) slot++;
    const own = { slot, pid: clean(pid), price: Math.floor(price), qty, haggle };
    set({ own });
    try { localStorage.setItem(STALL_KEY, JSON.stringify({ slot, pid: own.pid, price: own.price, haggle })); } catch { /* ignore */ }
    broadcastOwn();
    g.toast(`🏪 Dựng sạp ô ${slot + 1}: ${itemName(pid)[0]} x${qty} — ${price} xu!`);
    sfx.click();
  },

  updateOwn: (price, qty, haggle) => {
    const { own } = get();
    if (!own) return;
    const g = useGame.getState();
    const have = g.inv[own.pid] || 0;
    const q = Math.max(0, Math.min(qty, have));
    set({ own: { ...own, price: Math.max(1, Math.floor(price)), qty: q, haggle } });
    try { localStorage.setItem(STALL_KEY, JSON.stringify({ slot: own.slot, pid: own.pid, price: Math.max(1, Math.floor(price)), haggle })); } catch { /* ignore */ }
    broadcastOwn();
  },

  closeStall: () => {
    sendGameMsg(`${MK}UNSTALL|${gameMe().name}`);
    set((s) => {
      const stalls = { ...s.stalls };
      delete stalls[gameMe().name];
      return { own: null, stalls };
    });
    try { localStorage.removeItem(STALL_KEY); } catch { /* ignore */ }
    useGame.getState().toast('Dọn sạp về nghỉ!');
  },

  buy: (seller, qty) => {
    const stall = get().stalls[seller];
    if (!stall) return;
    const g = useGame.getState();
    if (!isMarketOpen()) { sfx.error(); g.toast('Chợ đóng rồi — họp tối T7–CN 18h–24h!'); return; }
    const total = stall.price * qty;
    if (g.xu < total) { sfx.error(); g.toast('Không đủ xu!'); return; }
    if (stall.qty < qty) { sfx.error(); g.toast('Sạp không còn đủ hàng!'); return; }
    sendGameMsg(`${MK}BUY|${clean(seller)}|${gameMe().name}|${qty}`);
  },

  offerHag: (seller, qty, offer) => {
    const stall = get().stalls[seller];
    if (!stall) return;
    const g = useGame.getState();
    if (!isMarketOpen()) { sfx.error(); g.toast('Chợ đóng rồi!'); return; }
    if (!stall.haggle) { sfx.error(); g.toast('Sạp này niêm yết, không trả giá!'); return; }
    if (g.xu < offer) { sfx.error(); g.toast('Không đủ xu trả giá này!'); return; }
    if (offer < Math.ceil((stall.price * qty) / 2)) { sfx.error(); g.toast('Trả ít nhất nửa giá chứ! 😅'); return; }
    sendGameMsg(`${MK}HAG|${clean(seller)}|${gameMe().name}|${qty}|${Math.floor(offer)}`);
    set({ hag: { status: 'waiting', seller, qty, offer: Math.floor(offer), until: Date.now() + 12000 } });
  },

  confirmCounter: () => {
    const { hag } = get();
    if (hag.status !== 'counter') return;
    sendGameMsg(`${MK}HAGYES|${clean(hag.seller)}|${gameMe().name}|${hag.qty}|${hag.offer}`);
    set({ hag: { ...hag, status: 'waiting', until: Date.now() + 12000 } });
  },

  cancelHag: () => set({ hag: { status: 'idle', seller: '', qty: 0, offer: 0, until: 0 } }),

  tick: (now) => {
    const s = get();
    const g = useGame.getState();
    const open = isMarketOpen();

    // mở/đóng chợ: thông báo 1 lần mỗi phiên
    if (open && !s.announced) {
      set({ announced: true });
      g.toast('🌙 Chợ đêm mở rồi! Ra bãi đông-nam dựng sạp thôi!');
    } else if (!open && s.announced) {
      set({ announced: false });
    }

    // sạp mình: phát lại + đồng bộ kho + hết hàng tự dọn
    if (s.own) {
      const have = g.inv[s.own.pid] || 0;
      if (have <= 0 || s.own.qty <= 0) {
        get().closeStall();
        g.toast('Sạp hết hàng — tự dọn về nghỉ!');
      } else {
        if (s.own.qty > have) set({ own: { ...s.own, qty: have } });
        if (now - lastResend > RESEND_MS) { lastResend = now; broadcastOwn(); }
      }
    }

    // dọn sạp ma (chủ out quá 20s không phát)
    let dirty = false;
    const stalls = { ...s.stalls };
    for (const k of Object.keys(stalls)) {
      if (k !== gameMe().name && now - stalls[k].updatedAt > STALL_TTL) { delete stalls[k]; dirty = true; }
    }
    if (dirty) set({ stalls });

    // chờ trả giá quá 12s không hồi âm → timeout
    if ((s.hag.status === 'waiting' || s.hag.status === 'counter') && now > s.hag.until) {
      set({ hag: { status: 'timeout', seller: s.hag.seller, qty: 0, offer: 0, until: 0 } });
      g.toast('🎲 Chủ sạp đi đâu mất — trả giá thất bại!');
    }

    // khách NPC đi chợ: dạo + thỉnh thoảng mua ủng hộ sạp mình
    if (open) {
      let crowd = s.crowd;
      if (!crowd.length) {
        crowd = CROWD_NAMES.map((name, i) => {
          const p = randSpot();
          const [w] = itemName(CROWD_WANTS[(Math.random() * CROWD_WANTS.length) | 0]);
          return { ...p, dir: (i % 2 ? -1 : 1) as 1 | -1, moving: true, name, bubble: `Ai bán ${w}?` };
        });
        set({ crowd });
      } else {
        crowd = crowd.map((c) => {
          const dx = (Math.random() - 0.5) * 60;
          const dy = (Math.random() - 0.5) * 60;
          const nx = Math.min(NIGHT_MARKET.x + NIGHT_MARKET.w - 20, Math.max(NIGHT_MARKET.x + 20, c.x + dx * 0.05));
          const ny = Math.min(NIGHT_MARKET.y + NIGHT_MARKET.h - 20, Math.max(NIGHT_MARKET.y + 20, c.y + dy * 0.05));
          return { ...c, x: nx, y: ny, dir: (dx >= 0 ? 1 : -1) as 1 | -1, moving: Math.abs(dx) + Math.abs(dy) > 8 };
        });
        if (crowd !== s.crowd) set({ crowd });
      }
      if (s.own && s.own.qty > 0 && now >= nextNpcBuy) {
        nextNpcBuy = now + 20000 + Math.random() * 20000;
        const own = { ...s.own, qty: s.own.qty - 1 };
        set({ own });
        g.addXu(s.own.price);
        const [nm] = itemName(s.own.pid);
        g.toast(`🚶 Khách chợ mua 1 ${nm} +${s.own.price} xu!`);
        sfx.coin();
        broadcastOwn();
      }
    } else if (s.crowd.length) {
      set({ crowd: [] });
    }
  },
}));
