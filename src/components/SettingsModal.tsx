import { useState } from 'react';
import { isSoundOn, setSoundOn, sfx } from '../game/audio';
import { useGame } from '../game/store';
import type { GraphicsQuality, ResMode } from '../game/types';

const QUALITY_META: { id: GraphicsQuality; name: string; icon: string; desc: string }[] = [
  { id: 'high', name: 'Cao', icon: '✨', desc: 'Đủ hiệu ứng: bóng, tia lửa, mây, bướm, đom đóm, quầng đèn, mưa tuyết dày. DPR tới 1.5x' },
  { id: 'medium', name: 'Trung bình', icon: '🌤️', desc: 'Tia lửa thưa 1/2, bớt mây/bướm/đom đóm/mưa tuyết; giữ bóng + quầng đèn. DPR tới 1.25x' },
  { id: 'low', name: 'Thấp', icon: '🚀', desc: 'Nền phẳng, cỏ gọn, bỏ tia lửa/bóng/mây/quầng/aura/cột sáng — nhẹ nhất cho máy yếu. DPR khóa 1x' },
];

const RES_META: { id: ResMode; name: string; icon: string; desc: string }[] = [
  { id: 'auto', name: 'Tự động', icon: '🤖', desc: 'Theo cấp đồ họa: Thấp 60%, TB 85%, Cao 100%' },
  { id: 'full', name: 'Chuẩn 100%', icon: '💎', desc: 'Nét nhất, nặng nhất' },
  { id: 'med', name: 'Nhẹ 75%', icon: '🌤️', desc: 'Nhẹ ~40% điểm ảnh, vẫn rõ' },
  { id: 'low', name: 'Siêu nhẹ 50%', icon: '🚀', desc: 'Chỉ 1/4 điểm ảnh — máy yếu nhất' },
];

/** Cài đặt game: cấp đồ họa + âm thanh */
export default function SettingsModal() {
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const autoQuality = useGame((s) => s.autoQuality);
  const setAutoQuality = useGame((s) => s.setAutoQuality);
  const autoLevel = useGame((s) => s.autoLevel);
  const resMode = useGame((s) => s.resMode);
  const setResMode = useGame((s) => s.setResMode);
  const [mute, setMute] = useState(!isSoundOn());
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-extrabold text-sm mb-1.5">🎨 Cấp đồ họa (đổi là thấy ngay)</div>
        <button
          onClick={() => setAutoQuality(!autoQuality)}
          className={`text-left border-[3px] rounded-lg px-3 py-2 flex items-center gap-2 w-full mb-1.5 ${
            autoQuality ? 'border-green-600 bg-green-50' : 'border-[#2b2117] bg-white'
          }`}
        >
          <span className="text-xl">🤖</span>
          <span className="flex-1">
            <span className="font-extrabold text-sm flex items-center gap-1.5">
              Tự động (khuyên dùng)
              {autoQuality && <span className="text-[10px] bg-green-600 text-white rounded-full px-2 py-0.5">ĐANG DÙNG · {autoLevel === 'low' ? 'Thấp' : autoLevel === 'medium' ? 'TB' : 'Cao'}</span>}
            </span>
            <span className="text-[11px] text-stone-500 block">FPS {'<'} 42 thì tự hạ 1 cấp, {' >'} 57 bền 8s thì tự tăng — khỏi chỉnh tay</span>
          </span>
        </button>
        <div className="flex flex-col gap-1.5">
          {QUALITY_META.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuality(q.id)}
              className={`text-left border-[3px] rounded-lg px-3 py-2 flex items-center gap-2 ${
                quality === q.id ? 'border-green-600 bg-green-50' : 'border-[#2b2117] bg-white'
              }`}
            >
              <span className="text-xl">{q.icon}</span>
              <span className="flex-1">
                <span className="font-extrabold text-sm flex items-center gap-1.5">
                  {q.name}
                  {!autoQuality && quality === q.id && <span className="text-[10px] bg-green-600 text-white rounded-full px-2 py-0.5">ĐANG DÙNG</span>}
                </span>
                <span className="text-[11px] text-stone-500 block">{q.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-extrabold text-sm mb-1.5">🖥️ Độ phân giải render (đổi là thấy ngay)</div>
        <div className="grid grid-cols-2 gap-1.5">
          {RES_META.map((r) => (
            <button
              key={r.id}
              onClick={() => setResMode(r.id)}
              className={`text-left border-[3px] rounded-lg px-2.5 py-1.5 ${
                resMode === r.id ? 'border-green-600 bg-green-50' : 'border-[#2b2117] bg-white'
              }`}
            >
              <span className="font-extrabold text-[13px] flex items-center gap-1">
                {r.icon} {r.name}
                {resMode === r.id && <span className="text-[9px] bg-green-600 text-white rounded-full px-1.5 py-px">DÙNG</span>}
              </span>
              <span className="text-[10px] text-stone-500 block">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-extrabold text-sm mb-1.5">🔊 Âm thanh</div>
        <button
          onClick={() => { const v = !isSoundOn(); setSoundOn(v); setMute(!v); if (v) sfx.coin(); }}
          className="pixel-btn !text-[12px] w-full"
        >
          {mute ? '🔇 Đang tắt — bấm để BẬT' : '🔊 Đang bật — bấm để TẮT'}
        </button>
      </div>
      <p className="text-[11px] text-stone-500">Chọn tay 1 mức sẽ tắt Tự động. Cài đặt lưu theo tài khoản — sang máy khác vẫn giữ nguyên. Mẹo: lag thì bật Tự động + Siêu nhẹ 50% + zoom gần lại (phím +) để vẽ ít vật hơn.</p>
    </div>
  );
}
