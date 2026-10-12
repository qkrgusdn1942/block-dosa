import { useState } from 'react';
import type { Settings } from '../core/profile';
import { saveStore, type RawStorage } from '../save/storage';
import { decodeSave, encodeSave } from '../save/transfer';
import { shareResult } from './ShareBox';
import { Sheet } from './Sheet';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  /** 세이브 코드를 넣은 뒤: 프로필과 런을 다시 읽는다 */
  onImported: () => void;
  onClose: () => void;
}

/** 설정: 숫자 표기, 왼손 모드, 세이브 코드 → docs/11-ui-ux.md */
export function SettingsSheet({ settings, onChange, onImported, onClose }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<RawStorage | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const choice = (on: boolean, label: string, onClick: () => void) => (
    <button className={on ? 'on' : ''} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );

  const read = async () => {
    const data = await decodeSave(input);
    setPending(data);
    setMessage(data ? null : '코드를 읽을 수 없어요. BDS1.로 시작하는 코드를 통째로 붙여넣어 주세요.');
  };

  const apply = () => {
    if (pending && saveStore.importRaw(pending)) {
      setPending(null);
      setInput('');
      setMessage('옮겼어요!');
      onImported();
    } else {
      setMessage('넣지 못했어요. 코드를 다시 확인해 주세요.');
    }
  };

  return (
    <Sheet title="설정" onClose={onClose}>
      <h3>숫자 표기</h3>
      <div className="toggle-row">
        {choice(settings.numberStyle === 'korean', '한국식 · 1.23억', () => onChange({ ...settings, numberStyle: 'korean' }))}
        {choice(settings.numberStyle === 'exponent', '지수 · 1.23e8', () => onChange({ ...settings, numberStyle: 'exponent' }))}
      </div>

      <h3>버튼 위치</h3>
      <div className="toggle-row">
        {choice(!settings.leftHand, '오른손', () => onChange({ ...settings, leftHand: false }))}
        {choice(settings.leftHand, '왼손 (아래 버튼 반대로)', () => onChange({ ...settings, leftHand: true }))}
      </div>

      <h3>세이브 코드</h3>
      <p className="hint">
        기기를 바꾸거나 기록이 지워질 때를 대비해 코드로 옮겨요. 공덕·수련·기록·도감과 진행 중인 런이 모두 들어가요.
      </p>
      {code ? (
        <>
          <textarea className="code-input save-code" readOnly value={code} rows={3} onFocus={(e) => e.target.select()} />
          <div className="sheet-actions inline">
            <button
              onClick={async () => {
                const outcome = await shareResult(code);
                setMessage(outcome === 'failed' ? '위 코드를 길게 눌러 복사해 주세요' : outcome === 'cancelled' ? null : '코드를 보냈어요');
              }}
            >
              📤 코드 보내기·복사
            </button>
          </div>
        </>
      ) : (
        <div className="sheet-actions inline">
          <button onClick={async () => setCode(await encodeSave(saveStore.exportRaw()))}>세이브 코드 만들기</button>
        </div>
      )}

      <textarea
        className="code-input save-code"
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setPending(null);
        }}
        placeholder="다른 기기에서 만든 세이브 코드 붙여넣기"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        rows={2}
      />
      {pending ? (
        <>
          <p className="status-line">지금 이 기기의 공덕·기록·진행 중인 런을 코드의 것으로 덮어써요.</p>
          <div className="sheet-actions inline">
            <button className="primary" onClick={apply}>
              덮어쓰기
            </button>
            <button onClick={() => setPending(null)}>취소</button>
          </div>
        </>
      ) : (
        <div className="sheet-actions inline">
          <button disabled={!input.trim()} onClick={read}>
            세이브 코드 넣기
          </button>
        </div>
      )}
      {message && <p className="hint">{message}</p>}

      <div className="sheet-actions">
        <button className="primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}
