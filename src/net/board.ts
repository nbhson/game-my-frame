// ===== BẢNG TIN LÀNG (cạnh quảng trường, map thị trấn) =====
// Ghim lời nhắn / rao bán / tìm đồ / rủ rê, cả làng đọc + thả tim.
// Bài nhiều tim nhất NGÀY HÔM QUA → chủ bài nhận 200 xu + danh hiệu
// "Dân làng yêu quý" (mỗi máy tự chấm cho bài của mình, chốt 1 lần/ngày).
import { create } from 'zustand';
import { gameMe, markSeen, onGameMsg, sendGameMsg } from './village';
import { useGame } from '../game/store';
import { safeUid } from './uid';
import { sfx } from '../game/audio';

const BD = '📌BD|';
const seen = new Set<string>();
const BOARD_KEY = 'nongtrai-board-v1';
const WIN_KEY = 'nongtrai-board-win';
const TOP_XU = 200;

export type PostKind = 'note' | 'trade' | 'find' | 'event';
export const POST_KINDS: { id: PostKind; emoji: string; label: string }[] = [
  { id: 'note', emoji: '💬', label: 'Nhắn' },
  { id: 'trade', emoji: '🛒', label: 'Rao bán' },
  { id: 'find', emoji: '🔎', label: 'Tìm đồ' },
  { id: 'event', emoji: '📣', label: 'Rủ rê' },
];
export const kindEmoji = (k: string) => POST_KINDS.find((x) => x.id === k)?.emoji ?? '💬';
export const kindLabel = (k: string) => POST_KINDS.find((x) => x.id === k)?.label ?? 'Nhắn';

export interface BoardPost {
  id: string;
  author: string;
  kind: PostKind;
  text: string;
  at: number;
  likes: string[];
}

interface BoardState {
  posts: BoardPost[];
  post: (kind: PostKind, text: string) => void;
  toggleLike: (id: string) => void;
  tick: (now: number) => void;
}

const clean = (s: string) => s.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
const dayStr = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const isFresh = (at: number) => Date.now() - at < 3 * 86400000;

function loadSaved(): { posts: BoardPost[]; liked: string[] } {
  try {
    const o = JSON.parse(localStorage.getItem(BOARD_KEY) ?? 'null');
    if (o && Array.isArray(o.posts)) {
      return {
        posts: o.posts.filter((p: BoardPost) => p && p.id && isFresh(p.at)).slice(0, 40),
        liked: Array.isArray(o.liked) ? o.liked : [],
      };
    }
  } catch { /* ignore */ }
  return { posts: [], liked: [] };
}

function persist(posts: BoardPost[]) {
  try {
    const liked: string[] = [];
    for (const p of posts) if (p.likes.includes(gameMe().name)) liked.push(p.id);
    localStorage.setItem(BOARD_KEY, JSON.stringify({ posts: posts.slice(0, 40), liked }));
  } catch { /* ignore */ }
}

/** điểm = số tim (trừ tim tự thả); hòa thì bài sớm hơn thắng */
function scoreOf(p: BoardPost): number {
  return p.likes.filter((n) => n !== p.author).length;
}
/** bài top của 1 ngày (YYYY-M-D) — null nếu không có tim nào */
export function topOfDay(posts: BoardPost[], day: string): BoardPost | null {
  let best: BoardPost | null = null;
  for (const p of posts) {
    if (dayStr(p.at) !== day) continue;
    const s = scoreOf(p);
    if (s <= 0) continue;
    if (!best || s > scoreOf(best) || (s === scoreOf(best) && (p.at < best.at || (p.at === best.at && p.id < best.id)))) {
      best = p;
    }
  }
  return best;
}

