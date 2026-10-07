import { useState } from 'react';
import { Send, Tractor } from 'lucide-react';
import { QUESTS } from '../game/data';
import { useGame } from '../game/store';
import { TOWN_EMOTES } from '../game/town';
import type { InteractTarget } from '../game/types';
import { doInteractWith, goToFarm } from './GameCanvas';
import { useVillage } from '../net/village';
import { GameIcon } from './GameIcon';

export default function BottomBar({ target }: { target: InteractTarget | null }) {
  const scene = useGame((s) => s.scene);
  if (scene === 'town') return <TownBottomBar target={target} />;
  return <FarmBottomBar target={target} />;
}

function FarmBottomBar({ target }: { target: InteractTarget | null }) {
  const inv = useGame((s) => s.inv);
  const questIdx = useGame((s) => s.questIdx);
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
    <div className="flex gap-2 items-center bg-[#2b2117] px-2 py-1.5">
      <div className="flex gap-1.5">
        {slots.map(([ic, n, c]) => (
          <div key={n} title={n} className="w-[52px] h-[52px] bg-[#3e3428] border-[3px] border-black rounded-lg flex flex-col items-center justify-center text-white cursor-pointer hover:border-yellow-300">
            <GameIcon name={ic} size={22} />
            <span className="text-[10px] text-yellow-300 font-extrabold">{c}</span>
          </div>
        ))}
        <button
          onClick={() => doInteractWith(target)}
          className="h-[52px] px-4 rounded-lg bg-yellow-300 border-[3px] border-black font-black text-lg hover:bg-yellow-200 active:scale-95 max-md:hidden"
        >
          E
        </button>
      </div>
      <div className="flex-1 bg-[#fff8dc] border-2 border-yellow-300 rounded-lg px-3 py-1.5 text-[13px] font-semibold truncate flex items-center gap-1.5">
        <GameIcon name="sprout" size={18} /><span className="truncate">Nhiệm vụ: {cur ? cur.text : 'Hoàn thành tất cả! Bạn là tỷ phú'}</span>
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
    <div className="flex gap-2 items-center bg-[#5b2a86] px-2 py-1.5 flex-wrap">
      <button
        onClick={() => goToFarm()}
        className="h-[52px] px-3 rounded-lg bg-green-500 border-[3px] border-black font-black text-white text-sm hover:bg-green-400 active:scale-95 flex items-center gap-1"
        title="Về nông trại (cổng phía đông)"
      >
        <Tractor size={18} /> Farm
      </button>
      <button
        onClick={() => doInteractWith(target)}
        className="h-[52px] px-4 rounded-lg bg-yellow-300 border-[3px] border-black font-black text-lg hover:bg-yellow-200 active:scale-95 max-md:hidden"
        title={target ? target.label : 'Lại gần điểm sáng để tương tác'}
      >
        E
      </button>
      {/* chat realtime */}
      <div className="flex gap-1 items-center flex-1 min-w-[200px]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 80))}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); e.stopPropagation(); }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder={target ? `E: ${target.label} — hoặc chat…` : 'Chat với cả công viên… (Enter)'}
          className="flex-1 border-[3px] border-black rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={send} className="h-[44px] px-3 rounded-lg bg-sky-400 border-[3px] border-black font-black text-white hover:bg-sky-300 active:scale-95" title="Gửi chat">
          <Send size={16} />
        </button>
      </div>
      {/* cảm xúc realtime */}
      <div className="flex gap-1">
        {TOWN_EMOTES.map((e) => (
          <button
            key={e.id}
            title={e.label}
            onClick={() => sendEmote(e.emoji)}
            className="w-[44px] h-[44px] text-xl bg-white border-[3px] border-black rounded-lg hover:scale-110 active:scale-95 transition-transform"
          >
            {e.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
