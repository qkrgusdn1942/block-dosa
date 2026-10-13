// 소개 홈(gaon.dev) 만들기 → docs/12-tech.md
// pages.tsx는 게임 데이터(src/content)를 그대로 쓰므로 Vite로 읽어서 정적 파일로 쓴다 (npm run site)
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site/dist');

/** 게임 쪽 그림을 같이 쓴다 */
const COPIES = [
  ['site/style.css', 'style.css'],
  ['public/og.png', 'og.png'],
  ['public/icons/icon.svg', 'icons/icon.svg'],
  ['public/icons/apple-touch-icon.png', 'icons/apple-touch-icon.png'],
];

async function put(file, write) {
  await mkdir(dirname(file), { recursive: true });
  await write(file);
}

const vite = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
});
try {
  const { renderSite } = await vite.ssrLoadModule('/site/pages.tsx');
  await rm(out, { recursive: true, force: true });
  const files = renderSite();
  for (const [name, content] of Object.entries(files)) {
    await put(join(out, name), (file) => writeFile(file, content));
  }
  for (const [from, to] of COPIES) {
    await put(join(out, to), (file) => copyFile(join(root, from), file));
  }
  console.log(`site/dist: 만든 파일 ${Object.keys(files).length}개, 복사한 그림·스타일 ${COPIES.length}개`);
} finally {
  await vite.close();
}
