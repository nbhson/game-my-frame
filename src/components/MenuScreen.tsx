import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { useGame } from '../game/store';
import { getAccountBackend, exportAccount } from '../net/account';
import { getLastAccount, normalizeUsername, setLastAccount } from '../net/session';
import { sfx } from '../game/audio';
import { GameIcon } from './GameIcon';

const FARMER_ICONS = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];

export default function MenuScreen() {
  const loadAccount = useGame((s) => s.loadAccount);
  const toast = useGame((s) => s.toast);
  const [name, setName] = useState(getLastAccount() || '');
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  async function login() {
    const username = normalizeUsername(name);
    if (!username || busy) return;
    setBusy(true);
    try {
      const backend = await getAccountBackend();
      setMode(backend.kind === 'server' ? 'LAN server' : 'máy này');
      const found = await backend.load(username);
      // tên hiển thị giữ đúng chữ hoa/thường người dùng gõ
      const display = name.trim().slice(0, 12);
      if (found) {
        loadAccount(found.name, found.avatar, found.data);
        toast(`Chào mừng trở lại, ${found.name}! (Ngày ${found.data.day})`);
      } else {
        loadAccount(display, avatar, null);
        await backend.save(username, display, avatar, exportAccount());
        toast(`Tạo nông trại mới cho ${display}!`);
      }
      setLastAccount(username);
      sfx.click();
    } catch {
      toast('Không lưu/đọc được dữ liệu, thử lại nhé!');
    }
    setBusy(false);
  }

  return (
    <div className="h-full overflow-auto flex items-center justify-center p-4 bg-gradient-to-b from-sky-300 via-[#a8e063] to-[#56ab2f] relative">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.15) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="pixel-panel p-7 text-center max-w-md w-full z-10"
      >
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="flex justify-center">
          <GameIcon name="lua" size={64} />
        </motion.div>
        <h1 className="font-pixel text-2xl leading-relaxed text-green-700 mt-2" style={{ textShadow: '2px 2px 0 #ffeb3b, 4px 4px 0 #2b2117' }}>
          NÔNG TRẠI
          <br />
          PIXEL 2.0
        </h1>
        <p className="text-sm mt-3 leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
          <GameIcon name="sprout" size={18} /> Trồng cây • <GameIcon name="rod" size={18} /> Nuôi cá • <GameIcon name="chicken" size={18} /> Chăn nuôi • <GameIcon name="field" size={18} /> Làng online
        </p>
        <div className="flex gap-2 justify-center my-4">
          {FARMER_ICONS.map((ic, i) => (
            <button
              key={i}
              onClick={() => { setAvatar(i); sfx.click(); }}
              className={`w-16 h-16 border-[3px] border-[#2b2117] rounded-lg bg-white flex items-center justify-center ${avatar === i ? 'bg-yellow-200 scale-110 shadow-pixel' : ''}`}
            >
              <GameIcon name={ic} size={44} />
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 12))}
          onKeyDown={(e) => { if (e.key === 'Enter') void login(); }}
          placeholder="Nhập username… (vd: baocute)"
          className="w-full text-center text-lg font-bold border-[3px] border-[#2b2117] rounded-md p-2 mb-3"
        />
        <button
          className="pixel-btn w-full !bg-green-500 !text-white flex items-center justify-center gap-2"
          onClick={() => void login()}
          disabled={busy || !normalizeUsername(name)}
        >
          <LogIn size={16} /> {busy ? 'ĐANG TẢI FARM…' : 'VÀO NÔNG TRẠI'}
        </button>
        <p className="text-xs mt-3 text-stone-600 leading-relaxed bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2">
          <b>Username là tài khoản:</b> lần đầu nhập tên mới → tạo farm mới.
          <br />Reload trang, đổi tab, đổi máy (cùng LAN server) → nhập <b>đúng username</b> là lấy lại farm.
          {mode && <><br />Đang dùng: <b>{mode}</b></>}
        </p>
        <p className="text-xs mt-2 text-stone-500 leading-relaxed">
          WASD / Mũi tên để đi • E / Click để tương tác
          <br />Mobile có joystick + nút hành động
        </p>
      </motion.div>
    </div>
  );
}
