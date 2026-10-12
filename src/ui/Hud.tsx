import { STAGE_NAMES } from '../content/balance';
import { BOSSES } from '../content/bosses';
import { formatKo } from '../core/format';
import type { RunState } from '../core/run';

export function Hud({ run, onBossTap }: { run: RunState; onBossTap: () => void }) {
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
          <strong>{formatKo(score)}</strong>
        </div>
        <div className="target">
          <span className="label">{scoreAttack ? '끝판' : '목표'}</span>
          <strong>{scoreAttack ? '최대한!' : formatKo(rules.target)}</strong>
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
      </div>
    </header>
  );
}
