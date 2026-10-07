import { QUESTS } from '../game/data';
import { useGame } from '../game/store';
import { GameIcon } from './GameIcon';

export default function QuestModal() {
  const questIdx = useGame((s) => s.questIdx);
  return (
    <div>
      {QUESTS.map((q, i) => {
        const done = i < questIdx;
        const cur = i === questIdx;
        return (
          <div key={q.id} className={`border-[3px] rounded-lg p-2.5 mb-2 bg-white ${done ? 'opacity-70 border-green-600' : cur ? 'border-yellow-500' : 'border-[#2b2117]'}`}>
            <b className="flex items-center gap-1.5">{done ? <GameIcon name="check" size={17} /> : cur ? <GameIcon name="star" size={17} /> : <GameIcon name="lock" size={15} />} NV{i + 1}: {q.text}</b>
            <br />
            <small className="flex items-center gap-1 flex-wrap"><GameIcon name="gift" size={15} /> {q.reward.xu ? `+${q.reward.xu} xu ` : ''}{q.reward.gem ? (<span className="inline-flex items-center gap-0.5">+{q.reward.gem} <GameIcon name="gem" size={12} /></span>) : ''}{q.reward.xp ? `+${q.reward.xp} XP` : ''}</small>
          </div>
        );
      })}
      <button className="pixel-btn !text-[10px] !bg-stone-300" onClick={() => useGame.getState().setModal(null)}>Đóng</button>
    </div>
  );
}
