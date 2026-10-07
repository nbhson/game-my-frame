// ===== Supabase transport: cloud thật — presence + broadcast + farm snapshots =====
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { ChatMsg, FarmPayload, FarmSnapshot, NetTransport, RemotePlayer, SelfInfo } from './transport';
import { PRESENCE_PROTO, codeFromId } from './session';
import { safeUid } from './uid';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function supabaseConfigured(): boolean {
  return !!URL && !!ANON;
}

export class SupabaseTransport implements NetTransport {
  readonly mode = 'supabase' as const;
  readonly code: string;
  private sb: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private self: SelfInfo = { id: '', name: '', avatar: 0 };
  private players = new Map<string, RemotePlayer>();
  private playerCbs = new Set<(l: RemotePlayer[]) => void>();
  private chatCbs = new Set<(m: ChatMsg) => void>();
  private statusCbs = new Set<(ok: boolean) => void>();
  private lastFarmPush = 0;
  private playerId: string;
  private lastPos: { x: number; y: number; dir: 1 | -1; moving: boolean } = { x: 700, y: 600, dir: 1, moving: false };

  constructor(playerId: string, codeOverride?: string) {
    // id presence có hậu tố #tab → key DB dùng phần bền vững để không vỡ farm theo tab
    this.playerId = playerId.split('#')[0];
    this.code = codeOverride ?? codeFromId(playerId);
    this.sb = createClient(URL!, ANON!);
  }

  connect(self: SelfInfo) {
    this.self = self;
    void this.upsertProfile();
    this.channel = this.sb.channel('village:global', {
      config: { presence: { key: self.id }, broadcast: { self: false } },
    });
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState() as Record<string, { v?: number; name: string; avatar: number; code?: string; x: number; y: number; dir: 1 | -1; moving: boolean; bubble?: string; map?: 'farm' | 'town'; emote?: string; visit?: string | null }[]>;
        const now = Date.now();
        const next = new Map<string, RemotePlayer>();
        for (const [id, metas] of Object.entries(state)) {
          if (id === this.self.id) continue;
          const m = metas[0];
          if (!m) continue;
          const prev = this.players.get(id);
          next.set(id, {
            id, name: m.name, avatar: m.avatar, code: m.code ?? prev?.code,
            x: m.x, y: m.y,
            dir: m.dir, moving: m.moving,
            bubble: m.bubble ?? prev?.bubble,
            bubbleAt: m.bubble ? now : prev?.bubbleAt,
            map: m.map ?? prev?.map ?? 'farm',
            emote: m.emote ?? prev?.emote,
            emoteAt: m.emote ? now : prev?.emoteAt,
            proto: m.v ?? prev?.proto ?? 1,
            visit: m.visit !== undefined ? m.visit : (prev?.visit ?? null),
            updatedAt: now,
          });
        }
        this.players = next;
        this.emitPlayers();
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const p = payload as { from: string; name: string; text: string };
        this.chatCbs.forEach((cb) => cb({ id: safeUid(), fromId: p.from, fromName: p.name, text: p.text, at: Date.now() }));
        // gắn bubble cho người gửi
        const pl = this.players.get(p.from);
        if (pl) { pl.bubble = p.text; pl.bubbleAt = Date.now(); this.emitPlayers(); }
      })
      .subscribe((status) => {
        this.emitStatus(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') this.track();
      });
  }

  disconnect() {
    void this.channel?.untrack();
    void this.sb.removeChannel(this.channel!);
    this.channel = null;
    this.players.clear();
  }

  updateSelf(self: SelfInfo) {
    this.self = self;
    void this.upsertProfile();
    this.track();
  }

  pushPosition(x: number, y: number, dir: 1 | -1, moving: boolean, bubble?: string, extra?: { map?: 'farm' | 'town'; emote?: string; visit?: string | null }) {
    this.track({ x, y, dir, moving, bubble, map: extra?.map, emote: extra?.emote, visit: extra?.visit });
  }

  pushFarm(snap: FarmPayload) {
    const now = Date.now();
    if (now - this.lastFarmPush < 8000) return; // cloud: 8s/lần
    this.lastFarmPush = now;
    const full: FarmSnapshot = { ...snap, code: this.code, updatedAt: now };
    void (async () => {
      const { error } = await this.sb.from('farms').upsert({
        player_id: this.playerId,
        code: this.code,
        snapshot: full,
        updated_at: new Date().toISOString(),
      });
      this.emitStatus(!error);
    })();
  }

  async fetchFarm(code: string): Promise<FarmSnapshot | null> {
    const want = code.trim().toUpperCase();
    if (!want) return null;
    const { data, error } = await this.sb.from('farms').select('snapshot').eq('code', want).maybeSingle();
    if (error || !data) return null;
    const snap = data.snapshot as FarmSnapshot;
    if (!snap?.plots) return null;
    return snap;
  }

  sendChat(text: string) {
    const msg: ChatMsg = { id: safeUid(), fromId: this.self.id, fromName: this.self.name, text, at: Date.now() };
    this.chatCbs.forEach((cb) => cb(msg));
    void this.channel?.send({ type: 'broadcast', event: 'chat', payload: { from: this.self.id, name: this.self.name, text } });
    this.track({ bubble: text });
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
    return () => { this.statusCbs.delete(cb); };
  }

  private track(extra?: { x?: number; y?: number; dir?: 1 | -1; moving?: boolean; bubble?: string; map?: 'farm' | 'town'; emote?: string; visit?: string | null }) {
    if (!this.channel) return;
    // giữ vị trí cuối để gửi bubble không làm teleport
    if (extra?.x != null) {
      this.lastPos = { x: extra.x, y: extra.y ?? this.lastPos.y, dir: extra.dir ?? this.lastPos.dir, moving: extra.moving ?? false };
    }
    void this.channel.track({
      v: PRESENCE_PROTO,
      name: this.self.name, avatar: this.self.avatar, code: this.code,
      x: this.lastPos.x, y: this.lastPos.y,
      dir: this.lastPos.dir, moving: this.lastPos.moving,
      ...(extra?.bubble ? { bubble: extra.bubble } : {}),
      ...(extra?.map ? { map: extra.map } : {}),
      ...(extra?.emote ? { emote: extra.emote } : {}),
      ...(extra?.visit ? { visit: extra.visit } : {}),
    });
  }

  private async upsertProfile() {
    await this.sb.from('profiles').upsert({
      id: this.playerId,
      name: this.self.name,
      avatar: this.self.avatar,
      code: this.code,
      updated_at: new Date().toISOString(),
    });
    await this.sb.from('farms').upsert({
      player_id: this.playerId,
      code: this.code,
      snapshot: {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id', ignoreDuplicates: true });
  }

  private emitPlayers() { this.playerCbs.forEach((cb) => cb([...this.players.values()])); }
  private emitStatus(ok: boolean) { this.statusCbs.forEach((cb) => cb(ok)); }
}
