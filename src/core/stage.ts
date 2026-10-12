import {
  BASE_DISCARDS,
  BASE_HANDS,
  BOARD_SIZE,
  GEM_GOLD,
  HAND_SIZE,
  MAX_BONUS_CELLS,
  ROCKS_BY_ANTE,
  type PatternId,
  type PatternLevels,
  type StageKind,
  type StageRules,
} from '../content/balance';
import { SHAPES, type ShapeId, type ShapeKind } from '../content/blocks';
import { BOSSES, type BossDef, type BossId } from '../content/bosses';
import type { Consumable } from '../content/consumables';
import type { TalismanInstance } from '../content/talismans';
import {
  canPlace,
  clearLines,
  emptyBoard,
  emptyCells,
  filledCount,
  fitsAnywhere,
  fullLines,
  isBoardEmpty,
  lineCount,
  placeCells,
  type Board,
  type ClearedCell,
} from './board';
import { growOnLines, passiveTotals, talismanModifiers } from './effects';
import { levelUp, moveTalisman, replaceAt } from './loadout';
import { extent, orientations, rotatePiece, rotations, type Piece } from './pieces';
import { Rng } from './rng';
import { scoreClear, type ScoreResult } from './scoring';

/** 판 하나의 진행 → docs/01-core-rules.md */

export type BonusKind = 'gem' | 'star';
export type StageStatus = 'playing' | 'cleared' | 'failed';
export type FailReason = 'hands' | 'stuck';

export interface BagEntry {
  id: number;
  shape: ShapeId;
}

export interface ClearEvent {
  /** 판 안에서 1부터 증가 (연출용 키) */
  id: number;
  result: ScoreResult;
  cleared: ClearedCell[];
  gems: number;
  stars: number;
  /** 🐍 이무기가 줄을 밀어서 지워졌는지 */
  shifted: boolean;
}

export interface StageStats {
  placed: number;
  clears: number;
  lines: number;
  best: number;
  /** 최고 한 방을 낸 족보 */
  bestPattern: PatternId | null;
  perfects: number;
}

/** 런이 판을 만들 때 넘겨주는 것 */
export interface StageSetup {
  seed: string;
  ante: number;
  kind: StageKind;
  boss: BossId | null;
  target: number;
  bag: readonly BagEntry[];
  talismans: readonly TalismanInstance[];
  consumables: readonly Consumable[];
  levels: PatternLevels;
  /** 수련으로 늘어난 판마다 핸드·버리기 */
  extraHands: number;
  extraDiscards: number;
  /** 수련 "기사회생"이 이번 런에 남아 있는지 */
  rescue: boolean;
  /** 끝판: 목표 없이 핸드를 다 쓸 때까지 점수 내기 */
  scoreAttack: boolean;
}

/** 화면에 잠깐 띄울 알림 (기사회생 등) */
export interface StageToast {
  id: number;
  text: string;
}

export interface StageState {
  seed: string;
  ante: number;
  kind: StageKind;
  boss: BossId | null;
  rules: StageRules;
  board: Board;
  /** 빈칸 위 보너스 칸 (칸 번호 → 종류). 덮은 블록이 지워지면 발동하고 사라진다 */
  bonus: Readonly<Record<number, BonusKind>>;
  bag: readonly BagEntry[];
  /** 이번 섞기에서 아직 안 나온 블록 (가방 id) */
  pile: readonly number[];
  /** 랜덤 스트림 상태 → docs/12-tech.md */
  bagRng: number;
  bossRng: number;
  luckRng: number;
  hand: ReadonlyArray<Piece | null>;
  /** 진행 중인 핸드 번호 (1부터) */
  handNumber: number;
  discardsLeft: number;
  streak: number;
  clearedThisHand: boolean;
  score: number;
  status: StageStatus;
  failReason: FailReason | null;
  lastClear: ClearEvent | null;
  stats: StageStats;
  nextUid: number;
  /** 판 동안 쓰는 부적·소모품·족보 레벨. 판이 끝나면 런으로 돌아간다 */
  talismans: readonly TalismanInstance[];
  /** 🦊 구미호가 봉인한 부적 */
  sealedUid: number | null;
  consumables: readonly Consumable[];
  levels: PatternLevels;
  /** 🌀 바람개비: 손의 블록을 돌릴 수 있음 */
  rotation: boolean;
  /** 판 중에 얻은 골드 (보석 칸). 판 결과에서 받는다 */
  goldEarned: number;
  /** 🐍 이무기: 이번 핸드가 끝나면 밀릴 줄 */
  shiftRow: number | null;
  /** 🙏 기사회생을 쓸 수 있음 / 이번 판에 썼음 */
  rescueReady: boolean;
  rescued: boolean;
  toast: StageToast | null;
  /** 끝판: 목표가 없고, 핸드를 다 쓰거나 막히면 그때까지의 점수로 끝난다 */
  scoreAttack: boolean;
}

