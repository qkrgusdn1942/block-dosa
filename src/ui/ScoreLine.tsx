import type { ReactNode } from 'react';
import { PATTERNS } from '../content/balance';
import { formatScore, formatMult } from '../core/format';
import type { StepKind } from '../core/scoring';
import type { ClearEvent, StageToast } from '../core/stage';

interface Props {
  lastClear: ClearEvent | null;
  /** 지금 해야 할 일 (버릴 블록 고르기 등). 계속 떠 있다 */
  notice: ReactNode;
  /** 잠깐 떴다 사라지는 알림 (기사회생 등) */
  toast: StageToast | null;
  /** 누르면 마지막 클리어의 계산 과정을 펼쳐 본다 */
  onDetails?: () => void;
}

/**
 * 마지막 클리어의 칩 × 배수. 안내 문구는 그 위에 덮어서 보여준다
 * (계산 줄을 빼면 안내가 사라질 때 계산 줄 연출이 다시 재생되기 때문)
 */
export function ScoreLine({ lastClear, notice, toast, onDetails }: Props) {
  return (
    <div
      className={lastClear && onDetails ? 'scoreline tappable' : 'scoreline'}
      onClick={lastClear && !notice ? onDetails : undefined}
    >
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

/** 부적 효과는 부적 줄에서 보여주고, 여기엔 판에서 생긴 효과만 태그로 */
const TAG_STEPS: ReadonlySet<StepKind> = new Set(['streak', 'star', 'glass', 'curse', 'perfect', 'void']);

function ClearCalc({ event }: { event: ClearEvent }) {
  const { result } = event;
  // 같은 효과가 여러 번이면 한 태그로 (유리 2)
  const counts = new Map<string, number>();
  for (const step of result.steps) {
    if (TAG_STEPS.has(step.kind)) counts.set(step.label, (counts.get(step.label) ?? 0) + 1);
  }
  const tags = [...counts].map(([label, n]) => (n > 1 ? `${label} ${n}` : label));
  if (event.shifted) tags.unshift('🐍 밀림');
  if (event.swept) tags.unshift('🧹 빗자루');
  if (event.lucky > 0) tags.push('☘ 행운!');
  if (event.broken > 0) tags.push(`◇ 깨짐 ${event.broken}`);
  if (event.scrolls > 0) tags.push('📜 비전서');
  if (event.gold > 0) tags.push(`+$${event.gold}`);

  return (
    <div className="clear-calc">
      <span className="pattern">
        {PATTERNS[result.pattern].name}
        {tags.map((label, i) => (
          <em key={`${label}-${i}`}>{label}</em>
        ))}
      </span>
      <span className="calc">
        <b className="chips">{formatScore(result.chips)}</b>
        <i>×</i>
        <b className="mult">{formatMult(result.mult)}</b>
        <i>=</i>
        <b className="gain">+{formatScore(result.total)}</b>
      </span>
    </div>
  );
}

/** 마지막 클리어의 계산 과정 (족보 → 칸 → 강화 → 연속 → 부적 → 마지막 곱) */
export function ScoreSteps({ event }: { event: ClearEvent }) {
  const { result } = event;
  return (
    <>
      <ol className="score-steps">
        {result.steps.map((step, i) => (
          <li key={i} className={`step-${step.kind}`}>
            <span className="step-label">
              {step.label}
              {step.note && <small>{step.note}</small>}
            </span>
            <span className="calc">
              <b className="chips">{formatScore(step.chips)}</b>
              <i>×</i>
              <b className="mult">{formatMult(step.mult)}</b>
            </span>
          </li>
        ))}
      </ol>
      <div className="reward-total">
        <span>{PATTERNS[result.pattern].name}</span>
        <b>+{formatScore(result.total)}</b>
      </div>
    </>
  );
}
