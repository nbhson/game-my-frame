// ===== Panel hành động trong nhà: timing / hold / dialog / list =====
// Nhỏ gọn dưới màn hình (không phải modal toàn màn hình): vừa chơi vừa thấy phòng.
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { finishHold, runDialogChoice, runListItem, stopTiming } from '../game/interiorActions';
import { playerRef } from './GameCanvas';

const PANEL = 'absolute left-1/2 -translate-x-1/2 bottom-2 md:bottom-3 z-[6] w-[min(94vw,430px)] bg-[#fff8dc] border-[3px] border-[#2b2117] rounded-2xl shadow-pixel px-3 py-2 md:px-4 md:py-3';

function scoreOf(v: number): number {
  if (v >= 46 && v <= 54) return 100;
  if (v >= 36 && v <= 64) return 60;
  return 20;
}

function TimingPanel({ furn, total, done, score, title, sub }: { furn: string; total: number; done: number; score: number; title: string; sub?: string }) {
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const el = (now - t0) / 1100; // 1.1s một lượt
      const tri = el % 2;
      const v = (tri < 1 ? tri : 2 - tri) * 100;
      posRef.current = v; setPos(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done]);
  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'e' || k === ' ') { e.preventDefault(); fire(); }
    };
    const fire = () => stopTiming(scoreOf(posRef.current), playerRef.x, playerRef.y);
    window.addEventListener('keydown', stop);
    return () => window.removeEventListener('keydown', stop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [furn, done]);
  return (
    <div className={PANEL}>
      <div className="font-extrabold text-sm md:text-base">{title}</div>
      {sub && <div className="text-[11px] md:text-xs opacity-70">{sub}</div>}
      <div className="flex gap-1 my-1">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i < done ? 'bg-green-500' : 'bg-[#e5d5a8]'}`} />
        ))}
      </div>
      <div className="relative h-6 md:h-7 rounded-lg overflow-hidden border-2 border-[#2b2117]" style={{ background: 'linear-gradient(90deg,#e05555 0%,#e05555 36%,#f2d06b 36%,#f2d06b 46%,#37c837 46%,#37c837 54%,#f2d06b 54%,#f2d06b 64%,#e05555 64%,#e05555 100%)' }}>
        <div className="absolute top-0 bottom-0 w-1.5 bg-white border border-[#2b2117]" style={{ left: `calc(${pos}% - 3px)` }} />
      </div>
      <button
        onClick={() => stopTiming(scoreOf(posRef.current), playerRef.x, playerRef.y)}
        className="mt-1.5 w-full py-1.5 rounded-xl bg-amber-400 border-[3px] border-[#2b2117] font-black text-sm md:text-base active:scale-95"
      >
        DỪNG! (E)
      </button>
    </div>
  );
}

function HoldPanel({ title, sub, secs }: { title: string; sub?: string; secs: number }) {
  const [frac, setFrac] = useState(0);
  const st = useRef<{ on: boolean; t0: number }>({ on: false, t0: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (st.current.on) {
        const f = (performance.now() - st.current.t0) / 1000 / secs;
        if (f >= 1) { st.current.on = false; setFrac(1); finishHold(playerRef.x, playerRef.y); }
        else setFrac(f);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const dn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' && !e.repeat) { e.preventDefault(); start(); }
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') stop(); };
    const start = () => { st.current = { on: true, t0: performance.now() }; };
    const stop = () => { st.current.on = false; setFrac(0); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs]);
  return (
    <div className={PANEL}>
      <div className="font-extrabold text-sm md:text-base">{title}</div>
      {sub && <div className="text-[11px] md:text-xs opacity-70">{sub}</div>}
      <div className="h-4 md:h-5 rounded-full border-2 border-[#2b2117] bg-[#e5d5a8] overflow-hidden my-1.5">
        <div className="h-full bg-gradient-to-r from-amber-400 to-green-500 transition-none" style={{ width: `${frac * 100}%` }} />
      </div>
      <button
        onPointerDown={() => { st.current = { on: true, t0: performance.now() }; }}
        onPointerUp={() => { st.current.on = false; setFrac(0); }}
        onPointerLeave={() => { if (st.current.on) { st.current.on = false; setFrac(0); } }}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full py-2 rounded-xl bg-green-500 text-white border-[3px] border-[#2b2117] font-black text-sm md:text-base active:scale-95 select-none touch-none"
      >
        GIỮ CHẶT! (hoặc giữ Space)
      </button>
    </div>
  );
}

export default function InteriorOverlay() {
  const inAct = useGame((s) => s.inAct);
  const [, force] = useState(0);
  // list cần refresh số lượng khi kho đổi: re-render khi inAct đổi là đủ (mỗi action tự reopen)
  useEffect(() => { force((x) => x + 1); }, [inAct]);
  if (!inAct) return null;
  if (inAct.mode === 'timing' && inAct.rhythm) {
    return <TimingPanel furn={inAct.furn} total={inAct.rhythm.total} done={inAct.rhythm.done} score={inAct.rhythm.score} title={inAct.title} sub={inAct.sub} />;
  }
  if (inAct.mode === 'hold') {
    return <HoldPanel title={inAct.title} sub={inAct.sub} secs={inAct.holdSecs ?? 2} />;
  }
  if (inAct.mode === 'dialog' && inAct.dialog) {
    return (
      <div className={PANEL}>
        <div className="font-extrabold text-sm md:text-base">💬 {inAct.title}</div>
        {inAct.dialog.lines.map((l, i) => (
          <div key={i} className="text-[12px] md:text-sm italic my-1">“{l}”</div>
        ))}
        <div className="flex flex-col gap-1 mt-1">
          {inAct.dialog.choices.map((c) => (
            <button
              key={c.run}
              onClick={() => runDialogChoice(c.run)}
              className="text-left px-2 py-1 rounded-lg bg-amber-100 border-2 border-[#2b2117] text-[12px] md:text-sm font-bold active:scale-[.98] hover:bg-amber-200"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (inAct.mode === 'list' && inAct.list) {
    return (
      <div className={PANEL}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-extrabold text-sm md:text-base">{inAct.title}</div>
            {inAct.sub && <div className="text-[11px] md:text-xs opacity-70">{inAct.sub}</div>}
          </div>
          <button
            onClick={() => useGame.getState().setInAct(null)}
            className="px-2 py-0.5 rounded-lg bg-[#e5d5a8] border-2 border-[#2b2117] font-black text-sm"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-1 mt-1.5 max-h-44 md:max-h-56 overflow-y-auto">
          {inAct.list.items.map((it) => (
            <button
              key={it.id}
              disabled={it.disabled}
              onClick={() => runListItem(inAct.list!.action, it.id, playerRef.x, playerRef.y)}
              className={`text-left px-2 py-1 rounded-lg border-2 border-[#2b2117] text-[12px] md:text-sm active:scale-[.98] ${it.disabled ? 'bg-stone-200 opacity-60' : 'bg-amber-100 hover:bg-amber-200'}`}
            >
              <span className="font-bold">{it.tag ? `[${it.tag}] ` : ''}{it.label}</span>
              <span className="block opacity-70 text-[11px] md:text-xs">{it.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
