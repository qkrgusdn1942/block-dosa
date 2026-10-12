import type { Rarity } from './balance';
import type { Unlock } from './unlocks';
import type { Rng } from '../core/rng';
import { classifyPattern, type ClearContext, type Tally } from '../core/scoring';

/** 부적 = 발라트로의 조커 → docs/04-talismans.md */

export type TalismanId =
  // 칩
  | 'coins'
  | 'sandals'
  | 'crock'
  | 'stoneWall'
  // 배수 +
  | 'lamp'
  | 'magpie'
  | 'pole'
  | 'eaves'
  | 'gong'
  | 'haetae'
  // 배수 ×
  | 'tiger'
  | 'blankCharm'
  | 'granary'
  | 'rings'
  | 'fourGods'
  | 'totem'
  // 성장형
  | 'treeRings'
  | 'bamboo'
  | 'snowman'
  // 경제
  | 'pouch'
  | 'toad'
  | 'scissors'
  | 'piggy'
  | 'goldAxe'
  // 규칙
  | 'pinwheel'
  | 'winnow'
  | 'bundle'
  | 'extra'
  | 'riceCake'
  // 도박
  | 'yut'
  | 'club'
  // 전설
  | 'pearl'
  | 'crow'
  | 'feather'
  // 저주 (팔 수 없음)
  | 'demonTile'
  | 'hahoe'
  | 'goldJar';

export interface TalismanInstance {
  uid: number;
  id: TalismanId;
  /** 성장형 부적이 쌓은 수치. 팔면 함께 사라진다 */
  counter: number;
}

/** 계산 4단계에서 바뀐 칩·배수와 화면에 띄울 짧은 설명 */
export interface TalismanScore extends Tally {
  note: string;
  /** 배수 × 효과였다면 그 배율 (🔮 여의주가 한 번 더 곱한다) */
  times?: number;
}

/** 장착만 해도 적용되는 효과 */
export interface TalismanPassive {
  discards?: number;
  hands?: number;
  interestCap?: number;
  rotation?: boolean;
  /** 금 블록 칸 골드 배율 */
  goldCellMult?: number;
  /** 장터마다 무료 리롤 */
  freeRerolls?: number;
  /** 보관함 1칸 */
  stash?: boolean;
  /** 핸드마다 더 뽑는 블록 */
  extraDraw?: number;
  /** 배수 × 부적을 한 번 더 */
  doubleTimes?: boolean;
  /** 판에 실패해도 한 번 되살아남 */
  revive?: boolean;
  /** 이자를 못 받음 */
  noInterest?: boolean;
}

export interface TalismanDef {
  id: TalismanId;
  name: string;
  emoji: string;
  rarity: Rarity;
  text: string;
  /** 줄을 지울 때, 점수 계산 전에 성장형 수치를 갱신 */
  grow?: (self: TalismanInstance, ctx: ClearContext) => TalismanInstance;
  /** 점수 계산 4단계. 해당 없으면 null */
  onScore?: (ctx: ClearContext, tally: Tally, self: TalismanInstance, rng: Rng) => TalismanScore | null;
  /** 줄을 지울 때 얻는 골드 */
  onClearGold?: (ctx: ClearContext, self: TalismanInstance) => number;
  /** 판을 클리어했을 때 */
  onStageClear?: (self: TalismanInstance) => { self?: TalismanInstance; gold?: number };
  /** 성장형 부적의 지금 상태 */
  status?: (self: TalismanInstance) => string;
  passive?: TalismanPassive;
  /** 처음엔 장터·유품에 안 나오고, 기록을 달성하면 나온다 */
  unlock?: Unlock;
}

const plusChips = (t: Tally, n: number): TalismanScore => ({ chips: t.chips + n, mult: t.mult, note: `+${n} 칩` });
const plusMult = (t: Tally, n: number): TalismanScore => ({ chips: t.chips, mult: t.mult + n, note: `+${n} 배수` });
const timesMult = (t: Tally, x: number): TalismanScore => ({ chips: t.chips, mult: t.mult * x, note: `×${x}`, times: x });

/** 윷가락 4개를 던져 뒤집힌 개수로 도·개·걸·윷·모 (각 1/2 확률, 빽도 없음) */
const YUT_RESULTS: ReadonlyArray<{ name: string; apply: (t: Tally) => TalismanScore }> = [
  { name: '모', apply: (t) => timesMult(t, 3) },
  { name: '도', apply: (t) => plusMult(t, 1) },
  { name: '개', apply: (t) => plusMult(t, 2) },
  { name: '걸', apply: (t) => plusMult(t, 3) },
  { name: '윷', apply: (t) => timesMult(t, 2) },
];

