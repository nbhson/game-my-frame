/* ============================================================
   NÔNG TRẠI PIXEL - mini Avatar farm (vanilla canvas)
   Trồng cây • Nuôi cá • Chăn nuôi • Câu cá mini-game
   ============================================================ */
'use strict';

// ---------- DATA ----------
const CROPS = {
  lua:    { name:'Lúa',      emoji:'🌾', seedPrice:10,  sell:28,   grow:35,  xp:6,  lv:1, desc:'Lớn nhanh, dễ trồng' },
  carot:  { name:'Cà rốt',   emoji:'🥕', seedPrice:25,  sell:65,   grow:70,  xp:12, lv:2, desc:'Củ ngọt giòn' },
  cachua: { name:'Cà chua',  emoji:'🍅', seedPrice:45,  sell:120,  grow:120, xp:20, lv:3, desc:'Mọng nước' },
  bap:    { name:'Bắp',      emoji:'🌽', seedPrice:80,  sell:210,  grow:180, xp:32, lv:4, desc:'Vàng óng' },
  duahau: { name:'Dưa hấu',  emoji:'🍉', seedPrice:140, sell:380,  grow:260, xp:50, lv:5, desc:'Ngọt lịm ngày hè' },
  bing0:  { name:'Bí ngô',   emoji:'🎃', seedPrice:220, sell:620,  grow:360, xp:80, lv:7, desc:'Quả to khổng lồ' },
};
const FISHES = {
  caro:  { name:'Cá rô',   emoji:'🐟', babyPrice:30,  sell:80,   grow:90,  xp:10, lv:1, desc:'Dễ nuôi' },
  cachep:{ name:'Cá chép', emoji:'🐠', babyPrice:60,  sell:170,  grow:150, xp:18, lv:2, desc:'Vảy vàng' },
  caloc: { name:'Cá lóc',  emoji:'🐡', babyPrice:110, sell:320,  grow:220, xp:30, lv:4, desc:'Khỏe mạnh' },
  cakoi: { name:'Cá Koi',  emoji:'🎏', babyPrice:250, sell:750,  grow:340, xp:60, lv:6, desc:'Quý hiếm, đắt tiền' },
};
const ANIMALS = {
  chicken:{ name:'Gà', emoji:'🐔', babyPrice:80,  product:'🥚 Trứng', productId:'trung', sell:45,  grow:90,  cycle:45,  xp:12, lv:2, desc:'Đẻ trứng đều' },
  cow:    { name:'Bò sữa', emoji:'🐄', babyPrice:250, product:'🥛 Sữa', productId:'sua', sell:120, grow:180, cycle:75,  xp:28, lv:4, desc:'Cho sữa ngọt' },
  pig:    { name:'Heo', emoji:'🐷', babyPrice:180, product:'🥩 Thịt', productId:'thit', sell:400, grow:240, cycle:150, xp:50, lv:5, desc:'Lớn nhanh, bán thịt' },
};
const ITEMS = {
  feed: { name:'Thức ăn', emoji:'🌽', price:15, desc:'Cho gà/bò/heo/cá ăn' },
  bait: { name:'Mồi câu', emoji:'🪱', price:10, desc:'Dùng để câu cá giải trí' },
};
const PRODUCT_NAMES = { trung:['Trứng','🥚'], sua:['Sữa','🥛'], thit:['Thịt heo','🥩'] };
// gán tên sp cây: lua_sp...
function prodId(type,id){ return type+':'+id; }
function itemName(pid){
  if(CROPS[pid]) return [CROPS[pid].name, CROPS[pid].emoji];
  if(FISHES[pid]) return [FISHES[pid].name, FISHES[pid].emoji];
  if(PRODUCT_NAMES[pid]) return PRODUCT_NAMES[pid];
  if(ITEMS[pid]) return [ITEMS[pid].name, ITEMS[pid].emoji];
  if(pid.startsWith('seed:')){ const c=CROPS[pid.slice(5)]; return ['Hạt '+c.name,'🌰']; }
  if(pid.startsWith('babyfish:')){ const c=FISHES[pid.slice(9)]; return ['Cá con '+c.name,'🐣']; }
  if(pid.startsWith('baby:')){ const c=ANIMALS[pid.slice(5)]; return [c.name+' con',c.emoji]; }
  return [pid,'📦'];
}
function sellPrice(pid){
  if(CROPS[pid]) return CROPS[pid].sell;
  if(FISHES[pid]) return FISHES[pid].sell;
  if(pid==='trung') return 45; if(pid==='sua') return 120; if(pid==='thit') return 400;
  if(ITEMS[pid]) return Math.floor(ITEMS[pid].price/2);
  return 1;
}

const QUESTS = [
  { id:'hoe',   text:'Cày 1 ô đất đầu tiên (đi tới ruộng, bấm E)', check:s=>s.stats.hoed>=1, reward:{xu:50,xp:10} },
  { id:'plant', text:'Gieo 1 hạt Lúa', check:s=>s.stats.planted>=1, reward:{xu:50,xp:15} },
  { id:'water', text:'Tưới nước cho cây', check:s=>s.stats.watered>=1, reward:{xu:50,xp:15} },
  { id:'harv',  text:'Thu hoạch vụ đầu tiên', check:s=>s.stats.harvested>=1, reward:{xu:120,xp:30} },
  { id:'chick', text:'Mua 1 con Gà ở cửa hàng 🏪', check:s=>s.stats.boughtAnimal>=1, reward:{xu:100,xp:25} },
  { id:'feed',  text:'Cho vật nuôi / cá ăn 1 lần', check:s=>s.stats.fed>=1, reward:{xu:100,xp:25} },
  { id:'egg',   text:'Thu 1 sản phẩm chăn nuôi (trứng/sữa...)', check:s=>s.stats.collectedAnimal>=1, reward:{xu:150,xp:40} },
  { id:'fish',  text:'Thả 1 con cá xuống ao', check:s=>s.stats.stockedFish>=1, reward:{xu:120,xp:30} },
  { id:'rich',  text:'Kiếm 2.000 xu (bán nông sản)', check:s=>s.stats.earned>=2000, reward:{gem:3,xp:80} },
  { id:'lv5',   text:'Đạt cấp 5 nông dân', check:s=>s.level>=5, reward:{gem:5,xu:500} },
];

// ---------- STATE ----------
const SAVE_KEY='nongtrai_pixel_v1';
function defaultState(){
  const plots=[];
  for(let i=0;i<12;i++) plots.push({state:'grass',crop:null,progress:0,watered:false,waterLeft:0});
  const fishes=[]; for(let i=0;i<6;i++) fishes.push(null);
  return {
    name:'NôngDân', avatar:0,
    xu:500, gem:5, level:1, xp:0, day:1, dayTime:0.3,
    inv:{ 'seed:lua':3, feed:3, bait:3 },
    plots, fishes,
    animals:[], // {uid,type,bornAt,hunger,productT,ready}
    stats:{hoed:0,planted:0,watered:0,harvested:0,boughtAnimal:0,fed:0,collectedAnimal:0,stockedFish:0,earned:0,fished:0},
    questIdx:0, uidSeq:1,
  };
}
let S = defaultState();
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){ try{ const r=localStorage.getItem(SAVE_KEY); if(r){ const d=JSON.parse(r); S=Object.assign(defaultState(),d); return true; } }catch(e){} return false; }

// ---------- AUDIO ----------
let AC=null, soundOn=true;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function beep(f=440,t=0.12,type='square',v=0.15,slide=0){
  if(!soundOn) return; const c=ac(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(f,c.currentTime);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),c.currentTime+t);
  g.gain.setValueAtTime(v,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+t);
}
const sfx={
  click(){beep(600,.07);}, coin(){beep(900,.08);setTimeout(()=>beep(1400,.12),70);},
  plant(){beep(400,.1,'triangle');}, water(){beep(500,.15,'sine',.2,-200);},
  harvest(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.12),i*80));},
  error(){beep(160,.2,'sawtooth');}, eat(){beep(300,.08,'square');setTimeout(()=>beep(350,.08,'square'),90);},
  splash(){beep(700,.2,'sine',.2,-500);}, catch_(){[400,600,900].forEach((f,i)=>setTimeout(()=>beep(f,.1),i*90));},
  lvup(){[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,.15),i*100));},
  moo(){beep(140,.4,'sawtooth',.2,-40);}, cluck(){beep(800,.06,'square');setTimeout(()=>beep(1000,.06,'square'),70);},
};

