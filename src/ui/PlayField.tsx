import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { BOARD_SIZE } from '../content/balance';
import { SHAPES } from '../content/blocks';
import { canPlace, cellIndex, fullLines, lineCells, placeCells, type Board } from '../core/board';
import type { Piece } from '../core/pieces';
import { canFit, pieceAt, type HandSlot, type StageState } from '../core/stage';
import { BoardView, type BoardPreview } from './BoardView';
import { PieceView } from './PieceView';
import { ScoreLine } from './ScoreLine';

/** 끌고 있는 블록의 아래쪽 가장자리를 손가락보다 몇 칸 위에 띄울지 (손가락에 가려지지 않게) */
const LIFT_CELLS = 1;
/** 이만큼(px) 움직여야 끌기로 본다. 그 전에 떼면 탭 */
const DRAG_THRESHOLD = 6;
/** 손에 있는 블록의 칸 크기. 화면 높이와 칸 수에 따라 styles.css에서 바뀐다 */
const HAND_CELL = 'var(--hand-cell)';

interface Hover {
  row: number;
  col: number;
  valid: boolean;
}

interface DragSession {
  slot: HandSlot;
  piece: Piece;
  board: Board;
  /** 끌기 시작할 때 잰 판·보관함 위치 (끄는 동안 화면은 움직이지 않는다) */
  rect: DOMRect;
  stashRect: DOMRect | null;
  cell: number;
  x: number;
  y: number;
  hover: Hover | null;
  /** 손가락이 빈 보관함 위에 있다 */
  overStash: boolean;
}

/** 탭이 무엇을 할지: 버리기·부채는 블록 탭, 망치·빗자루는 판 칸 탭 */
export type TapMode = 'none' | 'discard' | 'fan' | 'hammer' | 'broom';

interface Props {
  stage: StageState;
  /** 판 진행 중일 때만 조작 가능 */
  interactive: boolean;
  mode: TapMode;
  notice: ReactNode;
  onPlace: (slot: HandSlot, row: number, col: number) => void;
  onSlotTap: (slot: HandSlot) => void;
  onStash: (slot: number) => void;
  onReveal: (slot: number) => void;
  onCellTap: (index: number) => void;
}

const inside = (rect: DOMRect, x: number, y: number) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

