import { SHAPES, type ShapeId } from '../content/blocks';

/** [행, 열] */
export type Cell = readonly [number, number];

/** 손에 들린 블록 하나 */
export interface Piece {
  uid: number;
  /** 가방 속 어떤 블록에서 나왔는지 */
  bagId: number;
  shape: ShapeId;
  /** 정해진 방향의 칸들. 왼쪽 위가 (0, 0) */
  cells: readonly Cell[];
  rows: number;
  cols: number;
  /** 👹 도깨비가 모양을 바꾼 블록 */
  transformed?: boolean;
}

export function parsePattern(pattern: readonly string[]): Cell[] {
  const cells: Cell[] = [];
  pattern.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') cells.push([r, c]);
    });
  });
  return cells;
}

/** 왼쪽 위를 (0, 0)에 맞추고 위→아래, 왼쪽→오른쪽으로 정렬 */
function normalize(cells: readonly Cell[]): Cell[] {
  const minRow = Math.min(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]): Cell => [r - minRow, c - minCol])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const keyOf = (cells: readonly Cell[]) => cells.map(([r, c]) => `${r},${c}`).join(' ');
/** 화면 기준 시계 방향 90° */
const rotate = (cells: readonly Cell[]) => cells.map(([r, c]): Cell => [c, -r]);
const mirror = (cells: readonly Cell[]) => cells.map(([r, c]): Cell => [r, -c]);

const orientationCache = new Map<ShapeId, ReadonlyArray<readonly Cell[]>>();

/** 회전·뒤집기로 나올 수 있는 서로 다른 방향 전부 (순서 고정) */
export function orientations(shape: ShapeId): ReadonlyArray<readonly Cell[]> {
  const cached = orientationCache.get(shape);
  if (cached) return cached;

  const base = parsePattern(SHAPES[shape].pattern);
  const seen = new Set<string>();
  const result: Cell[][] = [];
  for (const start of [base, mirror(base)]) {
    let current = start;
    for (let i = 0; i < 4; i++) {
      const normalized = normalize(current);
      const key = keyOf(normalized);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(normalized);
      }
      current = rotate(current);
    }
  }
  orientationCache.set(shape, result);
  return result;
}

export function extent(cells: readonly Cell[]): { rows: number; cols: number } {
  return {
    rows: Math.max(...cells.map(([r]) => r)) + 1,
    cols: Math.max(...cells.map(([, c]) => c)) + 1,
  };
}

export function rotateClockwise(cells: readonly Cell[]): Cell[] {
  return normalize(rotate(cells));
}

export function rotatePiece(piece: Piece): Piece {
  const cells = rotateClockwise(piece.cells);
  return { ...piece, cells, ...extent(cells) };
}

/** 지금 방향과 90°씩 돌린 방향 (중복 제외) */
export function rotations(cells: readonly Cell[]): Array<readonly Cell[]> {
  const result: Array<readonly Cell[]> = [];
  const seen = new Set<string>();
  let current: readonly Cell[] = normalize(cells);
  for (let i = 0; i < 4; i++) {
    const key = keyOf(current);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(current);
    }
    current = rotateClockwise(current);
  }
  return result;
}