export type StageAction =
  | { type: 'place'; slot: number; row: number; col: number }
  | { type: 'discard'; slot: number }
  | { type: 'rotate'; slot: number }
  | { type: 'useConsumable'; index: number; slot?: number; cell?: number }
  | { type: 'moveTalisman'; uid: number; dir: -1 | 1 }
  | { type: 'giveUp' };

export function createStage(setup: StageSetup): StageState {
  const { seed, ante, kind } = setup;
  // 스트림 = (시드, 용도, 고개, 판). 한 곳에서 랜덤을 많이 써도 다른 곳 결과가 밀리지 않는다
  const stream = (name: string) => Rng.fromSeed(seed, name, ante, kind);
  const bagRng = stream('bag');
  const pile = bagRng.shuffle(setup.bag.map((entry) => entry.id));

  let stage: StageState = {
    seed,
    ante,
    kind,
    boss: setup.boss,
    rules: { hands: BASE_HANDS + setup.extraHands, discards: BASE_DISCARDS, target: setup.target },
    board: emptyBoard(),
    bonus: {},
    bag: setup.bag,
    pile,
    bagRng: bagRng.state,
    bossRng: stream('boss').state,
    luckRng: stream('luck').state,
    hand: [],
    handNumber: 1,
    discardsLeft: BASE_DISCARDS,
    streak: 0,
    clearedThisHand: false,
    score: 0,
    status: 'playing',
    failReason: null,
    lastClear: null,
    stats: { placed: 0, clears: 0, lines: 0, best: 0, bestPattern: null, perfects: 0 },
    nextUid: 1,
    talismans: setup.talismans,
    sealedUid: null,
    consumables: setup.consumables,
    levels: setup.levels,
    rotation: false,
    goldEarned: 0,
    shiftRow: null,
    rescueReady: setup.rescue,
    rescued: false,
    toast: null,
    scoreAttack: setup.scoreAttack,
  };

  // 1. 요괴 (물귀신의 물, 구미호의 봉인)
  stage = runBossHook(stage, 'onStageStart');

  // 2. 바위 (일반 판만) 3. 보너스 칸
  const boardRng = stream('board');
  const [smallRocks, bigRocks] = ROCKS_BY_ANTE[Math.min(ante, ROCKS_BY_ANTE.length) - 1];
  const rocks = kind === 'small' ? smallRocks : kind === 'big' ? bigRocks : 0;
  const board = placeRocks(stage.board, rocks, boardRng);
  const bonus = placeBonusCells(board, boardRng);

  // 4. 장착만 해도 적용되는 부적 (봉인 반영)과 수련
  const passive = passiveTotals(stage.talismans, stage.sealedUid);
  const discards = BASE_DISCARDS + passive.discards + setup.extraDiscards;
  stage = {
    ...stage,
    board,
    bonus,
    rotation: passive.rotation,
    rules: { ...stage.rules, discards },
    discardsLeft: discards,
  };

  // 5. 첫 핸드
  return drawHand(stage);
}

function runBossHook(stage: StageState, hook: 'onStageStart' | 'onHandDraw' | 'onHandEnd'): StageState {
  const boss: BossDef | null = stage.boss ? BOSSES[stage.boss] : null;
  const run = boss?.[hook];
  if (!run) return stage;
  const rng = new Rng(stage.bossRng);
  const next = run(stage, rng);
  return { ...next, bossRng: rng.state };
}

