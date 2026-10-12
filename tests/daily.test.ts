import { describe, expect, it } from 'vitest';
import { WEEKLY_RULES } from '../src/content/weekly';
import {
  dailyDateOf,
  dailySeed,
  findCode,
  formatDailyDate,
  formatWeek,
  kstDate,
  parseCode,
  setupSuffix,
  weekStart,
  weeklyDateOf,
  weeklyRuleOf,
  weeklySeed,
} from '../src/core/daily';

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

describe('주간 도전', () => {
  it('주는 월요일부터: 그 주 월요일 날짜가 시드', () => {
    expect(weekStart('20261012')).toBe('20261012');
    expect(weekStart('20261018')).toBe('20261012');
    expect(weekStart('20261019')).toBe('20261019');
    expect(weekStart('20260101')).toBe('20251229');
    expect(weeklySeed('20261012')).toBe('W20261012');
    expect(weeklyDateOf('W20261012')).toBe('20261012');
    // 월요일이 아니면 주간 도전 코드가 아니다
    expect(weeklyDateOf('W20261013')).toBeNull();
    expect(formatWeek('20261012')).toBe('10/12~10/18');
    expect(formatWeek('20251229')).toBe('12/29~1/4');
  });

  it('규칙은 주마다 돌아가며 나온다', () => {
    expect(weeklyRuleOf('20260105')).toBe(WEEKLY_RULES[0]);
    expect(weeklyRuleOf('20260112')).toBe(WEEKLY_RULES[1]);
    expect(weeklyRuleOf('20251229')).toBe(WEEKLY_RULES[WEEKLY_RULES.length - 1]);
    // 연달아 7주면 규칙이 한 번씩 다 나온다
    const mondays = ['20260202', '20260209', '20260216', '20260223', '20260302', '20260309', '20260316'];
    expect(new Set(mondays.map((monday) => weeklyRuleOf(monday).id)).size).toBe(WEEKLY_RULES.length);
  });

  it('주간 도전 코드', () => {
    expect(parseCode('w20261012')).toEqual({ mode: 'weekly', seed: 'W20261012', date: '20261012' });
    expect(findCode('🧱 블록 도사 · 주간 도전 10/12~10/18\n코드 W20261012')).toMatchObject({ mode: 'weekly' });
  });
});

describe('가방·난이도가 붙은 코드', () => {
  it('기본 가방·1단계가 아니면 코드 뒤에 가방 글자와 단계', () => {
    expect(setupSuffix({ bagType: 'basic', stake: 1 })).toBe('');
    expect(setupSuffix({ bagType: 'chaos', stake: 3 })).toBe('-H3');
    expect(setupSuffix({ bagType: 'basic', stake: 4 })).toBe('-G4');
    expect(setupSuffix({ bagType: 'bars', stake: 1 })).toBe('-M1');
  });

  it('읽으면 그 가방·단계로 도전한다', () => {
    expect(parseCode('K7Q2MX-H3')).toEqual({ mode: 'seed', seed: 'K7Q2MX', setup: { bagType: 'chaos', stake: 3 } });
    expect(parseCode('k7q2mxn8')).toEqual({ mode: 'seed', seed: 'K7Q2MX', setup: { bagType: 'squares', stake: 8 } });
    expect(findCode('코드 K7Q2MX-G4 (수련 적용)')).toEqual({ mode: 'seed', seed: 'K7Q2MX', setup: { bagType: 'basic', stake: 4 } });
    // 없는 가방 글자나 단계는 거절
    expect(parseCode('K7Q2MX-X3')).toBeNull();
    expect(parseCode('K7Q2MX-H9')).toBeNull();
    expect(parseCode('K7Q2MX-H')).toBeNull();
  });
});
