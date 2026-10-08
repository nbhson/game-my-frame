import { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGame } from '../game/store';
import ShopModal from './ShopModal';
import BagModal from './BagModal';
import QuestModal from './QuestModal';
import HelpModal from './HelpModal';
import VillageModal from './VillageModal';
import SeedModal from './SeedModal';
import StockModal from './StockModal';
import BaitModal from './BaitModal';
import PenModal from './PenModal';
import BulkModal from './BulkModal';
import WerewolfModal from './WerewolfModal';
import GiftCodeModal from './GiftCodeModal';
import OutfitModal from './OutfitModal';
import SettingsModal from './SettingsModal';
import TownHouseModal from './TownHouseModal';
import { GameIcon } from './GameIcon';

// Casino (sảnh + 5 bàn + logic bài) nặng — tải lười khi mở, nhẹ bundle lúc đăng nhập
const CasinoModal = lazy(() => import('./CasinoModal'));

export default function ModalHost() {
  const modal = useGame((s) => s.modal);
  const setModal = useGame((s) => s.setModal);
  if (!modal) return null;

  let title = '';
  let icon = '';
  let body: React.ReactNode = null;
  if (modal === 'shop') { icon = 'shop'; title = 'CỬA HÀNG NÔNG TRẠI'; body = <ShopModal />; }
  else if (modal === 'bag') { icon = 'bag'; title = 'KHO ĐỒ'; body = <BagModal />; }
  else if (modal === 'quest') { icon = 'quest'; title = 'NHIỆM VỤ'; body = <QuestModal />; }
  else if (modal === 'help') { icon = 'quest'; title = 'HƯỚNG DẪN'; body = <HelpModal />; }
  else if (modal === 'village') { icon = 'field'; title = 'LÀNG NÔNG DÂN'; body = <VillageModal />; }
  else if (modal === 'casino') { icon = 'coin'; title = '🎰 CASINO CÔNG VIÊN'; body = (<Suspense fallback={<div className="p-6 text-center font-bold">Đang mở Casino…</div>}><CasinoModal /></Suspense>); }
  else if (modal === 'gift') { icon = 'gift'; title = 'NHẬP CODE NHẬN QUÀ'; body = <GiftCodeModal />; }
  else if (modal === 'outfit') { icon = 'shop'; title = 'SHOP THỜI TRANG'; body = <OutfitModal />; }
  else if (modal === 'settings') { icon = 'quest'; title = 'CÀI ĐẶT'; body = <SettingsModal />; }
  else if (typeof modal === 'object' && modal.name === 'house') {
    const hn = modal.house === 'cafe' ? 'QUÁN CÀ PHÊ MÈO' : modal.house === 'stage' ? 'SÂN KHẤU SỰ KIỆN'
      : modal.house === 'house1' ? 'NHÀ CÔ BA' : modal.house === 'house2' ? 'NHÀ CHÚ TÁM' : 'HỘI QUÁN CÔNG VIÊN';
    icon = 'shop'; title = hn; body = <TownHouseModal house={modal.house} />;
  }
  else if (typeof modal === 'object' && modal.name === 'seed') { icon = 'sprout'; title = `GIEO HẠT (ô ${modal.plot + 1})`; body = <SeedModal plot={modal.plot} />; }
  else if (typeof modal === 'object' && modal.name === 'stock') { icon = 'pond'; title = 'THẢ CÁ XUỐNG AO'; body = <StockModal />; }
  else if (typeof modal === 'object' && modal.name === 'bait') { icon = 'rod'; title = 'CHỌN MỒI CÂU'; body = <BaitModal pier={modal.pier} />; }
  else if (typeof modal === 'object' && modal.name === 'pen') {
    icon = 'mail';
    title = modal.pen === 'pond' ? 'AO CÁ' : modal.pen === 'coop' ? 'CHUỒNG GÀ–VỊT' : 'TRẠI BÒ–HEO–CỪU';
    body = <PenModal pen={modal.pen} />;
  }
  else if (typeof modal === 'object' && modal.name === 'bulk') { icon = 'basket'; title = '⚡ LÀM HÀNG LOẠT'; body = <BulkModal />; }
  else if (typeof modal === 'object' && modal.name === 'wolf') { icon = 'quest'; title = '🐺 MA SÓI CÔNG VIÊN'; body = <WerewolfModal />; }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-3"
        onClick={() => setModal(null)}
      >
        <motion.div
          initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
          className="pixel-panel w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center bg-green-600 text-white px-4 py-2.5 font-pixel text-[13px] border-b-4 border-[#2b2117]">
            <span className="flex items-center gap-2"><GameIcon name={icon} size={22} />{title}</span>
            <button onClick={() => setModal(null)} className="bg-red-500 border-2 border-black rounded-md w-8 h-8 flex items-center justify-center hover:bg-red-400">
              <X size={16} />
            </button>
          </div>
          <div className="p-3 overflow-y-auto">{body}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