// ---------- HELPERS ----------
const $=id=>document.getElementById(id);
function toast(msg){ const d=document.createElement('div'); d.className='toast'; d.textContent=msg; $('toast-box').appendChild(d); setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .4s'; setTimeout(()=>d.remove(),400);},2200); }
function addInv(pid,n=1){ S.inv[pid]=(S.inv[pid]||0)+n; if(S.inv[pid]<=0) delete S.inv[pid]; }
function hasInv(pid,n=1){ return (S.inv[pid]||0)>=n; }
function xpNeed(){ return S.level*100; }
function addXP(n){
  S.xp+=n;
  while(S.xp>=xpNeed()){ S.xp-=xpNeed(); S.level++; S.xu+=S.level*50; S.gem+=1;
    toast('🎉 LÊN CẤP '+S.level+'! +'+(S.level*50)+' xu +1💎'); sfx.lvup(); }
}
function addXu(n){ S.xu+=n; if(n>0) S.stats.earned+=n; }

// ---------- WORLD / MAP ----------
const TILE=48;
const WORLD={w:1600,h:1200};
const FARM={x:90,y:300,w:560,h:340,cols:4,rows:3};      // 12 ô
const POND={x:1020,y:230,w:460,h:300};
const COOP={x:90,y:800,w:420,h:280};                     // gà
const BARN={x:560,y:800,w:460,h:280};                    // bò + heo
const HOUSE={x:1090,y:760,w:330,h:260};
const SHOPD={x:770,y:120,w:170,h:130};

function plotPos(i){
  const c=i%FARM.cols, r=Math.floor(i/FARM.cols);
  const cw=FARM.w/FARM.cols, rh=FARM.h/FARM.rows;
  return {x:FARM.x+c*cw+cw/2, y:FARM.y+r*rh+rh/2, w:cw-18, h:rh-26};
}
function pondSlotPos(i){
  const c=i%3, r=Math.floor(i/3);
  return {x:POND.x+90+c*((POND.w-180)/2), y:POND.y+80+r*((POND.h-140))};
}
function animalHome(a){
  if(a.type==='chicken') return COOP; return BARN;
}
// vị trí con vật: rải theo uid
function animalPos(a,idx,t){
  const home=animalHome(a);
  const seed=(a.uid*137)%1000/1000;
  const cx=home.x+home.w/2, cy=home.y+home.h/2;
  const wx=Math.sin(t*0.5+a.uid)* (home.w/2-50);
  const wy=Math.cos(t*0.35+a.uid*2)* (home.h/2-50);
  return {x:cx+wx, y:cy+wy};
}

// ---------- PLAYER ----------
const player={x:700,y:600,vx:0,vy:0,dir:1,frame:0,moving:false,tx:null,ty:null,speed:260};
const keys={};
const AVATARS=['🧑‍🌾','👩‍🌾','👦','🤠'];
const SHIRTS=['#3f9e4d','#e75480','#3b82f6','#b45309'];

function isBlocked(x,y){
  // ao (trừ viền), nhà, shop
  if(x>POND.x+20&&x<POND.x+POND.w-20&&y>POND.y+20&&y<POND.y+POND.h-20) return true;
  if(x>HOUSE.x&&x<HOUSE.x+HOUSE.w&&y>HOUSE.y&&y<HOUSE.y+HOUSE.h) return true;
  if(x>SHOPD.x&&x<SHOPD.x+SHOPD.w&&y>SHOPD.y&&y<SHOPD.y+SHOPD.h) return true;
  if(x<20||y<60||x>WORLD.w-20||y>WORLD.h-20) return true;
  return false;
}

// ---------- INTERACT SCAN ----------
function nearestInteract(){
  let best=null,bd=110;
  // plots
  for(let i=0;i<S.plots.length;i++){
    const p=plotPos(i), dx=player.x-p.x, dy=player.y-p.y, d=Math.hypot(dx,dy);
    if(d<bd){ const pl=S.plots[i];
      let label='';
      if(pl.state==='grass') label=`Cuốc đất ô ${i+1}`;
      else if(pl.state==='soil') label=`Gieo hạt ô ${i+1}`;
      else if(pl.state==='growing') label= pl.watered? `${CROPS[pl.crop].name} đang lớn…` : `Tưới ${CROPS[pl.crop].name}`;
      else if(pl.state==='ready') label=`Thu hoạch ${CROPS[pl.crop].name} ${CROPS[pl.crop].emoji}`;
      bd=d; best={kind:'plot',i,label};
    }
  }
  // pond slots
  for(let i=0;i<S.fishes.length;i++){
    const p=pondSlotPos(i), d=Math.hypot(player.x-p.x,player.y-p.y);
    if(d<130&&d<bd+40){
      const f=S.fishes[i]; let label='';
      if(!f) label=`Thả cá vào ngăn ${i+1}`;
      else if(!f.grown) label=`Cho ${FISHES[f.type].name} ăn`;
      else label=`Thu hoạch ${FISHES[f.type].name} ${FISHES[f.type].emoji}`;
      best={kind:'pond',i,label}; bd=d;
    }
  }
  // fishing spot (cầu ao)
  {
    const fx=POND.x+POND.w/2, fy=POND.y+POND.h+30, d=Math.hypot(player.x-fx,player.y-fy);
    if(d<110&&(!best||d<bd)){ best={kind:'fishspot',label:'Câu cá giải trí (tốn 1 mồi)'}; bd=d; }
  }
  // animals
  const t=performance.now()/1000;
  S.animals.forEach((a,idx)=>{
    const p=animalPos(a,idx,t), d=Math.hypot(player.x-p.x,player.y-p.y);
    if(d<90&&d<bd){
      const A=ANIMALS[a.type];
      const adult=(Date.now()-a.bornAt)/1000>=A.grow;
      let label='';
      if(a.hunger<60) label=`Cho ${A.name} ăn`;
      else if(a.ready&&adult) label=`Thu ${A.product}`;
      else label=`${A.name} ${adult?'':' (con non)'} • No ${(a.hunger|0)}%`;
      best={kind:'animal',uid:a.uid,label}; bd=d;
    }
  });
  // shop / house
  {
    const sx=SHOPD.x+SHOPD.w/2, sy=SHOPD.y+SHOPD.h+40, d=Math.hypot(player.x-sx,player.y-sy);
    if(d<110&&(!best||d<bd)){ best={kind:'shop',label:'Mở Cửa hàng 🏪'}; bd=d; }
    const hx=HOUSE.x+HOUSE.w/2, hy=HOUSE.y+HOUSE.h+40, d2=Math.hypot(player.x-hx,player.y-hy);
    if(d2<120&&(!best||d2<bd)){ best={kind:'house',label:'Vào nhà Ngủ qua ngày 💤'}; bd=d2; }
  }
  return best;
}

function doInteract(target){
  target=target||nearestInteract();
  if(!target){ return; }
  sfx.click();
  if(target.kind==='plot') return plotAction(target.i);
  if(target.kind==='pond') return pondAction(target.i);
  if(target.kind==='fishspot') return openFishing();
  if(target.kind==='animal') return animalAction(target.uid);
  if(target.kind==='shop') return openShop('seed');
  if(target.kind==='house') return sleepNight();
}

// ----- farm actions -----
function plotAction(i){
  const pl=S.plots[i];
  if(pl.state==='grass'){ pl.state='soil'; S.stats.hoed++; addXP(3); sfx.plant(); toast('⛏️ Đã cuốc đất!'); checkQuest(); save(); return; }
  if(pl.state==='soil'){ return openSeedMenu(i); }
  if(pl.state==='growing'){
    if(!pl.watered){ pl.watered=true; pl.waterLeft=45; S.stats.watered++; addXP(2); sfx.water(); toast('💧 Đã tưới nước!'); checkQuest(); save(); }
    else toast('Cây đang lớn... ráng đợi nhé!');
    return;
  }
  if(pl.state==='ready'){
    const c=CROPS[pl.crop];
    addInv(pl.crop,1); addXu(0); S.stats.harvested++; addXP(c.xp);
    sfx.harvest(); toast(`🧺 Thu hoạch +1 ${c.name} ${c.emoji}!`);
    pl.state='soil'; pl.crop=null; pl.progress=0; pl.watered=false;
    checkQuest(); save(); refreshHUD(); renderQuick();
    return;
  }
}
function pondAction(i){
  const f=S.fishes[i];
  if(!f){ return openFishStockMenu(i); }
  if(!f.grown){
    if(!hasInv('feed')){ sfx.error(); toast('Hết thức ăn! Mua ở cửa hàng 🏪'); return; }
    addInv('feed',-1); f.hunger=Math.min(100,(f.hunger||50)+45); S.stats.fed++; addXP(3); sfx.eat();
    toast('🐟 Cá ăn ngon lành!'); checkQuest(); save(); refreshHUD(); renderQuick(); return;
  } else {
    const F=FISHES[f.type];
    addInv(f.type,1); S.stats.harvested++; S.stats.collectedAnimal++; addXP(F.xp);
    sfx.harvest(); toast(`🎣 Thu hoạch +1 ${F.name}!`); S.fishes[i]=null;
    checkQuest(); save(); refreshHUD(); renderQuick(); return;
  }
}
function animalAction(uid){
  const a=S.animals.find(x=>x.uid===uid); if(!a) return;
  const A=ANIMALS[a.type];
  if(a.hunger<60){
    if(!hasInv('feed')){ sfx.error(); toast('Hết thức ăn! Mua ở cửa hàng 🏪'); return; }
    addInv('feed',-1); a.hunger=100; S.stats.fed++; addXP(4); sfx.eat();
    if(a.type==='chicken')sfx.cluck(); if(a.type==='cow')sfx.moo();
    toast(`${A.emoji} ${A.name} ăn no nê!`); checkQuest(); save(); refreshHUD(); renderQuick(); return;
  }
  const adult=(Date.now()-a.bornAt)/1000>=A.grow;
  if(a.ready&&adult){
    addInv(A.productId,1); a.ready=false; a.productT=0; S.stats.collectedAnimal++; addXP(A.xp);
    sfx.harvest(); toast(`🎁 Thu được ${A.product}!`);
    checkQuest(); save(); refreshHUD(); renderQuick(); return;
  }
  toast(`${A.name}: ${adult?'đang tạo sản phẩm…':'còn non, cho ăn đều nhé!'} (No ${a.hunger|0}%)`);
}
function sleepNight(){
  S.day++; S.dayTime=0.3; addXP(10);
  // tưới khô, hồi ít đói? ngủ giúp cây lớn thêm chút
  S.plots.forEach(p=>{ if(p.state==='growing'){ p.progress=Math.min(1,p.progress+0.15); if(p.progress>=1)p.state='ready'; } });
  sfx.lvup(); toast(`💤 Ngủ ngon! Sang ngày ${S.day}`); save(); refreshHUD();
}

// ---------- FISHING MINIGAME ----------
let fishGame=null;
function openFishing(){
  if(!hasInv('bait')){ sfx.error(); toast('Hết mồi câu! Mua ở cửa hàng 🏪'); return; }
  $('fish-minigame').classList.remove('hidden');
  $('fish-result').textContent='';
  const zoneL=15+Math.random()*55;
  fishGame={pos:0,dir:1,speed:1.2+Math.random()*0.8+S.level*0.05,zoneL,zoneW:22,t:0};
  const z=$('fish-zone'); z.style.left=zoneL+'%'; z.style.width='22%';
  sfx.splash();
}
function closeFishing(){ $('fish-minigame').classList.add('hidden'); fishGame=null; }
function tryCatch(){
  if(!fishGame) return;
  const p=fishGame.pos*100, z0=fishGame.zoneL, z1=fishGame.zoneL+fishGame.zoneW;
  if(p>=z0&&p<=z1){
    addInv('bait',-1);
    // thưởng theo lv
    const pool=['caro','caro','cachep','cachep','caloc','cakoi'];
    const id=pool[Math.floor(Math.random()* (S.level>=4?pool.length:4))];
    const F=FISHES[id];
    addInv(id,1); S.stats.fished++; addXP(F.xp); sfx.catch_(); sfx.coin();
    $('fish-result').textContent=`🎉 Dính ${F.name} ${F.emoji}!`;
    setTimeout(closeFishing,1100);
    checkQuest(); save(); refreshHUD(); renderQuick();
  } else {
    addInv('bait',-1); sfx.splash();
    $('fish-result').textContent='💦 Hụt rồi! Thử lại nào';
    if(!hasInv('bait')) setTimeout(closeFishing,900);
    refreshHUD(); renderQuick();
  }
}

// ---------- SHOP / MODAL ----------
let modalTab='seed';
function openModal(title,html){ $('modal-title').textContent=title; $('modal-body').innerHTML=html; $('modal-bg').classList.remove('hidden'); }
function closeModal(){ $('modal-bg').classList.add('hidden'); }
function openShop(tab){
  modalTab=tab||modalTab||'seed'; sfx.click();
  const tabs=[['seed','🌱 Hạt'],['fish','🐟 Cá'],['animal','🐔 Vật nuôi'],['food','🍞 Thức ăn'],['sell','💰 Bán']];
  let h=`<div class="shop-tabs">`+tabs.map(([k,l])=>`<button class="shop-tab ${modalTab===k?'active':''}" data-tab="${k}">${l}</button>`).join('')+`</div><div class="shop-grid">`;
  if(modalTab==='seed'){
    for(const id in CROPS){ const c=CROPS[id];
      const lock=S.level<c.lv;
      h+=`<div class="shop-card"><div class="se">${c.emoji}</div><h4>${c.name} ${lock?'🔒Lv'+c.lv:''}</h4><p>${c.desc}<br>⏱${c.grow}s • Bán ${c.sell}🪙</p><div class="price">🌰 ${c.seedPrice}🪙</div><div class="shop-row"><button class="pixel-btn small" ${lock?'disabled':''} onclick="buySeed('${id}')">Mua</button></div></div>`;
    }
  } else if(modalTab==='fish'){
    for(const id in FISHES){ const f=FISHES[id]; const lock=S.level<f.lv;
      h+=`<div class="shop-card"><div class="se">${f.emoji}</div><h4>${f.name} ${lock?'🔒Lv'+f.lv:''}</h4><p>${f.desc}<br>⏱${f.grow}s • Bán ${f.sell}🪙</p><div class="price">${f.babyPrice}🪙</div><div class="shop-row"><button class="pixel-btn small" ${lock?'disabled':''} onclick="buyFish('${id}')">Mua con</button></div></div>`;
    }
  } else if(modalTab==='animal'){
    for(const id in ANIMALS){ const a=ANIMALS[id]; const lock=S.level<a.lv;
      h+=`<div class="shop-card"><div class="se">${a.emoji}</div><h4>${a.name} ${lock?'🔒Lv'+a.lv:''}</h4><p>${a.desc}<br>SP: ${a.product} (${a.sell}🪙)</p><div class="price">${a.babyPrice}🪙</div><div class="shop-row"><button class="pixel-btn small" ${lock?'disabled':''} onclick="buyAnimal('${id}')">Mua</button></div></div>`;
    }
  } else if(modalTab==='food'){
    h+=`<div class="shop-card"><div class="se">🌽</div><h4>Thức ăn</h4><p>Cho mọi vật nuôi & cá</p><div class="price">15🪙</div><div class="shop-row"><button class="pixel-btn small" onclick="buyItem('feed')">Mua</button><button class="pixel-btn small" onclick="buyItem5('feed')">x5</button></div></div>`;
    h+=`<div class="shop-card"><div class="se">🪱</div><h4>Mồi câu</h4><p>Câu cá giải trí ở cầu ao</p><div class="price">10🪙</div><div class="shop-row"><button class="pixel-btn small" onclick="buyItem('bait')">Mua</button><button class="pixel-btn small" onclick="buyItem5('bait')">x5</button></div></div>`;
    h+=`<div class="shop-card"><div class="se">💎</div><h4>Đổi gem</h4><p>5 💎 = 500 🪙</p><div class="price">5💎</div><div class="shop-row"><button class="pixel-btn small" onclick="exchangeGem()">Đổi</button></div></div>`;
  } else if(modalTab==='sell'){
    const keys=Object.keys(S.inv);
    if(!keys.length) h+=`<p>Kho trống! Thu hoạch rồi quay lại bán nhé 🌾</p>`;
    for(const pid of keys){
      const [nm,em]=itemName(pid); const pr=sellPrice(pid);
      if(pid.startsWith('seed:')||pid.startsWith('baby')) continue;
      h+=`<div class="shop-card"><div class="se">${em}</div><h4>${nm} x${S.inv[pid]}</h4><div class="price">${pr}🪙 / cái</div><div class="shop-row"><button class="pixel-btn small" onclick="sellOne('${pid}')">Bán 1</button><button class="pixel-btn small" onclick="sellAll('${pid}')">Bán hết</button></div></div>`;
    }
  }
  h+=`</div><p style="margin-top:10px;font-weight:800">🪙 ${S.xu} • 💎 ${S.gem} • Lv ${S.level}</p>`;
  openModal('🏪 CỬA HÀNG NÔNG TRẠI',h);
  document.querySelectorAll('.shop-tab').forEach(b=>b.onclick=()=>openShop(b.dataset.tab));
}
// expose cho onclick inline
window.buySeed=function(id){ const c=CROPS[id]; if(S.level<c.lv){sfx.error();return;} if(S.xu<c.seedPrice){sfx.error();toast('Không đủ xu!');return;} S.xu-=c.seedPrice; addInv('seed:'+id,1); sfx.coin(); toast(`Mua hạt ${c.name}!`); save(); openShop('seed'); refreshHUD(); renderQuick(); };
window.buyFish=function(id){ const f=FISHES[id]; if(S.level<f.lv){sfx.error();return;}
  // mua cá con vào kho, rồi ra ao thả
  if(S.xu<f.babyPrice){sfx.error();toast('Không đủ xu!');return;} S.xu-=f.babyPrice; addInv('babyfish:'+id,1); sfx.coin(); toast(`Mua cá con ${f.name}! Ra ao thả nhé 🐟`); save(); openShop('fish'); refreshHUD(); renderQuick(); };
window.buyAnimal=function(id){ const a=ANIMALS[id]; if(S.level<a.lv){sfx.error();return;}
  const max = id==='chicken'?6:4;
  const count=S.animals.filter(x=>x.type===id).length;
  if(count>=max){sfx.error();toast('Chuồng đầy rồi! (tối đa '+max+')');return;}
  if(S.xu<a.babyPrice){sfx.error();toast('Không đủ xu!');return;}
  S.xu-=a.babyPrice; S.animals.push({uid:S.uidSeq++,type:id,bornAt:Date.now(),hunger:90,productT:0,ready:false});
  S.stats.boughtAnimal++; sfx.coin(); sfx.cluck(); toast(`Mua ${a.name}! Cho ăn đều nhé 🐾`); checkQuest(); save(); openShop('animal'); refreshHUD(); };
window.buyItem=function(id){ const it=ITEMS[id]; if(S.xu<it.price){sfx.error();toast('Không đủ xu!');return;} S.xu-=it.price; addInv(id,1); sfx.coin(); save(); openShop('food'); refreshHUD(); renderQuick(); };
window.buyItem5=function(id){ const it=ITEMS[id]; if(S.xu<it.price*5){sfx.error();toast('Không đủ xu!');return;} S.xu-=it.price*5; addInv(id,5); sfx.coin(); save(); openShop('food'); refreshHUD(); renderQuick(); };
window.exchangeGem=function(){ if(S.gem<5){sfx.error();toast('Cần 5 💎!');return;} S.gem-=5; S.xu+=500; sfx.coin(); save(); openShop('food'); refreshHUD(); };
window.sellOne=function(pid){ if(!hasInv(pid))return; addInv(pid,-1); const p=sellPrice(pid); addXu(p); addXP(2); sfx.coin(); toast(`+${p} xu!`); save(); openShop('sell'); refreshHUD(); renderQuick(); checkQuest(); };
window.sellAll=function(pid){ const n=S.inv[pid]||0; if(!n)return; delete S.inv[pid]; const p=sellPrice(pid)*n; addXu(p); addXP(Math.min(40,n*2)); sfx.coin(); toast(`Bán hết +${p} xu!`); save(); openShop('sell'); refreshHUD(); renderQuick(); checkQuest(); };

function openSeedMenu(plotIdx){
  let h=`<h3>🌰 Chọn hạt để gieo (ô ${plotIdx+1})</h3><div class="action-list" style="margin-top:10px">`;
  let any=false;
  for(const id in CROPS){ const c=CROPS[id]; const n=S.inv['seed:'+id]||0;
    if(S.level<c.lv) continue;
    any=true;
    h+=`<button class="action-btn" onclick="plantSeed(${plotIdx},'${id}')" ${n<=0?'disabled style="opacity:.5"':''}><span>${c.emoji} ${c.name} x${n}</span><span>⏱${c.grow}s</span></button>`;
  }
  if(!any) h+=`<p>Chưa mở khóa hạt nào. Lên cấp nhé!</p>`;
  h+=`</div><p style="margin-top:8px">Hết hạt? <a href="#" onclick="openShop('seed');return false">Mua ở cửa hàng</a></p>`;
  openModal('🌱 GIEO HẠT',h);
}
window.plantSeed=function(i,id){
  const pl=S.plots[i]; if(pl.state!=='soil')return;
  if(!hasInv('seed:'+id)){ sfx.error(); toast('Hết hạt! Mua thêm ở cửa hàng'); openShop('seed'); return; }
  addInv('seed:'+id,-1); pl.state='growing'; pl.crop=id; pl.progress=0; pl.watered=false; pl.waterLeft=0;
  S.stats.planted++; addXP(4); sfx.plant(); toast(`Đã gieo ${CROPS[id].name}! Tưới nước ngay 💧`);
  closeModal(); checkQuest(); save(); refreshHUD(); renderQuick();
};
function openFishStockMenu(slot){
  let h=`<h3>🐟 Thả cá vào ngăn ${slot+1}</h3><div class="action-list" style="margin-top:10px">`;
  let any=false;
  for(const id in FISHES){ const f=FISHES[id]; const n=S.inv['babyfish:'+id]||0;
    if(S.level<f.lv) continue; any=true;
    h+=`<button class="action-btn" onclick="stockFish(${slot},'${id}')" ${n<=0?'disabled style="opacity:.5"':''}><span>${f.emoji} ${f.name} x${n}</span><span>⏱${f.grow}s</span></button>`;
  }
  if(!any) h+=`<p>Chưa có cá con. Mua ở cửa hàng nhé!</p>`;
  h+=`</div>`;
  openModal('🐟 THẢ CÁ',h);
}
window.stockFish=function(slot,id){
  if(S.fishes[slot])return;
  if(!hasInv('babyfish:'+id)){sfx.error();openShop('fish');return;}
  addInv('babyfish:'+id,-1);
  S.fishes[slot]={type:id,bornAt:Date.now(),age:0,grown:false,hunger:80,feedT:0};
  S.stats.stockedFish++; addXP(5); sfx.splash(); toast(`Đã thả ${FISHES[id].name} xuống ao!`);
  closeModal(); checkQuest(); save(); refreshHUD(); renderQuick();
};

function openBag(){
  sfx.click();
  const keys=Object.keys(S.inv);
  let h=`<p>🪙 <b>${S.xu}</b> • 💎 <b>${S.gem}</b> • Lv <b>${S.level}</b></p><div class="inv-grid" style="margin-top:10px">`;
  if(!keys.length) h+=`<p>Kho trống trơn 🕸️</p>`;
  const sorted=keys.sort((a,b)=>(S.inv[b]-S.inv[a]));
  for(const pid of sorted){ const [nm,em]=itemName(pid); const n=S.inv[pid];
    const canSell=!pid.startsWith('seed:')&&!pid.startsWith('baby');
    h+=`<div class="inv-card"><div class="se">${em}</div><div style="font-weight:800;font-size:12px">${nm}</div><div style="color:#e65100;font-weight:800">x${n}</div>${canSell?`<button class="pixel-btn small" onclick="sellOne('${pid}');openBag()">Bán ${sellPrice(pid)}🪙</button>`:pid.startsWith('seed:')?`<div style="font-size:11px">Ra ruộng gieo 🌱</div>`:`<div style="font-size:11px">Ra ao/chuồng dùng</div>`}</div>`;
  }
  h+=`</div><div style="margin-top:10px;display:flex;gap:8px"><button class="pixel-btn small" onclick="openShop('sell')">💰 Bán nhanh</button><button class="pixel-btn small gray" onclick="closeModal()">Đóng</button></div>`;
  openModal('🎒 KHO ĐỒ',h);
}
window.openBag=openBag;

function openQuest(){
  sfx.click();
  let h='';
  QUESTS.forEach((q,idx)=>{
    const done=idx<S.questIdx||q.check(S);
    h+=`<div class="quest-item ${done?'done':''}"><b>${done?'✅':'📌'} NV${idx+1}: ${q.text}</b><br><small>🎁 ${q.reward.xu?('+'+q.reward.xu+' xu '):''}${q.reward.gem?('+'+q.reward.gem+' 💎 '):''}${q.reward.xp?('+'+q.reward.xp+' XP'):''}</small></div>`;
  });
  openModal('📜 NHIỆM VỤ',h+`<button class="pixel-btn small gray" onclick="closeModal()">Đóng</button>`);
}
function checkQuest(){
  let changed=false;
  while(S.questIdx<QUESTS.length&&QUESTS[S.questIdx].check(S)){
    const q=QUESTS[S.questIdx];
    if(q.reward.xu)addXu(q.reward.xu); if(q.reward.gem)S.gem+=q.reward.gem; if(q.reward.xp)addXP(q.reward.xp);
    toast(`📜 Xong NV: ${q.text} 🎁`); sfx.lvup();
    S.questIdx++; changed=true;
  }
  if(changed){ save(); refreshHUD(); }
  const cur=QUESTS[Math.min(S.questIdx,QUESTS.length-1)];
  $('quest-text').textContent=cur?cur.text:'Hoàn thành tất cả! Bạn là tỷ phú nông trại 🏆';
}
function openHelp(){
  sfx.click();
  openModal('❓ HƯỚNG DẪN',`
  <div class="help-sec">🚶 <b>Di chuyển:</b> WASD / mũi tên / click vào bản đồ / joystick (mobile). Bấm <b>E</b> hoặc click nút E để tương tác.</div>
  <div class="help-sec">🌱 <b>Trồng cây:</b> Ra ruộng → <b>E: Cuốc đất</b> → <b>E: Gieo hạt</b> → <b>E: Tưới nước</b> (nước khô sau 45s, cây ngừng lớn) → đợi chín → <b>Thu hoạch</b> → bán ở 🏪.</div>
  <div class="help-sec">🐟 <b>Nuôi cá:</b> Mua <i>cá con</i> ở shop → ra ao <b>thả</b> → <b>cho ăn</b> (tốn Thức ăn) → lớn → thu hoạch. Ra <b>cầu ao</b> để <b>câu cá giải trí</b> (tốn mồi).</div>
  <div class="help-sec">🐔🐄🐷 <b>Chăn nuôi:</b> Mua gà/bò/heo → chúng đi loanh quanh chuồng → <b>cho ăn</b> khi đói → gà đẻ 🥚, bò cho 🥛, heo cho 🥩 → bấm E để thu.</div>
  <div class="help-sec">💤 <b>Ngủ:</b> Vào nhà bấm E để qua ngày mới (cây lớn thêm). <b>Ngày/đêm</b> tự chạy ~4 phút/ngày.</div>
  <div class="help-sec">💾 Game tự lưu. Muốn chơi mới: xóa save (F12 → localStorage) hoặc bấm nút dưới.<br><br><button class="pixel-btn small" onclick="if(confirm('Xóa hết chơi lại?')){localStorage.clear();location.reload()}">🗑 Chơi lại từ đầu</button></div>
  `);
}

// ---------- HUD ----------
function refreshHUD(){
  $('hud-xu').textContent=S.xu.toLocaleString('vi-VN');
  $('hud-gem').textContent=S.gem;
  $('hud-day').textContent='Ngày '+S.day;
  $('hud-name').textContent=S.name;
  $('hud-avatar').textContent=AVATARS[S.avatar]||'🧑‍🌾';
  $('hud-level').textContent='Lv '+S.level;
  const pct=Math.min(100,S.xp/xpNeed()*100);
  $('xp-fill').style.width=pct+'%';
  // clock icon
  const t=S.dayTime; let ic='☀️';
  if(t<0.05||t>0.92)ic='🌙'; else if(t>0.75)ic='🌇'; else if(t<0.2)ic='🌅';
  $('hud-clock').textContent=ic;
}
function renderQuick(){
  const box=$('quick-slots'); box.innerHTML='';
  const show=[
    ['seed:lua','🌰'],['feed','🌽'],['bait','🪱'],['lua','🌾'],['trung','🥚'],
  ];
  // đếm tổng hạt
  let seedTotal=0; for(const k in S.inv) if(k.startsWith('seed:')) seedTotal+=S.inv[k];
  const defs=[['🌰','Hạt',seedTotal],['🌽','T.ăn',S.inv.feed||0],['🪱','Mồi',S.inv.bait||0],['🧺','SP',Object.keys(S.inv).filter(k=>!k.startsWith('seed:')&&!k.startsWith('baby')&&k!=='feed'&&k!=='bait').reduce((a,k)=>a+S.inv[k],0)]];
  defs.forEach(([e,n,c])=>{
    const d=document.createElement('div'); d.className='qslot'; d.innerHTML=`<span class="qe">${e}</span><span class="qn">${c}</span>`;
    d.title=n; d.onclick=openBag; box.appendChild(d);
  });
}

// ---------- CANVAS RENDER ----------
const cv=$('game'), ctx=cv.getContext('2d');
ctx.imageSmoothingEnabled=false;
let cam={x:0,y:0};
const DPR_CAP=1;

function resize(){
  const r=$('canvas-wrap').getBoundingClientRect();
  const scale=Math.min((r.width-8)/960,(r.height-8)/600);
  cv.style.width=(960*scale)+'px'; cv.style.height=(600*scale)+'px';
}
window.addEventListener('resize',resize);

function px(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x|0,y|0,w,h); }
function txt(s,x,y,size=12,color='#fff',stroke='#000'){
  ctx.font=`bold ${size}px 'Be Vietnam Pro',monospace`;
  ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle=stroke;
  ctx.strokeText(s,x,y); ctx.fillStyle=color; ctx.fillText(s,x,y);
}

