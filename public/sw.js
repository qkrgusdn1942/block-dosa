/**
 * 블록 도사 서비스 워커 → docs/12-tech.md
 * - 페이지(index.html)는 네트워크 먼저: 새로 배포하면 다음에 열 때 바로 바뀐다. 오프라인이면 캐시로
 * - 나머지(빌드된 js·css·아이콘)는 캐시 먼저: 파일 이름에 해시가 붙어 있어서 내용이 바뀌면 이름도 바뀐다
 * 이 파일을 고치면 CACHE 이름을 올려서 예전 캐시를 지운다
 */
const CACHE = 'block-dosa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function remember(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => remember(request, response))
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('./'))),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => remember(request, response))));
});
