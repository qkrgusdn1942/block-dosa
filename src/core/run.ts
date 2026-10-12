import {
  ANTE_COUNT,
  ANTE_TARGETS,
  BASE_LEVELS,
  CONSUMABLE_SLOTS,
  DAILY_ANTES,
  GOLD_PER_HAND_LEFT,
  INTEREST_CAP,
  INTEREST_STEP,
  MIN_BAG_SIZE,
  PACK_PRICE,
  PATTERN_IDS,
  RELIC_RARITY_WEIGHTS,
  REMOVAL_PRICE,
  SHOP_TALISMAN_COUNT,
  STAGE_NAMES,
  STAGE_REWARD,
  STAGE_TARGET_MULT,
  START_GOLD,
  TALISMAN_SLOTS,
  type PatternId,
  type PatternLevels,
  type StageKind,
} from '../content/balance';
import { STARTING_BAG, type ShapeId } from '../content/blocks';
import { BOSSES, FINAL_BOSS, REGULAR_BOSSES, type BossId } from '../content/bosses';
import type { Consumable } from '../content/consumables';
import { TALISMANS, type TalismanId, type TalismanInstance } from '../content/talismans';
import { NO_PERKS, type RunPerks } from '../content/upgrades';
import { passiveTotals } from './effects';
import { levelUp, moveTalisman } from './loadout';
import { Rng } from './rng';
import {
  createShop,
  openPack,
  randomScroll,
  rerollCost,
  restock,
  rollTalismans,
  sellPrice,
  type ShopState,
} from './shop';
import {
  createStage,
  handsLeft,
  stageReducer,
  type BagEntry,
  type StageAction,
  type StageState,
} from './stage';

/** 런 진행: 고개 8개 × (판 1 → 판 2 → 요괴 판), 사이사이 장터 → docs/03-roguelike.md */

/** starter = 수련 "첫 인연"으로 부적을 고르는 중 */
export type RunPhase = 'starter' | 'preview' | 'playing' | 'reward' | 'relic' | 'shop' | 'over' | 'ending';

/** 이 런을 시작하기 전까지의 기록 (처음 달성 공덕 계산용) */
export interface RunRecords {
  bestAnte: number;
  endings: number;
}

export const NO_RECORDS: RunRecords = { bestAnte: 0, endings: 0 };

/**
 * normal = 새 런 (수련 적용, 고개 8)
 * daily = 오늘의 판 (고개 3까지 + 끝판)
 * seed = 코드로 도전 (고개 8)
 * 오늘의 판과 코드 도전은 App이 수련 없이 시작한다 → docs/10-social.md
 */
export type RunMode = 'normal' | 'daily' | 'seed';

export interface Course {
  antes: number;
  /** 마지막 요괴 다음에 끝판이 있는지 */
  finale: boolean;
}

export const courseOf = (mode: RunMode): Course =>
  mode === 'daily' ? { antes: DAILY_ANTES, finale: true } : { antes: ANTE_COUNT, finale: false };

/** 판 결과 표시: 핸드를 남기고 클리어 / 마지막 핸드에 클리어 / 실패 */
export type StageMark = 'clear' | 'close' | 'fail';

export interface RewardLine {
  label: string;
  gold: number;
}

export type RelicOffer = { kind: 'talisman'; id: TalismanId } | { kind: 'consumable'; item: Consumable };

export interface RunStats {
  stagesCleared: number;
  bossesBeaten: number;
  totalScore: number;
  bestClear: number;
  /** 최고 한 방을 낸 족보 */
  bestPattern: PatternId | null;
  lines: number;
  perfects: number;
}

export interface RunState {
  seed: string;
  mode: RunMode;
  /** 오늘의 판 첫 도전 (공식 기록) */
  official: boolean;
  /** 지나온 판 결과 (공유용 🟩🟨🟥) */
  history: readonly StageMark[];
  ante: number;
  stageKind: StageKind;
  phase: RunPhase;
  gold: number;
  bag: readonly BagEntry[];
  talismans: readonly TalismanInstance[];
  consumables: readonly Consumable[];
  levels: PatternLevels;
  /** 고개별 요괴 (런 시작 때 정해짐) */
  bosses: readonly BossId[];
  /** 지금 판 (미리보기·진행 중) 또는 방금 끝난 판 */
  stage: StageState;
  reward: readonly RewardLine[] | null;
  relics: readonly RelicOffer[] | null;
  shop: ShopState | null;
  /** 부적 uid, 가방 id에 쓰는 번호 */
  nextId: number;
  stats: RunStats;
  /** 수련 효과 (런 시작 때 정해짐) */
  perks: RunPerks;
  records: RunRecords;
  /** 남은 🙏 기사회생 */
  rescueLeft: number;
}

