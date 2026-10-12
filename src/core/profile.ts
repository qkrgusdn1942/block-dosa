import { MERIT_ENDING, MERIT_FIRST, MERIT_PER_ANTE, MERIT_PER_BOSS, STAGE_NAMES } from '../content/balance';
import type { BagType } from '../content/bags';
import { MAX_STAKE } from '../content/stakes';
import type { UnlockRecords } from '../content/unlocks';
import { NO_PERKS, UPGRADE_BY_ID, UPGRADES, type RunPerks, type UpgradeId } from '../content/upgrades';
import { dailyDateOf, weeklyDateOf } from './daily';
import type { NumberStyle } from './format';
import { courseOf, NOTHING_SEEN, type RunState, type Seen } from './run';
import { shareText } from './share';

/** 런 밖에서 계속 남는 것: 공덕, 수련, 기록 → docs/06-incremental.md */

export const PROFILE_VERSION = 1;

/** 오늘의 판·주간 도전 공식 기록 (첫 도전) */
export interface DailyResult {
  /** 끝판까지 마쳤는지 */
  completed: boolean;
  /** 끝판 점수 (못 갔으면 0) */
  score: number;
  /** "고개 2 · 판 2" 처럼 멈춘 곳 */
  reached: string;
  /** 다시 공유할 수 있게 결과 텍스트도 보관 */
  text: string;
}

export interface DailyRecord {
  /** 오늘의 판은 그 날짜, 주간 도전은 그 주 월요일 */
  date: string;
  /** 그날(그 주)에 시작한 도전 수. 첫 번째만 공식 */
  attempts: number;
  official: DailyResult | null;
}

/** 설정 → docs/11-ui-ux.md */
export interface Settings {
  /** 한국식(1.23만) / 지수(1.23e4) */
  numberStyle: NumberStyle;
  /** 아래 버튼 줄 좌우 반전 */
  leftHand: boolean;
}

export const DEFAULT_SETTINGS: Settings = { numberStyle: 'korean', leftHand: false };

/** 새 런을 시작할 때 고르는 것 */
export interface RunSetup {
  bagType: BagType;
  stake: number;
}

export interface Profile {
  version: number;
  /** 지금 가진 공덕 */
  merit: number;
  /** 지금까지 받은 공덕 합계 */
  totalMerit: number;
  /** 수련별 배운 단계 */
  upgrades: Partial<Record<UpgradeId, number>>;
  bestAnte: number;
  endings: number;
  runs: number;
  bestClear: number;
  /** 지금까지 한 대청소 수 (해금 조건) */
  totalPerfects: number;
  /** 엔딩을 본 가장 높은 난이도 단계 (0 = 아직). 그다음 단계까지 고를 수 있다 */
  stakeCleared: number;
  /** 지난번 새 런에서 고른 가방·난이도 */
  lastSetup: RunSetup | null;
  /** 공덕을 이미 받은 마지막 런. 같은 런을 두 번 정산하지 않게 */
  lastSettledRun: string | null;
  /** 가장 최근 날짜의 오늘의 판 / 가장 최근 주의 주간 도전 */
  daily: DailyRecord | null;
  weekly: DailyRecord | null;
  /** 도감: 지금까지 끝난 런에서 만난 것 */
  collection: Seen;
  settings: Settings;
  /** 마지막으로 본 변경 사항 버전 (새 버전이면 처음 화면에 NEW) */
  seenVersion: string | null;
}

export const newProfile = (): Profile => ({
  version: PROFILE_VERSION,
  merit: 0,
  totalMerit: 0,
  upgrades: {},
  bestAnte: 0,
  endings: 0,
  runs: 0,
  bestClear: 0,
  totalPerfects: 0,
  stakeCleared: 0,
  lastSetup: null,
  lastSettledRun: null,
  daily: null,
  weekly: null,
  collection: NOTHING_SEEN,
  settings: DEFAULT_SETTINGS,
  seenVersion: null,
});

/**
 * 오늘의 판을 시작할 때. 오늘 날짜의 첫 도전이면 공식 기록이 된다.
 * 지난 날짜(코드로 들어온 예전 오늘의 판)는 늘 연습이고 기록도 건드리지 않는다.
 */
export function startDaily(profile: Profile, date: string, today: string): { profile: Profile; official: boolean } {
  const started = startChallenge(profile.daily, date, today);
  return { profile: started ? { ...profile, daily: started.record } : profile, official: started?.official ?? false };
}

/** 주간 도전도 같은 방식: 이번 주의 첫 도전만 공식 */
export function startWeekly(profile: Profile, monday: string, thisMonday: string): { profile: Profile; official: boolean } {
  const started = startChallenge(profile.weekly, monday, thisMonday);
  return { profile: started ? { ...profile, weekly: started.record } : profile, official: started?.official ?? false };
}

/** 지난 날짜(주)는 기록을 건드리지 않는다 (null) */
function startChallenge(
  record: DailyRecord | null,
  date: string,
  current: string,
): { record: DailyRecord; official: boolean } | null {
  if (date !== current) return null;
  const today = record?.date === date ? record : { date, attempts: 0, official: null };
  return { record: { ...today, attempts: today.attempts + 1 }, official: today.attempts === 0 };
}

export const upgradeLevel = (profile: Profile, id: UpgradeId) => profile.upgrades[id] ?? 0;

