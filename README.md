# 🌾 Nông Trại Pixel — Game nông trại kiểu

Game nông trại pixel-art chạy trên web: **trồng cây • nuôi cá • chăn nuôi • câu cá mini-game • làng multiplayer** —
Đi dạo quanh làng, cuốc đất, gieo hạt, tưới nước,
cho gà/bò/heo ăn, thả cá, câu cá giải trí, bán nông sản lên đời, rồi rủ bạn bè vào làng
chơi chung, chat và qua **thăm farm nhau**.

## ✨ Tính năng

### 🌱 Trồng trọt (max level 100)
- **45 ô ruộng** (9×5), khởi đầu 6 ô — bấm E vào ô 🔒 để mở bằng xu + cấp (ô sau đắt hơn, ô 45 cần ~Lv31)
- **15 loại cây** từ Lv1 (Lúa) đến Lv95 (Nhân sâm): cải xanh, khoai tây, dưa leo, cà tím, dâu, nho, cà phê, nấm linh chi...
- Vòng đời đầy đủ: cuốc đất → gieo hạt → tưới nước (đất khô sau 45s, cây ngừng lớn) → chín → thu hoạch
- **Sâu bệnh:** cây đang lớn có thể bị sâu ngẫu nhiên (ngừng lớn, thanh đỏ, có sâu bò trên cây) — mua **thuốc trừ sâu** ở shop (tab Thức ăn, 20 xu) rồi bấm E vào cây để phun

### 🐟 Ao cá vuông tự nhiên + 🎣 sông câu cá
- Ao **hình vuông, không chia ngăn**, cá bơi tự do khắp hồ — khởi đầu nuôi 3 con, mở rộng tối đa **15** bằng xu + cấp
- Bấm E vào **hòm thư 📮** trước ao để xem đàn cá, cho ăn/thu hoạch từng con, mở thêm chỗ nuôi
- **8 loại cá** từ Lv1 (Rô) đến Lv50 (Cá mập): chép, tôm, cua, lóc, Koi, bạch tuộc...
- **Sông câu cá** cuối map với 3 bến gỗ: nhân vật **ngồi câu thật** (cần + phao + gợn sóng), thấy ❗ thì bấm E giật ngay — chậm là cá chạy! Không câu ở ao nuôi
- 2 loại mồi: thường (cá rẻ dễ dính) và mồi ngon 🔒Lv10 (cá hiếm x5, ít dính rác như ủng cũ 🥾)

### 🐔🦆🐄🐷🐑 Chăn nuôi
- Gà đẻ trứng, Vịt đẻ trứng vịt, Bò cho sữa, Heo cho thịt, Cừu cho len — có giai đoạn con non → trưởng thành
- Mỗi chuồng khởi đầu **3 chỗ**, nới ở shop hoặc **hòm thư 📮** trước chuồng (xem + cho ăn + thu + mở thêm chỗ): gà 30, vịt 15, bò/heo 20, cừu 12
- Thanh đói real-time + 2 loại cám: cám thường và cám cao cấp 🔒Lv8 (no căng + tăng tốc ra sản phẩm)

### 💰 Kinh tế & tiến trình
- Xu / Gem / Level-XP (max 100), cửa hàng 5 tab (nằm ở bãi đất gần bờ sông) kèm thẻ mở rộng ruộng/ao/chuồng
- Canvas phủ kín màn hình (không letterbox): khung nhìn cao cố định, rộng nới theo màn hình, camera luôn bám theo nhân vật; ra bờ sông tự zoom nhẹ để thấy sông + phao rõ hơn
- 10 nhiệm vụ tân thủ có thưởng, ngày/đêm tự chạy ~4 phút/ngày
- Âm thanh WebAudio tự tổng hợp (không cần file nhạc), toàn bộ farm lưu DB theo username

### 🛖 Multiplayer kiểu Avatar
- **Làng chung:** thấy nhau đi lại cùng map, tên + bóng chat 5s trên đầu (phím `V`)
- **Chat làng:** panel chat + bóng thoại trong canvas
- **Mã farm 6 ký tự + link mời `?visit=MÃ`** cho mỗi người
- **Thăm farm chỉ-xem:** thấy ruộng/ao/chuồng của bạn, đi dạo + chat, không phá được
- **Cloud save:** snapshot farm tự đẩy mỗi 10s — thăm được cả khi chủ offline