const RANGE = Array.from({ length: BOARD_SIZE }, (_, i) => i);
const rowOf = (index: number) => Math.floor(index / BOARD_SIZE);
const colOf = (index: number) => index % BOARD_SIZE;
/** 블록이나 바위 (물·빈칸 아님) */
const isSolid = (cell: Board[number]) => cell !== null && cell.kind !== 'water';

/** 같은 가로·세로줄이거나 붙어 있으면(대각선 포함) 같이 둘 수 없다 → 시작부터 막히는 판 방지 */
function rocksConflict(a: number, b: number): boolean {
  const sameLine = rowOf(a) === rowOf(b) || colOf(a) === colOf(b);
  const touching = Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
  return sameLine || touching;
}

function placeRocks(board: Board, count: number, rng: Rng): Board {
  let next = board;
  const placed: number[] = [];
  for (let i = 0; i < count; i++) {
    const candidates = emptyCells(next).filter((index) => placed.every((other) => !rocksConflict(index, other)));
    if (candidates.length === 0) break;
    const index = candidates[rng.int(candidates.length)];
    const copy = next.slice();
    copy[index] = { kind: 'rock', cracked: false };
    next = copy;
    placed.push(index);
  }
  return next;
}

function placeBonusCells(board: Board, rng: Rng): Record<number, BonusKind> {
  const bonus: Record<number, BonusKind> = {};
  const count = rng.int(MAX_BONUS_CELLS + 1);
  for (let i = 0; i < count; i++) {
    const candidates = emptyCells(board).filter((index) => bonus[index] === undefined);
    if (candidates.length === 0) break;
    bonus[candidates[rng.int(candidates.length)]] = rng.next() < 0.5 ? 'gem' : 'star';
  }
  return bonus;
}

/** 아직 시작하지 않은 핸드 수 (판 결과에서 골드로 바뀜) */
export const handsLeft = (stage: StageState) => stage.rules.hands - stage.handNumber;

/** 이 블록을 놓을 자리가 있는가 (바람개비가 있으면 돌린 방향도 본다) */
export function canFit(stage: StageState, piece: Piece): boolean {
  const variants = stage.rotation ? rotations(piece.cells) : [piece.cells];
  return variants.some((cells) => fitsAnywhere(stage.board, cells));
}

/** 손에 남은 블록을 어디에도 못 놓는가 */
export function isStuck(stage: StageState): boolean {
  const pieces = stage.hand.filter((piece): piece is Piece => piece !== null);
  return pieces.length > 0 && pieces.every((piece) => !canFit(stage, piece));
}

/** 막혔을 때 쓸 수 있는 소모품(망치, 부채)이 있는가 */
export const hasRescue = (stage: StageState) =>
  stage.consumables.some((item) => item.kind === 'hammer' || item.kind === 'fan');

/** 가방에서 1개 뽑기. 다 떨어지면 손에 있는 블록을 뺀 나머지를 다시 섞는다 */
export function drawPiece(
  stage: StageState,
  hand: ReadonlyArray<Piece | null>,
): { stage: StageState; piece: Piece } {
  const rng = new Rng(stage.bagRng);
  let pile = stage.pile;
  if (pile.length === 0) {
    const inHand = new Set(hand.flatMap((piece) => (piece ? [piece.bagId] : [])));
    pile = rng.shuffle(stage.bag.filter((entry) => !inHand.has(entry.id)).map((entry) => entry.id));
  }
  const [bagId, ...rest] = pile;
  const entry = stage.bag.find((b) => b.id === bagId);
  if (!entry) throw new Error('가방에 뽑을 블록이 없습니다');

  const options = orientations(entry.shape);
  const cells = options[rng.int(options.length)];
  const piece: Piece = { uid: stage.nextUid, bagId, shape: entry.shape, cells, ...extent(cells) };
  return { stage: { ...stage, pile: rest, bagRng: rng.state, nextUid: stage.nextUid + 1 }, piece };
}