function throwYut(t: Tally, rng: Rng): TalismanScore {
  let flipped = 0;
  for (let i = 0; i < 4; i++) if (rng.next() < 0.5) flipped++;
  const result = YUT_RESULTS[flipped];
  const score = result.apply(t);
  return { ...score, note: `${result.name}! ${score.note}` };
}

/** 1/10 꽝(점수 0), 그다음 1/4 확률로 ×4 */
function swingClub(t: Tally, rng: Rng): TalismanScore | null {
  const roll = rng.next();
  if (roll < 0.1) return { chips: t.chips, mult: 0, note: '꽝!' };
  if (roll < 0.35) return { ...timesMult(t, 4), note: '뚝딱! ×4' };
  return null;
}

/** 저주받은 부적은 고개 3을 본 뒤부터 장터에 나온다 */
const CURSED_UNLOCK: Unlock = { text: '고개 3 도달', check: (r) => r.bestAnte >= 3 };

const defs: TalismanDef[] = [
  // ── 칩
  {
    id: 'coins',
    name: '엽전 꾸러미',
    emoji: '🪙',
    rarity: 'common',
    text: '클리어마다 칩 +20',
    onScore: (_ctx, t) => plusChips(t, 20),
  },
  {
    id: 'sandals',
    name: '짚신',
    emoji: '🩴',
    rarity: 'common',
    text: '막대 블록으로 줄을 지우면 칩 +40',
    onScore: (ctx, t) => (ctx.pieceKind === 'bar' ? plusChips(t, 40) : null),
  },
  {
    id: 'crock',
    name: '장독',
    emoji: '🏺',
    rarity: 'common',
    text: 'ㅁ·큰ㅁ·직사각 블록으로 줄을 지우면 칩 +50',
    onScore: (ctx, t) => (ctx.pieceKind === 'square' ? plusChips(t, 50) : null),
  },
  {
    id: 'stoneWall',
    name: '돌담',
    emoji: '🧱',
    rarity: 'common',
    text: '판 가장자리에 닿은 블록으로 줄을 지우면 칩 +30',
    onScore: (ctx, t) => (ctx.pieceTouchesEdge ? plusChips(t, 30) : null),
  },
  // ── 배수 +
  {
    id: 'lamp',
    name: '호롱불',
    emoji: '🏮',
    rarity: 'common',
    text: '배수 +4',
    onScore: (_ctx, t) => plusMult(t, 4),
  },
  {
    id: 'magpie',
    name: '까치',
    emoji: '🐦',
    rarity: 'common',
    text: '두 줄 이상 동시에 지우면 배수 +8',
    onScore: (ctx, t) => (ctx.rows + ctx.cols >= 2 ? plusMult(t, 8) : null),
  },
  {
    id: 'pole',
    name: '솟대',
    emoji: '🕊️',
    rarity: 'common',
    text: '지운 세로줄 1개당 배수 +3',
    onScore: (ctx, t) => (ctx.cols > 0 ? plusMult(t, ctx.cols * 3) : null),
  },
  {
    id: 'eaves',
    name: '처마',
    emoji: '🏯',
    rarity: 'common',
    text: '지운 가로줄 1개당 배수 +3',
    onScore: (ctx, t) => (ctx.rows > 0 ? plusMult(t, ctx.rows * 3) : null),
  },
  {
    id: 'gong',
    name: '징',
    emoji: '🥁',
    rarity: 'uncommon',
    text: '연속 보너스 2배',
    onScore: (ctx, t) => (ctx.streak > 1 ? plusMult(t, ctx.streak - 1) : null),
  },
  {
    id: 'haetae',
    name: '해태상',
    emoji: '🦁',
    rarity: 'uncommon',
    text: '십자 클리어(가로 1 + 세로 1)면 배수 +15',
    onScore: (ctx, t) => (ctx.rows === 1 && ctx.cols === 1 ? plusMult(t, 15) : null),
  },
  // ── 배수 ×
  {
    id: 'tiger',
    name: '호랑이 부적',
    emoji: '🐯',
    rarity: 'rare',
    text: '세 줄 이상 동시에 지우면 배수 ×3',
    onScore: (ctx, t) => (ctx.rows + ctx.cols >= 3 ? timesMult(t, 3) : null),
  },
  {
    id: 'blankCharm',
    name: '백지 부적',
    emoji: '📃',
    rarity: 'uncommon',
    text: '지운 뒤 판에 남은 칸이 10칸 이하면 배수 ×2',
    onScore: (ctx, t) => (ctx.filledAfter <= 10 ? timesMult(t, 2) : null),
  },
  {
    id: 'granary',
    name: '곳간',
    emoji: '🌾',
    rarity: 'uncommon',
    text: '지우기 직전 판에 채워진 칸이 30칸 이상이면 배수 ×2',
    onScore: (ctx, t) => (ctx.filledBefore >= 30 ? timesMult(t, 2) : null),
  },
  {
    id: 'rings',
    name: '쌍가락지',
    emoji: '💍',
    rarity: 'uncommon',
    text: '직전 클리어와 같은 족보면 배수 ×2',
    onScore: (ctx, t) =>
      ctx.previousPattern && ctx.previousPattern === classifyPattern(ctx.rows, ctx.cols) ? timesMult(t, 2) : null,
  },
  {
    id: 'fourGods',
    name: '사신도',
    emoji: '🧭',
    rarity: 'rare',
    text: '판의 네 모서리가 모두 찬 상태에서 지우면 배수 ×2.5',
    onScore: (ctx, t) => (ctx.cornersFilled ? timesMult(t, 2.5) : null),
  },
  {
    id: 'totem',
    name: '장승',
    emoji: '🗿',
    rarity: 'rare',
    text: '한 핸드의 블록 3개가 모두 줄을 지우면, 세 번째 클리어 배수 ×3',
    onScore: (ctx, t) => (ctx.handPlaced === 3 && ctx.handClears === 3 ? timesMult(t, 3) : null),
  },
  // ── 성장형
  {
    id: 'treeRings',
    name: '나이테',
    emoji: '🪵',
    rarity: 'uncommon',
    text: '지운 줄 1개마다 1씩 자라고, 클리어마다 자란 만큼 칩 +',
    grow: (self, ctx) => ({ ...self, counter: self.counter + ctx.rows + ctx.cols }),
    onScore: (_ctx, t, self) => (self.counter > 0 ? plusChips(t, self.counter) : null),
    status: (self) => `지금 칩 +${self.counter}`,
  },
  {
    id: 'bamboo',
    name: '대나무',
    emoji: '🎋',
    rarity: 'uncommon',
    text: '판을 클리어할 때마다 배수 +2씩 자람',
    onScore: (_ctx, t, self) => (self.counter > 0 ? plusMult(t, self.counter) : null),
    onStageClear: (self) => ({ self: { ...self, counter: self.counter + 2 } }),
    status: (self) => `지금 배수 +${self.counter}`,
  },
  {
    id: 'snowman',
    name: '눈사람',
    emoji: '⛄',
    rarity: 'rare',
    text: '대청소할 때마다 배수 ×0.5씩 자람 (×1에서 시작)',
    grow: (self, ctx) => (ctx.perfect ? { ...self, counter: self.counter + 1 } : self),
    onScore: (_ctx, t, self) => (self.counter > 0 ? timesMult(t, 1 + self.counter * 0.5) : null),
    status: (self) => `지금 ×${1 + self.counter * 0.5}`,
    unlock: { text: '대청소 누적 10번', check: (r) => r.totalPerfects >= 10 },
  },
  // ── 경제
  {
    id: 'pouch',
    name: '복주머니',
    emoji: '👛',
    rarity: 'common',
    text: '판을 클리어할 때 +$3',
    onStageClear: () => ({ gold: 3 }),
  },
  {
    id: 'toad',
    name: '두꺼비',
    emoji: '🐸',
    rarity: 'common',
    text: '대청소할 때마다 +$5',
    onClearGold: (ctx) => (ctx.perfect ? 5 : 0),
    unlock: { text: '대청소 누적 3번', check: (r) => r.totalPerfects >= 3 },
  },
  {
    id: 'scissors',
    name: '엿장수 가위',
    emoji: '✂️',
    rarity: 'common',
    text: '장터마다 리롤 1번 무료',
    passive: { freeRerolls: 1 },
  },
  {
    id: 'piggy',
    name: '돼지 저금통',
    emoji: '🐷',
    rarity: 'uncommon',
    text: '이자 상한 +$5',
    passive: { interestCap: 5 },
  },
  {
    id: 'goldAxe',
    name: '금도끼',
    emoji: '🪓',
    rarity: 'uncommon',
    text: '금 블록 칸에서 나오는 골드 2배',
    passive: { goldCellMult: 2 },
  },
  // ── 규칙
  {
    id: 'pinwheel',
    name: '바람개비',
    emoji: '🌀',
    rarity: 'rare',
    text: '손에 든 블록을 탭하면 90° 회전',
    passive: { rotation: true },
  },
  {
    id: 'winnow',
    name: '키',
    emoji: '🧺',
    rarity: 'common',
    text: '판마다 버리기 +1',
    passive: { discards: 1 },
  },
  {
    id: 'bundle',
    name: '보따리',
    emoji: '🎒',
    rarity: 'uncommon',
    text: '보관함 1칸: 블록 1개를 넣어 두었다가 아무 때나 꺼내 놓을 수 있음',
    passive: { stash: true },
  },
  {
    id: 'extra',
    name: '덤',
    emoji: '🎁',
    rarity: 'uncommon',
    text: '핸드마다 블록 4개를 받고, 그중 3개를 놓으면 다음 핸드',
    passive: { extraDraw: 1 },
  },
  {
    id: 'riceCake',
    name: '시루떡',
    emoji: '🍡',
    rarity: 'uncommon',
    text: '판마다 핸드 +1',
    passive: { hands: 1 },
  },
  // ── 도박
  {
    id: 'yut',
    name: '윷가락',
    emoji: '🥢',
    rarity: 'uncommon',
    text: '클리어마다 윷을 던짐: 도 +1, 개 +2, 걸 +3 배수, 윷 ×2, 모 ×3',
    onScore: (_ctx, t, _self, rng) => throwYut(t, rng),
  },
  {
    id: 'club',
    name: '도깨비 방망이',
    emoji: '🪄',
    rarity: 'rare',
    text: '클리어마다 1/4 확률로 배수 ×4, 대신 1/10 확률로 그 클리어 점수 0',
    onScore: (_ctx, t, _self, rng) => swingClub(t, rng),
    unlock: { text: '고개 5 도달', check: (r) => r.bestAnte >= 5 },
  },
  // ── 전설 (요괴 유품에서만)
  {
    id: 'pearl',
    name: '여의주',
    emoji: '🔮',
    rarity: 'legendary',
    text: '모든 배수 × 부적이 한 번 더 곱해짐',
    passive: { doubleTimes: true },
  },
  {
    id: 'crow',
    name: '삼족오',
    emoji: '🌞',
    rarity: 'legendary',
    text: '연속 3 이상인 클리어는 배수 ×3',
    onScore: (ctx, t) => (ctx.streak >= 3 ? timesMult(t, 3) : null),
  },
  {
    id: 'feather',
    name: '봉황 깃털',
    emoji: '🪶',
    rarity: 'legendary',
    text: '판에 실패해도 한 번 되살아나 그 판을 넘김 (그 뒤 깃털은 타서 사라짐)',
    passive: { revive: true },
  },
  // ── 저주 (강하지만 대가가 있고, 팔 수 없다)
  {
    id: 'demonTile',
    name: '귀면와',
    emoji: '👺',
    rarity: 'cursed',
    text: '배수 ×4. 대신 판마다 핸드 −1',
    onScore: (_ctx, t) => timesMult(t, 4),
    passive: { hands: -1 },
    unlock: CURSED_UNLOCK,
  },
  {
    id: 'hahoe',
    name: '하회탈',
    emoji: '🎭',
    rarity: 'cursed',
    text: '클리어마다 칩 +80. 대신 판마다 버리기 −2',
    onScore: (_ctx, t) => plusChips(t, 80),
    passive: { discards: -2 },
    unlock: CURSED_UNLOCK,
  },
  {
    id: 'goldJar',
    name: '금단지',
    emoji: '⚱️',
    rarity: 'cursed',
    text: '판을 클리어할 때 +$8. 대신 이자를 못 받음',
    onStageClear: () => ({ gold: 8 }),
    passive: { noInterest: true },
    unlock: CURSED_UNLOCK,
  },
];

export const TALISMANS = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<TalismanId, TalismanDef>;
export const TALISMAN_IDS = defs.map((d) => d.id);

/** 저주받은 부적은 팔 수 없다 */
export const canSell = (id: TalismanId) => TALISMANS[id].rarity !== 'cursed';
