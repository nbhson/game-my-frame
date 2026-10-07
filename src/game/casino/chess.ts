// ===== Cờ vua: engine đầy đủ luật FIDE cơ bản + AI minimax =====
// Bàn 8x8, r=0 là hàng 1 (trắng). Đi đầy đủ: nhập thành, bắt tốt qua đường,
// phong cấp, chiếu/chiếu hết, hết nước (stalemate), hòa (thiếu quân / 50 nước / lặp 3 lần).
export type ChessColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface ChessPiece { t: PieceType; c: ChessColor }
export type ChessBoard = (ChessPiece | null)[][];
export type ChessSq = [number, number]; // [r, c]
export interface ChessMove { f: ChessSq; t: ChessSq; pr?: PieceType }

export interface ChessState {
  board: ChessBoard;
  order: [string, string]; // [trắng, đen]
  turn: string; // pid tới lượt
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  ep: ChessSq | null; // ô có thể bắt tốt qua đường
  half: number; // đồng hồ 50 nước (nửa nước)
  full: number; // số nước
  history: string[]; // SAN từng nước
  posCounts: Record<string, number>; // đếm lặp thế cờ
  lastMove: { f: ChessSq; t: ChessSq } | null;
  winner: string | null; // pid thắng
  winReason: 'checkmate' | 'resign' | null;
  draw: boolean;
  drawReason: 'stalemate' | 'material' | 'fifty' | 'repetition' | null;
  inCheck: boolean; // bên tới lượt đang bị chiếu
  /** mốc hết giờ của lượt hiện tại (ms epoch) — hết giờ tự đi */
  deadline: number | null;
}

export const opp = (c: ChessColor): ChessColor => (c === 'w' ? 'b' : 'w');
const inB = (r: number, c: number): boolean => r >= 0 && c >= 0 && r < 8 && c < 8;

function initialBoard(): ChessBoard {
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const bd: ChessBoard = Array.from({ length: 8 }, () => Array<ChessPiece | null>(8).fill(null));
  for (let c = 0; c < 8; c++) {
    bd[0][c] = { t: back[c], c: 'w' };
    bd[1][c] = { t: 'p', c: 'w' };
    bd[6][c] = { t: 'p', c: 'b' };
    bd[7][c] = { t: back[c], c: 'b' };
  }
  return bd;
}

export function newChessGame(ids: [string, string]): ChessState {
  const board = initialBoard();
  const st: ChessState = {
    board, order: [ids[0], ids[1]], turn: ids[0],
    castling: { wk: true, wq: true, bk: true, bq: true },
    ep: null, half: 0, full: 1, history: [], posCounts: {},
    lastMove: null, winner: null, winReason: null,
    draw: false, drawReason: null, inCheck: false, deadline: null,
  };
  st.posCounts[posKey(st)] = 1;
  return st;
}

const colorOf = (st: ChessState, pid: string): ChessColor | null =>
  pid === st.order[0] ? 'w' : pid === st.order[1] ? 'b' : null;

/** mã thế cờ: quân + lượt + quyền nhập thành + ô EP */
export function posKey(st: ChessState): string {
  let s = colorOf(st, st.turn) ?? 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = st.board[r][c];
      s += p ? (p.c === 'w' ? p.t.toUpperCase() : p.t) : '.';
    }
  }
  const k = st.castling;
  s += (k.wk ? 'K' : '') + (k.wq ? 'Q' : '') + (k.bk ? 'k' : '') + (k.bq ? 'q' : '');
  s += st.ep ? `e${st.ep[0]}${st.ep[1]}` : '';
  return s;
}

function findKing(bd: ChessBoard, color: ChessColor): ChessSq | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = bd[r][c];
      if (p && p.t === 'k' && p.c === color) return [r, c];
    }
  }
  return null;
}

