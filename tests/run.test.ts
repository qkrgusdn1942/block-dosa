import { describe, expect, it } from 'vitest';
import { REGULAR_BOSSES } from '../src/content/bosses';
import { TALISMANS } from '../src/content/talismans';
import { NO_PERKS, type RunPerks } from '../src/content/upgrades';
import {
  courseOf,
  createRun,
  rollBosses,
  runReducer,
  stageTarget,
  upcomingStage,
  type RunAction,
  type RunState,
} from '../src/core/run';
import type { StageState } from '../src/core/stage';
import { boardFrom, pieceOf, talisman } from './helpers';

const dot = (uid = 1000) => pieceOf('dot', 0, uid);

const play = (run: RunState, ...actions: RunAction[]) => actions.reduce(runReducer, run);

/** 지금 판을 한 수에 끝나는 상태로: (0, 0)에 점을 놓으면 한 줄 18점 */
function readyToClear(run: RunState, overrides: Partial<StageState> = {}): RunState {
  const stage: StageState = {
    ...run.stage,
    score: run.stage.rules.target - 1,
    board: boardFrom(['.#######', '#']),
    bonus: {},
    hand: [dot(), dot(1001), null],
    ...overrides,
  };
  return { ...run, phase: 'playing', stage };
}

const clearStage = (run: RunState, overrides: Partial<StageState> = {}) =>
  runReducer(readyToClear(run, overrides), { type: 'stage', action: { type: 'place', slot: 0, row: 0, col: 0 } });

/** 장터에 들어간 상태까지 */
function inShop(gold = 30): RunState {
  const reward = clearStage(createRun('SHOP01'));
  return { ...runReducer(reward, { type: 'collect' }), gold };
}

describe('런 시작', () => {
  it('고개 1 · 판 1 미리보기, 골드 $4, 가방 18개', () => {
    const run = createRun('RUN001');
    expect(run).toMatchObject({ ante: 1, stageKind: 'small', phase: 'preview', gold: 4 });
    expect(run.bag).toHaveLength(18);
    expect(run.stage.rules.target).toBe(150);
  });

  it('요괴 순서: 고개 8은 이무기, 나머지는 등장 고개를 지키고 연달아 같지 않다', () => {
    for (const seed of ['A', 'B', 'C', 'D']) {
      const bosses = rollBosses(seed);
      expect(bosses).toHaveLength(8);
      expect(bosses[7]).toBe('imugi');
      bosses.slice(0, 7).forEach((id, i) => {
        const def = REGULAR_BOSSES.find((b) => b.id === id)!;
        expect(def.minAnte).toBeLessThanOrEqual(i + 1);
        if (i > 0) expect(id).not.toBe(bosses[i - 1]);
      });
    }
  });

  it('목표 점수: 판 1 ×1, 판 2 ×1.5, 요괴 ×2, 이무기 ×3', () => {
    expect(stageTarget(1, 'small', null)).toBe(150);
    expect(stageTarget(1, 'big', null)).toBe(225);
    expect(stageTarget(1, 'boss', 'dokkaebi')).toBe(300);
    expect(stageTarget(8, 'boss', 'imugi')).toBe(240_000);
  });

  it('시작 버튼을 눌러야 진행', () => {
    expect(runReducer(createRun('RUN001'), { type: 'begin' }).phase).toBe('playing');
  });
});

