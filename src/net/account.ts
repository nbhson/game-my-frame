// ===== Account theo username: TOÀN BỘ farm nằm trong DB =====
// Nhập đúng username → lấy lại farm, bất kể reload/tab khác/máy khác.
// Backend tự chọn: LAN server (DB `server/data/db.json`) → localStorage theo user.
import type { Animal, CoopCap, PondFish, Plot, Stats, WeatherKind } from '../game/types';
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
}

export interface AccountBackend {
  readonly kind: 'server' | 'local';
  load(username: string): Promise<{ name: string; avatar: number; data: AccountData } | null>;
  save(username: string, name: string, avatar: number, data: AccountData): Promise<void>;
  beaconSave(username: string, name: string, avatar: number, data: AccountData): void;
}

/** Backend 1: LAN server — DB thật, chung cho cả mạng */
class ServerAccountBackend implements AccountBackend {
  readonly kind = 'server' as const;
  private url(u: string) { return `/api/players/${encodeURIComponent(normalizeUsername(u))}`; }
  private async withTimeout<T>(p: Promise<T>, ms = 4000): Promise<T> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      // fetch không nhận signal ở đây (đã có cache no-store) — chỉ guard treo
      return await p;
    } finally { clearTimeout(t); void ctl; }
  }
  async load(username: string) {
    try {
      const r = await this.withTimeout(fetch(this.url(username), { cache: 'no-store' }));
      if (!r.ok) return null;
      const acc = await r.json();
      if (!acc?.data) return null;
      return { name: acc.name as string, avatar: acc.avatar as number, data: acc.data as AccountData };
    } catch {
      // server chết giữa chừng → rớt về local để game vẫn vào được
      resetBackendToLocal();
      const local = new LocalAccountBackend();
      try { return await local.load(username); } catch { return null; }
    }
  }
  async save(username: string, name: string, avatar: number, data: AccountData) {
    try {
      await this.withTimeout(fetch(this.url(username), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar, data }),
      }));
    } catch {
      // mất server khi đang chơi: lưu local tạm, lần sau sync tiếp
      resetBackendToLocal();
      try { await new LocalAccountBackend().save(username, name, avatar, data); } catch { /* ignore */ }
    }
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
  async load(username: string) {
    try {
      const raw = localStorage.getItem(this.key(username));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return null;
      return parsed as { name: string; avatar: number; data: AccountData };
    } catch { return null; }
  }
  async save(username: string, name: string, avatar: number, data: AccountData) {
    try { localStorage.setItem(this.key(username), JSON.stringify({ name, avatar, data })); } catch { /* ignore */ }
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
/** server chết giữa chừng → rớt về local ngay, game không kẹt */
export function resetBackendToLocal() {
  backend = new LocalAccountBackend();
}
/** backend đang dùng (để autosync không phải dò lại) */
export function currentBackend(): AccountBackend | null { return backend; }

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
  };
}

// ---------- autosync: 10s/lần + khi ẩn tab/tắt trang ----------
let syncTimer: number | null = null;

export function startAutoSync() {
  stopAutoSync();
  const tick = async () => {
    const g = useGame.getState();
    if (!g.started || !g.name || useVillage.getState().visiting) return;
    try {
      const b = await getAccountBackend();
      await b.save(g.name, g.name, g.avatar, exportAccount());
    } catch { /* offline thì thôi, lần sau sync tiếp */ }
  };
  syncTimer = window.setInterval(() => { void tick(); }, 10000);
  const onHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    const g = useGame.getState();
    if (!g.started || !g.name || useVillage.getState().visiting) return;
    const b = currentBackend();
    if (b) b.beaconSave(g.name, g.name, g.avatar, exportAccount());
  };
  const onUnload = () => {
    const g = useGame.getState();
    if (!g.started || !g.name) return;
    const b = currentBackend();
    if (b) b.beaconSave(g.name, g.name, g.avatar, exportAccount());
  };
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
