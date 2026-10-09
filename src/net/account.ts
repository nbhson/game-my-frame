// ===== Account theo username: TOÀN BỘ farm nằm trong DB =====
// Nhập đúng username → lấy lại farm, bất kể reload/tab khác/máy khác.
// Backend tự chọn: LAN server (DB `server/data/db.json`) → localStorage theo user.
import type { Animal, CoopCap, DailyState, GraphicsQuality, PondFish, Plot, ResMode, Stats, WeatherKind } from '../game/types';
import { useGame } from '../game/store';
import { useVillage } from './village';
import { lanServerAvailable } from './socket';
import { normalizeUsername } from './session';

export interface AccountData {
  name: string;
  avatar: number;
  xu: number; gem: number; level: number; xp: number;
  day: number; dayTime: number;
  weather?: WeatherKind; weatherLeft?: number;
  inv: Record<string, number>;
  plots: Plot[];
  fishes: PondFish[];
  animals: Animal[];
  pondSlots?: number;
  coopCap?: CoopCap;
  stats: Stats;
  questIdx: number;
  uidSeq: number;
  baLove?: number; loveClaim?: number[]; fundTotal?: number; fundClaim?: number[];
  daily?: DailyState; junkAt?: number;
  redeemedCodes?: string[];
  outfit?: Record<string, string>;
  ownedOutfits?: string[];
  ownedCars?: string[];
  activeCar?: string | null;
  quality?: GraphicsQuality;
  autoQuality?: boolean;
  resMode?: ResMode;
  viewH?: number;
  kem?: boolean;
  stageColor?: string;
  /** ms lúc export — để so bản nào mới hơn khi server/local lệch nhau */
  updatedAt?: number;
}

export interface AccountBackend {
  readonly kind: 'server' | 'local';
  load(username: string): Promise<LoadedAccount | null>;
  save(username: string, name: string, avatar: number, data: AccountData): Promise<void>;
  beaconSave(username: string, name: string, avatar: number, data: AccountData): void;
}

/** Kết quả đọc 1 backend: kèm thời điểm + nguồn để so mới/cũ */
export interface LoadedAccount {
  name: string; avatar: number; data: AccountData;
  updatedAt: number | null;
  source: 'server' | 'local';
}

/** Backend 1: LAN server — DB thật, chung cho cả mạng */
class ServerAccountBackend implements AccountBackend {
  readonly kind = 'server' as const;
  private url(u: string) { return `/api/players/${encodeURIComponent(normalizeUsername(u))}`; }
  /** fetch có timeout thật (5s): mạng chập chờn thì abort để rớt về local, không treo login */
  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 5000): Promise<T> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      return await fn(ctl.signal);
    } finally { clearTimeout(t); }
  }
  async load(username: string): Promise<LoadedAccount | null> {
    try {
      const r = await this.withTimeout((signal) => fetch(this.url(username), { cache: 'no-store', signal }));
      if (!r.ok) return null;
      const acc = await r.json();
      if (!acc?.data) return null;
      return {
        name: acc.name as string, avatar: acc.avatar as number, data: acc.data as AccountData,
        updatedAt: (acc.updatedAt as number) ?? (acc.data?.updatedAt as number) ?? null,
        source: 'server',
      };
    } catch {
      // server chết giữa chừng → trả null để loadBest rớt sang bản local, KHÔNG hạ backend ở đây
      return null;
    }
  }
  async save(username: string, name: string, avatar: number, data: AccountData) {
    // lỗi save thì ném ra cho syncNow bỏ qua (tick sau thử tiếp) — KHÔNG hạ backend vĩnh viễn
    await this.withTimeout((signal) => fetch(this.url(username), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar, data }),
      signal,
    }));
  }
  beaconSave(username: string, name: string, avatar: number, data: AccountData) {
    try {
      navigator.sendBeacon(this.url(username), new Blob([JSON.stringify({ name, avatar, data })], { type: 'application/json' }));
    } catch { /* ignore */ }
  }
}

/** Backend 2: không có server — localStorage, tách theo từng username */
class LocalAccountBackend implements AccountBackend {
  readonly kind = 'local' as const;
  private key(u: string) { return `nongtrai-acct:${normalizeUsername(u)}`; }
  async load(username: string): Promise<LoadedAccount | null> {
    try {
      const raw = localStorage.getItem(this.key(username));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return null;
      return {
        name: parsed.name as string, avatar: parsed.avatar as number, data: parsed.data as AccountData,
        updatedAt: (parsed.updatedAt as number) ?? (parsed.data?.updatedAt as number) ?? null,
        source: 'local',
      };
    } catch { return null; }
  }
  async save(username: string, name: string, avatar: number, data: AccountData) {
    try {
      const now = Date.now();
      localStorage.setItem(this.key(username), JSON.stringify({ name, avatar, data: { ...data, updatedAt: now }, updatedAt: now }));
    } catch { /* ignore */ }
  }
  beaconSave(username: string, name: string, avatar: number, data: AccountData) {
    void this.save(username, name, avatar, data);
  }
}

