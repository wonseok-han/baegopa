# 머지 전 수동 CI

`.github/workflows/ci.yml`은 `workflow_dispatch`로만 실행한다. PR 생성·커밋 추가와 `develop`/`main` push로 CI를 자동 실행하지 않는다. 머지할 준비가 되었을 때 현재 PR HEAD를 지정해 한 번 실행하고, 이후 커밋이 바뀌면 새 HEAD로 다시 실행한다.

## 실행 방법

1. PR의 현재 번호, head 브랜치, 전체 40자리 SHA를 확인한다.
   ```sh
   gh pr view <PR번호> --json number,headRefName,headRefOid,baseRefName
   ```
2. GitHub Actions → CI → Run workflow에서 검토된 워크플로가 있는 `develop` 또는 `main`을 선택한다. PR의 head 브랜치나 태그를 워크플로 실행 ref로 선택하지 않는다. `pr_number`, `head_branch`, `head_sha`에는 위에서 확인한 값을 그대로 입력한다.
   ```sh
   gh workflow run ci.yml --ref develop \
     -f pr_number=<PR번호> \
     -f head_branch=<PR-head-브랜치> \
     -f head_sha=<전체-40자리-SHA>
   ```
3. 실행 결과의 모든 job과 summary의 tested commit을 확인한다. 머지 직전에 PR HEAD가 여전히 같은 SHA인지, 기존 필수 검사와 리뷰가 충족됐는지 별도로 확인한다. 이 절차는 머지·배포 권한을 부여하지 않는다.

GitHub 수동 실행을 활성화하려면 기본 브랜치에 `workflow_dispatch`가 정의된 워크플로가 있어야 한다. 이 변경이 `develop`에만 있고 기본 브랜치에 아직 반영되지 않았다면 Run workflow가 나타나지 않을 수 있다. 활성화를 위해 기본 브랜치 변경·main 머지·배포를 임의로 진행하지 않는다.

## 검증과 안전 범위

- 같은 저장소의 열린 PR만 허용한다. base는 `develop`/`main`이며, `main` 대상은 `develop` → `main` PR만 허용한다. fork PR은 거절한다.
- API로 입력 브랜치·SHA와 현재 PR HEAD가 일치하는지 먼저 확인한 후, 그 불변 SHA를 checkout하여 `pnpm check`와 `pnpm build`를 실행한다. 끝난 뒤 별도 runner에서 PR HEAD·base가 바뀌지 않았는지 다시 확인한다.
- 동일 head 브랜치로 새 수동 실행을 시작하면 기존 실행을 취소한다. 커밋 push 자체는 실행이나 취소를 시작하지 않는다.
- PR 코드를 실행하는 job에는 Kakao 등 저장소 secrets를 전달하지 않는다. 빌드는 가짜 키를 사용하므로 실제 Kakao 연동 검증을 대신하지 않는다. checkout 토큰은 읽기 전용이며 Git 설정에 남기지 않는다. PR 코드가 실행되는 runner와 PR API 검증 runner를 분리하고 공유 dependency cache를 사용하지 않는다.
- 수동 실행의 `GITHUB_SHA`와 check run은 선택한 워크플로 ref에 연결될 수 있다. 정확한 PR SHA를 checkout해 테스트해도 PR HEAD의 필수 검사로 자동 인정된다고 보장할 수 없다. 기존 branch protection/ruleset을 변경하거나 검사 상태를 임의로 작성하지 않는다. 필수 검사가 대기 중이면 머지를 중단하고 저장소 관리자의 별도 검토를 받는다. 실행 후 새 커밋이 올라오면 이전 성공은 최신 HEAD 검증이 아니다.

## 그대로 유지되는 자동 동작

- `release.yml`은 변경하지 않는다. 기존과 같이 `main`에 `changelogs/**` 변경이 push되면 릴리즈 워크플로가 실행된다.
- 기존 Vercel의 `main` push 배포 설정, 보안 규칙, 브랜치 보호는 변경하지 않는다.

참고: [GitHub workflow_dispatch 이벤트와 실행 ref](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch), [수동 워크플로 실행](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
