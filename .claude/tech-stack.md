## Tech Stack

| Layer | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **Styling** | Tailwind CSS 4 |
| **Animation** | Framer Motion (전환/연출) + Canvas API (게임별) |
| **Physics** | Matter.js (플링코/마블 레이스) |
| **Maps/Places** | Kakao 로컬 REST API (카테고리 검색) |
| **Geolocation** | Browser Geolocation API |
| **Package Manager** | pnpm |
| **Deploy** | Vercel |
| **State** | React 상태 (useState/useReducer) — 외부 상태관리 불필요 |

### 외부 API 의존성

| 용도 | API | Note |
|---|---|---|
| 주변 음식점 검색 | Kakao 로컬 REST API (카테고리 검색) | REST API Key, 서버 프록시 |
| 결과 상세 | 카카오맵 place_url 링크 | 클라이언트에서 외부 링크 |
| 위치 정보 | Browser Geolocation API | 무료, 사용자 허가 필요 |

> Kakao 로컬 API: 30만 건/일 무료. 한국 음식점 데이터 우수. FD6(음식점), CE7(카페) 카테고리 코드 사용.

### 게임

Matter.js 물리와 Canvas 2D 렌더링을 결합한 플링코/마블 레이스 하나를 제공한다.
전체 음식점에서 최대 12개를 무작위 선발하고 `placeId` 기준으로 우승자를 추적한다.

### 아키텍처

```
[Browser]
  ├── Geolocation API → 사용자 위치 획득
  ├── Next.js Pages → UI (위치 설정 + 마블런 + 결과)
  └── fetch → /api/places (Next.js API Route)
                └── Kakao 로컬 REST API (서버 프록시)
```

> REST API Key를 클라이언트에 노출하지 않기 위해 Next.js API Routes를 프록시로 사용.
