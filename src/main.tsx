import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isOldSite } from './save/move';
import { App } from './ui/App';
import { listenForInstall } from './ui/install';
import { MovedScreen } from './ui/MovedScreen';
import './ui/styles.css';

listenForInstall();

// 배포본에서만: 한 번 열면 오프라인에서도 열리고, 홈 화면에 추가할 수 있다 → docs/12-tech.md
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 서비스 워커가 막힌 환경(비공개 모드 등)이어도 게임은 그대로 된다
    });
  });
}

// 예전 주소에서는 이사 안내만 띄운다 (개발 서버에서는 ?moved 로 미리 본다) → docs/12-tech.md
const moved =
  isOldSite(window.location.hostname) || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('moved'));

createRoot(document.getElementById('root')!).render(<StrictMode>{moved ? <MovedScreen /> : <App />}</StrictMode>);
