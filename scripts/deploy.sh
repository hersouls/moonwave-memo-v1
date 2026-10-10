#!/bin/zsh
# Memo → production (https://memo.moonwave.kr): check, commit, push to GitHub master, wait until the live site serves it.
#
#   ./scripts/deploy.sh "fix(ux): 커밋 제목" ["본문 문단" …]   commit everything in the working tree, then deploy
#   ./scripts/deploy.sh                                        nothing to commit: push what is committed, or just verify live
#   ./scripts/deploy.sh --check                                checks only (lint, types, tests, phone screens, audit, build); no commit, no push
#
# This is "the deploy command of this project": people use it, and so do the Moonwave UX fix sessions (uxctl), which
# are allowed to run exactly this one command. Memo is the one Moonwave service not served from the Mac: Vercel builds
# every push to master. So a deploy here IS the commit and the push, and this script does both; do not push by hand
# around it (the checks below are what keeps a broken build off the public site).
#
# It ends with 0 only when the live site reports this commit (dist/version.json, written by buildVersionPlugin in
# vite.config.ts) and the API functions answer. That also holds once production is promoted by CI (promote.yml):
# the wait is on what is live, not on the push.
set -u
setopt pipefail
cd "${0:A:h}/.."

REPO=hersouls/moonwave-memo-v1
SITE=https://memo.moonwave.kr
WAIT_SECONDS=${MEMO_DEPLOY_WAIT:-900}
say() { print -r -- "[deploy] $*" }
die() { print -r -- "[deploy] 실패: $*" >&2; exit 1 }

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && { CHECK_ONLY=1; shift }

[[ "$(git rev-parse --abbrev-ref HEAD)" == "master" ]] || die "master 브랜치에서만 배포해요 (지금: $(git rev-parse --abbrev-ref HEAD))"
git fetch -q origin master || die "origin을 읽지 못했어요"
git merge-base --is-ancestor origin/master HEAD || die "origin/master가 이 작업 폴더보다 앞서 있어요. 먼저 git pull --rebase origin master 로 맞춘 뒤 다시 실행해요"

# ── 1. checks: the same steps CI runs, so a red build never reaches the public site
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  say "의존성 설치 (package-lock.json이 바뀌었어요)"
  npx -y npm@11 install --no-audit --no-fund >/dev/null 2>&1 || die "npm install"
fi
step() { local name=$1; shift; say "검사: $name"; local out; out=$("$@" 2>&1) || { print -r -- "$out" | tail -40 >&2; die "$name" }; }
step "lint"                npm run lint
step "타입 (src)"          npx tsc -b --noEmit
step "타입 (electron)"     npm run typecheck:electron
step "타입 (api)"          npm run typecheck:api
step "테스트"              npm run test:run
# the screens as the owner uses them: phone widths, memos with tags, tables, tasks and a long body (see the script's head)
step "메모가 든 폰 화면"    node scripts/check-screens.mjs
step "운영 의존성 취약점"  npm audit --omit=dev --audit-level=high
step "빌드"                npm run build
git checkout -q -- tsconfig.tsbuildinfo 2>/dev/null   # tracked build artefact; never part of a change
[[ -s dist/index.html && -s dist/version.json ]] || die "빌드 결과에 index.html이나 version.json이 없어요"
(( CHECK_ONLY )) && { say "검사만 했어요. 모두 통과."; exit 0 }

# ── 2. commit what the working tree holds
if [[ -n "$(git status --porcelain)" ]]; then
  [[ $# -ge 1 && -n "${1// /}" ]] || die "커밋할 변경이 있어요. 커밋 제목을 첫 인자로 줘요: ./scripts/deploy.sh \"fix(ux): …\""
  git add -A
  # a secret must never reach the public repository (GitHub push protection is the second net)
  if git diff --cached -U0 | grep -E '^\+' | grep -Eq '(vc[a-z]_[A-Za-z0-9]{40,}|sk-(ant|proj)-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'; then
    git reset -q; die "스테이징한 변경에 토큰이나 키처럼 보이는 값이 있어요. 지운 뒤 다시 실행해요"
  fi
  args=(); for m in "$@"; do args+=(-m "$m"); done
  git commit -q "${args[@]}" || die "git commit"
  say "커밋: $(git log -1 --format='%h %s')"
fi
SHA=$(git rev-parse HEAD)

# ── 3. push (this is the deploy)
if [[ "$(git rev-parse origin/master)" != "$SHA" ]]; then
  PUSHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  git -c credential.helper= -c credential.helper='!gh auth git-credential' push -q origin HEAD:master || die "git push (gh auth status 로 로그인을 확인해요)"
  say "push: ${SHA[1,7]} → origin/master"
else
  PUSHED_AT=""
  say "새 커밋이 없어요. 지금 배포된 것만 확인해요"
fi

# ── 4. wait until the live site is this commit
live_sha() { curl -fsS -m 10 "$SITE/version.json?t=$(date +%s)" 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("sha",""), d.get("builtAt",""))' 2>/dev/null }
deadline=$(( $(date +%s) + WAIT_SECONDS ))
while :; do
  read -r LSHA LBUILT <<<"$(live_sha)"
  [[ "$LSHA" == "$SHA" ]] && break
  state=$(gh api "repos/$REPO/commits/$SHA/status" --jq '.state' 2>/dev/null)
  [[ "$state" == "failure" || "$state" == "error" ]] && die "Vercel 배포가 실패했어요: $(gh api "repos/$REPO/commits/$SHA/statuses" --jq '.[0].description' 2>/dev/null)"
  # a build that could not tell its commit: accept it when it was built after this push and the deployment succeeded
  [[ "$LSHA" == "unknown" && -n "$PUSHED_AT" && "$LBUILT" > "$PUSHED_AT" && "$state" == "success" ]] && break
  (( $(date +%s) > deadline )) && die "${WAIT_SECONDS}초 안에 $SITE 가 ${SHA[1,7]}로 바뀌지 않았어요 (지금: ${LSHA:-읽지 못함}, GitHub 상태: ${state:-없음})"
  sleep 10
done

# ── 5. the functions answer (an import that fails only in Vercel's bundle shows up here, not in the build)
code() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$@" }
[[ "$(code "$SITE/")" == "200" ]] || die "첫 화면이 200이 아니에요"
[[ "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$SITE/api/ai")" == "401" ]] || die "/api/ai 가 로그인 없는 요청에 401로 답하지 않아요"
[[ "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$SITE/api/langchain/tags")" == "401" ]] || die "/api/langchain/tags 가 401로 답하지 않아요 (함수 번들 문제일 수 있어요)"
say "배포 완료: ${SHA[1,7]} → $SITE"