### 🎰 Casino công viên (multiplayer, cược xu 10-100/ván)
- **Vị trí:** nhà Casino neon tím-vàng phía đông-bắc công viên (dưới shop lưu niệm) — lại gần bấm `E` hoặc nút 🎰 Casino trên HUD
- **3 game:** Tiến lên (2-4 người, 13 lá, nhất ăn tất) • Bài cào (2-4 người, 3 lá, nhiều nút thắng) • Caro (2 người, 12×12, 5 liên tiếp)
- **Phòng:** tạo phòng theo game + mức cược, mã phòng 4 ký tự, chủ phòng bắt đầu, có thể thêm 🤖 máy, ván mới sau khi xong
- **Mạng:** LAN server làm trọng tài (nhiều máy cùng WiFi) • 2 tab cùng máy qua BroadcastChannel • 1 mình chơi với máy
- **Xu:** trừ cược khi ván bắt đầu, thắng nhận pot = cược × số người (hòa chia đều, caro hòa hoàn cược)

## 🧱 Stack

| Lớp | Công nghệ | Vì sao |
|---|---|---|
| Framework | **React 18 + Vite 5 + TypeScript** | component hóa, type-safe, HMR, build nhanh |
| State game | **Zustand + persist** | 1 store duy nhất, auto-save localStorage |
| State mạng | **Zustand (useVillage)** | presence/chat/visit tách khỏi state game |
| UI | **TailwindCSS + Framer Motion + Lucide** | utility-first, animation mượt, icon chuẩn |
| Backend | **Supabase** (Postgres + Realtime) **hoặc LAN server** (Express + Socket.io + JSON DB) | không cần server riêng khi dùng Supabase; LAN thì 1 lệnh `npm run lan` |
| Game loop | **Canvas 2D custom engine** | 60fps pixel-art, tách khỏi React render |
| Fallback local | **BroadcastChannel + localStorage** | mở 2 tab là chơi chung được, không cần mạng |

> 📜 Bản vanilla JS (HTML + 1 file `main.js`, không build-step) vẫn được giữ trong
> `legacy-vanilla/` để tham khảo/đối chiếu.

## 📁 Kiến trúc

```
src/
  App.tsx                  # composition root + xử lý link mời ?visit=MÃ
  main.tsx
  index.css                # tailwind + pixel design-system
  game/                    # logic game thuần (không biết gì về mạng/UI)
    types.ts               # Plot, PondFish, Animal, Quest, ModalKind...
    data.ts                # balance: CROPS / FISHES / ANIMALS / QUESTS
    store.ts               # useGame: state + mọi action + tick + quest
    world.ts               # layout map (FARM 45 ô / POND ellipse / RIVER + bến / COOP / BARN / SHOP)
    systems.ts             # interact system (đối tượng gần nhất)
    render.ts              # pixel renderer + vẽ người chơi khác + bóng chat
    audio.ts               # WebAudio SFX
  net/                     # lớp mạng, nói chuyện qua interface NetTransport
    transport.ts           # RemotePlayer / ChatMsg / FarmSnapshot / FarmPayload / NetTransport
    session.ts             # id máy + username + mã farm từ username (deterministic)
    account.ts             # account theo username: load/save full farm + autosync
    local.ts               # LocalTransport (BroadcastChannel, multi-tab)
    socket.ts              # SocketTransport (LAN server, tự phát hiện qua /api/health)
    supabase.ts            # SupabaseTransport (Realtime + bảng farms)
    village.ts             # useVillage: players/chat/visiting/cloud/demo-bots
  components/
    MenuScreen.tsx HUD.tsx GameCanvas.tsx BottomBar.tsx
    ModalHost.tsx ShopModal.tsx BagModal.tsx SeedModal.tsx StockModal.tsx BaitModal.tsx
    PenModal.tsx QuestModal.tsx HelpModal.tsx Toasts.tsx
    VillageModal.tsx VisitBanner.tsx
server/
  index.js                 # LAN server: serve dist + Socket.io + JSON DB (server/data/db.json)
supabase/migrations/001_farm.sql  # schema profiles + farms + RLS demo (chỉ cần cho cloud Supabase)
legacy-vanilla/           # bản vanilla JS cũ
```

**Luồng dữ liệu:**
- Game: `GameCanvas (input + rAF) → store.tick(dt) → render.ts vẽ → HUD/modal re-render theo zustand`
- Mạng: `GameCanvas push vị trí (8/s) + snapshot farm (10s) → transport → useVillage → render vẽ người khác`

## 🚀 Chạy

```bash
npm install
npm run dev      # http://localhost:5173 (dev 1 mình / multi-tab)
npm run lan      # build + LAN server cho cả mạng cùng chơi (DB local)
npm run server   # chỉ chạy server với bản build có sẵn trong dist/
npm run build    # production → dist/
npm run preview
```

### 🎮 Điều khiển

| Phím | Tác dụng |
|---|---|
| WASD / mũi tên / click bản đồ / joystick | Di chuyển |
| `E` / Space | Tương tác với ô gần nhất (khi đang câu: giật cần / thu cần) |
| `B` / `Q` / `H` / `V` | Kho / Nhiệm vụ / Trợ giúp / Làng (không dùng `S` vì trùng phím đi xuống) |
| `Esc` | Đóng modal / thu cần câu |

