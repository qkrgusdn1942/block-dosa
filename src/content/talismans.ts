import type { Rarity } from './balance';
import type { Rng } from '../core/rng';
import type { ClearContext, Tally } from '../core/scoring';

/** 부적 = 발라트로의 조커 → docs/04-talismans.md (v0.2는 MVP 15종) */

export type TalismanId =
  | 'coins'
  | 'sandals'
  | 'lamp'
  | 'magpie'
  | 'gong'
  | 'tiger'
  | 'blankCharm'
  | 'granary'
  | 'treeRings'
  | 'bamboo'
  | 'pouch'
  | 'piggy'
  | 'pinwheel'
  | 'winnow'
  | 'yut';

export interface TalismanInstance {
  uid: number;
  id: TalismanId;
  /** 성장형 부적이 쌓은 수치. 팔면 함께 사라진다 */
  counter: number;
}

/** 계산 4단계에서 바뀐 칩·배수와 화면에 띄울 짧은 설명 */
export interface TalismanScore extends Tally {
  note: string;
}

export interface TalismanDef {
  id: TalismanId;
  name: string;
  emoji: string;
  rarity: Rarity;
  text: string;
  /** 줄을 지울 때, 점수 계산 전에 성장형 수치를 갱신 */
  onLines?: (self: TalismanInstance, lines: number) => TalismanInstance;
  /** 점수 계산 4단계. 해당 없으면 null */
  onScore?: (ctx: ClearContext, tally: Tally, self: TalismanInstance, rng: Rng) => TalismanScore | null;
  /** 판을 클리어했을 때 */
  onStageClear?: (self: TalismanInstance) => { self?: TalismanInstance; gold?: number };
  /** 성장형 부적의 지금 상태 */
  status?: (self: TalismanInstance) => string;
  /** 장착만 해도 적용되는 효과 */
  passive?: { discards?: number; interestCap?: number; rotation?: boolean };
}

const plusChips = (t: Tally, n: number): TalismanScore => ({ chips: t.chips + n, mult: t.mult, note: `+${n} 칩` });
const plusMult = (t: Tally, n: number): TalismanScore => ({ chips: t.chips, mult: t.mult + n, note: `+${n} 배수` });
const timesMult = (t: Tally, x: number): TalismanScore => ({ chips: t.chips, mult: t.mult * x, note: `×${x}` });

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

const defs: TalismanDef[] = [
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
    id: 'gong',
    name: '징',
    emoji: '🥁',
    rarity: 'uncommon',
    text: '연속 보너스 2배',
    onScore: (ctx, t) => (ctx.streak > 1 ? plusMult(t, ctx.streak - 1) : null),
  },
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
    id: 'treeRings',
    name: '나이테',
    emoji: '🪵',
    rarity: 'uncommon',
    text: '지운 줄 1개마다 1씩 자라고, 클리어마다 자란 만큼 칩 +',
    onLines: (self, lines) => ({ ...self, counter: self.counter + lines }),
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
    id: 'pouch',
    name: '복주머니',
    emoji: '👛',
    rarity: 'common',
    text: '판을 클리어할 때 +$3',
    onStageClear: () => ({ gold: 3 }),
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
    id: 'yut',
    name: '윷가락',
    emoji: '🥢',
    rarity: 'uncommon',
    text: '클리어마다 윷을 던짐: 도 +1, 개 +2, 걸 +3 배수, 윷 ×2, 모 ×3',
    onScore: (_ctx, t, _self, rng) => throwYut(t, rng),
  },
];

export const TALISMANS = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<TalismanId, TalismanDef>;
export const TALISMAN_IDS = defs.map((d) => d.id);
