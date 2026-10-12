# 블록 도사 (가제)

블록 퍼즐 × 로그라이크 모바일 웹 게임. 기획 문서는 [docs/00-overview.md](docs/00-overview.md)에서 시작.

**플레이:** https://qkrgusdn1942.github.io/block-dosa/

`main`에 push하면 GitHub Actions가 테스트·빌드한 뒤 GitHub Pages에 자동으로 배포한다 ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm test         # 게임 로직 테스트
npm run build    # dist/에 배포용 정적 파일 생성
```

폰에서 해보려면 컴퓨터와 같은 와이파이에 연결한 뒤, `npm run dev` 실행 시 터미널에 나오는 `Network:` 주소로 접속한다.

개발 서버에서는 주소 뒤에 붙여서 원하는 판부터 시작할 수 있다 (요괴·후반 판 확인용):

| 주소 | 시작하는 판 |
|---|---|
| `/?ante=2&stage=boss&boss=mulgwishin` | 고개 2 요괴 판, 물귀신 |
| `/?ante=8&stage=boss` | 고개 8 이무기 |
| `/?ante=5&stage=big` | 고개 5 판 2 (바위 3개) |

`stage`는 `small`(판 1) · `big`(판 2) · `boss`, `boss`는 `dokkaebi` · `gumiho` · `eodukssini` · `mulgwishin` · `imugi`.

## 구조

| 폴더 | 내용 |
|---|---|
| `src/core` | 게임 로직 (판, 블록, 점수, 판 진행, 런 진행, 장터, 시드 랜덤). DOM 없음 |
| `src/content` | 데이터 (블록, 부적, 요괴, 소모품, 밸런스 수치) |
| `src/ui` | React 화면과 드래그 조작 |
| `tests` | Vitest 단위 테스트 |
| `docs` | 기획 문서 |