### 🆔 Tài khoản username — toàn bộ farm trong DB

Mỗi **username là 1 tài khoản**, lưu TOÀN BỘ farm (xu, ruộng, cá, vật nuôi, ngày, nhiệm vụ...):

- Lần đầu nhập tên mới → tạo farm mới
- Reload trang, mở tab khác, đổi máy (cùng LAN server) → nhập **đúng username** là lấy lại nguyên farm
- Farm tự sync lên DB mỗi 10s + khi ẩn tab/tắt trang
- Mã farm 6 ký tự suy ra từ username (client/server cùng thuật toán) → cùng username là cùng mã trên mọi máy, link mời `?visit=MÃ` luôn đúng

| Backend login | Farm lưu ở đâu | Lấy lại khi nào |
|---|---|---|
| 🌐 LAN server (`npm run lan`) | `server/data/db.json` — chung cả mạng | mọi máy cùng mạng |
| 📡 Không có server | localStorage tách theo từng username | reload + tab khác cùng trình duyệt |

> ⚠️ Username chính là chủ farm — ai nhập đúng username của bạn sẽ vào được farm đó.
> Chơi LAN tin cậy thì không sao; muốn khóa riêng thì bước tiếp theo là thêm mật khẩu
> (server đã tách sẵn hàm `saveAccount`, chỉ cần thêm field + check).

### 👥 Thử multiplayer ngay (không setup gì)
1. `npm run dev`, mở **2 tab** cùng link
2. Bấm nút 🛖 (hoặc phím `V`) → 2 tab thấy nhau online, đi lại, chat qua lại
3. Muốn 1 mình vẫn đông: bật **"dân làng demo"** trong tab Online
4. Copy link mời `?visit=MÃ` sang tab kia → qua **thăm farm** (chỉ-xem, có banner + nút Về nhà)

### 🌐 Chạy LAN cho cả mạng cùng chơi (có DB local)
**Trả lời ngắn: được, và không cần Supabase.** Chạy 1 lệnh trên máy bạn:

```bash
npm run lan   # build web + khởi động LAN server ở cổng 8931
```

Server in ra link LAN, ví dụ `http://192.168.1.10:8931/` — máy khác và điện thoại
**cùng WiFi** mở link đó là vào làng chơi chung ngay, không cài gì thêm.
Đổi cổng: `PORT=9000 npm run lan`.

Những gì server làm (`server/index.js` — Express + Socket.io):
- **Serve game** đã build (`dist/`) cho cả mạng
- **Realtime làng:** presence (ai đang online, vị trí), chat broadcast — client tự phát hiện server qua `GET /api/health` nên không cần cấu hình IP
- **DB local:** toàn bộ account + farm lưu ở `server/data/db.json` (đã gitignore) — chủ thoát rồi bạn vẫn thăm farm được
- API sẵn có: `GET /api/health`, `GET /api/players/:username`, `PUT|POST /api/players/:username`, `GET /api/farms/:code`

> DB JSON đủ cho quy mô LAN party (vài chục người). Đông hơn thì thay file JSON
> bằng SQLite/Postgres trong `server/index.js` — socket events và client giữ nguyên
> vì đã tách qua interface `NetTransport`.

**Thứ tự client tự chọn mạng:** LAN server (nếu mở link từ server) → Supabase (nếu có `.env`) → làng local (2 tab cùng máy).

### ☁️ Lên online thật bằng Supabase
```bash
cp .env.example .env   # điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```
1. Tạo project ở [supabase.com](https://supabase.com), lấy URL + anon key (Settings → API)
2. Chạy `supabase/migrations/001_farm.sql` trong SQL Editor (tạo bảng `profiles`, `farms`, RLS demo)
3. `npm run dev` — HUD hiện 🟢 là cloud đã đồng bộ; farm tự lưu đám mây, bạn bè thăm được cả khi bạn offline

> ⚠️ Policy RLS trong migration để mở (`true`) cho demo chơi ngay không cần login.
> Production thật: đổi sang `auth.uid() = id` + bật Auth (Google/OTP).

## ➕ Mở rộng sau này

- Cây/cá/vật nuôi mới: thêm 1 dòng vào `CROPS/FISHES/ANIMALS` trong `data.ts` — shop, kho, giá bán tự nhận
- Map/building mới: sửa `world.ts` + vẽ thêm trong `render.ts`
- Nhiệm vụ mới: thêm vào `QUESTS` + case trong `questDone` (`store.ts`)
- Đổi backend (socket riêng, Supabase khác): implement `NetTransport`, game/UI không đổi
- Chợ trời/bảng xếp hạng: thêm bảng + query snapshot `farms` đã có sẵn
- Mobile app: bọc bằng Capacitor — UI đã responsive + joystick
