// ===== ĐÁM CƯỚI NHÀ VĂN HÓA (map thị trấn) =====
// 2 người đứng trong khuôn viên nhà văn hóa + cùng bấm 💍 → ai phát hiện
// trước gửi PROPOSE, cả làng cùng mở lễ 45s: mưa hoa + tim rơi, khách bấm
// emote bất kỳ gần đó được tính là "tung hoa chúc mừng".
// Chốt lễ (mỗi máy tự tính): cô dâu chú rể +200 xu +1 gem, khách dự +50 xu lộc.
// Phí tổ chức: mỗi người 100 xu (trừ khi nhận lễ).
import { create } from 'zustand';
import { gameMe, markSeen, onGameMsg, sendGameMsg, useVillage } from './village';
import { useGame } from '../game/store';
import { CULTURE_HALL } from '../game/town';
import { sfx } from '../game/audio';
import type { RemotePlayer } from './transport';

const CW = '💒CW|';
const seen = new Set<string>();

export const WED_DURATION = 45000;
const WED_COOLDOWN = 180000;
const WED_FEE = 100;
const WED_GIFT_XU = 200;
const WED_GIFT_GEM = 1;
const GUEST_LUCKY = 50;

export const CULTURE_CX = CULTURE_HALL.x + CULTURE_HALL.w / 2;
export const CULTURE_CY = CULTURE_HALL.y + CULTURE_HALL.h + 20;
/** khuôn viên nhà văn hóa (đứng trong này cầu hôn mới linh) */
export function inCultureZone(x: number, y: number): boolean {
  return x > CULTURE_HALL.x - 60 && x < CULTURE_HALL.x + CULTURE_HALL.w + 60
    && y > CULTURE_HALL.y - 60 && y < CULTURE_HALL.y + CULTURE_HALL.h + 90;
}

export interface WedFx { x: number; y: number; emoji: string; vx: number; vy: number; life: number }
const FX_EMOJI = ['🌸', '🌺', '❤️', '💖', '💍', '✨'];

interface WeddingState {
  ceremony: { a: string; b: string; startsAt: number } | null;
  guests: string[];
  fx: WedFx[];
  cooldownUntil: number;
  tick: (now: number, dt: number, ctx: {
    px: number; py: number; emote: string; emoteAt: number;
    players: RemotePlayer[];
  }) => void;
}

function handleMsg(m: { id: string; fromName: string; text: string }) {
  if (!markSeen(seen, m.id)) return;
  const parts = m.text.slice(CW.length).split('|');
  if (parts[0] !== 'PROPOSE') return;
  const [, a, b] = parts;
  if (!a || !b) return;
  const me = gameMe().name;
  const st = useWedding.getState();
  const now = Date.now();
  if (st.ceremony || now < st.cooldownUntil) return; // lễ trùng → bỏ qua (chống double fee)
  useWedding.setState({ ceremony: { a, b, startsAt: now }, guests: [], fx: [] });
  fxWork = [];
  const g = useGame.getState();
  if (me === a || me === b) {
    if (g.xu >= WED_FEE) {
      g.addXu(-WED_FEE);
      g.toast(`💒 Lễ cưới của bạn mở rồi! Phí tổ chức −${WED_FEE} xu — mời cả làng tới chung vui!`);
    } else {
      g.toast('💒 Lễ cưới của bạn mở rồi! Làng miễn phí tổ chức lần này!');
    }
    sfx.lvup();
    if (me === a) {
      // người khởi xướng hô 1 câu mừng cho cả làng (chỉ 1 máy hô)
      try { useVillage.getState().sendChat(`💒 ${a} ❤️ ${b} — cả làng tới nhà văn hóa chung vui nào!`); } catch { /* ignore */ }
    }
  } else {
    g.toast(`💒 ${a} ❤️ ${b} thành đôi! Tới nhà văn hóa bấm emote tung hoa nhận lộc!`);
    sfx.coin();
  }
}

onGameMsg(CW, handleMsg);

let spawnAcc = 0;
let lastFxPush = 0;
let fxWork: WedFx[] = [];

