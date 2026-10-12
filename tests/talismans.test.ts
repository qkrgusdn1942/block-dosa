import { describe, expect, it } from 'vitest';
import { TALISMAN_IDS, TALISMANS, type TalismanId } from '../src/content/talismans';
import { clearGold, growOnClear, passiveTotals, talismanModifiers } from '../src/core/effects';
import { Rng } from '../src/core/rng';
import { scoreClear, type ClearContext } from '../src/core/scoring';
import { clearCtx, talisman } from './helpers';

/** 부적 하나만 들고 계산했을 때의 칩·배수 (기본: 한 줄 18칩 × 1배수) */
function withCharm(id: TalismanId, overrides: Partial<ClearContext> = {}, counter = 0) {
  const result = scoreClear(clearCtx(overrides), talismanModifiers([talisman(id, 1, counter)], null, new Rng(1)));
  return { chips: result.chips, mult: result.mult, fired: result.steps.some((s) => s.source === 1) };
}

describe('부적', () => {
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
    const [grown] = growOnClear([talisman('treeRings', 1, 5)], null, clearCtx({ rows: 1, cols: 1 }));
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
    expect(passiveTotals(owned, null)).toMatchObject({ discards: 1, interestCap: 5, rotation: true });
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

describe('v1.0 부적', () => {
  it('37종, 전설 3종, 저주 3종', () => {
    expect(TALISMAN_IDS).toHaveLength(37);
    expect(TALISMAN_IDS.filter((id) => TALISMANS[id].rarity === 'cursed')).toEqual(['demonTile', 'hahoe', 'goldJar']);
    expect(TALISMAN_IDS.filter((id) => TALISMANS[id].rarity === 'legendary')).toEqual(['pearl', 'crow', 'feather']);
  });

  it('🏺 장독: ㅁ 종류 블록으로 지우면 칩 +50', () => {
    expect(withCharm('crock', { pieceKind: 'square' }).chips).toBe(18 + 50);
    expect(withCharm('crock', { pieceKind: 'bar' }).fired).toBe(false);
  });

  it('🧱 돌담: 가장자리에 닿은 블록이면 칩 +30', () => {
    expect(withCharm('stoneWall', { pieceTouchesEdge: true }).chips).toBe(18 + 30);
    expect(withCharm('stoneWall').fired).toBe(false);
  });

  it('🕊️ 솟대, 🏯 처마: 세로줄·가로줄 1개당 배수 +3', () => {
    expect(withCharm('pole', { rows: 1, cols: 2 }).fired).toBe(true);
    expect(withCharm('pole', { rows: 2, cols: 0 }).fired).toBe(false);
    expect(withCharm('eaves', { rows: 2, cols: 0 }).mult).toBe(2 + 6);
  });

  it('🦁 해태상: 십자면 배수 +15', () => {
    expect(withCharm('haetae', { rows: 1, cols: 1 }).mult).toBe(3 + 15);
    expect(withCharm('haetae', { rows: 2 }).fired).toBe(false);
  });

  it('💍 쌍가락지, 🧭 사신도, 🗿 장승: 조건이 맞을 때만 ×', () => {
    expect(withCharm('rings', { previousPattern: 'single' }).mult).toBe(2);
    expect(withCharm('rings', { previousPattern: 'double' }).fired).toBe(false);
    expect(withCharm('fourGods', { cornersFilled: true }).mult).toBe(2.5);
    expect(withCharm('fourGods').fired).toBe(false);
    expect(withCharm('totem', { handPlaced: 3, handClears: 3 }).mult).toBe(3);
    expect(withCharm('totem', { handPlaced: 3, handClears: 2 }).fired).toBe(false);
  });

  it('⛄ 눈사람: 대청소로 자라고 ×(1 + 0.5 × 자란 만큼)', () => {
    const [grown] = growOnClear([talisman('snowman', 1, 1)], null, clearCtx({ perfect: true }));
    expect(grown.counter).toBe(2);
    expect(growOnClear([talisman('snowman', 1, 1)], null, clearCtx())[0].counter).toBe(1);
    expect(withCharm('snowman', {}, 2).mult).toBe(2);
    expect(withCharm('snowman', {}, 0).fired).toBe(false);
  });

  it('🐸 두꺼비: 대청소하면 +$5', () => {
    expect(clearGold([talisman('toad', 1)], null, clearCtx({ perfect: true }))).toBe(5);
    expect(clearGold([talisman('toad', 1)], null, clearCtx())).toBe(0);
    expect(clearGold([talisman('toad', 1)], 1, clearCtx({ perfect: true }))).toBe(0);
  });

  it('🌞 삼족오: 연속 3 이상이면 ×3', () => {
    expect(withCharm('crow', { streak: 3 }).mult).toBe((1 + 2) * 3);
    expect(withCharm('crow', { streak: 2 }).fired).toBe(false);
  });

  it('🔮 여의주: 배수 × 부적이 한 번 더 곱해진다 (+ 부적은 그대로)', () => {
    const triple = clearCtx({ rows: 3, cellCount: 24 });
    const owned = [talisman('lamp', 1), talisman('tiger', 2), talisman('pearl', 3)];
    expect(scoreClear(triple, talismanModifiers(owned, null, new Rng(1))).mult).toBe((4 + 4) * 3 * 3);
    // 여의주가 봉인되면 한 번만
    expect(scoreClear(triple, talismanModifiers(owned, 3, new Rng(1))).mult).toBe((4 + 4) * 3);
  });

  it('🪄 도깨비 방망이: 꽝(점수 0), ×4, 그대로가 모두 나온다', () => {
    const rng = Rng.fromSeed('club-test');
    const outcomes = new Set<number>();
    for (let i = 0; i < 200; i++) {
      outcomes.add(scoreClear(clearCtx(), talismanModifiers([talisman('club', 1)], null, rng)).total);
    }
    expect([...outcomes].sort((a, b) => a - b)).toEqual([0, 18, 72]);
  });

  it('✂️ 🪓 🎒 🎁 🍡 🔮 🪶: 장착만 해도 적용', () => {
    const ids: TalismanId[] = ['scissors', 'goldAxe', 'bundle', 'extra', 'riceCake', 'pearl', 'feather'];
    expect(passiveTotals(ids.map((id, i) => talisman(id, i + 1)), null)).toEqual({
      discards: 0,
      hands: 1,
      interestCap: 0,
      rotation: false,
      goldCellMult: 2,
      freeRerolls: 1,
      stash: true,
      extraDraw: 1,
      doubleTimes: true,
      revive: true,
      noInterest: false,
    });
  });

  it('해금 조건이 있는 부적: 두꺼비, 눈사람, 도깨비 방망이, 저주 3종', () => {
    const locked = TALISMAN_IDS.filter((id) => TALISMANS[id].unlock);
    expect(locked.sort()).toEqual(['club', 'demonTile', 'goldJar', 'hahoe', 'snowman', 'toad']);
  });
});
