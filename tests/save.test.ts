import { describe, expect, it } from 'vitest';
import { newProfile } from '../src/core/profile';
import { createRun, runReducer, type RunAction, type RunState } from '../src/core/run';
import { createSaveStore, SAVE_VERSION } from '../src/save/storage';
import { decodeSave, encodeSave } from '../src/save/transfer';

/** 테스트용 localStorage */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

/** 놓을 수 있는 첫 자리에 블록을 놓는 수 몇 개 */
function someMoves(run: RunState, count: number): RunAction[] {
  const actions: RunAction[] = [{ type: 'begin' }];
  let current = runReducer(run, { type: 'begin' });
  for (let i = 0; i < count && current.phase === 'playing'; i++) {
    const slot = current.stage.hand.findIndex(Boolean);
    let placed = false;
    for (let row = 0; row < 8 && !placed; row++) {
      for (let col = 0; col < 8 && !placed; col++) {
        const action: RunAction = { type: 'stage', action: { type: 'place', slot, row, col } };
        const next = runReducer(current, action);
        if (next !== current) {
          actions.push(action);
          current = next;
          placed = true;
        }
      }
    }
    if (!placed) break;
  }
  return actions;
}

describe('저장과 이어하기', () => {
  it('저장했다 불러온 런으로 이어서 해도 결과가 똑같다', () => {
    const run = createRun('SAVE01');
    const moves = someMoves(run, 12);
    const half = moves.slice(0, 6);
    const rest = moves.slice(6);

    const midway = half.reduce(runReducer, run);
    const reloaded = JSON.parse(JSON.stringify(midway)) as RunState;

    const straight = rest.reduce(runReducer, midway);
    const resumed = rest.reduce(runReducer, reloaded);
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(straight));
  });

  it('런 저장·불러오기·지우기', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    const run = createRun('SAVE01');
    store.saveRun('run-1', run);
    const loaded = store.loadRun();
    expect(loaded?.id).toBe('run-1');
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.run.seed).toBe('SAVE01');
    store.clearRun();
    expect(store.loadRun()).toBeNull();
  });

  it('v0.3 저장(버전 1)은 지금 구조로 올려서 이어할 수 있다', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    // 버전 1에는 없던 필드를 지운 예전 모양
    const old = JSON.parse(JSON.stringify(createRun('SAVE01')));
    delete old.mode;
    delete old.official;
    delete old.history;
    delete old.stats.bestPattern;
    delete old.stage.scoreAttack;
    delete old.stage.stats.bestPattern;
    storage.setItem('block-dosa:run', JSON.stringify({ version: 1, id: 'old-run', savedAt: 1, run: old }));

    const loaded = store.loadRun();
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.run).toMatchObject({ mode: 'normal', official: false, history: [] });
    expect(loaded?.run.stage.scoreAttack).toBe(false);
    // 이어서 해도 문제없다
    const next = runReducer(loaded!.run, { type: 'begin' });
    expect(next.phase).toBe('playing');
  });

  it('v0.4 저장(버전 2)은 v1.0 구조로 올려서 이어할 수 있다', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    const old = JSON.parse(JSON.stringify(createRun('SAVE02')));
    delete old.bagType;
    delete old.stake;
    delete old.endless;
    old.records = { bestAnte: 3, endings: 0 };
    for (const key of ['stash', 'stashEnabled', 'handSize', 'resolvedThisHand', 'placedThisHand', 'clearsThisHand']) {
      delete old.stage[key];
    }
    old.stage.hand = [old.stage.hand[0], null, old.stage.hand[2]];
    old.shop = {
      rng: 1,
      rerolls: 0,
      talismanCount: 2,
      talismans: [],
      consumables: [],
      pack: { bought: true, choices: ['dot', 'u', 'plus'], done: false },
      removalUsed: false,
    };
    storage.setItem('block-dosa:run', JSON.stringify({ version: 2, id: 'v04-run', savedAt: 1, run: old }));

    const loaded = store.loadRun()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.run).toMatchObject({ bagType: 'basic', stake: 1, endless: false });
    expect(loaded.run.records).toEqual({ bestAnte: 3, endings: 0, totalPerfects: 0, runs: 0 });
    expect(loaded.run.stage).toMatchObject({ stash: null, stashEnabled: false, handSize: 3, resolvedThisHand: 1 });
    expect(loaded.run.shop).toMatchObject({ freeRerolls: 0, priceDelta: 0 });
    expect(loaded.run.shop?.pack.choices).toEqual([{ shape: 'dot' }, { shape: 'u' }, { shape: 'plus' }]);
    // 이어서 해도 문제없다
    const playing = runReducer({ ...loaded.run, shop: null }, { type: 'begin' });
    const slot = playing.stage.hand.findIndex(Boolean);
    const moved = runReducer(playing, { type: 'stage', action: { type: 'place', slot, row: 0, col: 0 } });
    expect(moved.stage.stats.placed).toBe(1);
  });

  it('v1.0 저장(버전 3)은 v1.1 구조로 올려서 이어할 수 있다', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    const old = JSON.parse(JSON.stringify(createRun('SAVE03')));
    for (const key of ['rule', 'vouchers', 'seen']) delete old[key];
    for (const key of ['obstacle', 'consumableSlots', 'undo']) delete old.stage[key];
    old.talismans = [{ uid: 50, id: 'lamp', counter: 0 }];
    storage.setItem('block-dosa:run', JSON.stringify({ version: 3, id: 'v10-run', savedAt: 1, run: old }));

    const loaded = store.loadRun()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.run).toMatchObject({ rule: null, vouchers: { freePack: false, discount: false, freeRerolls: 0 } });
    expect(loaded.run.seen.talismans).toEqual(['lamp']);
    expect(loaded.run.stage).toMatchObject({ obstacle: null, consumableSlots: 2, undo: null });
    const playing = runReducer(loaded.run, { type: 'begin' });
    const slot = playing.stage.hand.findIndex(Boolean);
    expect(runReducer(playing, { type: 'stage', action: { type: 'place', slot, row: 0, col: 0 } }).stage.stats.placed).toBe(1);
  });

  it('버전이 다르거나 깨진 저장은 무시한다', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    storage.setItem('block-dosa:run', '{"version":0,"id":"x","run":{}}');
    expect(store.loadRun()).toBeNull();
    storage.setItem('block-dosa:run', '{깨짐');
    expect(store.loadRun()).toBeNull();
  });

  it('프로필이 없으면 새 프로필, 있으면 기본값 위에 덮어서 읽는다', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    expect(store.loadProfile()).toEqual(newProfile());
    storage.setItem('block-dosa:profile', JSON.stringify({ version: 1, merit: 55 }));
    expect(store.loadProfile()).toEqual({ ...newProfile(), merit: 55 });
  });

  it('저장소를 못 쓰는 환경에서도 에러 없이 넘어간다', () => {
    const broken = {
      getItem: () => {
        throw new Error('막힘');
      },
      setItem: () => {
        throw new Error('막힘');
      },
      removeItem: () => {
        throw new Error('막힘');
      },
    };
    const store = createSaveStore(broken);
    expect(() => store.saveRun('x', createRun('SAVE01'))).not.toThrow();
    expect(store.loadRun()).toBeNull();
    expect(store.loadProfile()).toEqual(newProfile());
    expect(createSaveStore(null).loadRun()).toBeNull();
  });
});