describe('판 클리어와 보상', () => {
  it('보상: 기본 + 남은 핸드 + 이자', () => {
    const run = clearStage({ ...createRun('RUN001'), gold: 12 });
    expect(run.phase).toBe('reward');
    expect(run.reward).toEqual([
      { label: '판 1 클리어', gold: 3 },
      { label: '남은 핸드 4개', gold: 4 },
      { label: '이자 ($5당 $1, 최대 $5)', gold: 2 },
    ]);
    const collected = runReducer(run, { type: 'collect' });
    expect(collected.gold).toBe(12 + 9);
    expect(collected.phase).toBe('shop');
    expect(collected.shop?.talismans.length).toBe(2);
    expect(collected.shop?.consumables.length).toBe(2);
  });

  it('이자는 최대 $5, 돼지 저금통이 있으면 최대 $10', () => {
    const rich = clearStage({ ...createRun('RUN001'), gold: 80 });
    expect(rich.reward?.at(-1)?.gold).toBe(5);
    const withPiggy = clearStage({ ...createRun('RUN001'), gold: 80 }, { talismans: [talisman('piggy')] });
    expect(withPiggy.reward?.at(-1)?.gold).toBe(10);
  });

  it('복주머니 +$3, 대나무는 판을 깰 때마다 자란다', () => {
    const run = clearStage(createRun('RUN001'), { talismans: [talisman('pouch', 1), talisman('bamboo', 2)] });
    expect(run.reward?.some((line) => line.label.includes('복주머니') && line.gold === 3)).toBe(true);
    expect(run.talismans.find((t) => t.uid === 2)?.counter).toBe(2);
  });

  it('구미호에게 봉인된 부적은 판 클리어 효과도 없다', () => {
    const run = clearStage(createRun('RUN001'), { talismans: [talisman('pouch', 1)], sealedUid: 1 });
    expect(run.reward?.some((line) => line.label.includes('복주머니'))).toBe(false);
  });

  it('판에서 얻은 보석 골드도 보상에 들어간다', () => {
    const run = clearStage(createRun('RUN001'), { goldEarned: 3 });
    expect(run.reward?.find((line) => line.label.includes('보석'))?.gold).toBe(3);
  });

  it('판에 실패하면 런 종료', () => {
    const run = createRun('RUN001');
    const lastHand: RunState = { ...run, phase: 'playing', stage: { ...run.stage, handNumber: 5, hand: [dot(), null, null] } };
    const over = runReducer(lastHand, { type: 'stage', action: { type: 'place', slot: 0, row: 4, col: 4 } });
    expect(over.phase).toBe('over');
  });

  it('판에서 쓴 소모품·레벨·부적 순서가 런으로 돌아온다', () => {
    const run = createRun('RUN001');
    const loaded: RunState = {
      ...run,
      phase: 'playing',
      stage: { ...run.stage, consumables: [{ kind: 'scroll', pattern: 'single' }], talismans: [talisman('lamp', 1), talisman('coins', 2)] },
    };
    const used = play(
      loaded,
      { type: 'useScroll', index: 0 },
      { type: 'moveTalisman', uid: 2, dir: -1 },
    );
    const done = clearStage(used, { talismans: used.stage.talismans, levels: used.stage.levels, consumables: used.stage.consumables });
    expect(done.levels.single).toBe(2);
    expect(done.consumables).toHaveLength(0);
    expect(done.talismans.map((t) => t.uid)).toEqual([2, 1]);
  });
});

describe('장터', () => {
  it('부적 사기: 골드가 빠지고 부적이 생기며, 같은 진열은 다시 못 산다', () => {
    const shop = inShop(30);
    const offer = shop.shop!.talismans[0];
    const bought = runReducer(shop, { type: 'buyTalisman', slot: 0 });
    expect(bought.gold).toBe(30 - offer.price);
    expect(bought.talismans.map((t) => t.id)).toEqual([offer.item]);
    expect(runReducer(bought, { type: 'buyTalisman', slot: 0 })).toBe(bought);
  });

  it('골드가 모자라면 못 산다', () => {
    const poor = inShop(1);
    expect(runReducer(poor, { type: 'buyTalisman', slot: 0 })).toBe(poor);
    expect(runReducer(poor, { type: 'reroll' })).toBe(poor);
  });

  it('부적 칸이 가득 차면 못 산다', () => {
    const full = { ...inShop(30), talismans: [1, 2, 3, 4, 5].map((uid) => talisman('lamp', uid)) };
    expect(runReducer(full, { type: 'buyTalisman', slot: 0 })).toBe(full);
  });

  it('리롤은 $3부터 누를 때마다 $1씩 비싸진다', () => {
    const shop = inShop(30);
    const once = runReducer(shop, { type: 'reroll' });
    const twice = runReducer(once, { type: 'reroll' });
    expect(once.gold).toBe(27);
    expect(twice.gold).toBe(23);
  });

  it('리롤해도 가진 부적은 진열에 안 나온다', () => {
    let run: RunState = { ...inShop(1000), talismans: [talisman('lamp', 1), talisman('coins', 2)] };
    for (let i = 0; i < 30; i++) {
      run = runReducer(run, { type: 'reroll' });
      for (const offer of run.shop!.talismans) expect(['lamp', 'coins']).not.toContain(offer.item);
    }
  });

  it('부적 팔기: 구매가의 절반', () => {
    const run = { ...inShop(10), talismans: [talisman('tiger', 9)] };
    const sold = runReducer(run, { type: 'sell', uid: 9 });
    expect(sold.gold).toBe(10 + 4);
    expect(sold.talismans).toHaveLength(0);
    expect(TALISMANS.tiger.rarity).toBe('rare');
  });

  it('블록 팩: 3개 중 하나를 가방에 넣는다', () => {
    const shop = inShop(10);
    const opened = runReducer(shop, { type: 'buyPack' });
    expect(opened.gold).toBe(6);
    expect(opened.shop?.pack.choices).toHaveLength(3);
    const picked = runReducer(opened, { type: 'pickPack', index: 1 });
    expect(picked.bag).toHaveLength(19);
    expect(picked.bag.at(-1)?.shape).toBe(opened.shop!.pack.choices![1]);
    expect(runReducer(picked, { type: 'pickPack', index: 0 })).toBe(picked);
  });

  it('블록 빼기: 장터마다 1번, 가방은 최소 10개', () => {
    const shop = inShop(10);
    const removed = runReducer(shop, { type: 'removeBlock', shape: 'bar5' });
    expect(removed.bag).toHaveLength(17);
    expect(removed.bag.some((b) => b.shape === 'bar5')).toBe(false);
    expect(runReducer(removed, { type: 'removeBlock', shape: 'dot' })).toBe(removed);
    const small = { ...inShop(10), bag: inShop(10).bag.slice(0, 10) };
    expect(runReducer(small, { type: 'removeBlock', shape: 'dot' })).toBe(small);
  });

  it('장터에서 비전서를 쓰면 런의 족보 레벨이 오른다', () => {
    const run = { ...inShop(10), consumables: [{ kind: 'scroll' as const, pattern: 'cross' as const }] };
    const used = runReducer(run, { type: 'useScroll', index: 0 });
    expect(used.levels.cross).toBe(2);
    expect(used.consumables).toHaveLength(0);
  });

  it('다음 판: 판 1 → 판 2, 산 부적을 들고 간다', () => {
    const bought = runReducer(inShop(30), { type: 'buyTalisman', slot: 0 });
    const next = runReducer(bought, { type: 'next' });
    expect(next).toMatchObject({ ante: 1, stageKind: 'big', phase: 'preview', shop: null });
    expect(next.stage.rules.target).toBe(225);
    expect(next.stage.talismans).toEqual(bought.talismans);
  });
});

