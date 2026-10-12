import { useEffect, useReducer, useState } from 'react';
import { consumableSlots, runReducer, talismanSlots, type RunState } from '../core/run';
import { isStuck, type StageAction } from '../core/stage';
import { saveStore } from '../save/storage';
import { ConsumableSlots } from './ConsumableSlots';
import { HelpSheet } from './HelpSheet';
import { Hud } from './Hud';
import { BagSheet, ConsumableSheet, PackSheet, TalismanSheet } from './ItemSheets';
import { PlayField } from './PlayField';
import { BossSheet, PreviewSheet, RelicSheet, RewardSheet, RunEndSheet } from './RunSheets';
import { ShopScreen } from './ShopScreen';
import { TalismanBar } from './TalismanBar';

interface Props {
  runId: string;
  /** 새 런, 또는 저장에서 불러온 런 */
  initial: RunState;
  /** 가진 공덕 (런 결과 화면에 표시) */
  merit: number;
  /** 런이 끝났을 때 (공덕 정산). 같은 런으로 여러 번 불릴 수 있다 */
  onRunEnd: (run: RunState) => void;
  onNew: () => void;
  onRetry: () => void;
  onTraining: () => void;
  onTitle: () => void;
}

/** 탭 모드. 망치·부채는 어느 소모품 칸을 쓰는지도 기억한다 */
type Mode = { kind: 'none' } | { kind: 'discard' } | { kind: 'hammer' | 'fan'; index: number };

type OpenSheet =
  | { kind: 'help' }
  | { kind: 'boss' }
  | { kind: 'bag'; removing: boolean }
  | { kind: 'talisman'; uid: number }
  | { kind: 'consumable'; index: number }
  | null;

const NONE: Mode = { kind: 'none' };

/** 판 미리보기·진행 중에는 판이 가진 부적·소모품·레벨을, 그 밖에는 런 것을 보여준다 */
const loadoutOf = (run: RunState) => (run.phase === 'preview' || run.phase === 'playing' ? run.stage : run);

