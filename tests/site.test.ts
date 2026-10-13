import { describe, expect, it } from 'vitest';
import { REGULAR_BOSSES } from '../src/content/bosses';
import { CONTACT_EMAIL, HUB_URL } from '../src/content/site';
import { NAVER_SITE_VERIFICATION, PAGES, REGULAR_BOSS_MULT, renderSite } from '../site/pages';

/** 소개 홈 gaon.dev: 깨진 링크·빠진 페이지 없이 */
describe('소개 홈', () => {
  const files = renderSite();
  const fileOf = (path: string) => (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));
  /** site/build.mjs가 복사해 넣는 파일 */
  const copied = new Set(['style.css', 'og.png', 'icons/icon.svg', 'icons/apple-touch-icon.png']);

  it('페이지마다 파일이 있고, 404·robots·사이트맵도 만든다', () => {
    for (const page of PAGES) expect(files[fileOf(page.path)]).toBeDefined();
    expect(files['404.html']).toContain('페이지를 찾을 수 없어요');
    expect(files['robots.txt']).toContain(`Sitemap: ${HUB_URL}/sitemap.xml`);
    // 네이버 소유 확인은 첫 페이지 <head>에서 읽는다
    expect(files['index.html']).toContain(`<meta name="naver-site-verification" content="${NAVER_SITE_VERIFICATION}"/>`);
  });

  it('사이트 안 링크는 모두 있는 페이지·파일로 간다', () => {
    for (const [name, html] of Object.entries(files)) {
      if (!name.endsWith('.html')) continue;
      for (const [, href] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
        const target = fileOf(href);
        expect(files[target] !== undefined || copied.has(target), `${name} → ${href}`).toBe(true);
      }
    }
  });

  it('사이트맵에 모든 페이지가 한 번씩, 제목·설명·대표 주소가 페이지마다 따로', () => {
    for (const page of PAGES) {
      expect(files['sitemap.xml'].split(`<loc>${HUB_URL}${page.path}</loc>`)).toHaveLength(2);
      const html = files[fileOf(page.path)];
      expect(html).toContain(`<link rel="canonical" href="${HUB_URL}${page.path}"/>`);
      expect(page.description.length).toBeGreaterThan(10);
    }
    expect(new Set(PAGES.map((page) => page.title)).size).toBe(PAGES.length);
  });

  it('개인정보처리방침: 연락처와 광고 쿠키 안내', () => {
    const html = files['privacy/index.html'];
    expect(html).toContain(CONTACT_EMAIL);
    expect(html).toContain('쿠키');
    expect(html).toContain('https://adssettings.google.com');
  });

  it('목표 점수 표의 요괴 판 배율: 보통 요괴는 모두 같다', () => {
    expect(REGULAR_BOSSES.every((boss) => boss.targetMult === REGULAR_BOSS_MULT)).toBe(true);
  });
});
