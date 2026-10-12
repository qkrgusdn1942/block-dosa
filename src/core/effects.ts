import { TALISMANS, type TalismanInstance } from '../content/talismans';
import type { Rng } from './rng';
import type { ClearContext, ScoreModifier } from './scoring';

/** 부적 효과 모으기 → docs/12-tech.md의 훅 */

/** 봉인(🦊 구미호)되지 않은 부적 */
export function activeTalismans(
  talismans: readonly TalismanInstance[],
  sealedUid: number | null,
): TalismanInstance[] {
  return talismans.filter((t) => t.uid !== sealedUid);
}

export interface PassiveTotals {
  discards: number;
  hands: number;
  interestCap: number;
  rotation: boolean;
  /** 금 블록 골드 배율 (여러 개면 곱한다) */
  goldCellMult: number;
  freeRerolls: number;
  stash: boolean;
  extraDraw: number;
  doubleTimes: boolean;
  revive: boolean;
  noInterest: boolean;
}

export function passiveTotals(talismans: readonly TalismanInstance[], sealedUid: number | null): PassiveTotals {
  const totals: PassiveTotals = {
    discards: 0,
    hands: 0,
    interestCap: 0,
    rotation: false,
    goldCellMult: 1,
    freeRerolls: 0,
    stash: false,
    extraDraw: 0,
    doubleTimes: false,
    revive: false,
    noInterest: false,
  };
  for (const t of activeTalismans(talismans, sealedUid)) {
    const passive = TALISMANS[t.id].passive;
    if (!passive) continue;
    totals.discards += passive.discards ?? 0;
    totals.hands += passive.hands ?? 0;
    totals.interestCap += passive.interestCap ?? 0;
    totals.rotation ||= passive.rotation ?? false;
    totals.goldCellMult *= passive.goldCellMult ?? 1;
    totals.freeRerolls += passive.freeRerolls ?? 0;
    totals.stash ||= passive.stash ?? false;
    totals.extraDraw += passive.extraDraw ?? 0;
    totals.doubleTimes ||= passive.doubleTimes ?? false;
    totals.revive ||= passive.revive ?? false;
    totals.noInterest ||= passive.noInterest ?? false;
  }
  return totals;
}

/** 줄을 지울 때 성장형 부적 수치 갱신 (점수 계산 전) */
export function growOnClear(
  talismans: readonly TalismanInstance[],
  sealedUid: number | null,
  ctx: ClearContext,
): TalismanInstance[] {
  return talismans.map((t) => {
    const grow = TALISMANS[t.id].grow;
    return grow && t.uid !== sealedUid ? grow(t, ctx) : t;
  });
}

/** 점수 계산 4단계에 넣을 부적 효과들 (왼쪽부터). 🔮 여의주가 있으면 배수 × 효과를 한 번 더 곱한다 */
export function talismanModifiers(
  talismans: readonly TalismanInstance[],
  sealedUid: number | null,
  rng: Rng,
): ScoreModifier[] {
  const doubled = passiveTotals(talismans, sealedUid).doubleTimes;
  return activeTalismans(talismans, sealedUid).flatMap((t) => {
    const def = TALISMANS[t.id];
    const onScore = def.onScore;
    if (!onScore) return [];
    const modifier: ScoreModifier = (ctx, tally) => {
      const result = onScore(ctx, tally, t, rng);
      if (!result) return null;
      const { times, ...score } = result;
      const step = { kind: 'modifier' as const, label: def.name, source: t.uid, ...score };
      return doubled && times !== undefined
        ? { ...step, mult: step.mult * times, note: `${step.note} ×${times}` }
        : step;
    };
    return [modifier];
  });
}

/** 줄을 지울 때 부적이 주는 골드 (🐸 두꺼비) */
export function clearGold(
  talismans: readonly TalismanInstance[],
  sealedUid: number | null,
  ctx: ClearContext,
): number {
  return activeTalismans(talismans, sealedUid).reduce(
    (sum, t) => sum + (TALISMANS[t.id].onClearGold?.(ctx, t) ?? 0),
    0,
  );
}
