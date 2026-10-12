import { describe, expect, it } from 'vitest';
import { TALISMAN_PRICE } from '../src/content/balance';
import { SHAPES } from '../src/content/blocks';
import { REGULAR_BOSSES } from '../src/content/bosses';
import { TALISMANS } from '../src/content/talismans';
import { NO_PERKS, type RunPerks } from '../src/content/upgrades';
import { emptyBoard } from '../src/core/board';
import {
  anteBase,
  bossAt,
  canSkip,
  courseOf,
  createRun,
  rollBosses,
  rollRelics,
  runReducer,
  skipRewardOf,
  stageTarget,
  talismanSlots,
  upcomingStage,
  type RunAction,
  type RunStart,
  type RunState,
} from '../src/core/run';
import type { SkipRewardId } from '../src/content/skips';
import { consumablePrice } from '../src/core/shop';
import { WEEKLY_RULE_BY_ID } from '../src/content/weekly';
import { weeklyRuleOf } from '../src/core/daily';
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
    expect(run.reward?.find((line) => line.label.includes('판에서 얻은 골드'))?.gold).toBe(3);
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
    expect(picked.bag.at(-1)?.shape).toBe(opened.shop!.pack.choices![1].shape);
    expect(runReducer(picked, { type: 'pickPack', index: 0 })).toBe(picked);
  });

  it('블록 빼기: 장터마다 1번, 가방은 최소 10개', () => {
    const shop = inShop(10);
    const bar5 = shop.bag.find((b) => b.shape === 'bar5')!;
    const removed = runReducer(shop, { type: 'removeBlock', bagId: bar5.id });
    expect(removed.gold).toBe(7);
    expect(removed.bag).toHaveLength(17);
    expect(removed.bag.some((b) => b.shape === 'bar5')).toBe(false);
    expect(runReducer(removed, { type: 'removeBlock', bagId: 0 })).toBe(removed);
    const small = { ...inShop(10), bag: inShop(10).bag.slice(0, 10) };
    expect(runReducer(small, { type: 'removeBlock', bagId: 0 })).toBe(small);
    expect(runReducer(shop, { type: 'removeBlock', bagId: 999 })).toBe(shop);
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
  const dailyAt = (ante: number) =>
    createRun('D20261012', { mode: 'daily', start: { ante, kind: 'boss', boss: 'dokkaebi' } });

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
    const victory = runReducer(clearStage(boss), { type: 'collect' });
    expect(victory.phase).toBe('victory');
    expect(runReducer(victory, { type: 'finish' }).phase).toBe('ending');
  });
});

describe('가방 종류', () => {
  it('막대 가방: 막대 위주 18개, 🌀 바람개비를 들고 시작', () => {
    const run = createRun('BAG001', { bagType: 'bars' });
    expect(run.bag).toHaveLength(18);
    expect(run.bag.filter((b) => SHAPES[b.shape].kind === 'bar')).toHaveLength(11);
    expect(run.talismans.map((t) => t.id)).toEqual(['pinwheel']);
    expect(run.stage.rotation).toBe(true);
  });

  it('네모 가방: ㅁ·큰ㅁ·직사각이 8개', () => {
    const run = createRun('BAG001', { bagType: 'squares' });
    expect(run.bag).toHaveLength(18);
    expect(run.bag.filter((b) => SHAPES[b.shape].kind === 'square')).toHaveLength(8);
  });

  it('혼돈 가방: 모든 블록이 강화된 채 시작하고 부적 칸 −1. 같은 코드면 같은 강화', () => {
    const run = createRun('BAG001', { bagType: 'chaos' });
    expect(run.bag.every((b) => b.enh)).toBe(true);
    expect(new Set(run.bag.map((b) => b.enh)).size).toBeGreaterThan(1);
    expect(talismanSlots(run)).toBe(4);
    expect(createRun('BAG001', { bagType: 'chaos' }).bag).toEqual(run.bag);
  });
});

