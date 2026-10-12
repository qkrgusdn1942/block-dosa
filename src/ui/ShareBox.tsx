import { useState } from 'react';

type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** 휴대폰 공유창 → 안 되면 클립보드 복사 → 그것도 안 되면 옛날 방식 복사 */
async function shareResult(text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // 공유창을 못 띄우는 환경(카톡 내장 브라우저 등)이면 복사로 넘어간다
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return legacyCopy(text) ? 'copied' : 'failed';
  }
}

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

const MESSAGES: Record<ShareOutcome, string | null> = {
  shared: '공유했어요',
  copied: '복사했어요 · 카톡에 붙여넣으세요',
  cancelled: null,
  failed: '공유가 안 돼요 · 위 글을 길게 눌러 복사해 주세요',
};

/** 결과 텍스트 미리보기 + 공유 버튼 → docs/10-social.md */
export function ShareBox({ text }: { text: string }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="share-box">
      <pre className="share-text">{text}</pre>
      <button className="share-button" onClick={async () => setMessage(MESSAGES[await shareResult(text)])}>
        📤 결과 공유
      </button>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
