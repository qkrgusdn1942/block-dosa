import { BOARD_SIZE, type StageRules } from './balance';
import { ALL_SHAPES } from './blocks';
import { cellIndex, emptyCells, shiftRowRight, wouldCompleteLine } from '../core/board';
import { extent, orientations } from '../core/pieces';
import type { Rng } from '../core/rng';
import type { StageState } from '../core/stage';

/** 요괴 = 특수 규칙이 붙은 보스 판 → docs/09-obstacles.md (일반 9종 + 이무기) */

export type BossId =
  | 'dokkaebi'
  | 'gumiho'
  | 'eodukssini'
  | 'mulgwishin'
  | 'grimReaper'
  | 'bulgasari'
  | 'gangcheol'
  | 'dueoksini'
  | 'jangsanbeom'
  | 'imugi';

export interface BossDef {
  id: BossId;
  name: string;
  emoji: string;
  rule: string;
  /** 처음 나올 수 있는 고개 */
  minAnte: number;
  /** 고개 기본 목표 대비 배율 */
  targetMult: number;
  /** 고개 8 고정 최종 요괴 */
  final?: boolean;
  /** 판 시작 (바위·보너스 칸보다 먼저) */
  onStageStart?: (stage: StageState, rng: Rng) => StageState;
  /** 부적·수련까지 반영한 핸드·버리기 수를 마지막에 바꾼다 */
  adjustRules?: (rules: StageRules) => StageRules;
  /** 핸드를 막 뽑은 뒤 */
  onHandDraw?: (stage: StageState, rng: Rng) => StageState;
  /** 핸드가 끝난 뒤, 다음 핸드를 뽑기 전. 여기서 꽉 찬 줄은 이어서 지워진다 */
  onHandEnd?: (stage: StageState, rng: Rng) => StageState;
  /** 블록 강화 효과를 끈다 */
  disablesEnhancements?: boolean;
  /** 이번 판에서 골드를 못 얻는다 */
  drought?: boolean;
  /** 한 줄 클리어는 점수 0 */
  singlesWorthless?: boolean;
}

const WATER_ROWS = 2;
const SHADOW_ROCKS_PER_HAND = 2;

