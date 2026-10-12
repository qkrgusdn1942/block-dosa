import { describe, expect, it } from 'vitest';
import { PACK_PRICE, REMOVAL_PRICE } from '../src/content/balance';
import { ENHANCEMENT_IDS } from '../src/content/enhancements';
import { TALISMANS } from '../src/content/talismans';
import { NO_UNLOCK_RECORDS } from '../src/content/unlocks';
import { Rng } from '../src/core/rng';
import {
  createShop,
  packPrice,
  removalPrice,
  rerollCost,
  restock,
  rollConsumable,
  rollPackChoices,
  sellPrice,
  talismanPool,
  talismanPrice,
} from '../src/core/shop';

describe('장터', () => {
  it('소모품 6종이 정한 비율대로 나오고, 도장에는 강화 종류가 붙는다', () => {
    const rng = Rng.fromSeed('consumable-test');
    const rolls = 10_000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < rolls; i++) {
      const item = rollConsumable(rng);
      counts[item.kind] = (counts[item.kind] ?? 0) + 1;
      if (item.kind === 'stamp') expect(ENHANCEMENT_IDS).toContain(item.enh);
    }
    const expected = { scroll: 0.4, hammer: 0.15, fan: 0.12, broom: 0.1, stamp: 0.15, ink: 0.08 };
    for (const [kind, p] of Object.entries(expected)) expect(counts[kind] / rolls).toBeCloseTo(p, 1);
  });

  it('✂️ 무료 리롤부터 쓰고, 그다음은 $3부터 오른다', () => {
    const shop = createShop('SHOP01', 1, 'small', new Set(), { freeRerolls: 1 });
    expect(rerollCost(shop)).toBe(0);
    const once = restock(shop, new Set());
    expect(once.freeRerolls).toBe(0);
    expect(rerollCost(once)).toBe(3);
    expect(rerollCost(restock(once, new Set()))).toBe(4);
  });

  it('난이도 가격: 부적·소모품·팩·블록 빼기 +$1, 팔 때는 그대로', () => {
    const shop = createShop('SHOP01', 1, 'small', new Set(), { priceDelta: 1 });
    for (const offer of shop.talismans) expect(offer.price).toBe(talismanPrice(offer.item) + 1);
    for (const offer of shop.consumables) expect(offer.price).toBe(4);
    expect(packPrice(shop)).toBe(PACK_PRICE + 1);
    expect(removalPrice(shop)).toBe(REMOVAL_PRICE + 1);
    expect(sellPrice('tiger')).toBe(4);
  });

  it('블록 팩: ㄷ·더하기까지 모든 모양이 나오고, 5개 중 1개꼴로 강화돼 있다', () => {
    const rng = Rng.fromSeed('pack-test');
    const shapes = new Set<string>();
    let enhanced = 0;
    let total = 0;
    for (let i = 0; i < 2000; i++) {
      for (const choice of rollPackChoices(rng)) {
        shapes.add(choice.shape);
        total++;
        if (choice.enh) enhanced++;
      }
    }
    expect(shapes.has('u')).toBe(true);
    expect(shapes.has('plus')).toBe(true);
    expect(enhanced / total).toBeCloseTo(0.2, 1);
  });

  it('해금: 새 런은 해금한 부적만, 기록을 따지지 않으면(오늘의 판·코드 도전) 전부', () => {
    const pool = talismanPool(NO_UNLOCK_RECORDS);
    for (const locked of ['club', 'snowman', 'toad'] as const) expect(pool).not.toContain(locked);
    expect(talismanPool(null)).toHaveLength(34);
    expect(talismanPool({ ...NO_UNLOCK_RECORDS, bestAnte: 5, totalPerfects: 10 })).toHaveLength(34);
    for (let i = 0; i < 50; i++) {
      const shop = createShop(`P${i}`, 3, 'small', new Set(), { pool, talismanCount: 4 });
      for (const offer of shop.talismans) expect(pool).toContain(offer.item);
    }
  });

  it('전설 부적은 장터에 나오지 않는다', () => {
    for (let i = 0; i < 100; i++) {
      const shop = createShop(`L${i}`, 6, 'big', new Set(), { talismanCount: 4 });
      for (const offer of shop.talismans) expect(TALISMANS[offer.item].rarity).not.toBe('legendary');
    }
  });
});