export function PlayField({ stage, interactive, mode, notice, onPlace, onSlotTap, onStash, onReveal, onCellTap }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const stashRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState<{ slot: HandSlot; cell: number } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [overStash, setOverStash] = useState(false);

  // 끄는 중에 화면이 사라지면 창에 단 리스너도 뗀다
  useEffect(() => () => detachRef.current?.(), []);

  /** 끄는 블록을 손가락 위에 띄우고, 판 위 미리보기는 칸이 바뀔 때만 다시 그린다 */
  const follow = (session: DragSession) => {
    const { piece, rect, cell, x, y } = session;
    const left = x - (piece.cols * cell) / 2;
    const top = y - piece.rows * cell - LIFT_CELLS * cell;
    floatRef.current?.style.setProperty('transform', `translate3d(${left}px, ${top}px, 0)`);

    const toStash = session.stashRect !== null && inside(session.stashRect, x, y);
    if (toStash !== session.overStash) {
      session.overStash = toStash;
      setOverStash(toStash);
    }
    const row = Math.round((top - rect.top) / cell);
    const col = Math.round((left - rect.left) / cell);
    const overBoard = !toStash && row > -piece.rows && row < BOARD_SIZE && col > -piece.cols && col < BOARD_SIZE;
    const next = overBoard ? { row, col, valid: canPlace(session.board, piece.cells, row, col) } : null;
    const prev = session.hover;
    if (prev?.row !== next?.row || prev?.col !== next?.col || prev?.valid !== next?.valid) {
      session.hover = next;
      setHover(next);
    }
  };

  const onPointerDown = (slot: HandSlot, event: ReactPointerEvent) => {
    const piece = pieceAt(stage, slot);
    const grid = gridRef.current;
    if (!interactive || !piece || !grid || event.button !== 0 || detachRef.current) return;
    event.preventDefault();
    if (mode !== 'none') {
      onSlotTap(slot);
      return;
    }
    // 🐅 가려진 블록은 집어 드는 순간 드러난다
    if (piece.hidden && slot !== 'stash') onReveal(slot);

    const { pointerId, clientX: startX, clientY: startY } = event;
    let session: DragSession | null = null;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      if (!session) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
        const rect = grid.getBoundingClientRect();
        // 손의 블록은 빈 보관함에 넣을 수 있다
        const stashRect =
          slot !== 'stash' && stage.stashEnabled && !stage.stash ? (stashRef.current?.getBoundingClientRect() ?? null) : null;
        session = {
          slot,
          piece,
          board: stage.board,
          rect,
          stashRect,
          cell: rect.width / BOARD_SIZE,
          x: 0,
          y: 0,
          hover: null,
          overStash: false,
        };
        sessionRef.current = session;
        setDragging({ slot, cell: session.cell });
      }
      session.x = e.clientX;
      session.y = e.clientY;
      follow(session);
    };
    const finish = (e: PointerEvent, commit: boolean) => {
      if (e.pointerId !== pointerId) return;
      detach();
      if (!session) {
        if (commit) onSlotTap(slot);
        return;
      }
      session.x = e.clientX;
      session.y = e.clientY;
      follow(session);
      const { hover: target, overStash: toStash } = session;
      sessionRef.current = null;
      setDragging(null);
      setHover(null);
      setOverStash(false);
      if (!commit) return;
      if (toStash && slot !== 'stash') onStash(slot);
      else if (target?.valid) onPlace(slot, target.row, target.col);
    };
    const up = (e: PointerEvent) => finish(e, true);
    const cancel = (e: PointerEvent) => finish(e, false);
    const detach = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      detachRef.current = null;
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    detachRef.current = detach;
  };

  // 끄는 블록이 처음 그려질 때 위치 잡기
  useLayoutEffect(() => {
    if (dragging && sessionRef.current) follow(sessionRef.current);
    // follow는 렌더마다 새로 만들어지지만 하는 일은 같다
  }, [dragging]);

  const draggedPiece = dragging ? pieceAt(stage, dragging.slot) : null;

  const preview = useMemo<BoardPreview | null>(() => {
    if (!hover || !draggedPiece) return null;
    const cells = new Set<number>();
    for (const [r, c] of draggedPiece.cells) {
      const row = hover.row + r;
      const col = hover.col + c;
      if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) cells.add(cellIndex(row, col));
    }
    const clearing = hover.valid
      ? new Set(
          lineCells(fullLines(placeCells(stage.board, draggedPiece.cells, hover.row, hover.col, draggedPiece.shape))),
        )
      : new Set<number>();
    return { cells, valid: hover.valid, kind: SHAPES[draggedPiece.shape].kind, clearing };
  }, [hover, draggedPiece, stage.board]);

  // 망치는 블록·바위 칸만, 빗자루는 물이 아닌 아무 칸 (그 칸의 줄을 비운다)
  const targeting = interactive && (mode === 'hammer' || mode === 'broom');
  const canTarget = (index: number) => {
    const cell = stage.board[index];
    return mode === 'hammer' ? cell !== null && cell.kind !== 'water' : cell?.kind !== 'water';
  };

  const slotClasses = (slot: HandSlot, piece: Piece | null) => {
    const classes = ['slot'];
    if (piece && dragging?.slot === slot) classes.push('lifted');
    if (piece && !canFit(stage, piece)) classes.push('nofit');
    if (piece && (mode === 'fan' || (mode === 'discard' && slot !== 'stash'))) classes.push('pickable');
    return classes;
  };

  const slotCount = stage.hand.length + (stage.stashEnabled ? 1 : 0);

  return (
    <>
      <div className="board-wrap">
        <BoardView
          board={stage.board}
          bonus={stage.bonus}
          preview={preview}
          lastClear={stage.lastClear}
          shiftRow={stage.status === 'playing' ? stage.shiftRow : null}
          onCellTap={targeting ? onCellTap : undefined}
          canTarget={canTarget}
          gridRef={gridRef}
        />
      </div>

      <ScoreLine lastClear={stage.lastClear} notice={notice} toast={stage.toast} />

      <div className="hand" data-slots={slotCount} style={{ gridTemplateColumns: `repeat(${slotCount}, 1fr)` }}>
        {stage.hand.map((piece, slot) => (
          <div
            key={slot}
            className={slotClasses(slot, piece).join(' ')}
            aria-label={piece ? (piece.hidden ? '가려진 블록' : `${SHAPES[piece.shape].name} 블록`) : '빈 자리'}
            onPointerDown={(event) => onPointerDown(slot, event)}
          >
            {piece && <PieceView piece={piece} cell={HAND_CELL} />}
            {piece?.transformed && <span className="badge">👹</span>}
            {piece && stage.rotation && mode === 'none' && !piece.hidden && <span className="badge rotate">🌀</span>}
          </div>
        ))}
        {stage.stashEnabled && (
          <div
            ref={stashRef}
            className={[...slotClasses('stash', stage.stash), 'stash', ...(overStash ? ['drop'] : [])].join(' ')}
            aria-label={stage.stash ? `보관함: ${SHAPES[stage.stash.shape].name} 블록` : '빈 보관함'}
            onPointerDown={(event) => onPointerDown('stash', event)}
          >
            {stage.stash ? <PieceView piece={stage.stash} cell={HAND_CELL} /> : <span className="stash-label">🎒 보관</span>}
          </div>
        )}
      </div>

      {dragging && draggedPiece && (
        <div className="floating" ref={floatRef}>
          <PieceView piece={draggedPiece} cell={dragging.cell} />
        </div>
      )}
    </>
  );
}
