// ===== MODAL NHÀ VĂN HÓA: hướng dẫn cưới + lễ đang diễn ra =====
import { WED_DURATION, useWedding } from '../net/wedding';

export default function WeddingModal() {
  const ceremony = useWedding((s) => s.ceremony);
  const guests = useWedding((s) => s.guests);
  if (ceremony) {
    const left = Math.max(0, Math.ceil((WED_DURATION - (Date.now() - ceremony.startsAt)) / 1000));
    return (
      <div className="space-y-2 text-center">
        <div className="text-5xl">💒</div>
        <div className="font-black text-xl">{ceremony.a} ❤️ {ceremony.b}</div>
        <div className="font-bold">Lễ cưới đang diễn ra — còn {left}s!</div>
        <div className="font-bold text-pink-700">🌸 {guests.length} khách đã tung hoa chúc mừng</div>
        <div className="bg-pink-100 rounded-xl p-2 border-2 border-black font-bold text-sm">
          Tới sân nhà văn hóa, bấm emote bất kỳ (👏 ❤️ 💃…) để tung hoa — dự lễ có lộc 50 xu!<br />
          Cô dâu chú rể nhận quà mừng 200 xu + 1 gem!
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-center text-5xl">💒</div>
      <div className="font-black text-center text-lg">NHÀ VĂN HÓA — NƠI TÌNH YÊU ĐƠM HOA</div>
      <div className="bg-white/70 rounded-xl p-2.5 border-2 border-black font-bold text-sm space-y-1.5">
        <div>1️⃣ Rủ "người ấy" ra <b>sân trước nhà văn hóa</b> (bãi đông-bắc thị trấn).</div>
        <div>2️⃣ Cả 2 cùng bấm <b>💍 Cầu hôn</b> ở thanh cảm xúc — cặp đôi sẽ diễn hoạt ảnh cầu hôn!</div>
        <div>3️⃣ Lễ cưới mở <b>45 giây</b>: mưa hoa + tim rơi khắp sân.</div>
        <div>4️⃣ Cả làng tới <b>bấm emote tung hoa</b> chúc mừng — khách dự nhận <b>lộc 50 xu</b>, cô dâu chú rể nhận <b>quà mừng 200 xu + 1 gem</b>!</div>
      </div>
      <div className="text-xs font-bold text-stone-500 text-center">Phí tổ chức 100 xu/người • Mỗi lễ cách nhau ít nhất 3 phút để cả làng kịp ăn cỗ 😄</div>
    </div>
  );
}