function drawGround(t){
  // cỏ caro
  for(let gx=0;gx<WORLD.w;gx+=TILE)for(let gy=0;gy<WORLD.h;gy+=TILE){
    const odd=((gx+gy)/TILE)%2===0;
    ctx.fillStyle=odd?'#7ec850':'#76c048';
    ctx.fillRect(gx-cam.x,gy-cam.y,TILE,TILE);
  }
  // đường đất giữa map
  ctx.fillStyle='#d7b56d';
  ctx.fillRect(0-cam.x,690-cam.y,WORLD.w,70);
  ctx.fillStyle='#c49a52';
  for(let x=0;x<WORLD.w;x+=40) ctx.fillRect(x-cam.x,720-cam.y,20,8);
  ctx.fillStyle='#d7b56d';
  ctx.fillRect(660-cam.x,0,70,WORLD.h);
  // hoa cỏ trang trí
  for(let i=0;i<40;i++){
    const fx=(i*211)%WORLD.w, fy=(i*349)%WORLD.h;
    if(fx>100&&fx<600&&fy>280&&fy<660) continue;
    ctx.fillStyle='#fff'; ctx.fillRect(fx-cam.x,fy-cam.y,4,4);
    ctx.fillStyle=['#ff5252','#ffeb3b','#e1bee7'][i%3]; ctx.fillRect(fx+1-cam.x,fy-4-cam.y,2,5);
  }
}
function drawLabel(s,x,y){ txt(s,x-cam.x,y-cam.y,13,'#fff'); }
function drawFarmSigns(){
  drawLabel('🌾 RUỘNG',FARM.x+FARM.w/2,FARM.y-12);
  drawLabel('🐟 AO CÁ  •  ra cầu để CÂU',POND.x+POND.w/2,POND.y-12);
  drawLabel('🐔 CHUỒNG GÀ',COOP.x+COOP.w/2,COOP.y-12);
  drawLabel('🐄🐷 TRẠI BÒ – HEO',BARN.x+BARN.w/2,BARN.y-12);
  drawLabel('🏠 NHÀ (ngủ)   🏪 SHOP',HOUSE.x+HOUSE.w/2-40,HOUSE.y-12);
}
function drawFences(){
  ctx.fillStyle='#8b5a2b';
  // quanh farm
  const f=(x,y,w,h)=>ctx.fillRect(x-cam.x,y-cam.y,w,h);
  for(let x=FARM.x-10;x<FARM.x+FARM.w+10;x+=32){ f(x,FARM.y-14,24,8); f(x,FARM.y+FARM.h+6,24,8); }
  for(let y=FARM.y;y<FARM.y+FARM.h;y+=32){ f(FARM.x-14,y,8,24); f(FARM.x+FARM.w+6,y,8,24); }
  for(let x=COOP.x-10;x<COOP.x+COOP.w+10;x+=32){ f(x,COOP.y-14,24,8); }
  for(let x=BARN.x-10;x<BARN.x+BARN.w+10;x+=32){ f(x,BARN.y-14,24,8); }
}
function drawPlots(t){
  for(let i=0;i<S.plots.length;i++){
    const pp=plotPos(i), pl=S.plots[i];
    const X=pp.x-cam.x, Y=pp.y-cam.y;
    ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fillRect(X-pp.w/2+3,Y-pp.h/2+5,pp.w,pp.h);
    if(pl.state==='grass'){
      ctx.fillStyle='#5da93c'; ctx.fillRect(X-pp.w/2,Y-pp.h/2,pp.w,pp.h);
      ctx.fillStyle='#6fbf4a';
      for(let g=0;g<8;g++) ctx.fillRect(X-pp.w/2+6+g*13,Y-pp.h/2+8+((g*29)%(pp.h-16)),4,10);
    } else {
      ctx.fillStyle=pl.watered?'#5a3a1e':'#7a5230'; ctx.fillRect(X-pp.w/2,Y-pp.h/2,pp.w,pp.h);
      ctx.fillStyle=pl.watered?'#4a2f16':'#6a4526';
      for(let r=0;r<3;r++) for(let c=0;c<5;c++) ctx.fillRect(X-pp.w/2+8+c*22,Y-pp.h/2+8+r*20,12,6);
      if(pl.state==='growing'||pl.state==='ready'){
        const c=CROPS[pl.crop];
        const cx=X, cy=Y+10;
        if(pl.progress<0.33){
          ctx.fillStyle='#2e7d32'; ctx.fillRect(cx-3,cy-12,6,12);
          ctx.fillRect(cx-8,cy-8,5,5); ctx.fillRect(cx+3,cy-10,5,5);
        } else if(pl.progress<0.7){
          ctx.fillStyle='#2e7d32'; ctx.fillRect(cx-4,cy-26,8,26);
          ctx.fillStyle='#388e3c'; ctx.fillRect(cx-12,cy-20,8,8); ctx.fillRect(cx+4,cy-24,8,8);
          ctx.fillStyle='#66bb6a'; ctx.fillRect(cx-6,cy-30,12,6);
        } else {
          // cây trưởng thành + quả
          ctx.fillStyle='#1b5e20'; ctx.fillRect(cx-5,cy-34,10,34);
          ctx.fillStyle='#2e7d32'; ctx.fillRect(cx-14,cy-26,10,10); ctx.fillRect(cx+4,cy-28,10,10);
          ctx.font='26px serif'; ctx.textAlign='center';
          ctx.fillText(c.emoji,cx,cy-26);
          if(pl.state==='ready'){
            const b=Math.sin(t*4+i)*3;
            ctx.font='18px serif'; ctx.fillText('✨',cx-20,cy-34+b); ctx.fillText('✨',cx+20,cy-34-b);
          }
        }
        // thanh tiến trình
        ctx.fillStyle='#000'; ctx.fillRect(X-30,Y+pp.h/2-24,60,8);
        ctx.fillStyle=pl.state==='ready'?'#ffeb3b':'#76ff03'; ctx.fillRect(X-29,Y+pp.h/2-23,58*Math.min(1,pl.progress),6);
        if(!pl.watered&&pl.state==='growing'){ ctx.font='16px serif'; ctx.fillText('💧',X+34,Y-pp.h/2+6); }
      } else {
        ctx.font='15px serif'; ctx.textAlign='center'; ctx.fillText('🕳️',X,Y+6);
      }
    }
    // số ô
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.font='bold 10px monospace'; ctx.textAlign='left';
    ctx.fillText(i+1,X-pp.w/2+3,Y-pp.h/2+11);
  }
}
function drawPond(t){
  const X=POND.x-cam.x,Y=POND.y-cam.y;
  ctx.fillStyle='#c9a86a'; ctx.fillRect(X-10,Y-10,POND.w+20,POND.h+20);
  const g=ctx.createLinearGradient(0,Y,0,Y+POND.h);
  g.addColorStop(0,'#4fc3f7'); g.addColorStop(1,'#0277bd');
  ctx.fillStyle=g; ctx.fillRect(X,Y,POND.w,POND.h);
  // sóng
  ctx.fillStyle='rgba(255,255,255,.5)';
  for(let i=0;i<8;i++){ const wx=X+20+((i*173+t*40)%(POND.w-40)); const wy=Y+20+((i*97)%(POND.h-40)); ctx.fillRect(wx,wy,26,3); }
  // ngăn lưới
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.setLineDash([6,4]);
  ctx.beginPath(); ctx.moveTo(X+POND.w/2,Y); ctx.lineTo(X+POND.w/2,Y+POND.h); ctx.moveTo(X,Y+POND.h/2); ctx.lineTo(X+POND.w,Y+POND.h/2); ctx.stroke(); ctx.setLineDash([]);
  // cá trong ngăn
  for(let i=0;i<S.fishes.length;i++){
    const p=pondSlotPos(i), f=S.fishes[i];
    const sx=p.x-cam.x, sy=p.y-cam.y;
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(sx-34,sy-24,68,52);
    ctx.fillStyle='#e1f5fe'; ctx.font='11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#01579b';
    ctx.fillText('Ngăn '+(i+1),sx,sy-28);
    if(!f){ ctx.font='22px serif'; ctx.fillText('➕',sx,sy+8); }
    else{
      const F=FISHES[f.type];
      const jx=Math.sin(t*2+i)*8, jy=Math.cos(t*2.4+i)*5;
      ctx.font=(f.grown?'34px':'24px')+' serif';
      // lật cá theo hướng bơi
      ctx.save(); ctx.translate(sx+jx,sy+jy); if(Math.cos(t+i)>0)ctx.scale(-1,1);
      ctx.fillText(F.emoji,0,8); ctx.restore();
      if(!f.grown){ ctx.fillStyle='#000'; ctx.fillRect(sx-24,sy+18,48,6); ctx.fillStyle='#76ff03'; const pr=Math.min(1,f.age/F.grow); ctx.fillRect(sx-23,sy+19,46*pr,4); }
      else { ctx.font='16px serif'; ctx.fillText('❗',sx+18,sy-8+Math.sin(t*5)*3); }
    }
  }
  // cầu câu + phao
  const bx=POND.x+POND.w/2-cam.x, by=POND.y+POND.h-cam.y;
  ctx.fillStyle='#8b5a2b'; ctx.fillRect(bx-40,by,80,26);
  ctx.fillStyle='#a06a35'; for(let i=0;i<4;i++)ctx.fillRect(bx-40+i*20,by,4,26);
  drawLabel('🎣 CẦU CÂU',POND.x+POND.w/2,POND.y+POND.h+66);
}
function drawHouseShop(){
  // SHOP
  let X=SHOPD.x-cam.x,Y=SHOPD.y-cam.y;
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(X+4,Y+6,SHOPD.w,SHOPD.h);
  ctx.fillStyle='#ff7043'; ctx.fillRect(X,Y,SHOPD.w,SHOPD.h);
  ctx.fillStyle='#d84315'; ctx.fillRect(X,Y,SHOPD.w,22);
  ctx.fillStyle='#fff'; ctx.fillRect(X+20,Y+40,SHOPD.w-40,60);
  ctx.font='34px serif'; ctx.textAlign='center'; ctx.fillText('🏪',X+SHOPD.w/2,Y+82);
  txt('SHOP',X+SHOPD.w/2,Y+122,14,'#fff');
  // NHÀ
  X=HOUSE.x-cam.x; Y=HOUSE.y-cam.y;
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(X+5,Y+8,HOUSE.w,HOUSE.h);
  ctx.fillStyle='#ffe0b2'; ctx.fillRect(X+30,Y+80,HOUSE.w-60,HOUSE.h-80);
  ctx.fillStyle='#e53935';
  ctx.beginPath(); ctx.moveTo(X,Y+90); ctx.lineTo(X+HOUSE.w/2,Y+10); ctx.lineTo(X+HOUSE.w,Y+90); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#6d4c41'; ctx.fillRect(X+HOUSE.w/2-22,Y+HOUSE.h-70,44,70);
  ctx.fillStyle='#80d8ff'; ctx.fillRect(X+50,Y+110,50,50); ctx.fillRect(X+HOUSE.w-100,Y+110,50,50);
  ctx.font='30px serif'; ctx.fillText('🏠',X+HOUSE.w/2,Y+70);
  txt('NHÀ CỦA BẠN (E: ngủ)',X+HOUSE.w/2,Y+HOUSE.h+22,13,'#fff');
  // khói ống khói
  const t=performance.now()/1000;
  ctx.fillStyle='rgba(255,255,255,.7)';
  for(let i=0;i<3;i++){ const sy=Y-10-((t*20+i*20)%60); ctx.globalAlpha=1-(Y-10-sy)/70; ctx.beginPath(); ctx.arc(X+HOUSE.w-70,sy,8+i*2,0,7); ctx.fill(); }
  ctx.globalAlpha=1;
  // cây trang trí
  drawTree(950-cam.x,180-cam.y,1.2,t);
  drawTree(150-cam.x,150-cam.y,1,t+2);
  drawTree(1500-cam.x,700-cam.y,1.3,t+1);
  drawTree(480-cam.x,1150-cam.y,1,t+3);
}
function drawTree(x,y,s,t){
  ctx.fillStyle='#5d4037'; ctx.fillRect(x-6*s,y-10*s,12*s,44*s);
  ctx.fillStyle='#2e7d32';
  const sway=Math.sin(t)*2;
  ctx.beginPath(); ctx.arc(x+sway,y-30*s,30*s,0,7); ctx.fill();
  ctx.fillStyle='#388e3c'; ctx.beginPath(); ctx.arc(x-12*s+sway,y-40*s,18*s,0,7); ctx.fill();
  ctx.fillStyle='#ff5252'; ctx.fillRect(x-14*s,y-38*s,6,6); ctx.fillRect(x+8*s,y-30*s,6,6);
}
function drawCoops(t){
  // chuồng gà
  let X=COOP.x-cam.x,Y=COOP.y-cam.y;
  ctx.fillStyle='#a1887f'; ctx.fillRect(X,Y,COOP.w,COOP.h);
  ctx.fillStyle='#8d6e63'; for(let i=0;i<5;i++)ctx.fillRect(X+10+i*80,Y+10,60,20);
  ctx.font='34px serif'; ctx.textAlign='center'; ctx.fillText('🏚️',X+COOP.w/2,Y+70);
  // trại bò
  X=BARN.x-cam.x; Y=BARN.y-cam.y;
  ctx.fillStyle='#bcaaa4'; ctx.fillRect(X,Y,BARN.w,BARN.h);
  ctx.fillStyle='#8d6e63'; ctx.fillRect(X+10,Y+10,BARN.w-20,26);
  ctx.font='40px serif'; ctx.fillText('🚜',X+BARN.w/2,Y+76);
  // máng ăn
  ctx.fillStyle='#5d4037'; ctx.fillRect(X+30,Y+BARN.h-50,120,24); ctx.fillRect(COOP.x-cam.x+30,Y-0+0,0,0);
}
function drawAnimals(t){
  S.animals.forEach((a,idx)=>{
    const p=animalPos(a,idx,t);
    const X=p.x-cam.x,Y=p.y-cam.y;
    const A=ANIMALS[a.type];
    const adult=(Date.now()-a.bornAt)/1000>=A.grow;
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(X,Y+16,18,7,0,0,7); ctx.fill();
    const s=adult?1:0.65;
    ctx.font=(30*s)+'px serif'; ctx.textAlign='center';
    // hướng theo di chuyển
    ctx.save(); ctx.translate(X,Y); if(Math.sin(t*0.5+a.uid)>0)ctx.scale(-1,1);
    ctx.fillText(A.emoji,0,8); ctx.restore();
    // thanh đói
    ctx.fillStyle='#000'; ctx.fillRect(X-20,Y-34,40,7);
    ctx.fillStyle=a.hunger>50?'#76ff03':a.hunger>25?'#ffeb3b':'#ff1744';
    ctx.fillRect(X-19,Y-33,38*(a.hunger/100),5);
    if(!adult){ txt('baby',X,Y-38,10,'#fff'); }
    else if(a.ready){ ctx.font='18px serif'; ctx.fillText('❗',X+20,Y-20+Math.sin(t*5)*3); }
    else if(a.hunger<40){ ctx.font='15px serif'; ctx.fillText('🍽️',X+20,Y-20); }
  });
}
function drawPlayer(t){
  const X=player.x-cam.x,Y=player.y-cam.y;
  ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(X,Y+20,14,6,0,0,7); ctx.fill();
  const bob=player.moving?Math.sin(t*12)*2:Math.sin(t*2)*1;
  const shirt=SHIRTS[S.avatar%SHIRTS.length];
  ctx.save(); ctx.translate(X,Y+bob);
  if(player.dir<0)ctx.scale(-1,1);
  // chân
  const step=player.moving?Math.sin(t*12)*4:0;
  ctx.fillStyle='#4e342e'; ctx.fillRect(-9,10+step,7,10); ctx.fillRect(2,10-step,7,10);
  // thân
  ctx.fillStyle=shirt; ctx.fillRect(-11,-8,22,20);
  ctx.fillStyle='rgba(255,255,255,.3)'; ctx.fillRect(-11,-8,22,4);
  // tay
  ctx.fillStyle='#ffcc9e'; ctx.fillRect(-16,-4+step,5,12); ctx.fillRect(11,-4-step,5,12);
  // đầu
  ctx.fillStyle='#ffcc9e'; ctx.fillRect(-9,-26,18,18);
  ctx.fillStyle='#000'; ctx.fillRect(0,-20,3,3); // mắt
  // tóc / mũ rơm
  ctx.fillStyle='#ffca28'; ctx.fillRect(-13,-30,26,7);
  ctx.fillStyle='#ffb300'; ctx.fillRect(-17,-25,34,4);
  // cuốc sau lưng
  ctx.fillStyle='#6d4c41'; ctx.fillRect(-16,-14,4,26);
  ctx.fillStyle='#9e9e9e'; ctx.fillRect(-22,-20,10,6);
  ctx.restore();
  txt(S.name,X,Y-36,12,'#fff');
  // mũi tên target click-to-move
  if(player.tx!=null){ ctx.fillStyle='#ffeb3b'; ctx.beginPath(); ctx.arc(player.tx-cam.x,player.ty-cam.y,6+Math.sin(t*8)*2,0,7); ctx.fill(); }
}
function drawNight(){
  const t=S.dayTime;
  // 0..1 : 0 nửa đêm, 0.3 sáng, 0.5 trưa, 0.8 tối
  let dark=0;
  if(t<0.2) dark=0.55-(t/0.2)*0.45;
  else if(t<0.3) dark=0.1;
  else if(t<0.7) dark=0;
  else if(t<0.85) dark=(t-0.7)/0.15*0.35;
  else dark=0.35+(t-0.85)/0.15*0.25;
  if(dark>0.02){ ctx.fillStyle=`rgba(10,10,60,${dark})`; ctx.fillRect(0,0,cv.width,cv.height); }
  // mặt trời / mặt trăng
  const sx=cv.width-80, sy=60+Math.sin(t*Math.PI*2)*0;
  ctx.font='30px serif'; ctx.fillText(t>0.2&&t<0.78?'☀️':'🌙',sx,sy);
}

