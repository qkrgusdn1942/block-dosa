import {
  ANTE_COUNT,
  ANTE_TARGETS,
  BASE_LEVELS,
  CONSUMABLE_SLOTS,
  DAILY_ANTES,
  ENDLESS_GROWTH,
  GOLD_PER_HAND_LEFT,
  INTEREST_STEP,
  MIN_BAG_SIZE,
  OBSTACLE_FROM_ANTE,
  PATTERN_IDS,
  RELIC_LEGENDARY_CHANCE,
  RELIC_LEGENDARY_FROM_ANTE,
  RELIC_RARITY_WEIGHTS,
  SHOP_TALISMAN_COUNT,
  SKIP_FREE_REROLLS,
  SKIP_GOLD,
  SKIP_STUDY_LEVELS,
  STAGE_NAMES,
  STAMP_BLOCKS,
  STAGE_REWARD,
  STAGE_TARGET_MULT,
  START_GOLD,
  TALISMAN_SLOTS,
  type PatternId,
  type PatternLevels,
  type StageKind,
} from '../content/balance';
import { BAG_BY_ID, type BagType } from '../content/bags';
import type { ShapeId } from '../content/blocks';
import { BOSSES, FINAL_BOSS, REGULAR_BOSSES, type BossId } from '../content/bosses';
import type { Consumable } from '../content/consumables';
import { ENHANCEMENT_IDS, type Enhancement } from '../content/enhancements';
import { OBSTACLE_IDS, type ObstacleId } from '../content/obstacles';
import { SKIP_REWARD_IDS, type SkipRewardId } from '../content/skips';
import { stakeRules } from '../content/stakes';
import { canSell, TALISMANS, type TalismanId, type TalismanInstance } from '../content/talismans';
import { NO_UNLOCK_RECORDS, type UnlockRecords } from '../content/unlocks';
import { NO_PERKS, type RunPerks } from '../content/upgrades';
import { WEEKLY_RULE_BY_ID, type WeeklyRule, type WeeklyRuleId } from '../content/weekly';
import { weeklyDateOf, weeklyRuleOf } from './daily';
import { passiveTotals } from './effects';
import { levelUp, moveTalisman } from './loadout';
import { Rng } from './rng';
import { MAX_SCORE } from './scoring';
import {
  createShop,
  openPack,
  packPrice,
  randomScroll,
  removalPrice,
  rerollCost,
  restock,
  rollTalismans,
  sellPrice,
  talismanPool,
  type ShopState,
} from './shop';
import {
  createStage,
  handsLeft,
  stageBoss,
  stageReducer,
  type BagEntry,
  type StageAction,
  type StageState,
} from './stage';

/** 런 진행: 고개 8개 × (판 1 → 판 2 → 요괴 판), 사이사이 장터 → docs/03-roguelike.md */

/**
 * starter = 수련 "첫 인연"으로 부적을 고르는 중
 * victory = 고개 8 요괴를 깨고, 끝낼지 끝없는 모드로 계속할지 고르는 중
 */
export type RunPhase =
  | 'starter'
  | 'preview'
  | 'playing'
  | 'reward'
  | 'relic'
  | 'shop'
  | 'victory'
  | 'over'
  | 'ending';

/**
 * normal = 새 런 (수련 적용, 고개 8)
 * daily = 오늘의 판 (고개 3까지 + 끝판)
 * weekly = 주간 도전 (오늘의 판과 같은 코스 + 그 주의 특수 규칙)
 * seed = 코드로 도전 (고개 8)
 * 오늘의 판·주간 도전·코드 도전은 App이 수련 없이 시작한다 → docs/10-social.md
 */
export type RunMode = 'normal' | 'daily' | 'weekly' | 'seed';

export interface Course {
  antes: number;
  /** 마지막 요괴 다음에 끝판이 있는지 */
  finale: boolean;
}

export const courseOf = (mode: RunMode): Course =>
  mode === 'daily' || mode === 'weekly' ? { antes: DAILY_ANTES, finale: true } : { antes: ANTE_COUNT, finale: false };

/** 판 결과 표시: 핸드를 남기고 클리어 / 마지막 핸드에 클리어 / 실패 / 건너뜀 */
export type StageMark = 'clear' | 'close' | 'fail' | 'skip';

