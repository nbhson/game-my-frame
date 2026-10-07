// ===== Caro (Gomoku rút gọn 12x12, 5 liên tiếp thắng) =====
export const CARO_SIZE = 12;
export const CARO_WIN = 5;

export type CaroCell = 0 | 1 | null; // 0 = X (đi trước), 1 = O

export interface CaroState {
  size: number;
  board: CaroCell[][];
  order: string[]; // [X, O]
  turn: string;
  winner: string | null;
  winLine: [number, number][] | null;
  draw: boolean;
  moveCount: number;
}

export function emptyBoard(size = CARO_SIZE): CaroCell[][] {
  return Array.from({ length: size }, () => Array<CaroCell>(size).fill(null));
}

export function newCaroGame(playerIds: [string, string]): CaroState {
  return {
    size: CARO_SIZE,
    board: emptyBoard(),
    order: playerIds.slice(),
    turn: playerIds[0],
    winner: null,
    winLine: null,
    draw: false,
    moveCount: 0,
  };
}

export function inBoard(size: number, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < size && c < size;
}

/** kiểm tra thắng từ ô vừa đánh */
export function checkWin(board: CaroCell[][], r: number, c: number): [number, number][] | null {
  const v = board[r]?.[c];
  if (v == null) return null;
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const size = board.length;
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[r, c]];
    for (let k = 1; k < CARO_WIN; k++) {
      const nr = r + dr * k, nc = c + dc * k;
      if (!inBoard(size, nr, nc) || board[nr][nc] !== v) break;
      line.push([nr, nc]);
    }
    for (let k = 1; k < CARO_WIN; k++) {
      const nr = r - dr * k, nc = c - dc * k;
      if (!inBoard(size, nr, nc) || board[nr][nc] !== v) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= CARO_WIN) return line.slice(0, CARO_WIN);
  }
  return null;
}

export function applyCaroMove(st: CaroState, playerId: string, r: number, c: number): CaroState | null {
  if (st.winner || st.draw) return null;
  if (st.turn !== playerId) return null;
  if (!inBoard(st.size, r, c) || st.board[r][c] !== null) return null;
  const idx = st.order.indexOf(playerId);
  if (idx < 0) return null;
  const board = st.board.map((row) => row.slice());
  board[r][c] = idx as 0 | 1;
  const moveCount = st.moveCount + 1;
  const winLine = checkWin(board, r, c);
  if (winLine) {
    return { ...st, board, winner: playerId, winLine, moveCount };
  }
  if (moveCount >= st.size * st.size) {
    return { ...st, board, draw: true, moveCount };
  }
  const turn = st.order[(idx + 1) % st.order.length];
  return { ...st, board, turn, moveCount };
}

// ---------- bot caro: thắng > chặn > gần quân mình ----------
export function caroBotMove(st: CaroState, playerId: string): [number, number] | null {
  const idx = st.order.indexOf(playerId);
  if (idx < 0) return null;
  const me = idx as 0 | 1;
  const opp = (1 - idx) as 0 | 1;
  const empties = candidateCells(st.board);
  if (!empties.length) return null;
  // 1. nước thắng ngay
  for (const [r, c] of empties) {
    st.board[r][c] = me;
    const w = checkWin(st.board, r, c);
    st.board[r][c] = null;
    if (w) return [r, c];
  }
  // 2. chặn đối thủ thắng ngay
  for (const [r, c] of empties) {
    st.board[r][c] = opp;
    const w = checkWin(st.board, r, c);
    st.board[r][c] = null;
    if (w) return [r, c];
  }
  // 3. chọn ô có nhiều quân mình xung quanh nhất
  let best: [number, number] | null = null;
  let bestScore = -1;
  for (const [r, c] of empties) {
    const s = neighborScore(st.board, r, c, me) * 2 + neighborScore(st.board, r, c, opp);
    if (s > bestScore) { bestScore = s; best = [r, c]; }
  }
  return best;
}

function candidateCells(board: CaroCell[][]): [number, number][] {
  const size = board.length;
  let hasStone = false;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (board[r][c] !== null) { hasStone = true; break; }
  if (!hasStone) {
    const m = Math.floor(size / 2);
    return [[m, m]];
  }
  const set = new Set<string>();
  const out: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (!inBoard(size, nr, nc) || board[nr][nc] !== null) continue;
          const k = nr + ':' + nc;
          if (!set.has(k)) { set.add(k); out.push([nr, nc]); }
        }
      }
    }
  }
  return out.length ? out : [[Math.floor(size / 2), Math.floor(size / 2)]];
}

function neighborScore(board: CaroCell[][], r: number, c: number, v: 0 | 1): number {
  let s = 0;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (inBoard(board.length, nr, nc) && board[nr][nc] === v) s += 3 - Math.max(Math.abs(dr), Math.abs(dc));
    }
  }
  return s + Math.random() * 0.5;
}
