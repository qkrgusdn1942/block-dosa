/**
 * 주소 이사 → docs/12-tech.md
 * 브라우저 저장은 주소마다 따로라서, 예전 주소에서 세이브 코드를 만들어 새 주소의 #import= 로 넘긴다.
 * 코드는 # 뒤에 붙여서 서버로 보내지지 않는다
 */

import { GAME_URL } from '../content/site';

export const NEW_SITE = `${GAME_URL}/`;

/** 예전 주소에서 이사 안내를 띄운다 (새 주소가 잘 뜨는 걸 확인한 뒤 v1.1.1에서 켬) */
export const MOVE_NOTICE = true;

/** 예전 주소 (GitHub Pages) */
const OLD_HOSTS: readonly string[] = ['qkrgusdn1942.github.io'];

const IMPORT_KEY = '#import=';

/** 이 주소에서 이사 안내를 띄울까 */
export const isOldSite = (hostname: string) => MOVE_NOTICE && OLD_HOSTS.includes(hostname);

/** 새 주소로 가는 링크. 세이브 코드가 있으면 같이 넘긴다 */
export const moveUrl = (code: string | null) => (code ? `${NEW_SITE}${IMPORT_KEY}${code}` : NEW_SITE);

/** 주소의 #import= 뒤에 붙은 세이브 코드 */
export function importCodeOf(hash: string): string | null {
  return hash.startsWith(IMPORT_KEY) ? hash.slice(IMPORT_KEY.length) || null : null;
}
