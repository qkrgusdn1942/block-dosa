import { useSyncExternalStore } from 'react';

/** 홈 화면에 추가 (PWA 설치) → docs/12-tech.md */

/** 크롬·삼성 인터넷이 설치할 수 있을 때 주는 이벤트 (표준 타입에 아직 없음) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** 앱이 그려지기 전에 이벤트가 올 수 있어서 main.tsx에서 바로 듣는다 */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** 아이폰·아이패드 (아이패드 사파리는 맥으로 보이므로 터치로 가린다) */
const ios = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export interface InstallState {
  /** 버튼 하나로 설치 창을 띄울 수 있다 */
  canPrompt: boolean;
  /** 아이폰: 사파리 공유 버튼으로 직접 추가하는 방법을 알려줘야 한다 */
  needsIosHint: boolean;
  prompt: () => void;
}

export function useInstall(): InstallState {
  const event = useSyncExternalStore(subscribe, () => deferred, () => null);
  const installed = standalone();
  return {
    canPrompt: event !== null && !installed,
    needsIosHint: event === null && !installed && ios(),
    prompt: () => {
      if (!deferred) return;
      const pending = deferred;
      deferred = null;
      notify();
      void pending.prompt().catch(() => {
        // 이미 한 번 띄웠거나 브라우저가 막으면 조용히 넘어간다
      });
    },
  };
}
