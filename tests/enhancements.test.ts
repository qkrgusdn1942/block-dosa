import { describe, expect, it } from 'vitest';
import { MIN_BAG_SIZE } from '../src/content/balance';
import {
  GLASS_BREAK_CHANCE,
  LUCKY_GOLD_CHANCE,
  LUCKY_MULT_CHANCE,
} from '../src/content/enhancements';
import { cellIndex } from '../src/core/board';
import type { Piece } from '../src/core/pieces';
import { createStage, drawPiece, stageReducer, type StageState } from '../src/core/stage';
import { boardFrom, enhancedCell, pieceOf, rngStateWhere, setup, stageWith, talisman, withCells } from './helpers';

const dot = (uid = 1000) => pieceOf('dot', 0, uid);
/** 맨 윗줄이 (0, 0)만 비어 있고, 아래에 칸 하나가 남아서 대청소는 아닌 판. 점을 놓으면 한 줄 18점 */
const ROW = boardFrom(['.#######', '#']);
const at = (col: number) => cellIndex(0, col);

function clearRow(overrides: Partial<StageState> = {}, setupOverrides = {}) {
  const stage = stageWith({ board: ROW, hand: [dot(), dot(1001), null], ...overrides }, setupOverrides);
  return stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 0 });
}

describe('블록 강화', () => {
  it('✦ 수정: 칸당 칩 +10', () => {
    const next = clearRow({ board: withCells(ROW, { [at(1)]: enhancedCell('crystal'), [at(2)]: enhancedCell('crystal') }) });
    expect(next.score).toBe(18 + 20);
  });

  it('▲ 불꽃: 칸당 배수 +2', () => {
    const next = clearRow({ board: withCells(ROW, { [at(1)]: enhancedCell('fire'), [at(2)]: enhancedCell('fire') }) });
    expect(next.score).toBe(18 * 5);
  });

  it('$ 금: 칸당 +$1, 한 번에 최대 $8, 🪓 금도끼는 2배', () => {
    const three = { [at(1)]: enhancedCell('gold'), [at(2)]: enhancedCell('gold'), [at(3)]: enhancedCell('gold') };
    expect(clearRow({ board: withCells(ROW, three) }).goldEarned).toBe(3);
    const seven = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((c) => [at(c), enhancedCell('gold')]));
    expect(clearRow({ board: withCells(ROW, seven) }).goldEarned).toBe(7);
    // 십자로 금 칸 14개를 지워도 한 번에 $8까지
    const cross = Object.fromEntries([
      ...[1, 2, 3, 4, 5, 6, 7].map((c) => [at(c), enhancedCell('gold')]),
      ...[1, 2, 3, 4, 5, 6, 7].map((r) => [cellIndex(r, 0), enhancedCell('gold')]),
    ]);
    const crossed = stageWith({ board: withCells(boardFrom(['.', '', '', '', '', '', '', '.......#']), cross), hand: [pieceOf('dot', 0, 1000), null, null] });
    expect(stageReducer(crossed, { type: 'place', slot: 0, row: 0, col: 0 }).goldEarned).toBe(8);
    const axe = clearRow({ board: withCells(ROW, three), talismans: [talisman('goldAxe')] });
    expect(axe.goldEarned).toBe(6);
    expect(axe.lastClear?.gold).toBe(6);
  });

  it('◇ 유리: 블록 하나당 ×2 (같은 블록의 칸은 한 번만)', () => {
    const samePiece = { [at(1)]: enhancedCell('glass', 7), [at(2)]: enhancedCell('glass', 7) };
    const never = rngStateWhere((rng) => rng.next() >= GLASS_BREAK_CHANCE);
    expect(clearRow({ board: withCells(ROW, samePiece), luckRng: never }).score).toBe(36);
    const twoPieces = { [at(1)]: enhancedCell('glass', 7), [at(2)]: enhancedCell('glass', 8) };
    const neverTwice = rngStateWhere((rng) => rng.next() >= GLASS_BREAK_CHANCE && rng.next() >= GLASS_BREAK_CHANCE);
    expect(clearRow({ board: withCells(ROW, twoPieces), luckRng: neverTwice }).score).toBe(18 * 4);
  });

  it('◇ 유리: 1/4 확률로 깨져서 가방과 섞인 더미에서 사라진다. 가방이 최소 크기면 버틴다', () => {
    const board = withCells(ROW, { [at(1)]: enhancedCell('glass', 7, 3) });
    const breaks = rngStateWhere((rng) => rng.next() < GLASS_BREAK_CHANCE);
    const broken = clearRow({ board, luckRng: breaks, pile: [3, 4, 5] });
    expect(broken.lastClear?.broken).toBe(1);
    expect(broken.bag.some((entry) => entry.id === 3)).toBe(false);
    expect(broken.pile).toEqual([4, 5]);

    const kept = clearRow({ board, luckRng: rngStateWhere((rng) => rng.next() >= GLASS_BREAK_CHANCE) });
    expect(kept.lastClear?.broken).toBe(0);
    expect(kept.bag).toHaveLength(18);

    const small = createStage(setup()).bag.slice(0, MIN_BAG_SIZE);
    const guarded = clearRow({ board, luckRng: breaks, bag: small });
    expect(guarded.bag).toHaveLength(MIN_BAG_SIZE);
    expect(guarded.lastClear?.broken).toBe(0);
  });

  it('☘ 행운: 블록당 한 번 굴려서 1/5 배수 +20, 1/15 +$10', () => {
    const multOnly = rngStateWhere((rng) => rng.next() < LUCKY_MULT_CHANCE && rng.next() >= LUCKY_GOLD_CHANCE);
    const lucky = clearRow({ board: withCells(ROW, { [at(1)]: enhancedCell('lucky', 7) }), luckRng: multOnly });
    expect(lucky.score).toBe(18 * 21);
    expect(lucky.lastClear?.lucky).toBe(1);

    const goldOnly = rngStateWhere((rng) => rng.next() >= LUCKY_MULT_CHANCE && rng.next() < LUCKY_GOLD_CHANCE);
    const rich = clearRow({ board: withCells(ROW, { [at(1)]: enhancedCell('lucky', 7) }), luckRng: goldOnly });
    expect(rich.score).toBe(18);
    expect(rich.goldEarned).toBe(10);

    // 칸마다 굴렸다면 ×61이 됐을 상태에서도, 한 블록이면 한 번만
    const hot = rngStateWhere((rng) => {
      const rolls = Array.from({ length: 6 }, () => rng.next());
      return rolls[0] < LUCKY_MULT_CHANCE && rolls[2] < LUCKY_MULT_CHANCE && rolls[4] < LUCKY_MULT_CHANCE;
    });
    const cells = { [at(1)]: enhancedCell('lucky', 7), [at(2)]: enhancedCell('lucky', 7), [at(3)]: enhancedCell('lucky', 7) };
    expect(clearRow({ board: withCells(ROW, cells), luckRng: hot }).lastClear?.result.mult).toBe(21);
  });

  it('강화된 가방 블록을 뽑으면 손의 블록도, 놓은 칸도 강화돼 있다', () => {
    const stage = createStage(setup());
    const bag = stage.bag.map((entry) => ({ ...entry, enh: 'fire' as const }));
    const { piece } = drawPiece({ ...stage, bag, pile: [0] }, []);
    expect(piece.enh).toBe('fire');
    const placed = stageReducer(stageWith({ hand: [piece, dot(1001), null] }), { type: 'place', slot: 0, row: 3, col: 3 });
    const cell = placed.board[cellIndex(3, 3)];
    expect(cell).toMatchObject({ kind: 'block', enh: 'fire', piece: piece.uid, bagId: piece.bagId });
  });

  it('🐻 불가사리 판에서는 강화가 모두 꺼진다', () => {
    const stage = createStage(setup({ ante: 3, kind: 'boss', boss: 'bulgasari', target: 2000 }));
    const board = withCells(ROW, { [at(1)]: enhancedCell('crystal'), [at(2)]: enhancedCell('gold'), [at(3)]: enhancedCell('fire') });
    const ready: StageState = { ...stage, board, bonus: {}, hand: [dot(), dot(1001), null] as Array<Piece | null> };
    const next = stageReducer(ready, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(next.score).toBe(18);
    expect(next.goldEarned).toBe(0);
  });
});
