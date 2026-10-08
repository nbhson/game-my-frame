import { useCallback, useEffect, useState } from 'react';
import { useGame } from './game/store';
import { useVillage } from './net/village';
import type { InteractTarget } from './game/types';
import MenuScreen from './components/MenuScreen';
import HUD from './components/HUD';
import GameCanvas from './components/GameCanvas';
import BottomBar from './components/BottomBar';
import ModalHost from './components/ModalHost';
import Toasts from './components/Toasts';
import VisitBanner from './components/VisitBanner';
import ContestBoard from './components/ContestBoard';

export default function App() {
  const started = useGame((s) => s.started);
  const [target, setTarget] = useState<InteractTarget | null>(null);
  const onTarget = useCallback((t: InteractTarget | null) => setTarget(t), []);

  // link mời kiểu Avatar: ?visit=ABC123 → vào game rồi tự qua thăm farm bạn
  // connect dò mạng mất ~2s nên thử lại vài lần thay vì 1 lần duy nhất
  useEffect(() => {
    if (!started) return;
    const code = new URLSearchParams(window.location.search).get('visit');
    if (!code || code.length < 4) return;
    let tries = 0;
    let cancelled = false;
    const timer = setInterval(() => {
      if (cancelled) return;
      tries++;
      const v = useVillage.getState();
      if (v.visiting) { clearInterval(timer); return; }
      void v.visit(code).then((ok) => { if (ok || tries >= 6) clearInterval(timer); });
      if (tries >= 6) clearInterval(timer);
    }, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [started]);

  // ngắt làng khi về menu
  useEffect(() => {
    if (!started) useVillage.getState().disconnect();
  }, [started ]);

  if (!started) return <MenuScreen />;

  return (
    <div className="h-full flex flex-col bg-[#223322]">
      <HUD />
      <div className="relative flex-1 min-h-0 flex items-center justify-center bg-[#101d10] overflow-hidden">
        <GameCanvas onTarget={onTarget} target={target} />
        <VisitBanner />
        <ContestBoard />
      </div>
      <BottomBar target={target} />
      <ModalHost />
      <Toasts />
    </div>
  );
}
