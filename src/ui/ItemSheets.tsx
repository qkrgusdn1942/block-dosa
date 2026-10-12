import { PATTERNS, RARITY_NAMES, type PatternLevels } from '../content/balance';
import { ALL_SHAPES, SHAPES, type ShapeId } from '../content/blocks';
import { consumableInfo, type Consumable } from '../content/consumables';
import { TALISMANS, type TalismanInstance } from '../content/talismans';
import { extent, orientations, type Piece } from '../core/pieces';
import { sellPrice } from '../core/shop';
import type { BagEntry } from '../core/stage';
import { PieceView } from './PieceView';
import { Sheet } from './Sheet';

interface TalismanSheetProps {
  talisman: TalismanInstance;
  index: number;
  count: number;
  sealed: boolean;
  canSell: boolean;
  onMove: (dir: -1 | 1) => void;
  onSell: () => void;
  onClose: () => void;
}

export function TalismanSheet({ talisman, index, count, sealed, canSell, onMove, onSell, onClose }: TalismanSheetProps) {
  const def = TALISMANS[talisman.id];
  return (
    <Sheet title={`${def.emoji} ${def.name}`} sub={`${RARITY_NAMES[def.rarity]} · ${def.text}`} onClose={onClose}>
      {def.status && <p className="status-line">{def.status(talisman)}</p>}
      {sealed && <p className="status-line">🔒 이번 판 동안 봉인됨</p>}
      <p className="hint">부적은 왼쪽부터 순서대로 발동해요. 배수 + 부적을 배수 × 부적보다 왼쪽에 두면 이득이에요.</p>
      <div className="move-row">
        <button disabled={index === 0} onClick={() => onMove(-1)}>
          ← 왼쪽으로
        </button>
        <button disabled={index === count - 1} onClick={() => onMove(1)}>
          오른쪽으로 →
        </button>
      </div>
      <div className="sheet-actions">
        {canSell && <button onClick={onSell}>팔기 +${sellPrice(talisman.id)}</button>}
        <button className="primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}

interface ConsumableSheetProps {
  item: Consumable;
  levels: PatternLevels;
  /** 지금 쓸 수 있으면 사용 버튼 */
  onUse: (() => void) | null;
  onClose: () => void;
}

export function ConsumableSheet({ item, levels, onUse, onClose }: ConsumableSheetProps) {
  const info = consumableInfo(item);
  return (
    <Sheet title={`${info.emoji} ${info.name}`} sub={info.text} onClose={onClose}>
      {item.kind === 'scroll' && (
        <p className="status-line">
          지금 {PATTERNS[item.pattern].name} Lv.{levels[item.pattern]}
        </p>
      )}
      {!onUse && info.stageOnly && <p className="hint">판 진행 중에만 쓸 수 있어요.</p>}
      <div className="sheet-actions">
        {onUse && (
          <button className="primary" onClick={onUse}>
            사용
          </button>
        )}
        <button className={onUse ? '' : 'primary'} onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}

/** 기본 방향 블록 (목록 표시용) */
function shapePiece(shape: ShapeId): Piece {
  const cells = orientations(shape)[0];
  return { uid: 0, bagId: -1, shape, cells, ...extent(cells) };
}

interface BagSheetProps {
  bag: readonly BagEntry[];
  /** 판 진행 중이면 이번 섞기에서 남은 블록 */
  pile?: readonly number[];
  /** 블록 빼기를 고르는 중이면 */
  onRemove?: (shape: ShapeId) => void;
  onClose: () => void;
}

export function BagSheet({ bag, pile, onRemove, onClose }: BagSheetProps) {
  const total = new Map<ShapeId, number>();
  for (const entry of bag) total.set(entry.shape, (total.get(entry.shape) ?? 0) + 1);
  const left = new Map<ShapeId, number>();
  for (const id of pile ?? []) {
    const shape = bag.find((entry) => entry.id === id)?.shape;
    if (shape) left.set(shape, (left.get(shape) ?? 0) + 1);
  }
  const shapes = ALL_SHAPES.filter((shape) => total.has(shape));

  return (
    <Sheet
      title={onRemove ? '뺄 블록 고르기' : `가방 (${bag.length}개)`}
      sub={onRemove ? '$3을 내고 블록 1개를 가방에서 뺍니다' : pile ? '남은 수 / 전체 수 (이번 섞기 기준)' : undefined}
      onClose={onClose}
    >
      <div className="bag-grid">
        {shapes.map((shape) => (
          <button key={shape} className="bag-item" disabled={!onRemove} onClick={() => onRemove?.(shape)}>
            <PieceView piece={shapePiece(shape)} cell={12} />
            <span className="bag-name">{SHAPES[shape].name}</span>
            <span className="bag-count">{pile ? `${left.get(shape) ?? 0}/${total.get(shape)}` : `×${total.get(shape)}`}</span>
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="primary" onClick={onClose}>
          {onRemove ? '취소' : '닫기'}
        </button>
      </div>
    </Sheet>
  );
}

export function PackSheet({ choices, onPick, onSkip }: { choices: readonly ShapeId[]; onPick: (index: number) => void; onSkip: () => void }) {
  return (
    <Sheet title="🎁 블록 팩" sub="하나를 골라 가방에 넣어요">
      <div className="bag-grid">
        {choices.map((shape, index) => (
          <button key={`${shape}-${index}`} className="bag-item" onClick={() => onPick(index)}>
            <PieceView piece={shapePiece(shape)} cell={14} />
            <span className="bag-name">{SHAPES[shape].name}</span>
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button onClick={onSkip}>건너뛰기</button>
      </div>
    </Sheet>
  );
}
