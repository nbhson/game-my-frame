// ===== Phiên khách: id bền vững + mã bạn bè 6 ký tự =====
const ID_KEY = 'nt-player-id';
const ACCT_KEY = 'nt-account'; // username đăng nhập lần cuối (để điền sẵn)

export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

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
