import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../src/content/upgrades';
import {
  buyUpgrade,
  meritTotal,
  newProfile,
  nextUpgradeCost,
  perksOf,
  runMerit,
  settleRun,
  startDaily,
  type Profile,
} from '../src/core/profile';
import { createRun, type RunState } from '../src/core/run';

/** 고개 N에서 끝난 런 */
function endedRun(ante: number, bosses: number, ending = false, records = { bestAnte: 0, endings: 0 }): RunState {
  const run = createRun('MERIT1', { start: { ante, kind: 'small' }, records });
  return { ...run, phase: ending ? 'ending' : 'over', stats: { ...run.stats, bossesBeaten: bosses, bestClear: 1234 } };
}

describe('수련', () => {
  it('공덕이 있으면 다음 단계를 산다', () => {
    const profile: Profile = { ...newProfile(), merit: 100 };
    const bought = buyUpgrade(profile, 'purse');
    expect(bought.merit).toBe(70);
    expect(bought.upgrades.purse).toBe(1);
    expect(nextUpgradeCost(bought, 'purse')).toBe(60);
  });

  it('공덕이 모자라거나 다 배웠으면 못 산다', () => {
    expect(buyUpgrade({ ...newProfile(), merit: 10 }, 'purse')).toEqual({ ...newProfile(), merit: 10 });
    const maxed: Profile = { ...newProfile(), merit: 999, upgrades: { sleeve: 1 } };
    expect(nextUpgradeCost(maxed, 'sleeve')).toBeNull();
    expect(buyUpgrade(maxed, 'sleeve')).toBe(maxed);
  });

  it('배운 단계만큼 런 효과가 쌓인다', () => {
    const profile: Profile = { ...newProfile(), upgrades: { purse: 3, savings: 2, nimble: 1, firstCharm: 1, secondWind: 1 } };
    expect(perksOf(profile)).toMatchObject({
      startGold: 6,
      interestCap: 4,
      discards: 1,
      firstCharm: true,
      secondWind: true,
      hands: 0,
    });
  });

  it('전부 배우는 데 1,970 공덕 (docs/06-incremental.md)', () => {
    const total = UPGRADES.reduce((sum, u) => sum + u.costs.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(1970);
  });
});

describe('오늘의 판 기록', () => {
  const TODAY = '20261012';

  it('오늘 날짜의 첫 도전만 공식', () => {
    const first = startDaily(newProfile(), TODAY, TODAY);
    expect(first.official).toBe(true);
    expect(first.profile.daily).toEqual({ date: TODAY, attempts: 1, official: null });
    const second = startDaily(first.profile, TODAY, TODAY);
    expect(second.official).toBe(false);
    expect(second.profile.daily?.attempts).toBe(2);
  });

  it('다음 날이 되면 다시 공식 도전 가능', () => {
    const yesterday = startDaily(newProfile(), '20261011', '20261011').profile;
    expect(startDaily(yesterday, TODAY, TODAY).official).toBe(true);
  });

  it('지난 날짜 코드는 연습이고 기록을 건드리지 않는다', () => {
    const today = startDaily(newProfile(), TODAY, TODAY).profile;
    const old = startDaily(today, '20261001', TODAY);
    expect(old.official).toBe(false);
    expect(old.profile).toBe(today);
  });

  it('공식 도전이 끝나면 결과와 공유 텍스트를 남기고, 연습은 남기지 않는다', () => {
    const started = startDaily(newProfile(), TODAY, TODAY).profile;
    const base = createRun(`D${TODAY}`, { mode: 'daily', official: true });
    const run: RunState = { ...base, phase: 'over', ante: 2, stageKind: 'big' };
    const settled = settleRun(started, run, 'daily-1');
    expect(settled.daily?.official).toMatchObject({ completed: false, score: 0, reached: '고개 2 · 판 2' });
    expect(settled.daily?.official?.text).toContain('오늘의 판 10/12');

    const practice = settleRun(started, { ...run, official: false }, 'daily-2');
    expect(practice.daily?.official).toBeNull();
  });

  it('오늘의 판 완주는 엔딩 공덕이 없다', () => {
    const base = createRun(`D${TODAY}`, { mode: 'daily', start: { ante: 3, kind: 'finale' } });
    const lines = runMerit({ ...base, phase: 'ending' });
    expect(lines.some((line) => line.label.includes('엔딩'))).toBe(false);
  });
});

describe('공덕', () => {
  it('고개 3에서 실패, 요괴 2마리: 30 + 10 (+ 처음 도달 고개 2·3)', () => {
    const lines = runMerit(endedRun(3, 2));
    expect(lines).toEqual([
      { label: '고개 3까지', merit: 30 },
      { label: '요괴 2마리', merit: 10 },
      { label: '처음 고개 2 도달', merit: 20 },
      { label: '처음 고개 3 도달', merit: 20 },
    ]);
  });

  it('이미 가본 고개는 처음 달성 보너스가 없다', () => {
    expect(meritTotal(runMerit(endedRun(3, 2, false, { bestAnte: 5, endings: 0 })))).toBe(40);
  });

  it('엔딩: 80 + 40 + 50 (+ 첫 엔딩)', () => {
    const veteran = runMerit(endedRun(8, 8, true, { bestAnte: 8, endings: 1 }));
    expect(meritTotal(veteran)).toBe(170);
    const first = runMerit(endedRun(8, 8, true, { bestAnte: 8, endings: 0 }));
    expect(meritTotal(first)).toBe(190);
  });

  it('진행 중인 런은 공덕이 없다', () => {
    expect(runMerit(createRun('MERIT1'))).toEqual([]);
  });

  it('런을 정산하면 공덕과 기록이 쌓이고, 같은 런은 두 번 정산하지 않는다', () => {
    const run = endedRun(3, 2);
    const once = settleRun(newProfile(), run, 'run-1');
    expect(once).toMatchObject({ merit: 80, totalMerit: 80, bestAnte: 3, runs: 1, bestClear: 1234, lastSettledRun: 'run-1' });
    expect(settleRun(once, run, 'run-1')).toBe(once);
    expect(settleRun(once, run, 'run-2').runs).toBe(2);
  });
});