export type RunAction =
  | { type: 'begin' }
  | { type: 'stage'; action: StageAction }
  | { type: 'collect' }
  | { type: 'pickRelic'; index: number }
  | { type: 'skipRelic' }
  | { type: 'buyTalisman'; slot: number }
  | { type: 'buyConsumable'; slot: number }
  | { type: 'buyPack' }
  | { type: 'pickPack'; index: number }
  | { type: 'skipPack' }
  | { type: 'removeBlock'; shape: ShapeId }
  | { type: 'reroll' }
  | { type: 'sell'; uid: number }
  | { type: 'moveTalisman'; uid: number; dir: -1 | 1 }
  | { type: 'useScroll'; index: number }
  | { type: 'next' };

/** 고개 1~7은 일반 요괴 중에서 (바로 앞 고개와 다르게), 고개 8은 이무기 */
export function rollBosses(seed: string): BossId[] {
  const rng = Rng.fromSeed(seed, 'bosses');
  const bosses: BossId[] = [];
  for (let ante = 1; ante < ANTE_COUNT; ante++) {
    const allowed = REGULAR_BOSSES.filter((b) => b.minAnte <= ante);
    const fresh = allowed.filter((b) => !bosses.includes(b.id));
    const pool = fresh.length > 0 ? fresh : allowed.filter((b) => b.id !== bosses[bosses.length - 1]);
    bosses.push(pool[rng.int(pool.length)].id);
  }
  bosses.push(FINAL_BOSS);
  return bosses;
}

export function stageTarget(ante: number, kind: StageKind, boss: BossId | null): number {
  // 끝판은 목표가 없다 (점수 내기)
  if (kind === 'finale') return 0;
  const base = ANTE_TARGETS[Math.min(ante, ANTE_TARGETS.length) - 1];
  const mult = kind === 'boss' && boss ? BOSSES[boss].targetMult : STAGE_TARGET_MULT[kind as 'small' | 'big'];
  return Math.round(base * mult);
}

export const bossOf = (run: Pick<RunState, 'bosses' | 'ante' | 'stageKind'>) =>
  run.stageKind === 'boss' ? run.bosses[run.ante - 1] : null;

function buildStage(run: Omit<RunState, 'stage'>): StageState {
  const boss = bossOf(run);
  return createStage({
    seed: run.seed,
    ante: run.ante,
    kind: run.stageKind,
    boss,
    target: stageTarget(run.ante, run.stageKind, boss),
    bag: run.bag,
    talismans: run.talismans,
    consumables: run.consumables,
    levels: run.levels,
    extraHands: run.perks.hands,
    extraDiscards: run.perks.discards,
    rescue: run.rescueLeft > 0,
    scoreAttack: run.stageKind === 'finale',
  });
}

/** 런을 시작할 판. 보통은 고개 1 · 판 1, 테스트할 때 다른 판·요괴부터 시작할 수 있다 */
export interface RunStart {
  ante: number;
  kind: StageKind;
  boss?: BossId;
}

export interface RunOptions {
  start?: RunStart;
  perks?: RunPerks;
  records?: RunRecords;
  mode?: RunMode;
  official?: boolean;
}

/** 수련 "첫 인연": 일반 부적 3개 */
function rollStarters(seed: string): RelicOffer[] {
  const rng = Rng.fromSeed(seed, 'starter');
  return rollTalismans(rng, new Set(), 3, [['common', 1]]).map((id) => ({ kind: 'talisman', id }));
}

