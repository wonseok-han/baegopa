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
main (배포) ← feat/xxx (작업)
```

- 단순 프로젝트이므로 main + feature 브랜치로 충분
- feature 브랜치에서 작업 → PR → main 머지
- main 직접 커밋은 초기 셋업이나 사소한 수정에만 허용

---

## Deploy

- **Vercel**: GitHub 연동, main 브랜치 push 시 자동 배포
- 환경 변수는 Vercel Dashboard에서 설정

---

## PDCA 적용 (선택)

이 프로젝트는 심플하므로 PDCA를 강제하지 않음. 다만 복잡한 기능(핀볼 물리 엔진 등) 구현 시에는 설계 문서를 먼저 작성하는 것을 권장.
