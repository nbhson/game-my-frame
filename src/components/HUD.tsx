import { Backpack, ChevronDown, CircleHelp, Gift, MessageCircle, ScrollText, Settings, Store, Tractor, Users, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { VIEW_H_DEFAULT, xpNeed, useGame, WEATHER_LABEL } from '../game/store';
import { INTERIORS } from '../game/interiors';
import { gameMe } from '../net/village';
import { mallCount, townCount, useVillage } from '../net/village';
import { isRaceBot, progScore, racePct, RACE_LAPS, useRace } from '../net/race';
import { isSoundOn, setSoundOn } from '../game/audio';
import { GameIcon } from './GameIcon';
import { goToFarm, goToMall, goToTown } from './GameCanvas';

// ===== Dropdown menu dùng chung cho toolbar (gọn thay vì dàn hàng chục nút) =====
const MenuCtx = createContext<{ close: () => void }>({ close: () => {} });

function Drop({ title, triggerClass, trigger, align = 'right', children }: {
  title?: string; triggerClass?: string; trigger: React.ReactNode; align?: 'right' | 'left'; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open ]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" title={title} onClick={() => setOpen((o) => !o)} className={triggerClass}>{trigger}</button>
      {open && (
        <MenuCtx.Provider value={{ close: () => setOpen(false) }}>
          <div className={`absolute top-full mt-1.5 z-50 w-max min-w-[215px] max-w-[260px] bg-[#fff8dc] border-[3px] border-[#2b2117] rounded-xl shadow-pixel p-1.5 flex flex-col gap-1 text-black ${align === 'right' ? 'right-0' : 'left-0'}`}>
            {children}
          </div>
        </MenuCtx.Provider>
      )}
    </div>
  );
}

function Item({ icon, label, desc, highlight, onClick }: {
  icon: React.ReactNode; label: string; desc?: string; highlight?: boolean; onClick: () => void;
}) {
  const { close } = useContext(MenuCtx);
  return (
    <button
      type="button"
      onClick={() => { close(); onClick(); }}
      className={`flex items-center gap-2 text-left px-2 py-1.5 rounded-lg border-2 border-[#2b2117] text-[13px] font-bold text-black active:scale-[.98] ${highlight ? 'bg-yellow-200' : 'bg-white hover:bg-amber-100'}`}
    >
      <span className="text-lg leading-none shrink-0 w-7 h-7 flex items-center justify-center">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {desc && <span className="block text-[11px] font-normal text-stone-500 truncate">{desc}</span>}
      </span>
    </button>
  );
}

// ===== Các nhóm menu (dùng chung mobile + desktop, compact = bản mobile gọn) =====

function PlayMenu({ compact }: { compact?: boolean }) {
  const s = useGame();
  return (
    <Drop
      title="Trò chơi khu mua sắm: Casino, Vé số, Đua xe, Ma sói"
      triggerClass={compact
        ? 'pixel-btn !text-[11px] !px-2 !py-2 !bg-purple-600 !text-white shrink-0 flex items-center gap-0.5'
        : 'pixel-btn !text-[11px] !bg-purple-600 !text-white flex items-center gap-1'}
      trigger={<>🎮{compact ? null : ' Chơi'}<ChevronDown size={compact ? 13 : 14} /></>}
    >
      <Item icon="🎰" label="Casino" desc="Tiến lên • Bài cào • Xì dách • Caro • Cờ vua" onClick={() => s.setModal('casino')} />
      <Item icon="🎫" label="Vé số" desc="50 xu/vé — sổ mỗi 5 phút" onClick={() => s.setModal('lottery')} />
      <Item icon="🏁" label="Đua xe" desc="Tối đa 5 tay lái • vô địch +300 xu +1 gem" onClick={() => s.setModal('race')} />
      <Item icon="🐺" label="Ma sói" desc="5–12 người • đêm hành động, ngày bỏ phiếu" onClick={() => s.setModal({ name: 'wolf' })} />
    </Drop>
  );
}

