# Design: baegopa-core (배고파 MVP)

## Executive Summary

| 항목 | 내용 |
|------|------|
| **Feature** | 배고파 MVP — 위치 기반 미니게임 음식점 선택기 |
| **Architecture** | Next.js App Router + API Route Proxy + Client-side Games |
| **Key Decisions** | 플러그인 게임 패턴, Google Places API, Framer Motion |

---

## 1. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
├─────────────────────────────────────────────────┤
│  [Page: Home]     → 위치 수집 + 반경 설정        │
│  [Page: Play]     → 게임 선택 + 미니게임 실행     │
│  [Page: Result]   → 결과 표시 + 다시하기          │
├─────────────────────────────────────────────────┤
│  Hooks: useGeolocation, useNearbyPlaces          │
│  Games: RouletteGame, SlotMachineGame            │
├─────────────────────────────────────────────────┤
│          Next.js API Routes (Server)             │
│  /api/places → Google Places Nearby Search       │
└─────────────────────────────────────────────────┘
```

---

## 2. 페이지 구조 (App Router)

| Route | 파일 | 역할 |
|-------|------|------|
| `/` | `app/page.tsx` | 랜딩 + 위치 수집 + 반경 설정 |
| `/play` | `app/play/page.tsx` | 게임 선택 + 미니게임 플레이 |
| `/result` | `app/result/page.tsx` | 결과 표시 |
| `/api/places` | `app/api/places/route.ts` | 음식점 검색 프록시 |

### 페이지 간 데이터 전달

URL SearchParams 기반 (상태 비저장 원칙):
```
/ → /play?lat=37.5&lng=127.0&radius=1000
/play → /result?placeId=ChIJ...&name=...&category=...&distance=500
```

---

## 3. 컴포넌트 설계

### 3.1 공통 타입

```typescript
// types/index.ts

interface Restaurant {
  placeId: string;
  name: string;
  category: string;
  distance: number;       // meters
  rating?: number;
  address: string;
  location: { lat: number; lng: number };
  photoUrl?: string;
}

interface GameProps {
  candidates: Restaurant[];
  onResult: (selected: Restaurant) => void;
}

interface GameMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: React.ComponentType<GameProps>;
}
```

### 3.2 컴포넌트 트리

```
app/page.tsx
├── LocationPermission        # 위치 권한 요청 UI
├── RadiusSelector           # 반경 선택 (500m/1km/2km)
└── StartButton              # "음식점 찾기" CTA

app/play/page.tsx
├── GameSelector             # 게임 목록 (grid)
│   └── GameCard             # 개별 게임 카드
├── RouletteGame             # 룰렛 미니게임
└── SlotMachineGame          # 슬롯 미니게임

app/result/page.tsx
├── RestaurantCard           # 선택된 음식점 정보
├── MapLink                  # 지도 앱 열기 버튼
└── ActionButtons            # 다시하기 / 다른 게임
```

### 3.3 미니게임 플러그인 구조

```typescript
// lib/game-registry.ts

import { RouletteGame } from '@/components/games/roulette';
import { SlotMachineGame } from '@/components/games/slot-machine';

export const GAMES: GameMeta[] = [
  {
    id: 'roulette',
    name: '룰렛',
    description: '회전판을 돌려서 골라보자!',
    icon: '🎯',
    component: RouletteGame,
  },
  {
    id: 'slot-machine',
    name: '슬롯머신',
    description: '777! 잭팟 음식점은?',
    icon: '🎰',
    component: SlotMachineGame,
  },
];
```

---

## 4. API 설계

### 4.1 GET /api/places

**Request:**
```
GET /api/places?lat=37.5665&lng=126.978&radius=1000
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| lat | number | Yes | - | 위도 |
| lng | number | Yes | - | 경도 |
| radius | number | No | 1000 | 반경 (m) |

**Response (200):**
```json
{
  "restaurants": [
    {
      "placeId": "ChIJ...",
      "name": "맛있는 식당",
      "category": "한식",
      "distance": 350,
      "rating": 4.2,
      "address": "서울시 강남구...",
      "location": { "lat": 37.566, "lng": 126.977 },
      "photoUrl": "https://..."
    }
  ],
  "total": 15
}
```

**Error (400/500):**
```json
{ "error": "Invalid coordinates" }
```

### 4.2 Google Places API 매핑

