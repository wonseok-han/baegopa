# 배고파 (Baegopa)

> "배고파, 뭐 먹지?" — 선택 장애를 위한 마블런 음식점 선택기

위치 기반으로 주변 음식점을 찾고, 플링코/마블 레이스로 재미있게 골라주는 웹앱.

## Features

- **위치 설정** — GPS 자동 탐지 또는 주소/장소 검색
- **주변 음식점 탐색** — Kakao 로컬 API 기반, 반경 100m ~ 1km
- **마블런** — 음식점 구슬들이 플링코 코스를 달려 1등 당첨
- **결과 확인** — 카카오맵 길찾기 연동

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion + Canvas API |
| Physics | Matter.js |
| Maps/Places | Kakao 로컬 REST API |
| Deploy | Vercel |

## Getting Started

```bash
# 의존성 설치
pnpm install

# 환경변수 설정
cp .env.example .env.local
# KAKAO_REST_API_KEY, NEXT_PUBLIC_KAKAO_JS_KEY 입력

# 개발 서버
pnpm dev
```

http://localhost:3000 에서 확인.

## Environment Variables

| 변수 | 용도 | Scope |
|------|------|-------|
| `KAKAO_REST_API_KEY` | 음식점/주소 검색 API | Server |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오맵 JS SDK | Client |

[Kakao Developers](https://developers.kakao.com/)에서 앱 등록 후 발급.

## Scripts

```bash
pnpm dev        # 개발 서버
pnpm build      # 프로덕션 빌드
pnpm test       # API 검증/요청 제한 테스트
pnpm check      # lint + typecheck + test
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # 홈 (위치 설정)
│   ├── play/page.tsx         # 마블런 플레이
│   ├── result/page.tsx       # 결과 표시
│   └── api/
│       ├── places/route.ts   # 음식점 검색 프록시
│       └── search/route.ts   # 주소/장소 검색 프록시
├── components/games/         # 플링코/마블 레이스
├── hooks/                    # 위치·음식점 요청 상태
└── lib/                      # 저장소·API 검증 유틸리티
```

## API Safety

- 음식점 검색은 `100 / 300 / 500 / 1000m` 반경만 허용합니다.
- 좌표, 검색어, 페이지를 서버에서 검증합니다.
- 외부 Kakao 요청은 7초 후 중단하며 IP 기준 요청 제한을 적용합니다.
- 위치와 음식점 캐시는 브라우저의 현재 탭(`sessionStorage`)에만 유지됩니다.
