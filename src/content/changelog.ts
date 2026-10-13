/**
 * 변경 사항 (처음 화면 "변경·설명") → docs/11-ui-ux.md
 * 새 버전을 배포할 때 맨 위에 하나 더한다. up = 상향, down = 하향, new = 새로 생김, change = 바뀜
 */

export type ChangeKind = 'up' | 'down' | 'new' | 'change';

export interface ChangeLine {
  kind: ChangeKind;
  /** 무엇이 바뀌었나 (이모지 + 이름) */
  target: string;
  /** "전 → 후" 또는 설명 */
  text: string;
}

export interface Release {
  version: string;
  date: string;
  title: string;
  sections: ReadonlyArray<{ title: string; lines: readonly ChangeLine[] }>;
}

export const CHANGE_LABELS: Record<ChangeKind, string> = { up: '상향', down: '하향', new: '새로', change: '바뀜' };

export const RELEASES: readonly Release[] = [
  {
    version: 'v1.1.2',
    date: '2026-10-13',
    title: '공유하면 게임 주소가 같이 가요',
    sections: [
      {
        title: '친구·편의',
        lines: [
          {
            kind: 'change',
            target: '📤 결과 공유',
            text: '글·이미지 끝에 dosa.gaon.dev 주소가 붙어요. 카톡에서는 링크 미리보기도 떠요',
          },
          {
            kind: 'new',
            target: '📖 게임 소개 페이지',
            text: 'gaon.dev/block-dosa 에 게임 방법·부적 도감·요괴·업데이트 소식',
          },
        ],
      },
    ],
  },
  {
    version: 'v1.1.1',
    date: '2026-10-13',
    title: '새 주소로 이사했어요',
    sections: [
      {
        title: '주소',
        lines: [
          {
            kind: 'change',
            target: '🏠 새 주소',
            text: 'qkrgusdn1942.github.io/block-dosa → dosa.gaon.dev. 예전 주소에서 기록을 그대로 가지고 올 수 있음',
          },
          { kind: 'change', target: '📲 홈 화면 설치', text: '홈 화면에 추가해 두었다면 새 주소에서 한 번 더 추가' },
        ],
      },
    ],
  },
  {
    version: 'v1.1',
    date: '2026-10-12',
    title: '판이 다양해지고, 소모품이 세졌어요',
    sections: [
      {
        title: '소모품',
        lines: [
          { kind: 'up', target: '🔨 망치', text: '칸 1개 → 3×3 칸을 부숨 (바위·방해 칸 포함)' },
          { kind: 'up', target: '🧹 빗자루', text: '줄을 비우기만 함 → 줄을 지우고 "한 줄" 점수를 받음 (부적·연속·강화 칸 적용)' },
          { kind: 'up', target: '🌬️ 부채', text: '블록 1개를 한 번 회전 → 이번 판 동안 블록을 눌러서 돌릴 수 있음' },
          { kind: 'up', target: '🔖 도장', text: '가방 블록 1개 강화 → 2개 강화' },
          { kind: 'up', target: '🖌️ 먹', text: '$3 → $2' },
          { kind: 'new', target: '⌛ 모래시계', text: '이번 판 핸드 +1 ($3)' },
          { kind: 'change', target: '장터 소모품 비율', text: '비전서 38%, 망치 14%, 도장 14%, 부채 11%, 빗자루 9%, 먹 8%, 모래시계 6%' },
        ],
      },
      {
        title: '강화 블록',
        lines: [
          { kind: 'up', target: '✦ 수정', text: '칸당 칩 +5 → +10' },
          { kind: 'up', target: '▲ 불꽃', text: '칸당 배수 +1 → +2' },
          { kind: 'up', target: '$ 금', text: '한 번에 최대 $5 → $8' },
          { kind: 'up', target: '◇ 유리', text: '×1.5 → ×2 (깨질 확률 1/4 그대로)' },
        ],
      },
      {
        title: '판',
        lines: [
          { kind: 'new', target: '방해 칸 5종', text: '🧊 얼음 · 🔒 자물쇠 · 🌿 이끼 · 💣 시한폭탄 · 🕸️ 저주 칸. 고개 4 판 2부터, 고개 6부터는 판 1에도' },
          { kind: 'new', target: '📜 두루마리 칸', text: '덮어서 지우면 비전서 1장 (보너스 칸의 15%)' },
          { kind: 'down', target: '⭐ 별 칸', text: '보너스 칸 중 나올 확률 50% → 35% (두루마리 칸이 생겨서)' },
          { kind: 'new', target: '↩ 되돌리기', text: '판마다 1번 무료로 마지막에 놓은 블록을 되돌림 (상태 줄 오른쪽 버튼)' },
          { kind: 'new', target: '판 건너뛰기', text: '판 1·판 2를 건너뛰고 💰 $10 / 🎁 공짜 블록 팩 / 🏷️ 반값 부적 / 🔄 공짜 리롤 3번 / 📖 족보 3개 레벨 +1 중 하나' },
        ],
      },
      {
        title: '요괴',
        lines: [
          {
            kind: 'change',
            target: '🐅 장산범',
            text: '?를 눌렀다 떼기만 해도 모양이 보였음 → ?는 핸드의 마지막 블록으로만 집을 수 있음 (더 어려워짐). 다른 블록을 놓을 데가 없으면 풀리고, 가린 채 버릴 수 있음',
          },
        ],
      },
      {
        title: '부적',
        lines: [
          { kind: 'new', target: '저주받은 부적 3종', text: '👺 귀면와 · 🎭 하회탈 · ⚱️ 금단지. 강하지만 대가가 있고 팔 수 없음. 고개 3 도달 뒤 장터에 4%' },
          { kind: 'change', target: '장터 부적 등급 확률', text: '일반 70 / 고급 25 / 희귀 5 → 일반 67 / 고급 24 / 희귀 5 / 저주 4' },
        ],
      },
      {
        title: '친구·편의',
        lines: [
          { kind: 'new', target: '주간 도전', text: '월요일마다 바뀌는 특수 규칙 판. 이번 주 첫 도전이 공식 기록' },
          { kind: 'new', target: '코드에 가방·난이도', text: '예: K7Q2MX-H3 = 혼돈 가방·3단계로 같은 판 도전' },
          { kind: 'new', target: '결과 이미지', text: '런 결과를 카드 이미지로 공유' },
          { kind: 'new', target: '도감 · 설정 · 세이브 코드', text: '만난 것 모으기, 숫자 표기(한국식·지수)·왼손 모드, 기기 이동용 코드' },
          { kind: 'new', target: '점수 계산 내역', text: '판에서 점수 줄을 누르면 마지막 클리어를 단계별로' },
          { kind: 'new', target: '변경·설명', text: '이 화면. 바뀐 점과 모든 요소의 설명' },
        ],
      },
    ],
  },
  {
    version: 'v1.0',
    date: '2026-10-12',
    title: '콘텐츠가 크게 늘었어요',
    sections: [
      {
        title: '새로 생긴 것',
        lines: [
          { kind: 'new', target: '부적 19종', text: '전설 3종(🔮 여의주 · 🌞 삼족오 · 🪶 봉황 깃털) 포함, 모두 34종' },
          { kind: 'new', target: '요괴 5종', text: '💀 저승사자 · 🐻 불가사리 · 🔥 강철이 · 👊 두억시니 · 🐅 장산범' },
          { kind: 'new', target: '블록 강화 5종', text: '금 · 수정 · 불꽃 · 유리 · 행운. 🔖 도장, 🖌️ 먹, 🧹 빗자루' },
          { kind: 'new', target: '가방 4종 · 난이도 8단계', text: '새 런 준비 화면에서 고름' },
          { kind: 'new', target: '끝없는 모드', text: '이무기를 깬 뒤 고개 9부터 계속' },
          { kind: 'new', target: '홈 화면 설치', text: '앱처럼 열리고 오프라인에서도 됨' },
        ],
      },
    ],
  },
  {
    version: 'v0.4',
    date: '2026-10-12',
    title: '첫 공개',
    sections: [
      {
        title: '처음 들어간 것',
        lines: [
          { kind: 'new', target: '여덟 고개 런', text: '부적 15종, 요괴 4종 + 이무기, 장터, 공덕·수련, 오늘의 판, 결과 공유, 코드로 도전' },
        ],
      },
    ],
  },
];

export const LATEST_VERSION = RELEASES[0].version;
