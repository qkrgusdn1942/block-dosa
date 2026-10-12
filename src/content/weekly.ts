import type { BagType } from './bags';
import type { ShapeId } from './blocks';
import type { TalismanId } from './talismans';

/** 주간 도전 특수 규칙: 주마다 하나씩 돌아가며 나온다 → docs/10-social.md */

export type WeeklyRuleId = 'barsOnly' | 'chaos' | 'hurry' | 'lightPack' | 'rocky' | 'hazards' | 'windy';

export interface WeeklyRule {
  id: WeeklyRuleId;
  name: string;
  emoji: string;
  text: string;
  /** 가방 종류 대신 쓰는 가방 구성 */
  bagContents?: ReadonlyArray<readonly [ShapeId, number]>;
  bagType?: BagType;
  startTalisman?: TalismanId;
  startGold?: number;
  talismanSlotDelta?: number;
  /** 판마다 */
  extraHands?: number;
  extraDiscards?: number;
  /** 판 1·판 2마다 */
  extraRocks?: number;
  /** 방해 칸이 이 고개부터 판 1·판 2에 나온다 */
  obstaclesFromAnte?: number;
}

export const WEEKLY_RULES: readonly WeeklyRule[] = [
  {
    id: 'barsOnly',
    name: '막대 잔치',
    emoji: '🥢',
    text: '가방이 점·막대 블록뿐',
    bagContents: [
      ['dot', 2],
      ['bar2', 4],
      ['bar3', 4],
      ['bar4', 4],
      ['bar5', 4],
    ],
  },
  { id: 'chaos', name: '혼돈의 주', emoji: '🌪️', text: '혼돈 가방: 모든 블록이 강화된 채 시작, 부적 칸 −1', bagType: 'chaos' },
  { id: 'hurry', name: '급한 길', emoji: '⏱️', text: '판마다 핸드 −1, 대신 버리기 +3', extraHands: -1, extraDiscards: 3 },
  {
    id: 'lightPack',
    name: '단출한 짐',
    emoji: '👝',
    text: '부적 칸 3개, 대신 시작 골드 +$10',
    talismanSlotDelta: -2,
    startGold: 10,
  },
  { id: 'rocky', name: '돌밭', emoji: '🪨', text: '판 1·판 2에 바위 +3', extraRocks: 3 },
  { id: 'hazards', name: '방해 칸 잔치', emoji: '🌿', text: '고개 1부터 판 1·판 2마다 방해 칸 1종', obstaclesFromAnte: 1 },
  { id: 'windy', name: '바람 부는 날', emoji: '🌀', text: '🌀 바람개비를 들고 시작', startTalisman: 'pinwheel' },
];

export const WEEKLY_RULE_BY_ID = Object.fromEntries(WEEKLY_RULES.map((r) => [r.id, r])) as Record<
  WeeklyRuleId,
  WeeklyRule
>;
