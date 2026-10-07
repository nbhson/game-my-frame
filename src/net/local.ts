// ===== Làng local: multi-tab demo qua BroadcastChannel (không cần mạng) =====
// Mở 2 tab cùng trình duyệt → thấy nhau đi lại, chat, thăm farm nhau.
import type { ChatMsg, FarmPayload, FarmSnapshot, NetTransport, RemotePlayer, SelfInfo } from './transport';
import { codeFromId } from './session';

interface Wire {
  kind: 'hello' | 'pos' | 'chat' | 'farm' | 'bye';
  from: string;
  name?: string;
  avatar?: number;
  x?: number; y?: number; dir?: 1 | -1; moving?: boolean; bubble?: string;
  text?: string;
  snap?: FarmSnapshot;
}

const LS_FARM = 'nongtrai-local-farm';

export class LocalTransport implements NetTransport {
  readonly mode = 'local' as const;
  readonly code: string;
  private ch: BroadcastChannel | null = null;
  private self: SelfInfo = { id: '', name: '', avatar: 0 };
  private players = new Map<string, RemotePlayer>();
  private playerCbs = new Set<(l: RemotePlayer[]) => void>();
  private chatCbs = new Set<(m: ChatMsg) => void>();
  private statusCbs = new Set<(ok: boolean) => void>();
  private timer: number | null = null;
  private lastFarmPush = 0;

  constructor(private playerId: string, codeOverride?: string) {
    this.code = codeOverride ?? codeFromId(playerId);
  }

  connect(self: SelfInfo) {
    this.self = self;
    this.ch = new BroadcastChannel('nongtrai-village');
    this.ch.onmessage = (e) => this.handle(e.data as Wire);
    this.emitStatus(true);
    this.send({ kind: 'hello', from: self.id, name: self.name, avatar: self.avatar });
    // xin farm snapshot của các tab khác để visit được
    // dọn người chơi mất kết nối (quá 8s không pos)
    this.timer = window.setInterval(() => {
      const now = Date.now();
      let drop = false;
      for (const [id, p] of this.players) {
        if (now - p.updatedAt > 8000) { this.players.delete(id); drop = true; }
      }
      if (drop) this.emitPlayers();
    }, 2000);
  }

  disconnect() {
    this.send({ kind: 'bye', from: this.self.id });
    this.ch?.close();
    this.ch = null;
    if (this.timer) clearInterval(this.timer);
    this.players.clear();
  }

  updateSelf(self: SelfInfo) {
    this.self = self;
    this.send({ kind: 'hello', from: self.id, name: self.name, avatar: self.avatar });
  }

  pushPosition(x: number, y: number, dir: 1 | -1, moving: boolean, bubble?: string) {
    this.send({ kind: 'pos', from: this.self.id, name: this.self.name, avatar: this.self.avatar, x, y, dir, moving, bubble });
  }

  pushFarm(snap: FarmPayload) {
    // throttle 3s + lưu local để tab khác fetch được
    const now = Date.now();
    if (now - this.lastFarmPush < 3000) return;
    this.lastFarmPush = now;
    const full: FarmSnapshot = { ...snap, code: this.code, updatedAt: now };
    try { localStorage.setItem(LS_FARM + ':' + this.code, JSON.stringify(full)); } catch { /* ignore */ }
    this.send({ kind: 'farm', from: this.self.id, snap: full });
  }

  async fetchFarm(code: string): Promise<FarmSnapshot | null> {
    // 1. farm của chính mình (tab này hoặc tab khác cùng máy)
    try {
      const raw = localStorage.getItem(LS_FARM + ':' + code);
      if (raw) return JSON.parse(raw) as FarmSnapshot;
    } catch { /* ignore */ }
    // 2. hỏi các tab đang online
    const found = await new Promise<FarmSnapshot | null>((resolve) => {
      const handler = (e: MessageEvent) => {
        const w = e.data as Wire;
        if (w.kind === 'farm' && w.snap?.code === code) {
          this.ch?.removeEventListener('message', handler);
          resolve(w.snap);
        }
      };
      this.ch?.addEventListener('message', handler);
      setTimeout(() => { this.ch?.removeEventListener('message', handler); resolve(null); }, 1200);
    });
    return found;
  }

  sendChat(text: string) {
    const msg: ChatMsg = { id: crypto.randomUUID(), fromId: this.self.id, fromName: this.self.name, text, at: Date.now() };
    this.chatCbs.forEach((cb) => cb(msg));
    this.send({ kind: 'chat', from: this.self.id, name: this.self.name, text });
  }

  onPlayers(cb: (l: RemotePlayer[]) => void) {
    this.playerCbs.add(cb);
    cb([...this.players.values()]);
    return () => { this.playerCbs.delete(cb); };
  }
  onChat(cb: (m: ChatMsg) => void) {
    this.chatCbs.add(cb);
    return () => { this.chatCbs.delete(cb); };
  }
  onStatus(cb: (ok: boolean) => void) {
    this.statusCbs.add(cb);
    cb(true);
    return () => { this.statusCbs.delete(cb); };
  }

  private send(w: Wire) { try { this.ch?.postMessage(w); } catch { /* ignore */ } }

  private handle(w: Wire) {
    if (!w || w.from === this.self.id) return;
    if (w.kind === 'hello' || w.kind === 'pos') {
      const prev = this.players.get(w.from);
      this.players.set(w.from, {
        id: w.from,
        name: w.name ?? prev?.name ?? 'Bạn',
        avatar: w.avatar ?? prev?.avatar ?? 0,
        x: w.x ?? prev?.x ?? 700,
        y: w.y ?? prev?.y ?? 600,
        dir: w.dir ?? prev?.dir ?? 1,
        moving: w.moving ?? false,
        bubble: w.bubble ?? prev?.bubble,
        bubbleAt: w.bubble ? Date.now() : prev?.bubbleAt,
        updatedAt: Date.now(),
      });
      this.emitPlayers();
    } else if (w.kind === 'chat' && w.text) {
      const pl = this.players.get(w.from);
      if (pl) { pl.bubble = w.text; pl.bubbleAt = Date.now(); this.emitPlayers(); }
      this.chatCbs.forEach((cb) => cb({ id: crypto.randomUUID(), fromId: w.from, fromName: w.name ?? 'Bạn', text: w.text!, at: Date.now() }));
    } else if (w.kind === 'farm' && w.snap) {
      try { localStorage.setItem(LS_FARM + ':' + w.snap.code, JSON.stringify(w.snap)); } catch { /* ignore */ }
    } else if (w.kind === 'bye') {
      this.players.delete(w.from);
      this.emitPlayers();
    }
  }

  private emitPlayers() { this.playerCbs.forEach((cb) => cb([...this.players.values()])); }
  private emitStatus(ok: boolean) { this.statusCbs.forEach((cb) => cb(ok)); }
}
