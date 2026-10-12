import { INTEREST_CAP } from './balance';

/** 난이도 단계: 엔딩을 보면 다음 단계가 열리고, 효과는 누적된다 → docs/08-difficulty.md */

export interface StakeDef {
  level: number;
  name: string;
  /** 이 단계에서 새로 붙는 규칙 */
  rule: string;
}

export const STAKES: readonly StakeDef[] = [
  { level: 1, name: '동자', rule: '기본' },
  { level: 2, name: '행자', rule: '판 1 클리어 보상 없음' },
  { level: 3, name: '수행자', rule: '판 1·판 2에 바위 +2' },
  { level: 4, name: '도인', rule: '판마다 버리기 −1' },
  { level: 5, name: '법사', rule: '이자 상한 $3' },
  { level: 6, name: '도사', rule: '요괴 판 목표 ×1.25 (보통 요괴 ×2.5)' },
  { level: 7, name: '진인', rule: '장터 가격 +$1' },
  { level: 8, name: '신선', rule: '판마다 핸드 −1' },
];

export const MAX_STAKE = STAKES.length;

/** 단계까지 쌓인 규칙을 숫자로 */
export interface StakeRules {
  smallStageReward: boolean;
  extraRocks: number;
  discardDelta: number;
  interestBase: number;
  bossTargetScale: number;
  priceDelta: number;
  handDelta: number;
}

export function stakeRules(stake: number): StakeRules {
  return {
    smallStageReward: stake < 2,
    extraRocks: stake >= 3 ? 2 : 0,
    discardDelta: stake >= 4 ? -1 : 0,
    interestBase: stake >= 5 ? 3 : INTEREST_CAP,
    bossTargetScale: stake >= 6 ? 1.25 : 1,
    priceDelta: stake >= 7 ? 1 : 0,
    handDelta: stake >= 8 ? -1 : 0,
  };
}
