import { BOARD_SIZE } from '../content/balance';
import type { ShapeId } from '../content/blocks';
import type { Enhancement } from '../content/enhancements';
import type { Cell } from './pieces';
import type { Rng } from './rng';

/** 놓은 블록 칸 */
export interface BlockCell {
  kind: 'block';
  shape: ShapeId;
  enh?: Enhancement;
  /** 어느 블록(손에 들었던 블록 uid)의 칸인지. 행운은 블록당 한 번, 유리는 블록째로 센다 */
  piece?: number;
  /** 가방 속 어떤 블록인지. 유리가 깨지면 가방에서 뺀다 */
  bagId?: number;
  /** 🧊 언 칸: 줄이 지워질 때 얼음만 깨지고 칸은 남는다 */
  frozen?: boolean;
}

/**
 * 채워진 칸
 * - block: 놓은 블록
 * - rock: 바위. 줄 완성에 포함되지만 칩은 0. 한 번 지워지면 금이 가고, 두 번째에 부서진다
 * - water: 물에 잠긴 칸(물귀신). 놓을 수 없고, 줄 판정에서 빈칸도 채운 칸도 아니게 다룬다
 * - lock: 🔒 자물쇠. 이 칸이 있는 줄은 꽉 차도 안 지워진다. 옆 칸이 지워지면 풀려서 빈칸이 된다
 * - moss: 🌿 이끼. 핸드마다 번진다. 줄로 지우면 사라진다
 * - bomb: 💣 시한폭탄. fuse 핸드 안에 못 지우면 터진다
 */
export type Filled =
  | BlockCell
  | { kind: 'rock'; cracked: boolean; shadow?: boolean }
  | { kind: 'water' }
  | { kind: 'lock' }
  | { kind: 'moss' }
  | { kind: 'bomb'; fuse: number };

/** 블록을 놓을 때 칸에 함께 적는 정보 */
export type BlockMeta = Omit<BlockCell, 'kind' | 'shape'>;

/** 8×8 칸을 행 우선으로 펼친 배열. null = 빈칸 */
export type Board = ReadonlyArray<Filled | null>;

export interface Lines {
  rows: number[];
  cols: number[];
}

export interface ClearedCell {
  index: number;
  cell: Filled;
  /** removed = 사라짐, cracked = 바위에 금만 감, thawed = 언 블록의 얼음만 깨짐 */
  outcome: 'removed' | 'cracked' | 'thawed';
}

const RANGE = Array.from({ length: BOARD_SIZE }, (_, i) => i);

export const cellIndex = (row: number, col: number) => row * BOARD_SIZE + col;

export const emptyBoard = (): Board => Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);

export function canPlace(board: Board, cells: readonly Cell[], row: number, col: number): boolean {
  return cells.every(([r, c]) => {
    const rr = row + r;
    const cc = col + c;
    return rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[cellIndex(rr, cc)] === null;
  });
}

export function placeCells(
  board: Board,
  cells: readonly Cell[],
  row: number,
  col: number,
  shape: ShapeId,
  meta: BlockMeta = {},
): Board {
  const next = board.slice();
  // 저장(JSON)을 작게: 없는 정보는 아예 적지 않는다
  const extra = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined));
  for (const [r, c] of cells) next[cellIndex(row + r, col + c)] = { kind: 'block', shape, ...extra };
  return next;
}

/** 빈칸이 없고, 물이 아닌 칸이 하나라도 있으면 다 찬 것 */
function allFilled(board: Board, indices: readonly number[]): boolean {
  return indices.every((i) => board[i] !== null) && indices.some((i) => board[i]?.kind !== 'water');
}

/** 지워지는 줄: 다 찼고 자물쇠가 없다 */
function isFull(board: Board, indices: readonly number[]): boolean {
  return allFilled(board, indices) && indices.every((i) => board[i]?.kind !== 'lock');
}

const rowIndices = (r: number) => RANGE.map((c) => cellIndex(r, c));
const colIndices = (c: number) => RANGE.map((r) => cellIndex(r, c));

export function fullLines(board: Board): Lines {
  return {
    rows: RANGE.filter((r) => isFull(board, rowIndices(r))),
    cols: RANGE.filter((c) => isFull(board, colIndices(c))),
  };
}

export const lineCount = (lines: Lines) => lines.rows.length + lines.cols.length;

const LAST = BOARD_SIZE - 1;
const CORNERS = [cellIndex(0, 0), cellIndex(0, LAST), cellIndex(LAST, 0), cellIndex(LAST, LAST)];

/** 네 모서리가 모두 찼는가 (🧭 사신도). 물에 잠긴 모서리는 줄 판정처럼 건너뛴다 */
export const cornersFilled = (board: Board) => allFilled(board, CORNERS);

/** 상하좌우 이웃 칸 번호 */
export function neighbors(index: number): number[] {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const result: number[] = [];
  if (row > 0) result.push(index - BOARD_SIZE);
  if (row < LAST) result.push(index + BOARD_SIZE);
  if (col > 0) result.push(index - 1);
  if (col < LAST) result.push(index + 1);
  return result;
}

export type LineAxis = 'row' | 'col';

/** 가로줄 하나 또는 세로줄 하나의 칸 번호 */
export const axisLine = (axis: LineAxis, index: number) => (axis === 'row' ? rowIndices(index) : colIndices(index));