describe('난이도 단계', () => {
  const at = (stake: number, start?: RunStart) => createRun('STAKE1', { stake, start });
  const rocks = (run: RunState) => run.stage.board.filter((c) => c?.kind === 'rock').length;

  it('행자(2): 판 1 클리어 보상이 없다', () => {
    expect(clearStage(at(2)).reward![0]).toEqual({ label: '판 1 클리어 (난이도: 보상 없음)', gold: 0 });
    expect(clearStage(at(1)).reward![0].gold).toBe(3);
    expect(clearStage(at(2, { ante: 1, kind: 'big' })).reward![0].gold).toBe(4);
  });

  it('수행자(3): 판 1·판 2에 바위 +2, 요괴 판은 그대로', () => {
    expect(rocks(at(1))).toBe(0);
    expect(rocks(at(3))).toBe(2);
    expect(rocks(at(3, { ante: 1, kind: 'boss', boss: 'dokkaebi' }))).toBe(0);
  });

  it('도인(4): 버리기 −1, 신선(8): 핸드도 −1', () => {
    expect(at(4).stage.rules).toMatchObject({ hands: 5, discards: 1 });
    expect(at(8).stage.rules).toMatchObject({ hands: 4, discards: 1 });
  });

  it('법사(5): 이자 상한 $3', () => {
    const interest = (stake: number) =>
      clearStage({ ...at(stake), gold: 50 }).reward!.find((line) => line.label.startsWith('이자'))?.gold;
    expect(interest(4)).toBe(5);
    expect(interest(5)).toBe(3);
  });

  it('도사(6): 요괴 판 목표 ×1.25', () => {
    expect(stageTarget(1, 'boss', 'dokkaebi', 6)).toBe(375);
    expect(stageTarget(1, 'small', null, 6)).toBe(150);
    expect(at(6, { ante: 1, kind: 'boss', boss: 'dokkaebi' }).stage.rules.target).toBe(375);
  });

  it('진인(7): 장터 가격 +$1', () => {
    const shop = { ...runReducer(clearStage(at(7)), { type: 'collect' }), gold: 20 };
    expect(shop.shop!.consumables.every((offer) => offer.price === consumablePrice(offer.item) + 1)).toBe(true);
    expect(runReducer(shop, { type: 'buyPack' }).gold).toBe(15);
  });
});

describe('끝없는 모드', () => {
  const victory = () =>
    runReducer(clearStage(createRun('ENDLS1', { start: { ante: 8, kind: 'boss' } })), { type: 'collect' });

  it('고개 8 요괴를 깨면 끝낼지 계속할지 고른다', () => {
    const run = victory();
    expect(run.phase).toBe('victory');
    expect(runReducer(run, { type: 'finish' }).phase).toBe('ending');
    expect(runReducer(run, { type: 'next' })).toBe(run);
  });

  it('계속하면 유품 → 장터 → 고개 9 판 1', () => {
    const relic = runReducer(victory(), { type: 'endless' });
    expect(relic).toMatchObject({ endless: true, phase: 'relic' });
    const shop = runReducer(relic, { type: 'skipRelic' });
    expect(upcomingStage(shop)).toMatchObject({ ante: 9, kind: 'small', target: 240_000 });
    expect(runReducer(shop, { type: 'next' })).toMatchObject({ ante: 9, stageKind: 'small', phase: 'preview' });
  });

  it('고개 9부터 목표는 고개마다 12까지 ×3, 16까지 ×5, 그 뒤 ×10', () => {
    expect(anteBase(8)).toBe(80_000);
    expect(anteBase(9)).toBe(240_000);
    expect(anteBase(12)).toBe(80_000 * 3 ** 4);
    expect(anteBase(13)).toBe(80_000 * 3 ** 4 * 5);
    expect(anteBase(17)).toBe(80_000 * 3 ** 4 * 5 ** 4 * 10);
  });

  it('고개 9부터 요괴는 고개마다 새로 뽑고, 8의 배수 고개는 이무기', () => {
    const run = createRun('ENDLS1');
    const regular = REGULAR_BOSSES.map((b) => b.id);
    for (let ante = 9; ante < 16; ante++) expect(regular).toContain(bossAt(run, ante));
    expect(bossAt(run, 16)).toBe('imugi');
    expect(bossAt(run, 3)).toBe(run.bosses[2]);
  });

  it('끝없는 모드에서는 이무기를 다시 깨도 계속 간다', () => {
    const run = createRun('ENDLS1', { start: { ante: 16, kind: 'boss' } });
    expect(run.endless).toBe(true);
    expect(run.stage.boss).toBe('imugi');
    expect(runReducer(clearStage(run), { type: 'collect' }).phase).toBe('relic');
  });
});

