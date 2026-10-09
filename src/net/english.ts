// ===== NPC CÔ GIÁO TIẾNG ANH (đi lang thang ở thị trấn) =====
// Cô Mai liên tục hỏi từ vựng TOEIC ("xin chào" tiếng Anh là gì?).
// Sau mỗi câu hỏi đếm ngược 30s: ai chat đúng đáp án (hi/hello...) nhận
// 100 xu + 1 gem. Cô tự đi dạo quanh thị trấn, tránh nhà cửa.
import { create } from 'zustand';
import { TOEIC } from '../game/toeic';
import { TOWN, isTownBlocked } from '../game/town';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { gameMe } from './village';

export const TEACHER_NAME = 'Cô Mai 📚';
export const EN_ASK_MS = 30000;
export const EN_GAP_MS = 6000;
export const EN_REWARD_XU = 100;
export const EN_REWARD_GEM = 1;

interface EnQ {
  vi: string;
  en: string;
  accepts: string[];
  expiresAt: number;
  answered: boolean;
}

interface EnglishState {
  tx: number; ty: number; tdir: 1 | -1; tmoving: boolean;
  q: EnQ | null;
  nextAt: number;
  flash: string | null;
  flashUntil: number;
  /** câu hỏi trên đầu cô (kèm đếm ngược) — GameCanvas vẽ mỗi frame */
  bubble: () => string;
  tick: (dt: number, now: number) => void;
  /** soi tin chat: đúng đáp án trong 30s thì thưởng */
  checkChat: (from: string, text: string, now: number) => void;
}

let wx = 800, wy = 780;

function parseRow(row: string): { en: string; vi: string; accepts: string[] } {
  const [en = '', vi = '', alt = ''] = row.split('|');
  const accepts = [en, ...(alt ? alt.split('/').map((s) => s.trim()).filter(Boolean) : [])];
  return { en: en.trim(), vi: vi.trim(), accepts };
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');
}

function pickSpot(): { x: number; y: number } {
  for (let k = 0; k < 24; k++) {
    const x = 90 + Math.random() * (TOWN.w - 180);
    const y = 140 + Math.random() * (TOWN.h - 280);
    if (!isTownBlocked(x, y)) return { x, y };
  }
  return { x: 800, y: 780 };
}

function ask(st: EnglishState, now: number) {
  const row = TOEIC[(Math.random() * TOEIC.length) | 0];
  const w = parseRow(row);
  useEnglish.setState({
    q: { vi: w.vi, en: w.en, accepts: w.accepts, expiresAt: now + EN_ASK_MS, answered: false },
    flash: null,
  });
}

export const useEnglish = create<EnglishState>()((set, get) => ({
  tx: 800, ty: 780, tdir: 1, tmoving: false,
  q: null,
  nextAt: 0,
  flash: null,
  flashUntil: 0,

  bubble: () => {
    const s = get();
    const now = Date.now();
    if (s.q && !s.q.answered && now < s.q.expiresAt) {
      const left = Math.ceil((s.q.expiresAt - now) / 1000);
      return `📚 ${s.q.vi} là gì trong tiếng Anh = ? (${left}s)`;
    }
    if (s.q?.answered) return '🎉 Đúng rồi! Giỏi quá!';
    if (s.flash && now < s.flashUntil) return s.flash;
    return '📚 Đoán từ vựng cùng cô!';
  },

  tick: (dt: number, now: number) => {
    const s = get();
    // --- cô đi dạo tới điểm hẹn, tới nơi thì chọn điểm mới ---
    const dx = wx - s.tx, dy = wy - s.ty;
    const d = Math.hypot(dx, dy);
    if (d < 10) {
      const p = pickSpot();
      wx = p.x; wy = p.y;
      if (s.tmoving) set({ tmoving: false });
    } else {
      const step = 70 * dt;
      const nx = s.tx + (dx / d) * step, ny = s.ty + (dy / d) * step;
      if (!isTownBlocked(nx, ny)) {
        set({
          tx: nx, ty: ny, tmoving: true,
          tdir: Math.abs(dx) > 4 ? (dx > 0 ? 1 : -1) : s.tdir,
        });
      } else {
        const p = pickSpot();
        wx = p.x; wy = p.y;
      }
    }
    // --- vòng hỏi/đáp ---
    if (s.q && !s.q.answered && now >= s.q.expiresAt) {
      // hết 30s không ai trả lời đúng: công bố đáp án rồi hỏi câu mới
      set({ q: null, flash: `⏰ Đáp án: ${s.q.en}!`, flashUntil: now + 5000, nextAt: now + EN_GAP_MS });
      return;
    }
    if ((!s.q || s.q.answered) && now >= s.nextAt) ask(s, now);
  },

  checkChat: (from: string, text: string, now: number) => {
    const s = get();
    if (from !== gameMe().name) return; // chỉ chấm bài của chính mình
    if (!s.q || s.q.answered || now >= s.q.expiresAt) return;
    const ans = norm(text);
    if (!ans) return;
    const ok = s.q.accepts.some((a) => norm(a) === ans);
    if (!ok) return;
    const g = useGame.getState();
    g.addXu(EN_REWARD_XU);
    g.addGem(EN_REWARD_GEM);
    sfx.lvup();
    g.toast(`📚 Cô Mai: Đúng rồi! "${s.q.en}" +${EN_REWARD_XU} xu +${EN_REWARD_GEM} gem!`);
    set({ q: { ...s.q, answered: true }, nextAt: now + EN_GAP_MS });
  },
}));