```
Google Places Nearby Search (New)
POST https://places.googleapis.com/v1/places:searchNearby

Request Body:
{
  "includedTypes": ["restaurant", "cafe", "meal_takeaway"],
  "locationRestriction": {
    "circle": {
      "center": { "latitude": lat, "longitude": lng },
      "radius": radius
    }
  },
  "maxResultCount": 20
}
```

---

## 5. 미니게임 상세 설계

### 5.1 룰렛 (Roulette)

**동작 방식:**
1. 후보 음식점들을 원형 섹터로 배치
2. 사용자가 "돌리기" 클릭
3. CSS `transform: rotate()` + `transition` 으로 회전
4. 랜덤 각도에서 멈춤 → 해당 섹터의 음식점 선택

**기술 구현:**
- 순수 CSS transform + transition (easing: cubic-bezier)
- 최소 3바퀴 + 랜덤 추가 각도
- 회전 시간: 3~5초
- 결과 결정: `Math.random()` 기반 최종 각도 사전 계산

**UI 구성:**
```
     ┌──────────┐
     │  ▼ 포인터 │
     ├──────────┤
     │  ╱ A ╲   │
     │ ╱─────╲  │
     │╱ B │ C ╲ │  ← 원형 회전판
     │╲ D │ E ╱ │
     │ ╲─────╱  │
     │  ╲ F ╱   │
     └──────────┘
     [  돌리기!  ]
```

### 5.2 슬롯머신 (Slot Machine)

**동작 방식:**
1. 3개 릴에 후보 음식점 표시
2. "당기기" 클릭 → 릴 회전 시작
3. 릴이 순차적으로 멈춤 (왼→오, 0.5초 간격)
4. 3개 릴이 같은 음식점 = 당첨 (사전 결정됨)

**기술 구현:**
- Framer Motion `animate` + `transition`
- 릴 = 세로 스크롤 리스트, `translateY` 애니메이션
- 결과는 게임 시작 시 `Math.random()`으로 사전 결정
- 릴 멈춤 타이밍: 1초, 1.5초, 2초

**UI 구성:**
```
┌─────────────────────┐
│  🎰 슬롯머신        │
├─────┬─────┬─────────┤
│ [A] │ [B] │ [C]     │  ← 릴 (세로 스크롤)
│ [B] │ [C] │ [A]     │
│ [C] │ [A] │ [B]     │  ← 중앙 = 결과 라인
│ [D] │ [D] │ [D]     │
│ [E] │ [E] │ [E]     │
├─────┴─────┴─────────┤
│   [ 레버 당기기! ]    │
└─────────────────────┘
```

---

## 6. Hooks 설계

### 6.1 useGeolocation

```typescript
interface GeolocationState {
  coordinates: { lat: number; lng: number } | null;
  error: string | null;
  loading: boolean;
}

function useGeolocation(): GeolocationState & {
  requestPermission: () => void;
};
```

### 6.2 useNearbyPlaces

```typescript
interface NearbyPlacesState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
}

function useNearbyPlaces(
  lat: number | null,
  lng: number | null,
  radius: number
): NearbyPlacesState;
```

---

## 7. 구현 순서

| Step | 파일 | 의존성 |
|------|------|--------|
| 1 | `src/types/index.ts` | 없음 |
| 2 | `src/hooks/use-geolocation.ts` | types |
| 3 | `src/app/api/places/route.ts` | types |
| 4 | `src/hooks/use-nearby-places.ts` | types, API |
| 5 | `src/app/page.tsx` (리팩토링) | hooks |
| 6 | `src/lib/game-registry.ts` | types |
| 7 | `src/components/games/roulette.tsx` | types, framer-motion |
| 8 | `src/components/games/slot-machine.tsx` | types, framer-motion |
| 9 | `src/app/play/page.tsx` | games, hooks |
| 10 | `src/app/result/page.tsx` | types |
| 11 | UI 폴리싱 + 모바일 반응형 | 전체 |

---

## 8. 환경 변수

| 변수 | 용도 | 위치 |
|------|------|------|
| `GOOGLE_PLACES_API_KEY` | Places API 서버 호출 | Vercel env (server only) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | 지도 링크 생성 (선택) | Vercel env (public) |

---

## 9. 의존성 추가

```bash
pnpm add framer-motion
```

> Matter.js는 핀볼 게임 추가 시 설치. MVP에서는 불필요.