function drawHand(stage: StageState): StageState {
  let current = stage;
  const hand: Piece[] = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    const drawn = drawPiece(current, hand);
    current = drawn.stage;
    hand.push(drawn.piece);
  }
  return runBossHook({ ...current, hand }, 'onHandDraw');
}

function fail(stage: StageState, reason: FailReason): StageState {
  // 끝판은 실패가 없다: 핸드를 다 쓰거나 막히면 그때까지의 점수로 마친다
  if (stage.scoreAttack) return { ...stage, status: 'cleared' };
  return { ...stage, status: 'failed', failReason: reason };
}

/** 🙏 수련 "기사회생": 가장 많이 찬 줄 2개를 비운다 (점수 없음, 물은 그대로) */
function secondWind(stage: StageState): StageState {
  const rng = new Rng(stage.luckRng);
  const lines = rng
    .shuffle([
      ...RANGE.map((r) => RANGE.map((c) => r * BOARD_SIZE + c)),
      ...RANGE.map((c) => RANGE.map((r) => r * BOARD_SIZE + c)),
    ])
    .map((cells) => ({ cells, filled: cells.filter((i) => isSolid(stage.board[i])).length }))
    .filter((line) => line.filled > 0)
    // 같은 개수끼리는 섞은 순서 그대로 (안정 정렬)
    .sort((a, b) => b.filled - a.filled)
    .slice(0, 2);
  const board = stage.board.slice();
  for (const line of lines) {
    for (const i of line.cells) if (isSolid(board[i])) board[i] = null;
  }
  return {
    ...stage,
    board,
    luckRng: rng.state,
    rescueReady: false,
    rescued: true,
    toast: { id: (stage.toast?.id ?? 0) + 1, text: '🙏 기사회생! 가장 많이 찬 두 줄을 비웠어요' },
  };
}

/** 막혀서 판이 끝나는 순간. 기사회생이 남아 있으면 대신 두 줄을 비운다 */
function endStuck(stage: StageState): StageState {
  if (!stage.rescueReady) return fail(stage, 'stuck');
  const saved = secondWind(stage);
  return saved.discardsLeft === 0 && isStuck(saved) && !hasRescue(saved) ? fail(saved, 'stuck') : saved;
}

/** 꽉 찬 줄을 지우고 점수를 매긴다. pieceKind = 줄을 완성한 블록 (이무기가 밀었으면 null) */
function resolveClears(stage: StageState, pieceKind: ShapeKind | null): StageState {
  const lines = fullLines(stage.board);
  const count = lineCount(lines);
  if (count === 0) return stage;

  const filledBefore = filledCount(stage.board);
  const { board, cleared } = clearLines(stage.board, lines);

  // 블록이 덮고 있던 보너스 칸이 함께 지워지면 발동
  const bonusHits = cleared.filter((c) => c.cell.kind === 'block' && stage.bonus[c.index] !== undefined);
  const gems = bonusHits.filter((c) => stage.bonus[c.index] === 'gem').length;
  const stars = bonusHits.length - gems;
  const bonus = { ...stage.bonus };
  for (const hit of bonusHits) delete bonus[hit.index];

  const streak = stage.streak + 1;
  const perfect = isBoardEmpty(board);
  const talismans = growOnLines(stage.talismans, stage.sealedUid, count);
  const luck = new Rng(stage.luckRng);
  const result = scoreClear(
    {
      rows: lines.rows.length,
      cols: lines.cols.length,
      cellCount: cleared.filter((c) => c.cell.kind === 'block').length,
      streak,
      perfect,
      stars,
      pieceKind,
      filledBefore,
      filledAfter: filledCount(board),
      levels: stage.levels,
    },
    talismanModifiers(talismans, stage.sealedUid, luck),
  );

  const next: StageState = {
    ...stage,
    board,
    bonus,
    streak,
    talismans,
    clearedThisHand: true,
    score: stage.score + result.total,
    luckRng: luck.state,
    goldEarned: stage.goldEarned + gems * GEM_GOLD,
    lastClear: { id: (stage.lastClear?.id ?? 0) + 1, result, cleared, gems, stars, shifted: pieceKind === null },
    stats: {
      ...stage.stats,
      clears: stage.stats.clears + 1,
      lines: stage.stats.lines + count,
      best: Math.max(stage.stats.best, result.total),
      bestPattern: result.total > stage.stats.best ? result.pattern : stage.stats.bestPattern,
      perfects: stage.stats.perfects + (perfect ? 1 : 0),
    },
  };
  // 목표를 넘기는 순간 판 클리어
  return !next.scoreAttack && next.score >= next.rules.target ? { ...next, status: 'cleared' } : next;
}