// ---------- GAME LOOP ----------
let lastT=performance.now();
function loop(now){
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  const t=now/1000;
  update(dt,t);
  render(t);
  requestAnimationFrame(loop);
}
function update(dt,t){
  // di chuyển
  let mx=0,my=0;
  if(keys['arrowup']||keys['w'])my-=1; if(keys['arrowdown']||keys['s'])my+=1;
  if(keys['arrowleft']||keys['a'])mx-=1; if(keys['arrowright']||keys['d'])mx+=1;
  mx+=joy.x; my+=joy.y;
  if(mx||my){
    player.tx=null;
    const l=Math.hypot(mx,my)||1; mx/=l; my/=l;
    const nx=player.x+mx*player.speed*dt, ny=player.y+my*player.speed*dt;
    if(!isBlocked(nx,player.y))player.x=nx;
    if(!isBlocked(player.x,ny))player.y=ny;
    player.moving=true; if(mx!==0)player.dir=mx>0?1:-1;
  } else if(player.tx!=null){
    const dx=player.tx-player.x, dy=player.ty-player.y, d=Math.hypot(dx,dy);
    if(d<8){ player.tx=null; player.moving=false; }
    else{ const nx=player.x+dx/d*player.speed*dt, ny=player.y+dy/d*player.speed*dt;
      if(!isBlocked(nx,player.y))player.x=nx; if(!isBlocked(player.x,ny))player.y=ny;
      player.moving=true; player.dir=dx>0?1:-1; }
  } else player.moving=false;
  player.frame+=dt*10;
  // camera
  cam.x=Math.max(0,Math.min(WORLD.w-960,player.x-480));
  cam.y=Math.max(0,Math.min(WORLD.h-600,player.y-300));
  // ngày
  S.dayTime+=dt/240; // 4 phút 1 ngày
  if(S.dayTime>=1){ S.dayTime=0; S.day++; toast('📅 Ngày mới: ngày '+S.day); }
  // cây lớn
  for(const pl of S.plots){
    if(pl.state==='growing'){
      if(pl.watered){ pl.waterLeft-=dt; if(pl.waterLeft<=0){pl.watered=false;} }
      if(pl.watered){
        const c=CROPS[pl.crop];
        pl.progress+=dt/c.grow;
        if(pl.progress>=1){ pl.progress=1; pl.state='ready'; sfx.harvest(); toast(`✅ ${c.name} đã chín! Ra thu hoạch 🌱`); }
      }
    }
  }
  // cá lớn
  for(const f of S.fishes){
    if(!f||f.grown)continue;
    const F=FISHES[f.type];
    f.hunger=Math.max(0,f.hunger-dt*3);
    if(f.hunger>20){ f.age+=dt; if(f.age>=F.grow){f.grown=true; toast(`🐟 ${F.name} đã lớn!`); sfx.catch_();} }
  }
  // vật nuôi
  for(const a of S.animals){
    const A=ANIMALS[a.type];
    a.hunger=Math.max(0,a.hunger-dt*2.2);
    const adult=(Date.now()-a.bornAt)/1000>=A.grow;
    if(adult&&a.hunger>30&&!a.ready){ a.productT+=dt; if(a.productT>=A.cycle){a.ready=true; toast(`${A.emoji} ${A.name} có ${A.product} rồi!`);} }
  }
  // interact hint
  const near=nearestInteract();
  if(near){ $('interact-hint').classList.remove('hidden'); $('interact-text').textContent=near.label; }
  else $('interact-hint').classList.add('hidden');
  // fishing needle
  if(fishGame){
    fishGame.pos+=fishGame.dir*fishGame.speed*dt;
    if(fishGame.pos>1){fishGame.pos=1;fishGame.dir=-1;} if(fishGame.pos<0){fishGame.pos=0;fishGame.dir=1;}
    $('fish-needle').style.left=(fishGame.pos*100)+'%';
  }
}
function render(t){
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save();
  ctx.fillStyle='#7ec850'; ctx.fillRect(0,0,cv.width,cv.height);
  drawGround(t);
  drawFences();
  // vẽ theo thứ tự Y
  drawCoops(t);
  drawHouseShop();
  drawFarmSigns();
  drawPlots(t);
  drawPond(t);
  drawAnimals(t);
  drawPlayer(t);
  ctx.restore();
  drawNight();
}

