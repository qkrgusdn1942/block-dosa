import { useState } from 'react';
import { findCode, formatDailyDate, type ParsedCode } from '../core/daily';
import { Sheet } from './Sheet';

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
        placeholder="예: K7Q2MX 또는 D20261012"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        rows={2}
      />
      {value.trim() && !parsed && <p className="hint">코드를 확인해 주세요 (6자리, 또는 D와 날짜 8자리)</p>}
      {parsed && (
        <p className="status-line">
          {parsed.mode === 'daily'
            ? `${formatDailyDate(parsed.date)} 오늘의 판 (고개 3 + 끝판)`
            : `${parsed.seed} · 처음부터 여덟 고개`}
        </p>
      )}
      <div className="sheet-actions">
        <button className="primary" disabled={!parsed} onClick={() => parsed && onStart(parsed)}>
          시작
        </button>
        <button onClick={onClose}>취소</button>
      </div>
    </Sheet>
  );
}