const defs: BossDef[] = [
  {
    id: 'dokkaebi',
    name: '도깨비',
    emoji: '👹',
    rule: '핸드를 받을 때마다 블록 1개가 가방에 없는 모양으로 바뀐다. 뚝딱!',
    minAnte: 1,
    targetMult: 2,
    onHandDraw: (stage, rng) => {
      const slots = stage.hand.flatMap((piece, i) => (piece ? [i] : []));
      if (slots.length === 0) return stage;
      const slot = slots[rng.int(slots.length)];
      const piece = stage.hand[slot]!;
      const inBag = new Set(stage.bag.map((entry) => entry.shape));
      let options = ALL_SHAPES.filter((shape) => !inBag.has(shape));
      if (options.length === 0) options = ALL_SHAPES.filter((shape) => shape !== piece.shape);
      const shape = options[rng.int(options.length)];
      const choices = orientations(shape);
      const cells = choices[rng.int(choices.length)];
      const changed = { ...piece, shape, cells, ...extent(cells), transformed: true };
      return { ...stage, hand: stage.hand.map((p, i) => (i === slot ? changed : p)) };
    },
  },
  {
    id: 'gumiho',
    name: '구미호',
    emoji: '🦊',
    rule: '판이 시작될 때 부적 1개를 이번 판 동안 봉인한다',
    minAnte: 1,
    targetMult: 2,
    onStageStart: (stage, rng) =>
      stage.talismans.length === 0
        ? stage
        : { ...stage, sealedUid: stage.talismans[rng.int(stage.talismans.length)].uid },
  },
  {
    id: 'eodukssini',
    name: '어둑시니',
    emoji: '🌑',
    rule: '핸드가 끝날 때마다 빈칸 2곳에 그림자 바위가 생긴다',
    minAnte: 2,
    targetMult: 2,
    onHandEnd: (stage, rng) => {
      let board = stage.board;
      for (let i = 0; i < SHADOW_ROCKS_PER_HAND; i++) {
        // 보너스 칸은 덮지 않고, 바위만으로 줄이 완성되는 자리도 피한다
        const candidates = emptyCells(board).filter(
          (index) => stage.bonus[index] === undefined && !wouldCompleteLine(board, index),
        );
        if (candidates.length === 0) break;
        const next = board.slice();
        next[candidates[rng.int(candidates.length)]] = { kind: 'rock', cracked: false, shadow: true };
        board = next;
      }
      return { ...stage, board };
    },
  },
  {
    id: 'mulgwishin',
    name: '물귀신',
    emoji: '🌊',
    rule: '맨 아래 2줄이 물에 잠긴다. 세로줄은 남은 6칸만 채우면 지워진다',
    minAnte: 2,
    targetMult: 2,
    onStageStart: (stage) => {
      const board = stage.board.slice();
      for (let r = BOARD_SIZE - WATER_ROWS; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) board[cellIndex(r, c)] = { kind: 'water' };
      }
      return { ...stage, board };
    },
  },
  {
    id: 'grimReaper',
    name: '저승사자',
    emoji: '💀',
    rule: '핸드 −1, 버리기 0',
    minAnte: 3,
    targetMult: 2,
    adjustRules: (rules) => ({ ...rules, hands: Math.max(1, rules.hands - 1), discards: 0 }),
  },
  {
    id: 'bulgasari',
    name: '불가사리',
    emoji: '🐻',
    rule: '쇠를 먹는 괴물: 블록 강화 효과가 모두 꺼진다',
    minAnte: 3,
    targetMult: 2,
    disablesEnhancements: true,
  },
  {
    id: 'gangcheol',
    name: '강철이',
    emoji: '🔥',
    rule: '가뭄을 부르는 용: 이번 판에서는 골드를 하나도 못 얻는다 (보상·이자 포함)',
    minAnte: 2,
    targetMult: 2,
    drought: true,
  },
  {
    id: 'dueoksini',
    name: '두억시니',
    emoji: '👊',
    rule: '한 줄 클리어는 점수 0. 두 줄 이상 한꺼번에 지워야 점수가 들어온다',
    minAnte: 3,
    targetMult: 2,
    singlesWorthless: true,
  },
  {
    id: 'jangsanbeom',
    name: '장산범',
    emoji: '🐅',
    rule: '핸드마다 블록 1개가 ?로 가려진다. ?는 그 핸드의 마지막 블록으로만 집을 수 있다 (다른 블록을 놓을 데가 없으면 풀림)',
    minAnte: 2,
    targetMult: 2,
    onHandDraw: (stage, rng) => {
      const slots = stage.hand.flatMap((piece, i) => (piece ? [i] : []));
      if (slots.length === 0) return stage;
      const slot = slots[rng.int(slots.length)];
      return { ...stage, hand: stage.hand.map((p, i) => (i === slot && p ? { ...p, hidden: true } : p)) };
    },
  },
  {
    id: 'imugi',
    name: '이무기',
    emoji: '🐍',
    rule: '핸드가 끝날 때마다 화살표 줄이 오른쪽으로 한 칸 밀린다. 밀려서 채워진 세로줄은 지워지고 점수도 들어온다',
    minAnte: 8,
    targetMult: 3,
    final: true,
    onHandDraw: (stage, rng) => ({ ...stage, shiftRow: rng.int(BOARD_SIZE) }),
    onHandEnd: (stage) =>
      stage.shiftRow === null ? stage : { ...stage, board: shiftRowRight(stage.board, stage.shiftRow) },
  },
];

export const BOSSES = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<BossId, BossDef>;
export const REGULAR_BOSSES: readonly BossDef[] = defs.filter((d) => !d.final);
export const FINAL_BOSS: BossId = 'imugi';
