import { SKIP_FREE_REROLLS, SKIP_GOLD, SKIP_STUDY_LEVELS } from './balance';

/** 판 건너뛰기 보상: 판 1·판 2를 건너뛰면 하나 받는다 (판마다 정해져 있음) → docs/03-roguelike.md */

export type SkipRewardId = 'gold' | 'freePack' | 'discount' | 'rerolls' | 'study';

export const SKIP_REWARD_IDS: readonly SkipRewardId[] = ['gold', 'freePack', 'discount', 'rerolls', 'study'];

export interface SkipRewardDef {
  id: SkipRewardId;
  emoji: string;
  name: string;
  text: string;
}

export const SKIP_REWARDS: Record<SkipRewardId, SkipRewardDef> = {
  gold: { id: 'gold', emoji: '💰', name: '노잣돈', text: `바로 +$${SKIP_GOLD}` },
  freePack: { id: 'freePack', emoji: '🎁', name: '공짜 블록 팩', text: '다음 장터의 블록 팩이 공짜' },
  discount: { id: 'discount', emoji: '🏷️', name: '반값 부적', text: '다음 장터의 부적이 반값' },
  rerolls: { id: 'rerolls', emoji: '🔄', name: '공짜 리롤', text: `다음 장터에서 리롤 ${SKIP_FREE_REROLLS}번 공짜` },
  study: { id: 'study', emoji: '📖', name: '족보 공부', text: `무작위 족보 ${SKIP_STUDY_LEVELS}개 레벨 +1` },
};