describe('세이브 코드', () => {
  it('프로필과 진행 중인 런을 코드로 옮긴다', async () => {
    const from = createSaveStore(memoryStorage());
    from.saveProfile({ ...newProfile(), merit: 321, settings: { numberStyle: 'exponent', leftHand: true } });
    from.saveRun('moving-run', createRun('MOVE01'));
    const code = await encodeSave(from.exportRaw());
    expect(code.startsWith('BDS1.')).toBe(true);

    const to = createSaveStore(memoryStorage());
    const data = await decodeSave(`  ${code.slice(0, 20)}\n${code.slice(20)}  `);
    expect(data).not.toBeNull();
    expect(to.importRaw(data!)).toBe(true);
    expect(to.loadProfile()).toMatchObject({ merit: 321, settings: { numberStyle: 'exponent', leftHand: true } });
    expect(to.loadRun()?.run.seed).toBe('MOVE01');
  });

  it('깨진 코드는 아무것도 바꾸지 않는다', async () => {
    expect(await decodeSave('BDS1.깨진코드')).toBeNull();
    expect(await decodeSave('K7Q2MX')).toBeNull();
    const store = createSaveStore(memoryStorage());
    store.saveProfile({ ...newProfile(), merit: 5 });
    expect(store.importRaw({ profile: '{깨짐', run: null })).toBe(false);
    expect(store.loadProfile().merit).toBe(5);
  });

  it('예전 프로필은 설정·도감을 기본값 위에 덮어서 읽는다', () => {
    const storage = memoryStorage();
    storage.setItem('block-dosa:profile', JSON.stringify({ version: 1, merit: 7, settings: { leftHand: true } }));
    const profile = createSaveStore(storage).loadProfile();
    expect(profile.settings).toEqual({ numberStyle: 'korean', leftHand: true });
    expect(profile.collection.talismans).toEqual([]);
    expect(profile.merit).toBe(7);
  });
});
