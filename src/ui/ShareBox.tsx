import { useState } from 'react';
import { renderResultImage } from './resultImage';

type ShareOutcome = 'shared' | 'copied' | 'saved' | 'cancelled' | 'failed';

/** 휴대폰 공유창 → 안 되면 클립보드 복사 → 그것도 안 되면 옛날 방식 복사 */
export async function shareResult(text: string): Promise<ShareOutcome> {
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

/** 결과 카드 이미지: 공유창이 파일을 받으면 공유, 아니면 이미지로 저장 */
async function shareImage(text: string): Promise<ShareOutcome> {
  const blob = await renderResultImage(text);
  if (!blob) return 'failed';
  const file = new File([blob], 'block-dosa.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'block-dosa.png';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

const MESSAGES: Record<ShareOutcome, string | null> = {
  shared: '공유했어요',
  copied: '복사했어요 · 카톡에 붙여넣으세요',
  saved: '이미지를 저장했어요',
  cancelled: null,
  failed: '공유가 안 돼요 · 위 글을 길게 눌러 복사해 주세요',
};

/** 결과 텍스트 미리보기 + 공유 버튼 (image면 이미지 카드 버튼도) → docs/10-social.md */
export function ShareBox({ text, image = false }: { text: string; image?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="share-box">
      <pre className="share-text">{text}</pre>
      <div className="share-buttons">
        <button className="share-button" onClick={async () => setMessage(MESSAGES[await shareResult(text)])}>
          📤 결과 공유
        </button>
        {image && (
          <button className="share-button image" onClick={async () => setMessage(MESSAGES[await shareImage(text)])}>
            🖼️ 이미지로
          </button>
        )}
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
