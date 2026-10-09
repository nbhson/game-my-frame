// ===== MODAL BẢNG TIN LÀNG: ghim tin + đọc + thả tim =====
import { useState } from 'react';
import { POST_KINDS, kindEmoji, topOfDay, useBoard, type PostKind } from '../net/board';
import { gameMe } from '../net/village';

function ago(at: number): string {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m}p trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export default function BoardModal() {
  const posts = useBoard((s) => s.posts);
  const post = useBoard((s) => s.post);
  const toggleLike = useBoard((s) => s.toggleLike);
  const [kind, setKind] = useState<PostKind>('note');
  const [text, setText] = useState('');
  const me = gameMe().name;
  const y = new Date(Date.now() - 86400000);
  const yDay = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  const top = topOfDay(posts, yDay);
  return (
    <div className="space-y-3">
      <div className="bg-amber-100 rounded-xl p-2 border-2 border-black">
        <div className="font-black text-sm mb-1.5">📌 Ghim tin mới (tối đa 120 chữ):</div>
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          {POST_KINDS.map((k) => (
            <button key={k.id}
              className={`px-2.5 py-1 rounded-xl border-2 border-black font-bold text-sm ${kind === k.id ? 'bg-green-500 text-white' : 'bg-white'}`}
              onClick={() => setKind(k.id)}>{k.emoji} {k.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input className="flex-1 px-2.5 py-1.5 rounded-xl border-2 border-black font-bold" maxLength={120}
            placeholder="Bán 10 gà ta, ai mua không?…" value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { post(kind, text); setText(''); } }} />
          <button className="py-1.5 px-3 rounded-xl bg-green-500 border-2 border-black text-white font-black hover:bg-green-400"
            onClick={() => { post(kind, text); setText(''); }}>Ghim!</button>
        </div>
      </div>
      {top && (
        <div className="bg-yellow-100 rounded-xl p-2 border-2 border-black text-sm font-bold">
          🏆 Top hôm qua: <b>{top.author}</b> ({top.likes.length} tim): "{top.text}" — chủ bài nhận 200 xu + danh hiệu "Dân làng yêu quý"!
        </div>
      )}
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {posts.length === 0 && <div className="text-center font-bold text-stone-500 p-4">Bảng trống — ghim tin đầu tiên đi!</div>}
        {posts.map((p) => {
          const liked = p.likes.includes(me);
          const mine = p.author === me;
          return (
            <div key={p.id} className="bg-white/80 rounded-xl px-3 py-1.5 border-2 border-black">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
                <span>{kindEmoji(p.kind)}</span><span className="text-stone-800">{p.author}</span>
                <span>• {ago(p.at)}</span>
              </div>
              <div className="font-bold">{p.text}</div>
              <div className="mt-0.5">
                {mine ? (
                  <span className="text-xs font-bold text-stone-400">📌 bài của bạn ({p.likes.length} tim)</span>
                ) : (
                  <button
                    className={`px-2.5 py-0.5 rounded-xl border-2 border-black font-black text-sm ${liked ? 'bg-pink-500 text-white' : 'bg-white hover:bg-pink-100'}`}
                    onClick={() => toggleLike(p.id)}>
                    {liked ? '❤️' : '🤍'} {p.likes.length}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs font-bold text-stone-500 text-center">Bài nhiều tim nhất hôm qua tự động nhận thưởng — không tính tim tự thả!</div>
    </div>
  );
}