/** 손이 비었으면 다음 핸드로 넘기고, 막혔는데 쓸 수단이 없으면 판을 끝낸다 */
function settle(stage: StageState): StageState {
  let current = stage;
  if (current.hand.every((piece) => piece === null)) {
    // 한 핸드 동안 한 번도 못 지우면 연속이 끊긴다
    current = { ...current, streak: current.clearedThisHand ? current.streak : 0, clearedThisHand: false };
    current = resolveClears(runBossHook(current, 'onHandEnd'), null);
    if (current.status === 'cleared') return current;
    if (current.handNumber >= current.rules.hands) return fail(current, 'hands');
    current = drawHand({ ...current, handNumber: current.handNumber + 1, clearedThisHand: false });
  }
  if (current.discardsLeft === 0 && isStuck(current) && !hasRescue(current)) return endStuck(current);
  return current;
}

function place(stage: StageState, slot: number, row: number, col: number): StageState {
  const piece = stage.hand[slot];
  if (!piece || !canPlace(stage.board, piece.cells, row, col)) return stage;
  const next = resolveClears(
    {
      ...stage,
      board: placeCells(stage.board, piece.cells, row, col, piece.shape),
      hand: replaceAt(stage.hand, slot, null),
      stats: { ...stage.stats, placed: stage.stats.placed + 1 },
    },
    SHAPES[piece.shape].kind,
  );
  return next.status === 'cleared' ? next : settle(next);
}

function discard(stage: StageState, slot: number): StageState {
  if (stage.discardsLeft <= 0 || !stage.hand[slot]) return stage;
  const handWithout = replaceAt(stage.hand, slot, null);
  const drawn = drawPiece(stage, handWithout);
  return settle({
    ...drawn.stage,
    hand: replaceAt(handWithout, slot, drawn.piece),
    discardsLeft: stage.discardsLeft - 1,
  });
}

function rotate(stage: StageState, slot: number): StageState {
  const piece = stage.hand[slot];
  if (!stage.rotation || !piece) return stage;
  return { ...stage, hand: replaceAt(stage.hand, slot, rotatePiece(piece)) };
}

function useConsumable(stage: StageState, index: number, slot?: number, cell?: number): StageState {
  const item = stage.consumables[index];
  if (!item) return stage;
  const consumables = stage.consumables.filter((_, i) => i !== index);
  switch (item.kind) {
    case 'scroll':
      return { ...stage, consumables, levels: levelUp(stage.levels, item.pattern) };
    case 'hammer': {
      const target = cell === undefined ? null : stage.board[cell];
      if (cell === undefined || !target || target.kind === 'water') return stage;
      return settle({ ...stage, consumables, board: replaceAt(stage.board, cell, null) });
    }
    case 'fan': {
      const piece = slot === undefined ? null : stage.hand[slot];
      if (slot === undefined || !piece) return stage;
      return settle({ ...stage, consumables, hand: replaceAt(stage.hand, slot, rotatePiece(piece)) });
    }
  }
}

export function stageReducer(stage: StageState, action: StageAction): StageState {
  if (stage.status !== 'playing') return stage;
  switch (action.type) {
    case 'place':
      return place(stage, action.slot, action.row, action.col);
    case 'discard':
      return discard(stage, action.slot);
    case 'rotate':
      return rotate(stage, action.slot);
    case 'useConsumable':
      return useConsumable(stage, action.index, action.slot, action.cell);
    case 'moveTalisman':
      return { ...stage, talismans: moveTalisman(stage.talismans, action.uid, action.dir) };
    case 'giveUp':
      return isStuck(stage) ? endStuck(stage) : stage;
  }
}
