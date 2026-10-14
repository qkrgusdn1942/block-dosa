import { describe, expect, it } from 'vitest';
import { BOARD_SIZE } from '../src/content/balance';
import { cellIndex, emptyBoard } from '../src/core/board';
import {
  canPick,
  canUndo,
  createStage,
  drawPiece,
  hasRescue,
  isStuck,
  stageReducer,
  type StageAction,
  type StageState,
} from '../src/core/stage';
import type { Piece } from '../src/core/pieces';
import { boardFrom, boardText, pieceOf, setup, stageWith, talisman, withCells } from './helpers';

const DIAGONAL_EMPTY = [
  '.#######',
  '#.######',
  '##.#####',
  '###.####',
  '####.###',
  '#####.##',
  '######.#',
  '#######.',
];

/** 빈칸끼리 붙어 있지 않고 줄마다 빈칸이 2개씩: 1칸짜리만 들어가고, 넣어도 줄이 안 지워진다 */
const SPARSE = [
  '.#.#####',
  '####.#.#',
  '.#.#####',
  '####.#.#',
  '#.#.####',
  '#####.#.',
  '#.#.####',
  '#####.#.',
];

/** 세로로 2칸 빈 곳이 (0, 1)~(1, 1) 하나뿐: 세로 막대만 들어간다 */
const VERTICAL_SLOT = [
  '#.######',
  '#.######',
  '##.#####',
  '####.###',
  '######.#',
  '.#######',
  '###.####',
  '#####.##',
];

const hand = (...pieces: Array<Piece | null>) => pieces;
const dot = (uid = 1000) => pieceOf('dot', 0, uid);
const rockIndices = (stage: StageState) =>
  stage.board.flatMap((cell, i) => (cell?.kind === 'rock' ? [i] : []));

describe('판 시작', () => {
  it('같은 시드면 같은 판이 나온다 (블록, 바위, 보너스 칸)', () => {
    const a = createStage(setup({ ante: 5, kind: 'big' }));
    const b = createStage(setup({ ante: 5, kind: 'big' }));
    expect(a.hand).toEqual(b.hand);
    expect(a.board).toEqual(b.board);
    expect(a.bonus).toEqual(b.bonus);
  });

  it('시작 상태: 블록 3개, 핸드 1, 버리기 2', () => {
    const stage = createStage(setup());
    expect(stage.hand).toHaveLength(3);
    expect(stage.handNumber).toBe(1);
    expect(stage.discardsLeft).toBe(2);
    expect(stage.status).toBe('playing');
  });

  it('첫 섞기에는 가방 18개가 한 번씩 들어 있다', () => {
    const stage = createStage(setup());
    const ids = [...stage.hand.map((p) => p!.bagId), ...stage.pile];
    expect(new Set(ids).size).toBe(18);
  });

  it('가방이 비면 손에 있는 블록을 빼고 다시 섞는다', () => {
    const stage = createStage(setup());
    const { piece, stage: after } = drawPiece({ ...stage, pile: [] }, stage.hand);
    expect(stage.hand.map((p) => p!.bagId)).not.toContain(piece.bagId);
    expect(after.pile).toHaveLength(18 - 3 - 1);
  });

  it('바위는 고개별 개수만큼, 같은 줄이나 붙은 자리에 놓이지 않는다', () => {
    for (const seed of ['A', 'B', 'C', 'D', 'E']) {
      const stage = createStage(setup({ seed, ante: 7, kind: 'big' }));
      const rocks = rockIndices(stage);
      expect(rocks).toHaveLength(4);
      for (const a of rocks) {
        for (const b of rocks) {
          if (a === b) continue;
          const [ar, ac, br, bc] = [Math.floor(a / 8), a % 8, Math.floor(b / 8), b % 8];
          expect(ar === br || ac === bc).toBe(false);
          expect(Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1).toBe(false);
        }
      }
    }
  });

  it('고개 1~2와 요괴 판에는 바위가 없다', () => {
    expect(rockIndices(createStage(setup({ ante: 2, kind: 'big' })))).toHaveLength(0);
    expect(rockIndices(createStage(setup({ ante: 7, kind: 'boss', boss: 'dokkaebi' })))).toHaveLength(0);
  });

  it('보너스 칸은 0~2개, 빈칸 위에 생긴다', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const stage = createStage(setup({ seed: `S${i}`, ante: 5, kind: 'small' }));
      const cells = Object.keys(stage.bonus).map(Number);
      seen.add(cells.length);
      expect(cells.length).toBeLessThanOrEqual(2);
      for (const index of cells) expect(stage.board[index]).toBeNull();
    }
    expect(seen).toEqual(new Set([0, 1, 2]));
  });

  it('🧺 키가 있으면 버리기 +1, 🌀 바람개비가 있으면 회전 가능', () => {
    const stage = createStage(setup({ talismans: [talisman('winnow', 1), talisman('pinwheel', 2)] }));
    expect(stage.discardsLeft).toBe(3);
    expect(stage.rotation).toBe(true);
  });
});

