import { PATTERNS } from '../content/balance';
import { formatKo, formatMult } from '../core/format';
import type { ClearEvent, StageToast } from '../core/stage';

interface Props {
  lastClear: ClearEvent | null;
  /** 지금 해야 할 일 (버릴 블록 고르기 등). 계속 떠 있다 */
  notice: string | null;
  /** 잠깐 떴다 사라지는 알림 (기사회생 등) */
  toast: StageToast | null;
}

/**
 * 마지막 클리어의 칩 × 배수. 안내 문구는 그 위에 덮어서 보여준다
 * (계산 줄을 빼면 안내가 사라질 때 계산 줄 연출이 다시 재생되기 때문)
 */
export function ScoreLine({ lastClear, notice, toast }: Props) {
  return (
    <div className="scoreline">
      {lastClear ? (
        <ClearCalc event={lastClear} key={lastClear.id} />
      ) : (
        <span className="hint">가로나 세로 한 줄을 채우면 지워져요</span>
      )}
      {toast && (
        <div className="toast" key={toast.id}>
          {toast.text}
        </div>
      )}
      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}

function ClearCalc({ event }: { event: ClearEvent }) {
  const { result } = event;
  // 부적 효과는 부적 줄에서 보여주고, 여기엔 연속·별 칸·대청소만 태그로
  const tags = result.steps.filter((s) => s.kind === 'streak' || s.kind === 'star' || s.kind === 'perfect').map((s) => s.label);
  if (event.shifted) tags.unshift('🐍 밀림');

  return (
    <div className="clear-calc">
      <span className="pattern">
        {PATTERNS[result.pattern].name}
        {tags.map((label, i) => (
          <em key={`${label}-${i}`}>{label}</em>
        ))}
      </span>
      <span className="calc">
        <b className="chips">{formatKo(result.chips)}</b>
        <i>×</i>
        <b className="mult">{formatMult(result.mult)}</b>
        <i>=</i>
        <b className="gain">+{formatKo(result.total)}</b>
      </span>
    </div>
  );
}
