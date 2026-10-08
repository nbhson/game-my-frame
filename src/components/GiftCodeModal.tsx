import { useState } from 'react';
import { useGame } from '../game/store';
import { GIFTCODES, normalizeCode, rewardSummary, type GiftReward } from '../game/giftcodes';
import { itemName } from '../game/data';
import { GameIcon, iconForPid } from './GameIcon';
import { sfx } from '../game/audio';

export default function GiftCodeModal() {
  const redeemCode = useGame((s) => s.redeemCode);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // quà vừa nhận được — chỉ hiện SAU KHI nhận thành công, không spoil trước
  const [lastWin, setLastWin] = useState<{ code: string; reward: GiftReward } | null>(null);

  const submit = (code: string) => {
    const key = normalizeCode(code);
    const r = redeemCode(code);
    setMsg({ ok: r.ok, text: r.msg });
    if (r.ok) {
      setDraft('');
      const reward = GIFTCODES[key];
      if (reward) setLastWin({ code: key, reward });
    } else {
      sfx.error();
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value.slice(0, 24)); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(draft); e.stopPropagation(); }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder="Nhập code của bạn…"
          className="flex-1 text-center font-bold border-[3px] border-[#2b2117] rounded-md p-2"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button
          className="pixel-btn !bg-green-500 !text-white shrink-0"
          onClick={() => submit(draft)}
          disabled={!normalizeCode(draft)}
        >
          Nhận quà
        </button>
      </div>
      {msg && (
        <div className={`text-sm font-bold text-center rounded-lg border-2 px-2 py-1.5 mb-2 ${msg.ok ? 'bg-green-100 border-green-600 text-green-800' : 'bg-red-100 border-red-400 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      {/* Chi tiết quà vừa nhận — chỉ hiện sau khi nhận thành công */}
      {lastWin && (
        <div className="border-[3px] border-green-600 bg-green-50 rounded-lg p-2.5 mb-2">
          <div className="font-extrabold text-[13px] text-green-800 text-center">
            🎉 <span className="font-mono">{lastWin.code}</span> • {lastWin.reward.title} — bạn nhận được:
          </div>
          <div className="text-[12px] font-bold text-green-700 text-center mt-0.5">{rewardSummary(lastWin.reward, 99)}</div>
          <div className="flex gap-1.5 flex-wrap mt-2 max-h-32 overflow-y-auto justify-center">
            {Object.entries(lastWin.reward.items).map(([pid, n]) => {
              const [nm] = itemName(pid);
              return (
                <span key={pid} title={`${nm} x${n}`} className="inline-flex items-center gap-1 bg-white border-2 border-green-400 rounded-lg px-1.5 py-0.5 text-[11px] font-bold">
                  <GameIcon name={iconForPid(pid)} size={16} />{nm} x{n}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="text-xs text-stone-500 text-center mb-2">Mỗi code nhận 1 lần / farm • không phân biệt hoa thường</div>
    </div>
  );
}
