import type { RefObject } from 'react';
import { BOARD_SIZE } from '../content/balance';
import { SHAPES, type ShapeKind } from '../content/blocks';
import { ENHANCEMENTS } from '../content/enhancements';
import type { Board, Filled } from '../core/board';
import type { BonusKind, ClearEvent } from '../core/stage';

export interface BoardPreview {
  /** 끌고 있는 블록이 덮는 판 안의 칸 */
  cells: ReadonlySet<number>;
  valid: boolean;
  kind: ShapeKind;
  /** 여기 놓으면 지워질 칸 */
  clearing: ReadonlySet<number>;
}

interface Props {
  board: Board;
  bonus: Readonly<Record<number, BonusKind>>;
  preview: BoardPreview | null;
  lastClear: ClearEvent | null;
  /** 🐍 이무기: 핸드가 끝나면 밀릴 줄 */
  shiftRow: number | null;
  /** 🔨 망치·🧹 빗자루로 칸을 고르는 중 */
  onCellTap?: (index: number) => void;
  /** 고를 수 있는 칸 (없으면 onCellTap이 있을 때 모든 칸) */
  canTarget?: (index: number) => boolean;
  gridRef: RefObject<HTMLDivElement | null>;
}

const BONUS_EMOJI: Record<BonusKind, string> = { gem: '💎', star: '⭐' };

function cellClasses(cell: Filled | null): string[] {
  if (!cell) return [];
  switch (cell.kind) {
    case 'block':
      return ['filled', `k-${SHAPES[cell.shape].kind}`, ...(cell.enh ? ['enh', `enh-${cell.enh}`] : [])];
    case 'rock':
      return ['rock', ...(cell.cracked ? ['cracked'] : []), ...(cell.shadow ? ['shadow'] : [])];
    case 'water':
      return ['water'];
  }
}

const gridPosition = (index: number) => ({
  gridRow: Math.floor(index / BOARD_SIZE) + 1,
  gridColumn: (index % BOARD_SIZE) + 1,
});

export function BoardView({ board, bonus, preview, lastClear, shiftRow, onCellTap, canTarget, gridRef }: Props) {
  const removed = lastClear?.cleared.filter((c) => c.outcome === 'removed') ?? [];

  return (
    <div className="board">
      <div className="grid" ref={gridRef}>
        {board.map((cell, index) => {
          const classes = ['cell', ...cellClasses(cell)];
          const covered = preview?.cells.has(index) ?? false;
          if (!cell && covered && preview) classes.push(preview.valid ? 'ghost' : 'bad', `k-${preview.kind}`);
          if (cell && covered && preview && !preview.valid) classes.push('bad');
          if (preview?.valid && preview.clearing.has(index)) classes.push('will-clear');
          const targetable = onCellTap !== undefined && (canTarget?.(index) ?? true);
          if (targetable) classes.push('target');
          const mark = bonus[index];
          return (
            <div
              key={index}
              className={classes.join(' ')}
              data-mark={cell?.kind === 'block' && cell.enh ? ENHANCEMENTS[cell.enh].mark : undefined}
              onPointerDown={targetable ? () => onCellTap(index) : undefined}
            >
              {mark && <span className={cell ? 'bonus covered' : 'bonus'}>{BONUS_EMOJI[mark]}</span>}
            </div>
          );
        })}

        {shiftRow !== null && (
          <div className="overlay" aria-hidden="true">
            <div className="shift-row" style={{ gridRow: shiftRow + 1 }}>
              ➜
            </div>
          </div>
        )}

        {lastClear && (
          // 지워진 칸이 터지며 사라지는 연출. 클리어마다 key가 바뀌어 다시 재생된다
          <div className="overlay" key={lastClear.id} aria-hidden="true">
            {removed.map(({ index, cell }, order) => (
              <div
                key={index}
                className={cell.kind === 'block' ? `burst k-${SHAPES[cell.shape].kind}` : 'burst rock'}
                style={{ ...gridPosition(index), animationDelay: `${order * 8}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
