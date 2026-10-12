import { describe, expect, it } from 'vitest';
import { formatKo } from '../src/core/format';

describe('한국식 숫자 표기', () => {
  it.each([
    [0, '0'],
    [9_999, '9,999'],
    [10_000, '1만'],
    [12_345, '1.23만'],
    [123_456, '12.3만'],
    [12_345_678, '1,234만'],
    [987_654_321, '9.87억'],
    [1.5e12, '1.5조'],
    [1e68, '1무량대수'],
  ])('%d → %s', (value, text) => {
    expect(formatKo(value)).toBe(text);
  });

  it('목표 직전 점수가 목표처럼 보이지 않게 내림', () => {
    expect(formatKo(14_999)).toBe('1.49만');
  });

  it('무량대수보다 큰 수는 지수 표기', () => {
    expect(formatKo(1.2e75)).toBe('1.2e75');
  });
});
