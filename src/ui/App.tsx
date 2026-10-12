import { Component, useState, type ReactNode } from 'react';
import { STAGE_KINDS, type StageKind } from '../content/balance';
import { BAG_BY_ID, type BagType } from '../content/bags';
import { BOSSES, type BossId } from '../content/bosses';
import { MAX_STAKE } from '../content/stakes';
import { NO_PERKS } from '../content/upgrades';
import { dailyDateOf, dailySeed, kstDate, type ParsedCode } from '../core/daily';
import { buyUpgrade, perksOf, recordsOf, settleRun, startDaily, type Profile, type RunSetup } from '../core/profile';
import { randomSeedCode } from '../core/rng';
import { createRun, type RunMode, type RunStart, type RunState } from '../core/run';
import { saveStore } from '../save/storage';
import { Game } from './Game';
import { RunSetupScreen } from './RunSetupScreen';
import { TitleScreen } from './TitleScreen';
import { TrainingScreen } from './TrainingScreen';

/** 개발 서버에서 바로 시작할 수 있는 가장 먼 고개 (9부터는 끝없는 모드) */
const DEV_MAX_ANTE = 20;

/**
 * 개발 서버에서만: 주소에 ?ante=2&stage=boss&boss=mulgwishin 처럼 붙이면 그 판부터 시작한다.
 * &bag=chaos&stake=3 으로 가방·난이도도 고른다. 요괴·후반 판을 바로 확인하려는 용도
 */
function devOptions(): { start: RunStart; setup: RunSetup } | undefined {
  if (!import.meta.env.DEV) return undefined;
  const params = new URLSearchParams(window.location.search);
  const ante = Number(params.get('ante'));
  if (!Number.isInteger(ante) || ante < 1 || ante > DEV_MAX_ANTE) return undefined;
  const stage = params.get('stage');
  const kind: StageKind = STAGE_KINDS.find((k) => k === stage) ?? 'small';
  const boss = params.get('boss');
  const bag = params.get('bag');
  const stake = Number(params.get('stake'));
  return {
    start: { ante, kind, boss: boss && boss in BOSSES ? (boss as BossId) : undefined },
    setup: {
      bagType: bag && bag in BAG_BY_ID ? (bag as BagType) : 'basic',
      stake: Number.isInteger(stake) && stake >= 1 && stake <= MAX_STAKE ? stake : 1,
    },
  };
}

type Screen =
  | { kind: 'title' }
  | { kind: 'training' }
  | { kind: 'setup' }
  | { kind: 'run'; id: string; initial: RunState };

const makeRunId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_SETUP: RunSetup = { bagType: 'basic', stake: 1 };

/** 새 런은 수련·가방·난이도를 쓰고, 오늘의 판·코드 도전은 공평하게 수련 없이 기본 가방·1단계로 */
function runScreen(profile: Profile, mode: RunMode, seed: string, official = false, setup = DEFAULT_SETUP): Screen {
  const normal = mode === 'normal';
  const initial = createRun(seed, {
    start: devOptions()?.start,
    perks: normal ? perksOf(profile) : NO_PERKS,
    records: recordsOf(profile),
    mode,
    official,
    ...(normal ? setup : DEFAULT_SETUP),
  });
  return { kind: 'run', id: makeRunId(), initial };
}

export function App() {
  const [profile, setProfile] = useState(() => saveStore.loadProfile());
  const [screen, setScreen] = useState<Screen>(() => {
    const dev = devOptions();
    return dev ? runScreen(profile, 'normal', randomSeedCode(), false, dev.setup) : { kind: 'title' };
  });
  const [saved, setSaved] = useState(() => saveStore.loadRun());

  const updateProfile = (next: Profile) => {
    if (next === profile) return;
    saveStore.saveProfile(next);
    setProfile(next);
  };

  const launch = (mode: RunMode, seed: string, official = false, setup?: RunSetup) => {
    saveStore.clearRun();
    setScreen(runScreen(profile, mode, seed, official, setup));
  };

  /** 런 준비 화면에서 고른 가방·난이도로 새 런. 다음에도 그대로 고르게 기억한다 */
  const startNormal = (setup: RunSetup) => {
    const next = { ...profile, lastSetup: setup };
    updateProfile(next);
    saveStore.clearRun();
    setScreen(runScreen(next, 'normal', randomSeedCode(), false, setup));
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
            onNew={() => setScreen({ kind: 'setup' })}
            onDaily={() => launchDaily(kstDate())}
            onCode={launchCode}
            onTraining={() => setScreen({ kind: 'training' })}
          />
        );
      case 'training':
        return (
          <TrainingScreen profile={profile} onBuy={(id) => updateProfile(buyUpgrade(profile, id))} onBack={toTitle} />
        );
      case 'setup':
        return <RunSetupScreen profile={profile} onStart={startNormal} onBack={toTitle} />;
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
            onNew={() => setScreen({ kind: 'setup' })}
            onRetry={() => {
              const date = dailyDateOf(initial.seed);
              if (initial.mode === 'daily' && date) launchDaily(date);
              else launch(initial.mode, initial.seed, false, { bagType: initial.bagType, stake: initial.stake });
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
