import { useState } from 'react';
import { isSoundOn, setSoundOn, sfx } from '../game/audio';
import { useGame } from '../game/store';
import type { GraphicsQuality } from '../game/types';

const QUALITY_META: { id: GraphicsQuality; name: string; icon: string; desc: string }[] = [
  { id: 'high', name: 'Cao', icon: '✨', desc: 'Đủ hiệu ứng: bóng, tia lửa, bướm, đom đóm, mưa tuyết dày' },
  { id: 'medium', name: 'Trung bình', icon: '🌤️', desc: 'Giảm một nửa hạt mưa/tuyết, bướm, đom đóm; giữ bóng + tia lửa' },
  { id: 'low', name: 'Thấp', icon: '🚀', desc: 'Tắt bóng + tia lửa + bướm + đom đóm, mưa thưa — máy yếu mượt nhất' },
];

/** Cài đặt game: cấp đồ họa + âm thanh */
export default function SettingsModal() {
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const [mute, setMute] = useState(!isSoundOn());
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-extrabold text-sm mb-1.5">🎨 Cấp đồ họa (đổi là thấy ngay)</div>
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
                  {quality === q.id && <span className="text-[10px] bg-green-600 text-white rounded-full px-2 py-0.5">ĐANG DÙNG</span>}
                </span>
                <span className="text-[11px] text-stone-500 block">{q.desc}</span>
              </span>
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
      <p className="text-[11px] text-stone-500">Cấp đồ họa được lưu theo tài khoản — sang máy khác vẫn giữ nguyên.</p>
    </div>
  );
}
