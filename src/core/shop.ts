import {
  CONSUMABLE_PRICE,
  PACK_CHOICES,
  PACK_PRICE,
  PATTERN_IDS,
  REMOVAL_PRICE,
  REROLL_BASE,
  SHOP_CONSUMABLE_COUNT,
  SHOP_CONSUMABLE_WEIGHTS,
  SHOP_RARITY_WEIGHTS,
  SHOP_TALISMAN_COUNT,
  TALISMAN_PRICE,
  type Rarity,
  type StageKind,
} from '../content/balance';
import { PACK_SHAPES, type ShapeId } from '../content/blocks';
import type { Consumable } from '../content/consumables';
import { ENHANCEMENT_IDS, PACK_ENHANCED_CHANCE, type Enhancement } from '../content/enhancements';
import { TALISMAN_IDS, TALISMANS, type TalismanId } from '../content/talismans';
import { isUnlocked, type UnlockRecords } from '../content/unlocks';
import { Rng } from './rng';

/** 장터 → docs/03-roguelike.md, 가격 → docs/07-economy.md */

export interface ShopOffer<T> {
  item: T;
  price: number;
  sold: boolean;
}

/** 블록 팩에서 고를 수 있는 블록 (가끔 강화돼 있다) */
export interface PackChoice {
  shape: ShapeId;
  enh?: Enhancement;
}

export interface ShopState {
  /** shop 스트림 상태 (리롤도 이어서 쓴다) */
  rng: number;
  /** 돈을 내고 한 리롤 수. 할 때마다 값이 오른다 */
  rerolls: number;
  /** 남은 무료 리롤 (✂️ 엿장수 가위) */
  freeRerolls: number;
  /** 난이도 "진인"부터 붙는 가격 */
  priceDelta: number;
  /** 부적 진열 수 (수련 "단골"로 늘어남) */
  talismanCount: number;
  talismans: ShopOffer<TalismanId>[];
  consumables: ShopOffer<Consumable>[];
  pack: {
    bought: boolean;
    /** 산 뒤에 뽑힌 블록 3개 */
    choices: PackChoice[] | null;
    done: boolean;
  };
  removalUsed: boolean;
}

const basePrice = (id: TalismanId) => TALISMAN_PRICE[TALISMANS[id].rarity];
export const talismanPrice = (id: TalismanId, priceDelta = 0) => basePrice(id) + priceDelta;
export const sellPrice = (id: TalismanId) => Math.max(1, Math.floor(basePrice(id) / 2));
export const rerollCost = (shop: ShopState) => (shop.freeRerolls > 0 ? 0 : REROLL_BASE + shop.rerolls);
export const packPrice = (shop: ShopState) => PACK_PRICE + shop.priceDelta;
export const removalPrice = (shop: ShopState) => REMOVAL_PRICE + shop.priceDelta;

/** 해금된 부적. 기록이 null이면 전부 (오늘의 판·코드 도전은 누구나 같은 조건) */
export function talismanPool(records: UnlockRecords | null): TalismanId[] {
  return TALISMAN_IDS.filter((id) => isUnlocked(TALISMANS[id].unlock, records));
}

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
  pool: readonly TalismanId[] = TALISMAN_IDS,
): TalismanId[] {
  const taken = new Set(exclude);
  const allowed = new Set(weights.map(([r]) => r));
  const result: TalismanId[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = pickWeighted(rng, weights);
    let candidates = pool.filter((id) => !taken.has(id) && TALISMANS[id].rarity === rarity);
    if (candidates.length === 0) {
      candidates = pool.filter((id) => !taken.has(id) && allowed.has(TALISMANS[id].rarity));
    }
    if (candidates.length === 0) break;
    const id = candidates[rng.int(candidates.length)];
    taken.add(id);
    result.push(id);
  }
  return result;
}

export function randomScroll(rng: Rng): Consumable {
  return { kind: 'scroll', pattern: PATTERN_IDS[rng.int(PATTERN_IDS.length)] };
}

const randomEnhancement = (rng: Rng) => ENHANCEMENT_IDS[rng.int(ENHANCEMENT_IDS.length)];

export function rollConsumable(rng: Rng): Consumable {
  const kind = pickWeighted(rng, SHOP_CONSUMABLE_WEIGHTS);
  switch (kind) {
    case 'scroll':
      return randomScroll(rng);
    case 'stamp':
      return { kind, enh: randomEnhancement(rng) };
    default:
      return { kind };
  }
}

export function rollPackChoices(rng: Rng): PackChoice[] {
  return rng
    .shuffle(PACK_SHAPES)
    .slice(0, PACK_CHOICES)
    .map((shape) => (rng.next() < PACK_ENHANCED_CHANCE ? { shape, enh: randomEnhancement(rng) } : { shape }));
}

function stock(
  rng: Rng,
  owned: ReadonlySet<TalismanId>,
  talismanCount: number,
  priceDelta: number,
  pool: readonly TalismanId[],
) {
  return {
    talismans: rollTalismans(rng, owned, talismanCount, SHOP_RARITY_WEIGHTS, pool).map((item) => ({
      item,
      price: talismanPrice(item, priceDelta),
      sold: false,
    })),
    consumables: Array.from({ length: SHOP_CONSUMABLE_COUNT }, () => ({
      item: rollConsumable(rng),
      price: CONSUMABLE_PRICE + priceDelta,
      sold: false,
    })),
  };
}

export interface ShopOptions {
  talismanCount?: number;
  freeRerolls?: number;
  priceDelta?: number;
  /** 진열될 수 있는 부적 (해금 반영) */
  pool?: readonly TalismanId[];
}

export function createShop(
  seed: string,
  ante: number,
  kind: StageKind,
  owned: ReadonlySet<TalismanId>,
  options: ShopOptions = {},
): ShopState {
  const { talismanCount = SHOP_TALISMAN_COUNT, freeRerolls = 0, priceDelta = 0, pool = TALISMAN_IDS } = options;
  const rng = Rng.fromSeed(seed, 'shop', ante, kind);
  const items = stock(rng, owned, talismanCount, priceDelta, pool);
  return {
    ...items,
    rng: rng.state,
    rerolls: 0,
    freeRerolls,
    priceDelta,
    talismanCount,
    pack: { bought: false, choices: null, done: false },
    removalUsed: false,
  };
}

/** 부적·소모품 진열을 새로 뽑는다 (블록 팩은 그대로). 무료 리롤부터 쓴다 */
export function restock(
  shop: ShopState,
  owned: ReadonlySet<TalismanId>,
  pool: readonly TalismanId[] = TALISMAN_IDS,
): ShopState {
  const rng = new Rng(shop.rng);
  const items = stock(rng, owned, shop.talismanCount, shop.priceDelta, pool);
  const free = shop.freeRerolls > 0;
  return {
    ...shop,
    ...items,
    rng: rng.state,
    rerolls: shop.rerolls + (free ? 0 : 1),
    freeRerolls: shop.freeRerolls - (free ? 1 : 0),
  };
}

export function openPack(shop: ShopState): ShopState {
  const rng = new Rng(shop.rng);
  const choices = rollPackChoices(rng);
  return { ...shop, rng: rng.state, pack: { bought: true, choices, done: false } };
}
