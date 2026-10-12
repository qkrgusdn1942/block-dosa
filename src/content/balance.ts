/** 밸런스 수치. 모두 초기값 → docs/02-scoring.md, docs/07-economy.md, docs/08-difficulty.md */

export const BOARD_SIZE = 8;
export const HAND_SIZE = 3;

// 런 구조
export const ANTE_COUNT = 8;
/** finale = 오늘의 판 마지막 "끝판" (목표 없이 핸드를 다 쓸 때까지 점수 내기) */
export type StageKind = 'small' | 'big' | 'boss' | 'finale';
export const STAGE_KINDS: readonly StageKind[] = ['small', 'big', 'boss', 'finale'];
export const STAGE_NAMES: Record<StageKind, string> = { small: '판 1', big: '판 2', boss: '요괴 판', finale: '끝판' };

/** 오늘의 판 코스: 고개 3까지 + 끝판 → docs/10-social.md */
export const DAILY_ANTES = 3;

/** 고개별 기본 목표 점수 (판 1 기준) */
export const ANTE_TARGETS: readonly number[] = [150, 400, 1_000, 2_500, 6_000, 15_000, 35_000, 80_000];
/** 판 1, 판 2의 목표 배율. 요괴 판은 요괴마다 다름 (보통 ×2, 이무기 ×3) */
export const STAGE_TARGET_MULT: Record<'small' | 'big', number> = { small: 1, big: 1.5 };

export interface StageRules {
  hands: number;
  discards: number;
  target: number;
}

export const BASE_HANDS = 5;
export const BASE_DISCARDS = 2;
export const TALISMAN_SLOTS = 5;
export const CONSUMABLE_SLOTS = 2;
export const MIN_BAG_SIZE = 10;

/** 고개별 바위 수 [판 1, 판 2]. 요괴 판에는 없다 */
export const ROCKS_BY_ANTE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 0],
  [0, 2],
  [0, 2],
  [2, 3],
  [2, 3],
  [3, 4],
  [3, 4],
];
/** 판마다 0~2개 */
export const MAX_BONUS_CELLS = 2;

// 경제
export const START_GOLD = 4;
export const STAGE_REWARD: Record<StageKind, number> = { small: 3, big: 4, boss: 5, finale: 0 };
export const GOLD_PER_HAND_LEFT = 1;
/** 보유 골드 $5당 이자 $1 */
export const INTEREST_STEP = 5;
export const INTEREST_CAP = 5;
export const GEM_GOLD = 3;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITY_NAMES: Record<Rarity, string> = { common: '일반', uncommon: '고급', rare: '희귀', legendary: '전설' };
export const TALISMAN_PRICE: Record<Rarity, number> = { common: 4, uncommon: 6, rare: 8, legendary: 20 };
/** 장터 부적 등급 확률 */
export const SHOP_RARITY_WEIGHTS: ReadonlyArray<readonly [Rarity, number]> = [
  ['common', 70],
  ['uncommon', 25],
  ['rare', 5],
];
/** 요괴 유품 부적 등급 확률 (고급 이상) */
export const RELIC_RARITY_WEIGHTS: ReadonlyArray<readonly [Rarity, number]> = [
  ['uncommon', 25],
  ['rare', 5],
];
export const CONSUMABLE_PRICE = 3;
export const PACK_PRICE = 4;
export const REMOVAL_PRICE = 3;
export const REROLL_BASE = 3;
export const SHOP_TALISMAN_COUNT = 2;
export const SHOP_CONSUMABLE_COUNT = 2;
export const PACK_CHOICES = 3;

// 공덕 (메타 재화) → docs/06-incremental.md
export const MERIT_PER_ANTE = 10;
export const MERIT_PER_BOSS = 5;
export const MERIT_ENDING = 50;
/** 처음 달성 (고개 N 첫 도달, 첫 엔딩) 1번만 */
export const MERIT_FIRST = 20;

// 점수
export type PatternId = 'single' | 'double' | 'cross' | 'triple' | 'quad';
export const PATTERN_IDS: readonly PatternId[] = ['single', 'double', 'cross', 'triple', 'quad'];
export type PatternLevels = Record<PatternId, number>;
export const BASE_LEVELS: PatternLevels = { single: 1, double: 1, cross: 1, triple: 1, quad: 1 };

export interface PatternDef {
  name: string;
  chips: number;
  mult: number;
  chipsPerLevel: number;
  multPerLevel: number;
}

export const PATTERNS: Record<PatternId, PatternDef> = {
  single: { name: '한 줄', chips: 10, mult: 1, chipsPerLevel: 10, multPerLevel: 1 },
  double: { name: '두 줄', chips: 25, mult: 2, chipsPerLevel: 15, multPerLevel: 1 },
  cross: { name: '십자', chips: 35, mult: 3, chipsPerLevel: 20, multPerLevel: 2 },
  triple: { name: '세 줄', chips: 50, mult: 4, chipsPerLevel: 25, multPerLevel: 2 },
  quad: { name: '네 줄+', chips: 80, mult: 6, chipsPerLevel: 35, multPerLevel: 3 },
};

/** 지운 칸 1개당 칩 (바위는 0) */
export const CELL_CHIPS = 1;
/** ⭐ 별 칸이 포함된 클리어 최종 곱 */
export const STAR_MULT = 2;
/** 대청소(지운 뒤 판이 완전히 빔) 최종 곱 */
export const PERFECT_CLEAR_MULT = 3;