/** 이번 런에서 만난 것 (런이 끝나면 도감에 더한다) → docs/06-incremental.md */
export interface Seen {
  talismans: TalismanId[];
  bosses: BossId[];
  obstacles: ObstacleId[];
  shapes: ShapeId[];
  enhancements: Enhancement[];
}

export const NOTHING_SEEN: Seen = { talismans: [], bosses: [], obstacles: [], shapes: [], enhancements: [] };

/** 판 건너뛰기로 받아서 다음 장터에서 쓰는 것 */
export interface Vouchers {
  freePack: boolean;
  discount: boolean;
  freeRerolls: number;
}

export const NO_VOUCHERS: Vouchers = { freePack: false, discount: false, freeRerolls: 0 };

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
  /** 런 시작 때 고른 가방과 난이도 단계 */
  bagType: BagType;
  stake: number;
  /** 고개 8을 넘어 끝없는 모드로 계속하는 중 */
  endless: boolean;
  /** 주간 도전의 특수 규칙 */
  rule: WeeklyRuleId | null;
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
  /** 고개 1~8의 요괴 (런 시작 때 정해짐). 고개 9부터는 bossAt이 그때그때 정한다 */
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
  /** 이 런을 시작하기 전까지의 기록 (처음 달성 공덕, 해금) */
  records: UnlockRecords;
  /** 남은 🙏 기사회생 */
  rescueLeft: number;
  vouchers: Vouchers;
  seen: Seen;
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
  | { type: 'removeBlock'; bagId: number }
  /** 🔖 도장: 가방 블록을 STAMP_BLOCKS개까지 강화 */
  | { type: 'stamp'; index: number; bagIds: number[] }
  | { type: 'ink'; index: number; bagId: number }
  | { type: 'reroll' }
  | { type: 'sell'; uid: number }
  | { type: 'moveTalisman'; uid: number; dir: -1 | 1 }
  | { type: 'useScroll'; index: number }
  | { type: 'next' }
  | { type: 'finish' }
  | { type: 'endless' }
  | { type: 'skip' };

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

/** 고개의 요괴. 끝없는 모드(고개 9부터)는 고개마다 새로 뽑고, 8의 배수 고개는 이무기 */
export function bossAt(run: Pick<RunState, 'seed' | 'bosses'>, ante: number): BossId {
  const fixed = run.bosses[ante - 1];
  if (fixed) return fixed;
  if (ante % ANTE_COUNT === 0) return FINAL_BOSS;
  const rng = Rng.fromSeed(run.seed, 'endless-boss', ante);
  return REGULAR_BOSSES[rng.int(REGULAR_BOSSES.length)].id;
}

/** 고개의 기본 목표 (판 1 기준). 고개 9부터는 직전 고개보다 ×3 → ×5 → ×10씩 커진다 */
export function anteBase(ante: number): number {
  if (ante <= ANTE_TARGETS.length) return ANTE_TARGETS[ante - 1];
  let base = ANTE_TARGETS[ANTE_TARGETS.length - 1];
  for (let next = ANTE_TARGETS.length + 1; next <= ante; next++) {
    const [, growth] = ENDLESS_GROWTH.find(([upTo]) => next <= upTo)!;
    base *= growth;
  }
  return Math.min(base, MAX_SCORE);
}

export function stageTarget(ante: number, kind: StageKind, boss: BossId | null, stake = 1): number {
  // 끝판은 목표가 없다 (점수 내기)
  if (kind === 'finale') return 0;
  const base = anteBase(ante);
  if (kind === 'boss' && boss) return Math.round(base * BOSSES[boss].targetMult * stakeRules(stake).bossTargetScale);
  return Math.round(base * STAGE_TARGET_MULT[kind as 'small' | 'big']);
}

export const bossOf = (run: Pick<RunState, 'seed' | 'bosses' | 'ante' | 'stageKind'>) =>
  run.stageKind === 'boss' ? bossAt(run, run.ante) : null;

const ruleOf = (run: Pick<RunState, 'rule'>): WeeklyRule | null => (run.rule ? WEEKLY_RULE_BY_ID[run.rule] : null);

