import { describe, expect, it } from 'vitest';
import { NO_PERKS } from '../src/content/upgrades';
import { createRun, type RunState } from '../src/core/run';
import { shareText } from '../src/core/share';
import { talisman } from './helpers';

function finished(overrides: Partial<RunState>, mode: RunState['mode'] = 'normal'): RunState {
  const run = createRun(mode === 'daily' ? 'D20261012' : 'K7Q2MX', { mode });
  return {
    ...run,
    phase: 'over',
    stats: { ...run.stats, bestClear: 41_000, bestPattern: 'triple' },
    history: ['clear', 'clear', 'close', 'clear', 'fail'],
    talismans: [talisman('lamp', 1), talisman('tiger', 2)],
    ...overrides,
  };
}

describe('결과 공유 텍스트', () => {
  it('오늘의 판 완주: 날짜, 끝판 점수, 판 결과, 부적, 코드', () => {
    const base = finished({}, 'daily');
    const run: RunState = {
      ...base,
      official: true,
      phase: 'ending',
      ante: 3,
      stageKind: 'finale',
      history: ['clear', 'clear', 'close', 'clear', 'clear', 'clear', 'clear', 'close', 'clear'],
      stage: { ...base.stage, kind: 'finale', score: 234_000 },
    };
    expect(shareText(run)).toBe(
      [
        '🧱 블록 도사 · 오늘의 판 10/12',
        '⛰️ 3고개 완주 · 끝판 23.4만',
        '💥 최고 한 방 4.1만 (세 줄)',
        '🟩🟩🟨 🟩🟩🟩 🟩🟨🟩',
        '🏮🐯',
        '코드 D20261012',
      ].join('\n'),
    );
  });

  it('오늘의 판 연습은 표시가 붙는다', () => {
    expect(shareText(finished({ official: false }, 'daily')).split('\n')[0]).toContain('(연습)');
  });

  it('일반 런: 멈춘 곳과 코드, 수련을 썼으면 표시', () => {
    const run = finished({ ante: 2, stageKind: 'big' });
    const text = shareText(run).split('\n');
    expect(text[0]).toBe('🧱 블록 도사');
    expect(text[1]).toBe('⛰️ 고개 2 · 판 2에서 멈춤');
    expect(text[3]).toBe('🟩🟩🟨 🟩🟥');
    expect(text.at(-1)).toBe('코드 K7Q2MX');
    const trained = { ...run, perks: { ...NO_PERKS, startGold: 2 } };
    expect(shareText(trained).split('\n').at(-1)).toBe('코드 K7Q2MX (수련 적용)');
  });

  it('끝없는 모드에서 멈춤, 기본이 아닌 가방·난이도는 한 줄 더', () => {
    const run = finished({ endless: true, ante: 11, stageKind: 'big', bagType: 'chaos', stake: 3 });
    expect(shareText(run).split('\n').slice(0, 3)).toEqual([
      '🧱 블록 도사',
      '🌪️ 혼돈 가방 · 난이도 3 수행자',
      '⛰️ 여덟 고개 완주 → ♾️ 고개 11 · 판 2에서 멈춤',
    ]);
  });

  it('코드 도전 런은 도전장 표시', () => {
    expect(shareText(finished({}, 'seed')).split('\n')[0]).toBe('🧱 블록 도사 · 도전장');
  });
});
