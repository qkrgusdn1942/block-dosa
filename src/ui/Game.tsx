import { useEffect, useReducer, useState, type ReactNode } from 'react';
import { STAMP_BLOCKS } from '../content/balance';
import { consumableInfo } from '../content/consumables';
import { canSell } from '../content/talismans';
import type { LineAxis } from '../core/board';
import { consumableSlots, runReducer, talismanSlots, type RunState } from '../core/run';
import { removalPrice } from '../core/shop';
import { canUndo, isStuck, type HandSlot, type StageAction } from '../core/stage';
import { saveStore } from '../save/storage';
import { ConsumableSlots } from './ConsumableSlots';
import { HelpSheet } from './HelpSheet';
import { Hud } from './Hud';
import { BagSheet, ConsumableSheet, PackSheet, TalismanSheet } from './ItemSheets';
import { PlayField } from './PlayField';
import { BossSheet, PreviewSheet, RelicSheet, RewardSheet, RunEndSheet, VictorySheet } from './RunSheets';
import { ScoreSteps } from './ScoreLine';
import { Sheet } from './Sheet';
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
  /** 설정 "왼손 모드": 아래 버튼 줄 좌우 반전 */
  leftHand: boolean;
}

/** 탭 모드. 망치·부채·빗자루는 어느 소모품 칸을 쓰는지도, 빗자루는 비울 방향도 기억한다 */
type Mode =
  | { kind: 'none' }
  | { kind: 'discard' }
  | { kind: 'hammer'; index: number }
  | { kind: 'broom'; index: number; axis: LineAxis };

/** remove = 장터 블록 빼기, stamp·ink = 도장·먹으로 가방 블록 고르기 */
type OpenSheet =
  | { kind: 'help' }
  | { kind: 'calc' }
  | { kind: 'boss' }
  | { kind: 'bag' }
  | { kind: 'remove' }
  | { kind: 'stamp'; index: number; chosen: number[] }
  | { kind: 'ink'; index: number }
  | { kind: 'talisman'; uid: number }
  | { kind: 'consumable'; index: number }
  | null;

const NONE: Mode = { kind: 'none' };

/** 판 미리보기·진행 중에는 판이 가진 부적·소모품·레벨을, 그 밖에는 런 것을 보여준다 */
const loadoutOf = (run: RunState) => (run.phase === 'preview' || run.phase === 'playing' ? run.stage : run);

