import { describe, expect, it } from 'vitest';
import { BOMB_FUSE, OBSTACLE_COUNT } from '../src/content/obstacles';
import { cellIndex, neighbors } from '../src/core/board';
import { createRun, obstacleFor } from '../src/core/run';
import { createStage, drawPiece, stageReducer, type StageState } from '../src/core/stage';
import type { Piece } from '../src/core/pieces';
import { boardFrom, boardText, pieceOf, setup, stageWith } from './helpers';

const dot = (uid = 1000) => pieceOf('dot', 0, uid);
const hand = (...pieces: Array<Piece | null>) => pieces;
const place = (stage: StageState, slot: number, row: number, col: number) =>
  stageReducer(stage, { type: 'place', slot, row, col });
const cellsOf = (stage: StageState, kind: string) =>
  stage.board.flatMap((cell, i) => (cell?.kind === kind ? [i] : []));

describe('🔒 자물쇠', () => {
  it('자물쇠가 있는 줄은 꽉 차도 안 지워진다', () => {
    const stage = stageWith({ board: boardFrom(['.######L']), hand: hand(dot(), dot(1001), null) });
    const next = place(stage, 0, 0, 0);
    expect(next.score).toBe(0);
    expect(boardText(next.board)[0]).toBe('#######L');
  });

  it('바로 옆 칸이 지워지면 풀려서 빈칸이 된다', () => {
    const board = boardFrom(['#######L', '.#######', '#']);
    const next = place(stageWith({ board, hand: hand(dot(), dot(1001), null) }), 0, 1, 0);
    expect(next.lastClear?.result.pattern).toBe('single');
    expect(boardText(next.board).slice(0, 2)).toEqual(['#######.', '........']);
  });
});

describe('🧊 얼음 블록', () => {
  it('언 칸은 줄이 지워질 때 얼음만 깨지고 남는다 (칩도 안 준다)', () => {
    const stage = stageWith({ board: boardFrom(['.**#####']), hand: hand(dot(), dot(1001), null) });
    const next = place(stage, 0, 0, 0);
    expect(boardText(next.board)[0]).toBe('.##.....');
    expect(next.score).toBe(10 + 6);
    expect(next.lastClear?.cleared.filter((c) => c.outcome === 'thawed')).toHaveLength(2);
  });

  it('얼음 판에서는 뽑은 블록이 가끔 얼어 있고, 놓으면 언 칸이 된다', () => {
    let stage = createStage(setup({ ante: 4, kind: 'big', obstacle: 'ice' }));
    let frozen = 0;
    for (let i = 0; i < 200; i++) {
      const drawn = drawPiece({ ...stage, pile: stage.pile.length ? stage.pile : [] }, []);
      stage = drawn.stage;
      if (drawn.piece.frozen) frozen++;
    }
    expect(frozen / 200).toBeGreaterThan(0.15);
    expect(frozen / 200).toBeLessThan(0.45);
    const plain = createStage(setup({ ante: 4, kind: 'big' }));
    expect(plain.hand.some((p) => p?.frozen)).toBe(false);
    const icy = { ...dot(), frozen: true };
    const placed = place(stageWith({ hand: hand(icy, dot(1001), null) }), 0, 4, 4);
    expect(placed.board[cellIndex(4, 4)]).toMatchObject({ kind: 'block', frozen: true });
  });
});

describe('🌿 이끼', () => {
  it('핸드가 끝날 때마다 옆 빈칸으로 한 칸 번진다', () => {
    const board = boardFrom(['', '', '', '', '....M']);
    const stage = stageWith({ obstacle: 'moss', board, hand: hand(dot(), null, null) });
    const next = place(stage, 0, 0, 0);
    const moss = cellsOf(next, 'moss');
    expect(moss).toHaveLength(2);
    expect(neighbors(cellIndex(4, 4))).toContain(moss.find((i) => i !== cellIndex(4, 4)));
  });

  it('줄로 지우면 사라지고, 번질 이끼가 없으면 그대로', () => {
    const board = boardFrom(['.###M###', '#']);
    const stage = stageWith({ obstacle: 'moss', board, hand: hand(dot(), null, null) });
    const next = place(stage, 0, 0, 0);
    expect(cellsOf(next, 'moss')).toHaveLength(0);
  });

  it('번져서 줄이 완성되는 자리는 피한다', () => {
    // 맨 윗줄은 (0, 3)만 비어 있고, 이끼의 다른 이웃은 (1, 4)뿐
    const board = boardFrom(['###.M###', '###.#']);
    const stage = stageWith({ obstacle: 'moss', board, hand: hand(dot(), null, null) });
    const next = place(stage, 0, 7, 7);
    expect(next.board[cellIndex(0, 3)]).toBeNull();
  });
});

