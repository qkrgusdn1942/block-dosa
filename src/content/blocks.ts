/** 블록 모양 데이터. 이름은 한글 자모 모양에서 따왔다 → docs/05-blocks-and-cells.md */

export type ShapeId =
  | 'dot'
  | 'bar2'
  | 'bar3'
  | 'bar4'
  | 'bar5'
  | 'square'
  | 'bigSquare'
  | 'rect'
  | 'smallL'
  | 'l'
  | 'bigL'
  | 't'
  | 'zigzag'
  | 'u'
  | 'plus';

/** 색과 부적 판정에 쓰는 분류. 예: 짚신 = 막대 블록으로 클리어 */
export type ShapeKind = 'dot' | 'bar' | 'square' | 'corner' | 't' | 'zigzag';

export interface ShapeDef {
  id: ShapeId;
  name: string;
  kind: ShapeKind;
  /** 기본 방향. '#' = 칸, '.' = 빈칸 */
  pattern: readonly string[];
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
  dot: { id: 'dot', name: '점', kind: 'dot', pattern: ['#'] },
  bar2: { id: 'bar2', name: '막대2', kind: 'bar', pattern: ['##'] },
  bar3: { id: 'bar3', name: '막대3', kind: 'bar', pattern: ['###'] },
  bar4: { id: 'bar4', name: '막대4', kind: 'bar', pattern: ['####'] },
  bar5: { id: 'bar5', name: '막대5', kind: 'bar', pattern: ['#####'] },
  square: { id: 'square', name: 'ㅁ', kind: 'square', pattern: ['##', '##'] },
  bigSquare: { id: 'bigSquare', name: '큰ㅁ', kind: 'square', pattern: ['###', '###', '###'] },
  rect: { id: 'rect', name: '직사각', kind: 'square', pattern: ['###', '###'] },
  smallL: { id: 'smallL', name: '작은ㄱ', kind: 'corner', pattern: ['##', '.#'] },
  l: { id: 'l', name: 'ㄱ', kind: 'corner', pattern: ['###', '..#'] },
  bigL: { id: 'bigL', name: '큰ㄱ', kind: 'corner', pattern: ['###', '..#', '..#'] },
  t: { id: 't', name: 'ㅗ', kind: 't', pattern: ['.#.', '###'] },
  zigzag: { id: 'zigzag', name: '번개', kind: 'zigzag', pattern: ['.##', '##.'] },
  u: { id: 'u', name: 'ㄷ', kind: 'corner', pattern: ['##', '#.', '##'] },
  plus: { id: 'plus', name: '더하기', kind: 't', pattern: ['.#.', '###', '.#.'] },
};

export const ALL_SHAPES = Object.keys(SHAPES) as ShapeId[];

/** 장터 블록 팩에서 나오는 모양. ㄷ, 더하기는 아직 👹 도깨비 전용 */
export const PACK_SHAPES: readonly ShapeId[] = ALL_SHAPES.filter((id) => id !== 'u' && id !== 'plus');

/** 기본 가방 18개 */
export const STARTING_BAG: ReadonlyArray<readonly [ShapeId, number]> = [
  ['dot', 1],
  ['bar2', 2],
  ['bar3', 2],
  ['bar4', 2],
  ['bar5', 1],
  ['square', 2],
  ['bigSquare', 1],
  ['smallL', 2],
  ['l', 2],
  ['t', 2],
  ['zigzag', 1],
];