/** ô (r,c) có bị quân màu `by` tấn công không */
export function isAttacked(bd: ChessBoard, r: number, c: number, by: ChessColor): boolean {
  // tốt
  const pr = by === 'w' ? r - 1 : r + 1;
  for (const dc of [-1, 1]) {
    const p = inB(pr, c + dc) ? bd[pr][c + dc] : null;
    if (p && p.c === by && p.t === 'p') return true;
  }
  // mã
  for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
    const p = inB(r + dr, c + dc) ? bd[r + dr][c + dc] : null;
    if (p && p.c === by && p.t === 'n') return true;
  }
  // vua
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const p = inB(r + dr, c + dc) ? bd[r + dr][c + dc] : null;
      if (p && p.c === by && p.t === 'k') return true;
    }
  }
  // tượng/hậu (chéo) + xe/hậu (ngang/dọc)
  const rays: { dirs: [number, number][]; types: PieceType[] }[] = [
    { dirs: [[1, 1], [1, -1], [-1, 1], [-1, -1]], types: ['b', 'q'] },
    { dirs: [[1, 0], [-1, 0], [0, 1], [0, -1]], types: ['r', 'q'] },
  ];
  for (const { dirs, types } of rays) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inB(nr, nc)) {
        const p = bd[nr][nc];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }
  return false;
}

interface GenCtx {
  bd: ChessBoard;
  color: ChessColor;
  castling: ChessState['castling'];
  ep: ChessSq | null;
}

/** nước giả định (chưa lọc vua bị chiếu) của 1 quân */
function pseudoFor(ctx: GenCtx, r: number, c: number): ChessMove[] {
  const { bd, color, castling, ep } = ctx;
  const p = bd[r][c];
  if (!p || p.c !== color) return [];
  const out: ChessMove[] = [];
  const push = (tr: number, tc: number, pr?: PieceType) => {
    if (inB(tr, tc)) out.push({ f: [r, c], t: [tr, tc], pr });
  };
  const slide = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inB(nr, nc)) {
        const q = bd[nr][nc];
        if (!q) push(nr, nc);
        else {
          if (q.c !== color) push(nr, nc);
          break;
        }
        nr += dr; nc += dc;
      }
    }
  };
  const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const LINE: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  switch (p.t) {
    case 'p': {
      const dir = color === 'w' ? 1 : -1;
      const start = color === 'w' ? 1 : 6;
      const last = color === 'w' ? 7 : 0;
      if (inB(r + dir, c) && !bd[r + dir][c]) {
        if (r + dir === last) { for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) push(r + dir, c, pr); }
        else {
          push(r + dir, c);
          if (r === start && !bd[r + 2 * dir][c]) push(r + 2 * dir, c);
        }
      }
      for (const dc of [-1, 1]) {
        const tr = r + dir, tc = c + dc;
        if (!inB(tr, tc)) continue;
        const q = bd[tr][tc];
        if (q && q.c !== color) {
          if (tr === last) { for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) push(tr, tc, pr); }
          else push(tr, tc);
        } else if (!q && ep && ep[0] === tr && ep[1] === tc) {
          push(tr, tc); // bắt tốt qua đường
        }
      }
      break;
    }
    case 'n':
      for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
        if (!inB(r + dr, c + dc)) continue;
        const q = bd[r + dr][c + dc];
        if (!q || q.c !== color) push(r + dr, c + dc);
      }
      break;
    case 'b': slide(DIAG); break;
    case 'r': slide(LINE); break;
    case 'q': slide([...DIAG, ...LINE]); break;
    case 'k': {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          if (!inB(r + dr, c + dc)) continue;
          const q = bd[r + dr][c + dc];
          if (!q || q.c !== color) push(r + dr, c + dc);
        }
      }
      // nhập thành: vua + xe chưa đi, ô giữa trống, vua không bị chiếu và không đi qua ô bị tấn công
      const home = color === 'w' ? 0 : 7;
      const kSide = color === 'w' ? castling.wk : castling.bk;
      const qSide = color === 'w' ? castling.wq : castling.bq;
      if (r === home && c === 4 && !isAttacked(bd, r, c, opp(color))) {
        if (kSide && !bd[home][5] && !bd[home][6] && bd[home][7]?.t === 'r' && bd[home][7]?.c === color
          && !isAttacked(bd, home, 5, opp(color)) && !isAttacked(bd, home, 6, opp(color))) {
          push(home, 6);
        }
        if (qSide && !bd[home][3] && !bd[home][2] && !bd[home][1] && bd[home][0]?.t === 'r' && bd[home][0]?.c === color
          && !isAttacked(bd, home, 3, opp(color)) && !isAttacked(bd, home, 2, opp(color))) {
          push(home, 2);
        }
      }
      break;
    }
  }
  return out;
}

