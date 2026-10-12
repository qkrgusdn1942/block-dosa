import { describe, expect, it } from 'vitest';
import { dailyDateOf, dailySeed, findCode, formatDailyDate, kstDate, parseCode } from '../src/core/daily';

describe('한국 시간 날짜', () => {
  it('자정(KST)에 날짜가 바뀐다', () => {
    // 2026-10-11 14:59 UTC = 2026-10-11 23:59 KST
    expect(kstDate(Date.UTC(2026, 9, 11, 14, 59))).toBe('20261011');
    // 2026-10-11 15:00 UTC = 2026-10-12 00:00 KST
    expect(kstDate(Date.UTC(2026, 9, 11, 15, 0))).toBe('20261012');
  });

  it('오늘의 판 시드와 날짜', () => {
    expect(dailySeed('20261012')).toBe('D20261012');
    expect(dailyDateOf('D20261012')).toBe('20261012');
    expect(dailyDateOf('K7Q2MX')).toBeNull();
    expect(formatDailyDate('20261012')).toBe('10/12');
    expect(formatDailyDate('20270105')).toBe('1/5');
  });
});

describe('도전 코드 읽기', () => {
  it('시드 코드: 대소문자·띄어쓰기·하이픈 무시', () => {
    expect(parseCode('k7q2mx')).toEqual({ mode: 'seed', seed: 'K7Q2MX' });
    expect(parseCode(' K7Q-2MX ')).toEqual({ mode: 'seed', seed: 'K7Q2MX' });
  });

  it('오늘의 판 코드', () => {
    expect(parseCode('d20261012')).toEqual({ mode: 'daily', seed: 'D20261012', date: '20261012' });
  });

  it('공유 텍스트를 통째로 붙여넣어도 코드를 찾는다', () => {
    const pasted = '🧱 블록 도사 · 오늘의 판 10/12\n⛰️ 3고개 완주 · 끝판 23.4만\n코드 D20261012';
    expect(findCode(pasted)).toEqual({ mode: 'daily', seed: 'D20261012', date: '20261012' });
    expect(findCode('코드 K7Q2MX (수련 적용)')).toEqual({ mode: 'seed', seed: 'K7Q2MX' });
    expect(findCode('k7q2mx')).toEqual({ mode: 'seed', seed: 'K7Q2MX' });
    expect(findCode('아무 말')).toBeNull();
  });

  it('헷갈리는 글자(O, 0, I, 1)나 길이가 틀리면 거절', () => {
    expect(parseCode('K7Q2M0')).toBeNull();
    expect(parseCode('KOQ2MX')).toBeNull();
    expect(parseCode('K7Q2M')).toBeNull();
    expect(parseCode('')).toBeNull();
    expect(parseCode('D2026101')).toBeNull();
  });
});