export function Game({ runId, initial, merit, onRunEnd, onNew, onRetry, onTraining, onTitle, leftHand }: Props) {
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

  const notice: ReactNode =
    mode.kind === 'discard' ? (
      '버릴 블록을 누르세요'
    ) : mode.kind === 'hammer' ? (
      '🔨 부술 3×3의 가운데 칸을 누르세요'
    ) : mode.kind === 'broom' ? (
      <BroomNotice axis={mode.axis} onAxis={(axis) => setMode({ ...mode, axis })} />
    ) : stuck ? (
      stage.discardsLeft > 0 ? (
        '놓을 자리가 없어요 · 버리기를 써보세요'
      ) : (
        '놓을 자리가 없어요 · 되돌리기·소모품을 쓰거나 포기하세요'
      )
    ) : null;

  const onSlotTap = (slot: HandSlot) => {
    if (mode.kind === 'discard') {
      if (slot !== 'stash') stageAction({ type: 'discard', slot });
    } else if (stage.rotation) stageAction({ type: 'rotate', slot });
    setMode(NONE);
  };

  const onCellTap = (cell: number) => {
    if (mode.kind === 'hammer') stageAction({ type: 'useConsumable', index: mode.index, cell });
    else if (mode.kind === 'broom') stageAction({ type: 'useConsumable', index: mode.index, cell, axis: mode.axis });
    setMode(NONE);
  };

  const onConsumableTap = (index: number) => {
    const item = loadout.consumables[index];
    if (!item) return;
    // ⌛ 모래시계·🌬️ 부채는 판 진행 중이면 바로 쓴다 (이미 돌릴 수 있으면 부채는 설명만)
    if (playing && (item.kind === 'hourglass' || (item.kind === 'fan' && !stage.rotation))) {
      stageAction({ type: 'useConsumable', index });
      return;
    }
    // 망치·빗자루는 판 진행 중이면 바로 대상 고르기, 다시 누르면 취소
    if (playing && (item.kind === 'hammer' || item.kind === 'broom')) {
      const kind = item.kind;
      setMode((current) => {
        if (current.kind === kind && 'index' in current && current.index === index) return NONE;
        return kind === 'broom' ? { kind, index, axis: 'row' } : { kind, index };
      });
      return;
    }
    setSheet({ kind: 'consumable', index });
  };

  const sheets = (
    <>
      {phase === 'preview' && (
        <PreviewSheet run={run} onStart={() => dispatch({ type: 'begin' })} onSkip={() => dispatch({ type: 'skip' })} />
      )}
      {phase === 'reward' && run.reward && <RewardSheet lines={run.reward} onCollect={() => dispatch({ type: 'collect' })} />}
      {phase === 'victory' && (
        <VictorySheet onEndless={() => dispatch({ type: 'endless' })} onFinish={() => dispatch({ type: 'finish' })} />
      )}
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
      case 'calc':
        return stage.lastClear ? (
          <Sheet title="점수 계산" sub="마지막 클리어를 계산한 순서예요. 부적은 왼쪽부터 끼어들어요." onClose={close}>
            <ScoreSteps event={stage.lastClear} />
            <div className="sheet-actions">
              <button className="primary" onClick={close}>
                닫기
              </button>
            </div>
          </Sheet>
        ) : null;
      case 'help':
        return <HelpSheet seed={run.seed} levels={loadout.levels} onClose={close} onTitle={onTitle} />;
      case 'boss':
        return stage.boss ? <BossSheet boss={stage.boss} onClose={close} /> : null;
      case 'bag':
        return <BagSheet bag={loadout.bag} pile={playing ? stage.pile : undefined} onClose={close} />;
      case 'remove':
        return (
          <BagSheet
            bag={run.bag}
            pick={{
              title: '뺄 블록 고르기',
              sub: `$${run.shop ? removalPrice(run.shop) : 0}을 내고 블록 1개를 가방에서 뺍니다`,
              onPick: (bagId) => {
                dispatch({ type: 'removeBlock', bagId });
                close();
              },
            }}
            onClose={close}
          />
        );
      case 'stamp': {
        const item = run.consumables[sheet.index];
        if (!item) return null;
        const info = consumableInfo(item);
        const { index, chosen } = sheet;
        // 가방이 STAMP_BLOCKS개보다 적을 일은 없지만, 고를 수 있는 만큼만
        const need = Math.min(STAMP_BLOCKS, run.bag.length);
        return (
          <BagSheet
            bag={run.bag}
            pick={{
              title: `${info.emoji} ${info.name} (${chosen.length + 1}/${need})`,
              sub: `강화할 블록을 ${need}개 고르세요. ${info.text}`,
              exclude: chosen,
              onPick: (bagId) => {
                const picked = [...chosen, bagId];
                if (picked.length < need) {
                  setSheet({ kind: 'stamp', index, chosen: picked });
                  return;
                }
                dispatch({ type: 'stamp', index, bagIds: picked });
                close();
              },
            }}
            onClose={close}
          />
        );
      }
      case 'ink': {
        const item = run.consumables[sheet.index];
        if (!item) return null;
        const info = consumableInfo(item);
        const { index } = sheet;
        return (
          <BagSheet
            bag={run.bag}
            pick={{
              title: `${info.emoji} ${info.name}`,
              sub: '똑같이 하나 더 만들 블록을 고르세요 (강화 포함)',
              onPick: (bagId) => {
                dispatch({ type: 'ink', index, bagId });
                close();
              },
            }}
            onClose={close}
          />
        );
      }
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
            canSell={(phase === 'shop' || phase === 'relic') && canSell(talisman.id)}
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
        const { index } = sheet;
        // 도장·먹은 장터에서 가방 블록을 골라서 쓴다
        const bagTool = (item.kind === 'stamp' || item.kind === 'ink') && phase === 'shop' ? item.kind : null;
        const onUse =
          item.kind === 'scroll' && !ended
            ? () => {
                dispatch({ type: 'useScroll', index });
                close();
              }
            : bagTool
              ? () => setSheet(bagTool === 'stamp' ? { kind: 'stamp', index, chosen: [] } : { kind: 'ink', index })
              : null;
        return (
          <ConsumableSheet
            item={item}
            levels={loadout.levels}
            onUse={onUse}
            useLabel={bagTool ? '가방에서 고르기' : '사용'}
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
          onBag={() => setSheet({ kind: 'bag' })}
          onRemoveBlock={() => setSheet({ kind: 'remove' })}
          leftHand={leftHand}
        />
        {sheets}
      </>
    );
  }

  const activeConsumable = 'index' in mode ? mode.index : null;
  const giveUp = stuck && stage.discardsLeft === 0;

  return (
    <>
      <div className={leftHand ? 'game left-hand' : 'game'}>
        <Hud
          run={run}
          onBossTap={() => setSheet({ kind: 'boss' })}
          onUndo={playing ? () => stageAction({ type: 'undo' }) : undefined}
          canUndo={playing && canUndo(stage)}
        />
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
          onStash={(slot) => stageAction({ type: 'stash', slot })}
          onReveal={(slot) => stageAction({ type: 'reveal', slot })}
          onCellTap={onCellTap}
          onScoreDetails={() => setSheet({ kind: 'calc' })}
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
          <button className="ctrl secondary" onClick={() => setSheet({ kind: 'bag' })}>
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

/** 🧹 빗자루: 가로·세로를 고르고 칸을 누른다 */
function BroomNotice({ axis, onAxis }: { axis: LineAxis; onAxis: (axis: LineAxis) => void }) {
  return (
    <span className="broom-notice">
      🧹
      <button className={axis === 'row' ? 'on' : ''} onClick={() => onAxis('row')}>
        가로줄
      </button>
      <button className={axis === 'col' ? 'on' : ''} onClick={() => onAxis('col')}>
        세로줄
      </button>
      비울 줄의 칸을 누르세요
    </span>
  );
}