export const useWedding = create<WeddingState>()((set, get) => ({
  ceremony: null,
  guests: [],
  fx: [],
  cooldownUntil: 0,

  tick: (now, dt, ctx) => {
    const s = get();
    const g = useGame.getState();

    if (s.ceremony) {
      const { a, b, startsAt } = s.ceremony;
      const elapsed = now - startsAt;
      // mưa hoa + tim quanh sân nhà văn hóa (vật lý local, đẩy ra render 10 lần/s)
      spawnAcc += dt * 28;
      if (spawnAcc >= 1) {
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          fxWork.push({
            x: CULTURE_CX + (Math.random() - 0.5) * 260,
            y: CULTURE_CY - 40 - Math.random() * 60,
            emoji: FX_EMOJI[(Math.random() * FX_EMOJI.length) | 0],
            vx: (Math.random() - 0.5) * 30,
            vy: 34 + Math.random() * 40,
            life: 2.2 + Math.random(),
          });
        }
        if (fxWork.length > 150) fxWork = fxWork.slice(-150);
      }
      fxWork = fxWork.map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt }))
        .filter((p) => p.life > 0);
      if (now - lastFxPush > 100) { lastFxPush = now; set({ fx: fxWork }); }

      // khách tung hoa = bấm emote tươi gần sân khấu
      const guests = [...s.guests];
      let changed = false;
      for (const p of ctx.players) {
        if (p.name === a || p.name === b || guests.includes(p.name)) continue;
        if (!p.emote || now - (p.emoteAt ?? 0) > 4000) continue;
        if (Math.hypot(p.x - CULTURE_CX, p.y - CULTURE_CY) > 450) continue;
        guests.push(p.name);
        changed = true;
      }
      // chính mình cũng tính nếu bấm emote gần đó
      const me = gameMe().name;
      if (me !== a && me !== b && !guests.includes(me)
        && ctx.emote && now - ctx.emoteAt < 4000
        && Math.hypot(ctx.px - CULTURE_CX, ctx.py - CULTURE_CY) < 450) {
        guests.push(me);
        changed = true;
      }
      if (changed) set({ guests });

      // hết 45s: chốt lễ, ai tự thưởng nấy
      if (elapsed >= WED_DURATION) {
        const mine = gameMe().name;
        if (mine === a || mine === b) {
          g.addXu(WED_GIFT_XU);
          g.addGem(WED_GIFT_GEM);
          sfx.lvup();
          g.toast(`💒 Trăm năm hạnh phúc! Quà mừng +${WED_GIFT_XU} xu +${WED_GIFT_GEM} gem! (${get().guests.length} khách chúc mừng)`);
        } else if (get().guests.includes(mine)) {
          g.addXu(GUEST_LUCKY);
          sfx.coin();
          g.toast(`🧧 Đi ăn cưới có lộc! +${GUEST_LUCKY} xu cảm ơn bạn đã tung hoa!`);
        }
        set({ ceremony: null, guests: [], fx: [], cooldownUntil: now + WED_COOLDOWN });
        fxWork = [];
      }
      return;
    }

    // rình cầu hôn: mình + ai đó cùng 💍 tươi trong khuôn viên + đứng gần
    if (now < s.cooldownUntil) return;
    if (!ctx.emote.includes('💍') || now - ctx.emoteAt > 4000) return;
    if (!inCultureZone(ctx.px, ctx.py)) return;
    const me = gameMe().name;
    for (const p of ctx.players) {
      if (!p.emote || !p.emote.includes('💍') || now - (p.emoteAt ?? 0) > 4000) continue;
      if (!inCultureZone(p.x, p.y)) continue;
      if (Math.hypot(ctx.px - p.x, ctx.py - p.y) > 220) continue;
      // ai phát hiện trước gửi trước; lễ trùng tới sau tự bỏ qua (không double fee)
      const pair = [me, p.name].sort();
      sendGameMsg(`${CW}PROPOSE|${pair[0]}|${pair[1]}`);
      return;
    }
  },
}));
