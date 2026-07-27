# 배고파 (Baegopa)

> "배고파, 뭐 먹지?" — 위치 기반으로 주변 음식점을 찾고, 플링코/마블 레이스로 하나를 골라주는 앱.

---

## Core Principles

### 1. 심플 & 펀

- 가입 없음, DB 없음, 복잡한 설정 없음
- 위치 공유 → 음식점 조회 → 마블런으로 선택 — 3단계로 끝
- 재미 요소가 핵심 — UI/UX에 장난기와 유머를 담는다
- 현재 게임은 마블런 하나에 집중한다

### 2. No Guessing

모르는 것 → 문서 확인 → 없으면 사용자에게 질문 → 절대 추측 금지.

### 3. Serverless & Stateless

- 서버 상태 없음 (세션, DB, 캐시 불필요)
- Next.js API Routes로 외부 API 프록시만 처리
- Vercel에 올리면 끝

---

## Current Status

**마블런 단일 게임 MVP 구현 완료.**

### 목표 기능

- [x] GPS 또는 장소 검색으로 위치 설정
- [x] 반경 설정 (100m / 300m / 500m / 1km)
- [x] Kakao 로컬 API 주변 음식점 검색
- [x] Matter.js 기반 플링코/마블 레이스
- [x] 결과 표시 (가게명, 카테고리, 거리, 주소, 지도 링크)
- [x] API 입력 검증, 요청 제한, 외부 호출 타임아웃
- [x] 반경·검색 요청 취소 및 세션 캐시

---

## Details (분리된 설정 파일)

@.claude/tech-stack.md
@.claude/conventions.md
@.claude/workflow.md

---

**Project**: 배고파 (Baegopa)
**Level**: Starter/Dynamic hybrid (Next.js fullstack, no DB)
**Deploy**: Vercel
