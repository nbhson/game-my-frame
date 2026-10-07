import { Backpack, CircleHelp, ScrollText, Store, Users, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { xpNeed, useGame, WEATHER_LABEL } from '../game/store';
import { useVillage } from '../net/village';
import { isSoundOn, setSoundOn } from '../game/audio';
import { GameIcon } from './GameIcon';

export default function HUD() {
  const s = useGame();
  const online = useVillage((v) => v.players.length + (v.demoBots ? 2 : 0));
  const cloud = useVillage((v) => v.cloud);
  const [mute, setMute] = useState(!isSoundOn());
  const pct = Math.min(100, (s.xp / xpNeed(s.level)) * 100);
  const clockIcon = s.dayTime < 0.05 || s.dayTime > 0.92 ? 'moon' : s.dayTime > 0.75 ? 'sun' : s.dayTime < 0.2 ? 'sun' : 'sun';
  const weatherIcon = s.weather === 'rain' ? 'rain' : s.weather === 'snow' ? 'snow' : clockIcon;
  const weatherLabel = WEATHER_LABEL[s.weather] + (s.weather === 'rain' ? ' (tự tưới)' : s.weather === 'snow' ? ' (chậm lớn)' : '');
  const cloudColor = cloud === 'synced' ? '#4ade80' : cloud === 'local' ? '#facc15' : cloud === 'syncing' ? '#f97316' : '#ef4444';

  return (
    <div className="flex items-center justify-between gap-2 bg-[#2b2117] text-white px-2 py-1.5 flex-wrap z-10">
      <div className="flex items-center gap-2">
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-0.5"><GameIcon name={`farmer${s.avatar % 4}`} size={30} /></div>
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1">
          <div className="text-[13px] font-bold leading-none">{s.name}</div>
          <div className="relative bg-black w-24 h-4 rounded-full overflow-hidden mt-1 border border-black">
            <div className="h-full bg-gradient-to-r from-lime-400 to-yellow-300 transition-all" style={{ width: pct + '%' }} />
            <span className="absolute inset-0 text-[10px] text-center leading-4 font-bold" style={{ textShadow: '1px 1px 0 #000' }}>
              Lv {s.level}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 text-yellow-300 flex items-center gap-1"><GameIcon name="coin" size={17} /> {s.xu.toLocaleString('vi-VN')}</div>
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 text-sky-300 flex items-center gap-1"><GameIcon name="gem" size={17} /> {s.gem}</div>
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1"><GameIcon name="calendar" size={16} /> Ngày {s.day} <GameIcon name={clockIcon} size={16} /></div>
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1" title={weatherLabel}><GameIcon name={weatherIcon} size={16} /> {WEATHER_LABEL[s.weather]}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="icon-btn !text-black relative" title="Làng (V)" onClick={() => s.setModal('village')}>
          <Users size={20} />
          {online > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">
              {online}
            </span>
          )}
        </button>
        <button className="icon-btn !text-black" title="Kho (B)" onClick={() => s.setModal('bag')}><Backpack size={20} /></button>
        <button className="icon-btn !text-black" title="Cửa hàng (bấm E ở shop)" onClick={() => { s.setShopTab('seed'); s.setModal('shop'); }}><Store size={20} /></button>
        <button className="icon-btn !text-black" title="Nhiệm vụ (Q)" onClick={() => s.setModal('quest')}><ScrollText size={20} /></button>
        <button className="icon-btn !text-black" title="Trợ giúp (H)" onClick={() => s.setModal('help')}><CircleHelp size={20} /></button>
        <button
          className="icon-btn !text-black"
          onClick={() => { const v = !isSoundOn(); setSoundOn(v); setMute(!v); }}
        >
          {mute ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <span title={cloud === 'local' ? 'Làng local (multi-tab)' : cloud === 'synced' ? 'Cloud đã đồng bộ' : 'Đang kết nối…'} className="text-sm select-none inline-block w-3 h-3 rounded-full border border-black" style={{ background: cloudColor }} />
      </div>
    </div>
  );
}
