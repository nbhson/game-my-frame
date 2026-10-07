// UID an toàn mọi môi trường (http LAN / file / trình duyệt cũ).
// crypto.randomUUID chỉ tồn tại trong secure context (https/localhost) → cần fallback.
// Ngoài ra một số lib (socket.io client...) gọi crypto.randomUUID trực tiếp
// nên phải polyfill ngay khi module này được import (trước mọi connect).
function randomHex(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return s;
}
function fallbackUuid(): string {
  // UUID v4 từ Math.random (đủ cho id chat/presence, không dùng cho bảo mật)
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${randomHex(3)}-${randomHex(12)}`;
}

// polyfill chạy 1 lần: http LAN (không secure context) cũng có crypto.randomUUID
try {
  const g = globalThis as unknown as { crypto?: Crypto & { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID !== 'function') {
    (g.crypto as { randomUUID: () => string }).randomUUID = fallbackUuid;
  }
} catch { /* ignore */ }

export function safeUid(): string {
  try {
    const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch { /* ignore */ }
  return fallbackUuid();
}
