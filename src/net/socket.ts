// ===== Socket transport: chơi qua LAN server (server/index.js) =====
// Client tự phát hiện server qua GET /api/health — cùng origin nên
// không cần cấu hình IP gì cả, mở link LAN là vào làng được.
import { io, type Socket } from 'socket.io-client';
import type { ChatMsg, FarmPayload, FarmSnapshot, NetTransport, RemotePlayer, SelfInfo } from './transport';

export class SocketTransport implements NetTransport {
  readonly mode = 'socket' as const;
  readonly code: string;
  private socket: Socket | null = null;
  private self: SelfInfo = { id: '', name: '', avatar: 0 };
  private players: RemotePlayer[] = [];
  private playerCbs = new Set<(l: RemotePlayer[]) => void>();
  private chatCbs = new Set<(m: ChatMsg) => void>();
  private statusCbs = new Set<(ok: boolean) => void>();
  private lastFarmPush = 0;

  constructor(private playerId: string, code: string) {
    this.code = code;
  }

  connect(self: SelfInfo) {
    this.self = self;
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => {
      this.emitStatus(true);
      this.socket!.emit('hello', { id: this.playerId, name: this.self.name, avatar: this.self.avatar, code: this.code });
    });
    this.socket.on('disconnect', () => this.emitStatus(false));
    this.socket.on('players', (list: RemotePlayer[]) => {
      this.players = (list || []).filter((p) => p.id !== this.playerId);
      this.playerCbs.forEach((cb) => cb(this.players));
    });
    this.socket.on('chat', (m: ChatMsg) => {
      this.chatCbs.forEach((cb) => cb(m));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.players = [];
  }

  updateSelf(self: SelfInfo) {
    this.self = self;
    this.socket?.emit('hello', { id: this.playerId, name: self.name, avatar: self.avatar, code: this.code });
  }

  pushPosition(x: number, y: number, dir: 1 | -1, moving: boolean, bubble?: string) {
    this.socket?.emit('pos', { x: Math.round(x), y: Math.round(y), dir, moving, bubble });
  }

  pushFarm(snap: FarmPayload) {
    const now = Date.now();
    if (now - this.lastFarmPush < 8000) return;
    this.lastFarmPush = now;
    this.socket?.emit('farm:save', { username: snap.username, name: snap.name, avatar: snap.avatar, data: snap.data });
  }

  async fetchFarm(code: string): Promise<FarmSnapshot | null> {
    try {
      const r = await fetch(`/api/farms/${code}`);
      if (!r.ok) return null;
      return (await r.json()) as FarmSnapshot;
    } catch {
      return null;
    }
  }

  sendChat(text: string) {
    this.socket?.emit('chat', { text });
    // server broadcast lại cho cả người gửi → chat + bubble tự về
  }

  onPlayers(cb: (l: RemotePlayer[]) => void) {
    this.playerCbs.add(cb);
    cb(this.players);
    return () => { this.playerCbs.delete(cb); };
  }
  onChat(cb: (m: ChatMsg) => void) {
    this.chatCbs.add(cb);
    return () => { this.chatCbs.delete(cb); };
  }
  onStatus(cb: (ok: boolean) => void) {
    this.statusCbs.add(cb);
    cb(this.socket?.connected ?? false);
    return () => { this.statusCbs.delete(cb); };
  }

  private emitStatus(ok: boolean) { this.statusCbs.forEach((cb) => cb(ok)); }
}

/** Có LAN server đi kèm không? (serve dist + /api/health) */
export async function lanServerAvailable(timeoutMs = 2000): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch('/api/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return false;
    const j = await r.json();
    return j?.mode === 'lan';
  } catch {
    return false;
  }
}
