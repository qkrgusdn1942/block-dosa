import type { PatternId, PatternLevels } from '../content/balance';
import type { TalismanInstance } from '../content/talismans';

/** 런과 판이 같이 쓰는 가진 것(부적, 족보 레벨) 조작 */

export function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

export function levelUp(levels: PatternLevels, pattern: PatternId): PatternLevels {
  return { ...levels, [pattern]: levels[pattern] + 1 };
}

/** 부적을 왼쪽(-1)이나 오른쪽(+1)으로 한 칸 옮긴다. 발동 순서가 바뀐다 */
export function moveTalisman(
  talismans: readonly TalismanInstance[],
  uid: number,
  dir: -1 | 1,
): readonly TalismanInstance[] {
  const from = talismans.findIndex((t) => t.uid === uid);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= talismans.length) return talismans;
  const next = talismans.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
