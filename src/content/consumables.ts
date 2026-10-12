import { PATTERNS, type PatternId } from './balance';

/** 소모품 → docs/03-roguelike.md */
export type Consumable = { kind: 'scroll'; pattern: PatternId } | { kind: 'hammer' } | { kind: 'fan' };

export interface ConsumableInfo {
  emoji: string;
  name: string;
  text: string;
  /** 판 진행 중에만 쓸 수 있음 */
  stageOnly: boolean;
}

export function consumableInfo(item: Consumable): ConsumableInfo {
  switch (item.kind) {
    case 'scroll': {
      const p = PATTERNS[item.pattern];
      return {
        emoji: '📖',
        name: `${p.name} 비전서`,
        text: `${p.name} 족보 레벨 +1 (칩 +${p.chipsPerLevel}, 배수 +${p.multPerLevel})`,
        stageOnly: false,
      };
    }
    case 'hammer':
      return { emoji: '🔨', name: '망치', text: '판의 칸 1개를 부숨 (바위 포함)', stageOnly: true };
    case 'fan':
      return { emoji: '🌬️', name: '부채', text: '손에 든 블록 1개를 90° 회전', stageOnly: true };
  }
}
