/** 한국식 큰 수 단위 (만진법) → docs/06-incremental.md */
const UNITS = [
  '',
  '만',
  '억',
  '조',
  '경',
  '해',
  '자',
  '양',
  '구',
  '간',
  '정',
  '재',
  '극',
  '항하사',
  '아승기',
  '나유타',
  '불가사의',
  '무량대수',
];

/**
 * 1만 미만은 그대로, 그 이상은 유효숫자 3자리 + 단위.
 * 목표에 못 미친 점수가 목표와 같아 보이지 않도록 반올림하지 않고 내림한다.
 */
export function formatKo(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const n = Math.floor(Math.abs(value));
  if (n < 10_000) return sign + n.toLocaleString('ko-KR');

  let unit = Math.floor(Math.log10(n) / 4);
  // log10의 부동소수 오차 보정
  while (unit > 0 && n < 10 ** (unit * 4)) unit--;
  while (n >= 10 ** ((unit + 1) * 4)) unit++;
  if (unit >= UNITS.length) return sign + n.toExponential(1).replace('+', '');

  const scaled = n / 10 ** (unit * 4);
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  const factor = 10 ** digits;
  const truncated = Math.floor(scaled * factor + 1e-9) / factor;
  return sign + truncated.toLocaleString('ko-KR', { maximumFractionDigits: digits }) + UNITS[unit];
}

/** 배수는 ×1.5 같은 소수가 나올 수 있어서 작은 수는 소수 한 자리까지 */
export function formatMult(value: number): string {
  return value < 10_000 ? String(Math.round(value * 10) / 10) : formatKo(value);
}
