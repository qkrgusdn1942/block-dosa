import { describe, expect, it } from 'vitest';
import { SHAPES, STARTING_BAG, type ShapeId } from '../src/content/blocks';
import { extent, orientations, parsePattern, rotatePiece, rotations } from '../src/core/pieces';
import { pieceOf } from './helpers';

describe('블록 방향', () => {
  // docs/05-blocks-and-cells.md의 "방향 가짓수"
  const expected: Record<ShapeId, number> = {
    dot: 1,
    bar2: 2,
    bar3: 2,
    bar4: 2,
    bar5: 2,
    square: 1,
    bigSquare: 1,
    rect: 2,
    smallL: 4,
    l: 8,
    bigL: 4,
    t: 4,
    zigzag: 4,
    u: 4,
    plus: 1,
  };

  for (const shape of Object.keys(expected) as ShapeId[]) {
    it(`${SHAPES[shape].name}: ${expected[shape]}가지`, () => {
      expect(orientations(shape)).toHaveLength(expected[shape]);
    });
  }

  it('모든 방향은 칸 수가 같고 (0, 0) 기준으로 정렬돼 있다', () => {
    for (const shape of Object.keys(SHAPES) as ShapeId[]) {
      const size = parsePattern(SHAPES[shape].pattern).length;
      for (const cells of orientations(shape)) {
        expect(cells).toHaveLength(size);
        expect(Math.min(...cells.map(([r]) => r))).toBe(0);
        expect(Math.min(...cells.map(([, c]) => c))).toBe(0);
      }
    }
  });

  it('ㅗ 블록은 ㅗ ㅜ ㅏ ㅓ 네 방향', () => {
    const sizes = orientations('t').map((cells) => extent(cells));
    expect(sizes.filter((s) => s.rows === 2 && s.cols === 3)).toHaveLength(2);
    expect(sizes.filter((s) => s.rows === 3 && s.cols === 2)).toHaveLength(2);
  });

  it('기본 가방은 18개', () => {
    expect(STARTING_BAG.reduce((sum, [, count]) => sum + count, 0)).toBe(18);
  });
});

describe('회전', () => {
  it('가로 막대를 돌리면 세로 막대', () => {
    const rotated = rotatePiece(pieceOf('bar3'));
    expect(rotated.rows).toBe(3);
    expect(rotated.cols).toBe(1);
  });

  it('네 번 돌리면 제자리', () => {
    const piece = pieceOf('l', 3);
    const back = rotatePiece(rotatePiece(rotatePiece(rotatePiece(piece))));
    expect(back.cells).toEqual(piece.cells);
  });

  it('돌린 방향 목록은 중복 없이', () => {
    expect(rotations(pieceOf('square').cells)).toHaveLength(1);
    expect(rotations(pieceOf('bar2').cells)).toHaveLength(2);
    expect(rotations(pieceOf('t').cells)).toHaveLength(4);
  });
});
