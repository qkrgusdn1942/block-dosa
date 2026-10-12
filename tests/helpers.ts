import { BASE_LEVELS } from '../src/content/balance';
import { STARTING_BAG, type ShapeId } from '../src/content/blocks';
import type { Enhancement } from '../src/content/enhancements';
import type { TalismanId, TalismanInstance } from '../src/content/talismans';
import { cellIndex, emptyBoard, type Board, type Filled } from '../src/core/board';
import { extent, orientations, type Piece } from '../src/core/pieces';
import { Rng } from '../src/core/rng';
import type { ClearContext } from '../src/core/scoring';
import { createStage, type BagEntry, type StageSetup, type StageState } from '../src/core/stage';

/** 한 줄, 8칸, 연속 1, 판 반쯤 찬 상태가 기본 */
export function clearCtx(overrides: Partial<ClearContext> = {}): ClearContext {
  return {
    rows: 1,
    cols: 0,
    cellCount: 8,
    streak: 1,
    perfect: false,
    stars: 0,
    pieceKind: 'square',
    filledBefore: 20,
    filledAfter: 12,
    ...overrides,
  };
}

const CELL_CODES: Record<string, Filled> = {
  '#': { kind: 'block', shape: 'dot' },
  '*': { kind: 'block', shape: 'dot', frozen: true },
  R: { kind: 'rock', cracked: false },
  r: { kind: 'rock', cracked: true },
  '~': { kind: 'water' },
  L: { kind: 'lock' },
  M: { kind: 'moss' },
  B: { kind: 'bomb', fuse: 3 },
};

/**
 * '#' = 블록, '*' = 언 블록, 'R' = 바위, 'r' = 금 간 바위, '~' = 물, 'L' = 자물쇠, 'M' = 이끼, 'B' = 시한폭탄,
 * '.' = 빈칸. 8줄 × 8글자 (모자라면 빈칸)
 */
export function boardFrom(rows: string[]): Board {
  const board = emptyBoard().slice();
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const cell = CELL_CODES[ch];
      if (cell) board[cellIndex(r, c)] = cell;
    });
  });
  return board;
}

export function boardText(board: Board): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let line = '';
    for (let c = 0; c < 8; c++) {
      line += cellText(board[cellIndex(r, c)]);
    }
    rows.push(line);
  }
  return rows;
}

function cellText(cell: Filled | null): string {
  if (!cell) return '.';
  switch (cell.kind) {
    case 'block':
      return cell.frozen ? '*' : '#';
    case 'rock':
      return cell.cracked ? 'r' : 'R';
    case 'water':
      return '~';
    case 'lock':
      return 'L';
    case 'moss':
      return 'M';
    case 'bomb':
      return 'B';
  }
}

export function pieceOf(shape: ShapeId, orientation = 0, uid = 1000): Piece {
  const cells = orientations(shape)[orientation];
  return { uid, bagId: -1, shape, cells, ...extent(cells) };
}

export function startingBag(): BagEntry[] {
  const bag: BagEntry[] = [];
  for (const [shape, count] of STARTING_BAG) {
    for (let i = 0; i < count; i++) bag.push({ id: bag.length, shape });
  }
  return bag;
}

export function talisman(id: TalismanId, uid = 500, counter = 0): TalismanInstance {
  return { uid, id, counter };
}

export function setup(overrides: Partial<StageSetup> = {}): StageSetup {
  return {
    seed: 'TEST01',
    ante: 1,
    kind: 'small',
    boss: null,
    target: 150,
    bag: startingBag(),
    talismans: [],
    consumables: [],
    levels: { ...BASE_LEVELS },
    extraHands: 0,
    extraDiscards: 0,
    extraRocks: 0,
    obstacle: null,
    consumableSlots: 2,
    rescue: false,
    scoreAttack: false,
    ...overrides,
  };
}

/** 빈 판(보너스 칸 없음)에서 시작하는 판. overrides로 상태를 덮어쓴다 */
export function stageWith(overrides: Partial<StageState> = {}, setupOverrides: Partial<StageSetup> = {}): StageState {
  return { ...createStage(setup(setupOverrides)), board: emptyBoard(), bonus: {}, ...overrides };
}

/** 강화된 블록 칸. piece가 같으면 한 블록의 칸들 */
export function enhancedCell(enh: Enhancement, piece?: number, bagId?: number): Filled {
  return { kind: 'block', shape: 'dot', enh, ...(piece !== undefined && { piece }), ...(bagId !== undefined && { bagId }) };
}

/** 판의 몇 칸을 바꾼다 */
export function withCells(board: Board, cells: Record<number, Filled | null>): Board {
  const next = board.slice();
  for (const [index, cell] of Object.entries(cells)) next[Number(index)] = cell;
  return next;
}

/** 조건을 만족하는 랜덤 상태를 찾는다 (확률 효과를 정해진 결과로 시험할 때) */
export function rngStateWhere(check: (rng: Rng) => boolean): number {
  for (let state = 1; state < 100_000; state++) {
    if (check(new Rng(state))) return state;
  }
  throw new Error('조건에 맞는 랜덤 상태가 없습니다');
}
