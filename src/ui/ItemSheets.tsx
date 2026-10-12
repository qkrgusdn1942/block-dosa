import { PATTERNS, RARITY_NAMES, type PatternLevels } from '../content/balance';
import { ALL_SHAPES, SHAPES, type ShapeId } from '../content/blocks';
import { consumableInfo, type Consumable } from '../content/consumables';
import { ENHANCEMENT_IDS, ENHANCEMENTS, type Enhancement } from '../content/enhancements';
import { TALISMANS, type TalismanInstance } from '../content/talismans';
import { extent, orientations, type Piece } from '../core/pieces';
import { sellPrice, type PackChoice } from '../core/shop';
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
  /** 사용 버튼 글자 (도장·먹은 "가방에서 고르기") */
  useLabel?: string;
  onClose: () => void;
}

export function ConsumableSheet({ item, levels, onUse, useLabel = '사용', onClose }: ConsumableSheetProps) {
  const info = consumableInfo(item);
  return (
    <Sheet title={`${info.emoji} ${info.name}`} sub={info.text} onClose={onClose}>
      {item.kind === 'scroll' && (
        <p className="status-line">
          지금 {PATTERNS[item.pattern].name} Lv.{levels[item.pattern]}
        </p>
      )}
      {!onUse && info.use === 'stage' && <p className="hint">판 진행 중에 소모품 칸을 눌러서 써요.</p>}
      {!onUse && info.use === 'shop' && <p className="hint">장터에서 쓸 수 있어요.</p>}
      <div className="sheet-actions">
        {onUse && (
          <button className="primary" onClick={onUse}>
            {useLabel}
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
function shapePiece(shape: ShapeId, enh?: Enhancement): Piece {
  const cells = orientations(shape)[0];
  return { uid: 0, bagId: -1, shape, cells, ...extent(cells), ...(enh && { enh }) };
}

const blockName = (shape: ShapeId, enh?: Enhancement) =>
  enh ? `${ENHANCEMENTS[enh].name} ${SHAPES[shape].name}` : SHAPES[shape].name;

/** 같은 모양·같은 강화끼리 묶은 가방 블록 */
interface BagGroup {
  key: string;
  shape: ShapeId;
  enh?: Enhancement;
  ids: number[];
}

const enhOrder = (enh?: Enhancement) => (enh ? ENHANCEMENT_IDS.indexOf(enh) + 1 : 0);

function groupBag(bag: readonly BagEntry[]): BagGroup[] {
  const groups = new Map<string, BagGroup>();
  for (const entry of bag) {
    const key = `${entry.shape}:${entry.enh ?? ''}`;
    const group = groups.get(key) ?? { key, shape: entry.shape, enh: entry.enh, ids: [] };
    group.ids.push(entry.id);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => ALL_SHAPES.indexOf(a.shape) - ALL_SHAPES.indexOf(b.shape) || enhOrder(a.enh) - enhOrder(b.enh),
  );
}

/** 가방에 있는 강화의 뜻 */
function EnhancementLegend({ enhs }: { enhs: ReadonlySet<Enhancement> }) {
  if (enhs.size === 0) return null;
  return (
    <ul className="enh-legend">
      {ENHANCEMENT_IDS.filter((id) => enhs.has(id)).map((id) => (
        <li key={id}>
          <span className={`enh-chip enh enh-${id}`}>{ENHANCEMENTS[id].mark}</span>
          <b>{ENHANCEMENTS[id].name}</b> {ENHANCEMENTS[id].text}
        </li>
      ))}
    </ul>
  );
}

/** 가방에서 블록을 고르는 중일 때: 무엇을 하려는지와 고른 뒤 할 일 */
export interface BagPick {
  title: string;
  sub: string;
  onPick: (bagId: number) => void;
}

interface BagSheetProps {
  bag: readonly BagEntry[];
  /** 판 진행 중이면 이번 섞기에서 남은 블록 */
  pile?: readonly number[];
  pick?: BagPick;
  onClose: () => void;
}

export function BagSheet({ bag, pile, pick, onClose }: BagSheetProps) {
  const groups = groupBag(bag);
  const left = new Set(pile ?? []);

  return (
    <Sheet
      title={pick ? pick.title : `가방 (${bag.length}개)`}
      sub={pick ? pick.sub : pile ? '남은 수 / 전체 수 (이번 섞기 기준)' : undefined}
      onClose={onClose}
    >
      <div className="bag-grid">
        {groups.map((group) => (
          // 고를 때는 그 묶음의 마지막 블록을 고른다 (같은 모양·강화라 어느 것이든 같다)
          <button key={group.key} className="bag-item" disabled={!pick} onClick={() => pick?.onPick(group.ids.at(-1)!)}>
            <PieceView piece={shapePiece(group.shape, group.enh)} cell={12} />
            <span className="bag-name">{blockName(group.shape, group.enh)}</span>
            <span className="bag-count">
              {pile ? `${group.ids.filter((id) => left.has(id)).length}/${group.ids.length}` : `×${group.ids.length}`}
            </span>
          </button>
        ))}
      </div>
      <EnhancementLegend enhs={new Set(bag.flatMap((entry) => (entry.enh ? [entry.enh] : [])))} />
      <div className="sheet-actions">
        <button className="primary" onClick={onClose}>
          {pick ? '취소' : '닫기'}
        </button>
      </div>
    </Sheet>
  );
}

interface PackSheetProps {
  choices: readonly PackChoice[];
  onPick: (index: number) => void;
  onSkip: () => void;
}

export function PackSheet({ choices, onPick, onSkip }: PackSheetProps) {
  return (
    <Sheet title="🎁 블록 팩" sub="하나를 골라 가방에 넣어요">
      <div className="bag-grid">
        {choices.map((choice, index) => (
          <button key={`${choice.shape}-${index}`} className="bag-item" onClick={() => onPick(index)}>
            <PieceView piece={shapePiece(choice.shape, choice.enh)} cell={14} />
            <span className="bag-name">{blockName(choice.shape, choice.enh)}</span>
          </button>
        ))}
      </div>
      <EnhancementLegend enhs={new Set(choices.flatMap((choice) => (choice.enh ? [choice.enh] : [])))} />
      <div className="sheet-actions">
        <button onClick={onSkip}>건너뛰기</button>
      </div>
    </Sheet>
  );
}
