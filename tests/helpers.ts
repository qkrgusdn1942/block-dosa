import { BASE_LEVELS } from '../src/content/balance';
import { STARTING_BAG, type ShapeId } from '../src/content/blocks';
import type { TalismanId, TalismanInstance } from '../src/content/talismans';
import { cellIndex, emptyBoard, type Board, type Filled } from '../src/core/board';
import { extent, orientations, type Piece } from '../src/core/pieces';
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
  R: { kind: 'rock', cracked: false },
  r: { kind: 'rock', cracked: true },
  '~': { kind: 'water' },
};

/** '#' = 블록, 'R' = 바위, 'r' = 금 간 바위, '~' = 물, '.' = 빈칸. 8줄 × 8글자 (모자라면 빈칸) */
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
      const cell = board[cellIndex(r, c)];
      line += !cell ? '.' : cell.kind === 'block' ? '#' : cell.kind === 'water' ? '~' : cell.cracked ? 'r' : 'R';
    }
    rows.push(line);
  }
  return rows;
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
    rescue: false,
    scoreAttack: false,
    ...overrides,
  };
}

/** 빈 판(보너스 칸 없음)에서 시작하는 판. overrides로 상태를 덮어쓴다 */
export function stageWith(overrides: Partial<StageState> = {}, setupOverrides: Partial<StageSetup> = {}): StageState {
  return { ...createStage(setup(setupOverrides)), board: emptyBoard(), bonus: {}, ...overrides };
}
