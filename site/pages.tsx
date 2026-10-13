import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ANTE_COUNT,
  ANTE_TARGETS,
  BASE_DISCARDS,
  BASE_HANDS,
  BOARD_SIZE,
  BONUS_WEIGHTS,
  CELL_CHIPS,
  CONSUMABLE_PRICE,
  CONSUMABLE_SLOTS,
  FREE_UNDOS,
  GEM_GOLD,
  GOLD_PER_HAND_LEFT,
  INK_PRICE,
  INTEREST_CAP,
  INTEREST_STEP,
  OBSTACLE_FROM_ANTE,
  PACK_PRICE,
  PATTERN_IDS,
  PATTERNS,
  PERFECT_CLEAR_MULT,
  PIECES_PER_HAND,
  RARITY_NAMES,
  REMOVAL_PRICE,
  REROLL_BASE,
  STAGE_REWARD,
  STAGE_TARGET_MULT,
  STAMP_BLOCKS,
  STAR_MULT,
  TALISMAN_PRICE,
  TALISMAN_SLOTS,
  type Rarity,
} from '../src/content/balance';
import { BAG_TYPES } from '../src/content/bags';
import { BOSSES, FINAL_BOSS, REGULAR_BOSSES } from '../src/content/bosses';
import { CHANGE_LABELS, RELEASES } from '../src/content/changelog';
import { consumableInfo, type Consumable } from '../src/content/consumables';
import { ENHANCEMENT_IDS, ENHANCEMENTS } from '../src/content/enhancements';
import { OBSTACLE_IDS, OBSTACLES } from '../src/content/obstacles';
import { ADSENSE_CLIENT, CONTACT_EMAIL, GAME_URL, HUB_URL } from '../src/content/site';
import { SKIP_REWARD_IDS, SKIP_REWARDS } from '../src/content/skips';
import { STAKES } from '../src/content/stakes';
import { TALISMAN_IDS, TALISMANS } from '../src/content/talismans';
import { UPGRADES } from '../src/content/upgrades';
import { WEEKLY_RULES } from '../src/content/weekly';

/**
 * 소개 홈 gaon.dev → docs/12-tech.md
 * 게임 데이터(src/content)에서 바로 그려서, 수치와 업데이트 소식이 게임과 늘 같다.
 * site/build.mjs가 이 결과를 site/dist에 쓴다
 */

/** 개인정보처리방침 시행일 */
const PRIVACY_DATE = '2026-10-13';
/** 네이버 서치어드바이저 소유 확인 (gaon.dev) */
export const NAVER_SITE_VERIFICATION = 'c00e35e5aacbef4318225dac085379f53c2bb231';

type Nav = 'home' | 'dosa' | 'guide' | 'talismans' | 'yokai' | 'updates' | 'privacy';

interface PageDef {
  path: string;
  nav: Nav;
  title: string;
  description: string;
  body: ReactNode;
}

const NAV: ReadonlyArray<readonly [Nav, string, string]> = [
  ['dosa', '/block-dosa/', '블록 도사'],
  ['guide', '/block-dosa/guide/', '게임 방법'],
  ['talismans', '/block-dosa/talismans/', '부적'],
  ['yokai', '/block-dosa/yokai/', '요괴'],
  ['updates', '/block-dosa/updates/', '업데이트'],
];

