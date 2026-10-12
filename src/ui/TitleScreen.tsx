import { useState } from 'react';
import { STAGE_NAMES } from '../content/balance';
import { dailySeed, formatDailyDate, type ParsedCode } from '../core/daily';
import { formatKo } from '../core/format';
import type { Profile } from '../core/profile';
import type { SavedRun } from '../save/storage';
import { CodeSheet } from './CodeSheet';
import { ShareBox } from './ShareBox';
import { Sheet } from './Sheet';

interface Props {
  profile: Profile;
  saved: SavedRun | null;
  /** 오늘 날짜 (한국 시간) */
  today: string;
  onContinue: () => void;
  onNew: () => void;
  onDaily: () => void;
  onCode: (code: ParsedCode) => void;
  onTraining: () => void;
}

export function TitleScreen({ profile, saved, today, onContinue, onNew, onDaily, onCode, onTraining }: Props) {
  /** 진행 중인 런을 지우고 시작할지 묻는 중 */
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const savedRun = saved?.run;
  const todayRecord = profile.daily?.date === today ? profile.daily : null;
  const dailyInProgress = savedRun?.mode === 'daily' && savedRun.seed === dailySeed(today);

  /** 진행 중인 런이 있으면 한 번 묻고 시작 */
  const confirmThen = (start: () => void) => (savedRun ? setPending(() => start) : start());

  const dailyStatus = dailyInProgress
    ? '진행 중 · 눌러서 이어하기'
    : todayRecord?.official
      ? `공식 기록: ${todayRecord.official.completed ? `끝판 ${formatKo(todayRecord.official.score)}` : todayRecord.official.reached} · 다시 하면 연습`
      : todayRecord && todayRecord.attempts > 0
        ? '공식 도전을 끝내지 않았어요 · 다시 하면 연습'
        : '고개 3 + 끝판 · 첫 도전이 공식 기록';

  return (
    <div className="screen title-screen">
      <div className="title-head">
        <div className="title-emoji">🧱</div>
        <h1>블록 도사</h1>
        <p>요괴가 막은 여덟 고개를 블록으로 넘어라</p>
      </div>

      <div className="title-actions">
        {savedRun && (
          <button className="title-button primary" onClick={onContinue}>
            이어하기
            <small>
              {savedRun.mode === 'daily' ? '오늘의 판 · ' : ''}고개 {savedRun.ante} · {STAGE_NAMES[savedRun.stageKind]} · $
              {savedRun.gold}
            </small>
          </button>
        )}
        <button className={savedRun ? 'title-button' : 'title-button primary'} onClick={() => confirmThen(onNew)}>
          새 런
        </button>
        <button className="title-button" onClick={() => (dailyInProgress ? onContinue() : confirmThen(onDaily))}>
          오늘의 판 · {formatDailyDate(today)}
          <small>{dailyStatus}</small>
        </button>
        <div className="title-row">
          <button className="title-button" onClick={() => setCodeOpen(true)}>
            코드로 도전
          </button>
          <button className="title-button" onClick={onTraining}>
            수련
            <small>공덕 {profile.merit}</small>
          </button>
        </div>
      </div>

      {todayRecord?.official && (
        <section className="today-record">
          <h2>오늘의 판 공식 기록</h2>
          <ShareBox text={todayRecord.official.text} />
        </section>
      )}

      {profile.runs > 0 && (
        <dl className="records">
          <div>
            <dt>최고 고개</dt>
            <dd>{profile.bestAnte}</dd>
          </div>
          <div>
            <dt>엔딩</dt>
            <dd>{profile.endings}번</dd>
          </div>
          <div>
            <dt>런</dt>
            <dd>{profile.runs}번</dd>
          </div>
          <div>
            <dt>최고 한 방</dt>
            <dd>{formatKo(profile.bestClear)}</dd>
          </div>
        </dl>
      )}

      {pending && (
        <Sheet title="새로 시작할까요?" sub="진행 중인 런은 공덕 없이 사라져요." onClose={() => setPending(null)}>
          <div className="sheet-actions">
            <button className="primary" onClick={pending}>
              새로 시작
            </button>
            <button onClick={() => setPending(null)}>취소</button>
          </div>
        </Sheet>
      )}

      {codeOpen && (
        <CodeSheet
          onStart={(code) => {
            setCodeOpen(false);
            confirmThen(() => onCode(code));
          }}
          onClose={() => setCodeOpen(false)}
        />
      )}
    </div>
  );
}
