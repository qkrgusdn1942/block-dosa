import { useState } from 'react';
import { STAGE_NAMES } from '../content/balance';
import { STAKES } from '../content/stakes';
import { dailySeed, formatDailyDate, type ParsedCode } from '../core/daily';
import { formatKo } from '../core/format';
import type { Profile } from '../core/profile';
import type { SavedRun } from '../save/storage';
import { CodeSheet } from './CodeSheet';
import { useInstall } from './install';
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
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const install = useInstall();
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
        {(install.canPrompt || install.needsIosHint) && (
          <button
            className="title-button install"
            onClick={() => (install.canPrompt ? install.prompt() : setIosHintOpen(true))}
          >
            📲 홈 화면에 추가
            <small>앱처럼 바로 열리고, 인터넷이 없어도 돼요</small>
          </button>
        )}
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
          <div>
            <dt>대청소</dt>
            <dd>{profile.totalPerfects}번</dd>
          </div>
          <div>
            <dt>깬 난이도</dt>
            <dd>{profile.stakeCleared > 0 ? STAKES[profile.stakeCleared - 1].name : '-'}</dd>
          </div>
        </dl>
      )}

      {iosHintOpen && (
        <Sheet title="📲 홈 화면에 추가" sub="아이폰은 사파리에서 직접 추가해요." onClose={() => setIosHintOpen(false)}>
          <ol className="rules">
            <li>카톡 등 다른 앱 안에서 열었다면, 먼저 사파리로 열어요.</li>
            <li>사파리 아래쪽 공유 버튼(네모에 위쪽 화살표)을 눌러요.</li>
            <li>목록에서 "홈 화면에 추가"를 눌러요.</li>
          </ol>
          <div className="sheet-actions">
            <button className="primary" onClick={() => setIosHintOpen(false)}>
              확인
            </button>
          </div>
        </Sheet>
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