const won = (n: number) => n.toLocaleString('ko-KR');
const gameHost = GAME_URL.replace(/^https:\/\//, '');

function Html({ page, children }: { page: PageDef; children: ReactNode }) {
  const url = HUB_URL + page.path;
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={url} />
        <meta name="naver-site-verification" content={NAVER_SITE_VERIFICATION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="가온" />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${HUB_URL}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#f4ecdc" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="stylesheet" href="/style.css" />
        {/* 구글 애드센스 (승인 전에는 광고가 나오지 않는다) */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <header className="top">
          <a className="brand" href="/">
            가온
          </a>
          <nav aria-label="블록 도사">
            {NAV.map(([id, href, label]) => (
              <a key={id} href={href} aria-current={page.nav === id ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="bottom">
          <a href="/privacy/">개인정보처리방침</a> · 문의 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <br />© 2026 가온
        </footer>
      </body>
    </html>
  );
}

function PlayButtons({ guide = true }: { guide?: boolean }) {
  return (
    <div className="actions">
      <a className="button primary" href={GAME_URL}>
        바로 하기
      </a>
      {guide && (
        <a className="button" href="/block-dosa/guide/">
          게임 방법
        </a>
      )}
    </div>
  );
}

/** 이모지 + 이름 + 꼬리표 + 설명 */
function Item({ icon, name, tags = [], children }: { icon: ReactNode; name: string; tags?: string[]; children: ReactNode }) {
  return (
    <li>
      <span className="icon">{icon}</span>
      <div>
        <span className="name">{name}</span>
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
        <p>{children}</p>
      </div>
    </li>
  );
}

// ── 페이지 ──────────────────────────────────────────

const latest = RELEASES[0];
const regularBosses = REGULAR_BOSSES.length;
/** 보통 요괴의 목표 배율 (모두 같다. tests/site.test.ts에서 확인) */
export const REGULAR_BOSS_MULT = REGULAR_BOSSES[0].targetMult;

const home: PageDef = {
  path: '/',
  nav: 'home',
  title: '가온 · 작은 웹 게임과 앱',
  description: '설치 없이 폰 브라우저에서 바로 하는 웹 게임 블록 도사와 작은 앱들을 만드는 가온입니다.',
  body: (
    <>
      <h1>가온</h1>
      <p className="lead">혼자 만드는 작은 웹 게임과 앱을 모아 둔 곳이에요. 설치 없이 폰 브라우저에서 바로 열려요.</p>

      <section className="card">
        <div className="project">
          <img src="/icons/icon.svg" alt="" width={72} height={72} />
          <div>
            <h2>블록 도사</h2>
            <p>
              블록 퍼즐 × 로그라이크. {BOARD_SIZE}×{BOARD_SIZE} 판에 블록을 놓아 줄을 지우고, 부적을 모아 점수를 키워서
              요괴가 막은 여덟 고개를 넘는 게임이에요.
            </p>
          </div>
        </div>
        <div className="actions">
          <a className="button primary" href={GAME_URL}>
            바로 하기
          </a>
          <a className="button" href="/block-dosa/">
            게임 소개
          </a>
        </div>
      </section>

      <h2>새 소식</h2>
      <p>
        <a href="/block-dosa/updates/">
          블록 도사 {latest.version} · {latest.title}
        </a>{' '}
        <span className="note">({latest.date})</span>
      </p>
    </>
  ),
};

const dosa: PageDef = {
  path: '/block-dosa/',
  nav: 'dosa',
  title: '블록 도사 · 블록 퍼즐 로그라이크 웹 게임',
  description: `블록 퍼즐 × 로그라이크 무료 웹 게임. 부적 ${TALISMAN_IDS.length}종, 요괴 ${regularBosses}종을 상대로 여덟 고개를 넘어라. 설치 없이 폰 브라우저에서 바로.`,
  body: (
    <>
      <h1>블록 도사</h1>
      <p className="lead">블록 퍼즐 × 로그라이크. 요괴가 막은 여덟 고개를 블록으로 넘는 무료 웹 게임이에요.</p>
      <PlayButtons />

      <h2>어떤 게임인가요</h2>
      <p>
        블록블라스트처럼 {BOARD_SIZE}×{BOARD_SIZE} 판에 블록을 놓고, 가로나 세로 한 줄을 꽉 채우면 지워지는 퍼즐이에요. 여기에
        발라트로 같은 로그라이크를 섞었어요. 판마다 목표 점수가 있고, 판을 넘길 때마다 장터에서 부적을 사서 점수 계산 자체를
        바꿔 나가요. 고개 {ANTE_COUNT}개를 넘으면 엔딩이에요.
      </p>

      <h2>특징</h2>
      <ul>
        <li>
          점수는 <b>칩 × 배수</b>. 한 번에 지운 줄의 수와 모양(족보)에 따라 점수가 크게 달라져요.
        </li>
        <li>
          <b>부적 {TALISMAN_IDS.length}종</b>을 최대 {TALISMAN_SLOTS}개까지 달아요. 왼쪽부터 차례로 발동해서 순서도
          중요해요.
        </li>
        <li>
          고개마다 세 번째 판은 <b>요괴 판</b>. 요괴 {regularBosses}종이 저마다 다른 규칙으로 막아서요.
        </li>
        <li>
          방해 칸 {OBSTACLE_IDS.length}종, 블록 강화 {ENHANCEMENT_IDS.length}종, 소모품, 가방 {BAG_TYPES.length}종, 난이도{' '}
          {STAKES.length}단계
        </li>
        <li>런이 끝나면 공덕이 쌓이고, 수련으로 다음 런을 조금씩 쉽게 만들어요.</li>
        <li>오늘의 판·주간 도전·코드로 친구와 같은 판에 도전하고 결과를 공유해요.</li>
        <li>설치 없이 폰 브라우저에서 바로. 홈 화면에 추가하면 앱처럼 열리고 인터넷이 없어도 돼요.</li>
        <li>블록을 놓을 때마다 브라우저에 자동 저장돼요. 세이브 코드로 기기를 옮길 수 있어요.</li>
      </ul>

      <h2>처음 하는 법</h2>
      <ol className="steps">
        <li>
          <a href={GAME_URL}>{gameHost}</a>를 열고 <b>새 런</b>을 눌러요.
        </li>
        <li>아래 손에 있는 블록 {PIECES_PER_HAND}개를 판으로 끌어다 놓아요.</li>
        <li>가로나 세로 한 줄을 꽉 채우면 지워지면서 점수가 들어와요.</li>
        <li>목표 점수를 넘기면 판 클리어. 장터에서 부적을 사서 다음 판으로 가요.</li>
      </ol>

      <h2>더 알아보기</h2>
      <ul>
        <li>
          <a href="/block-dosa/guide/">게임 방법</a>: 점수 계산, 장터, 소모품, 수련까지 자세히
        </li>
        <li>
          <a href="/block-dosa/talismans/">부적 도감</a>: 부적 {TALISMAN_IDS.length}종의 효과와 가격
        </li>
        <li>
          <a href="/block-dosa/yokai/">요괴와 방해 칸</a>: 요괴 판의 규칙과 방해 칸
        </li>
        <li>
          <a href="/block-dosa/updates/">업데이트 소식</a>: 버전마다 바뀐 점
        </li>
      </ul>
    </>
  ),
};

/** 소모품 종류마다 하나씩 (비전서·도장은 종류가 여러 개) */
const CONSUMABLE_SAMPLES: readonly Consumable[] = [
  { kind: 'scroll', pattern: 'single' },
  { kind: 'hammer' },
  { kind: 'broom' },
  { kind: 'fan' },
  { kind: 'hourglass' },
  { kind: 'stamp', enh: 'gold' },
  { kind: 'ink' },
];

function consumableText(item: Consumable): { name: string; text: string } {
  const info = consumableInfo(item);
  if (item.kind === 'scroll') return { name: '비전서 (족보별 5종)', text: '그 족보의 레벨을 1 올려요' };
  if (item.kind === 'stamp') {
    return {
      name: '도장 (강화별 5종)',
      text: `가방의 블록 ${STAMP_BLOCKS}개를 그 강화 블록으로 바꿔요 (${ENHANCEMENT_IDS.map((id) => ENHANCEMENTS[id].name).join('·')})`,
    };
  }
  return { name: info.name, text: info.text };
}

const guide: PageDef = {
  path: '/block-dosa/guide/',
  nav: 'guide',
  title: '블록 도사 게임 방법 · 점수 계산과 공략',
  description: '블록 도사의 규칙, 칩 × 배수 점수 계산, 족보, 목표 점수, 장터와 소모품, 수련, 처음 하는 사람을 위한 팁.',
  body: (
    <>
      <h1>게임 방법</h1>
      <p className="lead">블록 도사의 규칙과 점수 계산을 정리했어요. 수치는 지금 게임과 같아요.</p>
      <PlayButtons guide={false} />

      <h2>판과 핸드</h2>
      <ul>
        <li>
          판은 {BOARD_SIZE}×{BOARD_SIZE} 칸이에요. 손에 블록 {PIECES_PER_HAND}개를 받고, 원하는 순서로 하나씩 판에 놓아요.
        </li>
        <li>
          {PIECES_PER_HAND}개를 다 놓으면 핸드 1개를 쓴 거예요. 판마다 핸드 {BASE_HANDS}번, 버리기 {BASE_DISCARDS}번이
          주어져요.
        </li>
        <li>버리기는 손의 블록 1개를 가방의 다른 블록으로 바꿔요. 핸드 수는 줄지 않아요.</li>
        <li>되돌리기: 판마다 {FREE_UNDOS}번, 마지막에 놓은 블록을 무를 수 있어요.</li>
        <li>블록은 기본적으로 돌릴 수 없어요. 🌀 바람개비 부적이나 🌬️ 부채 소모품이 있으면 돌릴 수 있어요.</li>
      </ul>

      <h2>점수: 칩 × 배수</h2>
      <p>
        가로·세로 줄을 꽉 채우면 동시에 지워지고, 지운 모양(족보)에 따라 칩과 배수가 정해져요. 비전서로 족보 레벨을 올리면 칩과
        배수가 커져요.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>족보</th>
              <th>칩</th>
              <th>배수</th>
              <th>레벨마다</th>
            </tr>
          </thead>
          <tbody>
            {PATTERN_IDS.map((id) => (
              <tr key={id}>
                <td>{PATTERNS[id].name}</td>
                <td>{PATTERNS[id].chips}</td>
                <td>{PATTERNS[id].mult}</td>
                <td>
                  칩 +{PATTERNS[id].chipsPerLevel}, 배수 +{PATTERNS[id].multPerLevel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul>
        <li>지운 칸 1개마다 칩 +{CELL_CHIPS}</li>
        <li>
          <b>연속</b>: 줄을 지울 때마다 1씩 늘고, 한 핸드 동안 한 줄도 못 지우면 끊겨요. 연속 n번째 클리어는 배수 +(n−1).
        </li>
        <li>
          <b>대청소</b>: 지운 뒤 판이 완전히 비면 ×{PERFECT_CLEAR_MULT}
        </li>
        <li>계산 순서: 족보 → 지운 칸 → 블록 강화 → 연속 → 부적(왼쪽부터) → 별 칸·유리·저주 칸·대청소</li>
      </ul>

      <h2>런과 목표 점수</h2>
      <p>
        런은 고개 {ANTE_COUNT}개, 고개마다 판 3개(판 1, 판 2, 요괴 판)예요. 판을 시작한 뒤 핸드를 다 쓰기 전에 목표 점수를 넘기면
        클리어예요.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>고개</th>
              <th>판 1</th>
              <th>판 2</th>
              <th>요괴 판</th>
            </tr>
          </thead>
          <tbody>
            {ANTE_TARGETS.map((base, i) => {
              const ante = i + 1;
              const bossMult = ante === ANTE_COUNT ? BOSSES[FINAL_BOSS].targetMult : REGULAR_BOSS_MULT;
              return (
                <tr key={ante}>
                  <td>{ante}</td>
                  <td>{won(base * STAGE_TARGET_MULT.small)}</td>
                  <td>{won(base * STAGE_TARGET_MULT.big)}</td>
                  <td>
                    {won(base * bossMult)}
                    {ante === ANTE_COUNT ? ' (이무기)' : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul>
        <li>
          판을 깨면 보상: 판 1 ${STAGE_REWARD.small}, 판 2 ${STAGE_REWARD.big}, 요괴 판 ${STAGE_REWARD.boss}. 남은 핸드마다
          +${GOLD_PER_HAND_LEFT}, 이자는 ${INTEREST_STEP}당 $1(최대 ${INTEREST_CAP}).
        </li>
        <li>
          핸드를 다 써도 목표를 못 넘기거나, 블록을 놓을 곳이 없는데 버리기·되돌리기·소모품도 없으면 런이 끝나요.
        </li>
        <li>
          판 1·판 2는 건너뛸 수 있어요. 그 판의 보상과 장터 대신 다음 중 하나를 받아요:{' '}
          {SKIP_REWARD_IDS.map((id) => `${SKIP_REWARDS[id].emoji} ${SKIP_REWARDS[id].name}`).join(', ')}
        </li>
      </ul>

      <h2>장터</h2>
      <ul>
        <li>
          부적: {(['common', 'uncommon', 'rare', 'cursed'] as Rarity[]).map((r) => `${RARITY_NAMES[r]} $${TALISMAN_PRICE[r]}`).join(' · ')}
          . 최대 {TALISMAN_SLOTS}개, 팔면 산 값의 절반.
        </li>
        <li>
          소모품 ${CONSUMABLE_PRICE} (먹은 ${INK_PRICE}). 최대 {CONSUMABLE_SLOTS}개까지 들고 다녀요.
        </li>
        <li>
          블록 팩 ${PACK_PRICE}: 블록 3개 중 1개를 골라 가방에 넣어요. 블록 빼기 ${REMOVAL_PRICE}: 가방에서 블록 1개를 빼요.
        </li>
        <li>리롤 ${REROLL_BASE}부터, 누를 때마다 $1씩 올라요.</li>
      </ul>

      <h3>소모품</h3>
      <ul className="list">
        {CONSUMABLE_SAMPLES.map((item) => {
          const { name, text } = consumableText(item);
          return (
            <Item key={item.kind} icon={consumableInfo(item).emoji} name={name}>
              {text}
            </Item>
          );
        })}
      </ul>

      <h3>블록 강화</h3>
      <p>강화된 블록을 놓으면 그 칸이 강화를 갖고 있다가, 줄과 함께 지워질 때 발동해요.</p>
      <ul className="list">
        {ENHANCEMENT_IDS.map((id) => (
          <Item key={id} icon={ENHANCEMENTS[id].mark} name={ENHANCEMENTS[id].name}>
            {ENHANCEMENTS[id].text}
          </Item>
        ))}
      </ul>

      <h2>공덕과 수련</h2>
      <p>런이 끝나면 공덕을 받아요. 공덕으로 수련을 배우면 다음 런부터 계속 적용돼요.</p>
      <ul className="list">
        {UPGRADES.map((upgrade) => (
          <Item key={upgrade.id} icon={upgrade.emoji} name={upgrade.name} tags={[`공덕 ${upgrade.costs.join(' / ')}`]}>
            {upgrade.text}
          </Item>
        ))}
      </ul>

      <h2>가방과 난이도</h2>
      <ul className="list">
        {BAG_TYPES.map((bag) => (
          <Item key={bag.id} icon={bag.emoji} name={bag.name} tags={bag.unlock ? [`열기: ${bag.unlock.text}`] : ['처음부터']}>
            {bag.text}
          </Item>
        ))}
      </ul>
      <p>엔딩을 보면 다음 난이도가 열리고, 규칙이 하나씩 쌓여요.</p>
      <ul className="list">
        {STAKES.map((stake) => (
          <Item key={stake.level} icon={stake.level} name={stake.name}>
            {stake.rule}
          </Item>
        ))}
      </ul>

      <h2>친구와 함께</h2>
      <ul>
        <li>오늘의 판: 하루 한 번 모두가 같은 판(고개 3 + 끝판). 첫 도전이 공식 기록이에요.</li>
        <li>
          주간 도전: 월요일마다 특수 규칙이 바뀌어요 ({WEEKLY_RULES.map((rule) => `${rule.emoji} ${rule.name}`).join(', ')}).
        </li>
        <li>코드로 도전: 결과에 나오는 코드를 넣으면 친구와 같은 판에 도전해요.</li>
        <li>결과를 글이나 이미지로 공유할 수 있어요.</li>
      </ul>

      <h2>처음 하는 사람을 위한 팁</h2>
      <ul>
        <li>큰 블록(큰ㅁ·막대5)이 들어갈 빈 곳을 늘 남겨 두세요. 막히면 런이 끝나요.</li>
        <li>두 줄 이상을 한 번에 지우면 족보 점수가 크게 뛰어요. 십자(가로 1 + 세로 1)도 좋아요.</li>
        <li>핸드마다 한 줄이라도 지우면 연속이 이어져서 배수가 계속 올라가요.</li>
        <li>부적은 배수 +가 앞, 배수 ×가 뒤에 오게 놓으면 점수가 더 커져요.</li>
        <li>
          돈을 ${INTEREST_STEP} 단위로 남겨 두면 판마다 이자가 붙어요 (최대 ${INTEREST_CAP}).
        </li>
      </ul>
      <PlayButtons guide={false} />
    </>
  ),
};

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'cursed'];

function rarityNote(rarity: Rarity): string {
  if (rarity === 'legendary') return '요괴 판을 깨고 받는 유품으로만 나와요';
  if (rarity === 'cursed') return `$${TALISMAN_PRICE.cursed} · 강하지만 대가가 있고 팔 수 없어요`;
  return `장터에서 $${TALISMAN_PRICE[rarity]}`;
}

const talismans: PageDef = {
  path: '/block-dosa/talismans/',
  nav: 'talismans',
  title: `블록 도사 부적 도감 · 부적 ${TALISMAN_IDS.length}종 효과와 가격`,
  description: `블록 도사의 부적 ${TALISMAN_IDS.length}종. 일반·고급·희귀·전설·저주 등급별 효과, 가격, 여는 조건.`,
  body: (
    <>
      <h1>부적 도감</h1>
      <p className="lead">
        부적은 점수 계산을 바꾸는 장비예요. 최대 {TALISMAN_SLOTS}개까지 달고, 왼쪽부터 순서대로 발동해요. 팔면 산 값의
        절반을 돌려받아요.
      </p>
      {RARITY_ORDER.map((rarity) => {
        const ids = TALISMAN_IDS.filter((id) => TALISMANS[id].rarity === rarity);
        return (
          <section key={rarity}>
            <h2>
              {RARITY_NAMES[rarity]} <span className="tag">{ids.length}종</span>
            </h2>
            <p className="note">{rarityNote(rarity)}</p>
            <ul className="list">
              {ids.map((id) => {
                const def = TALISMANS[id];
                return (
                  <Item key={id} icon={def.emoji} name={def.name} tags={def.unlock ? [`열기: ${def.unlock.text}`] : []}>
                    {def.text}
                  </Item>
                );
              })}
            </ul>
          </section>
        );
      })}
      <PlayButtons />
    </>
  ),
};

const bonusShare = (kind: string) => BONUS_WEIGHTS.find(([k]) => k === kind)?.[1] ?? 0;

const yokai: PageDef = {
  path: '/block-dosa/yokai/',
  nav: 'yokai',
  title: '블록 도사 요괴와 방해 칸 · 요괴 판 규칙',
  description: `블록 도사의 요괴 ${regularBosses}종과 이무기, 방해 칸 ${OBSTACLE_IDS.length}종, 보너스 칸의 규칙과 나오는 고개.`,
  body: (
    <>
      <h1>요괴와 방해 칸</h1>
      <p className="lead">고개마다 세 번째 판은 요괴 판이에요. 판을 시작하기 전에 어떤 규칙인지 보여줘요.</p>

      <h2>요괴</h2>
      <ul className="list">
        {[...REGULAR_BOSSES, BOSSES[FINAL_BOSS]].map((def) => (
          <Item
            key={def.id}
            icon={def.emoji}
            name={def.name}
            tags={[def.final ? `고개 ${ANTE_COUNT}` : `고개 ${def.minAnte}부터`, `목표 ×${def.targetMult}`]}
          >
            {def.rule}
          </Item>
        ))}
      </ul>

      <h2>방해 칸</h2>
      <p>
        판 2는 고개 {OBSTACLE_FROM_ANTE.big}부터, 판 1은 고개 {OBSTACLE_FROM_ANTE.small}부터 판마다 방해 칸 1종이 나와요.
        요괴 판에는 없어요.
      </p>
      <ul className="list">
        <Item icon="🪨" name="바위">
          줄에 포함되지만 칩은 0. 한 번 지우면 금이 가고, 두 번째에 부서져요.
        </Item>
        {OBSTACLE_IDS.map((id) => (
          <Item key={id} icon={OBSTACLES[id].emoji} name={OBSTACLES[id].name}>
            {OBSTACLES[id].rule}
          </Item>
        ))}
      </ul>

      <h2>보너스 칸</h2>
      <p>판을 시작할 때 빈칸에 0~2개 생겨요. 블록으로 덮은 채 그 칸이 지워지면 발동해요.</p>
      <ul className="list">
        <Item icon="💎" name="보석 칸" tags={[`${bonusShare('gem')}%`]}>
          +${GEM_GOLD}
        </Item>
        <Item icon="⭐" name="별 칸" tags={[`${bonusShare('star')}%`]}>
          그 클리어 점수 ×{STAR_MULT}
        </Item>
        <Item icon="📜" name="두루마리 칸" tags={[`${bonusShare('scroll')}%`]}>
          비전서 1장 (소모품 칸이 비어 있을 때)
        </Item>
      </ul>
      <PlayButtons />
    </>
  ),
};

const updates: PageDef = {
  path: '/block-dosa/updates/',
  nav: 'updates',
  title: '블록 도사 업데이트 소식',
  description: `블록 도사 버전별 변경 사항. 최신 ${latest.version}: ${latest.title}`,
  body: (
    <>
      <h1>업데이트 소식</h1>
      <p className="lead">버전마다 바뀐 점이에요. 상향·하향은 플레이어 입장에서 좋아졌는지 나빠졌는지예요.</p>
      {RELEASES.map((release) => (
        <section key={release.version} className="card">
          <h2>
            {release.version} · {release.title}
          </h2>
          <p className="note">{release.date}</p>
          {release.sections.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              <ul className="list">
                {section.lines.map((line) => (
                  <li key={line.target}>
                    <div>
                      <span className="name">{line.target}</span>
                      <span className={`tag ${line.kind}`}>{CHANGE_LABELS[line.kind]}</span>
                      <p>{line.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </>
  ),
};

const privacy: PageDef = {
  path: '/privacy/',
  nav: 'privacy',
  title: '개인정보처리방침 · 가온',
  description: '가온(gaon.dev)과 블록 도사의 개인정보처리방침.',
  body: (
    <>
      <h1>개인정보처리방침</h1>
      <p className="note">시행일 {PRIVACY_DATE}</p>
      <p>
        가온(gaon.dev와 그 하위 주소, 블록 도사 {gameHost} 포함. 아래 &quot;사이트&quot;)은 이용자의 개인정보를 소중히 다루며,
        아래와 같이 처리해요.
      </p>

      <h2>1. 수집하는 개인정보</h2>
      <p>사이트에는 회원가입이 없고, 이름·연락처 같은 개인정보를 직접 수집하지 않아요.</p>

      <h2>2. 게임 기록</h2>
      <p>
        게임 기록(공덕·수련·도감·진행 중인 런·설정)은 이용자의 브라우저 저장소(localStorage)에만 저장되고 서버로 보내지 않아요.
        브라우저 데이터를 지우면 기록도 함께 지워져요. 세이브 코드는 이용자가 직접 복사해서 옮기는 것으로, 사이트가 따로
        보관하지 않아요.
      </p>

      <h2>3. 자동으로 생성되는 정보</h2>
      <p>
        사이트는 Cloudflare를 통해 제공돼요. 보안과 서비스 운영을 위해 Cloudflare가 접속 기록(IP 주소, 브라우저 정보, 접속 시각
        등)을 처리할 수 있어요.
      </p>

      <h2>4. 광고와 쿠키</h2>
      <p>
        사이트에는 Google 애드센스 광고가 게재될 수 있어요. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자가 이 사이트나
        다른 사이트를 방문한 기록을 바탕으로 광고를 보여줄 수 있어요.
      </p>
      <ul>
        <li>
          Google의 맞춤 광고는 <a href="https://adssettings.google.com">Google 광고 설정</a>에서 끌 수 있어요.
        </li>
        <li>
          다른 광고 사업자의 맞춤 광고는 <a href="https://www.aboutads.info">aboutads.info</a>에서 끌 수 있어요.
        </li>
        <li>브라우저 설정에서 쿠키 저장을 막을 수도 있어요. 막아도 게임은 그대로 할 수 있어요.</li>
      </ul>

      <h2>5. 만 14세 미만 아동</h2>
      <p>사이트는 개인정보를 수집하지 않으므로, 만 14세 미만 아동의 개인정보도 수집하지 않아요.</p>

      <h2>6. 문의</h2>
      <p>
        개인정보와 관련한 문의는 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로 보내 주세요. 개인정보 보호책임자는
        가온 운영자예요.
      </p>

      <h2>7. 바뀔 때</h2>
      <p>이 방침이 바뀌면 이 페이지에서 알려 드려요.</p>
    </>
  ),
};

export const PAGES: readonly PageDef[] = [home, dosa, guide, talismans, yokai, updates, privacy];

const notFound: PageDef = {
  path: '/404.html',
  nav: 'home',
  title: '페이지를 찾을 수 없어요 · 가온',
  description: '찾는 페이지가 없어요.',
  body: (
    <>
      <h1>페이지를 찾을 수 없어요</h1>
      <p className="lead">주소가 바뀌었거나 없는 페이지예요.</p>
      <div className="actions">
        <a className="button primary" href="/">
          가온 처음으로
        </a>
        <a className="button" href={GAME_URL}>
          블록 도사 하기
        </a>
      </div>
    </>
  ),
};

/** 페이지 주소 → 파일 이름 (/block-dosa/ → block-dosa/index.html) */
const fileOf = (path: string) => (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));

const render = (page: PageDef) =>
  '<!doctype html>\n' +
  renderToStaticMarkup(
    <Html page={page}>
      {page.body}
    </Html>,
  );

/** 만들 파일 전부: 파일 이름 → 내용 */
export function renderSite(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const page of [...PAGES, notFound]) files[fileOf(page.path)] = render(page);

  files['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${HUB_URL}/sitemap.xml\n`;
  // 루트 도메인의 ads.txt가 하위 주소(dosa.gaon.dev)까지 함께 맡는다
  files['ads.txt'] = `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
  files['sitemap.xml'] =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    PAGES.map((page) => `  <url><loc>${HUB_URL}${page.path}</loc><lastmod>${latest.date}</lastmod></url>\n`).join('') +
    '</urlset>\n';
  return files;
}
