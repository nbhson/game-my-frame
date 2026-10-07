import { useState } from 'react';
import { Copy, LogOut, MessageCircle, Search, Users } from 'lucide-react';
import { useVillage } from '../net/village';
import { normalizeCode } from '../net/session';
import { useGame } from '../game/store';
import { sfx } from '../game/audio';

type Tab = 'online' | 'chat' | 'visit';

export default function VillageModal() {
  const v = useVillage();
  const [tab, setTab] = useState<Tab>('online');
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');

  const copyCode = async () => {
    const link = `${window.location.origin}${window.location.pathname}?visit=${v.myCode}`;
    try { await navigator.clipboard.writeText(link); useGame.getState().toast('📋 Đã copy link mời!'); }
    catch { useGame.getState().toast('Mã của bạn: ' + v.myCode); }
    sfx.coin();
  };

  const doVisit = async (c: string) => {
    const ok = await v.visit(normalizeCode(c));
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
      {/* mã của mình + trạng thái */}
      <div className="flex items-center gap-2 bg-white border-2 border-[#2b2117] rounded-lg p-2 mb-2 flex-wrap">
        <span className="text-sm">🆔 Mã farm bạn: <b className="font-pixel text-xs bg-yellow-200 px-2 py-1 rounded">{v.myCode}</b></span>
        <button onClick={copyCode} className="pixel-btn !text-[10px] !px-2 !py-1.5 flex items-center gap-1"><Copy size={12} /> Copy link mời</button>
        <span className="text-[11px] text-stone-500">
          {v.mode === 'supabase' ? '☁️ Cloud Supabase' : v.mode === 'socket' ? '🌐 LAN server' : '📡 Làng local (multi-tab)'} • {v.cloud === 'synced' ? '🟢 đã đồng bộ' : v.cloud === 'local' ? '🟡 local' : v.cloud === 'syncing' ? '⏳ đang sync…' : '🔴 mất kết nối'}
        </span>
      </div>

      <div className="flex gap-1.5 mb-2">
        {([['online', '👥 Online'], ['chat', '💬 Chat'], ['visit', '🛵 Thăm bạn']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 border-[3px] border-[#2b2117] rounded-lg font-extrabold text-[13px] ${tab === k ? 'bg-[#2b2117] text-yellow-300' : 'bg-white'}`}>
            {l} {k === 'online' && `(${v.players.length + (v.demoBots ? 2 : 0)})`} {k === 'chat' && v.chat.length > 0 && `(${v.chat.length})`}
          </button>
        ))}
      </div>

      {tab === 'online' && (
        <div>
          {v.players.length === 0 && !v.demoBots && (
            <p className="text-sm text-stone-500 bg-white border-2 border-dashed border-stone-300 rounded-lg p-3 text-center">
              {v.mode === 'local'
                ? 'Chưa ai online. Mở thêm 1 tab trình duyệt cùng link này là thấy nhau ngay! 📑'
                : 'Làng đang vắng. Chia sẻ mã farm để bạn bè vào chơi! 📣'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {v.players.map((p) => (
              <PlayerRow key={p.id} name={p.name} avatar={p.avatar} sub="đang trong làng" actionLabel="Thăm farm" onAction={() => { /* visit cần code; local: gửi yêu cầu */ useGame.getState().toast('Xin mã farm 6 ký tự của ' + p.name + ' ở tab Thăm bạn 🛵'); setTab('visit'); }} />
            ))}
            {v.demoBots && (
              <>
                <PlayerRow name="Lan🌸" avatar={1} sub="demo bot" actionLabel="Chào" onAction={() => v.sendChat('Chào Lan! 👋')} />
                <PlayerRow name="Tèo🚜" avatar={2} sub="demo bot" actionLabel="Chào" onAction={() => v.sendChat('Chào Tèo! 👋')} />
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
            {v.chat.length === 0 && <p className="text-sm text-stone-400 text-center mt-4">Chưa có tin nhắn. Chào làng một câu đi! 👋</p>}
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
          <p className="text-[11px] text-stone-500 mt-1">Tin nhắn cũng hiện bóng chat trên đầu nhân vật trong game 💬</p>
        </div>
      )}

      {tab === 'visit' && (
        <div>
          <p className="text-sm mb-2">Nhập <b>mã farm 6 ký tự</b> của bạn bè để qua thăm (xem ruộng/ao/chuồng, đi dạo + chat). Thăm ở chế độ chỉ-xem kiểu Avatar 👀</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="VD: A3F9K2"
              className="flex-1 border-[3px] border-[#2b2117] rounded-lg px-3 py-2 font-pixel text-sm text-center tracking-widest"
            />
            <button onClick={() => doVisit(code)} className="pixel-btn !text-[11px] flex items-center gap-1"><Search size={14} /> Thăm</button>
          </div>
          {v.visiting && (
            <button onClick={() => { v.leaveVisit(); useGame.getState().setModal(null); }} className="pixel-btn !text-[11px] mt-2 flex items-center gap-1">
              <LogOut size={14} /> Về farm mình
            </button>
          )}
          <p className="text-[11px] text-stone-500 mt-2">
            {v.mode === 'local'
              ? '📡 Local: chỉ thăm được farm cùng máy (tab khác đang mở hoặc đã sync).'
              : v.mode === 'socket'
                ? '🌐 LAN: thăm được mọi farm trong mạng (kể cả chủ đã thoát, farm lưu ở server).'
                : '☁️ Cloud: thăm được farm bất kỳ đã từng online, kể cả chủ đang offline.'}
          </p>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ name, avatar, sub, actionLabel, onAction }: { name: string; avatar: number; sub: string; actionLabel: string; onAction: () => void }) {
  const faces = ['🧑‍🌾', '👩‍🌾', '👦', '🤠'];
  return (
    <div className="flex items-center justify-between bg-white border-[3px] border-[#2b2117] rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{faces[avatar % faces.length]}</span>
        <div>
          <div className="font-extrabold text-sm flex items-center gap-1"><Users size={12} /> {name}</div>
          <div className="text-[11px] text-stone-500">🟢 {sub}</div>
        </div>
      </div>
      <button onClick={onAction} className="pixel-btn !text-[10px] !px-2 !py-1.5">{actionLabel}</button>
    </div>
  );
}