/** thử đi trên bàn copy (cho lọc chiếu + AI) */
function doMove(bd: ChessBoard, mv: ChessMove): { captured: ChessPiece | null; epTaken: ChessSq | null } {
  const [fr, fc] = mv.f;
  const [tr, tc] = mv.t;
  const p = bd[fr][fc]!;
  let captured = bd[tr][tc];
  let epTaken: ChessSq | null = null;
  // bắt tốt qua đường: tốt ăn ô trống
  if (p.t === 'p' && fc !== tc && !captured) {
    epTaken = [fr, tc];
    captured = bd[fr][tc];
    bd[fr][tc] = null;
  }
  bd[tr][tc] = mv.pr ? { t: mv.pr, c: p.c } : p;
  bd[fr][fc] = null;
  // nhập thành: kéo xe theo
  if (p.t === 'k' && Math.abs(tc - fc) === 2) {
    const home = p.c === 'w' ? 0 : 7;
    if (tc === 6) { bd[home][5] = bd[home][7]; bd[home][7] = null; }
    else { bd[home][3] = bd[home][0]; bd[home][0] = null; }
  }
  return { captured, epTaken };
}

function kingSafeAfter(bd: ChessBoard, mv: ChessMove, color: ChessColor): boolean {
  const copy = bd.map((row) => row.slice());
  doMove(copy, mv);
  const k = findKing(copy, color);
  return !!k && !isAttacked(copy, k[0], k[1], opp(color));
}

/** mọi nước HỢP LỆ của 1 màu trên bàn hiện tại */
export function allLegalBoard(
  bd: ChessBoard, color: ChessColor,
  castling: ChessState['castling'], ep: ChessSq | null,
): ChessMove[] {
  const ctx: GenCtx = { bd, color, castling, ep };
  const out: ChessMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = bd[r][c];
      if (!p || p.c !== color) continue;
      for (const mv of pseudoFor(ctx, r, c)) {
        if (kingSafeAfter(bd, mv, color)) out.push(mv);
      }
    }
  }
  return out;
}

/** nước hợp lệ của 1 ô (cho UI highlight) — chỉ khi đúng lượt bên đó */
export function legalMovesFor(st: ChessState, r: number, c: number, pid: string): ChessMove[] {
  if (st.winner || st.draw || st.turn !== pid) return [];
  const color = colorOf(st, pid);
  if (!color) return [];
  const p = inB(r, c) ? st.board[r][c] : null;
  if (!p || p.c !== color) return [];
  const ctx: GenCtx = { bd: st.board, color, castling: st.castling, ep: st.ep };
  return pseudoFor(ctx, r, c).filter((mv) => kingSafeAfter(st.board, mv, color));
}

export const sqName = (s: ChessSq): string => 'abcdefgh'[s[1]] + (s[0] + 1);