/** 줄에 속한 칸 번호. 겹치는 칸은 한 번만, 위→아래·왼쪽→오른쪽 순서 */
export function lineCells(lines: Lines): number[] {
  const set = new Set<number>();
  for (const r of lines.rows) for (const i of rowIndices(r)) set.add(i);
  for (const c of lines.cols) for (const i of colIndices(c)) set.add(i);
  return [...set].sort((a, b) => a - b);
}

export function clearLines(board: Board, lines: Lines): { board: Board; cleared: ClearedCell[] } {
  const next = board.slice();
  const cleared: ClearedCell[] = [];
  for (const index of lineCells(lines)) {
    const cell = next[index];
    if (!cell || cell.kind === 'water') continue;
    if (cell.kind === 'rock' && !cell.cracked) {
      next[index] = { ...cell, cracked: true };
      cleared.push({ index, cell, outcome: 'cracked' });
    } else if (cell.kind === 'block' && cell.frozen) {
      const thawed = { ...cell };
      delete thawed.frozen;
      next[index] = thawed;
      cleared.push({ index, cell, outcome: 'thawed' });
    } else {
      next[index] = null;
      cleared.push({ index, cell, outcome: 'removed' });
    }
  }
  unlockAround(next, cleared);
  return { board: next, cleared };
}

/** 🧹 빗자루: 고른 칸들을 한 번에 비운다 (바위도 금 가지 않고 바로, 언 칸도) */
export function sweepCells(board: Board, indices: readonly number[]): { board: Board; cleared: ClearedCell[] } {
  const next = board.slice();
  const cleared: ClearedCell[] = [];
  for (const index of indices) {
    const cell = next[index];
    if (!cell || cell.kind === 'water') continue;
    next[index] = null;
    cleared.push({ index, cell, outcome: 'removed' });
  }
  unlockAround(next, cleared);
  return { board: next, cleared };
}

/** 🔒 지워진 칸 바로 옆 자물쇠는 풀려서 빈칸이 된다 (풀린 자물쇠가 또 옆을 풀지는 않는다) */
function unlockAround(next: Array<Filled | null>, cleared: ClearedCell[]) {
  const removed = cleared.filter((c) => c.outcome === 'removed').map((c) => c.index);
  for (const index of removed) {
    for (const near of neighbors(index)) {
      const cell = next[near];
      if (cell?.kind !== 'lock') continue;
      next[near] = null;
      cleared.push({ index: near, cell, outcome: 'removed' });
    }
  }
}

/** 칸을 가운데로 한 3×3 (판 밖은 빼고) */
export function area3x3(index: number): number[] {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const result: number[] = [];
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) result.push(cellIndex(r, c));
    }
  }
  return result;
}

const rowOf = (index: number) => Math.floor(index / BOARD_SIZE);
const colOf = (index: number) => index % BOARD_SIZE;

/** 같은 가로·세로줄이거나 붙어 있으면(대각선 포함) 같이 둘 수 없다 → 시작부터 막히는 판 방지 */
function crowded(a: number, b: number): boolean {
  const sameLine = rowOf(a) === rowOf(b) || colOf(a) === colOf(b);
  const touching = Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
  return sameLine || touching;
}

/**
 * 빈칸 count곳에 make()로 만든 칸(바위, 방해 칸)을 흩어 놓는다.
 * 이미 있는 바위·방해 칸과도 같은 줄이거나 붙지 않게 하고, 자리가 모자라면 놓을 수 있는 만큼만
 */
export function scatterCells(
  board: Board,
  count: number,
  rng: Rng,
  make: () => Filled,
  avoid: ReadonlySet<number> = new Set(),
): Board {
  const next = board.slice();
  const placed = next.flatMap((cell, i) => (cell !== null && cell.kind !== 'water' ? [i] : []));
  for (let i = 0; i < count; i++) {
    const candidates = emptyCells(next).filter(
      (index) => !avoid.has(index) && placed.every((other) => !crowded(index, other)),
    );
    if (candidates.length === 0) break;
    const index = candidates[rng.int(candidates.length)];
    next[index] = make();
    placed.push(index);
  }
  return next;
}

export function fitsAnywhere(board: Board, cells: readonly Cell[]): boolean {
  return RANGE.some((row) => RANGE.some((col) => canPlace(board, cells, row, col)));
}

/** 블록과 바위 칸 수 (물은 세지 않음) */
export const filledCount = (board: Board) =>
  board.filter((cell) => cell !== null && cell.kind !== 'water').length;

/** 물을 빼고 아무것도 없으면 빈 판 */
export const isBoardEmpty = (board: Board) => board.every((cell) => cell === null || cell.kind === 'water');

export const emptyCells = (board: Board) =>
  board.flatMap((cell, index) => (cell === null ? [index] : []));

/** 가로줄 하나를 오른쪽으로 한 칸 민다. 오른쪽 끝 칸은 왼쪽 끝으로 (🐍 이무기) */
export function shiftRowRight(board: Board, row: number): Board {
  const next = board.slice();
  const cells = rowIndices(row).map((i) => board[i]);
  rowIndices(row).forEach((index, col) => {
    next[index] = cells[(col + BOARD_SIZE - 1) % BOARD_SIZE];
  });
  return next;
}

/** 이 빈칸을 채우면 가로줄이나 세로줄이 완성되는가 */
export function wouldCompleteLine(board: Board, index: number): boolean {
  const filled = board.slice();
  filled[index] = { kind: 'rock', cracked: false };
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  return isFull(filled, rowIndices(row)) || isFull(filled, colIndices(col));
}
