import { it } from 'vitest';
import { STAGE_NAMES, type StageKind } from '../src/content/balance';
import { UPGRADES } from '../src/content/upgrades';
import { perksOf, type Profile, newProfile } from '../src/core/profile';
import { createRun, obstacleFor, type RunOptions } from '../src/core/run';
import { playRun } from './bot';

/**
 * 봇 밸런스 확인 → docs/08-difficulty.md
 * npm run sim (SIM_RUNS=500 npm run sim 처럼 판 수를 바꿀 수 있다)
 */

/** node 타입 없이 환경 변수 읽기 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const RUNS = Number(env.SIM_RUNS ?? 200);
const KINDS: StageKind[] = ['small', 'big', 'boss'];

const allUpgrades: Profile = {
  ...newProfile(),
  upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, u.costs.length])),
};

const CONFIGS: Array<{ name: string; options: RunOptions }> = [
  { name: '수련 없음 · 기본 가방 · 1단계', options: {} },
  { name: '수련 전부 · 기본 가방 · 1단계', options: { perks: perksOf(allUpgrades) } },
];

const pct = (n: number, total: number) => (total === 0 ? '-' : `${Math.round((n / total) * 100)}%`);

it(`봇 ${RUNS}판: 고개별 도달률과 판 통과율`, () => {
  for (const config of CONFIGS) {
    const started = Date.now();
    const reached = Array.from({ length: 10 }, () => 0);
    let endings = 0;
    // 판 종류·방해 칸 유무별 [도전, 통과]
    const tally = new Map<string, [number, number]>();
    const count = (key: string, cleared: boolean) => {
      const [tried, passed] = tally.get(key) ?? [0, 0];
      tally.set(key, [tried + 1, passed + (cleared ? 1 : 0)]);
    };

    for (let i = 0; i < RUNS; i++) {
      const run = createRun(`SIM${i}`, config.options);
      const final = playRun(run);
      for (let ante = 1; ante <= Math.min(final.ante, 9); ante++) reached[ante]++;
      if (final.phase === 'ending') endings++;
      final.history.forEach((mark, index) => {
        const ante = Math.floor(index / 3) + 1;
        const kind = KINDS[index % 3];
        const hazard = obstacleFor(final, ante, kind) ? ' · 방해 칸' : '';
        count(`고개 ${ante} ${STAGE_NAMES[kind]}${hazard}`, mark !== 'fail');
      });
    }

    console.log(`\n■ ${config.name} (${RUNS}판, ${((Date.now() - started) / 1000).toFixed(1)}초)`);
    console.log(
      '도달: ' +
        reached
          .slice(1, 9)
          .map((n, i) => `고개${i + 1} ${pct(n, RUNS)}`)
          .join(' · ') +
        ` · 엔딩 ${pct(endings, RUNS)}`,
    );
    for (const [key, [tried, passed]] of tally) console.log(`  ${key}: ${pct(passed, tried)} (${passed}/${tried})`);
  }
});