/** ký hiệu SAN của nước đi (tính trên state TRƯỚC khi đi) */
function toSAN(st: ChessState, mv: ChessMove): string {
  const [fr, fc] = mv.f;
  const [tr, tc] = mv.t;
  const p = st.board[fr][fc]!;
  const color = p.c;
  let san: string;
  if (p.t === 'k' && Math.abs(tc - fc) === 2) {
    san = tc === 6 ? 'O-O' : 'O-O-O';
  } else {
    const target = st.board[tr][tc];
    const isEp = p.t === 'p' && fc !== tc && !target;
    const isCap = !!target || isEp;
    let s = '';
    if (p.t === 'p') {
      s = isCap ? 'abcdefgh'[fc] + 'x' : '';
      s += sqName(mv.t);
      if (mv.pr) s += '=' + mv.pr.toUpperCase();
    } else {
      s = p.t.toUpperCase();
      // phân biệt 2 quân cùng loại đi được tới ô này
      const others: ChessMove[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (r === fr && c === fc) continue;
          const q = st.board[r][c];
          if (!q || q.c !== color || q.t !== p.t) continue;
          const ctx: GenCtx = { bd: st.board, color, castling: st.castling, ep: st.ep };
          if (pseudoFor(ctx, r, c).some((m) => m.t[0] === tr && m.t[1] === tc && kingSafeAfter(st.board, m, color))) {
            others.push({ f: [r, c], t: [tr, tc] });
          }
        }
      }
      if (others.length) {
        const sameFile = others.every((m) => m.f[1] === fc);
        const sameRank = others.every((m) => m.f[0] === fr);
        if (!sameFile) s += 'abcdefgh'[fc];
        else if (!sameRank) s += String(fr + 1);
        else s += sqName(mv.f);
      }
      if (isCap) s += 'x';
      s += sqName(mv.t);
    }
    san = s;
  }
  // hậu tố chiếu / hết
  const after = st.board.map((row) => row.slice());
  doMove(after, mv);
  const ek = findKing(after, opp(color));
  if (ek && isAttacked(after, ek[0], ek[1], color)) {
    const reply = allLegalBoard(after, opp(color), st.castling, null);
    san += reply.length ? '+' : '#';
  }
  return san;
}

/** thiếu quân không thể chiếu hết: K-K, K+nhẹ-K, Tượng cùng màu ô */
function insufficientMaterial(bd: ChessBoard): boolean {
  const rest: { t: PieceType; c: ChessColor; r: number; c2: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = bd[r][c];
      if (p && p.t !== 'k') rest.push({ t: p.t, c: p.c, r, c2: c });
    }
  }
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0].t === 'b' || rest[0].t === 'n')) return true;
  if (rest.length === 2 && rest[0].t === 'b' && rest[1].t === 'b' && rest[0].c !== rest[1].c) {
    // 2 tượng khác màu, cùng màu ô → hòa
    if ((rest[0].r + rest[0].c2) % 2 === (rest[1].r + rest[1].c2) % 2) return true;
  }
  return false;
}

