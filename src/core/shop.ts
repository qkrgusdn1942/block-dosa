import {
  CONSUMABLE_PRICE,
  PACK_CHOICES,
  PATTERN_IDS,
  REROLL_BASE,
  SHOP_CONSUMABLE_COUNT,
  SHOP_RARITY_WEIGHTS,
  SHOP_TALISMAN_COUNT,
  TALISMAN_PRICE,
  type Rarity,
  type StageKind,
} from '../content/balance';
import { PACK_SHAPES, type ShapeId } from '../content/blocks';
import type { Consumable } from '../content/consumables';
import { TALISMAN_IDS, TALISMANS, type TalismanId } from '../content/talismans';
import { Rng } from './rng';

/** 장터 → docs/03-roguelike.md, 가격 → docs/07-economy.md */

export interface ShopOffer<T> {
  item: T;
  price: number;
  sold: boolean;
}

export interface ShopState {
  /** shop 스트림 상태 (리롤도 이어서 쓴다) */
  rng: number;
  rerolls: number;
  /** 부적 진열 수 (수련 "단골"로 늘어남) */
  talismanCount: number;
  talismans: ShopOffer<TalismanId>[];
  consumables: ShopOffer<Consumable>[];
  pack: {
    bought: boolean;
    /** 산 뒤에 뽑힌 블록 3개 */
    choices: ShapeId[] | null;
    done: boolean;
  };
  removalUsed: boolean;
}

export const talismanPrice = (id: TalismanId) => TALISMAN_PRICE[TALISMANS[id].rarity];
export const sellPrice = (id: TalismanId) => Math.max(1, Math.floor(talismanPrice(id) / 2));
export const rerollCost = (shop: ShopState) => REROLL_BASE + shop.rerolls;

function pickWeighted<T>(rng: Rng, weights: ReadonlyArray<readonly [T, number]>): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [value, weight] of weights) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return weights[weights.length - 1][0];
}

/** 가진 것·이미 진열된 것을 빼고 등급 확률대로 부적을 고른다. 그 등급이 다 떨어지면 아무 등급에서 */
export function rollTalismans(
  rng: Rng,
  exclude: ReadonlySet<TalismanId>,
  count: number,
  weights: ReadonlyArray<readonly [Rarity, number]> = SHOP_RARITY_WEIGHTS,
): TalismanId[] {
  const taken = new Set(exclude);
  const allowed = new Set(weights.map(([r]) => r));
  const result: TalismanId[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = pickWeighted(rng, weights);
    let pool = TALISMAN_IDS.filter((id) => !taken.has(id) && TALISMANS[id].rarity === rarity);
    if (pool.length === 0) pool = TALISMAN_IDS.filter((id) => !taken.has(id) && allowed.has(TALISMANS[id].rarity));
    if (pool.length === 0) break;
    const id = pool[rng.int(pool.length)];
    taken.add(id);
    result.push(id);
  }
  return result;
}

export function randomScroll(rng: Rng): Consumable {
  return { kind: 'scroll', pattern: PATTERN_IDS[rng.int(PATTERN_IDS.length)] };
}

/** 비전서 1/2, 망치 1/4, 부채 1/4 */
export function rollConsumables(rng: Rng, count: number): Consumable[] {
  return Array.from({ length: count }, (): Consumable => {
    const roll = rng.next();
    if (roll < 0.5) return randomScroll(rng);
    return roll < 0.75 ? { kind: 'hammer' } : { kind: 'fan' };
  });
}

export function rollPackChoices(rng: Rng): ShapeId[] {
  return rng.shuffle(PACK_SHAPES).slice(0, PACK_CHOICES);
}

function stock(rng: Rng, owned: ReadonlySet<TalismanId>, talismanCount: number) {
  return {
    talismans: rollTalismans(rng, owned, talismanCount).map((item) => ({
      item,
      price: talismanPrice(item),
      sold: false,
    })),
    consumables: rollConsumables(rng, SHOP_CONSUMABLE_COUNT).map((item) => ({
      item,
      price: CONSUMABLE_PRICE,
      sold: false,
    })),
  };
}

export function createShop(
  seed: string,
  ante: number,
  kind: StageKind,
  owned: ReadonlySet<TalismanId>,
  talismanCount = SHOP_TALISMAN_COUNT,
): ShopState {
  const rng = Rng.fromSeed(seed, 'shop', ante, kind);
  const items = stock(rng, owned, talismanCount);
  return {
    ...items,
    rng: rng.state,
    rerolls: 0,
    talismanCount,
    pack: { bought: false, choices: null, done: false },
    removalUsed: false,
  };
}

/** 부적·소모품 진열을 새로 뽑는다 (블록 팩은 그대로) */
export function restock(shop: ShopState, owned: ReadonlySet<TalismanId>): ShopState {
  const rng = new Rng(shop.rng);
  const items = stock(rng, owned, shop.talismanCount);
  return { ...shop, ...items, rng: rng.state, rerolls: shop.rerolls + 1 };
}

export function openPack(shop: ShopState): ShopState {
  const rng = new Rng(shop.rng);
  const choices = rollPackChoices(rng);
  return { ...shop, rng: rng.state, pack: { bought: true, choices, done: false } };
}
