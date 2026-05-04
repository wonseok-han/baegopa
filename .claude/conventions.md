## Coding Conventions

### TypeScript / Next.js

| Target | Convention | Example |
|---|---|---|
| Components | PascalCase | `RouletteGame`, `RestaurantCard` |
| Functions/Hooks | camelCase | `useLocation`, `fetchPlaces` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_RADIUS`, `MAX_RESULTS` |
| Types/Interfaces | PascalCase | `Restaurant`, `GameProps`, `GameResult` |
| Files | kebab-case | `pinball-game.tsx`, `use-location.ts` |
| Folders | kebab-case | `pinball/`, `restaurant/` |

> Next.js 예약 파일(`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` 등)은 프레임워크 규칙을 따름.

### Import 순서

1. React/Next.js
2. 외부 라이브러리
3. `@/` 절대경로
4. 상대경로
5. 타입 imports

### 환경 변수

| Prefix | Scope | Example |
|---|---|---|
| `NEXT_PUBLIC_` | 브라우저 노출 OK | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` |
| (no prefix) | 서버 전용 | `GOOGLE_PLACES_API_KEY` |

### 디렉토리 구조 (예정)

```
src/
├── app/
│   ├── page.tsx              # 메인 (위치 수집 → 게임 선택)
│   ├── layout.tsx
│   ├── play/page.tsx         # 게임 플레이
│   ├── result/page.tsx       # 결과 페이지
│   └── api/
│       └── places/route.ts   # 음식점 검색 프록시
├── components/
│   ├── games/                # 미니게임들
│   │   ├── roulette.tsx      # 룰렛
│   │   ├── slot-machine.tsx  # 슬롯
│   │   ├── pinball.tsx       # 핀볼
│   │   └── gacha.tsx         # 뽑기
│   ├── restaurant/           # 음식점 카드/리스트
│   └── ui/                   # 공통 UI
├── hooks/
│   └── use-location.ts
├── lib/
│   ├── places.ts             # Places API 유틸
│   └── game-registry.ts     # 게임 등록/선택 로직
└── types/
    └── index.ts
```
