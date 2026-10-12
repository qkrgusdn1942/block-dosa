import { TALISMANS, type TalismanInstance } from '../content/talismans';
import type { Rng } from './rng';
import type { ScoreModifier } from './scoring';

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
  interestCap: number;
  rotation: boolean;
}

export function passiveTotals(talismans: readonly TalismanInstance[], sealedUid: number | null): PassiveTotals {
  const totals: PassiveTotals = { discards: 0, interestCap: 0, rotation: false };
  for (const t of activeTalismans(talismans, sealedUid)) {
    const passive = TALISMANS[t.id].passive;
    if (!passive) continue;
    totals.discards += passive.discards ?? 0;
    totals.interestCap += passive.interestCap ?? 0;
    totals.rotation ||= passive.rotation ?? false;
  }
  return totals;
}

/** 줄을 지울 때 성장형 부적 수치 갱신 (점수 계산 전) */
export function growOnLines(
  talismans: readonly TalismanInstance[],
  sealedUid: number | null,
  lines: number,
): TalismanInstance[] {
  return talismans.map((t) => {
    const grow = TALISMANS[t.id].onLines;
    return grow && t.uid !== sealedUid ? grow(t, lines) : t;
  });
}

/** 점수 계산 4단계에 넣을 부적 효과들 (왼쪽부터) */
export function talismanModifiers(
  talismans: readonly TalismanInstance[],
  sealedUid: number | null,
  rng: Rng,
): ScoreModifier[] {
  return activeTalismans(talismans, sealedUid).flatMap((t) => {
    const def = TALISMANS[t.id];
    const onScore = def.onScore;
    if (!onScore) return [];
    const modifier: ScoreModifier = (ctx, tally) => {
      const result = onScore(ctx, tally, t, rng);
      return result && { kind: 'modifier', label: def.name, source: t.uid, ...result };
    };
    return [modifier];
  });
}
