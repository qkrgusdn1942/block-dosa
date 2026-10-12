import { BOARD_SIZE, STAMP_BLOCKS } from '../src/content/balance';
import { SHAPES } from '../src/content/blocks';
import type { Consumable } from '../src/content/consumables';
import { TALISMANS, type TalismanId } from '../src/content/talismans';
import {
  axisLine,
  canPlace,
  cellIndex,
  clearLines,
  filledCount,
  fullLines,
  isBoardEmpty,
  lineCount,
  neighbors,
  placeCells,
  type Board,
} from '../src/core/board';
import { extent, parsePattern, rotations, type Piece } from '../src/core/pieces';
import { consumableSlotsFull, runReducer, talismanSlotsFull, type RunAction, type RunState } from '../src/core/run';
import { canPick, pieceAt, stageReducer, type HandSlot, type StageAction, type StageState } from '../src/core/stage';

/**
 * 밸런스 확인용 단순 봇 → docs/08-difficulty.md
 * - 놓기: 줄을 가장 많이 지우는 자리. 같으면 빈칸이 덜 쪼개지고 다른 칸·가장자리에 붙는 자리 (돌릴 수 있으면 돌려서도 본다)
 * - 장터: 점수에 도움 되는 부적을 왼쪽부터 사고, 남는 돈으로 쓸 줄 아는 소모품을 산다. 블록 팩·리롤은 안 한다
 * - 소모품: 비전서·도장은 바로, 빗자루는 많이 찬 줄에, 망치는 판이 빽빽할 때, 모래시계·부채는 판 시작에
 * 사람보다 못 두므로, 여기서 나온 통과율은 "이 정도는 넘는다"는 바닥으로 본다
 */

interface Move {
  slot: HandSlot;
  row: number;
  col: number;
  value: number;
  /** 이만큼 돌린 다음 놓는다 (회전할 수 있을 때) */
  turns: number;
}

/** 봇의 습관 (밸런스 비교 때 바꾼다) */
export interface BotOptions {
  /** 사서 쓰는 소모품 종류 */
  consumables: ReadonlySet<Consumable['kind']>;
  /** 판 1을 늘 건너뛴다 */
  skipSmall?: boolean;
}

export const DEFAULT_BOT: BotOptions = {
  consumables: new Set(['scroll', 'broom', 'hammer', 'stamp', 'fan', 'hourglass']),
};

/** 상하좌우가 모두 막힌 빈칸 수: 많을수록 나중에 채우기 어렵다 */
function isolatedEmpties(board: Board): number {
  let count = 0;
  board.forEach((cell, index) => {
    if (cell === null && neighbors(index).every((near) => board[near] !== null)) count++;
  });
  return count;
}

/** 놓은 칸이 판 가장자리나 다른 칸에 닿은 면 수 */
function contact(board: Board, piece: Piece, row: number, col: number): number {
  let sides = 0;
  for (const [r, c] of piece.cells) {
    const index = cellIndex(row + r, col + c);
    const around = neighbors(index);
    sides += 4 - around.length;
    sides += around.filter((near) => board[near] !== null).length;
  }
  return sides;
}

function evaluate(board: Board, piece: Piece, row: number, col: number): number {
  const placed = placeCells(board, piece.cells, row, col, piece.shape);
  const lines = fullLines(placed);
  const count = lineCount(lines);
  const after = count > 0 ? clearLines(placed, lines).board : placed;
  let value = count * 100 + contact(board, piece, row, col) * 2;
  if (count > 0 && isBoardEmpty(after)) value += 300;
  value -= isolatedEmpties(after) * 15 + filledCount(after);
  return value;
}

export function bestMove(stage: StageState): Move | null {
  const slots: HandSlot[] = [...stage.hand.map((_, i) => i), ...(stage.stash ? ['stash' as const] : [])];
  let best: Move | null = null;
  for (const slot of slots) {
    const piece = pieceAt(stage, slot);
    // 🐅 가려진 블록은 핸드의 마지막 블록으로만 (봇은 모양을 알지만 다른 블록을 고를 때 쓰지 않는다)
    if (!piece || !canPick(stage, slot)) continue;
    // 돌릴 수 있으면 돌린 방향도 본다 (같은 값이면 덜 돌린 쪽)
    const variants = stage.rotation ? rotations(piece.cells) : [piece.cells];
    variants.forEach((cells, turns) => {
      const turned: Piece = { ...piece, cells, ...extent(cells) };
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (!canPlace(stage.board, cells, row, col)) continue;
          const value = evaluate(stage.board, turned, row, col);
          if (!best || value > best.value) best = { slot, row, col, value, turns };
        }
      }
    });
  }
  return best;
}

/** 점수·판 버티기에 도움 되는 부적만 산다 (봇은 보관·리롤을 안 쓴다) */
function useful(id: TalismanId): boolean {
  const def = TALISMANS[id];
  if (def.rarity === 'cursed') return false;
  return Boolean(def.onScore || def.grow || def.passive?.hands || def.passive?.discards || def.passive?.revive);
}

const RANGE = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const isSolid = (stage: StageState, index: number) => {
  const cell = stage.board[index];
  return cell !== null && cell.kind !== 'water';
};
const solidCount = (stage: StageState, cells: readonly number[]) => cells.filter((i) => isSolid(stage, i)).length;

/** 실제로 판이 바뀌는 행동만 고른다 (규칙이 바뀌어도 봇이 헛돌지 않게) */
const tryUse = (stage: StageState, action: StageAction): StageAction | null =>
  stageReducer(stage, action) !== stage ? action : null;