describe('수련 효과', () => {
  const perks = (overrides: Partial<RunPerks>): RunPerks => ({ ...NO_PERKS, ...overrides });

  it('시작 골드, 족보 레벨, 판마다 핸드·버리기', () => {
    const run = createRun('PERK01', { perks: perks({ startGold: 4, startLevels: 1, hands: 1, discards: 2 }) });
    expect(run.gold).toBe(8);
    expect(run.levels.single).toBe(2);
    expect(run.stage.rules.hands).toBe(6);
    expect(run.stage.discardsLeft).toBe(4);
  });

  it('이자 상한 +$2', () => {
    const run = { ...createRun('PERK01', { perks: perks({ interestCap: 2 }) }), gold: 80 };
    expect(clearStage(run).reward?.at(-1)?.gold).toBe(7);
  });

  it('부적 칸·소모품 칸·장터 진열이 늘어난다', () => {
    const run = createRun('PERK01', { perks: perks({ talismanSlots: 1, consumableSlots: 1, shopTalismans: 1 }) });
    const shop = runReducer(clearStage(run), { type: 'collect' });
    expect(shop.shop?.talismans).toHaveLength(3);
    const five = { ...shop, gold: 99, talismans: [1, 2, 3, 4, 5].map((uid) => talisman('lamp', uid)) };
    expect(runReducer(five, { type: 'buyTalisman', slot: 0 }).talismans).toHaveLength(6);
  });

  it('첫 인연: 일반 부적 3개 중 하나를 고르고 시작', () => {
    const run = createRun('PERK01', { perks: perks({ firstCharm: true, discards: 0 }) });
    expect(run.phase).toBe('starter');
    expect(run.relics).toHaveLength(3);
    for (const offer of run.relics!) expect(offer.kind === 'talisman' && TALISMANS[offer.id].rarity).toBe('common');
    const winnowIndex = run.relics!.findIndex((o) => o.kind === 'talisman' && o.id === 'winnow');
    const picked = runReducer(run, { type: 'pickRelic', index: Math.max(0, winnowIndex) });
    expect(picked.phase).toBe('preview');
    expect(picked.talismans).toHaveLength(1);
    // 고른 부적으로 판을 다시 만든다 (키를 골랐다면 버리기 +1)
    expect(picked.stage.talismans).toEqual(picked.talismans);
    expect(runReducer(run, { type: 'skipRelic' }).phase).toBe('preview');
  });

  it('기사회생은 런에 한 번: 쓰면 다음 판부터는 없다', () => {
    const run = createRun('PERK01', { perks: perks({ secondWind: true }) });
    expect(run.rescueLeft).toBe(1);
    expect(run.stage.rescueReady).toBe(true);
    const done = clearStage(run, { rescued: true, rescueReady: false });
    expect(done.rescueLeft).toBe(0);
    const next = runReducer(runReducer(done, { type: 'collect' }), { type: 'next' });
    expect(next.stage.rescueReady).toBe(false);
  });
});