/** áp nước đi (đã validate lượt + hợp lệ). Trả null nếu sai luật. */
export function applyChessMove(
  st: ChessState, pid: string, f: ChessSq, t: ChessSq, pr?: PieceType,
): ChessState | null {
  if (st.winner || st.draw || st.turn !== pid) return null;
  const color = colorOf(st, pid);
  if (!color) return null;
  if (!inB(f[0], f[1]) || !inB(t[0], t[1])) return null;
  const p = st.board[f[0]][f[1]];
  if (!p || p.c !== color) return null;
  const legal = legalMovesFor(st, f[0], f[1], pid);
  const mv = legal.find((m) => m.t[0] === t[0] && m.t[1] === t[1] && (m.pr ?? null) === (pr ?? null));
  // tốt tới cuối bàn bắt buộc chọn phong cấp
  const needsPromo = p.t === 'p' && (t[0] === (color === 'w' ? 7 : 0));
  if (needsPromo && !pr) return null;
  if (!mv) {
    // cho phép UI gửi thiếu pr khi chỉ có 1 lựa chọn? Không — bắt buộc rõ ràng
    return null;
  }
  const san = toSAN(st, mv);
  const board = st.board.map((row) => row.slice());
  const { captured } = doMove(board, mv);
  // cập nhật quyền nhập thành
  const castling = { ...st.castling };
  if (p.t === 'k') {
    if (color === 'w') { castling.wk = false; castling.wq = false; }
    else { castling.bk = false; castling.bq = false; }
  }
  if (p.t === 'r') {
    if (color === 'w' && f[0] === 0 && f[1] === 0) castling.wq = false;
    if (color === 'w' && f[0] === 0 && f[1] === 7) castling.wk = false;
    if (color === 'b' && f[0] === 7 && f[1] === 0) castling.bq = false;
    if (color === 'b' && f[0] === 7 && f[1] === 7) castling.bk = false;
  }
  // xe bị ăn mất quyền nhập thành
  if (captured?.t === 'r') {
    if (t[0] === 0 && t[1] === 0) castling.wq = false;
    if (t[0] === 0 && t[1] === 7) castling.wk = false;
    if (t[0] === 7 && t[1] === 0) castling.bq = false;
    if (t[0] === 7 && t[1] === 7) castling.bk = false;
  }
  // ô bắt tốt qua đường mới
  const ep: ChessSq | null = p.t === 'p' && Math.abs(t[0] - f[0]) === 2 ? [(f[0] + t[0]) / 2, f[1]] : null;
  const half = p.t === 'p' || captured ? 0 : st.half + 1;
  const nextColor = opp(color);
  const nextPid = color === 'w' ? st.order[1] : st.order[0];
  const reply = allLegalBoard(board, nextColor, castling, ep);
  const nk = findKing(board, nextColor)!;
  const check = isAttacked(board, nk[0], nk[1], color);
  let winner: string | null = null;
  let winReason: ChessState['winReason'] = null;
  let draw = false;
  let drawReason: ChessState['drawReason'] = null;
  if (!reply.length) {
    if (check) { winner = pid; winReason = 'checkmate'; }
    else { draw = true; drawReason = 'stalemate'; }
  } else if (insufficientMaterial(board)) { draw = true; drawReason = 'material'; }
  else if (half >= 100) { draw = true; drawReason = 'fifty'; }
  const history = [...st.history, san];
  const full = st.full + (color === 'b' ? 1 : 0);
  const tmp: ChessState = {
    ...st, board, castling, ep, half, full, history,
    lastMove: { f: mv.f, t: mv.t },
    turn: winner || draw ? st.turn : nextPid,
    winner, winReason, draw, drawReason, inCheck: check && !winner && !draw,
    posCounts: { ...st.posCounts },
  };
  const key = posKey({ ...tmp, turn: tmp.turn });
  tmp.posCounts[key] = (tmp.posCounts[key] ?? 0) + 1;
  if (!winner && !draw && tmp.posCounts[key] >= 3) { draw = true; drawReason = 'repetition'; tmp.draw = true; tmp.drawReason = 'repetition'; }
  if (winner || draw) tmp.deadline = null;
  return tmp;
}

/** đầu hàng */
export function chessResign(st: ChessState, pid: string): ChessState | null {
  const color = colorOf(st, pid);
  if (!color || st.winner || st.draw) return null;
  const other = color === 'w' ? st.order[1] : st.order[0];
  return { ...st, winner: other, winReason: 'resign', inCheck: false, deadline: null };
}

// ---------------- AI: negamax alpha-beta + bảng vị trí ----------------
const VAL: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// bảng vị trí (góc nhìn trắng, r=0 hàng 1). Đen lật dọc.
const PST: Record<PieceType, number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 5, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

function evaluate(bd: ChessBoard): number {
  let s = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = bd[r][c];
      if (!p) continue;
      const idx = p.c === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      const v = VAL[p.t] + PST[p.t][idx];
      s += p.c === 'w' ? v : -v;
    }
  }
  return s;
}

interface SearchCtx {
  bd: ChessBoard;
  castling: ChessState['castling'];
  ep: ChessSq | null;
  half: number;
}

