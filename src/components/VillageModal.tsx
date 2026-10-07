import { useState } from 'react';
import { LogOut, MessageCircle, RefreshCw, Users } from 'lucide-react';
import { useVillage } from '../net/village';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';
import { GameIcon } from './GameIcon';

type Tab = 'friends' | 'chat';

export default function VillageModal() {
  const v = useVillage();
  const [tab, setTab] = useState<Tab>('friends');
  const [draft, setDraft] = useState('');

  const doVisit = async (code: string | undefined, name: string) => {
    if (!code) { useGame.getState().toast('Chưa lấy được farm của ' + name + ', thử lại sau!'); return; }
    const ok = await v.visit(code);
    if (ok) useGame.getState().setModal(null);
  };

  const send = () => {
    if (!draft.trim()) return;
    v.sendChat(draft);
    setDraft('');
    sfx.click();
  };

  return (
    <div>
      {v.mismatch && (
        <div className="bg-red-100 border-2 border-red-500 rounded-lg p-2 mb-2 text-[13px] font-bold text-red-700">
          Phát hiện tab khác chạy bản game cũ hơn! Hãy reload cứng (Ctrl+Shift+R) <b>cả 2 tab</b> rồi bấm Kết nối lại.
        </div>
      )}
      {/* trạng thái kết nối */}
      <div className="flex items-center gap-2 bg-white border-2 border-[#2b2117] rounded-lg p-2 mb-2 flex-wrap">
        <span className="text-sm font-extrabold">Bạn bè online ({v.players.length + (v.demoBots ? 3 : 0)})</span>
        <button onClick={() => v.reconnect()} className="pixel-btn !text-[10px] !px-2 !py-1.5 flex items-center gap-1" title="Ngắt rồi vào lại làng (tự chữa lỗi không thấy nhau)">
          <RefreshCw size={12} /> Kết nối lại
        </button>
        <span className="text-[11px] text-stone-500 flex items-center gap-1">
          {v.mode === 'supabase' ? 'Cloud Supabase' : v.mode === 'socket' ? 'LAN server' : 'Làng local (multi-tab)'} •
          <span className="inline-block w-2.5 h-2.5 rounded-full border border-black" style={{ background: v.cloud === 'synced' ? '#4ade80' : v.cloud === 'local' ? '#facc15' : v.cloud === 'syncing' ? '#f97316' : '#ef4444' }} />
          {v.cloud === 'synced' ? 'đã đồng bộ' : v.cloud === 'local' ? 'local' : v.cloud === 'syncing' ? 'đang sync…' : 'mất kết nối'}
        </span>
        {v.visiting && (
          <button onClick={() => { v.leaveVisit(); useGame.getState().setModal(null); }} className="pixel-btn !text-[10px] !px-2 !py-1.5 flex items-center gap-1">
            <LogOut size={12} /> Về farm mình
          </button>
        )}
      </div>

      <div className="flex gap-1.5 mb-2">
        {([['friends', 'Bạn bè', <Users key="i" size={14} />], ['chat', 'Chat', <MessageCircle key="i" size={14} />]] as [Tab, string, React.ReactNode][]).map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] flex items-center gap-1.5 ${tab === k ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}>
            {ic}{l} {k === 'friends' && `(${v.players.length + (v.demoBots ? 3 : 0)})`} {k === 'chat' && v.chat.length > 0 && `(${v.chat.length})`}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div>
          <p className="text-sm mb-2">Tất cả người đang chơi đều là bạn — bấm <b>Thăm farm</b> để qua xem ruộng/ao/chuồng, đi dạo + chat cùng nhau.</p>
          {v.players.length === 0 && !v.demoBots && (
            <p className="text-sm text-stone-500 bg-white border-2 border-dashed border-stone-300 rounded-lg p-3 text-center">
              {v.mode === 'local'
                ? 'Chưa ai online. Mở thêm 1 tab trình duyệt cùng link này là thấy nhau ngay!'
                : 'Làng đang vắng. Rủ thêm bạn vào chơi cùng!'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {v.players.map((p) => (
              <PlayerRow
                key={p.id} name={p.name} avatar={p.avatar}
                sub={(p.map === 'town' ? 'đang ở công viên' : 'đang ở nông trại')}
                actionLabel="Thăm farm"
                onAction={() => { void doVisit(p.code, p.name); }}
              />
            ))}
            {v.demoBots && (
              <>
                <PlayerRow name="Lan" avatar={1} sub="đang ở nông trại • demo bot" actionLabel="Chào" onAction={() => v.sendChat('Chào Lan!')} />
                <PlayerRow name="Tèo" avatar={2} sub="đang ở nông trại • demo bot" actionLabel="Chào" onAction={() => v.sendChat('Chào Tèo!')} />
                <PlayerRow name="Đào" avatar={3} sub="đang ở công viên • demo bot" actionLabel="Chào" onAction={() => v.sendChat('Chào Đào!')} />
              </>
            )}
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
            <input type="checkbox" checked={v.demoBots} onChange={() => v.toggleBots()} className="w-4 h-4" />
            Bật dân làng demo (test 1 mình vẫn thấy đông vui)
          </label>
        </div>
      )}

      {tab === 'chat' && (
        <div>
          <div className="bg-white border-2 border-[#2b2117] rounded-lg h-56 overflow-y-auto p-2 flex flex-col gap-1.5">
            {v.chat.length === 0 && <p className="text-sm text-stone-400 text-center mt-4">Chưa có tin nhắn. Chào làng một câu đi!</p>}
            {v.chat.map((m) => (
              <div key={m.id} className="text-sm">
                <b>{m.fromName}:</b> {m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 80))}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Nhắn gì đó… (Enter để gửi)"
              className="flex-1 border-[3px] border-[#2b2117] rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={send} className="pixel-btn !text-[11px] flex items-center gap-1"><MessageCircle size={14} /> Gửi</button>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Tin nhắn cũng hiện bóng chat trên đầu nhân vật trong game</p>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ name, avatar, sub, actionLabel, onAction }: { name: string; avatar: number; sub: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between bg-white border-[3px] border-[#2b2117] rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <GameIcon name={`farmer${avatar % 4}`} size={30} />
        <div>
          <div className="font-extrabold text-sm flex items-center gap-1"><Users size={12} /> {name}</div>
          <div className="text-[11px] text-stone-500 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500 border border-black" /> {sub}</div>
        </div>
      </div>
      <button onClick={onAction} className="pixel-btn !text-[10px] !px-2 !py-1.5">{actionLabel}</button>
    </div>
  );
}
