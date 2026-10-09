// ===== Logic hành động trong 6 nhà: mở overlay, trừ/cộng vật phẩm-xu-XP thật =====
import { useGame } from './store';
import { useVillage } from '../net/village';
import { sfx } from './audio';
import { CARS, itemName, sellPrice } from './data';
import type { InActItem } from './types';
import {
  BAR_MENU, BENCH, BENCH_FEE, CAT_SHOW_PERIOD, DAILIES, FUND_MILESTONES, GOLDEN_PERIOD, GOSSIP_LINES, INTERIORS, LOVE_MILESTONES,
  MIRROR_LINES, NHOC_RIDDLES, PHOTO_LINES, RADIO_NEWS, RECIPES, SHOP_QUIZZES, SLOT_COST, SLOT_PAIR, SLOT_PAY, SLOT_SYMBOLS,
  STAMP_REWARD_XU, TABLE_BETS, TABLE_GAME, TABLE_META, TAM_STORIES, WHEEL_COST, WHEEL_PRIZES,
  cafeSpecial, goldenActive, goldenIn, houseOrderOf, stageRequestAt,
} from './interiors';
import { fmtDraw, useLottery } from '../net/lottery';
import { useCasino, type CasinoGame } from '../net/casino';
import { cheerFans, furnPulse, petCat, spawnBurst } from './interiorRender';

const g = () => useGame.getState();
const pulse = (furn: string) => furnPulse(`${g().interiorId}:${furn}`);
const ok = () => { g().checkQuest(); };
const F = (flag: string) => !!g().daily.flags[flag];

// danh sách nông sản đang có (trừ hạt giống/cám/mồi)
function cropItems(min = 1) {
  const s = g();
  return Object.keys(s.inv)
    .filter((pid) => (s.inv[pid] || 0) >= min && !pid.startsWith('seed:') && !pid.startsWith('baby') && !['feed', 'feedPro', 'bait', 'baitPro', 'pesticide'].includes(pid))
    .map((pid) => ({ pid, n: s.inv[pid] }));
}

// ================= MỞ ĐỒ ĐẠC / NPC =================
export function openInteriorFurn(furn: string, px: number, py: number) {
  const s = g();
  const id = s.interiorId;
  if (!id) return;
  pulse(furn);
  if (furn.startsWith('npc:')) { openNpcDialog(furn.slice(4), px, py); return; }
  switch (id + ':' + furn) {
    // ---- cafe ----
    case 'cafe:counter': {
      const sp = cafeSpecial(s.day);
      const mk = (d: string, price: number, isSp: boolean) => ({
        id: d, label: `${isSp ? '⭐ ' : ''}${d === 'coffee' ? 'Cà phê trứng' : 'Sữa nóng'} — ${price} xu`,
        desc: d === 'coffee' ? `Tỉnh táo, chạy nhanh 60s${isSp ? ' +8 XP (món hôm nay x2!)' : ' +4 XP'}` : `Ngọt béo${isSp ? ' +12 XP (món hôm nay x2!)' : ' +6 XP'}, mèo cũng thèm`,
        disabled: s.xu < price,
      });
      s.setInAct({ mode: 'list', furn, title: 'Quầy order', sub: `Hôm nay: ⭐ ${sp.name} x2 XP!`, list: { action: 'order', items: [
        mk('coffee', 10, sp.id === 'coffee'),
        mk('milk', 25, sp.id === 'milk'),
      ] } }); sfx.click(); break;
    }
    case 'cafe:table1':
    case 'cafe:table2': {
      s.addXP(1); sfx.eat(); useVillage.getState().sendEmote('☕');
      spawnBurst(px, py - 40, 'note');
      s.toast('Ngồi nhâm nhi ngắm mèo qua cửa sổ… chill! (+1 XP)');
      ok(); break;
    }
    case 'cafe:piano':
      s.setInAct({ mode: 'timing', furn, title: 'Đệm đàn cho mèo nghe', sub: 'Bấm đúng lúc kim vào giữa — 5 nốt', rhythm: { total: 5, done: 0, score: 0 } });
      sfx.click(); break;
    case 'cafe:shelf':
      if (!F('shelf')) { s.setDailyFlag('shelf'); s.addXP(2); sfx.harvest(); s.toast('Kệ bánh đẹp như tranh! Ngắm no cả mắt +2 XP'); ok(); }
      else { sfx.click(); s.toast('Bánh trưng bày thôi — thèm thì ra tủ cô Ba nhé!'); }
      break;
    case 'cafe:tipjar': openTipjar(); sfx.click(); break;
    case 'cafe:cattree':
      s.setInAct({ mode: 'hold', furn, title: 'Dụ mèo leo cây', sub: 'Giữ nút cho đầy vòng — mèo nào leo lên?', holdSecs: 1.5 });
      sfx.click(); break;
    // ---- hall ----
    case 'hall:board': openBoard(); sfx.click(); break;
    case 'hall:donate': openDonate(); sfx.click(); break;
    case 'hall:trophy':
      if (!F('trophy')) { s.setDailyFlag('trophy'); s.addXP(2); sfx.lvup(); spawnBurst(px, py - 60, 'spark'); s.toast('Cúp "Nông dân xuất sắc 3 năm liền" — học hỏi! +2 XP'); ok(); }
      else { sfx.click(); s.toast('Tủ cúp vàng bóng loáng — ráng một ngày tên mình lên đó!'); }
      break;
    case 'hall:table1':
      s.addXP(1); sfx.click(); useVillage.getState().sendEmote('📜');
      s.toast('Bàn họp làng: ai ngồi vào cũng thấy mình quan trọng (+1 XP)');
      ok(); break;
    case 'hall:bell':
      s.setInAct({ mode: 'timing', furn, title: 'Đánh chuông họp làng', sub: 'Đúng nhịp 3 tiếng — cả làng nghe thấy!', rhythm: { total: 3, done: 0, score: 0 } });
      sfx.click(); break;
    case 'hall:teatable':
      s.setInAct({ mode: 'hold', furn, title: 'Ngồi uống chè', sub: 'Giữ nút cho đầy vòng — nghe chuyện làng', holdSecs: 1.2 });
      sfx.click(); break;
    // ---- shop ----
    case 'shop:rack': s.setModal('outfit'); sfx.click(); break;
    case 'shop:mirror': {
      if (!F('mirror')) {
        s.setDailyFlag('mirror'); s.addXP(2); sfx.harvest();
        spawnBurst(px, py - 60, 'spark');
        s.toast(MIRROR_LINES[Math.floor(Math.random() * MIRROR_LINES.length)] + ' (+2 XP)');
        ok();
      } else { sfx.click(); s.toast('Gương: "Đẹp rồi, đi chơi đi!"'); }
      break;
    }
    case 'shop:mannequin':
      s.setInAct({ mode: 'timing', furn, title: 'Thử thách phối đồ', sub: 'Dừng kim đúng giữa 1 lần duy nhất!', rhythm: { total: 1, done: 0, score: 0 } });
      sfx.click(); break;
    case 'shop:salebin': openSale(); sfx.click(); break;
    case 'shop:costume': openCostume(); sfx.click(); break;
    // ---- gara ----
    case 'garage:catalog': s.setModal('carshop'); sfx.click(); break;
    case 'garage:display1':
    case 'garage:display2':
    case 'garage:display3': openDisplay(furn); sfx.click(); break;
    case 'garage:lift': openLift(); sfx.click(); break;
    case 'garage:toolboard':
      s.setInAct({ mode: 'timing', furn, title: 'Thử tay nghề siết ốc', sub: 'Dừng kim đúng giữa 3 lần — khéo tay có thưởng!', rhythm: { total: 3, done: 0, score: 0 } });
      sfx.click(); break;
    // ---- stage ----
    case 'stage:stageplat':
      s.setInAct({ mode: 'timing', furn, title: 'Biểu diễn trên sân khấu', sub: 'Đúng nhịp 7 nốt — khán giả bo tiền!', rhythm: { total: 7, done: 0, score: 0 } });
      sfx.click(); break;
    case 'stage:lights': {
      const cols = ['#ffd24d', '#ff5b5b', '#5bff8a', '#5bb8ff', '#c58aff'];
      const next = cols[(cols.indexOf(s.stageColor) + 1) % cols.length];
      s.setStageColor(next); sfx.spray();
      if (!F('lights')) { s.setDailyFlag('lights'); s.addXP(1); ok(); }
      s.toast('Đổi màu đèn sân khấu! Khán giả hú hét!');
      break;
    }
    case 'stage:giftbox': {
      if (!F('giftbox')) {
        s.setDailyFlag('giftbox');
        const r = Math.random();
        sfx.coin(); spawnBurst(px, py - 40, 'flower');
        if (r < 0.3) { s.addInv('bait', 3); s.toast('Fan tặng 3 mồi câu + thiệp "câu cá to nhé!"'); }
        else if (r < 0.6) { s.addInv('feed', 3); s.toast('Fan tặng 3 cám + thiệp "nuôi heo mập nhé!"'); }
        else if (r < 0.85) { s.addXu(30); s.toast('Fan bo 30 xu trong phong bì hoa!'); }
        else { s.addInv('flan', 1); s.toast('Fan tặng Bánh flan nhà làm! Ngọt lịm!'); }
        s.addXP(2); ok();
      } else { sfx.click(); s.toast('Hòm hoa trống — diễn hay thì mai fan lại tặng!'); }
      break;
    }
    case 'stage:drum':
      s.setInAct({ mode: 'timing', furn, title: 'Đánh trống hội', sub: 'Đúng nhịp 5 dùi — khán giả bo tiền!', rhythm: { total: 5, done: 0, score: 0 } });
      sfx.click(); break;
    case 'stage:disco': {
      cheerFans(); spawnBurst(px, py - 60, 'spark');
      useVillage.getState().sendEmote('🪩');
      if (!F('disco')) { s.setDailyFlag('disco'); s.addXP(2); s.toast('Bật cầu disco! Cả sàn nhún nhảy (+2 XP)'); ok(); }
      else { sfx.click(); s.toast('Cầu disco xoay tít! Khán giả hú hét!'); }
      break;
    }
    // ---- house1 ----
    case 'house1:stove': openCook(); sfx.click(); break;
    case 'house1:cabinet': {
      s.touchDaily();
      if (!F('cake')) {
        s.setDailyFlag('cake'); s.addInv('flan', 1); s.addXP(3); sfx.eat();
        spawnBurst(px, py - 40, 'heart');
        s.toast('Cô Ba dúi cho 1 Bánh flan nóng hổi! (+3 XP, bán được 300 xu)');
        ok();
      } else { sfx.click(); s.toast('Tủ bánh hôm nay hết phần bạn rồi — mai quay lại!'); }
      break;
    }
    case 'house1:bedbox':
      s.setInAct({ mode: 'hold', furn, title: 'Rửa bát giúp cô Ba', sub: 'Giữ nút cho đầy vòng', holdSecs: 1.2 });
      sfx.click(); break;
    case 'house1:table1':
      s.addXP(1); sfx.eat(); s.toast('Bàn ăn đầy ắp — ngồi vào là thấy đói (+1 XP)');
      ok(); break;
    case 'house1:orderboard': openOrder(); sfx.click(); break;
    case 'house1:herb': {
      s.touchDaily();
      if (!F('herb')) {
        s.setDailyFlag('herb'); s.addInv('caixanh', 2); s.addXP(2); sfx.harvest();
        spawnBurst(px, py - 40, 'spark');
        s.toast('Hái mớ rau thơm tươi rói! +2 Cải xanh (+2 XP)');
        ok();
      } else { sfx.click(); s.toast('Rau mới hái rồi — mai lại ra hái tiếp!'); }
      break;
    }
    case 'house1:photo': {
      s.touchDaily();
      const line = PHOTO_LINES[Math.floor(Math.random() * PHOTO_LINES.length)];
      if (!F('photo')) { s.setDailyFlag('photo'); s.addXP(2); sfx.harvest(); spawnBurst(px, py - 40, 'heart'); s.toast(line + ' (+2 XP)'); ok(); }
      else { sfx.click(); s.toast(line); }
      break;
    }
    // ---- house2 ----
    case 'house2:junk': {
      const left = Math.ceil((s.junkAt + 45000 - Date.now()) / 1000);
      if (left > 0) { sfx.error(); s.toast(`Đống ve chai vừa bị bới tung rồi — ${left}s nữa quay lại!`); break; }
      s.setInAct({ mode: 'hold', furn, title: 'Bới đống ve chai', sub: 'Giữ nút cho đầy vòng', holdSecs: 2.5 });
      sfx.click(); break;
    }
    case 'house2:bench': openBench(); sfx.click(); break;
    case 'house2:shelf': {
      if (!F('antique')) {
        s.setDailyFlag('antique'); s.addXP(1); sfx.click();
        s.toast('TV đen trắng: "Hồi đó cả xóm qua coi ké!" (+1 XP)');
        ok();
      } else { sfx.click(); s.toast('Đồ cổ của chú Tám: 500 xu không bán!'); }
      break;
    }
    case 'house2:motor':
      s.setInAct({ mode: 'hold', furn, title: 'Đạp máy xe ve chai', sub: 'Giữ nút cho đầy vòng — nổ máy là oách!', holdSecs: 2 });
      sfx.click(); break;
    case 'house2:radio':
      s.setInAct({ mode: 'timing', furn, title: 'Dò sóng radio', sub: 'Dừng kim đúng giữa 3 lần — bắt tin làng!', rhythm: { total: 3, done: 0, score: 0 } });
      sfx.click(); break;
    // ---- casino ----
    case 'casino:vault': openVault(); sfx.click(); break;
    case 'casino:tableTL':
    case 'casino:tableBC':
    case 'casino:tableXD': openCasinoTable(furn); sfx.click(); break;
    case 'casino:tableChess': openChessTable(); sfx.click(); break;
    case 'casino:slot': openSlot(); sfx.click(); break;
    case 'casino:bar': openBar(); sfx.click(); break;
    case 'casino:wheel': openWheel(); sfx.click(); break;
    // ---- nhà vé số ----
    case 'xoso:counter': s.setModal('lottery'); sfx.click(); break;
    case 'xoso:scratch': openScratch(px, py); sfx.click(); break;
    case 'xoso:board': openXosoBoard(); sfx.click(); break;
    case 'xoso:tipjar': {
      // Hũ lộc vé số: bỏ 5 xu xin vía, mỗi ngày 1 lần hên
      if (!F('xosotip')) {
        if (s.xu < 5) { sfx.error(); s.toast('Hết xu bỏ hũ lộc rồi!'); break; }
        s.setDailyFlag('xosotip'); s.addXu(-5); s.addXP(2);
        const r = Math.random();
        if (r < 0.25) { s.addXu(50); s.toast('Bỏ 5 xu xin vía — lộc về +50 xu!'); }
        else if (r < 0.4) { s.addInv('baitPro', 1); s.toast('Bỏ 5 xu xin vía — được 1 mồi ngon!'); }
        else s.toast('Bỏ 5 xu xin vía — chúc kỳ này trúng độc đắc! (+2 XP)');
        sfx.coin(); spawnBurst(px, py - 40, 'coin'); ok();
      } else { sfx.click(); s.toast('Hôm nay xin vía rồi — mai quay lại!'); }
      break;
    }
    // ---- nhà trường đua ----
    case 'racehouse:board': s.setModal('race'); sfx.click(); break;
    case 'racehouse:trophy': {
      if (!F('racetrophy')) { s.setDailyFlag('racetrophy'); s.addXP(2); sfx.lvup(); spawnBurst(px, py - 60, 'spark'); s.toast('Cúp Tay Lái Vàng: vô địch 3 giải mới được khắc tên! +2 XP'); ok(); }
      else { sfx.click(); s.toast('Cúp Tay Lái Vàng bóng loáng — ráng vô địch để khắc tên!'); }
      break;
    }
    case 'racehouse:bell':
      sfx.lvup(); useVillage.getState().sendEmote('🏁');
      s.toast('Kenggg! Chuông xuất phát — chúc bạn về nhất!');
      break;
    // ---- hang ma sói ----
    case 'wolfhouse:board': s.setModal({ name: 'wolf' }); sfx.click(); break;
    case 'wolfhouse:bell':
      sfx.click(); useVillage.getState().sendEmote('🐺');
      s.toast('Boong... boong... đêm nay sói lại đi săn!');
      break;
    case 'wolfhouse:shelf': {
      if (!F('wolfmask')) { s.setDailyFlag('wolfmask'); s.addXP(2); sfx.harvest(); spawnBurst(px, py - 40, 'spark'); s.toast('Bạn đội thử mặt nạ sói — trông gian lắm! (+2 XP)'); ok(); }
      else { sfx.click(); s.toast('Kệ mặt nạ: sói, dân, tiên tri, bảo vệ — đủ cả!'); }
      break;
    }
    default: s.toast('Chưa có gì ở đây!');
  }
}

