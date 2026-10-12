import { describe, expect, it } from 'vitest';
import {
  canPlace,
  clearLines,
  emptyBoard,
  filledCount,
  fitsAnywhere,
  fullLines,
  isBoardEmpty,
  placeCells,
  shiftRowRight,
  wouldCompleteLine,
} from '../src/core/board';
import { boardFrom, boardText, pieceOf } from './helpers';

describe('놓기', () => {
  it('빈칸이고 판 안이면 놓을 수 있다', () => {
    const bar = pieceOf('bar3'); // 가로 3칸
    expect(canPlace(emptyBoard(), bar.cells, 0, 5)).toBe(true);
    expect(canPlace(emptyBoard(), bar.cells, 0, 6)).toBe(false); // 오른쪽으로 넘침
    expect(canPlace(emptyBoard(), bar.cells, -1, 0)).toBe(false);
  });

  it('채워진 칸, 바위, 물 위에는 못 놓는다', () => {
    const board = boardFrom(['.#R~']);
    expect(canPlace(board, pieceOf('dot').cells, 0, 0)).toBe(true);
    expect(canPlace(board, pieceOf('dot').cells, 0, 1)).toBe(false);
    expect(canPlace(board, pieceOf('dot').cells, 0, 2)).toBe(false);
    expect(canPlace(board, pieceOf('dot').cells, 0, 3)).toBe(false);
  });

  it('놓은 칸은 블록이 된다', () => {
    const board = placeCells(emptyBoard(), pieceOf('dot').cells, 0, 1, 'dot');
    expect(board[1]).toEqual({ kind: 'block', shape: 'dot' });
  });
});

describe('줄 지우기', () => {
  it('꽉 찬 가로줄과 세로줄을 찾는다', () => {
    const board = boardFrom([
      '########',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
    ]);
    expect(fullLines(board)).toEqual({ rows: [0], cols: [0] });
  });

  it('가로·세로가 겹치는 칸은 한 번만 지운다', () => {
    const board = boardFrom(['########', '########', '#', '#', '#', '#', '#', '#']);
    const { board: next, cleared } = clearLines(board, fullLines(board));
    expect(cleared).toHaveLength(16 + 8 - 2);
    expect(isBoardEmpty(next)).toBe(true);
    expect(cleared.map((c) => c.index)).toEqual([...cleared.map((c) => c.index)].sort((a, b) => a - b));
  });

  it('바위는 줄 완성에 포함되고, 처음엔 금만 가고 두 번째에 부서진다', () => {
    const first = boardFrom(['###R####']);
    expect(fullLines(first).rows).toEqual([0]);
    const once = clearLines(first, fullLines(first));
    expect(boardText(once.board)[0]).toBe('...r....');
    expect(once.cleared.find((c) => c.index === 3)?.outcome).toBe('cracked');

    const second = boardFrom(['###r####']);
    const twice = clearLines(second, fullLines(second));
    expect(boardText(twice.board)[0]).toBe('........');
  });

  it('물만 있는 줄은 줄이 아니고, 물이 섞인 세로줄은 나머지만 차면 지워진다', () => {
    const board = boardFrom(['#', '#', '#', '#', '#', '#', '~~~~~~~~', '~~~~~~~~']);
    expect(fullLines(board)).toEqual({ rows: [], cols: [0] });
    const { board: next } = clearLines(board, fullLines(board));
    expect(boardText(next)[0]).toBe('........');
    expect(boardText(next)[6]).toBe('~~~~~~~~');
    expect(isBoardEmpty(next)).toBe(true);
  });

  it('채워진 칸 수는 블록과 바위만 센다', () => {
    expect(filledCount(boardFrom(['#R~.']))).toBe(2);
  });

  it('어디에도 못 놓는 블록을 알아낸다', () => {
    // 대각선만 비어 있는 판: 1칸짜리만 들어간다
    const board = boardFrom([
      '.#######',
      '#.######',
      '##.#####',
      '###.####',
      '####.###',
      '#####.##',
      '######.#',
      '#######.',
    ]);
    expect(fitsAnywhere(board, pieceOf('dot').cells)).toBe(true);
    expect(fitsAnywhere(board, pieceOf('bar2').cells)).toBe(false);
  });
});

describe('이무기 줄 밀기', () => {
  it('오른쪽으로 한 칸, 끝 칸은 왼쪽으로', () => {
    const board = boardFrom(['', '', '#R.....#']);
    expect(boardText(shiftRowRight(board, 2))[2]).toBe('##R.....');
  });
});

describe('줄 완성 판정', () => {
  it('이 칸을 채우면 줄이 완성되는지', () => {
    const board = boardFrom(['.#######']);
    expect(wouldCompleteLine(board, 0)).toBe(true);
    expect(wouldCompleteLine(board, 8)).toBe(false);
  });
});
