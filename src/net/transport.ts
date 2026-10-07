// ===== Net transport abstraction =====
// Game chỉ nói chuyện với interface này → đổi backend (Supabase / socket riêng)
// không phải sửa UI hay engine. Hai impl: LocalTransport (multi-tab demo)
// và SupabaseTransport (cloud thật, realtime toàn cầu).
import type { Animal, PondFish, Plot } from '../game/types';
import type { AccountData } from './account';

export interface RemotePlayer {
  id: string;
  name: string;
  avatar: number;
  /** mã farm 6 ký tự của người này (để bấm Thăm farm trực tiếp) */
  code?: string;
  x: number; y: number;
  dir: 1 | -1;
  moving: boolean;
  bubble?: string;
  bubbleAt?: number;
  /** bản đồ đang đứng: farm riêng hay công viên chung */
  map?: 'farm' | 'town';
  /** cảm xúc realtime ở công viên */
  emote?: string;
  emoteAt?: number;
  /** version giao thức presence (phát hiện tab chạy bản game khác nhau) */
  proto?: number;
  /** mã farm đang thăm (null = đang ở nhà) — farm chỉ hiện chủ + khách cùng thăm */
  visit?: string | null;
  updatedAt: number;
}

export interface ChatMsg {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  at: number;
}

export interface FarmSnapshot {
  code: string;
  name: string;
  avatar: number;
  level: number;
  day: number;
  plots: Plot[];
  fishes: PondFish[];
  animals: Animal[];
  updatedAt: number;
}

export interface SelfInfo { id: string; name: string; avatar: number }

/**
 * Payload đẩy farm lên backend: đủ cho cả 2 mục đích —
 * `data` (toàn bộ, để login khôi phục) + các trường xem nhanh (để visit).
 */
export interface FarmPayload {
  username: string;
  name: string;
  avatar: number;
  level: number;
  day: number;
  plots: Plot[];
  fishes: PondFish[];
  animals: Animal[];
  data: AccountData;
}

export interface NetTransport {
  readonly mode: 'local' | 'supabase' | 'socket';
  /** mã bạn bè của mình (6 ký tự) */
  readonly code: string;
  connect(self: SelfInfo): void;
  disconnect(): void;
  updateSelf(self: SelfInfo): void;
  pushPosition(x: number, y: number, dir: 1 | -1, moving: boolean, bubble?: string, extra?: { map?: 'farm' | 'town'; emote?: string; visit?: string | null }): void;
  pushFarm(snap: FarmPayload): void;
  fetchFarm(code: string): Promise<FarmSnapshot | null>;
  sendChat(text: string): void;
  onPlayers(cb: (list: RemotePlayer[]) => void): () => void;
  onChat(cb: (msg: ChatMsg) => void): () => void;
  onStatus(cb: (ok: boolean) => void): () => void;
}
