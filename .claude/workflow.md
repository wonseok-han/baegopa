## Development Workflow

### Commands

```bash
pnpm dev          # 개발 서버 (http://localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm check        # lint + typecheck
```

### 구현 완료 후 검증 (필수)

```
1. pnpm check (typecheck + lint)
2. pnpm build (빌드 에러 확인)
3. pnpm dev → 브라우저에서 기능 확인
4. 검증 통과 후에만 커밋/PR 제안
```

> **중요:** 구현 후 `pnpm check` 없이 바로 커밋하지 말 것.

---

## PDCA Auto Behavior (bkit)

### 신규 기능 요청 시

```
사용자: "음식점 검색 API 만들어줘"
Claude:
  1. docs/02-design/features/ 확인
  2. 없으면 bkit-templates 로 design 문서 생성
  3. 설계 기반 구현
  4. 완료 후 gap 분석(/pdca analyze) 제안
```

### 버그 수정 / 리팩터링 시

```
Claude:
  1. 코드 ↔ design 문서 비교
  2. 원인 파악 후 수정
  3. 설계 문서 업데이트 필요 여부 점검
```

### 구현 완료 후 검증 (필수)

```
Claude:
  1. pnpm check (typecheck + lint)
  2. pnpm build (빌드 에러 확인)
  3. 가능하면 dev 서버 기동(pnpm dev)하여 브라우저에서 기능 확인
  4. 검증 통과 후에만 커밋/PR 제안
```

> **중요:** 구현 후 `pnpm check` 없이 바로 커밋하지 말 것.

---

## Project Structure

```
baegopa/
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API Route Handlers
│   │   ├── play/          # 게임 플레이 페이지
│   │   └── result/        # 결과 페이지
│   ├── components/        # 컴포넌트
│   │   ├── games/         # 미니게임들
│   │   ├── restaurant/    # 음식점 관련
│   │   └── ui/            # 공통 UI
│   ├── hooks/             # 커스텀 훅
│   ├── lib/               # 유틸리티
│   └── types/             # 타입 정의
├── public/                # 정적 에셋
├── docs/
│   ├── 01-plan/           # bkit PDCA: Plan 문서
│   ├── 02-design/         # bkit PDCA: Design 문서
│   ├── 03-analysis/       # bkit PDCA: Gap Analysis
│   ├── 04-report/         # bkit PDCA: 완료 리포트
│   └── archive/           # 완료/아카이브
├── .bkit/                 # bkit 런타임 상태
├── CLAUDE.md              # 메인 설정
└── README.md
```

> **구조:** 단일 Next.js 프로젝트. Vercel 배포.
> **형상관리:** GitHub repo + **Trunk-based** (main 보호) + develop + feature 브랜치
> **개발 형태:** 1인 개발

---

## Git 브랜치 워크플로 (필수 준수)

```
main (배포) ← develop (통합) ← feat/xxx (작업)
```

1. **작업 브랜치 생성**: 항상 `develop` 기준으로 생성 (`git checkout -b feat/xxx develop`)
2. **PR 생성**: 항상 `--base develop` 으로 생성. **절대 main 대상 PR을 임의로 만들지 않는다.**
3. **develop 머지**: squash merge
4. **main 머지**: 사용자가 "main에 머지해", "배포하자" 등 **명시적으로 요청할 때만** develop → main PR 생성

> **금지사항:**
> - main 직접 커밋 금지
> - develop 직접 커밋 금지 (초기 셋업 제외)
> - 사용자 요청 없이 main 대상 PR 생성 금지
> - 사용자 요청 없이 main에 머지/push 금지

---

## Deploy

- **Vercel**: GitHub 연동, main 브랜치 push 시 자동 배포
- 환경 변수는 Vercel Dashboard에서 설정

---

## 문서 구조 규칙

### docs/01-plan/ ~ 04-report/ (bkit PDCA)
- 기능 단위 Plan → Design → Do → Analyze → Report 사이클
- 완료되면 `docs/archive/{date}/{feature}` 로 이동

### docs/archive/ (히스토리)
- 완료된 기능 PDCA 문서들
- 읽기 전용 (수정 금지)

### 아카이브 트리거
- Gap analysis 매칭률 ≥ 90% 달성 OR 사용자 명시적 완료 선언
- → `docs/archive/` 로 이동

---

## Key Commands

### 개발 커맨드 (Claude 슬래시)

| 명령 | 설명 |
|---|---|
| `/commit` | staged 변경사항 커밋 (승인 없이 즉시 실행) |
| `/pr` | GitHub PR 생성 (base 브랜치 자동 감지) |
| `/changelog` | 릴리즈용 changelog 생성 |

### bkit PDCA 커맨드

| 명령 | 설명 |
|---|---|
| `/pdca status` | 현재 PDCA 상태 |
| `/pdca plan {feature}` | 기능 플랜 작성 |
| `/pdca design {feature}` | 기능 설계 문서 작성 |
| `/pdca do {feature}` | 구현 가이드 |
| `/pdca analyze {feature}` | 설계 vs 구현 Gap 분석 |
| `/pdca report {feature}` | 완료 리포트 생성 |
| `/code-review <path>` | 코드 리뷰 |
