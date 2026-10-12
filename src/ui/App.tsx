import { Component, useState, type ReactNode } from 'react';
import { ANTE_COUNT, STAGE_KINDS, type StageKind } from '../content/balance';
import { BOSSES, type BossId } from '../content/bosses';
import { NO_PERKS } from '../content/upgrades';
import { dailyDateOf, dailySeed, kstDate, type ParsedCode } from '../core/daily';
import { buyUpgrade, perksOf, recordsOf, settleRun, startDaily, type Profile } from '../core/profile';
import { randomSeedCode } from '../core/rng';
import { createRun, type RunMode, type RunStart, type RunState } from '../core/run';
import { saveStore } from '../save/storage';
import { Game } from './Game';
import { TitleScreen } from './TitleScreen';
import { TrainingScreen } from './TrainingScreen';

/**
 * 개발 서버에서만: 주소에 ?ante=2&stage=boss&boss=mulgwishin 처럼 붙이면 그 판부터 시작한다.
 * 요괴·후반 판을 바로 확인하려는 용도
 */
function devStart(): RunStart | undefined {
  if (!import.meta.env.DEV) return undefined;
  const params = new URLSearchParams(window.location.search);
  const ante = Number(params.get('ante'));
  if (!Number.isInteger(ante) || ante < 1 || ante > ANTE_COUNT) return undefined;
  const stage = params.get('stage');
  const kind: StageKind = STAGE_KINDS.find((k) => k === stage) ?? 'small';
  const boss = params.get('boss');
  return { ante, kind, boss: boss && boss in BOSSES ? (boss as BossId) : undefined };
}

type Screen = { kind: 'title' } | { kind: 'training' } | { kind: 'run'; id: string; initial: RunState };

const makeRunId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** 새 런은 수련을 쓰고, 오늘의 판·코드 도전은 공평하게 수련 없이 */
function runScreen(profile: Profile, mode: RunMode, seed: string, official = false): Screen {
  const perks = mode === 'normal' ? perksOf(profile) : NO_PERKS;
  const initial = createRun(seed, { start: devStart(), perks, records: recordsOf(profile), mode, official });
  return { kind: 'run', id: makeRunId(), initial };
}

export function App() {
  const [profile, setProfile] = useState(() => saveStore.loadProfile());
  const [screen, setScreen] = useState<Screen>(() =>
    devStart() ? runScreen(profile, 'normal', randomSeedCode()) : { kind: 'title' },
  );
  const [saved, setSaved] = useState(() => saveStore.loadRun());

  const updateProfile = (next: Profile) => {
    if (next === profile) return;
    saveStore.saveProfile(next);
    setProfile(next);
  };

  const launch = (mode: RunMode, seed: string, official = false) => {
    saveStore.clearRun();
    setScreen(runScreen(profile, mode, seed, official));
  };

  /** 오늘 날짜의 첫 도전이면 공식 기록. 지난 날짜(코드)는 연습 */
  const launchDaily = (date: string) => {
    const started = startDaily(profile, date, kstDate());
    updateProfile(started.profile);
    saveStore.clearRun();
    setScreen(runScreen(started.profile, 'daily', dailySeed(date), started.official));
  };

  const launchCode = (code: ParsedCode) =>
    code.mode === 'daily' ? launchDaily(code.date) : launch('seed', code.seed);

  const toTitle = () => {
    setSaved(saveStore.loadRun());
    setScreen({ kind: 'title' });
  };

  const content = (() => {
    switch (screen.kind) {
      case 'title':
        return (
          <TitleScreen
            profile={profile}
            saved={saved}
            today={kstDate()}
            onContinue={() => saved && setScreen({ kind: 'run', id: saved.id, initial: saved.run })}
            onNew={() => launch('normal', randomSeedCode())}
            onDaily={() => launchDaily(kstDate())}
            onCode={launchCode}
            onTraining={() => setScreen({ kind: 'training' })}
          />
        );
      case 'training':
        return (
          <TrainingScreen profile={profile} onBuy={(id) => updateProfile(buyUpgrade(profile, id))} onBack={toTitle} />
        );
      case 'run': {
        const { initial } = screen;
        return (
          <Game
            key={screen.id}
            runId={screen.id}
            initial={initial}
            merit={profile.merit}
            onRunEnd={(run) => {
              // 끝난 런은 이어할 수 없으니 지우고 공덕을 정산한다 (같은 런은 한 번만)
              saveStore.clearRun();
              updateProfile(settleRun(profile, run, screen.id));
            }}
            onNew={() => launch('normal', randomSeedCode())}
            onRetry={() => {
              const date = dailyDateOf(initial.seed);
              if (initial.mode === 'daily' && date) launchDaily(date);
              else launch(initial.mode, initial.seed);
            }}
            onTraining={() => setScreen({ kind: 'training' })}
            onTitle={toTitle}
          />
        );
      }
    }
  })();

  return (
    <ErrorBoundary
      key={screen.kind === 'run' ? screen.id : screen.kind}
      onReset={() => {
        saveStore.clearRun();
        setSaved(null);
        setScreen({ kind: 'title' });
      }}
    >
      {content}
    </ErrorBoundary>
  );
}

/** 저장이 깨져서 화면이 그려지지 않을 때, 빈 화면 대신 안내하고 처음 화면으로 */
class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen title-screen">
        <div className="title-head">
          <h1>문제가 생겼어요</h1>
          <p>진행 중인 런을 그리다 오류가 났어요. 런을 지우고 처음 화면으로 돌아갈게요.</p>
        </div>
        <div className="title-actions">
          <button className="title-button primary" onClick={this.props.onReset}>
            처음 화면으로
          </button>
        </div>
      </div>
    );
  }
}
