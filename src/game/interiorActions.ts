// ===== Logic hành động trong 6 nhà: mở overlay, trừ/cộng vật phẩm-xu-XP thật =====
import { useGame } from './store';
import { useVillage } from '../net/village';
import { sfx } from './audio';
import { itemName, sellPrice } from './data';
import type { InActItem } from './types';
import {
  BENCH, BENCH_FEE, DAILIES, FUND_MILESTONES, INTERIORS, LOVE_MILESTONES,
  MIRROR_LINES, RECIPES, TAM_STORIES,
} from './interiors';
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
    case 'cafe:counter': s.setInAct({ mode: 'list', furn, title: 'Quầy order', sub: 'Món nhà làm, uống tại chỗ', list: { action: 'order', items: [
      { id: 'coffee', label: 'Cà phê trứng — 10 xu', desc: 'Tỉnh táo, chạy nhanh 60s +4 XP', disabled: s.xu < 10 },
      { id: 'milk', label: 'Sữa nóng — 25 xu', desc: 'Ngọt béo +6 XP, mèo cũng thèm', disabled: s.xu < 25 },
    ] } }); sfx.click(); break;
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
    case 'barista': dlg([{ label: '☕ Gọi món', run: 'open:counter' }, { label: '🐈 Đi vuốt mèo', run: 'bye' }]); break;
    case 'elder': dlg([
      { label: '❓ Hỏi chuyện làng', run: 'story:elder' },
      { label: '💰 Quỹ làng được bao nhiêu?', run: 'story:fund' },
      { label: '👋 Chào bác', run: 'bye' },
    ]); break;
    case 'clerk': dlg([
      { label: '✨ Hỏi mốt mới', run: 'story:clerk' },
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
      { label: '👻 Nghe chuyện xưa', run: 'story:tam' },
      { label: '👋 Bye chú', run: 'bye' },
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
  s.setInAct({ mode: 'list', furn: 'board', title: 'Bảng nhiệm vụ ngày', sub: 'Mỗi ngày 3 việc, làm xong lĩnh thưởng', list: { action: 'board', items } });
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

// ================= CHẠY ITEM TRONG LIST =================
export function runListItem(action: string, id: string, px: number, py: number) {
  const s = g();
  if (id === 'x') return;
  const reopen = () => openInteriorFurn(s.inAct?.furn ?? '', px, py);
  // --- order cafe ---
  if (action === 'order' && id === 'coffee') {
    if (s.xu < 10) { sfx.error(); return; }
    s.addXu(-10); s.setSpeed(Date.now() + 60000); s.addXP(4); sfx.coin();
    spawnBurst(px, py - 40, 'spark'); useVillage.getState().sendEmote('☕');
    s.toast('Cà phê trứng béo ngậy! Chạy nhanh 60s +4 XP'); s.setInAct(null); ok(); return;
  }
  if (action === 'order' && id === 'milk') {
    if (s.xu < 25) { sfx.error(); return; }
    s.addXu(-25); s.addXP(6); sfx.coin();
    spawnBurst(px, py - 40, 'heart');
    s.toast('Sữa nóng ngọt lịm! Mèo nhìn thèm chảy dãi +6 XP'); s.setInAct(null); ok(); return;
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
    const xp = avg >= 90 ? 8 : avg >= 55 ? 5 : 2;
    s.addXu(tip); s.addXP(xp); sfx.lvup();
    cheerFans(); spawnBurst(px, py - 60, 'flower'); spawnBurst(px, py - 60, 'note');
    useVillage.getState().sendEmote('🎤');
    s.toast(avg >= 90 ? `SHOW ĐỈNH! Khán giả ném hoa + bo ${tip} xu! (+${xp} XP)` : `Diễn xong! Khán giả vỗ tay + bo ${tip} xu (+${xp} XP)`);
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
