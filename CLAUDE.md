# 배고파 (Baegopa)

> "배고파, 뭐 먹지?" — 선택 장애를 위한 미니게임 음식점 선택기. 위치 기반으로 주변 음식점을 찾고, 다양한 미니게임(룰렛, 슬롯, 핀볼, 뽑기 등)으로 재미있게 골라주는 앱.

---

## Core Principles

### 1. 심플 & 펀

- 가입 없음, DB 없음, 복잡한 설정 없음
- 위치 공유 → 음식점 조회 → 미니게임으로 선택 — 3단계로 끝
- 재미 요소가 핵심 — UI/UX에 장난기와 유머를 담는다
- 미니게임은 확장 가능한 구조 (룰렛, 슬롯, 핀볼, 뽑기 등)

### 2. No Guessing

모르는 것 → 문서 확인 → 없으면 사용자에게 질문 → 절대 추측 금지.

### 3. Serverless & Stateless

- 서버 상태 없음 (세션, DB, 캐시 불필요)
- Next.js API Routes로 외부 API 프록시만 처리
- Vercel에 올리면 끝

---

## Current Status

**v0.0.0 — 초기 셋업 단계.**

### 목표 기능

- [ ] 위치 정보 수집 (Geolocation API)
- [ ] 반경 설정 (예: 500m, 1km, 2km)
- [ ] 주변 음식점 검색 (외부 Maps/Places API)
- [ ] 미니게임 선택/랜덤 (룰렛, 슬롯, 핀볼, 뽑기 등)
- [ ] 각 미니게임 UI 구현
- [ ] 결과 표시 (가게명, 메뉴, 거리, 링크)

---

## Details (분리된 설정 파일)

@.claude/tech-stack.md
@.claude/conventions.md
@.claude/workflow.md

---

**Project**: 배고파 (Baegopa)
**Level**: Starter/Dynamic hybrid (Next.js fullstack, no DB)
**Deploy**: Vercel