function orderMoves(bd: ChessBoard, moves: ChessMove[]): ChessMove[] {
  return moves
    .map((m) => {
      const target = bd[m.t[0]][m.t[1]];
      let s = 0;
      if (target) s = 10 * VAL[target.t] - VAL[bd[m.f[0]][m.f[1]]!.t];
      if (m.pr) s += VAL[m.pr];
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

function negamax(
  ctx: SearchCtx, depth: number, alpha: number, beta: number, color: ChessColor,
): number {
  const moves = orderMoves(ctx.bd, allLegalBoard(ctx.bd, color, ctx.castling, ctx.ep));
  if (!moves.length) {
    const k = findKing(ctx.bd, color)!;
    return isAttacked(ctx.bd, k[0], k[1], opp(color)) ? -100000 - depth : 0;
  }
  if (depth === 0) return (color === 'w' ? 1 : -1) * evaluate(ctx.bd);
  let best = -Infinity;
  for (const mv of moves) {
    const bd = ctx.bd.map((row) => row.slice());
    const mover = bd[mv.f[0]][mv.f[1]]!;
    const captured = bd[mv.t[0]][mv.t[1]];
    doMove(bd, mv);
    const score = -negamax(
      { bd, castling: ctx.castling, ep: null, half: mover.t === 'p' || captured ? 0 : ctx.half + 1 },
      depth - 1, -beta, -alpha, opp(color),
    );
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** AI chọn nước: tàn cuộc (< 10 quân) sâu 3, còn lại sâu 2 + chút ngẫu nhiên */
export function chessBotMove(st: ChessState, pid: string): ChessMove | null {
  const color = colorOf(st, pid);
  if (!color || st.turn !== pid || st.winner || st.draw) return null;
  const moves = orderMoves(st.board, allLegalBoard(st.board, color, st.castling, st.ep));
  if (!moves.length) return null;
  let pieces = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (st.board[r][c]) pieces++;
  const depth = pieces <= 10 ? 3 : 2;
  let best: ChessMove[] = [];
  let bestScore = -Infinity;
  for (const mv of moves) {
    const bd = st.board.map((row) => row.slice());
    const mover = bd[mv.f[0]][mv.f[1]]!;
    const captured = bd[mv.t[0]][mv.t[1]];
    doMove(bd, mv);
    const score = -negamax(
      { bd, castling: st.castling, ep: null, half: 0 },
      depth - 1, -Infinity, Infinity, opp(color),
    ) + Math.random() * 12;
    void mover; void captured;
    if (score > bestScore + 0.001) { bestScore = score; best = [mv]; }
    else if (Math.abs(score - bestScore) < 25) best.push(mv);
  }
  return best.length ? best[(Math.random() * best.length) | 0] : null;
}

/** quân bị ăn (cho UI hiển thị): lostW = quân Trắng mất, lostB = quân Đen mất */
export function capturedOf(board: ChessBoard): { lostW: PieceType[]; lostB: PieceType[] } {
  const start: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const curW: Record<PieceType, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const curB: Record<PieceType, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) (p.c === 'w' ? curW : curB)[p.t]++;
    }
  }
  const lostW: PieceType[] = [];
  const lostB: PieceType[] = [];
  (Object.keys(start) as PieceType[]).forEach((t) => {
    for (let i = 0; i < start[t] - curW[t]; i++) lostW.push(t);
    for (let i = 0; i < start[t] - curB[t]; i++) lostB.push(t);
  });
  const order: Record<PieceType, number> = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 };
  lostW.sort((a, b) => order[a] - order[b]);
  lostB.sort((a, b) => order[a] - order[b]);
  return { lostW, lostB };
}

/** chênh lệch chất (dương = Trắng hơn) */
export function materialLead(board: ChessBoard): number {
  let s = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) s += (p.c === 'w' ? 1 : -1) * VAL[p.t];
    }
  }
  return Math.round(s / 100);
}

export const CHESS_WIN_TEXT: Record<string, string> = {
  checkmate: 'Chiếu hết',
  resign: 'Đối thủ đầu hàng',
};
export const CHESS_DRAW_TEXT: Record<string, string> = {
  stalemate: 'Hết nước đi',
  material: 'Không đủ quân chiếu hết',
  fifty: 'Luật 50 nước',
  repetition: 'Lặp thế cờ 3 lần',
};