describe('블록 놓기와 점수', () => {
  it('줄을 지우면 점수가 들어오고 연속이 오른다', () => {
    const stage = stageWith({ board: boardFrom(['.#######']), hand: hand(dot(), dot(1001), dot(1002)) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(next.score).toBe(54); // 한 줄 18 × 대청소 3
    expect(next.streak).toBe(1);
    expect(next.lastClear?.result.pattern).toBe('single');
    expect(next.hand[0]).toBeNull();
  });

  it('목표를 넘기는 순간 판 클리어', () => {
    const stage = stageWith({ score: 140, board: boardFrom(['.#######', '#']), hand: hand(dot(), dot(1001), null) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(next.score).toBe(158);
    expect(next.status).toBe('cleared');
  });

  it('한 핸드 동안 못 지우면 연속이 끊기고 다음 핸드로 넘어간다', () => {
    const stage = stageWith({ streak: 2, hand: hand(dot(), null, null) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 4, col: 4 });
    expect(next.streak).toBe(0);
    expect(next.handNumber).toBe(2);
    expect(next.hand.every((p) => p !== null)).toBe(true);
  });

  it('놓을 수 없는 자리는 무시한다', () => {
    const stage = stageWith({ hand: hand(pieceOf('bar5'), null, null) });
    expect(stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 4 })).toBe(stage);
  });

  it('마지막 핸드를 다 쓰고 목표 미달이면 실패', () => {
    const stage = stageWith({ handNumber: 5, hand: hand(dot(), null, null) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 4, col: 4 });
    expect(next.status).toBe('failed');
    expect(next.failReason).toBe('hands');
  });
});

describe('바위와 보너스 칸', () => {
  it('바위가 낀 줄을 지우면 바위는 금만 가고 칩은 블록 칸만', () => {
    const stage = stageWith({ board: boardFrom(['.R######']), hand: hand(dot(), dot(1001), null) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(boardText(next.board)[0]).toBe('.r......');
    expect(next.score).toBe(10 + 7); // 바위는 칩 0, 판에 남아서 대청소 아님
  });

  it('⭐ 별 칸을 덮은 블록이 지워지면 ×2', () => {
    const stage = stageWith({ board: boardFrom(['.#######', '#']), bonus: { 0: 'star' }, hand: hand(dot(), dot(1001), null) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(next.score).toBe(18 * 2);
    expect(next.bonus).toEqual({});
  });

  it('💎 보석 칸은 판 결과에서 받을 골드 +3', () => {
    const stage = stageWith({ board: boardFrom(['.#######', '#']), bonus: { 0: 'gem' }, hand: hand(dot(), dot(1001), null) });
    const next = stageReducer(stage, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(next.goldEarned).toBe(3);
  });
});

describe('막힘과 소모품', () => {
  const stuckBoard = boardFrom(DIAGONAL_EMPTY);

  it('손의 블록이 하나도 안 들어가면 막힘 (바람개비가 있으면 돌려서도 본다)', () => {
    expect(isStuck(stageWith({ board: stuckBoard, hand: hand(pieceOf('bar2'), pieceOf('square'), null) }))).toBe(true);
    expect(isStuck(stageWith({ board: stuckBoard, hand: hand(pieceOf('bar2'), dot(), null) }))).toBe(false);
    const slot = boardFrom(VERTICAL_SLOT);
    expect(isStuck(stageWith({ board: slot, hand: hand(pieceOf('bar2'), null, null) }))).toBe(true);
    expect(isStuck(stageWith({ board: slot, hand: hand(pieceOf('bar2'), null, null), rotation: true }))).toBe(false);
  });

  it('버리면 새 블록을 뽑고 버리기가 줄어든다', () => {
    const stage = createStage(setup());
    const next = stageReducer(stage, { type: 'discard', slot: 1 });
    expect(next.discardsLeft).toBe(1);
    expect(next.hand[1]?.uid).not.toBe(stage.hand[1]?.uid);
    expect(next.hand[0]).toBe(stage.hand[0]);
  });

  it('막혔는데 버리기도 쓸 소모품도 없으면 실패', () => {
    const base = createStage(setup());
    const bar2Id = base.bag.find((b) => b.shape === 'bar2')!.id;
    const stage = { ...base, board: stuckBoard, bonus: {}, discardsLeft: 1, pile: [bar2Id], hand: hand(pieceOf('square'), null, null) };
    const next = stageReducer(stage, { type: 'discard', slot: 0 });
    expect(next.status).toBe('failed');
    expect(next.failReason).toBe('stuck');
  });

  it('망치가 있으면 막혀도 기다리고, 포기하면 실패', () => {
    const stage = stageWith({
      board: boardFrom(SPARSE),
      discardsLeft: 0,
      consumables: [{ kind: 'hammer' }],
      hand: hand(pieceOf('square'), dot(), null),
    });
    const placed = stageReducer(stage, { type: 'place', slot: 1, row: 0, col: 0 });
    expect(placed.status).toBe('playing');
    expect(stageReducer(placed, { type: 'giveUp' }).status).toBe('failed');
  });

  it('🙏 기사회생: 막혀서 끝나려 할 때 가장 많이 찬 두 줄을 비우고 계속', () => {
    const base = createStage(setup({ rescue: true }));
    const bar2Id = base.bag.find((b) => b.shape === 'bar2')!.id;
    const stage = { ...base, board: stuckBoard, bonus: {}, discardsLeft: 1, pile: [bar2Id], hand: hand(pieceOf('square'), null, null) };
    const next = stageReducer(stage, { type: 'discard', slot: 0 });
    expect(next.status).toBe('playing');
    expect(next.rescued).toBe(true);
    expect(next.rescueReady).toBe(false);
    expect(next.toast?.text).toContain('기사회생');
    // 대각선 판은 모든 줄이 7칸씩 → 아무 두 줄이나 비워진다
    const emptied = next.board.filter((c) => c === null).length;
    expect(emptied).toBeGreaterThan(8);
  });

  it('🙏 기사회생: 놓아서 막혔는데 되돌리기가 남아 있으면 기다렸다가, 버튼(giveUp)을 누르면 그때 쓴다', () => {
    // 빈칸이 모두 떨어져 있어서 막대3은 못 놓고, 점을 (0, 0)에 놓아도 줄이 안 지워진다
    const board = boardFrom(['.#.#####', '#.######', '.#.#####', '###.####', '####.###', '#####.##', '######.#', '#######.']);
    const ready = (undoLeft: number) =>
      stageWith({ board, discardsLeft: 0, rescueReady: true, undoLeft, hand: hand(dot(), pieceOf('bar3', 0, 1001), null) });
    const placed = place(ready(1), 0, 0, 0);
    expect(placed.status).toBe('playing');
    expect(isStuck(placed)).toBe(true);
    // 되돌리기로 무를 수도 있으니 런에 한 번뿐인 기사회생을 저절로 쓰지 않는다
    expect(placed.rescued).toBe(false);
    const rescued = stageReducer(placed, { type: 'giveUp' });
    expect(rescued.status).toBe('playing');
    expect(rescued.rescued).toBe(true);
    // 되돌리기를 이미 썼으면 막히는 순간 저절로 쓴다
    expect(place(ready(0), 0, 0, 0).rescued).toBe(true);
  });

  it('🙏 기사회생으로도 안 풀리면 그때 실패', () => {
    const stage = stageWith({
      board: stuckBoard,
      discardsLeft: 0,
      rescueReady: true,
      hand: hand(pieceOf('bigSquare'), null, null),
    });
    // 큰ㅁ은 두 줄을 비워도 3×3 빈자리가 안 생긴다
    expect(stageReducer(stage, { type: 'giveUp' }).status).toBe('failed');
  });

  it('🔨 망치: 고른 칸을 가운데로 3×3을 부순다 (바위·방해 칸 포함)', () => {
    const stage = stageWith({ board: boardFrom(['#R#L', '##', '', '#']), consumables: [{ kind: 'hammer' }] });
    const next = stageReducer(stage, { type: 'useConsumable', index: 0, cell: cellIndex(0, 1) });
    expect(boardText(next.board).slice(0, 4)).toEqual(['...L....', '........', '........', '#.......']);
    expect(next.consumables).toHaveLength(0);
    expect(next.score).toBe(0);
    // 부술 게 없는 자리에는 못 쓴다
    expect(stageReducer(stage, { type: 'useConsumable', index: 0, cell: cellIndex(5, 5) })).toBe(stage);
  });

  it('🌬️ 부채: 이번 판 동안 블록을 돌릴 수 있다 (이미 돌릴 수 있으면 못 씀)', () => {
    const stage = stageWith({ consumables: [{ kind: 'fan' }], hand: hand(pieceOf('bar3'), dot(), null) });
    const next = stageReducer(stage, { type: 'useConsumable', index: 0 });
    expect(next.rotation).toBe(true);
    expect(next.consumables).toHaveLength(0);
    expect(stageReducer(next, { type: 'rotate', slot: 0 }).hand[0]?.rows).toBe(3);
    const spinning = { ...stage, rotation: true };
    expect(stageReducer(spinning, { type: 'useConsumable', index: 0 })).toBe(spinning);
  });

  it('⌛ 모래시계: 이번 판 핸드 +1', () => {
    const stage = stageWith({ consumables: [{ kind: 'hourglass' }] });
    const next = stageReducer(stage, { type: 'useConsumable', index: 0 });
    expect(next.rules.hands).toBe(stage.rules.hands + 1);
    expect(next.consumables).toHaveLength(0);
    expect(next.toast?.text).toContain('핸드 +1');
  });

  it('📖 비전서: 족보 레벨 +1', () => {
    const stage = stageWith({ consumables: [{ kind: 'scroll', pattern: 'double' }] });
    const next = stageReducer(stage, { type: 'useConsumable', index: 0 });
    expect(next.levels.double).toBe(2);
  });

  it('바람개비가 있을 때만 탭으로 돌릴 수 있다', () => {
    const stage = stageWith({ hand: hand(pieceOf('bar3'), null, null) });
    expect(stageReducer(stage, { type: 'rotate', slot: 0 })).toBe(stage);
    expect(stageReducer({ ...stage, rotation: true }, { type: 'rotate', slot: 0 }).hand[0]?.rows).toBe(3);
  });

  it('부적 순서 바꾸기', () => {
    const stage = stageWith({ talismans: [talisman('lamp', 1), talisman('tiger', 2)] });
    const next = stageReducer(stage, { type: 'moveTalisman', uid: 2, dir: -1 });
    expect(next.talismans.map((t) => t.uid)).toEqual([2, 1]);
  });
});

describe('요괴', () => {
  it('🦊 구미호: 부적 하나를 봉인해서 효과가 없다', () => {
    const stage = createStage(setup({ kind: 'boss', boss: 'gumiho', talismans: [talisman('lamp', 7)] }));
    expect(stage.sealedUid).toBe(7);
    const ready = { ...stage, board: boardFrom(['.#######', '#']), bonus: {}, hand: hand(dot(), dot(1001), null) };
    expect(stageReducer(ready, { type: 'place', slot: 0, row: 0, col: 0 }).score).toBe(18);
  });

  it('👹 도깨비: 핸드마다 블록 하나가 가방에 없는 모양으로 바뀐다', () => {
    const stage = createStage(setup({ kind: 'boss', boss: 'dokkaebi' }));
    const changed = stage.hand.filter((p) => p?.transformed);
    expect(changed).toHaveLength(1);
    const bagShapes = new Set(stage.bag.map((b) => b.shape));
    expect(bagShapes.has(changed[0]!.shape)).toBe(false);
  });

  it('🌑 어둑시니: 핸드가 끝나면 그림자 바위 2개', () => {
    const stage = { ...createStage(setup({ ante: 2, kind: 'boss', boss: 'eodukssini' })), board: emptyBoard(), bonus: {} };
    const next = stageReducer({ ...stage, hand: hand(dot(), null, null) }, { type: 'place', slot: 0, row: 0, col: 0 });
    const shadows = next.board.filter((c) => c?.kind === 'rock' && c.shadow);
    expect(shadows).toHaveLength(2);
  });

  it('🌊 물귀신: 아래 2줄이 물이고, 세로줄은 6칸만 채우면 지워진다', () => {
    const stage = createStage(setup({ ante: 2, kind: 'boss', boss: 'mulgwishin' }));
    expect(boardText(stage.board).slice(6)).toEqual(['~~~~~~~~', '~~~~~~~~']);
    const board = stage.board.slice();
    for (let r = 1; r < 6; r++) board[cellIndex(r, 0)] = { kind: 'block', shape: 'dot' };
    const ready = { ...stage, board, bonus: {}, hand: hand(dot(), dot(1001), null) };
    const next = stageReducer(ready, { type: 'place', slot: 0, row: 0, col: 0 });
    expect(next.lastClear?.result.pattern).toBe('single');
    expect(boardText(next.board)[0]).toBe('........');
  });

  it('🐍 이무기: 핸드가 끝나면 화살표 줄이 오른쪽으로 밀린다', () => {
    const stage = createStage(setup({ ante: 8, kind: 'boss', boss: 'imugi', target: 240_000 }));
    expect(stage.shiftRow).not.toBeNull();
    const ready = { ...stage, board: boardFrom(['', '', '', '#']), bonus: {}, shiftRow: 3, hand: hand(dot(), null, null) };
    const next = stageReducer(ready, { type: 'place', slot: 0, row: 7, col: 7 });
    expect(boardText(next.board)[3]).toBe('.#......');
    expect(next.shiftRow).not.toBeNull();
  });

  it('🐍 이무기: 밀려서 채워진 세로줄은 지워지고 점수가 들어온다', () => {
    const stage = createStage(setup({ ante: 8, kind: 'boss', boss: 'imugi', target: 240_000 }));
    // 1번 세로줄이 (3, 1)만 비어 있고, 3번 가로줄의 (3, 0) 블록이 밀려 들어가면 완성
    const rows = Array.from({ length: BOARD_SIZE }, (_, r) => (r === 3 ? '#' : '.#'));
    const ready = { ...stage, board: boardFrom(rows), bonus: {}, shiftRow: 3, hand: hand(dot(), null, null) };
    const next = stageReducer(ready, { type: 'place', slot: 0, row: 0, col: 7 });
    expect(next.lastClear?.shifted).toBe(true);
    expect(next.score).toBeGreaterThan(0);
  });
});

const place = (stage: StageState, slot: number | 'stash', row: number, col: number) =>
  stageReducer(stage, { type: 'place', slot, row, col });

describe('v1.0 요괴', () => {
  it('💀 저승사자: 핸드 −1, 버리기 0 (부적·수련으로 늘어난 것까지)', () => {
    const stage = createStage(
      setup({ ante: 3, kind: 'boss', boss: 'grimReaper', talismans: [talisman('winnow', 1)], extraDiscards: 1 }),
    );
    expect(stage.rules.hands).toBe(4);
    expect(stage.rules.discards).toBe(0);
    expect(stage.discardsLeft).toBe(0);
  });

  it('🔥 강철이: 판에서 골드를 하나도 못 얻는다', () => {
    const stage = createStage(setup({ ante: 2, kind: 'boss', boss: 'gangcheol', talismans: [talisman('toad')] }));
    const ready = { ...stage, board: boardFrom(['.#######']), bonus: { 0: 'gem' as const }, hand: hand(dot(), null, null) };
    const next = place(ready, 0, 0, 0);
    expect(next.score).toBe(54);
    expect(next.goldEarned).toBe(0);
  });

  it('👊 두억시니: 한 줄 클리어는 0점, 두 줄부터 점수', () => {
    const stage = { ...createStage(setup({ ante: 3, kind: 'boss', boss: 'dueoksini' })), bonus: {} };
    const single = place({ ...stage, board: boardFrom(['.#######', '#']), hand: hand(dot(), dot(1001), null) }, 0, 0, 0);
    expect(single.score).toBe(0);
    expect(single.lastClear?.result.steps.at(-1)?.kind).toBe('void');
    expect(single.streak).toBe(1);
    const crossBoard = boardFrom(['.#######', '#', '#', '#', '#', '#', '#', '#......#']);
    const cross = place({ ...stage, board: crossBoard, hand: hand(dot(), dot(1001), null) }, 0, 0, 0);
    expect(cross.score).toBe((35 + 15) * 3);
  });

  describe('🐅 장산범', () => {
    const tiger = (overrides: Partial<StageState> = {}): StageState => ({
      ...createStage(setup({ ante: 2, kind: 'boss', boss: 'jangsanbeom' })),
      board: emptyBoard(),
      bonus: {},
      ...overrides,
    });
    const hidden = (uid = 1002): Piece => ({ ...dot(uid), hidden: true });

    it('핸드마다 블록 하나가 가려진다. 가린 채로 버릴 수 있고, 새로 뽑은 블록은 안 가려진다', () => {
      const stage = createStage(setup({ ante: 2, kind: 'boss', boss: 'jangsanbeom' }));
      expect(stage.hand.filter((p) => p?.hidden)).toHaveLength(1);
      const slot = stage.hand.findIndex((p) => p?.hidden);
      const discarded = stageReducer(stage, { type: 'discard', slot });
      expect(discarded.discardsLeft).toBe(stage.discardsLeft - 1);
      expect(discarded.hand.some((p) => p?.hidden)).toBe(false);
      // 다음 핸드도 하나가 가려진다
      expect(place(tiger({ hand: hand(dot(), null, null) }), 0, 4, 4).hand.filter((p) => p?.hidden)).toHaveLength(1);
    });

    it('?는 핸드의 마지막 블록으로만 집는다: 그 전엔 드러내기·놓기·돌리기·보관 모두 안 됨', () => {
      const stage = tiger({ hand: hand(dot(), dot(1001), hidden()), rotation: true, stashEnabled: true });
      expect(canPick(stage, 0)).toBe(true);
      expect(canPick(stage, 2)).toBe(false);
      const blocked: StageAction[] = [
        { type: 'reveal', slot: 2 },
        { type: 'place', slot: 2, row: 0, col: 0 },
        { type: 'rotate', slot: 2 },
        { type: 'stash', slot: 2 },
      ];
      for (const action of blocked) expect(stageReducer(stage, action)).toBe(stage);
      // 다른 두 블록을 놓으면 풀리고, 집으면 드러난다
      const last = place(place(stage, 0, 0, 0), 1, 7, 7);
      expect(canPick(last, 2)).toBe(true);
      const revealed = stageReducer(last, { type: 'reveal', slot: 2 });
      expect(revealed.hand[2]?.hidden).toBeUndefined();
      expect(revealed.hand[2]?.cells).toEqual(stage.hand[2]?.cells);
    });

    it('다른 블록을 놓을 데가 없으면 ?가 바로 풀린다 (가려진 탓에 막히지 않게)', () => {
      // 빈칸이 (0, 0) 하나뿐: 막대2는 못 놓고 가려진 점은 놓을 수 있다
      const full = boardFrom(Array.from({ length: BOARD_SIZE }, (_, r) => (r === 0 ? '.#######' : '########')));
      const stage = tiger({ board: full, hand: hand(pieceOf('bar2'), null, hidden()) });
      expect(canPick(stage, 2)).toBe(true);
      expect(isStuck(stage)).toBe(false);
    });

    it('🎁 덤(4개)이면 두 개를 놓은 뒤 남은 블록과 ? 중에서 마지막을 고른다', () => {
      const stage = tiger({ hand: hand(dot(), dot(1001), dot(1003), hidden()) });
      expect(canPick(stage, 3)).toBe(false);
      const two = place(place(stage, 0, 0, 0), 1, 7, 7);
      expect(canPick(two, 2)).toBe(true);
      expect(canPick(two, 3)).toBe(true);
    });

    it('?를 집으면 바로 앞 블록은 되돌릴 수 없다 (모양을 보고 다시 놓지 못하게)', () => {
      const last = place(place(tiger({ hand: hand(dot(), dot(1001), hidden()) }), 0, 0, 0), 1, 7, 7);
      expect(canUndo(last)).toBe(true);
      const looked = stageReducer(last, { type: 'reveal', slot: 2 });
      expect(canUndo(looked)).toBe(false);
      expect(looked.undoLeft).toBe(1);
    });
  });
});

describe('🎒 보따리 (보관함)', () => {
  const withStash = (overrides: Partial<StageState> = {}) => stageWith({ stashEnabled: true, ...overrides });

  it('보따리가 있어야 보관함을 쓸 수 있다', () => {
    expect(createStage(setup({ talismans: [talisman('bundle')] })).stashEnabled).toBe(true);
    const stage = stageWith({ hand: hand(dot(), dot(1001), dot(1002)) });
    expect(stageReducer(stage, { type: 'stash', slot: 0 })).toBe(stage);
  });

  it('넣으면 이번 핸드 몫을 하나 쓴 것: 넣기 1 + 놓기 2면 다음 핸드', () => {
    const stashed = stageReducer(withStash({ hand: hand(dot(), dot(1001), dot(1002)) }), { type: 'stash', slot: 0 });
    expect(stashed.stash?.uid).toBe(1000);
    expect(stashed.hand[0]).toBeNull();
    expect(stashed.resolvedThisHand).toBe(1);
    // 보관함이 차 있으면 더 못 넣는다
    expect(stageReducer(stashed, { type: 'stash', slot: 1 })).toBe(stashed);
    const next = place(place(stashed, 1, 4, 4), 2, 6, 6);
    expect(next.handNumber).toBe(2);
    expect(next.stash?.uid).toBe(1000);
  });

  it('보관함 블록은 아무 때나 꺼내 놓고, 핸드 몫으로 세지 않는다', () => {
    const stage = withStash({ stash: dot(900), hand: hand(dot(), dot(1001), dot(1002)) });
    const next = place(stage, 'stash', 2, 2);
    expect(next.stash).toBeNull();
    expect(next.resolvedThisHand).toBe(0);
    expect(next.placedThisHand).toBe(1);
    expect(next.hand).toEqual(stage.hand);
  });

  it('보관함 블록이 들어가거나, 마지막 블록을 넣어 둘 수 있으면 막힘이 아니다', () => {
    const board = boardFrom(DIAGONAL_EMPTY);
    const square = hand(pieceOf('square'), null, null);
    expect(isStuck(withStash({ board, hand: square, stash: dot(900) }))).toBe(false);
    expect(isStuck(withStash({ board, hand: square, resolvedThisHand: 2 }))).toBe(false);
    expect(isStuck(stageWith({ board, hand: square, resolvedThisHand: 2 }))).toBe(true);
    expect(isStuck(withStash({ board, hand: square, resolvedThisHand: 2, stash: pieceOf('square', 0, 900) }))).toBe(true);
  });

  it('가방을 다시 섞을 때 보관함 블록은 빠진다', () => {
    const stage = createStage(setup());
    const stash = { ...dot(900), bagId: stage.pile[0] };
    const { stage: after, piece } = drawPiece({ ...stage, stash, pile: [] }, stage.hand);
    expect(piece.bagId).not.toBe(stash.bagId);
    expect(after.pile).not.toContain(stash.bagId);
    expect(after.pile).toHaveLength(18 - 3 - 1 - 1);
  });
});

describe('🎁 덤과 🍡 시루떡', () => {
  it('덤: 블록 4개를 받고, 3개를 놓으면 다음 핸드 (남은 하나는 내려놓는다)', () => {
    const stage = createStage(setup({ talismans: [talisman('extra')] }));
    expect(stage.hand).toHaveLength(4);
    const ready = { ...stage, board: emptyBoard(), bonus: {}, hand: hand(dot(), dot(1001), dot(1002), dot(1003)) };
    const two = place(place(ready, 0, 0, 0), 1, 2, 2);
    expect(two.handNumber).toBe(1);
    const three = place(two, 2, 4, 4);
    expect(three.handNumber).toBe(2);
    expect(three.hand).toHaveLength(4);
    expect(three.hand.every((p) => p !== null && p.uid !== 1003)).toBe(true);
  });

  it('시루떡: 판마다 핸드 +1', () => {
    expect(createStage(setup({ talismans: [talisman('riceCake')] })).rules.hands).toBe(6);
  });
});

describe('🧹 빗자루', () => {
  it('고른 칸의 가로줄이나 세로줄을 지우고 "한 줄" 점수를 받는다 (바위도 한 번에)', () => {
    const stage = stageWith({ board: boardFrom(['##R#', '#', '#']), consumables: [{ kind: 'broom' }] });
    const row = stageReducer(stage, { type: 'useConsumable', index: 0, cell: cellIndex(0, 2), axis: 'row' });
    expect(boardText(row.board).slice(0, 3)).toEqual(['........', '#.......', '#.......']);
    // 한 줄 10칩 + 블록 3칸 = 13, 연속 1
    expect(row.score).toBe(13);
    expect(row.streak).toBe(1);
    expect(row.lastClear).toMatchObject({ swept: true, shifted: false });
    expect(row.consumables).toHaveLength(0);
    const col = stageReducer(stage, { type: 'useConsumable', index: 0, cell: cellIndex(1, 0), axis: 'col' });
    expect(boardText(col.board).slice(0, 3)).toEqual(['.#R#....', '........', '........']);
    expect(col.score).toBe(13);
    // 빈 줄에는 못 쓴다
    expect(stageReducer(stage, { type: 'useConsumable', index: 0, cell: cellIndex(5, 5), axis: 'row' })).toBe(stage);
  });

  it('부적·강화 칸도 똑같이 적용되고, 목표를 넘기면 판 클리어', () => {
    const board = withCells(boardFrom(['########', '#']), { [cellIndex(0, 3)]: { kind: 'block', shape: 'dot', enh: 'fire' } });
    const stage = stageWith({ board, consumables: [{ kind: 'broom' }], talismans: [talisman('lamp', 1)], score: 140 });
    const next = stageReducer(stage, { type: 'useConsumable', index: 0, cell: 0, axis: 'row' });
    // (10 + 8) × (1 + 불꽃 2 + 호롱불 4)
    expect(next.score).toBe(140 + 18 * 7);
    expect(next.status).toBe('cleared');
  });

  it('막혔을 때 쓸 수 있는 소모품으로 친다 (모래시계는 아님)', () => {
    expect(hasRescue(stageWith({ consumables: [{ kind: 'broom' }] }))).toBe(true);
    expect(hasRescue(stageWith({ consumables: [{ kind: 'hourglass' }] }))).toBe(false);
    expect(hasRescue(stageWith({ consumables: [{ kind: 'stamp', enh: 'gold' }, { kind: 'ink' }] }))).toBe(false);
  });
});

describe('부적이 보는 판 상황', () => {
  it('🗿 장승: 한 핸드의 세 블록이 모두 줄을 지우면 세 번째 클리어에 ×3', () => {
    const board = boardFrom(['.#######', '.#######', '.#######', '#']);
    const stage = stageWith({ board, talismans: [talisman('totem', 1)], hand: hand(dot(), dot(1001), dot(1002)) });
    const first = place(stage, 0, 0, 0);
    const second = place(first, 1, 1, 0);
    expect(second.lastClear?.result.steps.some((s) => s.source === 1)).toBe(false);
    const third = place(second, 2, 2, 0);
    expect(third.lastClear?.result.steps.some((s) => s.source === 1)).toBe(true);
    expect(third.score).toBe(18 + 36 + 18 * 9);
  });

  it('💍 쌍가락지: 직전 클리어와 같은 족보면 ×2', () => {
    const board = boardFrom(['.#######', '.#######', '#']);
    const stage = stageWith({ board, talismans: [talisman('rings', 1)], hand: hand(dot(), dot(1001), null) });
    const first = place(stage, 0, 0, 0);
    expect(first.score).toBe(18);
    expect(place(first, 1, 1, 0).score).toBe(18 + 18 * 4);
  });

  it('🧱 돌담: 가장자리에 닿은 블록으로 지웠을 때만', () => {
    const edge = stageWith({ board: boardFrom(['', '', '', '.#######', '#']), talismans: [talisman('stoneWall', 1)], hand: hand(dot(), null, null) });
    expect(place(edge, 0, 3, 0).score).toBe(18 + 30);
    const inner = stageWith({ board: boardFrom(['', '', '', '###.####', '#']), talismans: [talisman('stoneWall', 1)], hand: hand(dot(), null, null) });
    expect(place(inner, 0, 3, 3).score).toBe(18);
  });

  it('🧭 사신도: 네 모서리가 찬 채로 지우면 ×2.5', () => {
    const board = boardFrom(['.######', '', '', '', '', '', '', '#......#']);
    const corners = withCells(board, { [cellIndex(0, 7)]: { kind: 'block', shape: 'dot' } });
    const stage = stageWith({ board: corners, talismans: [talisman('fourGods', 1)], hand: hand(dot(), null, null) });
    expect(place(stage, 0, 0, 0).score).toBe(Math.floor(18 * 2.5));
  });

  it('⛄ 눈사람: 대청소할 때마다 자란다', () => {
    const stage = stageWith({ board: boardFrom(['.#######']), talismans: [talisman('snowman', 1)], hand: hand(dot(), null, null) });
    const next = place(stage, 0, 0, 0);
    expect(next.talismans[0].counter).toBe(1);
    expect(next.score).toBe(Math.floor(18 * 1.5 * 3));
  });

  it('🐸 두꺼비: 대청소하면 +$5', () => {
    const stage = stageWith({ board: boardFrom(['.#######']), talismans: [talisman('toad', 1)], hand: hand(dot(), null, null) });
    expect(place(stage, 0, 0, 0).goldEarned).toBe(5);
  });
});

describe('📜 두루마리 칸', () => {
  it('덮은 블록이 지워지면 비전서 1장 (소모품 칸이 비어 있을 때만)', () => {
    const ready = { board: boardFrom(['.#######', '#']), bonus: { 0: 'scroll' as const }, hand: hand(dot(), null, null) };
    const next = place(stageWith(ready), 0, 0, 0);
    expect(next.consumables).toHaveLength(1);
    expect(next.consumables[0].kind).toBe('scroll');
    expect(next.lastClear?.scrolls).toBe(1);
    const full = stageWith({ ...ready, consumables: [{ kind: 'hammer' }, { kind: 'fan' }] });
    expect(place(full, 0, 0, 0).consumables).toHaveLength(2);
  });

  it('보너스 칸은 보석 50%, 별 35%, 두루마리 15%', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      for (const kind of Object.values(createStage(setup({ seed: `B${i}` })).bonus)) counts[kind] = (counts[kind] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.gem / total).toBeCloseTo(0.5, 1);
    expect(counts.star / total).toBeCloseTo(0.35, 1);
    expect(counts.scroll / total).toBeCloseTo(0.15, 1);
  });
});

describe('↩ 되돌리기 (판마다 1번 무료)', () => {
  const ready = () =>
    stageWith({ board: boardFrom(['.#######', '#']), hand: hand(dot(), dot(1001), dot(1002)) });

  it('마지막에 놓은 블록을 되돌린다 (점수·판·손 모두), 판마다 1번', () => {
    const before = ready();
    expect(before.undoLeft).toBe(1);
    const placed = place(before, 0, 0, 0);
    expect(placed.score).toBe(18);
    expect(canUndo(placed)).toBe(true);
    const undone = stageReducer(placed, { type: 'undo' });
    expect(undone.score).toBe(0);
    expect(undone.board).toEqual(before.board);
    expect(undone.hand).toEqual(before.hand);
    expect(undone.undoLeft).toBe(0);
    expect(undone.toast?.text).toContain('되돌렸어요');
    // 다시 놓아도 이번 판에는 더 못 되돌린다
    const again = place(undone, 0, 0, 0);
    expect(canUndo(again)).toBe(false);
    expect(stageReducer(again, { type: 'undo' })).toBe(again);
  });

  it('놓은 뒤 다른 걸 하면 못 되돌린다', () => {
    const placed = place(ready(), 0, 0, 0);
    const discarded = stageReducer(placed, { type: 'discard', slot: 1 });
    expect(discarded.undo).toBeNull();
    expect(stageReducer(discarded, { type: 'undo' })).toBe(discarded);
    expect(stageReducer(ready(), { type: 'undo' }).undoLeft).toBe(1);
  });

  it('되돌릴 수 있으면 막혀도 바로 끝나지 않는다', () => {
    const stage = stageWith({ hand: hand(dot(), dot(1001), null) });
    expect(hasRescue(stage)).toBe(false);
    expect(hasRescue(place(stage, 0, 4, 4))).toBe(true);
  });
});
