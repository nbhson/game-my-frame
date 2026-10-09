// ===== Nội thất các nhà ở thị trấn: vào nhà là có chuyện vui + hoạt động =====
// Mỗi nhà: mô tả hài + sơ đồ nội thất emoji + 3 hoạt động (bấm là có XP/toast,
// vài món tốn xu). Không ảnh hưởng kinh tế lớn, chủ yếu vui + có việc để làm.
import { useGame } from '../game/store';
import { useVillage } from '../net/village';
import { sfx } from '../game/audio';

interface Activity {
  emoji: string;
  name: string;
  desc: string;
  run: () => void;
}

const JOKES_BANH = [
  'Mở tủ ra… 10 hộp bánh, 9 hộp đựng kim chỉ, 1 hộp… cũng kim chỉ!',
  'Bánh quy bơ huyền thoại: ăn 1 miếng, nhớ bà ngoại cả buổi!',
  'Cô Ba dúi cho nắm bánh: "Ăn đi con, ốm nhom ốm nhách!" (+2 XP vì no)',
  'Lục được hộp bánh hết hạn từ 2019 — thôi để lại làm kỷ niệm!',
];
const JOKES_VECHAI = [
  'Lục được cái TV đen trắng: "Hồi đó cả xóm qua coi ké!"',
  'Chú Tám khoe ghế salon làm từ… 200 vỏ lon bia!',
  'Tìm được con diều rách: chú Tám bảo "đồ cổ, 500 xu không bán"!',
  'Dính chổi lông gà quất yêu vào mông! Chạy nhanh còn kịp (+1 XP thể dục)',
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function useActs(house: string): { title: string; emoji: string; intro: string; layout: string; acts: Activity[] } {
  const s = useGame();
  const v = useVillage();
  switch (house) {
    case 'cafe':
      return {
        title: 'Quán Cà phê Mèo', emoji: '🐱', intro: 'Mùi cà phê + tiếng mèo ngáy khò khò. Bà chủ quán tuyên bố: "Không vuốt mèo, không cho về!"',
        layout: '🪑 🐈 ☕ 🐈‍⬛ 🪑\n🍰 🎹 😻 🎹 🍰\n🚪 🪴 🐈 🪴 🚪',
        acts: [
          { emoji: '🐈', name: 'Vuốt mèo', desc: 'Mèo gừ gừ +2 XP', run: () => { sfx.click(); v.sendEmote('😻'); s.addXP(2); s.toast('Mèo Mimi gừ gừ: "gừ… gừ…" +2 XP'); } },
          { emoji: '☕', name: 'Cà phê trứng (10 xu)', desc: 'Uống xong tỉnh cả tuần +4 XP', run: () => { if (s.xu < 10) { sfx.error(); s.toast('Hết xu trả tiền cà phê rồi!'); return; } s.addXu(-10); s.addXP(4); sfx.coin(); v.sendEmote('☕'); s.toast('Cà phê trứng béo ngậy! +4 XP'); } },
          { emoji: '🎹', name: 'Đệm đàn cho mèo nghe', desc: 'Mèo vỗ tay bằng chân +2 XP', run: () => { sfx.harvest(); v.sendEmote('💃'); s.addXP(2); s.toast('Cả quán vỗ tay (mèo vỗ bằng chân)! +2 XP'); } },
        ],
      };
    case 'stage':
      return {
        title: 'Sân khấu Sự kiện', emoji: '🎤', intro: 'Đèn nháy, loa kẹo kéo, mic hơi rè. MC hô: "Ai cũng là ca sĩ, lên là hát!"',
        layout: '💡 🎤 💡\n🕺 💃 🎶\n👏 👏 👏',
        acts: [
          { emoji: '🕺', name: 'Nhảy ngẫu hứng', desc: 'Cả làng hò reo +2 XP', run: () => { sfx.harvest(); v.sendEmote('💃'); s.addXP(2); s.toast('Bạn quẩy hết mình! Khán giả ném hoa (hoa héo) +2 XP'); } },
          { emoji: '🎤', name: 'Hát karaoke', desc: 'Rè mic vẫn hay +2 XP', run: () => { sfx.lvup(); v.sendEmote('🎤'); s.addXP(2); s.toast('Bạn hát "Đắp mộ cuộc tình" — cả làng khóc (vì cảm động?) +2 XP'); } },
          { emoji: '💐', name: 'Tung hoa', desc: 'Ai bắt được hoa cưới liền +1 XP', run: () => { sfx.click(); v.sendEmote('💐'); s.addXP(1); s.toast('Bạn tung hoa! Một bác nông dân bắt được, cười tít mắt +1 XP'); } },
        ],
      };
    case 'house1':
      return {
        title: 'Nhà cô Ba', emoji: '🏠', intro: 'Nhà cô Ba thơm mùi bánh quy bơ. Tủ lạnh kêu ục ục, mèo mướp nằm canh như bảo vệ.',
        layout: '🛋️ 📺 🐟\n🍪 🫖 😺\n🚪 🧹 🪴',
        acts: [
          { emoji: '🍪', name: 'Mở tủ bánh', desc: 'Hên xui trúng bánh +1-3 XP', run: () => { const xp = 1 + Math.floor(Math.random() * 3); sfx.eat(); s.addXP(xp); s.toast(pick(JOKES_BANH) + ` (+${xp} XP)`); } },
          { emoji: '🥬', name: 'Phụ nhặt rau', desc: 'Cô Ba khen ngoan +2 XP', run: () => { sfx.plant(); s.addXP(2); s.toast('Nhặt rau muống với cô Ba, nghe 3 câu chuyện hàng xóm +2 XP'); } },
          { emoji: '🙏', name: 'Xin vía mát tay', desc: 'Trồng gì cũng tốt (tin thế) +1 XP', run: () => { sfx.coin(); v.sendEmote('🙏'); s.addXP(1); s.toast('Cô Ba phẩy quạt: "Vía đây! Mai gieo hạt nhớ khấn!" +1 XP'); } },
        ],
      };
    case 'house2':
      return {
        title: 'Nhà chú Tám', emoji: '🏚️', intro: 'Vựa ve chai kiêm bảo tàng đồ cũ. Chú Tám tuyên bố: "Đồ cũ là đồ cổ, chỉ là chưa ai trả giá!"',
        layout: '📺 📻 🚲\n🔧 🪑 🗿\n🚪 🧹 🐓',
        acts: [
          { emoji: '🔍', name: 'Lục kho ve chai', desc: 'Hên thì +5 xu, xui dính chổi', run: () => { const lucky = Math.random() < 0.4; if (lucky) { s.addXu(5); sfx.coin(); s.addXP(2); s.toast('Bán được cái nắp nồi cũ +5 xu! +2 XP'); } else { sfx.error(); v.sendEmote('😂'); s.addXP(1); s.toast(pick(JOKES_VECHAI) + ' (+1 XP)'); } } },
          { emoji: '🔧', name: 'Học chế đồ', desc: 'Chế ghế từ vỏ lon +2 XP', run: () => { sfx.click(); s.addXP(2); s.toast('Chú Tám dạy cuốn dây điện bằng… dây chuối! +2 XP'); } },
          { emoji: '👻', name: 'Nghe chuyện ma', desc: 'Sợ nhưng vui +1 XP', run: () => { sfx.spray(); v.sendEmote('😱'); s.addXP(1); s.toast('Chuyện "ma lồng đèn ở bờ sông"… ủa mà đèn thị trấn mà! +1 XP'); } },
        ],
      };
    case 'hall':
    default:
      return {
        title: 'Hội quán Thị trấn', emoji: '🏛️', intro: 'Bảng vàng treo đầy ảnh "Nông dân xuất sắc". Bác hội trưởng đang ngủ gật sau quầy, ngáy theo nhịp quạt.',
        layout: '🏆 📜 🏆\n🪑 😴 🪑\n🚪 📢 🪴',
        acts: [
          { emoji: '🏆', name: 'Xem bảng vàng', desc: 'Học hỏi cao thủ +2 XP', run: () => { sfx.click(); s.addXP(2); s.toast('Bảng vàng: "Cụ Sáu trồng sâm 900 ngày không sót vụ nào!" +2 XP'); } },
          { emoji: '🍉', name: 'Thi ăn dưa (20 xu)', desc: 'Thắng thì oai +5 XP', run: () => { if (s.xu < 20) { sfx.error(); s.toast('Cần 20 xu lệ phí thi!'); return; } s.addXu(-20); const win = Math.random() < 0.5; sfx.splash(); if (win) { s.addXP(5); v.sendEmote('🏆'); s.toast('Bạn ăn 3 miếng dưa trong 10 giây — VÔ ĐỊCH! +5 XP'); } else { s.addXP(2); v.sendEmote('😂'); s.toast('Sặc dưa! Khán giả cười bò nhưng phục tinh thần +2 XP'); } } },
          { emoji: '🧹', name: 'Quét sân hội quán', desc: 'Công ích +1 XP, bác hội trưởng tỉnh giấc khen', run: () => { sfx.water(); s.addXP(1); s.toast('Bác hội trưởng giật mình: "Đứa nào quét mà sạch thế!" +1 XP'); } },
        ],
      };
  }
}

export default function TownHouseModal({ house }: { house: string }) {
  const { title, emoji, intro, layout, acts } = useActs(house);
  return (
    <div>
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 border-2 border-black rounded-xl px-3 py-2 text-white text-center mb-2">
        <div className="font-black text-lg">{emoji} {title.toUpperCase()}</div>
        <div className="text-xs opacity-95">{intro}</div>
      </div>
      <div className="bg-[#2b2117] text-center rounded-xl border-2 border-black px-2 py-2 mb-2 whitespace-pre-line text-2xl leading-9">
        {layout}
      </div>
      <div className="flex flex-col gap-2">
        {acts.map((a) => (
          <button
            key={a.name}
            onClick={a.run}
            className="flex items-center gap-2 bg-white border-[3px] border-black rounded-xl px-3 py-2 text-left hover:border-yellow-400 active:scale-[0.98]"
          >
            <span className="text-2xl">{a.emoji}</span>
            <span>
              <span className="font-extrabold text-sm block">{a.name}</span>
              <span className="text-[12px] text-stone-500">{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="text-[11px] text-stone-500 text-center mt-2">Vào nhà người khác mà quậy vừa vừa thôi nhé 😆</div>
    </div>
  );
}
