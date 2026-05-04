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

## Git 브랜치 워크플로

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

---

## Deploy

- **Vercel**: GitHub 연동, main 브랜치 push 시 자동 배포
- 환경 변수는 Vercel Dashboard에서 설정

---

## PDCA 적용 (선택)

이 프로젝트는 심플하므로 PDCA를 강제하지 않음. 다만 복잡한 기능(핀볼 물리 엔진 등) 구현 시에는 설계 문서를 먼저 작성하는 것을 권장.