describe('v1.0 유품과 장터', () => {
  const seeds = Array.from({ length: 80 }, (_, i) => `REL${i}`);
  const hasLegendary = (seed: string, ante: number) =>
    rollRelics({ ...createRun(seed), ante }).some(
      (offer) => offer.kind === 'talisman' && TALISMANS[offer.id].rarity === 'legendary',
    );

  it('고개 4부터 요괴 유품에 가끔 전설 부적이 섞인다', () => {
    expect(seeds.some((seed) => hasLegendary(seed, 3))).toBe(false);
    expect(seeds.some((seed) => hasLegendary(seed, 4))).toBe(true);
    for (const seed of seeds.slice(0, 20)) {
      const offers = rollRelics({ ...createRun(seed), ante: 6 });
      expect(offers).toHaveLength(3);
      const ids = offers.flatMap((o) => (o.kind === 'talisman' ? [o.id] : []));
      expect(new Set(ids).size).toBe(2);
    }
  });

  it('🔖 도장: 장터에서 가방 블록 2개까지 강화한다', () => {
    const run: RunState = { ...inShop(10), consumables: [{ kind: 'stamp', enh: 'gold' }] };
    const stamped = runReducer(run, { type: 'stamp', index: 0, bagIds: [5, 6] });
    expect(stamped.bag.filter((b) => b.enh === 'gold').map((b) => b.id)).toEqual([5, 6]);
    expect(stamped.consumables).toHaveLength(0);
    expect(runReducer(run, { type: 'stamp', index: 0, bagIds: [5, 999] })).toBe(run);
    expect(runReducer(run, { type: 'stamp', index: 0, bagIds: [1, 2, 3] })).toBe(run);
    expect(runReducer(run, { type: 'ink', index: 0, bagId: 5 })).toBe(run);
    const playing: RunState = { ...run, phase: 'playing' };
    expect(runReducer(playing, { type: 'stamp', index: 0, bagIds: [5] })).toBe(playing);
  });

  it('🖌️ 먹: 가방 블록 1개를 강화까지 똑같이 하나 더', () => {
    const base = inShop(10);
    const bag = base.bag.map((b) => (b.id === 5 ? { ...b, enh: 'fire' as const } : b));
    const run: RunState = { ...base, bag, consumables: [{ kind: 'ink' }] };
    const inked = runReducer(run, { type: 'ink', index: 0, bagId: 5 });
    expect(inked.bag).toHaveLength(19);
    expect(inked.bag.at(-1)).toEqual({ id: run.nextId, shape: bag[5].shape, enh: 'fire' });
    expect(inked.nextId).toBe(run.nextId + 1);
  });

  it('강화된 팩 블록은 강화된 채로 가방에 들어간다', () => {
    const base = inShop(10);
    const run: RunState = {
      ...base,
      shop: { ...base.shop!, pack: { bought: true, choices: [{ shape: 'u', enh: 'glass' }], done: false } },
    };
    expect(runReducer(run, { type: 'pickPack', index: 0 }).bag.at(-1)).toMatchObject({ shape: 'u', enh: 'glass' });
  });

  it('✂️ 엿장수 가위가 있으면 장터 첫 리롤이 무료', () => {
    const reward = clearStage(createRun('SHOP01'), { talismans: [talisman('scissors', 70)] });
    const shop = { ...runReducer(reward, { type: 'collect' }), gold: 10 };
    expect(shop.shop!.freeRerolls).toBe(1);
    const free = runReducer(shop, { type: 'reroll' });
    expect(free.gold).toBe(10);
    expect(runReducer(free, { type: 'reroll' }).gold).toBe(7);
  });
});