/** 배운 수련을 모두 합친 런 효과 */
export function perksOf(profile: Profile): RunPerks {
  return UPGRADES.reduce((perks, def) => {
    const level = upgradeLevel(profile, def.id);
    return level > 0 ? def.apply(perks, level) : perks;
  }, NO_PERKS);
}

export const recordsOf = (profile: Profile): UnlockRecords => ({
  bestAnte: profile.bestAnte,
  endings: profile.endings,
  totalPerfects: profile.totalPerfects,
  runs: profile.runs,
});

/** 고를 수 있는 가장 높은 난이도 단계 */
export const maxStake = (profile: Profile) => Math.min(MAX_STAKE, profile.stakeCleared + 1);

/** 엔딩을 봤는가: 고개 8 요괴를 깨고 끝냈거나, 끝없는 모드로 넘어갔거나. 오늘의 판 완주(끝판)는 엔딩이 아니다 */
export const reachedEnding = (run: RunState) =>
  (run.phase === 'ending' && !courseOf(run.mode).finale) || run.endless;

/** 다음 단계 비용. 다 배웠으면 null */
export function nextUpgradeCost(profile: Profile, id: UpgradeId): number | null {
  const costs = UPGRADE_BY_ID[id].costs;
  const level = upgradeLevel(profile, id);
  return level < costs.length ? costs[level] : null;
}

export function buyUpgrade(profile: Profile, id: UpgradeId): Profile {
  const cost = nextUpgradeCost(profile, id);
  if (cost === null || profile.merit < cost) return profile;
  return {
    ...profile,
    merit: profile.merit - cost,
    upgrades: { ...profile.upgrades, [id]: upgradeLevel(profile, id) + 1 },
  };
}

export interface MeritLine {
  label: string;
  merit: number;
}

/** 끝난 런으로 받는 공덕. 런 시작 때의 기록과 비교해서 처음 달성도 센다 */
export function runMerit(run: RunState): MeritLine[] {
  if (run.phase !== 'over' && run.phase !== 'ending') return [];
  const ending = reachedEnding(run);
  const lines: MeritLine[] = [{ label: `고개 ${run.ante}까지`, merit: run.ante * MERIT_PER_ANTE }];
  const bosses = run.stats.bossesBeaten;
  if (bosses > 0) lines.push({ label: `요괴 ${bosses}마리`, merit: bosses * MERIT_PER_BOSS });
  if (ending) lines.push({ label: '엔딩', merit: MERIT_ENDING });
  for (let ante = Math.max(2, run.records.bestAnte + 1); ante <= run.ante; ante++) {
    lines.push({ label: `처음 고개 ${ante} 도달`, merit: MERIT_FIRST });
  }
  if (ending && run.records.endings === 0) lines.push({ label: '첫 엔딩', merit: MERIT_FIRST });
  return lines;
}

export const meritTotal = (lines: readonly MeritLine[]) => lines.reduce((sum, line) => sum + line.merit, 0);

/** 끝난 런의 공덕과 기록을 반영한다. 이미 반영한 런이면 그대로 */
export function settleRun(profile: Profile, run: RunState, runId: string): Profile {
  if (profile.lastSettledRun === runId) return profile;
  if (run.phase !== 'over' && run.phase !== 'ending') return profile;
  const merit = meritTotal(runMerit(run));
  const ending = reachedEnding(run);
  return {
    ...profile,
    merit: profile.merit + merit,
    totalMerit: profile.totalMerit + merit,
    bestAnte: Math.max(profile.bestAnte, run.ante),
    endings: profile.endings + (ending ? 1 : 0),
    runs: profile.runs + 1,
    bestClear: Math.max(profile.bestClear, run.stats.bestClear),
    totalPerfects: profile.totalPerfects + run.stats.perfects,
    // 난이도 단계는 새 런으로만 연다 (코드 도전은 늘 1단계)
    stakeCleared: ending && run.mode === 'normal' ? Math.max(profile.stakeCleared, run.stake) : profile.stakeCleared,
    lastSettledRun: runId,
    daily: run.mode === 'daily' ? recordChallenge(profile.daily, run, dailyDateOf(run.seed)) : profile.daily,
    weekly: run.mode === 'weekly' ? recordChallenge(profile.weekly, run, weeklyDateOf(run.seed)) : profile.weekly,
    collection: mergeSeen(profile.collection, run.seen),
  };
}

/** 공식 도전이 끝나면 그날(그 주)의 기록으로 남긴다 (한 번만) */
function recordChallenge(record: DailyRecord | null, run: RunState, date: string | null): DailyRecord | null {
  if (!run.official || !record || record.date !== date || record.official) return record;
  const completed = run.phase === 'ending';
  return {
    ...record,
    official: {
      completed,
      score: completed ? run.stage.score : 0,
      reached: completed ? '끝판 완주' : `고개 ${run.ante} · ${STAGE_NAMES[run.stageKind]}`,
      text: shareText(run),
    },
  };
}

/** 도감에 이번 런에서 만난 것을 더한다 */
export function mergeSeen(a: Seen, b: Seen): Seen {
  const union = <T>(x: readonly T[], y: readonly T[]) => [...new Set([...x, ...y])];
  return {
    talismans: union(a.talismans, b.talismans),
    bosses: union(a.bosses, b.bosses),
    obstacles: union(a.obstacles, b.obstacles),
    shapes: union(a.shapes, b.shapes),
    enhancements: union(a.enhancements, b.enhancements),
  };
}
