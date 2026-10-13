import { PATTERNS, STAGE_NAMES } from '../content/balance';
import { BAG_BY_ID } from '../content/bags';
import { GAME_URL } from '../content/site';
import { STAKES } from '../content/stakes';
import { TALISMANS } from '../content/talismans';
import { NO_PERKS, type RunPerks } from '../content/upgrades';
import { WEEKLY_RULE_BY_ID } from '../content/weekly';
import { dailyDateOf, formatDailyDate, formatWeek, setupSuffix, weeklyDateOf } from './daily';
import { formatKo } from './format';
import { courseOf, type RunState, type StageMark } from './run';

/** 카톡에 붙여넣을 결과 텍스트 → docs/10-social.md */

const SQUARES: Record<StageMark, string> = { clear: '🟩', close: '🟨', fail: '🟥', skip: '⬜' };

const usedPerks = (perks: RunPerks) => JSON.stringify(perks) !== JSON.stringify(NO_PERKS);

/** 판 결과 네모를 고개(판 3개)마다 띄어서 */
function squares(history: readonly StageMark[]): string {
  const groups: string[] = [];
  for (let i = 0; i < history.length; i += 3) {
    groups.push(history.slice(i, i + 3).map((mark) => SQUARES[mark]).join(''));
  }
  return groups.join(' ');
}

/** 어디까지 갔는지 한 줄 */
function progressLine(run: RunState): string {
  const course = courseOf(run.mode);
  if (run.phase === 'ending') {
    return course.finale
      ? `⛰️ ${course.antes}고개 완주 · 끝판 ${formatKo(run.stage.score)}`
      : '⛰️ 여덟 고개 완주! 이무기 봉인';
  }
  const stopped = `고개 ${run.ante} · ${STAGE_NAMES[run.stageKind]}에서 멈춤`;
  return run.endless ? `⛰️ 여덟 고개 완주 → ♾️ ${stopped}` : `⛰️ ${stopped}`;
}

/** 기본 가방·난이도 1이 아니면 무엇으로 했는지 (주간 도전은 대신 그 주의 규칙) */
function setupLine(run: RunState): string | null {
  if (run.mode === 'weekly' && run.rule) {
    const rule = WEEKLY_RULE_BY_ID[run.rule];
    return `${rule.emoji} ${rule.name}: ${rule.text}`;
  }
  if (run.bagType === 'basic' && run.stake <= 1) return null;
  const bag = BAG_BY_ID[run.bagType];
  return `${bag.emoji} ${bag.name} · 난이도 ${run.stake} ${STAKES[run.stake - 1].name}`;
}

function titleLine(run: RunState): string {
  const practice = run.official ? '' : ' (연습)';
  const date = dailyDateOf(run.seed);
  if (run.mode === 'daily' && date) return `🧱 블록 도사 · 오늘의 판 ${formatDailyDate(date)}${practice}`;
  const monday = weeklyDateOf(run.seed);
  if (run.mode === 'weekly' && monday) return `🧱 블록 도사 · 주간 도전 ${formatWeek(monday)}${practice}`;
  return `🧱 블록 도사${run.mode === 'seed' ? ' · 도전장' : ''}`;
}

/** 붙여넣으면 같은 판에 도전할 수 있는 코드. 새 런·도전장은 가방·난이도도 함께 (수련은 빼고) */
function codeLine(run: RunState): string {
  const free = run.mode === 'normal' || run.mode === 'seed';
  const suffix = free ? setupSuffix({ bagType: run.bagType, stake: run.stake }) : '';
  const perks = run.mode === 'normal' && usedPerks(run.perks) ? ' (수련 적용)' : '';
  return `코드 ${run.seed}${suffix}${perks}`;
}

export function shareText(run: RunState): string {
  const title = titleLine(run);

  const setup = setupLine(run);
  const lines = setup ? [title, setup, progressLine(run)] : [title, progressLine(run)];
  if (run.stats.bestClear > 0) {
    const pattern = run.stats.bestPattern ? ` (${PATTERNS[run.stats.bestPattern].name})` : '';
    lines.push(`💥 최고 한 방 ${formatKo(run.stats.bestClear)}${pattern}`);
  }
  if (run.history.length > 0) lines.push(squares(run.history));
  if (run.talismans.length > 0) lines.push(run.talismans.map((t) => TALISMANS[t.id].emoji).join(''));
  lines.push(codeLine(run));
  // 받은 친구가 바로 들어올 수 있게 (카톡에서는 링크 미리보기도 붙는다)
  lines.push(GAME_URL);
  return lines.join('\n');
}