describe('v1.0 판 결과', () => {
  it('🪶 봉황 깃털: 판에 실패해도 깃털을 태워 그 판을 넘긴다. 봉인되면 못 쓴다', () => {
    const run = createRun('PHNX01');
    const failing: RunState = {
      ...run,
      phase: 'playing',
      stage: { ...run.stage, talismans: [talisman('feather', 50)], handNumber: 5, hand: [dot(), null, null], board: emptyBoard(), bonus: {} },
    };
    const placeDot: RunAction = { type: 'stage', action: { type: 'place', slot: 0, row: 4, col: 4 } };
    const revived = runReducer(failing, placeDot);
    expect(revived.phase).toBe('reward');
    expect(revived.talismans).toHaveLength(0);
    expect(revived.reward![0].label).toContain('봉황');
    expect(revived.history.at(-1)).toBe('close');
    const sealed: RunState = { ...failing, stage: { ...failing.stage, sealedUid: 50 } };
    expect(runReducer(sealed, placeDot).phase).toBe('over');
  });

  it('🔥 강철이 판은 보상·이자도 없고, 대나무는 그대로 자란다', () => {
    const run = createRun('DRY001', { start: { ante: 2, kind: 'boss', boss: 'gangcheol' } });
    const done = clearStage({ ...run, gold: 50 }, { talismans: [talisman('bamboo', 9)] });
    expect(done.reward).toEqual([{ label: '🔥 강철이의 가뭄: 골드 없음', gold: 0 }]);
    expect(done.talismans[0].counter).toBe(2);
  });

  it('판에서 깨진 유리 블록은 런의 가방에서도 사라진다', () => {
    const run = createRun('GLASS1');
    const done = clearStage(run, { bag: run.stage.bag.filter((b) => b.id !== 3) });
    expect(done.bag).toHaveLength(17);
  });
});

describe('판 건너뛰기', () => {
  /** 고개 1 판 1을 건너뛰면 그 보상이 나오는 시드 */
  function seedFor(reward: SkipRewardId): string {
    for (let i = 0; i < 500; i++) {
      if (skipRewardOf({ seed: `SKIP${i}`, ante: 1, stageKind: 'small' }) === reward) return `SKIP${i}`;
    }
    throw new Error(reward);
  }
  const skip = (run: RunState) => runReducer(run, { type: 'skip' });

  it('판 1·판 2 미리보기에서만: 보상을 받고 다음 판 미리보기로, 기록은 ⬜', () => {
    const run = createRun(seedFor('gold'));
    expect(canSkip(run)).toBe(true);
    const next = skip(run);
    expect(next).toMatchObject({ ante: 1, stageKind: 'big', phase: 'preview', gold: run.gold + 10 });
    expect(next.history).toEqual(['skip']);
    expect(next.stats.stagesCleared).toBe(0);
    const boss = skip(next);
    expect(boss.stageKind).toBe('boss');
    expect(canSkip(boss)).toBe(false);
    expect(skip(boss)).toBe(boss);
    expect(skip({ ...run, phase: 'playing' }).phase).toBe('playing');
  });

  it('미리보기 동안 바꾼 부적 순서·비전서는 그대로 들고 간다', () => {
    const run = createRun(seedFor('gold'));
    const withScroll: RunState = { ...run, stage: { ...run.stage, consumables: [], levels: { ...run.levels, quad: 3 } } };
    expect(skip(withScroll).levels.quad).toBe(3);
  });

  it('공짜 팩·반값·공짜 리롤은 다음 장터에서 쓰고 사라진다', () => {
    const toShop = (run: RunState) => runReducer(clearStage(skip(run)), { type: 'collect' });
    const pack = toShop(createRun(seedFor('freePack')));
    expect(pack.shop?.freePack).toBe(true);
    const bought = runReducer({ ...pack, gold: 0 }, { type: 'buyPack' });
    expect(bought.shop?.pack.bought).toBe(true);

    const sale = toShop(createRun(seedFor('discount')));
    for (const offer of sale.shop!.talismans) {
      expect(offer.price).toBe(Math.max(1, Math.floor(TALISMAN_PRICE[TALISMANS[offer.item].rarity] / 2)));
    }

    const rerolls = toShop(createRun(seedFor('rerolls')));
    expect(rerolls.shop?.freeRerolls).toBe(3);
    expect(rerolls.vouchers).toEqual({ freePack: false, discount: false, freeRerolls: 0 });
  });

  it('족보 공부: 무작위 족보 3개 레벨 +1', () => {
    const run = createRun(seedFor('study'));
    const levels = Object.values(skip(run).levels);
    expect(levels.filter((level) => level === 2)).toHaveLength(3);
  });
});

