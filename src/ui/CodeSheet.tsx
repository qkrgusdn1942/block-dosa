import { useState } from 'react';
import { BAG_BY_ID } from '../content/bags';
import { STAKES } from '../content/stakes';
import { findCode, formatDailyDate, formatWeek, weeklyRuleOf, type ParsedCode } from '../core/daily';
import { Sheet } from './Sheet';

function describe(code: ParsedCode): string {
  switch (code.mode) {
    case 'daily':
      return `${formatDailyDate(code.date)} 오늘의 판 (고개 3 + 끝판)`;
    case 'weekly': {
      const rule = weeklyRuleOf(code.date);
      return `${formatWeek(code.date)} 주간 도전 · ${rule.emoji} ${rule.name}`;
    }
    case 'seed': {
      if (!code.setup) return `${code.seed} · 처음부터 여덟 고개`;
      const { bagType, stake } = code.setup;
      return `${code.seed} · 처음부터 여덟 고개 · ${BAG_BY_ID[bagType].name} · 난이도 ${stake} ${STAKES[stake - 1].name}`;
    }
  }
}

/** 친구가 보낸 코드(또는 공유 텍스트 통째)를 붙여넣고 같은 판으로 시작 */
export function CodeSheet({ onStart, onClose }: { onStart: (code: ParsedCode) => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const parsed = findCode(value);

  return (
    <Sheet
      title="코드로 도전"
      sub="친구가 보낸 코드나 결과 글을 통째로 붙여넣으세요. 같은 판으로, 수련 없이 공평하게 시작해요."
      onClose={onClose}
    >
      <textarea
        className="code-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="예: K7Q2MX, K7Q2MX-H3, D20261012, W20261012"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        rows={2}
      />
      {value.trim() && !parsed && (
        <p className="hint">코드를 확인해 주세요 (6자리, 또는 D·W와 날짜 8자리. 주간 도전은 월요일 날짜)</p>
      )}
      {parsed && <p className="status-line">{describe(parsed)}</p>}
      <div className="sheet-actions">
        <button className="primary" disabled={!parsed} onClick={() => parsed && onStart(parsed)}>
          시작
        </button>
        <button onClick={onClose}>취소</button>
      </div>
    </Sheet>
  );
}