describe('오늘의 판 코스', () => {
  const dailyAt = (ante: number) => createRun('D20261012', { mode: 'daily', start: { ante, kind: 'boss' } });

  it('고개 3 요괴를 깨도 끝이 아니라 유품 → 장터 → 끝판', () => {
    const relic = runReducer(clearStage(dailyAt(3)), { type: 'collect' });
    expect(relic.phase).toBe('relic');
    const shop = runReducer(relic, { type: 'skipRelic' });
    expect(upcomingStage(shop)).toMatchObject({ kind: 'finale', target: 0 });
    const finale = runReducer(shop, { type: 'next' });
    expect(finale).toMatchObject({ stageKind: 'finale', phase: 'preview' });
    expect(finale.stage.scoreAttack).toBe(true);
  });

  it('끝판은 목표 없이 핸드를 다 쓰면 완주(엔딩)로 끝나고, 점수가 남는다', () => {
    const shop = runReducer(runReducer(clearStage(dailyAt(3)), { type: 'collect' }), { type: 'skipRelic' });
    const finale = runReducer(runReducer(shop, { type: 'next' }), { type: 'begin' });
    const lastHand: RunState = {
      ...finale,
      stage: { ...finale.stage, handNumber: 5, score: 1234, board: boardFrom(['.#######', '#']), hand: [dot(), null, null] },
    };
    const done = runReducer(lastHand, { type: 'stage', action: { type: 'place', slot: 0, row: 0, col: 0 } });
    expect(done.phase).toBe('ending');
    expect(done.stage.score).toBe(1234 + 18);
    expect(done.history).toHaveLength(finale.history.length);
  });

  it('일반 런은 고개 8 요괴가 끝, 오늘의 판은 고개 3에서 끝판', () => {
    expect(courseOf('normal')).toEqual({ antes: 8, finale: false });
    expect(courseOf('daily')).toEqual({ antes: 3, finale: true });
  });

  it('판 결과가 차례로 기록된다 (🟩 핸드를 남기고, 🟨 마지막 핸드에, 🟥 실패)', () => {
    const run = createRun('MARK01');
    const cleared = clearStage(run);
    expect(cleared.history).toEqual(['clear']);
    const lastHand = clearStage(run, { handNumber: 5 });
    expect(lastHand.history).toEqual(['close']);
    const failing: RunState = { ...run, phase: 'playing', stage: { ...run.stage, handNumber: 5, hand: [dot(), null, null] } };
    const over = runReducer(failing, { type: 'stage', action: { type: 'place', slot: 0, row: 4, col: 4 } });
    expect(over.history).toEqual(['fail']);
  });
});

describe('요괴 판과 엔딩', () => {
  const atBoss = (ante: number) => createRun('BOSS01', { start: { ante, kind: 'boss' } });

  it('판 2 장터에서 다음을 누르면 같은 고개의 요괴 판', () => {
    const shop: RunState = { ...createRun('BOSS01'), ante: 3, stageKind: 'big', phase: 'shop', shop: inShop().shop };
    const next = runReducer(shop, { type: 'next' });
    expect(next).toMatchObject({ ante: 3, stageKind: 'boss', phase: 'preview' });
    expect(next.stage.boss).toBe(next.bosses[2]);
  });

  it('요괴 판을 깨면 유품 3개 중 하나를 고르고 장터로', () => {
    const boss = atBoss(2);
    expect(boss.stageKind).toBe('boss');
    const reward = runReducer(clearStage(boss), { type: 'collect' });
    expect(reward.phase).toBe('relic');
    expect(reward.relics).toHaveLength(3);
    expect(reward.relics![2].kind).toBe('consumable');
    for (const offer of reward.relics!.slice(0, 2)) {
      expect(offer.kind === 'talisman' && TALISMANS[offer.id].rarity).not.toBe('common');
    }
    const picked = runReducer(reward, { type: 'pickRelic', index: 0 });
    expect(picked.phase).toBe('shop');
    expect(picked.talismans).toHaveLength(1);
  });

  it('요괴 판 다음은 다음 고개의 판 1', () => {
    const shop = runReducer(runReducer(clearStage(atBoss(2)), { type: 'collect' }), { type: 'skipRelic' });
    const next = runReducer(shop, { type: 'next' });
    expect(next).toMatchObject({ ante: 3, stageKind: 'small' });
  });

  it('고개 8의 이무기를 깨면 엔딩', () => {
    const boss = atBoss(8);
    expect(boss.stage.boss).toBe('imugi');
    const ending = runReducer(clearStage(boss), { type: 'collect' });
    expect(ending.phase).toBe('ending');
  });
});
