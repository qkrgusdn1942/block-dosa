# 블록 도사 (가제)

블록 퍼즐 × 로그라이크 모바일 웹 게임. 기획 문서는 [docs/00-overview.md](docs/00-overview.md)에서 시작.

**플레이:** https://dosa.gaon.dev/ (예전 주소 qkrgusdn1942.github.io/block-dosa 는 이사 안내만 한다)

`main`에 push하면 두 곳에 자동으로 배포된다.
- **Cloudflare (새 주소 `dosa.gaon.dev`):** Workers Builds가 `npm test && npm run build` 후 `dist/`를 올린다 ([wrangler.jsonc](wrangler.jsonc)).
- **GitHub Pages (예전 주소):** GitHub Actions가 테스트·빌드·배포 ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). 이사 안내를 켜면(`src/save/move.ts`의 `MOVE_NOTICE`) 새 주소로 안내만 한다 → [docs/12-tech.md](docs/12-tech.md)

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm test         # 게임 로직 테스트
npm run sim      # 봇이 런을 돌려 고개별 통과율 확인 (SIM_RUNS=500 npm run sim)
npm run build    # dist/에 배포용 정적 파일 생성
npm run site     # 소개 홈 gaon.dev를 site/dist에 생성 (게임 데이터로 만든 정적 페이지)
```

폰에서 해보려면 컴퓨터와 같은 와이파이에 연결한 뒤, `npm run dev` 실행 시 터미널에 나오는 `Network:` 주소로 접속한다.

개발 서버에서는 주소 뒤에 붙여서 원하는 판부터 시작할 수 있다 (요괴·후반 판 확인용):

| 주소 | 시작하는 판 |
|---|---|
| `/?ante=2&stage=boss&boss=mulgwishin` | 고개 2 요괴 판, 물귀신 |
| `/?ante=8&stage=boss` | 고개 8 이무기 |
| `/?ante=5&stage=big` | 고개 5 판 2 (바위 3개) |
| `/?ante=3&stage=boss&boss=jangsanbeom&bag=chaos&stake=4` | 혼돈 가방·난이도 4로 고개 3 장산범 |
| `/?ante=9` | 끝없는 모드 고개 9 판 1 (고개 20까지) |

- `stage`: `small`(판 1) · `big`(판 2) · `boss`
- `boss`: `dokkaebi` · `gumiho` · `eodukssini` · `mulgwishin` · `grimReaper` · `bulgasari` · `gangcheol` · `dueoksini` · `jangsanbeom` · `imugi`
- 방해 칸은 고개 4 판 2부터 나온다: `/?ante=4&stage=big`
- `bag`: `basic` · `bars` · `squares` · `chaos`, `stake`: `1`~`8`
- `/?moved`: 예전 주소에서 보이는 이사 안내 화면 미리 보기

배포본은 홈 화면에 추가(PWA)할 수 있고, 한 번 열면 오프라인에서도 열린다. 서비스 워커는 배포본에서만 켜진다.

## 구조

| 폴더 | 내용 |
|---|---|
| `src/core` | 게임 로직 (판, 블록, 점수, 판 진행, 런 진행, 장터, 시드 랜덤). DOM 없음 |
| `src/content` | 데이터 (블록, 강화, 가방, 부적, 요괴, 소모품, 난이도, 해금, 밸런스 수치) |
| `src/ui` | React 화면과 드래그 조작 |
| `src/save` | 저장·불러오기·버전 이전, 세이브 코드, 주소 이사 |
| `public` | 홈 화면 설치용 manifest, 아이콘, 서비스 워커 |
| `tests` | Vitest 단위 테스트 |
| `scripts` | 밸런스 확인용 봇 (`npm run sim`) |
| `site` | 소개 홈 gaon.dev: 게임 방법·부적 도감·요괴·업데이트 소식·개인정보처리방침 ([docs/12-tech.md](docs/12-tech.md)) |
| `docs` | 기획 문서 |
