import { useGame } from '../game/store';

export default function HelpModal() {
  const reset = useGame((s) => s.reset);
  return (
    <div className="text-[13px] leading-relaxed space-y-2">
      <Help>🚶 <b>Di chuyển:</b> WASD / mũi tên / click vào bản đồ / joystick (mobile). Bấm <b>E</b> để tương tác.</Help>
      <Help>🌱 <b>Trồng cây:</b> Ra ruộng → <b>E: Cuốc đất</b> → <b>E: Gieo hạt</b> → <b>E: Tưới nước</b> (khô sau 45s) → thu hoạch → bán ở 🏪. Khởi đầu 6 ô, mở tối đa <b>45 ô</b> bằng xu + cấp (bấm E vào ô 🔒).</Help>
      <Help>🐟 <b>Nuôi cá:</b> Mua <i>cá con</i> ở shop → ra ao <b>thả</b> (cá tự bơi, khởi đầu nuôi 3 con, tối đa 15) → <b>cho ăn</b> → thu hoạch. <b>Không câu ở ao nuôi!</b> Bấm E vào <b>hòm thư 📮</b> trước ao để xem đàn cá + mở thêm chỗ.</Help>
      <Help>🎣 <b>Câu sông:</b> Shop đã dời ra bãi đất gần bờ sông. Ra 3 bến ở sông cuối map → bấm E → chọn mồi → nhân vật <b>ngồi câu thật</b>. Thấy ❗ thì bấm E giật ngay, chậm là cá chạy! Mồi ngon dễ dính cá hiếm.</Help>
      <Help>🐔🦆🐄🐷🐑 <b>Chăn nuôi:</b> Mỗi chuồng khởi đầu 3 chỗ, nới lên tối đa (gà 30, vịt 15, bò/heo 20, cừu 12). Bấm E vào <b>hòm thư 📮</b> trước chuồng để xem + cho ăn + mở thêm chỗ. Cám cao cấp giúp ra sản phẩm nhanh hơn.</Help>
      <Help>📅 <b>Ngày/đêm</b> tự chạy ~4 phút/ngày. Cây lớn theo thời gian thực, nhớ tưới đều!</Help>
      <Help>🛖 <b>Multiplayer kiểu Avatar (phím V):</b> thấy bạn bè đi lại cùng map, chat có bóng thoại. Mỗi người có <b>mã farm 6 ký tự</b> — chia sẻ link <code>?visit=MÃ</code> để bạn qua <b>thăm farm</b> (chỉ xem). Chưa cấu hình Supabase thì mở 2 tab cùng trình duyệt là chơi chung được (làng local).</Help>
      <Help>🏗 <b>Kiến trúc mới:</b> React + Zustand + Canvas engine tách lớp — thêm cây/cá/map mới chỉ cần sửa <code>data.ts</code>/<code>world.ts</code>.</Help>
      <button className="pixel-btn !text-[10px]" onClick={() => { if (confirm('Xóa hết chơi lại?')) reset(); }}>🗑 Chơi lại từ đầu</button>
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border-2 border-[#2b2117] rounded-lg p-2.5">{children}</div>;
}
