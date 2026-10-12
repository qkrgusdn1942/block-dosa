import { STAGE_NAMES } from '../content/balance';
import { BOSSES } from '../content/bosses';
import { STAKES } from '../content/stakes';
import { formatScore } from '../core/format';
import type { RunState } from '../core/run';

interface Props {
  run: RunState;
  onBossTap: () => void;
  /** 판 진행 중이면 되돌리기 버튼 (판마다 1번 무료) */
  onUndo?: () => void;
  canUndo: boolean;
}

export function Hud({ run, onBossTap, onUndo, canUndo }: Props) {
  const { stage } = run;
  const { score, rules, handNumber, discardsLeft, streak, clearedThisHand, status, scoreAttack } = stage;
  const boss = stage.boss ? BOSSES[stage.boss] : null;
  // 끝판은 목표가 없으니 남은 핸드로 진행도를 보여준다
  const ratio = scoreAttack ? (handNumber - 1) / rules.hands : Math.min(1, score / rules.target);
  const streakAtRisk = status === 'playing' && streak > 0 && !clearedThisHand;

  return (
    <header className="hud">
      <div className="hud-top">
        <span className="stage-name">
          {run.mode === 'daily' && <span className="mode-tag">오늘의 판</span>}
          {run.mode === 'seed' && <span className="mode-tag">도전장</span>}
          {run.mode === 'weekly' && <span className="mode-tag">주간</span>}
          {run.endless && <span className="mode-tag">끝없는</span>}
          {run.stake > 1 && <span className="mode-tag stake">{STAKES[run.stake - 1].name}</span>}
          {scoreAttack ? '🏁 끝판' : `고개 ${run.ante} · ${STAGE_NAMES[stage.kind]}`}
        </span>
        {boss && (
          <button className="boss-chip" onClick={onBossTap}>
            {boss.emoji} {boss.name}
          </button>
        )}
        <span className="gold">
          ${run.gold}
          {stage.goldEarned > 0 && <small> +{stage.goldEarned}</small>}
        </span>
      </div>
      <div className="score-row">
        <div className="score">
          <span className="label">점수</span>
          <strong>{formatScore(score)}</strong>
        </div>
        <div className="target">
          <span className="label">{scoreAttack ? '끝판' : '목표'}</span>
          <strong>{scoreAttack ? '최대한!' : formatScore(rules.target)}</strong>
        </div>
      </div>
      <div className="progress" aria-hidden="true">
        <div className={ratio >= 1 ? 'bar done' : 'bar'} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="status-row">
        <span>
          핸드 <b>{handNumber}/{rules.hands}</b>
        </span>
        <span>
          버리기 <b>{discardsLeft}</b>
        </span>
        <span className={streak > 0 ? 'streak on' : 'streak'}>
          연속 <b>{streak}</b>
          {streakAtRisk && <small>이번 핸드에 지워야 유지</small>}
        </span>
        {onUndo && (
          <button className="undo-chip" disabled={!canUndo} onClick={onUndo} aria-label="마지막 블록 되돌리기">
            ↩ 되돌리기 {stage.undoLeft}
          </button>
        )}
      </div>
    </header>
  );
}
