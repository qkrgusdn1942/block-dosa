import { SHAPES } from '../content/blocks';
import type { Piece } from '../core/pieces';

/**
 * 블록 하나를 그린다. cell은 칸 크기: 숫자면 px, 문자열이면 CSS 값(예: 'var(--hand-cell)').
 * 손에 있는 블록과 끌고 있는 블록에서 같이 쓴다.
 */
export function PieceView({ piece, cell }: { piece: Piece; cell: number | string }) {
  const kind = SHAPES[piece.shape].kind;
  const size = typeof cell === 'number' ? `${cell}px` : cell;
  return (
    <div
      className="piece"
      style={{
        gridTemplateColumns: `repeat(${piece.cols}, ${size})`,
        gridTemplateRows: `repeat(${piece.rows}, ${size})`,
      }}
    >
      {piece.cells.map(([r, c]) => (
        <div key={`${r}-${c}`} className={`cell filled k-${kind}`} style={{ gridRow: r + 1, gridColumn: c + 1 }} />
      ))}
    </div>
  );
}
