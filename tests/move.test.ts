import { describe, expect, it } from 'vitest';
import { importCodeOf, isOldSite, MOVE_NOTICE, moveUrl, NEW_SITE } from '../src/save/move';
import { decodeSave, encodeSave } from '../src/save/transfer';

describe('주소 이사', () => {
  it('예전 주소에서만 이사 안내 (안내를 켠 뒤에)', () => {
    expect(isOldSite('qkrgusdn1942.github.io')).toBe(MOVE_NOTICE);
    expect(isOldSite('dosa.gaon.dev')).toBe(false);
    expect(isOldSite('localhost')).toBe(false);
  });

  it('새 주소 링크: 기록이 있으면 # 뒤에 세이브 코드', () => {
    expect(moveUrl(null)).toBe(NEW_SITE);
    expect(moveUrl('BDS1.abc')).toBe(`${NEW_SITE}#import=BDS1.abc`);
  });

  it('#import= 뒤의 코드만 꺼낸다', () => {
    expect(importCodeOf('#import=BDS1.abc')).toBe('BDS1.abc');
    expect(importCodeOf('#import=')).toBeNull();
    expect(importCodeOf('')).toBeNull();
    expect(importCodeOf('#other=1')).toBeNull();
  });

  it('예전 주소의 기록이 링크를 거쳐 그대로 넘어온다', async () => {
    const record = { profile: JSON.stringify({ version: 1, merit: 120, bestAnte: 4 }), run: JSON.stringify({ ante: 3 }) };
    const link = new URL(moveUrl(await encodeSave(record)));
    expect(link.origin).toBe(new URL(NEW_SITE).origin);
    const code = importCodeOf(link.hash);
    expect(code).not.toBeNull();
    expect(await decodeSave(code!)).toEqual(record);
  });
});
