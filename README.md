# 배고파 (Baegopa)

> "배고파, 뭐 먹지?" — 선택 장애를 위한 미니게임 음식점 선택기

위치 기반으로 주변 음식점을 찾고, 미니게임으로 재미있게 골라주는 웹앱.

## Features

- **위치 설정** — GPS 자동 탐지 또는 주소/장소 검색
- **주변 음식점 탐색** — Kakao 로컬 API 기반, 반경 100m ~ 1km
- **미니게임 4종**
  - 룰렛 — 회전판을 돌려 당첨
  - 슬롯머신 — 3개 릴이 맞으면 당첨
  - 마블 레이스 — 구슬이 장애물 코스를 달려 1등 당첨
  - 뽑기 — 공이 섞인 후 하나를 뽑아 당첨
- **결과 확인** — 카카오맵 길찾기 연동

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, TypeScript) |
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
pnpm check      # lint + typecheck
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # 홈 (위치 설정)
│   ├── play/page.tsx         # 게임 선택 + 플레이
│   ├── result/page.tsx       # 결과 표시
│   └── api/
│       ├── places/route.ts   # 음식점 검색 프록시
│       └── search/route.ts   # 주소/장소 검색 프록시
├── components/games/         # 미니게임 컴포넌트
├── hooks/                    # useGeolocation 등
└── lib/                      # 유틸리티, 게임 레지스트리
```

## License

MIT