/** 판 진행 중 소모품 쓰기 */
function consumableStep(run: RunState, options: BotOptions): RunAction | null {
  const { stage } = run;
  for (const [index, item] of stage.consumables.entries()) {
    if (!options.consumables.has(item.kind)) continue;
    let action: StageAction | null = null;
    switch (item.kind) {
      case 'scroll':
        return { type: 'useScroll', index };
      case 'hourglass':
      case 'fan':
        action = tryUse(stage, { type: 'useConsumable', index });
        break;
      case 'broom': {
        const lines = [
          ...RANGE.map((r) => ({ axis: 'row' as const, cells: axisLine('row', r) })),
          ...RANGE.map((c) => ({ axis: 'col' as const, cells: axisLine('col', c) })),
        ];
        const fullest = lines.reduce((a, b) => (solidCount(stage, b.cells) > solidCount(stage, a.cells) ? b : a));
        if (solidCount(stage, fullest.cells) >= 6) {
          action = tryUse(stage, { type: 'useConsumable', index, cell: fullest.cells[0], axis: fullest.axis });
        }
        break;
      }
      case 'hammer': {
        if (filledCount(stage.board) < 40) break;
        const around = (center: number) =>
          RANGE.flatMap((r) => RANGE.map((c) => cellIndex(r, c))).filter(
            (i) =>
              Math.abs(Math.floor(i / BOARD_SIZE) - Math.floor(center / BOARD_SIZE)) <= 1 &&
              Math.abs((i % BOARD_SIZE) - (center % BOARD_SIZE)) <= 1 &&
              isSolid(stage, i),
          ).length;
        const center = stage.board.map((_, i) => i).reduce((a, b) => (around(b) > around(a) ? b : a));
        action = tryUse(stage, { type: 'useConsumable', index, cell: center });
        break;
      }
    }
    if (action) return { type: 'stage', action };
  }
  return null;
}

function stageStep(run: RunState, options: BotOptions): RunAction {
  const { stage } = run;
  const use = consumableStep(run, options);
  if (use) return use;
  const move = bestMove(stage);
  if (move && move.turns > 0) return { type: 'stage', action: { type: 'rotate', slot: move.slot } };
  if (move) return { type: 'stage', action: { type: 'place', slot: move.slot, row: move.row, col: move.col } };
  // 놓을 곳이 없으면 가장 큰 블록을 버린다
  const sizes = stage.hand.map((piece) => piece?.cells.length ?? -1);
  const biggest = sizes.indexOf(Math.max(...sizes));
  if (stage.discardsLeft > 0 && biggest >= 0 && stage.hand[biggest]) {
    return { type: 'stage', action: { type: 'discard', slot: biggest } };
  }
  return { type: 'stage', action: { type: 'giveUp' } };
}

const shapeSize = (shape: keyof typeof SHAPES) => parsePattern(SHAPES[shape].pattern).length;

/** 도장: 강화 안 된 블록 중 칸이 많은 것부터 */
function stampTargets(run: RunState): number[] {
  return run.bag
    .filter((entry) => !entry.enh)
    .sort((a, b) => shapeSize(b.shape) - shapeSize(a.shape))
    .slice(0, STAMP_BLOCKS)
    .map((entry) => entry.id);
}

function shopStep(run: RunState, options: BotOptions): RunAction {
  const shop = run.shop!;
  const scroll = run.consumables.findIndex((item) => item.kind === 'scroll');
  if (scroll >= 0) return { type: 'useScroll', index: scroll };
  const stamp = run.consumables.findIndex((item) => item.kind === 'stamp');
  if (stamp >= 0) {
    const action: RunAction = { type: 'stamp', index: stamp, bagIds: stampTargets(run) };
    if (runReducer(run, action) !== run) return action;
  }
  if (!talismanSlotsFull(run)) {
    const slot = shop.talismans.findIndex((o) => !o.sold && o.price <= run.gold && useful(o.item));
    if (slot >= 0) return { type: 'buyTalisman', slot };
  }
  if (!consumableSlotsFull(run)) {
    const slot = shop.consumables.findIndex(
      (o) => !o.sold && o.price <= run.gold && options.consumables.has(o.item.kind),
    );
    if (slot >= 0) return { type: 'buyConsumable', slot };
  }
  if (shop.pack.choices && !shop.pack.done) return { type: 'skipPack' };
  return { type: 'next' };
}

export function botStep(run: RunState, options: BotOptions): RunAction | null {
  switch (run.phase) {
    case 'starter':
    case 'relic': {
      const index = (run.relics ?? []).findIndex((offer) =>
        offer.kind === 'talisman' ? !talismanSlotsFull(run) && useful(offer.id) : !consumableSlotsFull(run),
      );
      return index >= 0 ? { type: 'pickRelic', index } : { type: 'skipRelic' };
    }
    case 'preview':
      return options.skipSmall && run.stageKind === 'small' ? { type: 'skip' } : { type: 'begin' };
    case 'playing':
      return stageStep(run, options);
    case 'reward':
      return { type: 'collect' };
    case 'shop':
      return shopStep(run, options);
    case 'victory':
      return { type: 'finish' };
    case 'over':
    case 'ending':
      return null;
  }
}

/** 런이 끝날 때까지 봇이 둔다 */
export function playRun(run: RunState, options: BotOptions = DEFAULT_BOT, maxSteps = 20_000): RunState {
  let current = run;
  for (let i = 0; i < maxSteps; i++) {
    const action = botStep(current, options);
    if (!action) break;
    let next = runReducer(current, action);
    // 아무것도 안 바뀌면 (놓을 곳은 없는데 포기도 안 되는 경우) 포기
    if (next === current && current.phase === 'playing') {
      next = runReducer(current, { type: 'stage', action: { type: 'giveUp' } });
    }
    if (next === current) break;
    current = next;
  }
  return current;
}
