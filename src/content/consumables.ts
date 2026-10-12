import { PATTERNS, STAMP_BLOCKS, type PatternId } from './balance';
import { ENHANCEMENTS, type Enhancement } from './enhancements';

/** 소모품 → docs/03-roguelike.md */
export type Consumable =
  | { kind: 'scroll'; pattern: PatternId }
  | { kind: 'hammer' }
  | { kind: 'fan' }
  | { kind: 'broom' }
  | { kind: 'stamp'; enh: Enhancement }
  | { kind: 'ink' }
  | { kind: 'hourglass' };

/** 어디서 쓸 수 있나: 판 진행 중 / 장터 등 판 밖 / 어디서나 */
export type ConsumableUse = 'stage' | 'shop' | 'anywhere';

export interface ConsumableInfo {
  emoji: string;
  name: string;
  text: string;
  use: ConsumableUse;
}

export function consumableInfo(item: Consumable): ConsumableInfo {
  switch (item.kind) {
    case 'scroll': {
      const p = PATTERNS[item.pattern];
      return {
        emoji: '📖',
        name: `${p.name} 비전서`,
        text: `${p.name} 족보 레벨 +1 (칩 +${p.chipsPerLevel}, 배수 +${p.multPerLevel})`,
        use: 'anywhere',
      };
    }
    case 'hammer':
      return { emoji: '🔨', name: '망치', text: '고른 칸을 가운데로 3×3 칸을 부숨 (바위·방해 칸 포함, 점수 없음)', use: 'stage' };
    case 'fan':
      return { emoji: '🌬️', name: '부채', text: '이번 판 동안 손의 블록을 눌러서 90°씩 돌릴 수 있음', use: 'stage' };
    case 'broom':
      return {
        emoji: '🧹',
        name: '빗자루',
        text: '가로 또는 세로 1줄을 지우고 "한 줄" 점수를 받음 (부적·연속·강화 칸 적용)',
        use: 'stage',
      };
    case 'stamp': {
      const e = ENHANCEMENTS[item.enh];
      return {
        emoji: '🔖',
        name: `${e.name} 도장`,
        text: `가방의 블록 ${STAMP_BLOCKS}개를 ${e.name} 블록으로: ${e.text}`,
        use: 'shop',
      };
    }
    case 'ink':
      return { emoji: '🖌️', name: '먹', text: '가방의 블록 1개를 똑같이 하나 더 만듦 (강화 포함)', use: 'shop' };
    case 'hourglass':
      return { emoji: '⌛', name: '모래시계', text: '이번 판 핸드 +1', use: 'stage' };
  }
}
