import { PATTERNS, type PatternId } from './balance';
import { ENHANCEMENTS, type Enhancement } from './enhancements';

/** 소모품 → docs/03-roguelike.md */
export type Consumable =
  | { kind: 'scroll'; pattern: PatternId }
  | { kind: 'hammer' }
  | { kind: 'fan' }
  | { kind: 'broom' }
  | { kind: 'stamp'; enh: Enhancement }
  | { kind: 'ink' };

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
      return { emoji: '🔨', name: '망치', text: '판의 칸 1개를 부숨 (바위 포함)', use: 'stage' };
    case 'fan':
      return { emoji: '🌬️', name: '부채', text: '손에 든 블록 1개를 90° 회전', use: 'stage' };
    case 'broom':
      return { emoji: '🧹', name: '빗자루', text: '가로 또는 세로 1줄을 비움 (점수 없음)', use: 'stage' };
    case 'stamp': {
      const e = ENHANCEMENTS[item.enh];
      return { emoji: '🔖', name: `${e.name} 도장`, text: `가방의 블록 1개를 ${e.name} 블록으로: ${e.text}`, use: 'shop' };
    }
    case 'ink':
      return { emoji: '🖌️', name: '먹', text: '가방의 블록 1개를 똑같이 하나 더 만듦 (강화 포함)', use: 'shop' };
  }
}