export function createRun(seed: string, options: RunOptions = {}): RunState {
  const {
    start = { ante: 1, kind: 'small' },
    perks = NO_PERKS,
    records = NO_RECORDS,
    mode = 'normal',
    official = false,
  } = options;
  const bag: BagEntry[] = [];
  for (const [shape, count] of STARTING_BAG) {
    for (let i = 0; i < count; i++) bag.push({ id: bag.length, shape });
  }
  const bosses = rollBosses(seed);
  if (start.boss) bosses[start.ante - 1] = start.boss;
  const levels = Object.fromEntries(
    PATTERN_IDS.map((id) => [id, BASE_LEVELS[id] + perks.startLevels]),
  ) as PatternLevels;
  const run: Omit<RunState, 'stage'> = {
    seed,
    mode,
    official,
    history: [],
    ante: start.ante,
    stageKind: start.kind,
    phase: perks.firstCharm ? 'starter' : 'preview',
    gold: START_GOLD + perks.startGold,
    bag,
    talismans: [],
    consumables: [],
    levels,
    bosses,
    reward: null,
    relics: perks.firstCharm ? rollStarters(seed) : null,
    shop: null,
    nextId: bag.length,
    stats: { stagesCleared: 0, bossesBeaten: 0, totalScore: 0, bestClear: 0, bestPattern: null, lines: 0, perfects: 0 },
    perks,
    records,
    rescueLeft: perks.secondWind ? 1 : 0,
  };
  return { ...run, stage: buildStage(run) };
}

/** 판 클리어 보상: 기본 + 남은 핸드 + 보석 칸 + 부적 + 이자. 봉인된 부적은 이번 판 효과 없음 */
export function stageReward(
  gold: number,
  stage: StageState,
  perks: RunPerks = NO_PERKS,
): { lines: RewardLine[]; talismans: TalismanInstance[] } {
  const lines: RewardLine[] = [{ label: `${STAGE_NAMES[stage.kind]} 클리어`, gold: STAGE_REWARD[stage.kind] }];
  const left = handsLeft(stage);
  if (left > 0) lines.push({ label: `남은 핸드 ${left}개`, gold: left * GOLD_PER_HAND_LEFT });
  if (stage.goldEarned > 0) lines.push({ label: '💎 보석 칸', gold: stage.goldEarned });

  const talismans = stage.talismans.map((t) => {
    if (t.uid === stage.sealedUid) return t;
    const def = TALISMANS[t.id];
    const effect = def.onStageClear?.(t);
    if (effect?.gold) lines.push({ label: `${def.emoji} ${def.name}`, gold: effect.gold });
    return effect?.self ?? t;
  });

  // 이자는 보상을 받기 직전의 보유 골드(판 중에 얻은 보석 포함) 기준
  const cap = INTEREST_CAP + passiveTotals(talismans, stage.sealedUid).interestCap + perks.interestCap;
  const interest = Math.min(cap, Math.floor((gold + stage.goldEarned) / INTEREST_STEP));
  if (interest > 0) lines.push({ label: `이자 ($${INTEREST_STEP}당 $1, 최대 $${cap})`, gold: interest });
  return { lines, talismans };
}

function stageMark(stage: StageState): StageMark {
  if (stage.status !== 'cleared') return 'fail';
  return handsLeft(stage) > 0 ? 'clear' : 'close';
}

/** 판이 끝나면 판에서 쓴 부적·소모품·레벨을 런으로 돌려받고 보상 또는 종료로. 끝판이 끝나면 런 완주 */
function finishStage(run: RunState): RunState {
  const { stage } = run;
  const finale = stage.kind === 'finale';
  const cleared = stage.status === 'cleared';
  const reward = cleared && !finale ? stageReward(run.gold, stage, run.perks) : null;
  return {
    ...run,
    talismans: reward ? reward.talismans : stage.talismans,
    consumables: stage.consumables,
    levels: stage.levels,
    rescueLeft: run.rescueLeft - (stage.rescued ? 1 : 0),
    reward: reward?.lines ?? null,
    phase: finale ? 'ending' : cleared ? 'reward' : 'over',
    history: finale ? run.history : [...run.history, stageMark(stage)],
    stats: {
      stagesCleared: run.stats.stagesCleared + (cleared && !finale ? 1 : 0),
      bossesBeaten: run.stats.bossesBeaten + (cleared && stage.kind === 'boss' ? 1 : 0),
      totalScore: run.stats.totalScore + stage.score,
      bestPattern: stage.stats.best > run.stats.bestClear ? stage.stats.bestPattern : run.stats.bestPattern,
      bestClear: Math.max(run.stats.bestClear, stage.stats.best),
      lines: run.stats.lines + stage.stats.lines,
      perfects: run.stats.perfects + stage.stats.perfects,
    },
  };
}

const ownedIds = (run: RunState) => new Set(run.talismans.map((t) => t.id));

