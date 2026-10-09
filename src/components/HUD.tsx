import { Backpack, CircleHelp, Gift, MessageCircle, ScrollText, Settings, Store, Tractor, Users, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { VIEW_H_DEFAULT, xpNeed, useGame, WEATHER_LABEL } from '../game/store';
import { townCount, useVillage } from '../net/village';
import { isSoundOn, setSoundOn } from '../game/audio';
import { GameIcon } from './GameIcon';
import { goToFarm } from './GameCanvas';

export default function HUD() {
  const s = useGame();
  const online = useVillage((v) => v.players.length + (v.demoBots ? 3 : 0));
  const cloud = useVillage((v) => v.cloud);
  const [mute, setMute] = useState(!isSoundOn());
  const pct = Math.min(100, (s.xp / xpNeed(s.level)) * 100);
  const clockIcon = s.dayTime < 0.05 || s.dayTime > 0.92 ? 'moon' : s.dayTime > 0.75 ? 'sun' : s.dayTime < 0.2 ? 'sun' : 'sun';
  const weatherIcon = s.weather === 'rain' ? 'rain' : s.weather === 'snow' ? 'snow' : clockIcon;
  const weatherLabel = WEATHER_LABEL[s.weather] + (s.weather === 'rain' ? ' (tự tưới)' : s.weather === 'snow' ? ' (chậm lớn)' : '');
  const cloudColor = cloud === 'synced' ? '#4ade80' : cloud === 'local' ? '#facc15' : cloud === 'syncing' ? '#f97316' : '#ef4444';
  const inTown = s.scene === 'town';

  return (
    <div className={`text-white z-10 pt-[env(safe-area-inset-top)] ${inTown ? 'bg-[#5b2a86]' : 'bg-[#2b2117]'}`}>
      {/* ===== Mobile: 2 hàng gọn, hàng 2 cuộn ngang ===== */}
      <div className="md:hidden px-2 pt-1.5 pb-1.5 flex flex-col gap-1.5">
        {/* hàng 1: info + tiền — luôn vừa màn hình */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1 py-0.5 shrink-0"><GameIcon name={`farmer${s.avatar % 4}`} size={26} /></div>
          <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1 shrink-0">
            <div className="text-[11px] font-bold leading-none max-w-[72px] truncate">{s.name}</div>
            <div className="relative bg-black w-16 h-3.5 rounded-full overflow-hidden mt-0.5 border border-black">
              <div className="h-full bg-gradient-to-r from-lime-400 to-yellow-300 transition-all" style={{ width: pct + '%' }} />
              <span className="absolute inset-0 text-[9px] text-center leading-[14px] font-bold" style={{ textShadow: '1px 1px 0 #000' }}>
                Lv {s.level}
              </span>
            </div>
          </div>
          {inTown ? (
            <div className="bg-pink-500 border-2 border-black rounded-lg px-1.5 py-1 text-[11px] font-black animate-pulse shrink-0">
              PARK · {townCount() + 1}
            </div>
          ) : (
            <div className="bg-green-700 border-2 border-black rounded-lg px-1.5 py-1 text-[11px] font-black shrink-0">
              FARM
            </div>
          )}
          <div className="flex-1" />
          <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1 text-[12px] font-extrabold text-yellow-300 flex items-center gap-1 shrink-0"><GameIcon name="coin" size={15} /> {s.xu >= 10000 ? `${(s.xu / 1000).toFixed(1)}k` : s.xu.toLocaleString('vi-VN')}</div>
          <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1 text-[12px] font-extrabold text-sky-300 flex items-center gap-1 shrink-0"><GameIcon name="gem" size={15} /> {s.gem}</div>
        </div>
        {/* hàng 2: toàn bộ nút — cuộn ngang, không wrap chiếm chỗ game */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-2 px-2 pb-0.5" style={{ touchAction: 'pan-x' }}>
          {inTown ? (
            <>
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-purple-600 !text-white shrink-0" onClick={() => s.setModal('casino')}>🎰 Casino</button>
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-red-600 !text-white shrink-0" onClick={() => s.setModal({ name: 'wolf' })}>🐺 Ma sói</button>
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-pink-500 !text-white shrink-0" onClick={() => s.setModal('outfit')}>👗 T.thời trang</button>
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-green-500 !text-white shrink-0 flex items-center gap-1" onClick={() => goToFarm()}><Tractor size={14} /> Farm</button>
            </>
          ) : (
            <>
              <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 shrink-0"><GameIcon name="calendar" size={14} /> N{s.day}</div>
              <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 shrink-0" title={weatherLabel}><GameIcon name={weatherIcon} size={14} /></div>
            </>
          )}
          {inTown ? (
            <>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('gift')}><Gift size={18} /></button>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('village')}><MessageCircle size={18} /></button>
              <button className="icon-btn !w-9 !h-9 !text-black relative shrink-0" onClick={() => s.setModal('village')}>
                <Users size={18} />
                {online > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">{online}</span>
                )}
              </button>
            </>
          ) : (
            <>
              <button className="icon-btn !w-9 !h-9 !text-black relative shrink-0" onClick={() => s.setModal('village')}>
                <Users size={18} />
                {online > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">{online}</span>
                )}
              </button>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('bag')}><Backpack size={18} /></button>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('gift')}><Gift size={18} /></button>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => { s.setShopTab('seed'); s.setModal('shop'); }}><Store size={18} /></button>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('quest')}><ScrollText size={18} /></button>
              <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('help')}><CircleHelp size={18} /></button>
            </>
          )}
          <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setViewH(s.viewH + 70)}><ZoomOut size={18} /></button>
          <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setViewH(s.viewH - 70)}><ZoomIn size={18} /></button>
          <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => s.setModal('settings')}><Settings size={18} /></button>
          <button className="icon-btn !w-9 !h-9 !text-black shrink-0" onClick={() => { const v = !isSoundOn(); setSoundOn(v); setMute(!v); }}>
            {mute ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <span title="Trạng thái cloud" className="shrink-0 inline-block w-3 h-3 rounded-full border border-black" style={{ background: cloudColor }} />
        </div>
      </div>
      {/* ===== Desktop: giữ nguyên 1 hàng ===== */}
      <div className="hidden md:flex items-center justify-between gap-2 px-2 py-1.5 flex-wrap">
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
        {inTown ? (
          <div className="bg-pink-500 border-2 border-black rounded-lg px-2 py-1 text-[13px] font-black animate-pulse" title="Bản đồ chung realtime">
            CÔNG VIÊN · {townCount() + 1} online
          </div>
        ) : (
          <div className="bg-green-700 border-2 border-black rounded-lg px-2 py-1 text-[13px] font-black" title="Farm riêng của bạn">
            NÔNG TRẠI
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 text-yellow-300 flex items-center gap-1"><GameIcon name="coin" size={17} /> {s.xu.toLocaleString('vi-VN')}</div>
        <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 text-sky-300 flex items-center gap-1"><GameIcon name="gem" size={17} /> {s.gem}</div>
        {!inTown && (
          <>
            <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1"><GameIcon name="calendar" size={16} /> Ngày {s.day} <GameIcon name={clockIcon} size={16} /></div>
            <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1" title={weatherLabel}><GameIcon name={weatherIcon} size={16} /> {WEATHER_LABEL[s.weather]}</div>
          </>
        )}
        {inTown && (
          <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1" title="Ngày/giờ chung với farm">
            <GameIcon name="calendar" size={16} /> Ngày {s.day}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {inTown ? (
          <>
            <button className="pixel-btn !text-[11px] !bg-purple-600 !text-white flex items-center gap-1" title="Mở Casino (Tiến lên • Bài cào • Xì dách • Caro • Cờ vua)" onClick={() => s.setModal('casino')}>
              🎰 Casino
            </button>
            <button className="pixel-btn !text-[11px] !bg-red-600 !text-white flex items-center gap-1" title="Ma sói 5–12 người (đêm hành động, ngày bỏ phiếu)" onClick={() => s.setModal({ name: 'wolf' })}>
              🐺 Ma sói
            </button>
            <button className="pixel-btn !text-[11px] !bg-pink-500 !text-white flex items-center gap-1" title="Shop thời trang (áo quần nón tóc giày)" onClick={() => s.setModal('outfit')}>
              👗 Thời trang
            </button>
            <button className="pixel-btn !text-[11px] !bg-green-500 !text-white flex items-center gap-1" title="Về nông trại (cổng phía đông)" onClick={() => goToFarm()}>
              <Tractor size={16} /> Về farm
            </button>
            <button className="icon-btn !text-black" title="Nhập code nhận quà (G)" onClick={() => s.setModal('gift')}>
              <Gift size={20} />
            </button>
            <button className="icon-btn !text-black relative" title="Chat công viên" onClick={() => s.setModal('village')}>
              <MessageCircle size={20} />
            </button>
            <button className="icon-btn !text-black relative" title="Bạn bè" onClick={() => s.setModal('village')}>
              <Users size={20} />
              {online > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">
                  {online}
                </span>
              )}
            </button>
          </>
        ) : (
          <>
            <button className="icon-btn !text-black relative" title="Làng (V)" onClick={() => s.setModal('village')}>
              <Users size={20} />
              {online > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">
                  {online}
                </span>
              )}
            </button>
            <button className="icon-btn !text-black" title="Kho (B)" onClick={() => s.setModal('bag')}><Backpack size={20} /></button>
            <button className="icon-btn !text-black" title="Nhập code nhận quà (G)" onClick={() => s.setModal('gift')}>
              <Gift size={20} />
            </button>
            <button className="icon-btn !text-black" title="Cửa hàng (bấm E ở shop)" onClick={() => { s.setShopTab('seed'); s.setModal('shop'); }}><Store size={20} /></button>
            <button className="icon-btn !text-black" title="Nhiệm vụ (Q)" onClick={() => s.setModal('quest')}><ScrollText size={20} /></button>
            <button className="icon-btn !text-black" title="Trợ giúp (H)" onClick={() => s.setModal('help')}><CircleHelp size={20} /></button>
          </>
        )}
        <button className="icon-btn !text-black" title="Thu khung nhìn (nhìn rộng hơn) — phím −" onClick={() => s.setViewH(s.viewH + 70)}>
          <ZoomOut size={20} />
        </button>
        <button className="icon-btn !text-black" title="Phóng khung nhìn (nhìn gần hơn) — phím +" onClick={() => s.setViewH(s.viewH - 70)}>
          <ZoomIn size={20} />
        </button>
        <button
          className="icon-btn !text-black !text-[10px] font-black hidden sm:flex"
          style={{ width: 'auto', padding: '0 6px' }}
          title={`Độ xa khung nhìn hiện tại (${s.viewH}). Bấm để về mặc định ${VIEW_H_DEFAULT}.`}
          onClick={() => s.setViewH(VIEW_H_DEFAULT)}
        >
          {Math.round((s.viewH / VIEW_H_DEFAULT) * 100)}%
        </button>
        <button className="icon-btn !text-black" title="Cài đặt (đồ họa, âm thanh)" onClick={() => s.setModal('settings')}>
          <Settings size={20} />
        </button>
        <button
          className="icon-btn !text-black"
          onClick={() => { const v = !isSoundOn(); setSoundOn(v); setMute(!v); }}
        >
          {mute ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <span title={cloud === 'local' ? 'Làng local (multi-tab)' : cloud === 'synced' ? 'Cloud đã đồng bộ' : 'Đang kết nối…'} className="text-sm select-none inline-block w-3 h-3 rounded-full border border-black" style={{ background: cloudColor }} />
      </div>
      </div>
    </div>
  );
}