// ================= NPC DIALOG =================
function openNpcDialog(npcId: string, _px: number, _py: number) {
  const s = g();
  const d = INTERIORS[s.interiorId ?? ''];
  const npc = d?.npcs.find((n) => n.id === npcId);
  if (!npc) return;
  sfx.click();
  const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
  const dlg = (choices: { label: string; run: string }[]) =>
    s.setInAct({ mode: 'dialog', furn: 'npc:' + npcId, title: npc.name, dialog: { npc: npcId, lines: [line], choices } });
  if (npc.look === 'cat') {
    s.setInAct({ mode: 'hold', furn: 'npc:' + npcId, payload: npcId, title: 'Vuốt ve ' + npc.name, sub: 'Giữ nút cho đầy vòng — mèo gừ gừ', holdSecs: 2 });
    return;
  }
  switch (npcId) {
    case 'barista': dlg([
      { label: '☕ Gọi món', run: 'open:counter' },
      { label: '🏅 Nhận thưởng vuốt đủ 3 mèo', run: 'catcombo' },
      { label: '🐈 Đi vuốt mèo', run: 'bye' },
    ]); break;
    case 'elder': dlg([
      { label: '❓ Hỏi chuyện làng', run: 'story:elder' },
      { label: '🙏 Xin lời chúc làng (mỗi ngày)', run: 'bless' },
      { label: '🗺️ Coi bảng + đóng dấu hành trình', run: 'open:board' },
      { label: '💰 Quỹ làng được bao nhiêu?', run: 'story:fund' },
      { label: '👋 Chào bác', run: 'bye' },
    ]); break;
    case 'clerk': dlg([
      { label: '✨ Hỏi mốt mới', run: 'story:clerk' },
      { label: '🎲 Đố vui thời trang (+30 xu)', run: 'quiz' },
      { label: '👗 Ra giá treo mua đồ', run: 'open:rack' },
      { label: '👋 Bye chị', run: 'bye' },
    ]); break;
    case 'coba': dlg([
      { label: '🎁 Tặng nông sản cho cô', run: 'gift' },
      { label: '🏅 Nhận quà mốc thân thiết', run: 'loveclaim' },
      { label: '🍳 Hỏi công thức bếp', run: 'story:recipe' },
      { label: '👋 Bye cô', run: 'bye' },
    ]); break;
    case 'chutam': dlg([
      { label: '♻️ Bán ve chai (ủng/rong x3 giá)', run: 'selljunk' },
      { label: '🔍 Giám định đồ cổ (50 xu)', run: 'appraise' },
      { label: '👻 Nghe chuyện xưa', run: 'story:tam' },
      { label: '👋 Bye chú', run: 'bye' },
    ]); break;
    case 'dealer': dlg([
      { label: '🃏 Ra bàn Tiến Lên chơi nhanh', run: 'open:tableTL' },
      { label: '🌟 Hỏi giờ vàng slot', run: 'slotime' },
      { label: '🧧 Nhận lộc casino (mỗi ngày)', run: 'chiploc' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'guest1': dlg([
      { label: '🍻 Cụng ly với chú (20 xu)', run: 'cungly' },
      { label: '❓ Hỏi bí kíp đỏ đen', run: 'story:teo' },
      { label: '👋 Bye chú', run: 'bye' },
    ]); break;
    case 'guest2': dlg([
      { label: '⏰ Hỏi giờ vàng slot', run: 'slotime' },
      { label: '💅 Hỏi vía đỏ', run: 'story:dao' },
      { label: '👋 Bye cô', run: 'bye' },
    ]); break;
    case 'quen': dlg([
      { label: '☕ Mời chị ly cà phê (10 xu)', run: 'treatquen' },
      { label: '💬 Nghe chuyện quán', run: 'story:quen' },
      { label: '👋 Bye chị', run: 'bye' },
    ]); break;
    case 'stylist': dlg([
      { label: '⭐ Chấm điểm thời trang', run: 'rate' },
      { label: '👗 Hỏi bí kíp phối đồ', run: 'story:stylist' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'mc': dlg([
      { label: '📋 Hỏi lịch diễn tối nay', run: 'story:mc' },
      { label: '🍵 Mời MC ly nước (15 xu)', run: 'treatmc' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'emgai': dlg([
      { label: '🍭 Mua kẹo que (10 xu)', run: 'candy' },
      { label: '🎁 Cho em 1 Bánh flan', run: 'giveflan' },
      { label: '📚 Nghe chuyện trường lớp', run: 'story:emgai' },
      { label: '👋 Bye em', run: 'bye' },
    ]); break;
    case 'nhoc': dlg([
      { label: '🧩 Đố mẹo với em', run: 'riddle' },
      { label: '🎤 Nghe rap ve chai', run: 'story:nhoc' },
      { label: '👋 Bye em', run: 'bye' },
    ]); break;
    case 'baove': dlg([
      { label: '📜 Hỏi nội quy sảnh', run: 'story:baove' },
      { label: '🛵 Gửi xe (10 xu)', run: 'parkbike' },
      { label: '💎 Xin vào sảnh VIP', run: 'vip' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'ty': dlg([
      { label: '🚗 Ra quầy catalog mua xe', run: 'open:catalog' },
      { label: '🏁 Hỏi bí kíp chọn xe', run: 'story:ty' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'thomay': dlg([
      { label: '🔧 Lên cầu nâng chăm xe', run: 'open:lift' },
      { label: '🛠️ Hỏi chuyện nghề', run: 'story:thomay' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'cove': dlg([
      { label: '🎫 Mua vé số (50 xu)', run: 'open:counter' },
      { label: '🍀 Hỏi vía trúng số', run: 'story:cove' },
      { label: '👋 Bye cô', run: 'bye' },
    ]); break;
    case 'chutrung': dlg([
      { label: '🏆 Nghe chuyện trúng độc đắc', run: 'story:cove' },
      { label: '👋 Bye chú', run: 'bye' },
    ]); break;
    case 'trongtai': dlg([
      { label: '🏁 Đăng ký giải đua', run: 'open:board' },
      { label: '📏 Hỏi luật đua', run: 'story:trongtai' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'taydua': dlg([
      { label: '🏎️ Nghe bí kíp bấm PHÓNG', run: 'story:trongtai' },
      { label: '👋 Bye anh', run: 'bye' },
    ]); break;
    case 'giagia': dlg([
      { label: '🐺 Lập đội ma sói', run: 'open:board' },
      { label: '🌙 Hỏi chuyện đêm sói', run: 'story:giagia' },
      { label: '👋 Bye cụ', run: 'bye' },
    ]); break;
    default: dlg([{ label: '👏 Xin chữ ký', run: 'story:fan' }, { label: '👋 Bye', run: 'bye' }]);
  }
}

export function runDialogChoice(run: string) {
  const s = g();
  if (run === 'bye') { s.setInAct(null); sfx.click(); return; }
  if (run.startsWith('open:')) { openInteriorFurn(run.slice(5), 0, 0); return; }
  if (run === 'gift') { openGift(); return; }
  if (run === 'loveclaim') { openLoveClaim(); return; }
  if (run === 'selljunk') { openSellJunk(); return; }
  if (run === 'story:elder') {
    if (!F('elder')) { s.setDailyFlag('elder'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Bác hội trưởng: "Làng mình cuối tuần thi hái dưa, nhớ đăng ký!" (+1 XP)');
    return;
  }
  if (run === 'story:fund') {
    sfx.click(); s.setInAct(null);
    s.toast(`Quỹ làng đang có ${s.fundTotal} điểm — góp ở hòm bên phải nhé!`);
    return;
  }
  if (run === 'story:clerk') {
    if (!F('clerk')) { s.setDailyFlag('clerk'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Chị thu ngân: "Năm nay mốt quần rách gối... vá lại!" (+1 XP)');
    return;
  }
  if (run === 'story:recipe') {
    sfx.click(); s.setInAct(null);
    s.toast('Cô Ba: "Trứng+Sữa ra flan, rau+cà ra salad, thịt+trứng ra thịt kho!"');
    return;
  }
  if (run === 'story:tam') {
    if (!F('story')) { s.setDailyFlag('story'); s.addXP(1); ok(); }
    sfx.click(); useVillage.getState().sendEmote('😱'); s.setInAct(null);
    s.toast(TAM_STORIES[Math.floor(Math.random() * TAM_STORIES.length)] + ' (+1 XP)');
    return;
  }
  if (run === 'story:fan') {
    s.addXP(1); sfx.harvest(); useVillage.getState().sendEmote('❤️'); s.setInAct(null);
    s.toast('Khán giả xin chữ ký lia lịa! Bạn ký mỏi tay (+1 XP)');
    ok(); return;
  }
  if (run === 'story:cove') {
    if (!F('cove')) { s.setDailyFlag('cove'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Cô Vé: "Vía trúng là mua vé đuôi ngày sinh người mình thương!" (+1 XP)');
    return;
  }
  if (run === 'story:trongtai') {
    if (!F('trongtai')) { s.setDailyFlag('trongtai'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Trọng tài: "Bấm PHÓNG đều tay 2 nhịp/giây là tốc độ vàng!" (+1 XP)');
    return;
  }
  if (run === 'story:giagia') {
    if (!F('giagia')) { s.setDailyFlag('giagia'); s.addXP(1); ok(); }
    sfx.click(); useVillage.getState().sendEmote('🌙'); s.setInAct(null);
    s.toast('Già làng: "Sói không bao giờ... nhận mình là sói!" (+1 XP)');
    return;
  }
  if (run === 'catcombo') {
    const need = [['mimi', 'Mimi'], ['mun', 'Mun'], ['tamt', 'Tam Thể']];
    const miss = need.filter(([id]) => !s.daily.cats.includes(id)).map(([, nm]) => nm);
    s.setInAct(null);
    if (F('catcombo')) { sfx.click(); s.toast('Hôm nay nhận thưởng mèo rồi — mai vuốt tiếp nhé!'); return; }
    if (miss.length) { sfx.click(); s.toast(`Còn thiếu bé ${miss.join(', ')}! Vuốt đủ 3 mèo rồi quay lại lĩnh thưởng.`); return; }
    s.setDailyFlag('catcombo'); s.addXu(50); s.addXP(4); sfx.lvup();
    petCat('mimi'); petCat('mun'); petCat('tamt');
    useVillage.getState().sendEmote('😻');
    s.toast('Bà chủ: "Mèo nhà cô mê con rồi! Thưởng 50 xu +4 XP!"'); ok(); return;
  }
  if (run === 'bless') {
    s.setInAct(null);
    if (F('bless')) { sfx.click(); s.toast('Bác hội trưởng: "Lộc hôm nay phát hết rồi, mai lại xin!"'); return; }
    s.setDailyFlag('bless');
    const r = Math.random();
    if (r < 0.4) { s.setSpeed(Date.now() + 60000); s.addXP(2); sfx.coin(); s.toast('Bác phẩy quạt: "Chân chạy như gió!" (chạy nhanh 60s +2 XP)'); }
    else if (r < 0.7) { s.addXP(5); sfx.lvup(); s.toast('Bác dặn: "Có công mài sắt..." — nghe xong tỉnh cả người! (+5 XP)'); }
    else { s.addFund(5); s.addXP(2); sfx.harvest(); s.toast('Bác bỏ 5 điểm vào quỹ làng lấy hên cho con! (+2 XP)'); }
    useVillage.getState().sendEmote('🙏');
    ok(); return;
  }
  if (run === 'quiz') {
    if (F('quiz')) { s.setInAct(null); sfx.click(); s.toast('Chị thu ngân: "Hôm nay thi rồi, mai đố câu khó hơn!"'); return; }
    openQuiz(); return;
  }
  if (run === 'appraise') { openAppraise(); return; }
  if (run === 'slotime') {
    s.setInAct(null); sfx.click();
    if (goldenActive()) s.toast('🌟 ĐANG GIỜ VÀNG! Jackpot slot x2 — chạy ra máy Xèng ngay!');
    else {
      const left = Math.ceil(goldenIn() / 1000);
      s.toast(`⏳ Còn ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} nữa tới giờ vàng x2 jackpot!`);
    }
    return;
  }
  if (run === 'chiploc') {
    s.setInAct(null);
    if (F('chiploc')) { sfx.click(); s.toast('Anh Cào: "Lộc hôm nay phát rồi, mai lại ghé!"'); return; }
    s.setDailyFlag('chiploc'); s.addXu(30); sfx.coin();
    s.toast('Anh Cào dúi cho 30 xu: "Lộc đầu buổi, đánh đâu thắng đó!"');
    return;
  }
  if (run === 'cungly') {
    if (s.xu < 20) { s.setInAct(null); sfx.error(); s.toast('Cụng ly tốn 20 xu tiền nước — ví lép rồi!'); return; }
    s.setInAct(null);
    s.addXu(-20); s.addXP(3); sfx.eat();
    useVillage.getState().sendEmote('🍻');
    if (Math.random() < 0.5) { s.addXu(20); s.toast('Cụng ly "dzôôô!" Chú Tèo khoái quá bao lại 20 xu! (+3 XP)'); }
    else s.toast('Cụng ly "dzôôô!" Chú Tèo kể chuyện cười sặc nước (+3 XP)');
    ok(); return;
  }
  if (run === 'story:teo') {
    if (!F('teo')) { s.setDailyFlag('teo'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Chú Tèo: "Cược nhỏ chơi lâu, Xì Dách dễ ăn, slot chờ giờ vàng!" (+1 XP)');
    return;
  }
  if (run === 'story:dao') {
    if (!F('dao')) { s.setDailyFlag('dao'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Cô Đào: "Vía đỏ của cô là quay slot đúng giờ vàng — trúng 3 sao rồi đó!" (+1 XP)');
    return;
  }
  if (run === 'treatquen') {
    s.setInAct(null);
    if (s.xu < 10) { sfx.error(); s.toast('Mời cà phê tốn 10 xu — ví lép rồi!'); return; }
    s.addXu(-10); s.addXP(2); sfx.eat();
    useVillage.getState().sendEmote('☕');
    if (!F('quencake')) {
      s.setDailyFlag('quencake'); s.addInv('flan', 1);
      s.toast('Chị Khách Quen: "Ngon! Chị tặng lại 1 Bánh flan nhà làm!" (+2 XP)');
    } else s.toast('Chị Khách Quen: "Cà phê ngon như mọi ngày! Mèo cũng gật gù!" (+2 XP)');
    ok(); return;
  }
  if (run === 'story:quen') {
    if (!F('quen')) { s.setDailyFlag('quen'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Chị kể: "Mèo Tam Thể chỉ leo cây cho người nó quý — dụ nó bằng giữ nút ở cây mèo!" (+1 XP)');
    return;
  }
  if (run === 'rate') {
    s.setInAct(null);
    if (F('rate')) { sfx.click(); s.toast('Anh Stylist: "Hôm nay chấm rồi, mai đổi đồ mới lại chấm!"'); return; }
    s.setDailyFlag('rate');
    const n = s.ownedOutfits.length;
    if (n >= 16) { s.addXu(30); s.addXP(3); sfx.lvup(); s.toast(`Anh Stylist: "${n} món — FASHIONISTA của làng! Thưởng 30 xu +3 XP!"`); }
    else if (n >= 8) { s.addXu(10); s.addXP(2); sfx.coin(); s.toast(`Anh Stylist: "${n} món — có gu đó! Thưởng 10 xu +2 XP!"`); }
    else { s.addXP(1); sfx.click(); s.toast(`Anh Stylist: "${n} món — mặc tạm được, ráng sưu tầm thêm nhé! (+1 XP)"`); }
    useVillage.getState().sendEmote('⭐');
    ok(); return;
  }
  if (run === 'story:stylist') {
    if (!F('stylist')) { s.setDailyFlag('stylist'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Anh Stylist: "Bí kíp: 1 điểm nhấn thôi, cả cây nổi là cả cây... chìm!" (+1 XP)');
    return;
  }
  if (run === 'story:mc') {
    if (!F('mc')) { s.setDailyFlag('mc'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    const rq = stageRequestAt(Date.now());
    s.toast(`MC: "Tối nay khán giả thích đèn ${rq.name}! Diễn xong diễn tiếp liền là ENCORE x1.5!" (+1 XP)`);
    return;
  }
  if (run === 'treatmc') {
    s.setInAct(null);
    if (s.xu < 15) { sfx.error(); s.toast('Mời nước tốn 15 xu — ví lép rồi!'); return; }
    s.addXu(-15); s.addXP(5); sfx.eat();
    cheerFans(); useVillage.getState().sendEmote('🎤');
    s.toast('MC giới thiệu bạn hoành tráng, khán giả vỗ tay rần rần! (+5 XP)');
    ok(); return;
  }
  if (run === 'candy') {
    s.setInAct(null);
    if (s.xu < 10) { sfx.error(); s.toast('Kẹo que 10 xu — ví lép rồi!'); return; }
    s.addXu(-10); s.addXP(3); sfx.eat();
    useVillage.getState().sendEmote('🍭');
    s.toast('Kẹo que ngọt lịm! Bé Út cười tít mắt (+3 XP)');
    ok(); return;
  }
  if (run === 'giveflan') {
    s.setInAct(null);
    if ((s.inv.flan || 0) <= 0) { sfx.error(); s.toast('Không có Bánh flan! Cô Ba hay dúi cho ở tủ bánh đó!'); return; }
    s.addInv('flan', -1); s.addXP(2); s.addLove(1); sfx.eat();
    useVillage.getState().sendEmote('🎁');
    s.toast('Bé Út: "Em sẽ mách má Ba là anh/chị ngoan nhất làng!" (+2 XP, +1 thân thiết)');
    ok(); return;
  }
  if (run === 'story:emgai') {
    if (!F('emgai')) { s.setDailyFlag('emgai'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Bé Út: "Hôm nay em được điểm 10! Cô giáo khen chữ đẹp!" (+1 XP)');
    return;
  }
  if (run === 'riddle') {
    if (F('riddle')) { s.setInAct(null); sfx.click(); s.toast('Nhóc: "Hôm nay đố rồi, mai đố câu khó hơn!"'); return; }
    openRiddle(); return;
  }
  if (run === 'story:nhoc') {
    s.addXP(1); sfx.harvest(); useVillage.getState().sendEmote('🎤'); s.setInAct(null);
    s.toast('Nhóc rap: "Ve chai ve chai, bán là có tiền xài!" (+1 XP)');
    ok(); return;
  }
  if (run === 'story:baove') {
    if (!F('baove')) { s.setDailyFlag('baove'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Anh Bảo Vệ: "Cấm leo lên bàn, cấm khóc khi thua, thắng phải cười tươi!" (+1 XP)');
    return;
  }
  if (run === 'story:ty') {
    if (!F('ty')) { s.setDailyFlag('ty'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Anh Tý: "Mua xe theo túi tiền: xe đạp 10k đi làm, mô tô đi chơi, ô tô đi... khoe!" (+1 XP)');
    return;
  }
  if (run === 'story:thomay') {
    if (!F('thomay')) { s.setDailyFlag('thomay'); s.addXP(1); ok(); }
    sfx.click(); s.setInAct(null);
    s.toast('Thợ Tèo: "Xe cũng như người — rửa thì đẹp, bảo dưỡng thì khỏe!" (+1 XP)');
    return;
  }
  if (run === 'parkbike') {
    s.setInAct(null);
    if (s.xu < 10) { sfx.error(); s.toast('Gửi xe 10 xu — ví lép rồi!'); return; }
    s.addXu(-10); s.addXP(2); sfx.coin();
    s.toast('Anh Bảo Vệ xé vé giữ xe: "Xe để đây, mất... gọi công an giùm anh!" (+2 XP)');
    ok(); return;
  }
  if (run === 'vip') {
    s.setInAct(null);
    if (s.level >= 5) {
      s.addXP(3); sfx.lvup();
      useVillage.getState().sendEmote('😎');
      s.toast('Anh Bảo Vệ mở cửa sảnh VIP: "Mời đại gia! Vào ngồi ghế da!" (+3 XP)');
      ok();
    } else { sfx.error(); s.toast(`Sảnh VIP cần Lv5! Bạn đang Lv${s.level} — ráng cày thêm!`); }
    return;
  }
}

// ================= LIST BUILDERS =================
function openBoard() {
  const s = g(); s.touchDaily();
  const items: InActItem[] = DAILIES.map((q) => {
    const st = s.daily.quests.find((x) => x.id === q.id);
    if (!st) return { id: 'accept:' + q.id, label: `Nhận: ${q.name}`, desc: `Thưởng ${q.xu} xu + ${q.xp} XP` };
    const prog = Math.min(q.need, s.stats[q.stat] - st.from);
    if (st.claimed) return { id: 'x', label: `${q.name} — xong!`, desc: 'Mai nhận việc mới', disabled: true };
    if (prog >= q.need) return { id: 'claim:' + q.id, label: `Nộp: ${q.name} ✅`, desc: `Nhận ${q.xu} xu + ${q.xp} XP`, tag: 'XONG' };
    return { id: 'x', label: `${q.name} (${prog}/${q.need})`, desc: 'Đang làm…', disabled: true };
  });
  // dấu hành trình: ghé đủ nhà trong ngày (town 5 + mall 6)
  const houses = Object.keys(INTERIORS);
  const got = houses.filter((h) => F('visit:' + h));
  if (F('stampdone')) items.push({ id: 'x', label: `🗺️ Hành trình (${got.length}/${houses.length}) — xong!`, desc: 'Mai đi tiếp vòng mới', disabled: true });
  else if (got.length >= houses.length) items.push({ id: 'stamp', label: `🗺️ Hành trình đủ ${houses.length}/${houses.length} dấu!`, desc: `Nhận ${STAMP_REWARD_XU} xu + 1 gem`, tag: 'NHẬN' });
  else {
    const miss = houses.filter((h) => !F('visit:' + h)).map((h) => `${INTERIORS[h].emoji} ${INTERIORS[h].name}`).join(', ');
    items.push({ id: 'x', label: `🗺️ Hành trình (${got.length}/${houses.length})`, desc: 'Còn thiếu: ' + miss, disabled: true });
  }
  s.setInAct({ mode: 'list', furn: 'board', title: 'Bảng nhiệm vụ ngày', sub: `Mỗi ngày 3 việc + dấu hành trình ${houses.length} nhà`, list: { action: 'board', items } });
}

function openDonate() {
  const s = g();
  const items: InActItem[] = cropItems(5).map(({ pid, n }) => {
    const [nm] = itemName(pid);
    const pts = Math.round(sellPrice(pid) * 5 * 1.2);
    return { id: 'donate:' + pid, label: `Góp 5 ${nm} (có ${n})`, desc: `+${pts} điểm quỹ làng` };
  });
  FUND_MILESTONES.forEach((m, i) => {
    const claimed = s.fundClaim.includes(i);
    const reached = s.fundTotal >= m.points;
    items.push({
      id: 'fund:' + i, label: `Mốc ${m.label} (${s.fundTotal}/${m.points})`,
      desc: claimed ? 'Đã nhận' : reached ? `Nhận: ${m.reward}` : `Quà: ${m.reward}`,
      disabled: claimed || !reached, tag: claimed ? 'ĐÃ NHẬN' : reached ? 'NHẬN' : undefined,
    });
  });
  if (!items.length) items.push({ id: 'x', label: 'Kho trống trơn!', desc: 'Trồng trọt rồi quay lại góp', disabled: true });
  s.setInAct({ mode: 'list', furn: 'donate', title: 'Hòm quyên góp làng', sub: `Quỹ làng: ${s.fundTotal} điểm`, list: { action: 'donate', items } });
}

function openCook() {
  const s = g();
  const items: InActItem[] = RECIPES.map((r) => {
    const [nm] = itemName(r.id);
    const needTxt = Object.entries(r.needs).map(([pid, n]) => `${n} ${itemName(pid)[0]}`).join(' + ');
    const lack = Object.entries(r.needs).some(([pid, n]) => (s.inv[pid] || 0) < n);
    return {
      id: 'cook:' + r.id, label: `${nm} — cần ${needTxt}`,
      desc: `${r.tip} • Bán ${sellPrice(r.id)} xu • +${r.xp} XP`, disabled: lack,
      tag: lack ? 'THIẾU' : undefined,
    };
  });
  s.setInAct({ mode: 'list', furn: 'stove', title: 'Bếp củi cô Ba', sub: 'Chọn món — tốn nguyên liệu thật, ăn/bán thật', list: { action: 'cook', items } });
}

function openBench() {
  const s = g();
  const items: InActItem[] = BENCH.map((r) => {
    const [nm] = itemName(r.id);
    const needTxt = Object.entries(r.needs).map(([pid, n]) => `${n} ${itemName(pid)[0]}`).join(' + ');
    const lack = Object.entries(r.needs).some(([pid, n]) => (s.inv[pid] || 0) < n) || s.xu < BENCH_FEE;
    return {
      id: 'bench:' + r.id, label: `${nm} — ${needTxt} + ${BENCH_FEE} xu công`,
      desc: r.tip + ` • +${r.xp} XP`, disabled: lack, tag: lack ? 'THIẾU' : undefined,
    };
  });
  s.setInAct({ mode: 'list', furn: 'bench', title: 'Bàn chế đồ chú Tám', sub: 'Nâng mồi/cám thường lên xịn', list: { action: 'bench', items } });
}

function openGift() {
  const s = g();
  const items: InActItem[] = cropItems(1).map(({ pid, n }) => {
    const [nm] = itemName(pid);
    return { id: 'gift:' + pid, label: `Tặng 1 ${nm} (có ${n})`, desc: '+2 tình cảm cô Ba' };
  });
  if (!items.length) items.push({ id: 'x', label: 'Kho trống!', desc: 'Có nông sản hãy tặng cô', disabled: true });
  s.setInAct({ mode: 'list', furn: 'npc:coba', title: 'Tặng quà cô Ba', sub: `Thân thiết: ${s.baLove} điểm`, list: { action: 'gift', items } });
}

function openLoveClaim() {
  const s = g();
  const items: InActItem[] = LOVE_MILESTONES.map((m, i) => {
    const claimed = s.loveClaim.includes(i);
    const reached = s.baLove >= m.love;
    return {
      id: 'love:' + i, label: `${m.label} (${s.baLove}/${m.love})`,
      desc: claimed ? 'Đã nhận' : reached ? `Nhận: ${m.reward}` : `Quà: ${m.reward}`,
      disabled: claimed || !reached, tag: claimed ? 'ĐÃ NHẬN' : reached ? 'NHẬN' : undefined,
    };
  });
  s.setInAct({ mode: 'list', furn: 'npc:coba', title: 'Quà mốc thân thiết', sub: `Cô Ba quý bạn ${s.baLove} điểm`, list: { action: 'love', items } });
}

function openSellJunk() {
  const s = g();
  const items: InActItem[] = [];
  const ung = s.inv.ung || 0, rong = s.inv.rong || 0;
  items.push({ id: 'sell:ung', label: `Bán hết ${ung} Ủng cũ (9 xu/cái)`, desc: 'Chú Tám mua x3 giá ve chai', disabled: ung <= 0 });
  items.push({ id: 'sell:rong', label: `Bán hết ${rong} Rong biển (6 xu/cái)`, desc: 'Chú Tám mua x3 giá ve chai', disabled: rong <= 0 });
  s.setInAct({ mode: 'list', furn: 'npc:chutam', title: 'Chú Tám thu mua', sub: 'Ve chai giá cao, bán là có tiền', list: { action: 'selljunk', items } });
}

// ---- đố vui thời trang (shop) ----
function openQuiz() {
  const s = g();
  const q = SHOP_QUIZZES[s.day % SHOP_QUIZZES.length];
  const items: InActItem[] = q.opts.map((o, i) => ({ id: 'q:' + i, label: o, desc: 'Chọn đáp án đúng ăn 30 xu!' }));
  s.setInAct({ mode: 'list', furn: 'npc:clerk', title: 'Đố vui thời trang', sub: q.q, list: { action: 'quiz', items } });
}

// ---- giám định đồ cổ (chú Tám): 50 xu/lượt, 3 lượt/ngày ----
function openAppraise() {
  const s = g();
  const used = ['app0', 'app1', 'app2'].filter((k) => F(k)).length;
  const items: InActItem[] = [{
    id: 'go', label: `🔍 Đưa 50 xu giám định (còn ${3 - used} lượt)`,
    desc: 'Hên: xu to / mồi cám xịn / GEM — xui: món... cũng có giá trị tinh thần',
    disabled: used >= 3 || s.xu < 50,
  }];
  if (used >= 3) items.push({ id: 'x', label: 'Hết lượt hôm nay!', desc: 'Mai chú Tám xem tiếp', disabled: true });
  s.setInAct({ mode: 'list', furn: 'npc:chutam', title: 'Giám định đồ cổ', sub: 'Mắt thần của chú Tám chưa sai bao giờ... trừ mấy lần sai', list: { action: 'appraise', items } });
}

// ---- bảng đặt hàng (nhà cô Ba): giao nông sản lấy thưởng 150% ----
function openOrder() {
  const s = g(); s.touchDaily();
  const o = houseOrderOf(s.day);
  const [nm] = itemName(o.pid);
  const have = s.inv[o.pid] || 0;
  const done = F('orderdone');
  const reward = Math.round(sellPrice(o.pid) * o.n * 1.5);
  const items: InActItem[] = done
    ? [{ id: 'x', label: 'Hôm nay giao xong rồi!', desc: 'Mai có đơn mới', disabled: true }]
    : [{ id: 'fill', label: `Giao ${o.n} ${nm} (đang có ${have})`, desc: `Thưởng ${reward} xu + 8 XP`, disabled: have < o.n }];
  s.setInAct({ mode: 'list', furn: 'orderboard', title: 'Bảng đặt hàng', sub: 'Khách quen đặt mỗi ngày — giao đủ lĩnh thưởng to', list: { action: 'fill', items } });
}

// ---- quầy chip casino: lộc mỗi ngày ----
function openVault() {
  const s = g();
  const claimed = F('chiploc');
  const items: InActItem[] = [{
    id: 'loc', label: '🧧 Nhận lộc casino 30 xu',
    desc: claimed ? 'Hôm nay nhận rồi' : 'Lộc đầu buổi: đánh đâu thắng đó!',
    disabled: claimed,
  }];
  items.push({ id: 'x', label: 'Vào bàn là chơi bằng xu luôn!', desc: 'Khỏi đổi chip lằng nhằng', disabled: true });
  s.setInAct({ mode: 'list', furn: 'vault', title: 'Quầy chip', sub: 'Anh Cào phát lộc mỗi ngày', list: { action: 'vault', items } });
}

// ---- bàn bài: chơi nhanh với máy hoặc mở sảnh chung ----
function openCasinoTable(furn: string) {
  const s = g();
  const meta = TABLE_META[furn] ?? { name: 'Bài', emoji: '🃏' };
  const game = TABLE_GAME[furn] ?? 'tienlen';
  const items: InActItem[] = TABLE_BETS.map((b) => ({
    id: `play:${game}:${b}`, label: `⚡ Chơi nhanh với máy — ${b} xu/ván`,
    desc: `${meta.name}: thắng ăn tất, thua mất cược`, disabled: s.xu < b,
  }));
  items.push({ id: 'lobby', label: 'Mở sảnh chung (rủ bạn)', desc: 'Tự tạo phòng, chờ người vào chơi cùng' });
  s.setInAct({ mode: 'list', furn, title: `${meta.emoji} Bàn ${meta.name}`, sub: 'Chơi nhanh trừ cược, vào thẳng ván với máy', list: { action: 'casplay', items } });
}

function openChessTable() {
  const s = g();
  const items: InActItem[] = [
    { id: 'play:chess:50', label: '♟ Cờ vua với máy — 50 xu/ván', desc: 'Đấu trí căng não, thắng ăn tất', disabled: s.xu < 50 },
    { id: 'play:caro:50', label: '⭕ Caro với máy — 50 xu/ván', desc: '5 ô thẳng là lụm', disabled: s.xu < 50 },
    { id: 'lobby', label: 'Mở sảnh chung (rủ bạn)', desc: 'Tự tạo phòng, chờ người vào chơi cùng' },
  ];
  s.setInAct({ mode: 'list', furn: 'tableChess', title: '♟ Bàn Caro & Cờ vua', sub: 'Chơi nhanh trừ cược, vào thẳng ván với máy', list: { action: 'casplay', items } });
}

function quickCasino(game: string, bet: number) {
  const s = g();
  const c = useCasino.getState();
  if (c.room) { s.setInAct(null); s.setModal('casino'); s.toast('Đang có phòng — mở tiếp ván nhé!'); return; }
  c.ensure();
  c.createRoom(game as CasinoGame, bet, true);
  if (!useCasino.getState().room) return; // thiếu xu (đã toast)
  useCasino.getState().startRoom();
  s.setInAct(null);
  s.setModal('casino');
  s.toast('Vào ván! Chúc đỏ!');
}

// ---- máy slot ----
function openSlot() {
  const s = g();
  const golden = goldenActive();
  const items: InActItem[] = [{
    id: 'spin', label: `🎰 Quay Xèng — ${SLOT_COST} xu`,
    desc: golden ? 'ĐANG GIỜ VÀNG x2 jackpot!' : 'Trúng 3 biểu tượng giống nhau ăn jackpot',
    disabled: s.xu < SLOT_COST,
  }];
  const pay = Object.entries(SLOT_PAY).map(([k, v]) => `3${k}=${golden ? v * 2 : v}`).join(' • ');
  s.setInAct({ mode: 'list', furn: 'slot', title: 'Máy slot Xèng', sub: `${pay} • 1 đôi = ${SLOT_PAIR} xu`, list: { action: 'slot', items } });
}

// ---- quầy bar casino ----
function openBar() {
  const s = g();
  const items: InActItem[] = BAR_MENU.map((d) => ({
    id: 'drink:' + d.id, label: `${d.name}`, desc: d.tip + ` • +${d.xp} XP`, disabled: s.xu < d.price,
  }));
  s.setInAct({ mode: 'list', furn: 'bar', title: 'Quầy bar', sub: 'Giải khát lấy hên trước khi vào bàn', list: { action: 'bar', items } });
}

// ---- hũ tip quán mèo: 5 xu/lần, đủ 5 lần mèo tặng lại ----
function openTipjar() {
  const s = g();
  const used = ['tip0', 'tip1', 'tip2', 'tip3', 'tip4'].filter((k) => F(k)).length;
  const items: InActItem[] = [{
    id: 'tip5', label: `🪙 Bỏ 5 xu tip (${used}/5 hôm nay)`,
    desc: used >= 5 ? 'Hôm nay tip đủ rồi!' : 'Mèo nhớ mặt người hào phóng — đủ 5 lần có quà!',
    disabled: used >= 5 || s.xu < 5,
  }];
  s.setInAct({ mode: 'list', furn: 'tipjar', title: 'Hũ tiền tip', sub: 'Ủng hộ 3 bé mèo', list: { action: 'tip', items } });
}

// ---- thùng sale shop: 20 xu/lần lục đồ ----
function openSale() {
  const s = g();
  const items: InActItem[] = [{
    id: 'dig', label: '🔍 Lục thùng sale — 20 xu',
    desc: 'Hên: mồi/cám xịn, tiền rơi — xui: vải vụn (tay thơm hẵng lục!)',
    disabled: s.xu < 20,
  }];
  s.setInAct({ mode: 'list', furn: 'salebin', title: 'Thùng sale đồng giá', sub: 'Lục là có chuyện vui', list: { action: 'sale', items } });
}

// ---- tủ hóa trang: thuê đồ diễn buff sân khấu 5 phút ----
function openCostume() {
  const s = g();
  const items: InActItem[] = [{
    id: 'rent', label: '🎭 Thuê đồ diễn — 30 xu',
    desc: 'Diễn sân khấu +20% tip trong 5 phút • +6 XP',
    disabled: s.xu < 30,
  }];
  s.setInAct({ mode: 'list', furn: 'costume', title: 'Tủ hóa trang', sub: 'Mặc đẹp diễn hay, khán giả bo nhiều!', list: { action: 'costume', items } });
}

// ---- bục trưng bày gara: xem xe + lái thử ngay trong phòng ----
const GARAGE_DISPLAY: Record<string, string> = { display1: 'bike_dia', display2: 'moto_the', display3: 'car_sieuxe' };
function openDisplay(furn: string) {
  const s = g();
  const car = CARS[GARAGE_DISPLAY[furn]];
  if (!car) return;
  const owned = s.ownedCars.includes(car.id);
  const driving = s.activeCar === car.id;
  const locked = s.level < (car.minLevel ?? 1);
  const price = car.priceGem ? `${car.priceGem} gem` : `${car.priceXu} xu`;
  const items: InActItem[] = driving
    ? [{ id: 'park', label: '🅿️ Xuống xe, để xe lại bục', desc: 'Đi bộ ngắm tiếp gara', disabled: false }]
    : owned
      ? [{ id: `drive:${car.id}`, label: `🏁 Lái thử ${car.name} trong gara!`, desc: `Chạy vài vòng trong phòng cho đã — tốc độ ${car.speed}`, disabled: false }]
      : [
          { id: 'shop', label: locked ? `🔒 ${car.name} — mở bán từ Lv${car.minLevel}` : `🛒 Mua ${car.name} — ${price}`, desc: `⚡ ${car.speed} (nhanh gấp ${(car.speed / 260).toFixed(1)} lần đi bộ) • ${car.desc}`, disabled: locked },
          { id: 'trydrive', label: '🏁 Chưa mua? Ngồi lên thử dáng xe', desc: 'Ngồi thử miễn phí cho biết cảm giác lái (+1 XP)', disabled: locked },
        ];
  s.setInAct({
    mode: 'list', furn, title: `${car.emoji} ${car.name}`,
    sub: owned ? (driving ? 'Đang lái vi vu trong gara!' : 'Xe của bạn — leo lên lái thử luôn!') : `Trưng bày showroom • ${car.desc}`,
    list: { action: 'garage', items },
  });
}

// ---- cầu nâng gara: rửa xe + bảo dưỡng ----
const WASH_COST = 200, SERVICE_COST = 500;
function openLift() {
  const s = g();
  const items: InActItem[] = [
    {
      id: 'wash', label: `🧽 Rửa xe bóng loáng — ${WASH_COST} xu`,
      desc: 'Xe sạch bong lấp lánh +8 XP (cả làng nhìn thấy xe bạn đẹp!)', disabled: s.xu < WASH_COST,
    },
    {
      id: 'service', label: `🔧 Bảo dưỡng máy — ${SERVICE_COST} xu`,
      desc: 'Máy êm như ru +15 XP, thợ Tèo ký tên lên nắp ca-pô', disabled: s.xu < SERVICE_COST,
    },
  ];
  s.setInAct({ mode: 'list', furn: 'lift', title: 'Cầu nâng gara', sub: 'Chăm xe như chăm người yêu', list: { action: 'garage', items } });
}

// ---- vòng quay may mắn casino ----
// Vé cào ăn liền nhà vé số: 20 xu/vé, cào là biết liền
export const SCRATCH_COST = 20;
const SCRATCH_PRIZES: { w: number; xu: number; gem: number; label: string }[] = [
  { w: 55, xu: 10, gem: 0, label: 'An ủi +10 xu' },
  { w: 22, xu: 25, gem: 0, label: 'Trúng +25 xu!' },
  { w: 12, xu: 50, gem: 0, label: 'Trúng lớn +50 xu!' },
  { w: 7, xu: 100, gem: 0, label: 'Trúng to +100 xu!!' },
  { w: 3, xu: 200, gem: 0, label: 'CỰC PHẨM +200 xu!!!' },
  { w: 1, xu: 0, gem: 1, label: 'ĐỘC ĐẮC +1 GEM!!!' },
];
function openScratch(px: number, py: number) {
  const s = g();
  if (s.xu < SCRATCH_COST) { sfx.error(); s.toast('Hết xu mua vé cào rồi! (20 xu/vé)'); return; }
  s.addXu(-SCRATCH_COST);
  const total = SCRATCH_PRIZES.reduce((a, p) => a + p.w, 0);
  let roll = Math.random() * total;
  let prize = SCRATCH_PRIZES[0];
  for (const p of SCRATCH_PRIZES) { roll -= p.w; if (roll <= 0) { prize = p; break; } }
  if (prize.xu > 0) s.addXu(prize.xu);
  if (prize.gem > 0) s.addGem(prize.gem);
  s.addXP(2);
  sfx.lvup(); spawnBurst(px, py - 40, 'coin'); spawnBurst(px, py - 60, 'spark');
  useVillage.getState().sendEmote('🎫');
  s.toast(`Cào vé 20 xu: ${prize.label}`);
  ok();
}
// Bảng kết quả vé số: kỳ gần nhất + kỳ đang bán
function openXosoBoard() {
  const s = g();
  try {
    const l = useLottery.getState();
    const last = l.history[0];
    sfx.click(); s.setInAct(null);
    s.toast(last
      ? `Kỳ ${fmtDraw(last.drawId)} ra ${last.winning} — ${last.prize > 0 ? `bạn +${last.prize} xu!` : 'chúc may mắn kỳ sau!'} Kỳ ${fmtDraw(l.drawId)} đang bán!`
      : `Kỳ ${fmtDraw(l.drawId)} đang bán vé — 50 xu/vé, ĐB 3000 xu +1 gem!`);
  } catch {
    sfx.click(); s.toast('Vé 50 xu, cào 20 xu — sổ mỗi 5 phút, ĐB 3000 xu +1 gem!');
  }
}

function openWheel() {
  const s = g();
  const freeUsed = F('wheelfree');
  const items: InActItem[] = [
    {
      id: 'free', label: '🎡 Quay FREE mỗi ngày',
      desc: freeUsed ? 'Hôm nay quay free rồi!' : 'Miễn phí 1 lượt — quay là trúng!',
      disabled: freeUsed,
    },
    { id: 'paid', label: `🎡 Quay thêm — ${WHEEL_COST} xu`, desc: 'Trúng tới JACKPOT 300 xu + GEM!', disabled: s.xu < WHEEL_COST },
  ];
  s.setInAct({ mode: 'list', furn: 'wheel', title: 'Vòng quay may mắn', sub: 'Quay là trúng, trúng to hay nhỏ là do vía!', list: { action: 'wheel', items } });
}

function spinWheel(paid: boolean, px: number, py: number) {
  const s = g();
  if (paid) {
    if (s.xu < WHEEL_COST) { sfx.error(); return; }
    s.addXu(-WHEEL_COST);
  } else {
    if (F('wheelfree')) { sfx.error(); return; }
    s.setDailyFlag('wheelfree');
  }
  const total = WHEEL_PRIZES.reduce((a, p) => a + p.w, 0);
  let roll = Math.random() * total;
  let prize = WHEEL_PRIZES[0].label;
  for (const p of WHEEL_PRIZES) { roll -= p.w; if (roll <= 0) { prize = p.label; break; } }
  sfx.lvup(); spawnBurst(px, py - 40, 'coin'); spawnBurst(px, py - 60, 'spark');
  useVillage.getState().sendEmote('🎡');
  if (prize === '+15 xu') s.addXu(15);
  else if (prize === '+40 xu') s.addXu(40);
  else if (prize === '+100 xu') s.addXu(100);
  else if (prize === 'JACKPOT +300 xu') s.addXu(300);
  else if (prize === '+2 mồi xịn') s.addInv('baitPro', 2);
  else if (prize === '+2 cám xịn') s.addInv('feedPro', 2);
  else if (prize === '+4 XP') s.addXP(4);
  else if (prize === '+1 GEM') s.addGem(1);
  s.addXP(1);
  s.toast(prize.includes('JACKPOT') ? `🎡 ${prize}! Cả sảnh đứng dậy vỗ tay! (+1 XP)` : `🎡 Vòng quay dừng ở: ${prize}! (+1 XP)`);
  openWheel(); ok();
}

// ---- đố mẹo Nhóc Ve Chai ----
function openRiddle() {
  const s = g();
  const r = NHOC_RIDDLES[s.day % NHOC_RIDDLES.length];
  const items: InActItem[] = r.opts.map((o, i) => ({ id: 'r:' + i, label: o, desc: 'Đúng ăn 15 xu +2 XP!' }));
  s.setInAct({ mode: 'list', furn: 'npc:nhoc', title: 'Đố mẹo', sub: r.q, list: { action: 'riddle', items } });
}

// ================= CHẠY ITEM TRONG LIST =================
export function runListItem(action: string, id: string, px: number, py: number) {
  const s = g();
  if (id === 'x') return;
  const reopen = () => openInteriorFurn(s.inAct?.furn ?? '', px, py);
  // --- order cafe (món hôm nay x2 XP) ---
  if (action === 'order' && (id === 'coffee' || id === 'milk')) {
    const price = id === 'coffee' ? 10 : 25;
    const baseXp = id === 'coffee' ? 4 : 6;
    const isSp = cafeSpecial(s.day).id === id;
    const xp = isSp ? baseXp * 2 : baseXp;
    if (s.xu < price) { sfx.error(); return; }
    s.addXu(-price);
    if (id === 'coffee') s.setSpeed(Date.now() + 60000);
    s.addXP(xp); sfx.coin();
    spawnBurst(px, py - 40, isSp ? 'heart' : 'spark'); useVillage.getState().sendEmote('☕');
    s.toast(isSp ? `⭐ Trúng món hôm nay! ${id === 'coffee' ? 'Chạy nhanh 60s' : 'Ngọt lịm'} +${xp} XP!` : (id === 'coffee' ? `Cà phê trứng béo ngậy! Chạy nhanh 60s +${xp} XP` : `Sữa nóng ngọt lịm! Mèo nhìn thèm chảy dãi +${xp} XP`));
    s.setInAct(null); ok(); return;
  }
  // --- quiz thời trang ---
  if (action === 'quiz' && id.startsWith('q:')) {
    const q = SHOP_QUIZZES[s.day % SHOP_QUIZZES.length];
    if (Number(id.slice(2)) === q.answer) {
      s.setDailyFlag('quiz'); s.addXu(30); s.addXP(3); sfx.lvup();
      spawnBurst(px, py - 40, 'spark');
      s.toast('Chị thu ngân: "Chuẩn gu! Thưởng 30 xu +3 XP!"');
      s.setInAct(null); ok();
    } else {
      sfx.error();
      s.toast('Chị thu ngân: "Sai rồi cưng! Đoán lại đi!"');
    }
    return;
  }
  // --- giám định đồ cổ ---
  if (action === 'appraise' && id === 'go') {
    const used = ['app0', 'app1', 'app2'].filter((k) => F(k)).length;
    if (used >= 3 || s.xu < 50) { sfx.error(); return; }
    s.setDailyFlag('app' + used);
    s.addXu(-50);
    const r = Math.random();
    sfx.harvest(); spawnBurst(px, py - 40, 'spark');
    if (r < 0.55) {
      const win = 40 + Math.floor(Math.random() * 51);
      s.addXu(win); s.toast(`Chú Tám đeo kính lúp: "Món này đáng giá ${win} xu đó!"`);
    } else if (r < 0.8) {
      const pro = Math.random() < 0.5 ? 'baitPro' : 'feedPro';
      s.addInv(pro, 2); s.toast(`Chú Tám: "Trong ruột tượng có hộp ${itemName(pro)[0]} còn nguyên! Cho con 2 cái!"`);
    } else {
      s.addGem(1); sfx.lvup(); s.toast('TRÚNG MÁNH! Mặt dây chuyền cũ = 1 GEM! 💎');
    }
    s.addXP(2); reopen(); ok(); return;
  }
  // --- giao đơn cô Ba ---
  if (action === 'fill' && id === 'fill') {
    const o = houseOrderOf(s.day);
    if (F('orderdone') || (s.inv[o.pid] || 0) < o.n) { sfx.error(); return; }
    const [nm] = itemName(o.pid);
    const reward = Math.round(sellPrice(o.pid) * o.n * 1.5);
    s.addInv(o.pid, -o.n); s.addXu(reward); s.addXP(8);
    s.setDailyFlag('orderdone'); sfx.coin();
    spawnBurst(px, py - 40, 'coin'); useVillage.getState().sendEmote('📦');
    s.toast(`Khách quen: "${nm} tươi quá! Gửi ${reward} xu +8 XP!"`); reopen(); ok(); return;
  }
  // --- quầy chip: nhận lộc ---
  if (action === 'vault' && id === 'loc') {
    if (F('chiploc')) { sfx.error(); return; }
    s.setDailyFlag('chiploc'); s.addXu(30); sfx.coin();
    spawnBurst(px, py - 40, 'coin');
    s.toast('Lộc casino 30 xu! Đánh đâu thắng đó!'); reopen(); return;
  }
  // --- bàn casino: chơi nhanh / sảnh chung ---
  if (action === 'casplay') {
    if (id === 'lobby') { s.setInAct(null); s.setModal('casino'); return; }
    if (id.startsWith('play:')) {
      const [, game, bet] = id.split(':');
      quickCasino(game, Number(bet));
      return;
    }
  }
  // --- máy slot ---
  if (action === 'slot' && id === 'spin') {
    if (s.xu < SLOT_COST) { sfx.error(); return; }
    s.addXu(-SLOT_COST);
    const golden = goldenActive();
    const roll = [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
    s.addXP(1);
    const show = roll.join(' ');
    if (roll[0] === roll[1] && roll[1] === roll[2]) {
      const win = SLOT_PAY[roll[0]] * (golden ? 2 : 1);
      s.addXu(win); sfx.lvup();
      spawnBurst(px, py - 40, 'coin'); spawnBurst(px, py - 60, 'spark');
      useVillage.getState().sendEmote('🎰');
      s.toast(`🎰 ${show} — JACKPOT ${win} xu${golden ? ' (giờ vàng x2!)' : ''}! Cả sảnh hú hét!`);
    } else if (roll[0] === roll[1] || roll[1] === roll[2] || roll[0] === roll[2]) {
      s.addXu(SLOT_PAIR); sfx.coin();
      spawnBurst(px, py - 40, 'spark');
      s.toast(`🎰 ${show} — có đôi! An ủi ${SLOT_PAIR} xu.`);
    } else {
      sfx.click();
      s.toast(`🎰 ${show} — trượt! ${golden ? 'Giờ vàng mà còn trượt...' : 'Quay nữa gỡ!'}`);
    }
    reopen(); ok(); return;
  }
  // --- quầy bar ---
  if (action === 'bar' && id.startsWith('drink:')) {
    const d = BAR_MENU.find((x) => x.id === id.slice(6));
    if (!d || s.xu < d.price) { sfx.error(); return; }
    s.addXu(-d.price); s.addXP(d.xp); sfx.eat();
    spawnBurst(px, py - 40, 'heart');
    useVillage.getState().sendEmote(d.id === 'wine' ? '🍷' : d.id === 'orange' ? '🍊' : '💧');
    if (d.id === 'wine' && Math.random() < 0.15) {
      s.addXu(20); s.toast('Chú Tèo cụng ly ké, bao lại 20 xu! "Dzôôô!" (+8 XP)');
    } else s.toast(`${d.name.split(' — ')[0]}: ${d.tip} (+${d.xp} XP)`);
    reopen(); ok(); return;
  }
  // --- hũ tip mèo ---
  if (action === 'tip' && id === 'tip5') {
    const used = ['tip0', 'tip1', 'tip2', 'tip3', 'tip4'].filter((k) => F(k)).length;
    if (used >= 5 || s.xu < 5) { sfx.error(); return; }
    s.setDailyFlag('tip' + used);
    s.addXu(-5); s.addXP(1); sfx.coin();
    spawnBurst(px, py - 40, 'heart');
    if (used + 1 >= 5) {
      s.addXu(25);
      s.toast('Mèo Tam Thể gừ gừ, nhả lại 25 xu cám ơn! "Meo~" (+1 XP)');
    } else s.toast(`Mèo Mimi dụi đầu cám ơn! (${used + 1}/5 — đủ 5 có quà) (+1 XP)`);
    reopen(); ok(); return;
  }
  // --- thùng sale ---
  if (action === 'sale' && id === 'dig') {
    if (s.xu < 20) { sfx.error(); return; }
    s.addXu(-20);
    const r = Math.random();
    sfx.harvest(); spawnBurst(px, py - 40, 'spark');
    if (r < 0.5) { s.addXP(1); s.toast('Lục được... miếng vải vụn! Lau nhà được đó (+1 XP)'); }
    else if (r < 0.75) {
      const it = Math.random() < 0.5 ? 'bait' : 'feed';
      s.addInv(it, 2); s.addXP(1); s.toast(`Lục được 2 ${itemName(it)[0]} còn nguyên trong túi áo! (+1 XP)`);
    } else if (r < 0.9) {
      const it = Math.random() < 0.5 ? 'baitPro' : 'feedPro';
      s.addInv(it, 1); s.addXP(2); s.toast(`HÊN! Trong túi áo có 1 ${itemName(it)[0]}! (+2 XP)`);
    } else { s.addXu(30); s.addXP(2); s.toast('TRÚNG! Ai bỏ quên 30 xu trong túi quần! (+2 XP)'); }
    reopen(); ok(); return;
  }
  // --- thuê đồ diễn ---
  if (action === 'costume' && id === 'rent') {
    if (s.xu < 30) { sfx.error(); return; }
    s.addXu(-30); s.addXP(6); sfx.coin();
    costumeUntil = Date.now() + 300000;
    spawnBurst(px, py - 40, 'spark');
    useVillage.getState().sendEmote('🎭');
    s.toast('Mặc đồ diễn lộng lẫy! Diễn sân khấu +20% tip trong 5 phút (+6 XP)');
    s.setInAct(null); ok(); return;
  }
  // --- vòng quay ---
  if (action === 'wheel' && (id === 'free' || id === 'paid')) {
    spinWheel(id === 'paid', px, py);
    return;
  }
  // --- đố mẹo ---
  if (action === 'riddle' && id.startsWith('r:')) {
    const r = NHOC_RIDDLES[s.day % NHOC_RIDDLES.length];
    if (Number(id.slice(2)) === r.answer) {
      s.setDailyFlag('riddle'); s.addXu(15); s.addXP(2); sfx.lvup();
      spawnBurst(px, py - 40, 'spark');
      s.toast('Nhóc: "Đúng rồi! Thông minh như em hồi đó!" (+15 xu +2 XP)');
      s.setInAct(null); ok();
    } else {
      sfx.error();
      s.toast('Nhóc: "Sai bét! Đoán lại đi!"');
    }
    return;
  }
  // --- đóng dấu hành trình ---
  if (action === 'board' && id === 'stamp') {
    const houses = Object.keys(INTERIORS);
    const got = houses.filter((h) => F('visit:' + h));
    if (F('stampdone') || got.length < houses.length) { sfx.error(); return; }
    s.setDailyFlag('stampdone'); s.addXu(STAMP_REWARD_XU); s.addGem(1); sfx.lvup();
    spawnBurst(px, py - 40, 'coin'); spawnBurst(px, py - 60, 'spark');
    useVillage.getState().sendEmote('🗺️');
    s.toast(`Bác hội trưởng đóng dấu: "Đi đủ 8 nhà! Thưởng ${STAMP_REWARD_XU} xu + 1 gem!"`);
    reopen(); ok(); return;
  }
  // --- board ---
  if (action === 'board' && id.startsWith('accept:')) {
    const q = DAILIES.find((x) => x.id === id.slice(7))!;
    s.setDailyQuests([...s.daily.quests, { id: q.id, from: s.stats[q.stat], done: false, claimed: false }]);
    sfx.click(); s.toast(`Nhận việc: ${q.name}!`); reopen(); return;
  }
  if (action === 'board' && id.startsWith('claim:')) {
    const q = DAILIES.find((x) => x.id === id.slice(6))!;
    const st = s.daily.quests.find((x) => x.id === q.id)!;
    if (s.stats[q.stat] - st.from < q.need) { sfx.error(); return; }
    s.addXu(q.xu); s.addXP(q.xp); sfx.coin();
    spawnBurst(px, py - 40, 'coin');
    s.setDailyQuests(s.daily.quests.map((x) => (x.id === q.id ? { ...x, done: true, claimed: true } : x)));
    s.toast(`Nộp việc +${q.xu} xu +${q.xp} XP! Làng cảm ơn bạn!`); reopen(); ok(); return;
  }
  // --- donate ---
  if (action === 'donate' && id.startsWith('donate:')) {
    const pid = id.slice(7);
    if ((s.inv[pid] || 0) < 5) { sfx.error(); return; }
    const pts = Math.round(sellPrice(pid) * 5 * 1.2);
    s.addInv(pid, -5); s.addFund(pts); s.addXP(3); sfx.harvest();
    spawnBurst(px, py - 40, 'heart'); useVillage.getState().sendEmote('❤️');
    s.toast(`Góp 5 ${itemName(pid)[0]} → +${pts} điểm quỹ làng! (+3 XP)`); reopen(); ok(); return;
  }
  if (action === 'donate' && id.startsWith('fund:')) {
    const i = Number(id.slice(5));
    const m = FUND_MILESTONES[i];
    if (!m || s.fundClaim.includes(i) || s.fundTotal < m.points) { sfx.error(); return; }
    s.claimFund(i); sfx.lvup(); spawnBurst(px, py - 40, 'coin');
    if (i === 0) s.addInv('baitPro', 5);
    if (i === 1) { s.addInv('feedPro', 5); s.addGem(1); }
    if (i === 2) { s.addGem(3); s.addXu(500); }
    s.toast(`Mốc ${m.label}: nhận ${m.reward}!`); reopen(); return;
  }
  // --- cook: trừ nguyên liệu rồi canh lửa (timing) ---
  if (action === 'cook' && id.startsWith('cook:')) {
    const r = RECIPES.find((x) => x.id === id.slice(5))!;
    for (const [pid, n] of Object.entries(r.needs)) {
      if ((s.inv[pid] || 0) < n) { sfx.error(); s.toast('Thiếu nguyên liệu!'); return; }
    }
    for (const [pid, n] of Object.entries(r.needs)) s.addInv(pid, -n);
    s.setInAct({ mode: 'timing', furn: 'stove', payload: r.id, title: 'Canh lửa bếp củi', sub: 'Dừng kim đúng giữa — cháy là mất ngon!', rhythm: { total: 1, done: 0, score: 0 } });
    sfx.plant(); return;
  }
  // --- bench ---
  if (action === 'bench' && id.startsWith('bench:')) {
    const r = BENCH.find((x) => x.id === id.slice(6))!;
    if (s.xu < BENCH_FEE) { sfx.error(); s.toast('Thiếu xu công chế!'); return; }
    for (const [pid, n] of Object.entries(r.needs)) {
      if ((s.inv[pid] || 0) < n) { sfx.error(); s.toast('Thiếu nguyên liệu!'); return; }
    }
    for (const [pid, n] of Object.entries(r.needs)) s.addInv(pid, -n);
    s.addXu(-BENCH_FEE); s.addInv(r.id, 1); s.addXP(r.xp); sfx.harvest();
    spawnBurst(px, py - 40, 'spark');
    s.toast(`Chế xong 1 ${itemName(r.id)[0]}! (+${r.xp} XP)`); reopen(); ok(); return;
  }
  // --- gift coba ---
  if (action === 'gift' && id.startsWith('gift:')) {
    const pid = id.slice(5);
    if ((s.inv[pid] || 0) <= 0) { sfx.error(); return; }
    s.addInv(pid, -1); s.addLove(2); s.addXP(2); sfx.eat();
    spawnBurst(px, py - 40, 'heart'); useVillage.getState().sendEmote('🎁');
    s.toast(`Cô Ba: "Trời ơi ${itemName(pid)[0]} tươi quá! Quý con ghê!" (+2 thân thiết)`);
    reopen(); ok(); return;
  }
  if (action === 'love' && id.startsWith('love:')) {
    const i = Number(id.slice(5));
    const m = LOVE_MILESTONES[i];
    if (!m || s.loveClaim.includes(i) || s.baLove < m.love) { sfx.error(); return; }
    s.claimLove(i); sfx.lvup(); spawnBurst(px, py - 40, 'heart');
    if (i === 0) s.addInv('flan', 2);
    if (i === 1) { s.addInv('baitPro', 5); s.addGem(1); }
    if (i === 2) { s.addInv('thitkho', 1); s.addGem(3); }
    s.toast(`${m.label}: nhận ${m.reward}!`); reopen(); return;
  }
  // --- selljunk ---
  if (action === 'selljunk' && id.startsWith('sell:')) {
    const pid = id.slice(5);
    const n = pid === 'ung' ? s.inv.ung || 0 : s.inv.rong || 0;
    if (n <= 0) { sfx.error(); return; }
    const price = pid === 'ung' ? 9 : 6;
    s.addInv(pid, -n); s.addXu(n * price); s.addXP(2); sfx.coin();
    s.toast(`Chú Tám: "Ngon! ${n} món = ${n * price} xu!" (+2 XP)`);
    reopen(); ok(); return;
  }
  // --- gara: lái thử / mua / rửa / bảo dưỡng ---
  if (action === 'garage') {
    if (id.startsWith('drive:')) {
      const cid = id.slice(6);
      s.driveCar(cid); s.addXP(2); sfx.click();
      spawnBurst(px, py - 40, 'spark');
      s.toast(`Lái thử trong gara! Vít ga vài vòng cho đã (+2 XP)`); reopen(); ok(); return;
    }
    if (id === 'park') { s.driveCar(null); sfx.click(); reopen(); return; }
    if (id === 'shop') { s.setModal('carshop'); sfx.click(); return; }
    if (id === 'trydrive') {
      s.addXP(1); sfx.click(); spawnBurst(px, py - 40, 'spark');
      useVillage.getState().sendEmote('🏁');
      s.toast('Ngồi lên thử dáng xe — oách quá! Để dành tiền rước em nó về (+1 XP)');
      reopen(); ok(); return;
    }
    if (id === 'wash') {
      if (s.xu < WASH_COST) { sfx.error(); return; }
      s.addXu(-WASH_COST); s.addXP(8); sfx.water();
      spawnBurst(px, py - 40, 'spark'); spawnBurst(px, py - 60, 'drop');
      useVillage.getState().sendEmote('✨');
      s.toast('Xe bóng loáng soi gương được! Thợ Tèo lau tới kẽ bánh (+8 XP)');
      reopen(); ok(); return;
    }
    if (id === 'service') {
      if (s.xu < SERVICE_COST) { sfx.error(); return; }
      s.addXu(-SERVICE_COST); s.addXP(15); sfx.lvup();
      spawnBurst(px, py - 40, 'spark'); spawnBurst(px, py - 60, 'spark');
      useVillage.getState().sendEmote('🔧');
      s.toast('Bảo dưỡng xong! Máy êm như ru, bô nổ giòn tan (+15 XP)');
      reopen(); ok(); return;
    }
  }
}

// ================= TIMING / HOLD =================
function avgScore(r: { total: number; done: number; score: number }) {
  return r.done > 0 ? r.score / r.done : 0;
}

/** overlay timing gọi khi kim dừng: point 20/60/100 */
export function stopTiming(point: number, px: number, py: number) {
  const s = g();
  const act = s.inAct;
  if (!act || act.mode !== 'timing' || !act.rhythm) return;
  const r = { ...act.rhythm, done: act.rhythm.done + 1, score: act.rhythm.score + point };
  sfx.click();
  if (r.done < r.total) {
    s.setInAct({ ...act, rhythm: r });
    return;
  }
  // xong chuỗi
  const avg = avgScore(r);
  s.setInAct(null);
  if (act.furn === 'piano') {
    const tip = Math.round((r.score / (r.total * 100)) * 40);
    const xp = avg >= 90 ? 6 : avg >= 55 ? 4 : 2;
    s.addXu(tip); s.addXP(xp); sfx.harvest();
    spawnBurst(px, py - 50, 'note'); petCat('mimi');
    useVillage.getState().sendEmote('🎹');
    s.toast(avg >= 90 ? `Tuyệt đỉnh! Khách bo ${tip} xu, mèo vỗ tay bằng chân! (+${xp} XP)` : `Xong bản nhạc! Khách bo ${tip} xu (+${xp} XP)`);
    ok(); return;
  }
  if (act.furn === 'stageplat') {
    const tip = Math.round((r.score / (r.total * 100)) * 80);
    // ENCORE: diễn lại trong 90s x1.5 tip; đúng màu đèn khán giả yêu cầu +30%; đồ diễn thuê +20%
    let mult = 1;
    const notes: string[] = [];
    const nowMs = Date.now();
    if (nowMs < encoreUntil) { mult *= 1.5; notes.push('ENCORE x1.5'); }
    const req = stageRequestAt(nowMs);
    if (s.stageColor === req.color) { mult *= 1.3; notes.push(`đúng đèn ${req.name} khán giả yêu cầu`); }
    if (nowMs < costumeUntil) { mult *= 1.2; notes.push('đồ diễn thuê'); }
    const final = Math.round(tip * mult);
    const xp = avg >= 90 ? 8 : avg >= 55 ? 5 : 2;
    s.addXu(final); s.addXP(xp); sfx.lvup();
    encoreUntil = nowMs + 90000;
    cheerFans(); spawnBurst(px, py - 60, 'flower'); spawnBurst(px, py - 60, 'note');
    useVillage.getState().sendEmote('🎤');
    const extra = notes.length ? ` (${notes.join(' + ')})` : '';
    s.toast(avg >= 90 ? `SHOW ĐỈNH! Khán giả ném hoa + bo ${final} xu${extra}! (+${xp} XP)` : `Diễn xong! Khán giả vỗ tay + bo ${final} xu${extra} (+${xp} XP)`);
    ok(); return;
  }
  if (act.furn === 'mannequin') {
    const reward = point >= 100 ? 40 : point >= 60 ? 15 : 5;
    s.addXu(reward); s.addXP(3); sfx.coin();
    spawnBurst(px, py - 60, 'spark');
    s.toast(point >= 100 ? `Phối đồ CHUẨN! Chị thu ngân thưởng ${reward} xu!` : `Phối tạm được, thưởng ${reward} xu khích lệ!`);
    ok(); return;
  }
  if (act.furn === 'stove' && act.payload) {
    const rec = RECIPES.find((x) => x.id === act.payload)!;
    const [nm] = itemName(rec.id);
    const bonus = point >= 100 ? 8 : point >= 60 ? 4 : 1;
    s.addInv(rec.id, 1); s.addXP(rec.xp + bonus); sfx.eat();
    spawnBurst(px, py - 40, 'spark');
    s.toast(point >= 100 ? `${nm} thơm phức! Bán ${sellPrice(rec.id)} xu (+${rec.xp + bonus} XP)` : `${nm} hơi xém… vẫn bán được ${sellPrice(rec.id)} xu (+${rec.xp + bonus} XP)`);
    ok(); return;
  }
  if (act.furn === 'bell') {
    const xp = avg >= 55 ? 3 : 1;
    if (avg >= 55) {
      s.addFund(3); sfx.lvup();
      spawnBurst(px, py - 60, 'spark'); useVillage.getState().sendEmote('🔔');
      s.toast('BOONG! Tiếng chuông vang khắp làng (+3 điểm quỹ làng, +3 XP)');
    } else {
      sfx.click();
      s.toast('Chuông kêu "boong... ẹc" — đánh trượt nhịp rồi! (+1 XP)');
    }
    s.addXP(xp); ok(); return;
  }
  if (act.furn === 'drum') {
    const tip = Math.round((r.score / (r.total * 100)) * 40);
    const xp = avg >= 90 ? 5 : avg >= 55 ? 3 : 1;
    s.addXu(tip); s.addXP(xp); sfx.harvest();
    if (avg >= 55) { cheerFans(); spawnBurst(px, py - 60, 'note'); }
    useVillage.getState().sendEmote('🥁');
    s.toast(avg >= 90 ? `Trống dồn dập như sấm! Khán giả bo ${tip} xu! (+${xp} XP)` : `Đánh xong bài trống! Khán giả bo ${tip} xu (+${xp} XP)`);
    ok(); return;
  }
  if (act.furn === 'radio') {
    if (avg >= 55) {
      const news = RADIO_NEWS[Math.floor(Math.random() * RADIO_NEWS.length)];
      s.addXP(2); sfx.harvest();
      spawnBurst(px, py - 40, 'note');
      s.toast(`Bắt được sóng! ${news}`);
    } else {
      s.addXP(1); sfx.click();
      s.toast('Toàn tiếng rè "xèèè..." — dò lại đi!');
    }
    ok(); return;
  }
  if (act.furn === 'toolboard') {
    const tip = Math.round((r.score / (r.total * 100)) * 60);
    const xp = avg >= 90 ? 6 : avg >= 55 ? 4 : 2;
    s.addXu(tip); s.addXP(xp); sfx.harvest();
    spawnBurst(px, py - 50, 'spark');
    useVillage.getState().sendEmote('🔧');
    s.toast(avg >= 90 ? `Tay nghề THỢ CHÍNH! Anh Tý thưởng nóng ${tip} xu! (+${xp} XP)` : `Siết xong dàn ốc! Anh Tý bo ${tip} xu (+${xp} XP)`);
    ok(); return;
  }
}

/** overlay hold gọi khi giữ đủ lâu */
export function finishHold(px: number, py: number) {
  const s = g();
  const act = s.inAct;
  if (!act || act.mode !== 'hold') return;
  s.setInAct(null);
  // vuốt mèo
  if (act.furn.startsWith('npc:')) {
    const catId = act.payload ?? act.furn.slice(4);
    const d = INTERIORS[s.interiorId ?? ''];
    const npc = d?.npcs.find((n) => n.id === catId);
    petCat(catId); s.addXP(2); sfx.eat();
    spawnBurst(px, py - 40, 'heart');
    useVillage.getState().sendEmote('😻');
    s.touchDaily();
    if (!s.daily.cats.includes(catId)) {
      s.addCatGift(catId);
      const r = Math.random();
      if (r < 0.4) { s.addInv('bait', 2); s.toast(`${npc?.name} khoái quá, tặng lại 2 mồi câu! (+2 XP)`); }
      else if (r < 0.7) { s.addInv('feed', 2); s.toast(`${npc?.name} gừ gừ, tặng lại 2 cám! (+2 XP)`); }
      else { s.addXu(20); s.toast(`${npc?.name} liếm tay bạn rồi nhả... 20 xu?! (+2 XP)`); }
    } else s.toast(`${npc?.name} gừ gừ: "gừ… gừ…" (+2 XP)`);
    ok(); return;
  }
  // rửa bát cô Ba
  if (act.furn === 'bedbox') {
    s.addXP(2); sfx.water();
    spawnBurst(px, py - 30, 'drop');
    s.toast('Bát đĩa sạch bong! Cô Ba khen hết lời (+2 XP)');
    ok(); return;
  }
  // dụ mèo leo cây
  if (act.furn === 'cattree') {
    const cats = ['mimi', 'mun', 'tamt'];
    const who = cats[Math.floor(Math.random() * cats.length)];
    const d = INTERIORS[s.interiorId ?? ''];
    const npc = d?.npcs.find((n) => n.id === who);
    petCat(who); s.addXP(2); sfx.eat();
    spawnBurst(px, py - 40, 'heart');
    useVillage.getState().sendEmote('🐈');
    if (!F('climb')) {
      s.setDailyFlag('climb');
      s.toast(`${npc?.name} phi lên đỉnh cây, ngáp một cái rồi ngủ! Lần đầu dụ thành công (+2 XP)`);
    } else s.toast(`${npc?.name} leo thoăn thoắt lên cây! (+2 XP)`);
    ok(); return;
  }
  // ngồi uống chè nghe chuyện làng
  if (act.furn === 'teatable') {
    s.addXP(2); sfx.eat();
    spawnBurst(px, py - 30, 'note');
    useVillage.getState().sendEmote('🍵');
    s.toast(GOSSIP_LINES[Math.floor(Math.random() * GOSSIP_LINES.length)] + ' (+2 XP)');
    ok(); return;
  }
  // đạp máy xe ve chai
  if (act.furn === 'motor') {
    sfx.harvest(); spawnBurst(px, py - 30, 'drop');
    if (Math.random() < 0.7) {
      s.addXP(2);
      if (!F('bikeride')) {
        s.setDailyFlag('bikeride'); s.addXu(10);
        s.toast('BÀNH BÀNH! Nổ máy rồi! Chú Tám thuê chở chuyến ve chai +10 xu! (+2 XP)');
      } else s.toast('BÀNH BÀNH! Máy nổ giòn! Chú Tám gật gù (+2 XP)');
    } else {
      s.addXP(1);
      useVillage.getState().sendEmote('😷');
      s.toast('Sặc khói! Ho khụ khụ... đạp lại đi! (+1 XP)');
    }
    ok(); return;
  }
  // bới ve chai
  if (act.furn === 'junk') {
    s.setJunkAt(Date.now());
    const r = Math.random();
    sfx.harvest(); spawnBurst(px, py - 40, 'spark');
    if (r < 0.5) { const xu = 5 + Math.floor(Math.random() * 21); s.addXu(xu); s.toast(`Bới được mớ đồng nát bán ${xu} xu!`); }
    else if (r < 0.7) { s.addInv('bait', 2); s.toast('Bới được hộp mồi câu còn nguyên! +2 mồi'); }
    else if (r < 0.85) { s.addInv('feed', 2); s.toast('Bới được bao cám chưa khui! +2 cám'); }
    else if (r < 0.95) { s.addInv('pesticide', 1); s.toast('Bới được bình thuốc trừ sâu còn đầy!'); }
    else { s.addGem(1); sfx.lvup(); s.toast('TRÚNG MÁNH! Chiếc nhẫn cũ = 1 GEM! 💎'); }
    s.addXP(2); ok(); return;
  }
}

// ================= SỰ KIỆN THEO GIỜ TRONG NHÀ =================
// GameCanvas gọi mỗi frame (tự throttle 1s): giờ diễn mèo, giờ vàng slot,
// khán giả đổi màu đèn yêu cầu. Chỉ báo cho người ĐANG ở trong phòng đó.
let lastTick = 0;
let lastCatShow = 0;
let goldenAnnounced = -1;
let lastRequestIdx = -1;
let encoreUntil = 0;
/** đồ diễn thuê ở shop: diễn sân khấu +20% tip tới mốc này */
let costumeUntil = 0;

export function tickInteriorEvents(px: number, py: number) {
  const now = Date.now();
  if (now - lastTick < 1000) return;
  lastTick = now;
  const s = g();
  if (s.scene !== 'interior' || !s.interiorId) return;
  const id = s.interiorId;
  // 1. giờ diễn mèo ở cafe (mỗi 150s): 3 bé xếp hàng chào + XP
  if (id === 'cafe' && now - lastCatShow > CAT_SHOW_PERIOD) {
    lastCatShow = now;
    petCat('mimi'); petCat('mun'); petCat('tamt');
    spawnBurst(px, py - 60, 'note');
    s.addXP(1);
    useVillage.getState().sendEmote('🐈');
    s.toast('🐈 Giờ diễn của 3 bé mèo! Chúng nó xếp hàng chào khán giả (+1 XP)');
  }
  // 2. giờ vàng slot (mỗi 5 phút, 45s x2): báo cho người trong casino
  const winIdx = Math.floor(now / GOLDEN_PERIOD);
  if (id === 'casino' && goldenActive(now) && goldenAnnounced !== winIdx) {
    goldenAnnounced = winIdx;
    spawnBurst(px, py - 60, 'coin');
    useVillage.getState().sendEmote('🌟');
    s.toast('🌟 GIỜ VÀNG SLOT! Jackpot x2 trong 45s — ra máy Xèng ngay!');
  }
  // 3. khán giả sân khấu đổi màu đèn yêu cầu (mỗi 3 phút)
  const reqIdx = Math.floor(now / 180000);
  if (reqIdx !== lastRequestIdx) {
    lastRequestIdx = reqIdx;
    if (id === 'stage') {
      const rq = stageRequestAt(now);
      cheerFans();
      spawnBurst(px, py - 60, 'note');
      s.toast(`🎤 Khán giả đồng thanh: "Tối nay thích đèn ${rq.name}!" (đổi đèn đúng màu +30% tip)`);
    }
  }
}
