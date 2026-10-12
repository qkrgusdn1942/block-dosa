import { describe, expect, it } from 'vitest';
import { TALISMANS, type TalismanId } from '../src/content/talismans';
import { growOnLines, passiveTotals, talismanModifiers } from '../src/core/effects';
import { Rng } from '../src/core/rng';
import { scoreClear, type ClearContext } from '../src/core/scoring';
import { clearCtx, talisman } from './helpers';

/** 부적 하나만 들고 계산했을 때의 칩·배수 (기본: 한 줄 18칩 × 1배수) */
function withCharm(id: TalismanId, overrides: Partial<ClearContext> = {}, counter = 0) {
  const result = scoreClear(clearCtx(overrides), talismanModifiers([talisman(id, 1, counter)], null, new Rng(1)));
  return { chips: result.chips, mult: result.mult, fired: result.steps.some((s) => s.source === 1) };
}

describe('부적 15종', () => {
  it('🪙 엽전 꾸러미: 칩 +20', () => {
    expect(withCharm('coins')).toMatchObject({ chips: 38, mult: 1 });
  });

  it('🩴 짚신: 막대 블록으로 지웠을 때만 칩 +40', () => {
    expect(withCharm('sandals', { pieceKind: 'bar' }).chips).toBe(58);
    expect(withCharm('sandals', { pieceKind: 'square' }).fired).toBe(false);
    expect(withCharm('sandals', { pieceKind: null }).fired).toBe(false);
  });

  it('🏮 호롱불: 배수 +4', () => {
    expect(withCharm('lamp').mult).toBe(5);
  });

  it('🐦 까치: 두 줄 이상이면 배수 +8', () => {
    expect(withCharm('magpie', { rows: 1, cols: 1 }).mult).toBe(3 + 8);
    expect(withCharm('magpie').fired).toBe(false);
  });

  it('🥁 징: 연속 보너스를 한 번 더', () => {
    expect(withCharm('gong', { streak: 3 }).mult).toBe(1 + 2 + 2);
    expect(withCharm('gong', { streak: 1 }).fired).toBe(false);
  });

  it('🐯 호랑이 부적: 세 줄 이상이면 ×3', () => {
    expect(withCharm('tiger', { rows: 2, cols: 1 }).mult).toBe(4 * 3);
    expect(withCharm('tiger', { rows: 2 }).fired).toBe(false);
  });

  it('📃 백지 부적: 지운 뒤 10칸 이하면 ×2', () => {
    expect(withCharm('blankCharm', { filledAfter: 10 }).mult).toBe(2);
    expect(withCharm('blankCharm', { filledAfter: 11 }).fired).toBe(false);
  });

  it('🌾 곳간: 지우기 직전 30칸 이상이면 ×2', () => {
    expect(withCharm('granary', { filledBefore: 30 }).mult).toBe(2);
    expect(withCharm('granary', { filledBefore: 29 }).fired).toBe(false);
  });

  it('🪵 나이테: 지운 줄만큼 자라고 그만큼 칩 +', () => {
    const [grown] = growOnLines([talisman('treeRings', 1, 5)], null, 2);
    expect(grown.counter).toBe(7);
    expect(withCharm('treeRings', {}, 7).chips).toBe(18 + 7);
  });

  it('🎋 대나무: 판을 깰 때마다 배수 +2씩 자람', () => {
    expect(TALISMANS.bamboo.onStageClear?.(talisman('bamboo', 1, 4))?.self?.counter).toBe(6);
    expect(withCharm('bamboo', {}, 6).mult).toBe(7);
    expect(withCharm('bamboo', {}, 0).fired).toBe(false);
  });

  it('👛 복주머니: 판 클리어 때 +$3', () => {
    expect(TALISMANS.pouch.onStageClear?.(talisman('pouch'))?.gold).toBe(3);
  });

  it('🐷 돼지 저금통, 🌀 바람개비, 🧺 키: 장착만 해도 적용', () => {
    const owned = [talisman('piggy', 1), talisman('pinwheel', 2), talisman('winnow', 3)];
    expect(passiveTotals(owned, null)).toEqual({ discards: 1, interestCap: 5, rotation: true });
    // 봉인된 부적은 효과 없음
    expect(passiveTotals(owned, 2).rotation).toBe(false);
  });

  it('🥢 윷가락: 도·개·걸·윷·모가 확률대로 나온다', () => {
    const rng = Rng.fromSeed('yut-test');
    const counts: Record<string, number> = {};
    const throws = 16_000;
    for (let i = 0; i < throws; i++) {
      const step = scoreClear(clearCtx(), talismanModifiers([talisman('yut', 1)], null, rng)).steps.find(
        (s) => s.source === 1,
      );
      const name = step!.note!.slice(0, 1);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    const expected = { 도: 4 / 16, 개: 6 / 16, 걸: 4 / 16, 윷: 1 / 16, 모: 1 / 16 };
    for (const [name, p] of Object.entries(expected)) {
      expect(counts[name] / throws).toBeCloseTo(p, 1);
    }
  });

  it('봉인된 부적은 점수 계산에서 빠진다', () => {
    const result = scoreClear(clearCtx(), talismanModifiers([talisman('lamp', 1)], 1, new Rng(1)));
    expect(result.mult).toBe(1);
  });

  it('왼쪽부터 순서대로: +배수가 ×배수보다 앞에 있어야 이득', () => {
    const lampThenTiger = [talisman('lamp', 1), talisman('tiger', 2)];
    const tigerThenLamp = [talisman('tiger', 2), talisman('lamp', 1)];
    const triple = clearCtx({ rows: 3, cellCount: 24 });
    expect(scoreClear(triple, talismanModifiers(lampThenTiger, null, new Rng(1))).mult).toBe((4 + 4) * 3);
    expect(scoreClear(triple, talismanModifiers(tigerThenLamp, null, new Rng(1))).mult).toBe(4 * 3 + 4);
  });
});
