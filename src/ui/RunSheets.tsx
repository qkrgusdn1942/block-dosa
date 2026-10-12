import { RARITY_NAMES, STAGE_NAMES } from '../content/balance';
import { BOSSES, type BossId } from '../content/bosses';
import { consumableInfo } from '../content/consumables';
import { OBSTACLES } from '../content/obstacles';
import { SKIP_REWARDS } from '../content/skips';
import { STAKES } from '../content/stakes';
import { TALISMANS } from '../content/talismans';
import { WEEKLY_RULE_BY_ID } from '../content/weekly';
import { formatScore } from '../core/format';
import { meritTotal, runMerit } from '../core/profile';
import {
  canSkip,
  consumableSlotsFull,
  skipRewardOf,
  talismanSlots,
  talismanSlotsFull,
  type RewardLine,
  type RunState,
} from '../core/run';
import { shareText } from '../core/share';
import { OfferCard } from './OfferCard';
import { ShareBox } from './ShareBox';
import { Sheet } from './Sheet';
import { TalismanBar } from './TalismanBar';

interface PreviewProps {
  run: RunState;
  onStart: () => void;
  /** 판 1·판 2는 건너뛰고 보상을 받을 수 있다 */
  onSkip: () => void;
}

/** 판 미리보기: 목표, 요괴 규칙, 방해 칸, 바위·보너스 칸, 건너뛰기 보상 */
export function PreviewSheet({ run, onStart, onSkip }: PreviewProps) {
  const { stage } = run;
  const boss = stage.boss ? BOSSES[stage.boss] : null;
  const obstacle = stage.obstacle ? OBSTACLES[stage.obstacle] : null;
  const rocks = stage.board.filter((cell) => cell?.kind === 'rock').length;
  const marks = Object.values(stage.bonus);
  const count = (kind: string) => marks.filter((m) => m === kind).length;
  const sealed = stage.talismans.find((t) => t.uid === stage.sealedUid);
  const rule = run.rule ? WEEKLY_RULE_BY_ID[run.rule] : null;
  const skip = canSkip(run) ? SKIP_REWARDS[skipRewardOf(run)] : null;

  return (
    <Sheet
      title={stage.scoreAttack ? '🏁 끝판' : `${run.endless ? '♾️ ' : ''}고개 ${run.ante} · ${STAGE_NAMES[stage.kind]}`}
      sub={
        stage.scoreAttack
          ? '목표 없이 핸드를 다 쓸 때까지 최대한 점수를 내요. 이 점수로 친구들과 겨뤄요.'
          : `목표 ${formatScore(stage.rules.target)}점`
      }
    >
      {boss && (
        <div className="boss-card">
          <span className="boss-emoji">{boss.emoji}</span>
          <div>
            <b>{boss.name}</b>
            <p>{boss.rule}</p>
          </div>
        </div>
      )}
      {obstacle && (
        <div className="boss-card hazard-card">
          <span className="boss-emoji">{obstacle.emoji}</span>
          <div>
            <b>방해 칸: {obstacle.name}</b>
            <p>{obstacle.rule}</p>
          </div>
        </div>
      )}
      <ul className="rules">
        <li>
          핸드 {stage.rules.hands}번, 버리기 {stage.rules.discards}번
        </li>
        {rocks > 0 && <li>🪨 바위 {rocks}개: 줄에 포함되지만 두 번 지워야 부서져요</li>}
        {count('gem') > 0 && <li>💎 보석 칸 {count('gem')}개: 덮어서 지우면 +$3</li>}
        {count('star') > 0 && <li>⭐ 별 칸 {count('star')}개: 덮어서 지우면 그 점수 ×2</li>}
        {count('scroll') > 0 && <li>📜 두루마리 칸 {count('scroll')}개: 덮어서 지우면 비전서 (소모품 칸이 비어 있을 때)</li>}
        {sealed && <li>🔒 봉인된 부적: {TALISMANS[sealed.id].name}</li>}
        {rule && (
          <li>
            {rule.emoji} 이번 주 규칙: {rule.text}
          </li>
        )}
        {run.stake > 1 && (
          <li>
            난이도 {run.stake} {STAKES[run.stake - 1].name}
          </li>
        )}
      </ul>
      <div className="sheet-actions">
        <button className="primary" onClick={onStart}>
          시작
        </button>
        {skip && (
          <button className="with-sub" onClick={onSkip}>
            건너뛰고 {skip.emoji} {skip.name} 받기
            <small className="button-sub">{skip.text} · 이 판의 보상과 다음 장터는 없음</small>
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function RewardSheet({ lines, onCollect }: { lines: readonly RewardLine[]; onCollect: () => void }) {
  const total = lines.reduce((sum, line) => sum + line.gold, 0);
  return (
    <Sheet title="판 클리어!" delayed>
      <ul className="reward-lines">
        {lines.map((line) => (
          <li key={line.label}>
            <span>{line.label}</span>
            <b>+${line.gold}</b>
          </li>
        ))}
      </ul>
      <div className="reward-total">
        <span>합계</span>
        <b>+${total}</b>
      </div>
      <div className="sheet-actions">
        <button className="primary" onClick={onCollect}>
          받기
        </button>
      </div>
    </Sheet>
  );
}

interface RelicProps {
  run: RunState;
  onPick: (index: number) => void;
  onSkip: () => void;
  onTalismanTap: (uid: number) => void;
}

/** 요괴 유품, 수련 "첫 인연"에서 하나 고르기 */
export function RelicSheet({ run, onPick, onSkip, onTalismanTap }: RelicProps) {
  const fullTalismans = talismanSlotsFull(run);
  const fullConsumables = consumableSlotsFull(run);
  const starter = run.phase === 'starter';
  return (
    <Sheet
      title={starter ? '🤝 첫 인연' : '요괴 유품'}
      sub={starter ? '일반 부적 하나를 골라 들고 시작해요' : '하나를 골라 가져가요'}
    >
      <div className="offers">
        {run.relics?.map((offer, index) => {
          if (offer.kind === 'talisman') {
            const def = TALISMANS[offer.id];
            return (
              <OfferCard
                key={index}
                emoji={def.emoji}
                name={def.name}
                tag={RARITY_NAMES[def.rarity]}
                text={def.text}
                action={fullTalismans ? '칸 가득' : '받기'}
                disabled={fullTalismans}
                highlight={def.rarity === 'legendary'}
                onAction={() => onPick(index)}
              />
            );
          }
          const info = consumableInfo(offer.item);
          return (
            <OfferCard
              key={index}
              emoji={info.emoji}
              name={info.name}
              text={info.text}
              action={fullConsumables ? '칸 가득' : '받기'}
              disabled={fullConsumables}
              onAction={() => onPick(index)}
            />
          );
        })}
      </div>
      {fullTalismans && <p className="hint">부적 칸이 가득 찼어요. 아래 부적을 눌러 팔 수 있어요.</p>}
      {!starter && (
        <TalismanBar
          talismans={run.talismans}
          slots={talismanSlots(run)}
          sealedUid={null}
          lastClear={null}
          onTap={onTalismanTap}
        />
      )}
      <div className="sheet-actions">
        <button onClick={onSkip}>건너뛰기</button>
      </div>
    </Sheet>
  );
}

interface EndProps {
  run: RunState;
  /** 정산 뒤 가진 공덕 */
  merit: number;
  onNew: () => void;
  onRetry: () => void;
  onTraining: () => void;
  onTitle: () => void;
}

function endHeadline(run: RunState): { title: string; sub: string } {
  const daily = run.mode === 'daily';
  const ending = run.phase === 'ending';
  const where = `고개 ${run.ante} · ${STAGE_NAMES[run.stageKind]}`;
  const reason =
    run.stage.failReason === 'stuck'
      ? `${where}에서 막혔어요. 놓을 자리가 없었어요.`
      : `${where}에서 핸드를 다 썼는데 목표에 못 미쳤어요.`;
  if (run.endless) return { title: `♾️ 끝없는 모드 · 고개 ${run.ante}`, sub: `엔딩 뒤 ${reason}` };
  if (daily || run.mode === 'weekly') {
    const name = daily ? '오늘의 판' : '주간 도전';
    const badge = run.official ? '공식 기록' : '연습';
    return ending
      ? { title: `${name} 완주!`, sub: `끝판 ${formatScore(run.stage.score)}점 · ${badge}` }
      : { title: `${name} 종료`, sub: `${reason} · ${badge}` };
  }
  return ending ? { title: '엔딩: 이무기를 봉인했어요', sub: '여덟 고개를 모두 넘었어요.' } : { title: '런 종료', sub: reason };
}

export function RunEndSheet({ run, merit, onNew, onRetry, onTraining, onTitle }: EndProps) {
  const meritLines = runMerit(run);
  const { title, sub } = endHeadline(run);
  const { stats } = run;

  return (
    <Sheet title={title} sub={sub} delayed>
      <ShareBox text={shareText(run)} image />
      <dl className="stats">
        <div>
          <dt>깬 판</dt>
          <dd>{stats.stagesCleared}</dd>
        </div>
        <div>
          <dt>잡은 요괴</dt>
          <dd>{stats.bossesBeaten}</dd>
        </div>
        <div>
          <dt>최고 한 방</dt>
          <dd>{formatScore(stats.bestClear)}</dd>
        </div>
        <div>
          <dt>총점</dt>
          <dd>{formatScore(stats.totalScore)}</dd>
        </div>
        <div>
          <dt>지운 줄</dt>
          <dd>{stats.lines}</dd>
        </div>
        <div>
          <dt>시드</dt>
          <dd>{run.seed}</dd>
        </div>
      </dl>

      <h3>받은 공덕</h3>
      <ul className="reward-lines">
        {meritLines.map((line) => (
          <li key={line.label}>
            <span>{line.label}</span>
            <b>+{line.merit}</b>
          </li>
        ))}
      </ul>
      <div className="reward-total">
        <span>합계 +{meritTotal(meritLines)}</span>
        <b>보유 공덕 {merit}</b>
      </div>

      <div className="sheet-actions">
        <button className="primary" onClick={onNew}>
          새 런
        </button>
        <button onClick={onTraining}>수련하러 가기</button>
        <button onClick={onRetry}>
          {run.mode === 'daily' ? '오늘의 판 다시 (연습)' : run.mode === 'weekly' ? '주간 도전 다시 (연습)' : '같은 시드로 다시'}
        </button>
        <button onClick={onTitle}>처음 화면</button>
      </div>
    </Sheet>
  );
}

/** 고개 8 이무기를 깬 뒤: 엔딩으로 끝내거나 끝없는 모드로 계속 */
export function VictorySheet({ onEndless, onFinish }: { onEndless: () => void; onFinish: () => void }) {
  return (
    <Sheet title="🐍 이무기를 봉인했어요!" sub="여덟 고개를 모두 넘었어요. 엔딩 공덕은 어느 쪽을 골라도 받아요." delayed>
      <ul className="rules">
        <li>♾️ 끝없는 모드: 지금 부적·가방 그대로 고개 9부터 계속 가요.</li>
        <li>목표가 고개마다 ×3 → ×5 → ×10으로 커져요. 막히면 그때 끝나요.</li>
        <li>멀리 갈수록 공덕도 더 받아요.</li>
      </ul>
      <div className="sheet-actions">
        <button className="primary" onClick={onEndless}>
          끝없는 모드로 계속
        </button>
        <button onClick={onFinish}>여기서 마치기</button>
      </div>
    </Sheet>
  );
}

export function BossSheet({ boss, onClose }: { boss: BossId; onClose: () => void }) {
  const def = BOSSES[boss];
  return (
    <Sheet title={`${def.emoji} ${def.name}`} sub={def.rule} onClose={onClose}>
      <div className="sheet-actions">
        <button className="primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}