function openShop(run: RunState): RunState {
  const count = SHOP_TALISMAN_COUNT + run.perks.shopTalismans;
  return { ...run, phase: 'shop', shop: createShop(run.seed, run.ante, run.stageKind, ownedIds(run), count) };
}

export function rollRelics(run: RunState): RelicOffer[] {
  const rng = Rng.fromSeed(run.seed, 'relic', run.ante);
  const talismans = rollTalismans(rng, ownedIds(run), 2, RELIC_RARITY_WEIGHTS).map(
    (id): RelicOffer => ({ kind: 'talisman', id }),
  );
  return [...talismans, { kind: 'consumable', item: randomScroll(rng) }];
}

export const talismanSlots = (run: RunState) => TALISMAN_SLOTS + run.perks.talismanSlots;
export const consumableSlots = (run: RunState) => CONSUMABLE_SLOTS + run.perks.consumableSlots;
export const talismanSlotsFull = (run: RunState) => run.talismans.length >= talismanSlots(run);
export const consumableSlotsFull = (run: RunState) => run.consumables.length >= consumableSlots(run);

function addTalisman(run: RunState, id: TalismanId): RunState {
  return { ...run, talismans: [...run.talismans, { uid: run.nextId, id, counter: 0 }], nextId: run.nextId + 1 };
}

function withShop(run: RunState, update: (shop: ShopState, run: RunState) => RunState | null): RunState {
  if (run.phase !== 'shop' || !run.shop) return run;
  return update(run.shop, run) ?? run;
}

const NEXT_KIND: Record<StageKind, StageKind> = { small: 'big', big: 'boss', boss: 'small', finale: 'small' };

/** 장터 다음에 올 판. 오늘의 판은 마지막 요괴 다음이 끝판 */
export function upcomingStage(run: RunState): { ante: number; kind: StageKind; boss: BossId | null; target: number } {
  const course = courseOf(run.mode);
  if (course.finale && run.stageKind === 'boss' && run.ante >= course.antes) {
    return { ante: run.ante, kind: 'finale', boss: null, target: 0 };
  }
  const ante = run.stageKind === 'boss' ? run.ante + 1 : run.ante;
  const kind = NEXT_KIND[run.stageKind];
  const boss = kind === 'boss' ? run.bosses[ante - 1] : null;
  return { ante, kind, boss, target: stageTarget(ante, kind, boss) };
}

function nextStage(run: RunState): RunState {
  const { ante, kind } = upcomingStage(run);
  const base = { ...run, ante, stageKind: kind, phase: 'preview' as const, shop: null };
  return { ...base, stage: buildStage(base) };
}

/** 판 미리보기·진행 중에는 판이 가진 것을 쓰고, 그 밖에는 런이 가진 것을 쓴다 */
const stageOwnsLoadout = (run: RunState) => run.phase === 'preview' || run.phase === 'playing';

/** 요괴 유품이나 첫 인연을 고르는 중 */
const choosingRelic = (run: RunState) => run.phase === 'relic' || run.phase === 'starter';

/** 첫 인연은 고른 부적으로 판을 다시 만들어 미리보기로, 요괴 유품은 장터로 */
function afterRelic(run: RunState): RunState {
  return run.phase === 'starter' ? { ...run, phase: 'preview', stage: buildStage(run) } : openShop(run);
}

