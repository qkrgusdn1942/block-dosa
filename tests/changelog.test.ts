import { describe, expect, it } from 'vitest';
import { INK_PRICE, SKIP_FREE_REROLLS, SKIP_GOLD, SKIP_STUDY_LEVELS, STAMP_BLOCKS } from '../src/content/balance';
import { LATEST_VERSION, RELEASES } from '../src/content/changelog';
import { CRYSTAL_CHIPS, FIRE_MULT, GLASS_MULT, GOLD_CELL_CAP } from '../src/content/enhancements';
import { newProfile } from '../src/core/profile';

/** 변경 사항 화면의 숫자가 실제 게임 수치와 어긋나지 않게 */
describe('변경 사항', () => {
  const latest = RELEASES[0];
  const line = (target: string) => latest.sections.flatMap((s) => s.lines).find((l) => l.target.includes(target))!;

  it('맨 위가 최신 버전이고, 처음 프로필은 아직 안 본 것으로', () => {
    expect(LATEST_VERSION).toBe(latest.version);
    expect(newProfile().seenVersion).toBeNull();
  });

  it('강화·소모품·건너뛰기 숫자가 지금 수치와 같다', () => {
    expect(line('수정').text).toContain(`+${CRYSTAL_CHIPS}`);
    expect(line('불꽃').text).toContain(`+${FIRE_MULT}`);
    expect(line('금').text).toContain(`$${GOLD_CELL_CAP}`);
    expect(line('유리').text).toContain(`×${GLASS_MULT}`);
    expect(line('도장').text).toContain(`${STAMP_BLOCKS}개`);
    expect(line('먹').text).toContain(`$${INK_PRICE}`);
    const skip = line('판 건너뛰기').text;
    expect(skip).toContain(`$${SKIP_GOLD}`);
    expect(skip).toContain(`리롤 ${SKIP_FREE_REROLLS}번`);
    expect(skip).toContain(`족보 ${SKIP_STUDY_LEVELS}개`);
  });
});
