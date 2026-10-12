import { SHAPES } from '../content/blocks';
import { ENHANCEMENTS } from '../content/enhancements';
import type { Piece } from '../core/pieces';

/**
 * 블록 하나를 그린다. cell은 칸 크기: 숫자면 px, 문자열이면 CSS 값(예: 'var(--hand-cell)').
 * 손에 있는 블록과 끌고 있는 블록에서 같이 쓴다. 🐅 장산범이 가린 블록은 모양 대신 ?
 */
export function PieceView({ piece, cell }: { piece: Piece; cell: number | string }) {
  const size = typeof cell === 'number' ? `${cell}px` : cell;
  if (piece.hidden) {
    return (
      <div className="piece hidden-piece" style={{ width: `calc(${size} * 3)`, height: `calc(${size} * 3)` }}>
        ?
      </div>
    );
  }
  const kind = SHAPES[piece.shape].kind;
  const enh = (piece.enh ? ` enh enh-${piece.enh}` : '') + (piece.frozen ? ' frozen' : '');
  return (
    <div
      className="piece"
      style={{
        gridTemplateColumns: `repeat(${piece.cols}, ${size})`,
        gridTemplateRows: `repeat(${piece.rows}, ${size})`,
        fontSize: `calc(${size} * 0.55)`,
      }}
    >
      {piece.cells.map(([r, c]) => (
        <div
          key={`${r}-${c}`}
          className={`cell filled k-${kind}${enh}`}
          data-mark={piece.enh ? ENHANCEMENTS[piece.enh].mark : undefined}
          style={{ gridRow: r + 1, gridColumn: c + 1 }}
        />
      ))}
    </div>
  );
}