let backend: AccountBackend | null = null;
export async function getAccountBackend(): Promise<AccountBackend> {
  if (!backend) {
    try {
      backend = (await lanServerAvailable()) ? new ServerAccountBackend() : new LocalAccountBackend();
    } catch {
      backend = new LocalAccountBackend();
    }
  }
  return backend;
}

// ---------- export toàn bộ state game ----------
export function exportAccount(): AccountData {
  const g = useGame.getState();
  return {
    name: g.name, avatar: g.avatar,
    xu: g.xu, gem: g.gem, level: g.level, xp: g.xp,
    day: g.day, dayTime: g.dayTime,
    weather: g.weather, weatherLeft: g.weatherLeft,
    inv: g.inv, plots: g.plots, fishes: g.fishes, animals: g.animals,
    pondSlots: g.pondSlots, coopCap: g.coopCap,
    stats: g.stats, questIdx: g.questIdx, uidSeq: g.uidSeq,
    baLove: g.baLove, loveClaim: g.loveClaim, fundTotal: g.fundTotal, fundClaim: g.fundClaim,
    daily: g.daily, junkAt: g.junkAt,
    redeemedCodes: g.redeemedCodes,
    outfit: g.outfit, ownedOutfits: g.ownedOutfits,
    ownedCars: g.ownedCars, activeCar: g.activeCar,
    quality: g.quality, autoQuality: g.autoQuality, resMode: g.resMode, viewH: g.viewH, kem: g.kem,
    stageColor: g.stageColor,
    updatedAt: Date.now(),
  };
}

/**
 * Đọc bản mới nhất giữa server và local (so updatedAt).
 * - server restart / mạng chập chờn: bản local mới hơn vẫn thắng → không mất đồ.
 * - không timestamp (save cũ): ưu tiên server có data, rồi tới local.
 */
export async function loadBest(username: string): Promise<LoadedAccount | null> {
  const [sv, lc] = await Promise.all([
    (async (): Promise<LoadedAccount | null> => {
      try {
        if (!(await lanServerAvailable())) return null;
        return await new ServerAccountBackend().load(username);
      } catch { return null; }
    })(),
    new LocalAccountBackend().load(username),
  ]);
  const t = (x: LoadedAccount | null) => x?.updatedAt ?? x?.data?.updatedAt ?? 0;
  const hasData = (x: LoadedAccount | null) => !!x?.data;
  if (hasData(sv) && hasData(lc)) return t(sv) >= t(lc) ? sv : lc;
  if (hasData(sv)) return sv;
  if (hasData(lc)) return lc;
  return null;
}

/**
 * Ghi write-through: local LUÔN (phao cứu sinh) + server nếu với tới được.
 * Save lỗi thì tick sau thử tiếp — không bao giờ "hạ cấp" backend như trước
 * (đó chính làbug làm mất đồ khi restart server giữa phiên chơi).
 */
export async function syncNow() {
  const g = useGame.getState();
  if (!g.started || !g.name || useVillage.getState().visiting) return;
  const data = exportAccount();
  try { await new LocalAccountBackend().save(g.name, g.name, g.avatar, data); } catch { /* ignore */ }
  try {
    if (await lanServerAvailable()) await new ServerAccountBackend().save(g.name, g.name, g.avatar, data);
  } catch { /* offline thì thôi, lần sau sync tiếp */ }
}

/** Beacon khi ẩn tab/tắt trang: bắn cả 2 nơi, fire-and-forget */
export function syncNowBeacon() {
  const g = useGame.getState();
  if (!g.started || !g.name) return;
  const data = exportAccount();
  try { new LocalAccountBackend().beaconSave(g.name, g.name, g.avatar, data); } catch { /* ignore */ }
  try { new ServerAccountBackend().beaconSave(g.name, g.name, g.avatar, data); } catch { /* ignore */ }
}

// ---------- autosync: 10s/lần + khi ẩn tab/tắt trang ----------
let syncTimer: number | null = null;

export function startAutoSync() {
  stopAutoSync();
  const tick = async () => { await syncNow(); };
  syncTimer = window.setInterval(() => { void tick(); }, 10000);
  const onHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    const g = useGame.getState();
    if (!g.started || !g.name || useVillage.getState().visiting) return;
    syncNowBeacon();
  };
  const onUnload = () => { syncNowBeacon(); };
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('beforeunload', onUnload);
  (startAutoSync as { _cleanup?: () => void })._cleanup = () => {
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('beforeunload', onUnload);
  };
}

export function stopAutoSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  (startAutoSync as { _cleanup?: () => void })._cleanup?.();
}
