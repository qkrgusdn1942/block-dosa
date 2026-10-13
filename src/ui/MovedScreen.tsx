import { useState } from 'react';
import { moveUrl, NEW_SITE } from '../save/move';
import { saveStore } from '../save/storage';
import { encodeSave } from '../save/transfer';

/** 예전 주소에서 여는 화면: 기록을 세이브 코드로 만들어 새 주소로 넘긴다 → docs/11-ui-ux.md */
export function MovedScreen() {
  const [busy, setBusy] = useState(false);
  const raw = saveStore.exportRaw();
  const hasRecord = raw.profile !== null || raw.run !== null;
  const address = NEW_SITE.replace(/^https:\/\//, '').replace(/\/$/, '');

  const go = async (withRecord: boolean) => {
    setBusy(true);
    const code = withRecord ? await encodeSave(raw) : null;
    window.location.href = moveUrl(code);
  };

  return (
    <div className="screen title-screen moved">
      <div className="title-head">
        <div className="title-emoji">🧱</div>
        <h1>블록 도사가 이사했어요</h1>
        <p>
          새 주소 <b>{address}</b>
        </p>
      </div>
      <div className="title-actions">
        {hasRecord ? (
          <>
            <button className="title-button primary" disabled={busy} onClick={() => go(true)}>
              기록 가지고 새 주소로
              <small>공덕·수련·도감·진행 중인 런을 그대로 옮겨요</small>
            </button>
            <button className="title-button" disabled={busy} onClick={() => go(false)}>
              기록 없이 새 주소로
            </button>
          </>
        ) : (
          <button className="title-button primary" onClick={() => go(false)}>
            새 주소로 가기
          </button>
        )}
      </div>
      <p className="hint moved-hint">홈 화면에 추가해 두었다면, 새 주소에서 한 번 더 추가해 주세요.</p>
    </div>
  );
}
