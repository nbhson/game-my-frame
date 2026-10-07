// UID an toàn mọi môi trường (http LAN / file / trình duyệt cũ).
// crypto.randomUUID chỉ tồn tại trong secure context (https/localhost) → cần fallback.
export function safeUid(): string {
  try {
    const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch { /* ignore */ }
  // fallback: 128-bit ngẫu nhiên dạng UUID v4
  const r = () => Math.floor(Math.random() * 0xffffffff);
  const h = (n: number) => n.toString(16).padStart(8, '0');
  const a = r(), b = r(), c2 = r(), d = r();
  return `${h(a).slice(0, 8)}-${h(b).slice(0, 4)}-4${h(b).slice(5, 8)}-${((c2 >>> 28) & 0x3 | 0x8).toString(16)}${h(c2).slice(1, 4)}-${h(c2).slice(4, 8)}${h(d).slice(0, 4)}`;
}
