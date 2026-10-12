import { STARTING_BAG, type ShapeId } from './blocks';
import type { TalismanId } from './talismans';
import type { Unlock } from './unlocks';

/** 가방 종류: 런 시작 때 고른다 → docs/03-roguelike.md */

export type BagType = 'basic' | 'bars' | 'squares' | 'chaos';

export interface BagTypeDef {
  id: BagType;
  name: string;
  emoji: string;
  text: string;
  contents: ReadonlyArray<readonly [ShapeId, number]>;
  /** 들고 시작하는 부적 */
  startTalisman?: TalismanId;
  /** 부적 칸 증감 */
  talismanSlotDelta?: number;
  /** 모든 블록을 무작위로 강화한 채 시작 */
  enhanceAll?: boolean;
  unlock?: Unlock;
}

export const BAG_TYPES: readonly BagTypeDef[] = [
  {
    id: 'basic',
    name: '기본 가방',
    emoji: '🎒',
    text: '고르게 섞인 18개',
    contents: STARTING_BAG,
  },
  {
    id: 'bars',
    name: '막대 가방',
    emoji: '🥢',
    text: '막대 블록 위주, 🌀 바람개비를 들고 시작',
    contents: [
      ['dot', 1],
      ['bar2', 3],
      ['bar3', 3],
      ['bar4', 3],
      ['bar5', 2],
      ['square', 1],
      ['smallL', 2],
      ['l', 1],
      ['t', 1],
      ['zigzag', 1],
    ],
    startTalisman: 'pinwheel',
    unlock: { text: '고개 3 클리어 (고개 4 도달)', check: (r) => r.bestAnte >= 4 },
  },
  {
    id: 'squares',
    name: '네모 가방',
    emoji: '🧇',
    text: 'ㅁ·큰ㅁ·직사각 위주, 대청소가 쉬움',
    contents: [
      ['dot', 2],
      ['bar2', 2],
      ['bar3', 2],
      ['bar4', 1],
      ['square', 4],
      ['bigSquare', 2],
      ['rect', 2],
      ['smallL', 2],
      ['l', 1],
    ],
    unlock: { text: '대청소 누적 10번', check: (r) => r.totalPerfects >= 10 },
  },
  {
    id: 'chaos',
    name: '혼돈 가방',
    emoji: '🌪️',
    text: '모든 블록이 무작위로 강화된 채 시작, 대신 부적 칸 −1',
    contents: STARTING_BAG,
    talismanSlotDelta: -1,
    enhanceAll: true,
    unlock: { text: '엔딩 1번', check: (r) => r.endings >= 1 },
  },
];

export const BAG_BY_ID = Object.fromEntries(BAG_TYPES.map((b) => [b.id, b])) as Record<BagType, BagTypeDef>;

/** 도전 코드 뒤에 붙는 가방 글자 (기본·막대·네모·혼돈의 첫 자음) → docs/10-social.md */
export const BAG_CODES: Record<BagType, string> = { basic: 'G', bars: 'M', squares: 'N', chaos: 'H' };
