import { useEffect, useState } from 'react';
import { Send, Tractor } from 'lucide-react';
import { QUESTS } from '../game/data';
import { useGame } from '../game/store';
import { TOWN_EMOTES } from '../game/town';
import type { InteractTarget } from '../game/types';
import { doInteractWith, goToFarm, playerRef } from './GameCanvas';
import { useVillage, visiblePlayers } from '../net/village';
import { GameIcon } from './GameIcon';

export default function BottomBar({ target }: { target: InteractTarget | null }) {
  const scene = useGame((s) => s.scene);
  if (scene === 'town') return <TownBottomBar target={target} />;
  return <FarmBottomBar target={target} />;
}

function FarmBottomBar({ target }: { target: InteractTarget | null }) {
  const inv = useGame((s) => s.inv);
  const questIdx = useGame((s) => s.questIdx);
  const setModal = useGame((s) => s.setModal);
  const cur = QUESTS[Math.min(questIdx, QUESTS.length - 1)];

  const seedTotal = Object.keys(inv).filter((k) => k.startsWith('seed:')).reduce((a, k) => a + inv[k], 0);
  const prodTotal = Object.keys(inv)
    .filter((k) => !k.startsWith('seed:') && !k.startsWith('baby') && k !== 'feed' && k !== 'bait')
    .reduce((a, k) => a + inv[k], 0);
  const slots: [string, string, number][] = [
    ['seed', 'Hạt', seedTotal],
    ['feed', 'T.ăn', inv.feed || 0],
    ['bait', 'Mồi', inv.bait || 0],
    ['basket', 'SP', prodTotal],
  ];

  return (
    <div className="bg-[#2b2117] px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
      {/* hàng tools: cuộn ngang trên mobile, không đẩy tràn màn hình */}
      <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar -mx-2 px-2 md:mx-0 md:px-0 md:overflow-visible" style={{ touchAction: 'pan-x' }}>
        {slots.map(([ic, n, c]) => (
          <div key={n} title={n} className="w-11 h-11 md:w-[52px] md:h-[52px] shrink-0 bg-[#3e3428] border-[3px] border-black rounded-lg flex flex-col items-center justify-center text-white cursor-pointer hover:border-yellow-300">
            <GameIcon name={ic} size={20} />
            <span className="text-[10px] text-yellow-300 font-extrabold leading-none">{c}</span>
          </div>
        ))}
        <button
          onClick={() => doInteractWith(target)}
          className="h-11 md:h-[52px] px-4 shrink-0 rounded-lg bg-yellow-300 border-[3px] border-black font-black text-lg hover:bg-yellow-200 active:scale-95 max-md:hidden"
        >
          E
        </button>
        <button
          onClick={() => setModal({ name: 'bulk' })}
          className="h-11 md:h-[52px] px-3 shrink-0 rounded-lg bg-orange-400 border-[3px] border-black font-black text-[13px] md:text-sm text-white hover:bg-orange-300 active:scale-95 whitespace-nowrap"
          title="Làm hàng loạt: gieo/tưới/phun/thu cả farm, cho ăn cả đàn 1 chạm"
        >
          ⚡ Hàng loạt
        </button>
      </div>
      {/* hàng nhiệm vụ: full width, gọn trên mobile */}
      <div className="flex-1 min-w-0 bg-[#fff8dc] border-2 border-yellow-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-[12px] md:text-[13px] font-semibold truncate flex items-center gap-1.5">
        <GameIcon name="sprout" size={16} /><span className="truncate">Nhiệm vụ: {cur ? cur.text : 'Hoàn thành tất cả! Bạn là tỷ phú'}</span>
      </div>
    </div>
  );
}

/** Bottom công viên: chat realtime + thả cảm xúc + về farm (khác hẳn farm) */
function TownBottomBar({ target }: { target: InteractTarget | null }) {
  const sendChat = useVillage((s) => s.sendChat);
  const sendEmote = useVillage((s) => s.sendEmote);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    sendChat(draft);
    setDraft('');
  };

  return (
    <div className="bg-[#5b2a86] px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] flex flex-col gap-1.5">
      {/* hàng 1: về farm + chat — luôn vừa màn hình */}
      <div className="flex gap-1.5 items-center min-w-0">
        <button
          onClick={() => goToFarm()}
          className="h-11 md:h-[52px] px-2 md:px-3 shrink-0 rounded-lg bg-green-500 border-[3px] border-black font-black text-white text-[13px] md:text-sm hover:bg-green-400 active:scale-95 flex items-center gap-1"
          title="Về nông trại (cổng phía đông)"
        >
          <Tractor size={16} /><span className="hidden xs:inline sm:inline">Farm</span>
        </button>
        <button
          onClick={() => doInteractWith(target)}
          className="h-11 md:h-[52px] px-4 shrink-0 rounded-lg bg-yellow-300 border-[3px] border-black font-black text-lg hover:bg-yellow-200 active:scale-95 max-md:hidden"
          title={target ? target.label : 'Lại gần điểm sáng để tương tác'}
        >
          E
        </button>
        {/* chat realtime */}
        <div className="flex gap-1 items-center flex-1 min-w-0">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 80))}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); e.stopPropagation(); }}
            onKeyUp={(e) => e.stopPropagation()}
            placeholder={target ? `E: ${target.label} — hoặc chat…` : 'Chat cả park… (Enter)'}
            className="flex-1 min-w-0 border-[3px] border-black rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-[13px] md:text-sm"
          />
          <button onClick={send} className="h-10 md:h-[44px] px-2.5 md:px-3 shrink-0 rounded-lg bg-sky-400 border-[3px] border-black font-black text-white hover:bg-sky-300 active:scale-95" title="Gửi chat">
            <Send size={16} />
          </button>
        </div>
      </div>
      {/* hàng 2: cảm xúc — cuộn ngang trên mobile thay vì wrap tràn */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-2 px-2 pb-0.5 md:flex-wrap md:mx-0 md:px-0 md:overflow-visible" style={{ touchAction: 'pan-x' }}>
        {TOWN_EMOTES.map((e) => (
          <button
            key={e.id}
            title={`${e.label} — đứng gần bạn + cùng bấm để diễn chung!`}
            onClick={() => sendEmote(e.emoji)}
            className="w-10 h-10 md:w-[44px] md:h-[44px] shrink-0 text-lg md:text-xl bg-white border-[3px] border-black rounded-lg hover:scale-110 active:scale-95 transition-transform"
          >
            {e.emoji}
          </button>
        ))}
      </div>
      <PairHint />
    </div>
  );
}

/** Gợi ý hành động đôi: đứng gần ai thì rủ cùng bấm emote để diễn hoạt ảnh chung */
function PairHint() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();
  const near = visiblePlayers(now, 'town').filter(
    (p) => Math.hypot(p.x - playerRef.x, p.y - playerRef.y) < 260,
  );
  if (!near.length) return null;
  const names = near.slice(0, 2).map((p) => p.name).join(', ');
  return (
    <div className="text-[11px] font-bold text-yellow-200 animate-pulse truncate px-1">
      Đứng gần {names} — cùng bấm 🥊 🤗 🤝 💋 👋 để diễn chung!
    </div>
  );
}