/** 판 1·판 2의 방해 칸: 고개 4부터 판 2, 고개 6부터 판 1도 (주간 도전 "방해 칸 잔치"는 고개 1부터) */
export function obstacleFor(run: Pick<RunState, 'seed' | 'rule'>, ante: number, kind: StageKind): ObstacleId | null {
  if (kind !== 'small' && kind !== 'big') return null;
  const from = ruleOf(run)?.obstaclesFromAnte ?? OBSTACLE_FROM_ANTE[kind];
  if (ante < from) return null;
  const rng = Rng.fromSeed(run.seed, 'obstacle', ante, kind);
  return OBSTACLE_IDS[rng.int(OBSTACLE_IDS.length)];
}

function buildStage(run: Omit<RunState, 'stage'>): StageState {
  const boss = bossOf(run);
  const stake = stakeRules(run.stake);
  const rule = ruleOf(run);
  return createStage({
    seed: run.seed,
    ante: run.ante,
    kind: run.stageKind,
    boss,
    target: stageTarget(run.ante, run.stageKind, boss, run.stake),
    bag: run.bag,
    talismans: run.talismans,
    consumables: run.consumables,
    levels: run.levels,
    extraHands: run.perks.hands + stake.handDelta + (rule?.extraHands ?? 0),
    extraDiscards: run.perks.discards + stake.discardDelta + (rule?.extraDiscards ?? 0),
    extraRocks: stake.extraRocks + (rule?.extraRocks ?? 0),
    obstacle: obstacleFor(run, run.ante, run.stageKind),
    consumableSlots: consumableSlots(run),
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
  records?: UnlockRecords;
  mode?: RunMode;
  official?: boolean;
  bagType?: BagType;
  stake?: number;
}

/** 장터·유품에 나올 수 있는 부적. 새 런만 해금을 따르고, 오늘의 판·코드 도전은 전부 */
const poolFor = (mode: RunMode, records: UnlockRecords) => talismanPool(mode === 'normal' ? records : null);
const talismanPoolOf = (run: RunState) => poolFor(run.mode, run.records);

/** 가방 구성대로 채운다. 혼돈 가방은 블록마다 무작위 강화 */
function buildBag(seed: string, contents: ReadonlyArray<readonly [ShapeId, number]>, enhanceAll = false): BagEntry[] {
  const rng = Rng.fromSeed(seed, 'bag-enhance');
  const bag: BagEntry[] = [];
  for (const [shape, count] of contents) {
    for (let i = 0; i < count; i++) {
      const entry: BagEntry = { id: bag.length, shape };
      if (enhanceAll) entry.enh = ENHANCEMENT_IDS[rng.int(ENHANCEMENT_IDS.length)];
      bag.push(entry);
    }
  }
  return bag;
}

/** 없는 것만 뒤에 붙인다 (도감용) */
function addUnique<T>(list: readonly T[], items: readonly T[]): T[] {
  const result = [...list];
  for (const item of items) if (!result.includes(item)) result.push(item);
  return result;
}

/** 판을 시작할 때 만난 요괴·방해 칸, 그때 가방에 있던 블록·강화 */
function seeStage(seen: Seen, stage: StageState): Seen {
  return {
    ...seen,
    bosses: stage.boss ? addUnique(seen.bosses, [stage.boss]) : seen.bosses,
    obstacles: stage.obstacle ? addUnique(seen.obstacles, [stage.obstacle]) : seen.obstacles,
    shapes: addUnique(seen.shapes, stage.bag.map((entry) => entry.shape)),
    enhancements: addUnique(
      seen.enhancements,
      stage.bag.flatMap((entry) => (entry.enh ? [entry.enh] : [])),
    ),
  };
}

/** 수련 "첫 인연": 일반 부적 3개 */
function rollStarters(seed: string, owned: ReadonlySet<TalismanId>, pool: readonly TalismanId[]): RelicOffer[] {
  const rng = Rng.fromSeed(seed, 'starter');
  return rollTalismans(rng, owned, 3, [['common', 1]], pool).map((id) => ({ kind: 'talisman', id }));
}

export function createRun(seed: string, options: RunOptions = {}): RunState {
  const {
    start = { ante: 1, kind: 'small' },
    perks = NO_PERKS,
    records = NO_UNLOCK_RECORDS,
    mode = 'normal',
    official = false,
    bagType = 'basic',
    stake = 1,
  } = options;
  // 주간 도전은 그 주의 규칙이 가방·시작 부적·골드를 바꾼다
  const monday = mode === 'weekly' ? weeklyDateOf(seed) : null;
  const rule = monday ? weeklyRuleOf(monday) : null;
  const bagDef = BAG_BY_ID[rule?.bagType ?? bagType];
  const bag = buildBag(seed, rule?.bagContents ?? bagDef.contents, bagDef.enhanceAll);
  let nextId = bag.length;
  const talismans: TalismanInstance[] = [];
  for (const id of new Set([bagDef.startTalisman, rule?.startTalisman])) {
    if (id) talismans.push({ uid: nextId++, id, counter: 0 });
  }
  const bosses = rollBosses(seed);
  if (start.boss && start.ante <= ANTE_COUNT) bosses[start.ante - 1] = start.boss;
  const levels = Object.fromEntries(
    PATTERN_IDS.map((id) => [id, BASE_LEVELS[id] + perks.startLevels]),
  ) as PatternLevels;
  const owned = new Set(talismans.map((t) => t.id));
  const run: Omit<RunState, 'stage'> = {
    seed,
    mode,
    official,
    bagType: bagDef.id,
    stake,
    endless: start.ante > ANTE_COUNT,
    rule: rule?.id ?? null,
    history: [],
    ante: start.ante,
    stageKind: start.kind,
    phase: perks.firstCharm ? 'starter' : 'preview',
    gold: START_GOLD + perks.startGold + (rule?.startGold ?? 0),
    bag,
    talismans,
    consumables: [],
    levels,
    bosses,
    reward: null,
    relics: perks.firstCharm ? rollStarters(seed, owned, poolFor(mode, records)) : null,
    shop: null,
    nextId,
    stats: { stagesCleared: 0, bossesBeaten: 0, totalScore: 0, bestClear: 0, bestPattern: null, lines: 0, perfects: 0 },
    perks,
    records,
    rescueLeft: perks.secondWind ? 1 : 0,
    vouchers: NO_VOUCHERS,
    seen: { ...NOTHING_SEEN, talismans: talismans.map((t) => t.id) },
  };
  return { ...run, stage: buildStage(run) };
}

/**
 * 판 클리어 보상: 기본 + 남은 핸드 + 판에서 얻은 골드 + 부적 + 이자. 봉인된 부적은 이번 판 효과 없음.
 * 🔥 강철이 판은 골드가 하나도 없다 (성장형 부적은 그대로 자란다)
 */
export function stageReward(
  gold: number,
  stage: StageState,
  perks: RunPerks = NO_PERKS,
  stake = 1,
): { lines: RewardLine[]; talismans: TalismanInstance[] } {
  const talismanLines: RewardLine[] = [];
  const talismans = stage.talismans.map((t) => {
    if (t.uid === stage.sealedUid) return t;
    const def = TALISMANS[t.id];
    const effect = def.onStageClear?.(t);
    if (effect?.gold) talismanLines.push({ label: `${def.emoji} ${def.name}`, gold: effect.gold });
    return effect?.self ?? t;
  });

  const boss = stageBoss(stage);
  if (boss?.drought) return { lines: [{ label: `${boss.emoji} ${boss.name}의 가뭄: 골드 없음`, gold: 0 }], talismans };

  const rules = stakeRules(stake);
  const noSmallReward = stage.kind === 'small' && !rules.smallStageReward;
  const lines: RewardLine[] = [
    noSmallReward
      ? { label: `${STAGE_NAMES.small} 클리어 (난이도: 보상 없음)`, gold: 0 }
      : { label: `${STAGE_NAMES[stage.kind]} 클리어`, gold: STAGE_REWARD[stage.kind] },
  ];
  const left = handsLeft(stage);
  if (left > 0) lines.push({ label: `남은 핸드 ${left}개`, gold: left * GOLD_PER_HAND_LEFT });
  if (stage.goldEarned > 0) lines.push({ label: '💰 판에서 얻은 골드', gold: stage.goldEarned });
  lines.push(...talismanLines);

  // 이자는 보상을 받기 직전의 보유 골드(판 중에 얻은 골드 포함) 기준. ⚱️ 금단지가 있으면 없다
  const passive = passiveTotals(talismans, stage.sealedUid);
  if (passive.noInterest) {
    const jar = talismans.find((t) => t.uid !== stage.sealedUid && TALISMANS[t.id].passive?.noInterest);
    const def = jar && TALISMANS[jar.id];
    lines.push({ label: def ? `${def.emoji} ${def.name}: 이자 없음` : '이자 없음', gold: 0 });
    return { lines, talismans };
  }
  const cap = rules.interestBase + passive.interestCap + perks.interestCap;
  const interest = Math.min(cap, Math.floor((gold + stage.goldEarned) / INTEREST_STEP));
  if (interest > 0) lines.push({ label: `이자 ($${INTEREST_STEP}당 $1, 최대 $${cap})`, gold: interest });
  return { lines, talismans };
}

function stageMark(stage: StageState): StageMark {
  if (stage.status !== 'cleared') return 'fail';
  return handsLeft(stage) > 0 ? 'clear' : 'close';
}

/** 🪶 봉황 깃털: 판에 실패하면 깃털 하나를 태워 그 판을 넘긴다. 봉인된 깃털은 못 쓴다 */
function revive(stage: StageState): StageState | null {
  if (stage.status !== 'failed') return null;
  const feather = stage.talismans.find((t) => t.uid !== stage.sealedUid && TALISMANS[t.id].passive?.revive);
  if (!feather) return null;
  return {
    ...stage,
    status: 'cleared',
    failReason: null,
    talismans: stage.talismans.filter((t) => t.uid !== feather.uid),
  };
}

/** 판이 끝나면 판에서 쓴 가방·부적·소모품·레벨을 런으로 돌려받고 보상 또는 종료로. 끝판이 끝나면 런 완주 */
function finishStage(run: RunState): RunState {
  const revived = revive(run.stage);
  const stage = revived ?? run.stage;
  const finale = stage.kind === 'finale';
  const cleared = stage.status === 'cleared';
  const reward = cleared && !finale ? stageReward(run.gold, stage, run.perks, run.stake) : null;
  const lines = reward && revived ? [{ label: '🪶 봉황 깃털이 타올라 되살아났어요', gold: 0 }, ...reward.lines] : reward?.lines;
  return {
    ...run,
    stage,
    bag: stage.bag,
    talismans: reward ? reward.talismans : stage.talismans,
    consumables: stage.consumables,
    levels: stage.levels,
    rescueLeft: run.rescueLeft - (stage.rescued ? 1 : 0),
    reward: lines ?? null,
    phase: finale ? 'ending' : cleared ? 'reward' : 'over',
    history: finale ? run.history : [...run.history, revived ? 'close' : stageMark(stage)],
    stats: {
      stagesCleared: run.stats.stagesCleared + (cleared && !finale ? 1 : 0),
      bossesBeaten: run.stats.bossesBeaten + (cleared && stage.kind === 'boss' ? 1 : 0),
      totalScore: Math.min(MAX_SCORE, run.stats.totalScore + stage.score),
      bestPattern: stage.stats.best > run.stats.bestClear ? stage.stats.bestPattern : run.stats.bestPattern,
      bestClear: Math.max(run.stats.bestClear, stage.stats.best),
      lines: run.stats.lines + stage.stats.lines,
      perfects: run.stats.perfects + stage.stats.perfects,
    },
  };
}

const ownedIds = (run: RunState) => new Set(run.talismans.map((t) => t.id));

/** 장터를 연다. 판 건너뛰기로 받은 것(공짜 팩, 반값, 공짜 리롤)은 여기서 쓰고 비운다 */
function openShop(run: RunState): RunState {
  const { vouchers } = run;
  const shop = createShop(run.seed, run.ante, run.stageKind, ownedIds(run), {
    talismanCount: SHOP_TALISMAN_COUNT + run.perks.shopTalismans,
    freeRerolls: passiveTotals(run.talismans, null).freeRerolls + vouchers.freeRerolls,
    priceDelta: stakeRules(run.stake).priceDelta,
    pool: talismanPoolOf(run),
    freePack: vouchers.freePack,
    discount: vouchers.discount,
  });
  return { ...run, phase: 'shop', shop, vouchers: NO_VOUCHERS };
}

/** 요괴 유품: 부적 2개(고개 4부터 가끔 전설 1개 포함) + 비전서 1개 */
export function rollRelics(run: RunState): RelicOffer[] {
  const rng = Rng.fromSeed(run.seed, 'relic', run.ante);
  const pool = talismanPoolOf(run);
  const owned = ownedIds(run);
  const legendary =
    run.ante >= RELIC_LEGENDARY_FROM_ANTE && rng.next() < RELIC_LEGENDARY_CHANCE
      ? rollTalismans(rng, owned, 1, [['legendary', 1]], pool)
      : [];
  const others = rollTalismans(rng, new Set([...owned, ...legendary]), 2 - legendary.length, RELIC_RARITY_WEIGHTS, pool);
  const talismans = [...legendary, ...others].map((id): RelicOffer => ({ kind: 'talisman', id }));
  return [...talismans, { kind: 'consumable', item: randomScroll(rng) }];
}

export const talismanSlots = (run: Pick<RunState, 'perks' | 'bagType' | 'rule'>) =>
  Math.max(
    1,
    TALISMAN_SLOTS +
      run.perks.talismanSlots +
      (BAG_BY_ID[run.bagType].talismanSlotDelta ?? 0) +
      (ruleOf(run)?.talismanSlotDelta ?? 0),
  );
export const consumableSlots = (run: Pick<RunState, 'perks'>) => CONSUMABLE_SLOTS + run.perks.consumableSlots;
export const talismanSlotsFull = (run: RunState) => run.talismans.length >= talismanSlots(run);
export const consumableSlotsFull = (run: RunState) => run.consumables.length >= consumableSlots(run);

function addTalisman(run: RunState, id: TalismanId): RunState {
  return {
    ...run,
    talismans: [...run.talismans, { uid: run.nextId, id, counter: 0 }],
    nextId: run.nextId + 1,
    seen: { ...run.seen, talismans: addUnique(run.seen.talismans, [id]) },
  };
}

/** 판 1·판 2를 건너뛰면 받는 것 (판마다 정해져 있어서 미리보기에 보여준다) */
export function skipRewardOf(run: Pick<RunState, 'seed' | 'ante' | 'stageKind'>): SkipRewardId {
  const rng = Rng.fromSeed(run.seed, 'skip', run.ante, run.stageKind);
  return SKIP_REWARD_IDS[rng.int(SKIP_REWARD_IDS.length)];
}

export const canSkip = (run: Pick<RunState, 'phase' | 'stageKind'>) =>
  run.phase === 'preview' && (run.stageKind === 'small' || run.stageKind === 'big');

function applySkipReward(run: RunState, reward: SkipRewardId): RunState {
  switch (reward) {
    case 'gold':
      return { ...run, gold: run.gold + SKIP_GOLD };
    case 'freePack':
      return { ...run, vouchers: { ...run.vouchers, freePack: true } };
    case 'discount':
      return { ...run, vouchers: { ...run.vouchers, discount: true } };
    case 'rerolls':
      return { ...run, vouchers: { ...run.vouchers, freeRerolls: run.vouchers.freeRerolls + SKIP_FREE_REROLLS } };
    case 'study': {
      const rng = Rng.fromSeed(run.seed, 'skip-study', run.ante, run.stageKind);
      const patterns = rng.shuffle(PATTERN_IDS).slice(0, SKIP_STUDY_LEVELS);
      return { ...run, levels: patterns.reduce(levelUp, run.levels) };
    }
  }
}

function withShop(run: RunState, update: (shop: ShopState, run: RunState) => RunState | null): RunState {
  if (run.phase !== 'shop' || !run.shop) return run;
  return update(run.shop, run) ?? run;
}

const NEXT_KIND: Record<StageKind, StageKind> = { small: 'big', big: 'boss', boss: 'small', finale: 'small' };

/** 장터 다음에 올 판. 오늘의 판은 마지막 요괴 다음이 끝판 */
export interface UpcomingStage {
  ante: number;
  kind: StageKind;
  boss: BossId | null;
  obstacle: ObstacleId | null;
  target: number;
}

export function upcomingStage(run: RunState): UpcomingStage {
  const course = courseOf(run.mode);
  if (course.finale && run.stageKind === 'boss' && run.ante >= course.antes) {
    return { ante: run.ante, kind: 'finale', boss: null, obstacle: null, target: 0 };
  }
  const ante = run.stageKind === 'boss' ? run.ante + 1 : run.ante;
  const kind = NEXT_KIND[run.stageKind];
  const boss = kind === 'boss' ? bossAt(run, ante) : null;
  return { ante, kind, boss, obstacle: obstacleFor(run, ante, kind), target: stageTarget(ante, kind, boss, run.stake) };
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
      return run.phase === 'preview' ? { ...run, phase: 'playing', seen: seeStage(run.seen, run.stage) } : run;

    // 판 1·판 2 건너뛰기: 보상을 받고 다음 판 미리보기로 (이 판 뒤의 장터도 건너뛴다)
    case 'skip': {
      if (!canSkip(run)) return run;
      const back: RunState = {
        ...run,
        // 미리보기 동안 바꾼 부적 순서·비전서는 판이 들고 있으니 런으로 돌려받는다
        talismans: run.stage.talismans,
        consumables: run.stage.consumables,
        levels: run.stage.levels,
        history: [...run.history, 'skip'],
      };
      return nextStage(applySkipReward(back, skipRewardOf(run)));
    }

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
      // 마지막 고개의 요괴를 깨면 끝낼지 계속할지 고른다 (오늘의 판은 유품·장터를 거쳐 끝판으로)
      const course = courseOf(run.mode);
      if (!run.endless && run.ante >= course.antes && !course.finale) return { ...collected, phase: 'victory' };
      return { ...collected, phase: 'relic', relics: rollRelics(collected) };
    }

    case 'finish':
      return run.phase === 'victory' ? { ...run, phase: 'ending' } : run;

    case 'endless':
      return run.phase === 'victory' ? { ...run, endless: true, phase: 'relic', relics: rollRelics(run) } : run;

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
        const price = packPrice(shop);
        if (shop.pack.bought || run.gold < price) return null;
        return { ...run, gold: run.gold - price, shop: openPack(shop) };
      });

    case 'pickPack':
      return withShop(run, (shop) => {
        const choice = shop.pack.choices?.[action.index];
        if (!choice || shop.pack.done) return null;
        const entry: BagEntry = { id: run.nextId, shape: choice.shape };
        if (choice.enh) entry.enh = choice.enh;
        return {
          ...run,
          bag: [...run.bag, entry],
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
        const price = removalPrice(shop);
        if (shop.removalUsed || run.gold < price || run.bag.length <= MIN_BAG_SIZE) return null;
        if (!run.bag.some((entry) => entry.id === action.bagId)) return null;
        return {
          ...run,
          gold: run.gold - price,
          bag: run.bag.filter((entry) => entry.id !== action.bagId),
          shop: { ...shop, removalUsed: true },
        };
      });

    // 🔖 도장: 가방 블록 2개까지 강화 (장터에서만)
    case 'stamp':
      return withShop(run, () => {
        const item = run.consumables[action.index];
        const ids = new Set(action.bagIds);
        const valid = ids.size >= 1 && ids.size <= STAMP_BLOCKS && [...ids].every((id) => run.bag.some((e) => e.id === id));
        if (item?.kind !== 'stamp' || !valid) return null;
        return {
          ...run,
          consumables: run.consumables.filter((_, i) => i !== action.index),
          bag: run.bag.map((entry) => (ids.has(entry.id) ? { ...entry, enh: item.enh } : entry)),
        };
      });

    // 🖌️ 먹: 가방 블록 1개를 강화까지 똑같이 하나 더 (장터에서만)
    case 'ink':
      return withShop(run, () => {
        const item = run.consumables[action.index];
        const target = run.bag.find((entry) => entry.id === action.bagId);
        if (item?.kind !== 'ink' || !target) return null;
        return {
          ...run,
          consumables: run.consumables.filter((_, i) => i !== action.index),
          bag: [...run.bag, { ...target, id: run.nextId }],
          nextId: run.nextId + 1,
        };
      });

    case 'reroll':
      return withShop(run, (shop) => {
        const cost = rerollCost(shop);
        if (run.gold < cost) return null;
        return { ...run, gold: run.gold - cost, shop: restock(shop, ownedIds(run), talismanPoolOf(run)) };
      });

    case 'sell': {
      if (run.phase !== 'shop' && run.phase !== 'relic') return run;
      const talisman = run.talismans.find((t) => t.uid === action.uid);
      // 저주받은 부적은 팔 수 없다
      if (!talisman || !canSell(talisman.id)) return run;
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