export function Game({ runId, initial, merit, onRunEnd, onNew, onRetry, onTraining, onTitle }: Props) {
  const [run, dispatch] = useReducer(runReducer, initial);
  const [mode, setMode] = useState<Mode>(NONE);
  const [sheet, setSheet] = useState<OpenSheet>(null);

  const { stage, phase } = run;
  const ended = phase === 'over' || phase === 'ending';

  // 바뀔 때마다 자동 저장 (블록 하나 놓을 때마다). 끝난 런은 저장 대신 정산
  useEffect(() => {
    if (ended) onRunEnd(run);
    else saveStore.saveRun(runId, run);
    // onRunEnd는 App이 렌더마다 새로 만들지만, 런이 바뀔 때만 부르면 된다
  }, [run]);
  const loadout = loadoutOf(run);
  const playing = phase === 'playing';
  const stuck = playing && isStuck(stage);
  const sealedUid = phase === 'preview' || phase === 'playing' ? stage.sealedUid : null;
  const stageAction = (action: StageAction) => dispatch({ type: 'stage', action });

  // 판이 끝나면 고르던 모드는 취소
  useEffect(() => {
    if (!playing) setMode(NONE);
  }, [playing]);

  // 줄을 지울 때 짧은 진동 (안드로이드만 지원)
  useEffect(() => {
    // 화면을 한 번도 누르지 않았으면 브라우저가 막고 경고를 남기므로 건너뛴다
    if (!stage.lastClear || !navigator.userActivation?.hasBeenActive) return;
    try {
      navigator.vibrate?.(stage.lastClear.result.total >= 100 ? 30 : 15);
    } catch {
      // 진동을 막아둔 브라우저는 무시
    }
  }, [stage.lastClear]);

  const notice =
    mode.kind === 'discard'
      ? '버릴 블록을 누르세요'
      : mode.kind === 'hammer'
        ? '🔨 부술 칸을 누르세요'
        : mode.kind === 'fan'
          ? '🌬️ 돌릴 블록을 누르세요'
          : stuck
            ? stage.discardsLeft > 0
              ? '놓을 자리가 없어요 · 버리기를 써보세요'
              : '놓을 자리가 없어요 · 소모품을 쓰거나 포기하세요'
            : null;

  const onSlotTap = (slot: number) => {
    if (mode.kind === 'discard') stageAction({ type: 'discard', slot });
    else if (mode.kind === 'fan') stageAction({ type: 'useConsumable', index: mode.index, slot });
    else if (stage.rotation) stageAction({ type: 'rotate', slot });
    setMode(NONE);
  };

  const onCellTap = (cell: number) => {
    if (mode.kind === 'hammer') stageAction({ type: 'useConsumable', index: mode.index, cell });
    setMode(NONE);
  };

  const onConsumableTap = (index: number) => {
    const item = loadout.consumables[index];
    if (!item) return;
    // 망치·부채는 판 진행 중이면 바로 대상 고르기, 다시 누르면 취소
    if (playing && item.kind !== 'scroll') {
      setMode((current) => (current.kind === item.kind && current.index === index ? NONE : { kind: item.kind, index }));
      return;
    }
    setSheet({ kind: 'consumable', index });
  };

  const sheets = (
    <>
      {phase === 'preview' && <PreviewSheet run={run} onStart={() => dispatch({ type: 'begin' })} />}
      {phase === 'reward' && run.reward && <RewardSheet lines={run.reward} onCollect={() => dispatch({ type: 'collect' })} />}
      {(phase === 'relic' || phase === 'starter') && (
        <RelicSheet
          run={run}
          onPick={(index) => dispatch({ type: 'pickRelic', index })}
          onSkip={() => dispatch({ type: 'skipRelic' })}
          onTalismanTap={(uid) => setSheet({ kind: 'talisman', uid })}
        />
      )}
      {ended && (
        <RunEndSheet
          run={run}
          merit={merit}
          onNew={onNew}
          onRetry={onRetry}
          onTraining={onTraining}
          onTitle={onTitle}
        />
      )}
      {phase === 'shop' && run.shop?.pack.choices && !run.shop.pack.done && (
        <PackSheet
          choices={run.shop.pack.choices}
          onPick={(index) => dispatch({ type: 'pickPack', index })}
          onSkip={() => dispatch({ type: 'skipPack' })}
        />
      )}
      {renderOpenSheet()}
    </>
  );

  function renderOpenSheet() {
    if (!sheet) return null;
    const close = () => setSheet(null);
    switch (sheet.kind) {
      case 'help':
        return <HelpSheet seed={run.seed} levels={loadout.levels} onClose={close} onTitle={onTitle} />;
      case 'boss':
        return stage.boss ? <BossSheet boss={stage.boss} onClose={close} /> : null;
      case 'bag':
        return (
          <BagSheet
            bag={phase === 'shop' ? run.bag : stage.bag}
            pile={playing ? stage.pile : undefined}
            onRemove={
              sheet.removing
                ? (shape) => {
                    dispatch({ type: 'removeBlock', shape });
                    close();
                  }
                : undefined
            }
            onClose={close}
          />
        );
      case 'talisman': {
        const index = loadout.talismans.findIndex((t) => t.uid === sheet.uid);
        const talisman = loadout.talismans[index];
        if (!talisman) return null;
        return (
          <TalismanSheet
            talisman={talisman}
            index={index}
            count={loadout.talismans.length}
            sealed={talisman.uid === sealedUid}
            canSell={phase === 'shop' || phase === 'relic'}
            onMove={(dir) => dispatch({ type: 'moveTalisman', uid: talisman.uid, dir })}
            onSell={() => {
              dispatch({ type: 'sell', uid: talisman.uid });
              close();
            }}
            onClose={close}
          />
        );
      }
      case 'consumable': {
        const item = loadout.consumables[sheet.index];
        if (!item) return null;
        const usable = item.kind === 'scroll' && !ended;
        return (
          <ConsumableSheet
            item={item}
            levels={loadout.levels}
            onUse={
              usable
                ? () => {
                    dispatch({ type: 'useScroll', index: sheet.index });
                    close();
                  }
                : null
            }
            onClose={close}
          />
        );
      }
    }
  }

  if (phase === 'shop') {
    return (
      <>
        <ShopScreen
          run={run}
          dispatch={dispatch}
          onTalismanTap={(uid) => setSheet({ kind: 'talisman', uid })}
          onConsumableTap={onConsumableTap}
          onBag={() => setSheet({ kind: 'bag', removing: false })}
          onRemoveBlock={() => setSheet({ kind: 'bag', removing: true })}
        />
        {sheets}
      </>
    );
  }

  const activeConsumable = mode.kind === 'hammer' || mode.kind === 'fan' ? mode.index : null;
  const giveUp = stuck && stage.discardsLeft === 0;

  return (
    <>
      <div className="game">
        <Hud run={run} onBossTap={() => setSheet({ kind: 'boss' })} />
        <TalismanBar
          talismans={loadout.talismans}
          slots={talismanSlots(run)}
          sealedUid={sealedUid}
          lastClear={stage.lastClear}
          onTap={(uid) => setSheet({ kind: 'talisman', uid })}
        />
        <PlayField
          stage={stage}
          interactive={playing}
          mode={mode.kind}
          notice={notice}
          onPlace={(slot, row, col) => stageAction({ type: 'place', slot, row, col })}
          onSlotTap={onSlotTap}
          onCellTap={onCellTap}
        />
        <div className="controls">
          {giveUp ? (
            <button className="ctrl danger" onClick={() => stageAction({ type: 'giveUp' })}>
              포기
            </button>
          ) : (
            <button
              className={mode.kind === 'discard' ? 'ctrl active' : 'ctrl'}
              disabled={!playing || stage.discardsLeft === 0}
              onClick={() => setMode((current) => (current.kind === 'discard' ? NONE : { kind: 'discard' }))}
            >
              {mode.kind === 'discard' ? '취소' : `버리기 ${stage.discardsLeft}`}
            </button>
          )}
          <ConsumableSlots
            items={loadout.consumables}
            slots={consumableSlots(run)}
            activeIndex={activeConsumable}
            onTap={onConsumableTap}
          />
          <button className="ctrl secondary" onClick={() => setSheet({ kind: 'bag', removing: false })}>
            가방
          </button>
          <button className="ctrl secondary" onClick={() => setSheet({ kind: 'help' })}>
            규칙
          </button>
        </div>
      </div>
      {sheets}
    </>
  );
}
