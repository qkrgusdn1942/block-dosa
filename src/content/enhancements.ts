/** 블록 강화 → docs/05-blocks-and-cells.md */

export type Enhancement = 'gold' | 'crystal' | 'fire' | 'glass' | 'lucky';

export const ENHANCEMENT_IDS: readonly Enhancement[] = ['gold', 'crystal', 'fire', 'glass', 'lucky'];

export interface EnhancementDef {
  name: string;
  /** 칸 구석에 찍는 작은 표시 */
  mark: string;
  text: string;
}

export const ENHANCEMENTS: Record<Enhancement, EnhancementDef> = {
  gold: { name: '금', mark: '$', text: '지워질 때 칸당 +$1 (한 번에 최대 $5)' },
  crystal: { name: '수정', mark: '✦', text: '지워질 때 칸당 칩 +5' },
  fire: { name: '불꽃', mark: '▲', text: '지워질 때 칸당 배수 +1' },
  glass: { name: '유리', mark: '◇', text: '이 블록 칸이 포함된 클리어 ×1.5. 그 뒤 1/4 확률로 깨져서 가방에서 사라짐' },
  lucky: { name: '행운', mark: '☘', text: '지워질 때 1/5 확률로 배수 +20, 1/15 확률로 +$10 (블록당 한 번)' },
};

export const GOLD_PER_CELL = 1;
/** 한 번 지울 때 금 칸에서 나오는 골드 상한 */
export const GOLD_CELL_CAP = 5;
export const CRYSTAL_CHIPS = 5;
export const FIRE_MULT = 1;
export const GLASS_MULT = 1.5;
export const GLASS_BREAK_CHANCE = 0.25;
export const LUCKY_MULT_CHANCE = 1 / 5;
export const LUCKY_MULT = 20;
export const LUCKY_GOLD_CHANCE = 1 / 15;
export const LUCKY_GOLD = 10;
/** 블록 팩 블록이 강화돼 있을 확률 */
export const PACK_ENHANCED_CHANCE = 0.2;
