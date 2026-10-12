import { describe, expect, it } from 'vitest';
import { classifyPattern, scoreClear, type ScoreModifier } from '../src/core/scoring';
import { clearCtx as ctx } from './helpers';

describe('족보 판정', () => {
  it.each([
    [1, 0, 'single'],
    [0, 1, 'single'],
    [2, 0, 'double'],
    [0, 2, 'double'],
    [1, 1, 'cross'],
    [2, 1, 'triple'],
    [3, 0, 'triple'],
    [2, 2, 'quad'],
    [5, 0, 'quad'],
  ] as const)('가로 %i + 세로 %i → %s', (rows, cols, pattern) => {
    expect(classifyPattern(rows, cols)).toBe(pattern);
  });

  it('줄이 없으면 null', () => {
    expect(classifyPattern(0, 0)).toBeNull();
  });
});

describe('점수 계산', () => {
  it('한 줄: (10 + 8칸) × 1 = 18', () => {
    expect(scoreClear(ctx()).total).toBe(18);
  });

  it('연속 3이면 배수 +2', () => {
    const result = scoreClear(ctx({ streak: 3 }));
    expect(result.mult).toBe(3);
    expect(result.total).toBe(54);
  });

  it('대청소는 마지막에 ×3', () => {
    expect(scoreClear(ctx({ perfect: true })).total).toBe(54);
  });

  it('별 칸은 마지막에 칸마다 ×2', () => {
    expect(scoreClear(ctx({ stars: 1 })).total).toBe(36);
    expect(scoreClear(ctx({ stars: 2, perfect: true })).total).toBe(18 * 4 * 3);
  });

  it('족보 레벨업', () => {
    const result = scoreClear(ctx({ rows: 2, cellCount: 16, levels: { double: 3 } }));
    expect(result.chips).toBe(25 + 15 * 2 + 16);
    expect(result.mult).toBe(2 + 1 * 2);
  });

  it('docs/02-scoring.md 계산 예시 (호롱불 + 호랑이 부적)', () => {
    const lamp: ScoreModifier = (_c, t) => ({ kind: 'modifier', label: '호롱불', chips: t.chips, mult: t.mult + 4 });
    const tiger: ScoreModifier = (c, t) =>
      c.rows + c.cols >= 3 ? { kind: 'modifier', label: '호랑이 부적', chips: t.chips, mult: t.mult * 3 } : null;
    const charms = [lamp, tiger];

    expect(scoreClear(ctx(), charms).total).toBe(90);
    expect(scoreClear(ctx({ rows: 2, cellCount: 16, streak: 2 }), charms).total).toBe(287);
    expect(scoreClear(ctx({ rows: 2, cols: 1, cellCount: 22, streak: 3 }), charms).total).toBe(2160);
  });
});
