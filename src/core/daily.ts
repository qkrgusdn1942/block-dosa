import { SEED_ALPHABET } from './rng';

/** 오늘의 판과 도전 코드 → docs/10-social.md */

/** 한국 시간 날짜 (예: '20261012'). 자정(KST)에 바뀐다 */
export function kstDate(now: number = Date.now()): string {
  const d = new Date(now + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** 오늘의 판 시드 = 'D' + 날짜 */
export const dailySeed = (date: string) => `D${date}`;

/** 오늘의 판 시드면 날짜, 아니면 null */
export function dailyDateOf(seed: string): string | null {
  const match = /^D(\d{8})$/.exec(seed);
  return match ? match[1] : null;
}

/** '20261012' → '10/12' */
export function formatDailyDate(date: string): string {
  return `${Number(date.slice(4, 6))}/${Number(date.slice(6, 8))}`;
}

export type ParsedCode = { mode: 'daily'; seed: string; date: string } | { mode: 'seed'; seed: string };

/**
 * 친구가 보낸 코드 읽기. 대소문자·띄어쓰기·하이픈은 무시한다.
 * - D20261012 → 그날의 오늘의 판
 * - K7Q2MX → 그 시드로 처음부터 (수련 없이)
 */
export function parseCode(input: string): ParsedCode | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  const date = dailyDateOf(code);
  if (date) return { mode: 'daily', seed: code, date };
  if (code.length === 6 && [...code].every((ch) => SEED_ALPHABET.includes(ch))) return { mode: 'seed', seed: code };
  return null;
}

/** 공유 텍스트를 통째로 붙여넣어도 "코드 ○○○" 부분을 찾아 읽는다 */
export function findCode(text: string): ParsedCode | null {
  const labeled = /코드\s*([A-Za-z0-9-]+)/.exec(text);
  return (labeled && parseCode(labeled[1])) || parseCode(text);
}
