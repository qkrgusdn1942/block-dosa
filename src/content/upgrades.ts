/** 수련 (공덕으로 사는 영구 강화) → docs/06-incremental.md */

export type UpgradeId =
  | 'purse'
  | 'savings'
  | 'sleeve'
  | 'nimble'
  | 'firstCharm'
  | 'secondWind'
  | 'regular'
  | 'pouch'
  | 'trainedHands'
  | 'grit';

/** 수련이 런에 주는 효과를 모은 것. 런을 시작할 때 정해져서 런 끝까지 간다 */
export interface RunPerks {
  startGold: number;
  interestCap: number;
  consumableSlots: number;
  /** 판마다 */
  discards: number;
  /** 판마다 */
  hands: number;
  talismanSlots: number;
  shopTalismans: number;
  /** 모든 족보 시작 레벨 + */
  startLevels: number;
  /** 첫 인연: 런 시작 때 일반 부적 3개 중 1개 */
  firstCharm: boolean;
  /** 기사회생: 런당 1번 */
  secondWind: boolean;
}

export const NO_PERKS: RunPerks = {
  startGold: 0,
  interestCap: 0,
  consumableSlots: 0,
  discards: 0,
  hands: 0,
  talismanSlots: 0,
  shopTalismans: 0,
  startLevels: 0,
  firstCharm: false,
  secondWind: false,
};

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  emoji: string;
  text: string;
  /** 단계별 비용. 길이 = 최대 단계 */
  costs: readonly number[];
  /** level단계까지 배웠을 때 런에 주는 효과 */
  apply: (perks: RunPerks, level: number) => RunPerks;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'purse',
    name: '넉넉한 전대',
    emoji: '💰',
    text: '시작 골드 +$2',
    costs: [30, 60, 120],
    apply: (p, level) => ({ ...p, startGold: p.startGold + 2 * level }),
  },
  {
    id: 'savings',
    name: '저축',
    emoji: '🏦',
    text: '이자 상한 +$2',
    costs: [60, 150],
    apply: (p, level) => ({ ...p, interestCap: p.interestCap + 2 * level }),
  },
  {
    id: 'sleeve',
    name: '소매',
    emoji: '🥋',
    text: '소모품 칸 +1',
    costs: [80],
    apply: (p, level) => ({ ...p, consumableSlots: p.consumableSlots + level }),
  },
  {
    id: 'nimble',
    name: '손놀림',
    emoji: '✋',
    text: '판마다 버리기 +1',
    costs: [100, 250],
    apply: (p, level) => ({ ...p, discards: p.discards + level }),
  },
  {
    id: 'firstCharm',
    name: '첫 인연',
    emoji: '🤝',
    text: '런 시작 때 일반 부적 3개 중 1개를 골라서 시작',
    costs: [100],
    apply: (p) => ({ ...p, firstCharm: true }),
  },
  {
    id: 'secondWind',
    name: '기사회생',
    emoji: '🙏',
    text: '런당 1번, 막혀서 판이 끝나려 할 때 가장 많이 찬 2줄을 비움',
    costs: [120],
    apply: (p) => ({ ...p, secondWind: true }),
  },
  {
    id: 'regular',
    name: '단골',
    emoji: '🏪',
    text: '장터 부적 진열 +1',
    costs: [150],
    apply: (p, level) => ({ ...p, shopTalismans: p.shopTalismans + level }),
  },
  {
    id: 'pouch',
    name: '부적 주머니',
    emoji: '👝',
    text: '부적 칸 +1',
    costs: [200],
    apply: (p, level) => ({ ...p, talismanSlots: p.talismanSlots + level }),
  },
  {
    id: 'trainedHands',
    name: '수련된 손',
    emoji: '🙌',
    text: '런 시작 때 모든 족보 레벨 +1',
    costs: [250],
    apply: (p, level) => ({ ...p, startLevels: p.startLevels + level }),
  },
  {
    id: 'grit',
    name: '끈기',
    emoji: '💪',
    text: '판마다 핸드 +1',
    costs: [300],
    apply: (p, level) => ({ ...p, hands: p.hands + level }),
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;