export function runReducer(run: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'begin':
      return run.phase === 'preview' ? { ...run, phase: 'playing' } : run;

    case 'stage': {
      if (run.phase !== 'playing') return run;
      const stage = stageReducer(run.stage, action.action);
      if (stage === run.stage) return run;
      return stage.status === 'playing' ? { ...run, stage } : finishStage({ ...run, stage });
    }

    case 'collect': {
      if (run.phase !== 'reward' || !run.reward) return run;
      const gold = run.gold + run.reward.reduce((sum, line) => sum + line.gold, 0);
      const collected: RunState = { ...run, gold, reward: null };
      if (run.stageKind !== 'boss') return openShop(collected);
      // 마지막 고개의 요괴를 깨면 엔딩 (오늘의 판은 유품·장터를 거쳐 끝판으로)
      const course = courseOf(run.mode);
      if (run.ante >= course.antes && !course.finale) return { ...collected, phase: 'ending' };
      return { ...collected, phase: 'relic', relics: rollRelics(collected) };
    }

    case 'pickRelic': {
      const offer = run.relics?.[action.index];
      if (!choosingRelic(run) || !offer) return run;
      if (offer.kind === 'talisman') {
        if (talismanSlotsFull(run)) return run;
        return afterRelic({ ...addTalisman(run, offer.id), relics: null });
      }
      if (consumableSlotsFull(run)) return run;
      return afterRelic({ ...run, consumables: [...run.consumables, offer.item], relics: null });
    }

    case 'skipRelic':
      return choosingRelic(run) ? afterRelic({ ...run, relics: null }) : run;

    case 'buyTalisman':
      return withShop(run, (shop) => {
        const offer = shop.talismans[action.slot];
        if (!offer || offer.sold || run.gold < offer.price || talismanSlotsFull(run)) return null;
        const talismans = shop.talismans.map((o, i) => (i === action.slot ? { ...o, sold: true } : o));
        return { ...addTalisman(run, offer.item), gold: run.gold - offer.price, shop: { ...shop, talismans } };
      });

    case 'buyConsumable':
      return withShop(run, (shop) => {
        const offer = shop.consumables[action.slot];
        if (!offer || offer.sold || run.gold < offer.price || consumableSlotsFull(run)) return null;
        const consumables = shop.consumables.map((o, i) => (i === action.slot ? { ...o, sold: true } : o));
        return {
          ...run,
          gold: run.gold - offer.price,
          consumables: [...run.consumables, offer.item],
          shop: { ...shop, consumables },
        };
      });

    case 'buyPack':
      return withShop(run, (shop) => {
        if (shop.pack.bought || run.gold < PACK_PRICE) return null;
        return { ...run, gold: run.gold - PACK_PRICE, shop: openPack(shop) };
      });

    case 'pickPack':
      return withShop(run, (shop) => {
        const shape = shop.pack.choices?.[action.index];
        if (!shape || shop.pack.done) return null;
        return {
          ...run,
          bag: [...run.bag, { id: run.nextId, shape }],
          nextId: run.nextId + 1,
          shop: { ...shop, pack: { ...shop.pack, done: true } },
        };
      });

    case 'skipPack':
      return withShop(run, (shop) =>
        shop.pack.choices && !shop.pack.done ? { ...run, shop: { ...shop, pack: { ...shop.pack, done: true } } } : null,
      );

    case 'removeBlock':
      return withShop(run, (shop) => {
        if (shop.removalUsed || run.gold < REMOVAL_PRICE || run.bag.length <= MIN_BAG_SIZE) return null;
        const index = run.bag.map((entry) => entry.shape).lastIndexOf(action.shape);
        if (index < 0) return null;
        return {
          ...run,
          gold: run.gold - REMOVAL_PRICE,
          bag: run.bag.filter((_, i) => i !== index),
          shop: { ...shop, removalUsed: true },
        };
      });

    case 'reroll':
      return withShop(run, (shop) => {
        const cost = rerollCost(shop);
        if (run.gold < cost) return null;
        return { ...run, gold: run.gold - cost, shop: restock(shop, ownedIds(run)) };
      });

    case 'sell': {
      if (run.phase !== 'shop' && run.phase !== 'relic') return run;
      const talisman = run.talismans.find((t) => t.uid === action.uid);
      if (!talisman) return run;
      return {
        ...run,
        gold: run.gold + sellPrice(talisman.id),
        talismans: run.talismans.filter((t) => t.uid !== action.uid),
      };
    }

    case 'moveTalisman':
      if (stageOwnsLoadout(run)) {
        return { ...run, stage: stageReducer(run.stage, { type: 'moveTalisman', uid: action.uid, dir: action.dir }) };
      }
      return { ...run, talismans: moveTalisman(run.talismans, action.uid, action.dir) };

    case 'useScroll': {
      if (stageOwnsLoadout(run)) {
        if (run.stage.consumables[action.index]?.kind !== 'scroll') return run;
        return { ...run, stage: stageReducer(run.stage, { type: 'useConsumable', index: action.index }) };
      }
      const item = run.consumables[action.index];
      if (item?.kind !== 'scroll') return run;
      return {
        ...run,
        levels: levelUp(run.levels, item.pattern),
        consumables: run.consumables.filter((_, i) => i !== action.index),
      };
    }

    case 'next':
      return run.phase === 'shop' ? nextStage(run) : run;
  }
}
