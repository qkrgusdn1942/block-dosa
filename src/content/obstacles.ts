import { emptyCells, neighbors, scatterCells, wouldCompleteLine, type Board } from '../core/board';
import type { Rng } from '../core/rng';
import type { StageState } from '../core/stage';

/** 방해 칸: 고개 4부터 일반 판에 판마다 1종 → docs/09-obstacles.md */

export type ObstacleId = 'ice' | 'lock' | 'moss' | 'bomb' | 'curse';

export const OBSTACLE_IDS: readonly ObstacleId[] = ['ice', 'lock', 'moss', 'bomb', 'curse'];

export interface ObstacleDef {
  id: ObstacleId;
  name: string;
  emoji: string;
  rule: string;
  /** 판 시작 (바위·보너스 칸을 놓은 다음) */
  onStageStart?: (stage: StageState, rng: Rng) => StageState;
  /** 핸드가 끝난 뒤 (요괴 효과 다음). 여기서 꽉 찬 줄은 생기지 않게 한다 */
  onHandEnd?: (stage: StageState, rng: Rng) => StageState;
}

/** 얼음 판에서 뽑은 블록이 얼어 있을 확률 */
export const ICE_CHANCE = 0.3;
/** 판 시작 때 놓는 개수 */
export const OBSTACLE_COUNT: Record<Exclude<ObstacleId, 'ice'>, number> = { lock: 2, moss: 1, bomb: 2, curse: 2 };
/** 시한폭탄이 터지기까지 남은 핸드 */
export const BOMB_FUSE = 3;
/** 저주 칸이 포함된 클리어 최종 곱 */
export const CURSE_MULT = 0.5;

const bonusCells = (stage: StageState) => new Set(Object.keys(stage.bonus).map(Number));

/** 보너스 칸이 아니고, 채워도 줄이 완성되지 않는 빈칸 (방해 칸이 공짜 점수를 주지 않게) */
const quietEmpty = (stage: StageState, board: Board, index: number) =>
  board[index] === null && stage.bonus[index] === undefined && !wouldCompleteLine(board, index);

const withToast = (stage: StageState, text: string): StageState => ({
  ...stage,
  toast: { id: (stage.toast?.id ?? 0) + 1, text },
});

const defs: ObstacleDef[] = [
  {
    id: 'ice',
    name: '얼음 블록',
    emoji: '🧊',
    rule: '뽑는 블록이 가끔 얼어 있다. 언 칸은 줄이 지워질 때 얼음만 깨지고 칸은 남는다',
  },
  {
    id: 'lock',
    name: '자물쇠',
    emoji: '🔒',
    rule: '자물쇠가 있는 줄은 꽉 차도 안 지워진다. 바로 옆(상하좌우) 칸이 지워지면 풀린다',
    onStageStart: (stage, rng) => ({
      ...stage,
      board: scatterCells(stage.board, OBSTACLE_COUNT.lock, rng, () => ({ kind: 'lock' }), bonusCells(stage)),
    }),
  },
  {
    id: 'moss',
    name: '이끼',
    emoji: '🌿',
    rule: '핸드가 끝날 때마다 옆 빈칸으로 한 칸 번진다. 줄로 지우면 사라진다',
    onStageStart: (stage, rng) => ({
      ...stage,
      board: scatterCells(stage.board, OBSTACLE_COUNT.moss, rng, () => ({ kind: 'moss' }), bonusCells(stage)),
    }),
    onHandEnd: (stage, rng) => {
      const { board } = stage;
      const moss = board.flatMap((cell, i) => (cell?.kind === 'moss' ? [i] : []));
      const targets = [...new Set(moss.flatMap(neighbors))]
        .filter((index) => quietEmpty(stage, board, index))
        .sort((a, b) => a - b);
      if (targets.length === 0) return stage;
      const next = board.slice();
      next[targets[rng.int(targets.length)]] = { kind: 'moss' };
      return { ...stage, board: next };
    },
  },
  {
    id: 'bomb',
    name: '시한폭탄',
    emoji: '💣',
    rule: '핸드 3번 안에 줄로 지우지 못하면 터져서 그 자리와 옆 빈칸이 바위가 된다',
    onStageStart: (stage, rng) => ({
      ...stage,
      board: scatterCells(
        stage.board,
        OBSTACLE_COUNT.bomb,
        rng,
        () => ({ kind: 'bomb', fuse: BOMB_FUSE }),
        bonusCells(stage),
      ),
    }),
    onHandEnd: (stage) => {
      const board = stage.board.slice();
      let exploded = false;
      board.forEach((cell, index) => {
        if (cell?.kind !== 'bomb') return;
        if (cell.fuse > 1) {
          board[index] = { kind: 'bomb', fuse: cell.fuse - 1 };
          return;
        }
        board[index] = { kind: 'rock', cracked: false };
        for (const near of neighbors(index)) {
          if (quietEmpty(stage, board, near)) board[near] = { kind: 'rock', cracked: false };
        }
        exploded = true;
      });
      const next = { ...stage, board };
      return exploded ? withToast(next, '💣 펑! 시한폭탄이 터져서 바위가 생겼어요') : next;
    },
  },
  {
    id: 'curse',
    name: '저주 칸',
    emoji: '🕸️',
    rule: '저주 칸을 덮은 블록이 지워지면 그 클리어 점수가 절반',
    onStageStart: (stage, rng) => {
      const bonus = { ...stage.bonus };
      for (let i = 0; i < OBSTACLE_COUNT.curse; i++) {
        const candidates = emptyCells(stage.board).filter((index) => bonus[index] === undefined);
        if (candidates.length === 0) break;
        bonus[candidates[rng.int(candidates.length)]] = 'curse';
      }
      return { ...stage, bonus };
    },
  },
];

export const OBSTACLES = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<ObstacleId, ObstacleDef>;