function handleMsg(m: { id: string; fromName: string; text: string }) {
  if (!markSeen(seen, m.id)) return;
  const parts = m.text.slice(BD.length).split('|');
  const kind = parts[0];
  if (kind === 'POST') {
    const [, id, author, k, ...rest] = parts;
    const text = clean(rest.join('|')).slice(0, 120);
    if (!id || !author || !text) return;
    const postKind: PostKind = k === 'trade' || k === 'find' || k === 'event' ? k : 'note';
    useBoard.setState((s) => {
      if (s.posts.some((p) => p.id === id)) return s;
      const posts = [{ id, author, kind: postKind, text, at: Date.now(), likes: [] }, ...s.posts]
        .filter((p) => isFresh(p.at)).slice(0, 40);
      persist(posts);
      return { posts };
    });
    return;
  }
  if (kind === 'LIKE' || kind === 'UNLIKE') {
    const [, postId, liker] = parts;
    if (!postId || !liker) return;
    useBoard.setState((s) => {
      const posts = s.posts.map((p) => {
        if (p.id !== postId) return p;
        if (liker === p.author) return p; // không tự tim bài mình
        const has = p.likes.includes(liker);
        if (kind === 'LIKE' && !has) return { ...p, likes: [...p.likes, liker] };
        if (kind === 'UNLIKE' && has) return { ...p, likes: p.likes.filter((n) => n !== liker) };
        return p;
      });
      persist(posts);
      return { posts };
    });
  }
}

onGameMsg(BD, handleMsg);

const saved = loadSaved();

let lastAwardCheck = '';
let lastRepost = 0;
const MINE_KEY = 'nongtrai-board-mine';
function mineIds(): string[] {
  try { return JSON.parse(localStorage.getItem(MINE_KEY) ?? '[]'); } catch { return []; }
}
function markMine(id: string) {
  try { localStorage.setItem(MINE_KEY, JSON.stringify([...mineIds(), id].slice(-40))); } catch { /* ignore */ }
}

export const useBoard = create<BoardState>()((set, get) => ({
  posts: saved.posts,

  post: (kind, text) => {
    const g = useGame.getState();
    const t = clean(text).slice(0, 120);
    if (!t) { sfx.error(); g.toast('Viết gì đó đã rồi hẵng ghim!'); return; }
    const p: BoardPost = { id: safeUid(), author: gameMe().name, kind, text: t, at: Date.now(), likes: [] };
    const posts = [p, ...get().posts].filter((x) => isFresh(x.at)).slice(0, 40);
    set({ posts });
    persist(posts);
    markMine(p.id);
    sendGameMsg(`${BD}POST|${p.id}|${p.author}|${p.kind}|${t}`);
    g.toast('📌 Ghim tin lên bảng làng!');
    sfx.click();
  },

  toggleLike: (id) => {
    const me = gameMe().name;
    const p = get().posts.find((x) => x.id === id);
    if (!p || p.author === me) return;
    const liking = !p.likes.includes(me);
    const posts = get().posts.map((x) => (x.id === id
      ? { ...x, likes: liking ? [...x.likes, me] : x.likes.filter((n) => n !== me) }
      : x));
    set({ posts });
    persist(posts);
    sendGameMsg(`${BD}${liking ? 'LIKE' : 'UNLIKE'}|${id}|${me}`);
    if (liking) sfx.click();
  },

  tick: (now) => {
    // phát lại bài của mình mỗi 60s (làng mới vào vẫn thấy + đồng bộ tên hiện tại)
    if (now - lastRepost > 60000) {
      lastRepost = now;
      const mine = new Set(mineIds());
      const me = gameMe().name;
      const posts = get().posts.map((p) => (mine.has(p.id) && p.author !== me ? { ...p, author: me } : p));
      for (const p of posts) {
        if (mine.has(p.id) && isFresh(p.at)) {
          sendGameMsg(`${BD}POST|${p.id}|${me}|${p.kind}|${clean(p.text)}`);
        }
      }
      if (posts.some((p, i) => p !== get().posts[i])) { set({ posts }); persist(posts); }
    }
    // mỗi ngày chốt 1 lần: ai top tim hôm qua mà là mình thì lĩnh thưởng
    const today = dayStr(Date.now());
    if (lastAwardCheck === today) return;
    lastAwardCheck = today;
    let claimed = '';
    try { claimed = localStorage.getItem(WIN_KEY) ?? ''; } catch { /* ignore */ }
    const y = new Date(Date.now() - 86400000);
    const yDay = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    if (claimed === yDay) return;
    const top = topOfDay(get().posts, yDay);
    if (top && top.author === gameMe().name) {
      try { localStorage.setItem(WIN_KEY, yDay); } catch { /* ignore */ }
      const g = useGame.getState();
      g.addXu(TOP_XU);
      sfx.lvup();
      g.toast(`🏆 Bài của bạn nhiều tim nhất hôm qua! Danh hiệu "Dân làng yêu quý" +${TOP_XU} xu!`);
    }
  },
}));
