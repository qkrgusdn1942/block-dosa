import { BAG_CODES, type BagType } from '../content/bags';
import { MAX_STAKE } from '../content/stakes';
import { WEEKLY_RULES, type WeeklyRule } from '../content/weekly';
import type { RunSetup } from './profile';
import { SEED_ALPHABET } from './rng';

/** 오늘의 판, 주간 도전, 도전 코드 → docs/10-social.md */

const DAY = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYYMMDD' ↔ 그날 UTC 자정. 요일과 날짜 더하기에만 쓴다 */
const toDay = (date: string) =>
  Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)));
function fromDay(time: number): string {
  const d = new Date(time);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** 한국 시간 날짜 (예: '20261012'). 자정(KST)에 바뀐다 */
export function kstDate(now: number = Date.now()): string {
  return fromDay(now + 9 * 60 * 60 * 1000);
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

/** 그 날이 속한 주의 월요일 (주간 도전은 월요일 0시(KST)에 바뀐다) */
export function weekStart(date: string): string {
  const day = toDay(date);
  const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return fromDay(day - sinceMonday * DAY);
}

/** 주간 도전 시드 = 'W' + 그 주 월요일 */
export const weeklySeed = (monday: string) => `W${monday}`;

/** 주간 도전 시드면 그 주 월요일, 아니면 null */
export function weeklyDateOf(seed: string): string | null {
  const match = /^W(\d{8})$/.exec(seed);
  return match && weekStart(match[1]) === match[1] ? match[1] : null;
}

/** '20261012' → '10/12~10/18' */
export function formatWeek(monday: string): string {
  return `${formatDailyDate(monday)}~${formatDailyDate(fromDay(toDay(monday) + 6 * DAY))}`;
}

/** 주간 도전 규칙: 2026-01-05(월)부터 센 주 번호로 돌아가며 */
export function weeklyRuleOf(monday: string): WeeklyRule {
  const week = Math.round((toDay(monday) - toDay('20260105')) / (7 * DAY));
  const n = WEEKLY_RULES.length;
  return WEEKLY_RULES[((week % n) + n) % n];
}

/** 기본 가방·1단계가 아니면 코드 뒤에 '-H3'처럼 가방 글자와 단계를 붙인다 */
export function setupSuffix(setup: RunSetup): string {
  return setup.bagType === 'basic' && setup.stake <= 1 ? '' : `-${BAG_CODES[setup.bagType]}${setup.stake}`;
}

function parseSetup(text: string): RunSetup | null {
  if (text.length !== 2) return null;
  const bagType = (Object.keys(BAG_CODES) as BagType[]).find((id) => BAG_CODES[id] === text[0]);
  const stake = Number(text[1]);
  return bagType && Number.isInteger(stake) && stake >= 1 && stake <= MAX_STAKE ? { bagType, stake } : null;
}

export type ParsedCode =
  | { mode: 'daily'; seed: string; date: string }
  | { mode: 'weekly'; seed: string; date: string }
  | { mode: 'seed'; seed: string; setup?: RunSetup };

/**
 * 친구가 보낸 코드 읽기. 대소문자·띄어쓰기·하이픈은 무시한다.
 * - D20261012 → 그날의 오늘의 판
 * - W20261012 → 그 주의 주간 도전 (월요일 날짜)
 * - K7Q2MX → 그 시드로 처음부터 (수련 없이), K7Q2MX-H3 → 혼돈 가방·3단계로
 */
export function parseCode(input: string): ParsedCode | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  const date = dailyDateOf(code);
  if (date) return { mode: 'daily', seed: code, date };
  const monday = weeklyDateOf(code);
  if (monday) return { mode: 'weekly', seed: code, date: monday };
  const seed = code.slice(0, 6);
  if (seed.length !== 6 || ![...seed].every((ch) => SEED_ALPHABET.includes(ch))) return null;
  if (code.length === 6) return { mode: 'seed', seed };
  const setup = parseSetup(code.slice(6));
  return setup ? { mode: 'seed', seed, setup } : null;
}

/** 공유 텍스트를 통째로 붙여넣어도 "코드 ○○○" 부분을 찾아 읽는다 */
export function findCode(text: string): ParsedCode | null {
  const labeled = /코드\s*([A-Za-z0-9-]+)/.exec(text);
  return (labeled && parseCode(labeled[1])) || parseCode(text);
}