// ---------- INPUT ----------
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(); keys[k]=true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(k==='e'||k===' '){ if(!$('game-screen').classList.contains('hidden')&&$('modal-bg').classList.contains('hidden')&&$('fish-minigame').classList.contains('hidden')) doInteract(); }
  if(k==='s')openShop('seed'); if(k==='b')openBag(); if(k==='q')openQuest(); if(k==='h')openHelp();
  if(k==='escape'){ closeModal(); closeFishing(); }
});
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
// click to move + interact nếu click gần
cv.addEventListener('pointerdown',e=>{
  const r=cv.getBoundingClientRect();
  const sx=(e.clientX-r.left)/r.width*960, sy=(e.clientY-r.top)/r.height*600;
  const wx=sx+cam.x, wy=sy+cam.y;
  // nếu click gần interactable thì đi tới + làm luôn? đơn giản: set target, nếu đã gần thì interact
  const near=nearestInteract();
  player.tx=Math.max(20,Math.min(WORLD.w-20,wx)); player.ty=Math.max(60,Math.min(WORLD.h-20,wy));
  // double-click / click vào ô thì interact ngay nếu đủ gần sau 1 tick? kiểm tra khoảng cách click
  // nếu click trúng plot/pond/animal trong 60px -> interact luôn
  let best=null,bd=70;
  for(let i=0;i<S.plots.length;i++){const p=plotPos(i);const d=Math.hypot(wx-p.x,wy-p.y);if(d<bd){best={kind:'plot',i};bd=d;}}
  for(let i=0;i<S.fishes.length;i++){const p=pondSlotPos(i);const d=Math.hypot(wx-p.x,wy-p.y);if(d<70){best={kind:'pond',i};bd=999;}}
  if(best){ const pp=best.kind==='plot'?plotPos(best.i):pondSlotPos(best.i);
    if(Math.hypot(player.x-pp.x,player.y-pp.y)<130) doInteract(best); }
});
// joystick
const joy={x:0,y:0}; let joyId=null;
const joyEl=$('joystick'), knob=$('joy-knob');
function joyPos(e){ const r=joyEl.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; let dx=(e.clientX-cx)/(r.width/2), dy=(e.clientY-cy)/(r.height/2); const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l;} joy.x=dx; joy.y=dy; knob.style.transform=`translate(calc(-50% + ${dx*30}px),calc(-50% + ${dy*30}px))`; }
joyEl.addEventListener('pointerdown',e=>{joyId=e.pointerId;joyEl.setPointerCapture(joyId);joyPos(e);});
joyEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyPos(e);});
['pointerup','pointercancel'].forEach(ev=>joyEl.addEventListener(ev,()=>{joyId=null;joy.x=0;joy.y=0;knob.style.transform='translate(-50%,-50%)';}));