describe('💣 시한폭탄', () => {
  it('핸드가 끝날 때마다 초읽기, 0이 되면 그 자리와 옆 빈칸이 바위', () => {
    const board = boardFrom(['', '', '', '', '....B']);
    const stage = stageWith({ obstacle: 'bomb', board, hand: hand(dot(), null, null) });
    const ticked = place(stage, 0, 0, 0);
    expect(ticked.board[cellIndex(4, 4)]).toEqual({ kind: 'bomb', fuse: BOMB_FUSE - 1 });

    const last = stageWith({
      obstacle: 'bomb',
      board: boardFrom(['', '', '', '', '....B']).map((c) => (c?.kind === 'bomb' ? { kind: 'bomb' as const, fuse: 1 } : c)),
      hand: hand(dot(), null, null),
    });
    const boom = place(last, 0, 0, 0);
    expect(boardText(boom.board).slice(3, 6)).toEqual(['....R...', '...RRR..', '....R...']);
    expect(boom.toast?.text).toContain('펑');
  });

  it('줄로 지우면 사라진다 (칩은 없음)', () => {
    const stage = stageWith({ obstacle: 'bomb', board: boardFrom(['.###B###', '#']), hand: hand(dot(), null, null) });
    const next = place(stage, 0, 0, 0);
    expect(cellsOf(next, 'bomb')).toHaveLength(0);
    expect(next.score).toBe(10 + 7);
  });
});

describe('🕸️ 저주 칸', () => {
  it('저주 칸을 덮은 블록이 지워지면 그 클리어 점수 절반', () => {
    const stage = stageWith({ board: boardFrom(['.#######', '#']), bonus: { 0: 'curse' }, hand: hand(dot(), null, null) });
    const next = place(stage, 0, 0, 0);
    expect(next.score).toBe(9);
    expect(next.lastClear?.curses).toBe(1);
    expect(next.bonus).toEqual({});
  });
});

describe('방해 칸 배치', () => {
  it('판 시작 때 정해진 개수만큼, 보너스 칸·바위와 겹치지 않게', () => {
    for (const seed of ['A', 'B', 'C']) {
      const lock = createStage(setup({ seed, ante: 6, kind: 'big', obstacle: 'lock' }));
      expect(cellsOf(lock, 'lock').length).toBeLessThanOrEqual(OBSTACLE_COUNT.lock);
      expect(cellsOf(lock, 'lock').length).toBeGreaterThan(0);
      for (const i of cellsOf(lock, 'lock')) expect(lock.bonus[i]).toBeUndefined();

      const bomb = createStage(setup({ seed, ante: 6, kind: 'big', obstacle: 'bomb' }));
      for (const i of cellsOf(bomb, 'bomb')) expect(bomb.board[i]).toEqual({ kind: 'bomb', fuse: BOMB_FUSE });

      const moss = createStage(setup({ seed, ante: 6, kind: 'big', obstacle: 'moss' }));
      expect(cellsOf(moss, 'moss')).toHaveLength(OBSTACLE_COUNT.moss);

      const curse = createStage(setup({ seed, ante: 6, kind: 'big', obstacle: 'curse' }));
      expect(Object.values(curse.bonus).filter((b) => b === 'curse')).toHaveLength(OBSTACLE_COUNT.curse);
    }
  });

  it('고개 4부터 판 2, 고개 6부터 판 1에도. 요괴 판에는 없다', () => {
    const run = createRun('HAZARD');
    expect(obstacleFor(run, 3, 'big')).toBeNull();
    expect(obstacleFor(run, 4, 'big')).not.toBeNull();
    expect(obstacleFor(run, 5, 'small')).toBeNull();
    expect(obstacleFor(run, 6, 'small')).not.toBeNull();
    expect(obstacleFor(run, 8, 'boss')).toBeNull();
    expect(obstacleFor(run, 4, 'big')).toBe(obstacleFor(run, 4, 'big'));
    const atFour = createRun('HAZARD', { start: { ante: 4, kind: 'big' } });
    expect(atFour.stage.obstacle).toBe(obstacleFor(run, 4, 'big'));
  });
});
