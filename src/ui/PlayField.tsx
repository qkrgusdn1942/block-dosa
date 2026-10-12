import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_SIZE } from '../content/balance';
import { SHAPES } from '../content/blocks';
import { canPlace, cellIndex, fullLines, lineCells, placeCells, type Board } from '../core/board';
import type { Piece } from '../core/pieces';
import { canFit, type StageState } from '../core/stage';
import { BoardView, type BoardPreview } from './BoardView';
import { PieceView } from './PieceView';
import { ScoreLine } from './ScoreLine';

/** 끌고 있는 블록의 아래쪽 가장자리를 손가락보다 몇 칸 위에 띄울지 (손가락에 가려지지 않게) */
const LIFT_CELLS = 1;
/** 이만큼(px) 움직여야 끌기로 본다. 그 전에 떼면 탭 */
const DRAG_THRESHOLD = 6;
/** 손에 있는 블록의 칸 크기. 화면 높이에 따라 styles.css에서 바뀐다 */
const HAND_CELL = 'var(--hand-cell)';

interface Hover {
  row: number;
  col: number;
  valid: boolean;
}

interface DragSession {
  slot: number;
  piece: Piece;
  board: Board;
  /** 끌기 시작할 때 잰 판 위치 (끄는 동안 화면은 움직이지 않는다) */
  rect: DOMRect;
  cell: number;
  x: number;
  y: number;
  hover: Hover | null;
}

/** 탭이 무엇을 할지: 버리기·부채는 블록 탭, 망치는 판 칸 탭 */
export type TapMode = 'none' | 'discard' | 'fan' | 'hammer';

interface Props {
  stage: StageState;
  /** 판 진행 중일 때만 조작 가능 */
  interactive: boolean;
  mode: TapMode;
  notice: string | null;
  onPlace: (slot: number, row: number, col: number) => void;
  onSlotTap: (slot: number) => void;
  onCellTap: (index: number) => void;
}

export function PlayField({ stage, interactive, mode, notice, onPlace, onSlotTap, onCellTap }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState<{ slot: number; cell: number } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // 끄는 중에 화면이 사라지면 창에 단 리스너도 뗀다
  useEffect(() => () => detachRef.current?.(), []);

  /** 끄는 블록을 손가락 위에 띄우고, 판 위 미리보기는 칸이 바뀔 때만 다시 그린다 */
  const follow = (session: DragSession) => {
    const { piece, rect, cell, x, y } = session;
    const left = x - (piece.cols * cell) / 2;
    const top = y - piece.rows * cell - LIFT_CELLS * cell;
    floatRef.current?.style.setProperty('transform', `translate3d(${left}px, ${top}px, 0)`);

    const row = Math.round((top - rect.top) / cell);
    const col = Math.round((left - rect.left) / cell);
    const overBoard = row > -piece.rows && row < BOARD_SIZE && col > -piece.cols && col < BOARD_SIZE;
    const next = overBoard ? { row, col, valid: canPlace(session.board, piece.cells, row, col) } : null;
    const prev = session.hover;
    if (prev?.row !== next?.row || prev?.col !== next?.col || prev?.valid !== next?.valid) {
      session.hover = next;
      setHover(next);
    }
  };

  const onPointerDown = (slot: number, event: ReactPointerEvent) => {
    const piece = stage.hand[slot];
    const grid = gridRef.current;
    if (!interactive || !piece || !grid || event.button !== 0 || detachRef.current) return;
    event.preventDefault();
    if (mode !== 'none') {
      onSlotTap(slot);
      return;
    }

    const { pointerId, clientX: startX, clientY: startY } = event;
    let session: DragSession | null = null;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      if (!session) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
        const rect = grid.getBoundingClientRect();
        session = { slot, piece, board: stage.board, rect, cell: rect.width / BOARD_SIZE, x: 0, y: 0, hover: null };
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
      const target = session.hover;
      sessionRef.current = null;
      setDragging(null);
      setHover(null);
      if (commit && target?.valid) onPlace(slot, target.row, target.col);
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

  const draggedPiece = dragging ? stage.hand[dragging.slot] : null;

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

  return (
    <>
      <div className="board-wrap">
        <BoardView
          board={stage.board}
          bonus={stage.bonus}
          preview={preview}
          lastClear={stage.lastClear}
          shiftRow={stage.status === 'playing' ? stage.shiftRow : null}
          onCellTap={interactive && mode === 'hammer' ? onCellTap : undefined}
          gridRef={gridRef}
        />
      </div>

      <ScoreLine lastClear={stage.lastClear} notice={notice} toast={stage.toast} />

      <div className="hand">
        {stage.hand.map((piece, slot) => {
          const classes = ['slot'];
          if (piece && dragging?.slot === slot) classes.push('lifted');
          if (piece && !canFit(stage, piece)) classes.push('nofit');
          if (piece && (mode === 'discard' || mode === 'fan')) classes.push('pickable');
          return (
            <div
              key={slot}
              className={classes.join(' ')}
              aria-label={piece ? `${SHAPES[piece.shape].name} 블록` : '빈 자리'}
              onPointerDown={(event) => onPointerDown(slot, event)}
            >
              {piece && <PieceView piece={piece} cell={HAND_CELL} />}
              {piece?.transformed && <span className="badge">👹</span>}
              {piece && stage.rotation && mode === 'none' && <span className="badge rotate">🌀</span>}
            </div>
          );
        })}
      </div>

      {dragging && draggedPiece && (
        <div className="floating" ref={floatRef}>
          <PieceView piece={draggedPiece} cell={dragging.cell} />
        </div>
      )}
    </>
  );
}