describe('저주받은 부적', () => {
  it('팔 수 없다', () => {
    const run = { ...inShop(10), talismans: [talisman('demonTile', 9)] };
    expect(runReducer(run, { type: 'sell', uid: 9 })).toBe(run);
  });

  it('귀면와: 핸드 −1, 하회탈: 버리기 −2', () => {
    const run = createRun('CURSE1');
    const withTile = runReducer(clearStage(run, { talismans: [talisman('demonTile', 9)] }), { type: 'collect' });
    const next = runReducer(withTile, { type: 'next' });
    expect(next.stage.rules.hands).toBe(4);
    const masked = runReducer(runReducer(clearStage(run, { talismans: [talisman('hahoe', 9)] }), { type: 'collect' }), { type: 'next' });
    expect(masked.stage.rules.discards).toBe(0);
  });

  it('금단지: 판 클리어 +$8, 이자는 없다', () => {
    const done = clearStage({ ...createRun('CURSE1'), gold: 50 }, { talismans: [talisman('goldJar', 9)] });
    expect(done.reward?.some((line) => line.label.includes('금단지') && line.gold === 8)).toBe(true);
    expect(done.reward?.some((line) => line.label.includes('이자 없음'))).toBe(true);
    expect(done.reward?.some((line) => line.label.startsWith('이자 ('))).toBe(false);
  });
});

describe('주간 도전', () => {
  const weekly = (monday: string) => createRun(`W${monday}`, { mode: 'weekly' });

  it('오늘의 판처럼 고개 3 + 끝판, 그 주의 규칙이 붙는다', () => {
    const run = weekly('20261012');
    expect(courseOf(run.mode)).toEqual({ antes: 3, finale: true });
    expect(run.rule).toBe(weeklyRuleOf('20261012').id);
  });

  it('규칙마다: 막대 잔치 가방, 단출한 짐 부적 칸, 급한 길 핸드·버리기, 바람 부는 날 바람개비', () => {
    const find = (id: string) => {
      for (let week = 0; week < 7; week++) {
        const day = new Date(Date.UTC(2026, 0, 5 + week * 7));
        const monday = `${day.getUTCFullYear()}${String(day.getUTCMonth() + 1).padStart(2, '0')}${String(day.getUTCDate()).padStart(2, '0')}`;
        if (weeklyRuleOf(monday).id === id) return weekly(monday);
      }
      throw new Error(id);
    };
    expect(find('barsOnly').bag.every((b) => SHAPES[b.shape].kind === 'bar' || b.shape === 'dot')).toBe(true);
    expect(talismanSlots(find('lightPack'))).toBe(3);
    expect(find('lightPack').gold).toBe(4 + 10);
    expect(find('hurry').stage.rules).toMatchObject({ hands: 4, discards: 5 });
    expect(find('windy').talismans.map((t) => t.id)).toEqual(['pinwheel']);
    expect(find('chaos').bag.every((b) => b.enh)).toBe(true);
    expect(find('hazards').stage.obstacle).not.toBeNull();
    expect(WEEKLY_RULE_BY_ID.rocky.extraRocks).toBe(3);
  });
});

describe('도감 기록', () => {
  it('판을 시작하면 만난 요괴·방해 칸·가방 블록을, 부적을 얻으면 그 부적을 적어 둔다', () => {
    const run = createRun('SEEN01', { start: { ante: 2, kind: 'boss', boss: 'gumiho' } });
    const begun = runReducer(run, { type: 'begin' });
    expect(begun.seen.bosses).toEqual(['gumiho']);
    expect(begun.seen.shapes).toContain('bar5');
    const shop = runReducer(clearStage(createRun('SEEN01')), { type: 'collect' });
    const bought = runReducer({ ...shop, gold: 50 }, { type: 'buyTalisman', slot: 0 });
    expect(bought.seen.talismans).toContain(shop.shop!.talismans[0].item);
  });
});
