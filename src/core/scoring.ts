import {
  CELL_CHIPS,
  PATTERNS,
  PERFECT_CLEAR_MULT,
  STAR_MULT,
  type PatternId,
  type PatternLevels,
} from '../content/balance';
import type { ShapeKind } from '../content/blocks';
import { CRYSTAL_CHIPS, FIRE_MULT, GLASS_MULT } from '../content/enhancements';
import { CURSE_MULT } from '../content/obstacles';

/** 동시에 지운 가로·세로 줄 수로 족보를 정한다 */
export function classifyPattern(rows: number, cols: number): PatternId | null {
  const total = rows + cols;
  if (total === 0) return null;
  if (total === 1) return 'single';
  if (total === 2) return rows === 1 ? 'cross' : 'double';
  if (total === 3) return 'triple';
  return 'quad';
}

/** 지운 칸 중 강화 칸 (🐻 불가사리 판에서는 모두 0) */
export interface EnhanceTally {
  crystal: number;
  fire: number;
  /** 행운이 터져서 붙는 배수 */
  lucky: number;
  /** 유리 블록 수 (블록당 ×GLASS_MULT) */
  glass: number;
}

export interface ClearContext {
  rows: number;
  cols: number;
  /** 지운 블록 칸 수 (바위·겹친 칸 제외) */
  cellCount: number;
  /** 이번 클리어를 포함한 연속 횟수 */
  streak: number;
  /** 지운 뒤 판이 완전히 비었는지 */
  perfect: boolean;
  /** 지운 칸 중 ⭐ 별 칸 수 */
  stars: number;
  /** 지운 칸 중 🕸️ 저주 칸 수 */
  curses?: number;
  /** 줄을 완성한 블록의 분류. 이무기가 줄을 밀어서 지워졌으면 null */
  pieceKind: ShapeKind | null;
  /** 지우기 직전 / 지운 뒤 판에 채워진 칸 수 (블록 + 바위) */
  filledBefore: number;
  filledAfter: number;
  levels?: Partial<PatternLevels>;
  /** 줄을 완성한 블록이 판 가장자리에 닿았는지 (🧱 돌담) */
  pieceTouchesEdge?: boolean;
  /** 직전 클리어의 족보 (💍 쌍가락지) */
  previousPattern?: PatternId | null;
  /** 지우기 직전 네 모서리가 모두 찼는지 (🧭 사신도) */
  cornersFilled?: boolean;
  /** 이번 핸드에서 판에 놓은 블록 수 / 그중 줄을 지운 수, 이번 것 포함 (🗿 장승) */
  handPlaced?: number;
  handClears?: number;
  enhance?: EnhanceTally;
  /** 👊 두억시니: 한 줄 클리어는 0점 */
  singlesWorthless?: boolean;
}

export interface Tally {
  chips: number;
  mult: number;
}

export type StepKind =
  | 'pattern'
  | 'cells'
  | 'enhance'
  | 'streak'
  | 'modifier'
  | 'star'
  | 'glass'
  | 'curse'
  | 'perfect'
  | 'void';

export interface ScoreStep extends Tally {
  kind: StepKind;
  label: string;
  /** 부적이 낸 단계면 그 부적의 uid */
  source?: number;
  /** "+4 배수" 같은 짧은 설명 */
  note?: string;
}

export interface ScoreResult extends Tally {
  pattern: PatternId;
  total: number;
  /** 단계별 계산 과정 (화면에 보여주기용) */
  steps: ScoreStep[];
}

/** 계산 4단계(부적)에 끼어드는 효과. 바꿀 게 없으면 null */
export type ScoreModifier = (ctx: ClearContext, tally: Tally) => ScoreStep | null;

/** 끝없는 모드에서 숫자가 끝없이 커져도 저장(JSON)이 깨지지 않게 상한을 둔다 */
export const MAX_SCORE = 1e300;

/** 계산 순서 → docs/02-scoring.md */
export function scoreClear(ctx: ClearContext, modifiers: readonly ScoreModifier[] = []): ScoreResult {
  const pattern = classifyPattern(ctx.rows, ctx.cols);
  if (!pattern) throw new Error('지운 줄이 없으면 점수를 계산할 수 없습니다');

  // 1. 족보
  const def = PATTERNS[pattern];
  const level = ctx.levels?.[pattern] ?? 1;
  let tally: Tally = {
    chips: def.chips + def.chipsPerLevel * (level - 1),
    mult: def.mult + def.multPerLevel * (level - 1),
  };
  const steps: ScoreStep[] = [{ kind: 'pattern', label: level > 1 ? `${def.name} Lv.${level}` : def.name, ...tally }];
  const apply = (step: ScoreStep) => {
    tally = { chips: step.chips, mult: step.mult };
    steps.push(step);
  };

  // 2. 지운 칸, 강화 칸
  apply({ kind: 'cells', label: `칸 ${ctx.cellCount}개`, chips: tally.chips + ctx.cellCount * CELL_CHIPS, mult: tally.mult });
  const enhance = ctx.enhance;
  if (enhance && (enhance.crystal > 0 || enhance.fire > 0 || enhance.lucky > 0)) {
    apply({
      kind: 'enhance',
      label: '강화 칸',
      chips: tally.chips + enhance.crystal * CRYSTAL_CHIPS,
      mult: tally.mult + enhance.fire * FIRE_MULT + enhance.lucky,
    });
  }

  // 3. 연속
  if (ctx.streak > 1) {
    apply({ kind: 'streak', label: `연속 ${ctx.streak}`, chips: tally.chips, mult: tally.mult + (ctx.streak - 1) });
  }

  // 4. 부적 (왼쪽부터)
  for (const modifier of modifiers) {
    const step = modifier(ctx, tally);
    if (step) apply(step);
  }

  // 5. 최종 곱
  for (let i = 0; i < ctx.stars; i++) {
    apply({ kind: 'star', label: '별 칸', chips: tally.chips, mult: tally.mult * STAR_MULT });
  }
  for (let i = 0; i < (enhance?.glass ?? 0); i++) {
    apply({ kind: 'glass', label: '유리', chips: tally.chips, mult: tally.mult * GLASS_MULT });
  }
  for (let i = 0; i < (ctx.curses ?? 0); i++) {
    apply({ kind: 'curse', label: '저주 칸', chips: tally.chips, mult: tally.mult * CURSE_MULT });
  }
  if (ctx.perfect) {
    apply({ kind: 'perfect', label: '대청소', chips: tally.chips, mult: tally.mult * PERFECT_CLEAR_MULT });
  }

  // 6. 점수
  let total = Math.floor(tally.chips * tally.mult);
  if (ctx.singlesWorthless && pattern === 'single') {
    apply({ kind: 'void', label: '두억시니', chips: tally.chips, mult: 0 });
    total = 0;
  }
  if (!Number.isFinite(total) || total > MAX_SCORE) total = MAX_SCORE;
  return { pattern, ...tally, total, steps };
}
