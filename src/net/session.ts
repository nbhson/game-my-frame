// ===== Phiên khách: id bền vững + mã bạn bè 6 ký tự =====
import { safeUid } from './uid';
const ID_KEY = 'nt-player-id';
const ACCT_KEY = 'nt-account'; // username đăng nhập lần cuối (để điền sẵn)

export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = safeUid();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

/**
 * Id presence RIÊNG MỖI TAB (sessionStorage): 2 tab cùng trình duyệt mở 2
 * account khác nhau vẫn thấy nhau. localStorage chung 1 id là nguyên nhân
 * presence tự lờ tin của tab kia (w.from === self.id).
 * Account/farm vẫn key theo username nên không ảnh hưởng save.
 */
const SID_KEY = 'nt-tab-id';
export function getTabId(): string {
  let id = sessionStorage.getItem(SID_KEY);
  if (!id) {
    id = safeUid();
    sessionStorage.setItem(SID_KEY, id);
  }
  return id;
}

/** Danh tính presence = id bền vững + id tab (mỗi tab 1 người trong làng) */
export function getPresenceId(): string {
  return `${getPlayerId()}#${getTabId()}`;
}

/**
 * Version giao thức presence. Tăng khi đổi format tin.
 * Tab nào thấy người chơi có version khác mình → báo lệch bản để reload.
 */
export const PRESENCE_PROTO = 2;

/** Mã bạn bè từ id: 6 ký tự dễ đọc, dễ chia sẻ kiểu Avatar */
export function codeFromId(id: string): string {
  const clean = id.replace(/-/g, '').toUpperCase();
  // bỏ các ký tự dễ nhầm (0/O, 1/I)
  const safe = clean.replace(/[0O1I]/g, 'X');
  return (safe.slice(0, 6) + 'ABCDEF').slice(0, 6);
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Username chuẩn hóa làm key account (không phân biệt hoa/thường) */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().slice(0, 12);
}

/**
 * Mã farm 6 ký tự suy ra deterministically từ username —
 * cùng username thì cùng mã trên mọi máy/tab (server dùng y hệt).
 */
export function codeFromName(name: string): string {
  const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let h = 5381;
  const s = name.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h + (s.codePointAt(i) ?? 0)) >>> 0);
  let out = '';
  for (let i = 0; i < 6; i++) { out += ALPH[h & 31]; h = (h >>> 5) ^ (h >>> 11); }
  return out;
}

export function getLastAccount(): string {
  return localStorage.getItem(ACCT_KEY) || '';
}
export function setLastAccount(username: string) {
  localStorage.setItem(ACCT_KEY, username);
}