/** Widget mini khi đang đua xe: hạng hiện tại + vòng + top 3 (không cần mở bảng) */
function RaceHud() {
  const r = useRace();
  const me = gameMe().name;
  if (r.phase !== 'count' && r.phase !== 'racing') return null;
  const sorted = [...r.racers].sort((a, b) => {
    const fa = r.finishes[a], fb = r.finishes[b];
    if (fa != null && fb != null) return fa - fb;
    if (fa != null) return -1;
    if (fb != null) return 1;
    return progScore(r.progress[b] ?? { lap: 0, cp: 0 }) - progScore(r.progress[a] ?? { lap: 0, cp: 0 });
  });
  const rank = sorted.indexOf(me) + 1;
  const mine = r.progress[me];
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
  return (
    <button
      type="button"
      onClick={() => useGame.getState().setModal('race')}
      title="Bấm để mở bảng đua"
      className="fixed top-[104px] md:top-[64px] left-1/2 -translate-x-1/2 z-20 bg-[#2b2117]/90 text-white border-[3px] border-black rounded-xl px-3 py-1 text-center shadow-pixel active:scale-95"
    >
      <span className="text-[13px] font-black">
        🏁 {r.phase === 'count' ? `XUẤT PHÁT SAU ${Math.max(1, Math.ceil((r.goAt - Date.now()) / 1000))}…` : `${medal} P${rank}/${sorted.length} · V${Math.min(RACE_LAPS, (mine?.lap ?? 0) + 1)}/${RACE_LAPS} · ${mine ? racePct(mine) : 0}%`}
      </span>
      {r.phase === 'racing' && (
        <span className="block text-[10px] font-bold opacity-80 truncate max-w-[260px]">
          {sorted.slice(0, 3).map((n, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}${n === me ? 'Bạn' : n}${isRaceBot(n) ? '🤖' : ''}`).join(' · ')}
        </span>
      )}
    </button>
  );
}
/** Nút ở thị trấn: sang khu mua sắm (gara/casino/shop đã dọn sang đó) */
function TownShopMenu({ compact }: { compact?: boolean }) {
  return (
    <Drop
      title="Sang Khu mua sắm & Giải trí (góc đông-bắc)"
      triggerClass={compact
        ? 'pixel-btn !text-[11px] !px-2 !py-2 !text-white shrink-0 flex items-center gap-0.5 !bg-pink-500'
        : 'pixel-btn !text-[11px] !text-white flex items-center gap-1 !bg-pink-500'}
      trigger={<>🎡{compact ? null : ' Khu mua sắm'}<ChevronDown size={compact ? 13 : 14} /></>}
    >
      <Item icon="🎡" label="Khu Mua sắm & Giải trí" desc="Gara • Casino • Vé số • Sông câu • Đua xe • Sói" onClick={() => goToMall()} />
    </Drop>
  );
}

/** Mua sắm ở khu mới: Thời trang + Gara xe */
function MallShopMenu({ compact }: { compact?: boolean }) {
  const s = useGame();
  return (
    <Drop
      title={s.activeCar ? 'Đang lái xe — bấm để mở Gara / xuống xe' : 'Mua sắm: Thời trang, Chợ xe (phím X)'}
      triggerClass={compact
        ? `pixel-btn !text-[11px] !px-2 !py-2 !text-white shrink-0 flex items-center gap-0.5 ${s.activeCar ? '!bg-yellow-500' : '!bg-pink-500'}`
        : `pixel-btn !text-[11px] !text-white flex items-center gap-1 ${s.activeCar ? '!bg-yellow-500' : '!bg-pink-500'}`}
      trigger={<>🛍️{compact ? null : (s.activeCar ? ' Đang lái…' : ' Mua sắm')}<ChevronDown size={compact ? 13 : 14} /></>}
    >
      <Item icon="👗" label="Thời trang" desc="Áo quần nón tóc giày" onClick={() => s.setModal('outfit')} />
      <Item icon="🚗" label={s.activeCar ? 'Đang lái… (mở Gara)' : 'Gara xe'} desc="Vào gara xem xe, lái thử, mua xe (phím X)" highlight={!!s.activeCar} onClick={() => s.setModal('carshop')} />
    </Drop>
  );
}

function SocialMenu({ compact }: { compact?: boolean }) {
  const s = useGame();
  const online = useVillage((v) => v.players.length + (v.demoBots ? 4 : 0));
  return (
    <Drop
      title="Xã hội: chat + bạn bè cả làng"
      triggerClass={compact
        ? 'icon-btn !w-9 !h-9 !text-black relative shrink-0 flex items-center justify-center'
        : 'pixel-btn !text-[11px] !bg-sky-600 !text-white flex items-center gap-1 relative'}
      trigger={
        <>
          {compact ? <MessageCircle size={18} /> : <>💬 Xã hội</>}
          <ChevronDown size={compact ? 12 : 14} />
          {online > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">
              {online}
            </span>
          )}
        </>
      }
    >
      <Item icon={<MessageCircle size={20} />} label="Chat cả làng" desc="Tám chuyện realtime cả làng" onClick={() => s.setModal('village')} />
      <Item icon={<Users size={20} />} label={`Bạn bè (${online} online)`} desc="Xem ai đang chơi chung" onClick={() => s.setModal('village')} />
    </Drop>
  );
}

function FarmShopMenu({ compact }: { compact?: boolean }) {
  const s = useGame();
  return (
    <Drop
      title={s.activeCar ? 'Đang lái xe — bấm để mở Gara / xuống xe' : 'Mua sắm farm: Cửa hàng, Chợ xe'}
      triggerClass={compact
        ? `icon-btn !w-9 !h-9 !text-black !text-lg relative shrink-0 ${s.activeCar ? '!bg-yellow-300' : ''}`
        : `icon-btn !text-black !text-xl relative ${s.activeCar ? '!bg-yellow-300' : ''}`}
      trigger={
        <>
          🛍️<ChevronDown size={compact ? 11 : 12} />
          {s.activeCar && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-500 border-2 border-black" />}
        </>
      }
    >
      <Item icon={<Store size={20} />} label="Cửa hàng" desc="Hạt giống • Cá • Thú • Thức ăn (bấm E ở shop)" onClick={() => { s.setShopTab('seed'); s.setModal('shop'); }} />
      <Item icon="🚗" label={s.activeCar ? 'Đang lái… (mở Gara)' : 'Chợ xe / Gara'} desc="Mua xe, lái vi vu (phím X)" highlight={!!s.activeCar} onClick={() => s.setModal('carshop')} />
    </Drop>
  );
}

function FarmBagMenu({ compact }: { compact?: boolean }) {
  const s = useGame();
  return (
    <Drop
      title="Kho đồ, nhiệm vụ, trợ giúp (B/Q/H)"
      triggerClass={compact
        ? 'icon-btn !w-9 !h-9 !text-black shrink-0 flex items-center justify-center gap-0'
        : 'pixel-btn !text-[11px] !bg-amber-600 !text-white flex items-center gap-1'}
      trigger={
        <>
          {compact ? <Backpack size={18} /> : <>🎒 Kho & NV</>}
          <ChevronDown size={compact ? 12 : 14} />
        </>
      }
    >
      <Item icon={<Backpack size={20} />} label="Kho đồ (B)" desc="Xem nông sản, vật phẩm" onClick={() => s.setModal('bag')} />
      <Item icon={<ScrollText size={20} />} label="Nhiệm vụ (Q)" desc="Làm việc lĩnh thưởng" onClick={() => s.setModal('quest')} />
      <Item icon={<CircleHelp size={20} />} label="Trợ giúp (H)" desc="Hướng dẫn chơi" onClick={() => s.setModal('help')} />
    </Drop>
  );
}

function ViewMenu({ compact }: { compact?: boolean }) {
  const s = useGame();
  return (
    <Drop
      title="Hiển thị: phóng to / thu nhỏ khung nhìn (+/−)"
      triggerClass={compact
        ? 'icon-btn !w-9 !h-9 !text-black shrink-0 flex items-center justify-center'
        : 'icon-btn !text-black flex items-center'}
      trigger={<><ZoomIn size={compact ? 18 : 20} /><ChevronDown size={compact ? 11 : 12} /></>}
    >
      <Item icon={<ZoomOut size={20} />} label="Thu nhỏ" desc="Nhìn rộng hơn (phím −)" onClick={() => s.setViewH(s.viewH + 70)} />
      <Item icon={<ZoomIn size={20} />} label="Phóng to" desc="Nhìn gần hơn (phím +)" onClick={() => s.setViewH(s.viewH - 70)} />
      <Item icon={<span className="text-[11px] font-black">{Math.round((s.viewH / VIEW_H_DEFAULT) * 100)}%</span>} label="Về mặc định" desc={`Khung nhìn chuẩn (${VIEW_H_DEFAULT})`} onClick={() => s.setViewH(VIEW_H_DEFAULT)} />
    </Drop>
  );
}

function SysMenu({ compact, mute, onToggleMute }: { compact?: boolean; mute: boolean; onToggleMute: () => void }) {
  const s = useGame();
  return (
    <Drop
      title="Tiện ích: quà, cài đặt, âm thanh"
      triggerClass={compact
        ? 'icon-btn !w-9 !h-9 !text-black shrink-0 flex items-center justify-center'
        : 'icon-btn !text-black flex items-center'}
      trigger={<><Settings size={compact ? 18 : 20} /><ChevronDown size={compact ? 11 : 12} /></>}
    >
      <Item icon={<Gift size={20} />} label="Nhập code nhận quà (G)" desc="Code bí mật mỗi đợt" onClick={() => s.setModal('gift')} />
      <Item icon={<Settings size={20} />} label="Cài đặt" desc="Đồ họa, độ phân giải" onClick={() => s.setModal('settings')} />
      <Item icon={mute ? <VolumeX size={20} /> : <Volume2 size={20} />} label={mute ? 'Bật âm thanh' : 'Tắt âm thanh'} desc="Nhạc + hiệu ứng" onClick={onToggleMute} />
    </Drop>
  );
}

export default function HUD() {
  const s = useGame();
  const online = useVillage((v) => v.players.length + (v.demoBots ? 4 : 0));
  const cloud = useVillage((v) => v.cloud);
  const [mute, setMute] = useState(!isSoundOn());
  const toggleMute = () => { const v = !isSoundOn(); setSoundOn(v); setMute(!v); };
  const pct = Math.min(100, (s.xp / xpNeed(s.level)) * 100);
  const clockIcon = s.dayTime < 0.05 || s.dayTime > 0.92 ? 'moon' : s.dayTime > 0.75 ? 'sun' : s.dayTime < 0.2 ? 'sun' : 'sun';
  const weatherIcon = s.weather === 'rain' ? 'rain' : s.weather === 'snow' ? 'snow' : clockIcon;
  const weatherLabel = WEATHER_LABEL[s.weather] + (s.weather === 'rain' ? ' (tự tưới)' : s.weather === 'snow' ? ' (chậm lớn)' : '');
  const cloudColor = cloud === 'synced' ? '#4ade80' : cloud === 'local' ? '#facc15' : cloud === 'syncing' ? '#f97316' : '#ef4444';
  // 3 vùng menu: farm riêng / thị trấn / khu mua sắm (trong nhà dùng menu của map chứa nó)
  const area: 'farm' | 'town' | 'mall' = s.scene === 'interior' ? (INTERIORS[s.interiorId ?? '']?.via ?? 'town') : s.scene;

  return (
    <div className={`text-white z-10 pt-[env(safe-area-inset-top)] ${area === 'farm' ? 'bg-[#2b2117]' : area === 'town' ? 'bg-[#5b2a86]' : 'bg-[#a12258]'}`}>
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
          {area === 'town' ? (
            <div className="bg-pink-500 border-2 border-black rounded-lg px-1.5 py-1 text-[11px] font-black animate-pulse shrink-0">
              PARK · {townCount() + 1}
            </div>
          ) : area === 'mall' ? (
            <div className="bg-amber-400 text-black border-2 border-black rounded-lg px-1.5 py-1 text-[11px] font-black animate-pulse shrink-0">
              MALL · {mallCount() + 1}
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
        {/* hàng 2: nhóm menu gọn — cuộn ngang, không wrap chiếm chỗ game */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-2 px-2 pb-0.5" style={{ touchAction: 'pan-x' }}>
          {area === 'town' ? (
            <>
              <PlayMenu compact />
              <TownShopMenu compact />
              <SocialMenu compact />
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-green-500 !text-white shrink-0 flex items-center gap-1" onClick={() => goToFarm()}><Tractor size={14} /> Farm</button>
            </>
          ) : area === 'mall' ? (
            <>
              <PlayMenu compact />
              <MallShopMenu compact />
              <SocialMenu compact />
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-purple-500 !text-white shrink-0 flex items-center gap-1" title="Về thị trấn (cổng phía tây)" onClick={() => goToTown()}>🏘️ Town</button>
              <button className="pixel-btn !text-[11px] !px-2 !py-2 !bg-green-500 !text-white shrink-0 flex items-center gap-1" onClick={() => goToFarm()}><Tractor size={14} /> Farm</button>
            </>
          ) : (
            <>
              <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 shrink-0"><GameIcon name="calendar" size={14} /> N{s.day}</div>
              <div className="bg-[#3e3428] border-2 border-black rounded-lg px-1.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 shrink-0" title={weatherLabel}><GameIcon name={weatherIcon} size={14} /></div>
              <button className="icon-btn !w-9 !h-9 !text-black relative shrink-0" title="Làng (V)" onClick={() => s.setModal('village')}>
                <Users size={18} />
                {online > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-black px-1">{online}</span>
                )}
              </button>
              <FarmShopMenu compact />
              <FarmBagMenu compact />
            </>
          )}
          <ViewMenu compact />
          <SysMenu compact mute={mute} onToggleMute={toggleMute} />
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
        {area === 'town' ? (
          <div className="bg-pink-500 border-2 border-black rounded-lg px-2 py-1 text-[13px] font-black animate-pulse" title="Bản đồ chung realtime">
            THỊ TRẤN · {townCount() + 1} online
          </div>
        ) : area === 'mall' ? (
          <div className="bg-amber-400 text-black border-2 border-black rounded-lg px-2 py-1 text-[13px] font-black animate-pulse" title="Khu mua sắm & giải trí realtime">
            MUA SẮM · {mallCount() + 1} online
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
        {area === 'farm' && (
          <>
            <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1"><GameIcon name="calendar" size={16} /> Ngày {s.day} <GameIcon name={clockIcon} size={16} /></div>
            <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1" title={weatherLabel}><GameIcon name={weatherIcon} size={16} /> {WEATHER_LABEL[s.weather]}</div>
          </>
        )}
        {area !== 'farm' && (
          <div className="bg-[#3e3428] border-2 border-black rounded-lg px-2 py-1 hidden sm:flex items-center gap-1" title="Ngày/giờ chung với farm">
            <GameIcon name="calendar" size={16} /> Ngày {s.day}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {area === 'town' ? (
          <>
            <PlayMenu />
            <TownShopMenu />
            <SocialMenu />
            <button className="pixel-btn !text-[11px] !bg-green-500 !text-white flex items-center gap-1" title="Về nông trại (cổng phía đông)" onClick={() => goToFarm()}>
              <Tractor size={16} /> Về farm
            </button>
          </>
        ) : area === 'mall' ? (
          <>
            <PlayMenu />
            <MallShopMenu />
            <SocialMenu />
            <button className="pixel-btn !text-[11px] !bg-purple-500 !text-white flex items-center gap-1" title="Về thị trấn (cổng phía tây)" onClick={() => goToTown()}>
              🏘️ Về town
            </button>
            <button className="pixel-btn !text-[11px] !bg-green-500 !text-white flex items-center gap-1" title="Về nông trại" onClick={() => goToFarm()}>
              <Tractor size={16} /> Về farm
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
            <FarmShopMenu />
            <FarmBagMenu />
          </>
        )}
        <ViewMenu />
        <SysMenu mute={mute} onToggleMute={toggleMute} />
        <span title={cloud === 'local' ? 'Làng local (multi-tab)' : cloud === 'synced' ? 'Cloud đã đồng bộ' : 'Đang kết nối…'} className="text-sm select-none inline-block w-3 h-3 rounded-full border border-black" style={{ background: cloudColor }} />
      </div>
      </div>
      <RaceHud />
    </div>
  );
}