// ---------- UI WIRING ----------
document.querySelectorAll('.avatar-opt').forEach(b=>b.onclick=()=>{document.querySelectorAll('.avatar-opt').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');sfx.click();});
$('btn-start').onclick=()=>{
  const name=($('player-name').value||'NôngDân').trim().slice(0,12)||'NôngDân';
  const av=document.querySelector('.avatar-opt.selected');
  S=defaultState(); S.name=name; S.avatar=+(av?av.dataset.avatar:0);
  // tặng khởi đầu
  S.inv={'seed:lua':4,feed:4,bait:4};
  player.x=700;player.y=600;
  startGame(); save();
  toast('🌱 Chào mừng '+S.name+'! Ra ruộng cuốc đất nào!');
};
$('btn-continue').onclick=()=>{ startGame(); };
function startGame(){
  $('menu-screen').classList.add('hidden'); $('game-screen').classList.remove('hidden');
  resize(); refreshHUD(); renderQuick(); checkQuest();
  requestAnimationFrame(loop);
}
$('btn-shop').onclick=()=>openShop('seed');
$('btn-bag').onclick=openBag;
$('btn-quest').onclick=openQuest;
$('btn-help').onclick=openHelp;
$('btn-sound').onclick=e=>{ soundOn=!soundOn; e.target.textContent=soundOn?'🔊':'🔇'; };
$('modal-close').onclick=closeModal;
$('modal-bg').addEventListener('click',e=>{ if(e.target.id==='modal-bg')closeModal(); });
$('mbtn-act').onclick=()=>doInteract();
$('mbtn-shop').onclick=()=>openShop('seed');
$('fish-catch').onclick=tryCatch;
$('fish-cancel').onclick=closeFishing;
setInterval(()=>{ if(!$('game-screen').classList.contains('hidden')){save();} },10000);
setInterval(()=>{ if(!$('game-screen').classList.contains('hidden'))refreshHUD(); },1000);

// ---------- BOOT ----------
if(load()&&S.name){ $('btn-continue').classList.remove('hidden'); $('btn-continue').textContent=`↻ CHƠI TIẾP (${S.name} - Ngày ${S.day})`;
  // chọn avatar cũ
  document.querySelectorAll('.avatar-opt').forEach(x=>x.classList.toggle('selected',+x.dataset.avatar===S.avatar));
  $('player-name').value=S.name;
}
resize();
