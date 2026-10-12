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

/** 지수 표기: 1만 미만은 그대로, 그 이상은 유효숫자 3자리 (내림). 예: 12,345 → 1.23e4 */
export function formatExp(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const n = Math.floor(Math.abs(value));
  if (n < 10_000) return sign + n.toLocaleString('ko-KR');
  let exp = Math.floor(Math.log10(n));
  if (n < 10 ** exp) exp--;
  if (n >= 10 ** (exp + 1)) exp++;
  const mantissa = Math.floor((n / 10 ** exp) * 100 + 1e-9) / 100;
  return `${sign}${mantissa}e${exp}`;
}

/** 화면 숫자 표기 설정 → docs/06-incremental.md */
export type NumberStyle = 'korean' | 'exponent';

let numberStyle: NumberStyle = 'korean';

/** 처음 화면·설정에서 바꾸면 그 뒤로 그리는 숫자에 적용된다. 공유 글은 늘 한국식 */
export function setNumberStyle(style: NumberStyle) {
  numberStyle = style;
}

/** 화면에 보여줄 점수·목표 (설정에 따라 한국식 또는 지수) */
export function formatScore(value: number): string {
  return numberStyle === 'exponent' ? formatExp(value) : formatKo(value);
}

/** 배수는 ×1.5 같은 소수가 나올 수 있어서 작은 수는 소수 한 자리까지 */
export function formatMult(value: number): string {
  return value < 10_000 ? String(Math.round(value * 10) / 10) : formatScore(value);
}
