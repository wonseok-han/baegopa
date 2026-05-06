## Tech Stack

| Layer | Choice |
|---|---|
| **Framework** | Next.js 15 (App Router, TypeScript) |
| **Styling** | Tailwind CSS 4 |
| **Animation** | Framer Motion (전환/연출) + Canvas API (게임별) |
| **Physics (선택)** | Matter.js (핀볼 등 물리 기반 게임 시) |
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

### 미니게임 후보 & 기술

| 게임 | 기술 | 난이도 |
|---|---|---|
| 룰렛 (회전판) | CSS transform + transition | 낮음 |
| 슬롯머신 | CSS animation / Framer Motion | 낮음 |
| 핀볼 | Matter.js (물리 엔진) | 높음 |
| 뽑기 (가챠) | Framer Motion 연출 | 중간 |
| 사다리타기 | Canvas 2D | 중간 |

> 미니게임은 플러그인 패턴으로 구현 — 공통 인터페이스(`GameProps: { candidates, onResult }`)를 정의하고 각 게임이 이를 구현.

### 아키텍처

```
[Browser]
  ├── Geolocation API → 사용자 위치 획득
  ├── Next.js Pages → UI (게임 선택 + 미니게임 + 결과)
  └── fetch → /api/places (Next.js API Route)
                └── Kakao 로컬 REST API (서버 프록시)
```

> REST API Key를 클라이언트에 노출하지 않기 위해 Next.js API Routes를 프록시로 사용.
