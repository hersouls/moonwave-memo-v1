# Tailwind CSS + Foundation CSS 하이브리드 최적화 가이드

> Moonwave Memo v1.0 프로젝트의 CSS 아키텍처 최적화 방향

## 1. 현재 아키텍처 분석

### 기술 스택
| 항목 | 기술 |
|------|------|
| 유틸리티 프레임워크 | Tailwind CSS 4.x (`@tailwindcss/vite`) |
| 디자인 시스템 | Custom Foundation CSS (15개 모듈) |
| 조건부 클래스 | `clsx` |
| 컴포넌트 라이브러리 | Headless UI (`@headlessui/react`) |
| 빌드 도구 | Vite + PostCSS + Autoprefixer |
| 색상 체계 | OKLCh 색상 공간 |

### Foundation CSS 모듈 구성
```
src/styles/
├── foundation-tokens.css      ← 디자인 토큰 (spacing, shadow, typography, z-index)
├── foundation-grid.css        ← 그리드 레이아웃 시스템
├── foundation-components.css  ← 공통 유틸리티 (divider, typography presets)
├── foundation-button.css      ← 버튼 토큰 & sticky container
├── foundation-input.css       ← 입력 필드 토큰
├── foundation-navigation.css  ← 내비게이션 토큰
├── foundation-card.css        ← 카드 시스템 (8종 카드 + 슬라이더 + 검색)
├── foundation-dialog.css      ← 다이얼로그 & 토스트
├── foundation-bottomsheet.css ← 바텀시트
├── foundation-toast.css       ← 토스트 알림 토큰
├── foundation-tab.css         ← 탭 내비게이션
├── foundation-checkbox.css    ← 체크박스
├── foundation-chip.css        ← 칩/태그
└── foundation-misc.css        ← 기타 유틸리티
```

### 현재 스타일링 패턴 (3가지 혼용)
```tsx
// 패턴 1: Tailwind 유틸리티 직접 사용
className="inline-flex items-center justify-center font-medium"

// 패턴 2: Foundation CSS 변수 + inline style
style={{ background: 'var(--dialog-bg)', boxShadow: 'var(--dialog-shadow)' }}

// 패턴 3: Foundation 클래스 직접 사용
className="dialog-btn dialog-btn--primary dialog-btn--full"
```

---

## 2. 하이브리드 전략: 역할 분리 원칙

### 핵심 원칙: **Foundation = What, Tailwind = How**

| 계층 | Foundation CSS 담당 | Tailwind CSS 담당 |
|------|---------------------|-------------------|
| **디자인 토큰** | CSS 변수 정의 (`--spacing-*`, `--color-*`, `--shadow-*`) | 토큰을 `@theme`에 등록하여 유틸리티 클래스 자동 생성 |
| **컴포넌트 스켈레톤** | 복합 컴포넌트의 구조적 스타일 (`.card`, `.dialog`, `.toast`) | - |
| **레이아웃** | - | Flexbox, Grid, Spacing, Positioning |
| **타이포그래피** | 시맨틱 프리셋 (`.f-heading2`, `.f-body1`) | 개별 텍스트 조정 (`text-sm`, `font-bold`) |
| **상호작용** | hover/active/disabled 상태 변화 (토큰 기반) | 반응형, 조건부 스타일 (`md:`, `dark:`, `hover:`) |
| **다크모드** | CSS 변수 오버라이드 (`.dark { ... }`) | `dark:` variant 사용 |
| **애니메이션** | 키프레임 정의 + 유틸리티 클래스 | `transition-*`, `duration-*` 유틸리티 |
| **접근성** | 포커스 스타일, skip-link | `sr-only`, `focus-visible:` |

### 의사결정 플로우차트

```
새로운 스타일이 필요한가?
│
├─ 디자인 시스템 토큰인가? (색상, 간격, 그림자, 타이포 스케일)
│  └─ YES → Foundation CSS 변수로 정의 → @theme에 등록
│
├─ 재사용 가능한 복합 컴포넌트인가? (카드, 다이얼로그, 토스트 등)
│  └─ YES → Foundation CSS 클래스로 정의 (BEM 네이밍)
│
├─ 레이아웃/배치 관련인가? (정렬, 간격, 위치, 반응형)
│  └─ YES → Tailwind 유틸리티 클래스 사용
│
├─ 단일 속성 조정인가? (색상 하나, 패딩 하나)
│  └─ YES → Tailwind 유틸리티 클래스 사용
│
└─ 상태 기반 스타일인가? (hover, focus, disabled)
   ├─ Foundation 컴포넌트 내부 → Foundation 토큰 + CSS 클래스
   └─ Tailwind 영역 → `hover:`, `focus:` variant
```

---

## 3. 디자인 토큰 통합 전략

### 3.1 Foundation 토큰을 Tailwind `@theme`에 등록

현재 Foundation 토큰이 `:root`과 `@theme`에 분산되어 있습니다. 통합 방향:

```css
/* foundation-tokens.css */
@theme {
  /* ✅ Tailwind가 유틸리티 클래스를 자동 생성 */
  --radius-4: 4px;
  --radius-8: 8px;
  --radius-12: 12px;
  --radius-16: 16px;

  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-2: 0 4px 16px rgba(0, 0, 0, 0.08);
  --shadow-3: 0 16px 40px rgba(0, 0, 0, 0.12);
}

:root {
  /* ✅ 컴포넌트 전용 토큰은 :root에 유지 */
  --dialog-width: 320px;
  --dialog-padding: 24px;
  --card-padding-sm: 12px;
}
```

**원칙:**
- **범용 토큰** (spacing, radius, shadow, color) → `@theme`에 등록 → `rounded-radius-12`, `shadow-shadow-2` 등 자동 생성
- **컴포넌트 전용 토큰** (dialog-width, card-padding 등) → `:root`에 유지 → Foundation 클래스에서만 사용

### 3.2 Spacing 토큰 통합

현재 `:root`에 있는 spacing 토큰을 `@theme`으로 이동하면 Tailwind 유틸리티를 직접 생성할 수 있습니다.

```css
/* 현재 (`:root`) */
:root {
  --spacing-8: 8px;
  --spacing-16: 16px;
}

/* 최적화 후 (`@theme`) */
@theme {
  --spacing-2: 2px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
}
```

이렇게 하면 `p-spacing-16`, `gap-spacing-8` 같은 클래스를 사용할 수 있습니다.

### 3.3 Typography 토큰 통합

Foundation 타이포 프리셋(`.f-heading2` 등)을 유지하되, Tailwind에서도 접근 가능하게 합니다.

```css
@theme {
  --text-heading2-size: 1.5rem;
  --text-title1-size: 1.25rem;
  --text-body1-size: 1rem;
  --text-body2-size: 0.9375rem;
  --text-label3-size: 0.8125rem;
}
```

**사용 가이드:**
- 시맨틱 타이포그래피가 필요할 때 → `.f-heading2`, `.f-body1` (Foundation 프리셋)
- 개별 폰트 크기만 필요할 때 → `text-[var(--text-body1-size)]` (Tailwind arbitrary value)

---

## 4. 컴포넌트 개발 가이드라인

### 4.1 Foundation 컴포넌트 (CSS 클래스 기반)

**적합한 경우:** 복잡한 상태 전환이 있는 재사용 컴포넌트

```tsx
// ✅ 좋은 예: Foundation 컴포넌트 + Tailwind 레이아웃
function DialogExample() {
  return (
    <div className="dialog-overlay">
      <div className={clsx(
        'dialog dialog--entering',  // Foundation: 컴포넌트 구조
        'mx-4'                       // Tailwind: 레이아웃 조정
      )}>
        <h2 className="dialog__title">제목</h2>
        <p className="dialog__body">내용</p>
        <div className={clsx(
          'dialog__actions',          // Foundation: 액션 영역
          'flex gap-2'                // Tailwind: 레이아웃 (Foundation과 겹치면 Tailwind 제거)
        )}>
          <button className="dialog-btn dialog-btn--secondary dialog-btn--full">취소</button>
          <button className="dialog-btn dialog-btn--primary dialog-btn--full">확인</button>
        </div>
      </div>
    </div>
  );
}
```

### 4.2 Tailwind 우선 컴포넌트

**적합한 경우:** 단순 UI, 레이아웃 중심, 재사용 빈도 낮음

```tsx
// ✅ 좋은 예: Tailwind 유틸리티 + Foundation 토큰
function SimpleCard({ title, description }: Props) {
  return (
    <div className={clsx(
      'rounded-[var(--radius-16)]',             // Foundation 토큰 참조
      'bg-[var(--card-bg-default)]',             // Foundation 토큰 참조
      'shadow-[var(--shadow-1)]',                // Foundation 토큰 참조
      'p-4 flex flex-col gap-2',                 // Tailwind 레이아웃
      'hover:shadow-[var(--shadow-2)]',          // Tailwind + Foundation 토큰
      'transition-shadow duration-200'            // Tailwind 트랜지션
    )}>
      <h3 className="f-title2">{title}</h3>       {/* Foundation 타이포 */}
      <p className="f-body2 text-zinc-500">{description}</p>
    </div>
  );
}
```

### 4.3 피해야 할 패턴

```tsx
// ❌ 나쁜 예 1: Foundation과 Tailwind 속성 충돌
className="dialog-btn p-4 rounded-lg"
// dialog-btn이 이미 padding, border-radius를 가지고 있어 충돌

// ❌ 나쁜 예 2: inline style로 토큰 사용 (불필요한 런타임 비용)
style={{ borderRadius: 'var(--radius-16)', padding: 'var(--spacing-16)' }}
// → className="rounded-[var(--radius-16)] p-[var(--spacing-16)]" 로 대체

// ❌ 나쁜 예 3: Foundation 클래스를 Tailwind로 재구현
className="w-80 bg-white rounded-2xl p-6 shadow-lg"
// → className="dialog" 로 대체 (이미 Foundation에 정의됨)

// ❌ 나쁜 예 4: 같은 속성을 두 시스템에서 동시 정의
className="card hover:shadow-lg"
// card가 이미 hover shadow를 정의하므로 충돌 가능
```

---

## 5. 다크모드 최적화 전략

### 현재 문제점
1. Foundation: `.dark { --var: value }` 패턴
2. Tailwind: `dark:bg-zinc-900` 패턴
3. 하드코딩된 색상값: `#18181b`, `#f4f4f5` 등이 Foundation CSS에 직접 사용

### 최적화 방향

#### 5.1 Neutral 색상 토큰화

Foundation CSS에서 하드코딩된 zinc 계열 색상을 시맨틱 토큰으로 전환합니다.

```css
/* 추가할 시맨틱 토큰 */
:root {
  --color-bg-primary: white;
  --color-bg-secondary: #fafafa;
  --color-bg-tertiary: #f4f4f5;
  --color-bg-elevated: white;

  --color-text-primary: #09090b;
  --color-text-secondary: #71717a;
  --color-text-tertiary: #a1a1aa;
  --color-text-inverse: white;

  --color-border-default: #e4e4e7;
  --color-border-subtle: #f4f4f5;

  --color-surface-hover: #fafafa;
  --color-surface-active: #f4f4f5;
}

.dark {
  --color-bg-primary: #09090b;
  --color-bg-secondary: #18181b;
  --color-bg-tertiary: #27272a;
  --color-bg-elevated: #27272a;

  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-tertiary: #71717a;
  --color-text-inverse: #09090b;

  --color-border-default: #3f3f46;
  --color-border-subtle: #27272a;

  --color-surface-hover: #3f3f46;
  --color-surface-active: #52525b;
}
```

#### 5.2 Foundation 컴포넌트에서 시맨틱 토큰 참조

```css
/* Before: 하드코딩 */
.list-item--button:hover { background: #fafafa; }
.dark .list-item--button:hover { background: #3f3f46; }

/* After: 시맨틱 토큰 */
.list-item--button:hover { background: var(--color-surface-hover); }
/* .dark 오버라이드 불필요 → 토큰이 자동으로 다크모드 값 제공 */
```

**효과:** `.dark` 오버라이드 블록을 대폭 줄일 수 있고, 새 컴포넌트에서 다크모드를 별도 처리할 필요 없음.

#### 5.3 Tailwind에서의 다크모드

```tsx
// ✅ Foundation 토큰으로 자동 다크모드
className="text-[var(--color-text-secondary)]"
// 다크모드에서 자동으로 올바른 색상 적용

// ⚠️ Tailwind dark: variant는 토큰이 없는 일회성 스타일에만
className="bg-zinc-100 dark:bg-zinc-800"
```

---

## 6. 번들 최적화

### 6.1 Foundation CSS 모듈 분석

현재 15개 모듈 중 실제 프로젝트에서 사용되는 컴포넌트를 파악하여 불필요한 모듈을 제거합니다.

**사용 빈도 분석 체크리스트:**
```
[확인필요] foundation-card.css      → 카드 8종 중 실제 사용되는 것?
[확인필요] foundation-grid.css      → Tailwind grid로 대체 가능?
[확인필요] foundation-navigation.css → 실제 사용 중?
[확인필요] foundation-chip.css      → 실제 사용 중?
```

### 6.2 사용하지 않는 Foundation 클래스 제거

```bash
# 프로젝트에서 사용되지 않는 Foundation 클래스 탐색
grep -r "product-card\|imgcard\|fullimg-card\|logo-card\|event-card\|benefit-card\|file-card\|imglist" src/components/ src/pages/
```

결과에 따라 해당 클래스 정의를 제거합니다.

### 6.3 Tailwind CSS 4 자동 퍼징

Tailwind CSS 4는 자동으로 사용되지 않는 유틸리티를 제거하지만, Foundation CSS는 수동 관리가 필요합니다.

**권장 방법: CSS Layers 활용**

```css
/* index.css */
@import "tailwindcss";

/* Foundation을 별도 레이어로 분리 */
@layer foundation {
  @import "./styles/foundation-tokens.css";
  @import "./styles/foundation-components.css";
  @import "./styles/foundation-button.css";
  /* ... */
}
```

레이어 분리의 장점:
- 스타일 우선순위 명확화 (`@layer` 순서로 제어)
- 충돌 디버깅 용이
- 미래에 treeshaking 도구 적용 가능

### 6.4 CSS 번들 크기 모니터링

```bash
# 빌드 후 CSS 번들 크기 확인
npx vite build && ls -lh dist/assets/*.css
```

---

## 7. 성능 최적화 체크리스트

### 7.1 CSS 변수 성능

| 항목 | 권장 |
|------|------|
| 자주 변경되는 토큰 | `:root`보다 해당 컴포넌트 스코프에 정의 |
| 애니메이션 속성 | CSS 변수 대신 직접 값 사용 (리페인트 최소화) |
| 팔레트 전환 | `data-palette` 속성 변경 → CSS 변수 일괄 교체 (현재 방식 유지) |

### 7.2 Tailwind 최적화

| 항목 | 권장 |
|------|------|
| Arbitrary value 남용 | `text-[var(--x)]` 반복 → Foundation 프리셋 클래스 생성 |
| 클래스 수 폭발 | 5개 이상 조건부 → Foundation 컴포넌트 클래스로 추출 |
| `@apply` 사용 | 최소화 (번들 증가) → Foundation 클래스 또는 Tailwind 유틸리티 직접 사용 |

### 7.3 렌더링 성능

```css
/* ✅ 좋은 예: will-change를 애니메이션 시작 시에만 적용 */
.dialog--entering {
  will-change: transform, opacity;
  animation: dialog-enter 200ms ease-out;
}

/* ❌ 나쁜 예: 항상 will-change */
.dialog {
  will-change: transform, opacity; /* GPU 메모리 낭비 */
}
```

---

## 8. 네이밍 컨벤션 규칙

### Foundation CSS
- **BEM 네이밍**: `block__element--modifier`
- **토큰 프리픽스**: `--component-property-variant` (예: `--dialog-btn-primary-bg`)
- **클래스 프리픽스**: 컴포넌트별 고유 프리픽스 (`card-`, `dialog-`, `toast-`, `list-`)

### Tailwind CSS
- **유틸리티 클래스**: 표준 Tailwind 클래스명 사용
- **Arbitrary value**: `[var(--token)]` 형식으로 Foundation 토큰 참조
- **Custom variant**: `dark:`, `fold:` 등 프로젝트 커스텀 variant 활용

### 충돌 방지 규칙
1. Foundation 컴포넌트에 이미 정의된 속성을 Tailwind로 덮어쓰지 않기
2. 같은 요소에 `style={{ }}` + Tailwind 클래스 동시 사용 최소화
3. Foundation 클래스와 Tailwind 클래스를 사용할 때 `clsx`로 분리 그룹핑

```tsx
className={clsx(
  // Foundation 컴포넌트 클래스
  'dialog-btn dialog-btn--primary',
  // Tailwind 레이아웃 보조
  'mt-2 w-full',
  // 조건부
  disabled && 'opacity-50 pointer-events-none'
)}
```

---

## 9. 마이그레이션 로드맵

### Phase 1: 토큰 통합 (즉시)
- [ ] 시맨틱 색상 토큰 추가 (`--color-bg-primary`, `--color-text-*` 등)
- [ ] Foundation spacing 토큰을 `@theme`으로 이동
- [ ] 하드코딩된 색상값을 시맨틱 토큰으로 교체

### Phase 2: 불필요 코드 제거 (1주차)
- [ ] 사용하지 않는 Foundation 모듈/클래스 파악
- [ ] 미사용 카드 컴포넌트 정의 제거 (product-card, imgcard 등)
- [ ] 중복된 Tailwind + Foundation 스타일 정리

### Phase 3: CSS Layers 도입 (2주차)
- [ ] `@layer foundation` 적용
- [ ] 스타일 우선순위 정리
- [ ] 충돌 케이스 테스트

### Phase 4: 컴포넌트 리팩토링 (3-4주차)
- [ ] inline `style={{ }}` → Tailwind arbitrary value 또는 Foundation 클래스로 전환
- [ ] 공통 패턴 → Foundation 유틸리티 클래스 추출
- [ ] 다크모드 시맨틱 토큰 전체 적용

### Phase 5: 최적화 검증 (5주차)
- [ ] CSS 번들 크기 before/after 비교
- [ ] Lighthouse 성능 점수 확인
- [ ] 다크모드 전환 깜빡임 테스트
- [ ] 모바일(Galaxy Fold 포함) 반응형 검증

---

## 10. 빠른 참조 요약

```
┌─────────────────────────────────────────────────────┐
│         Tailwind + Foundation 하이브리드 규칙        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Foundation CSS 사용 시점:                           │
│  ✓ 디자인 토큰 정의 (색상, 간격, 그림자, 타이포)      │
│  ✓ 복합 컴포넌트 (카드, 다이얼로그, 토스트)           │
│  ✓ 다크모드 CSS 변수 오버라이드                       │
│  ✓ 키프레임 애니메이션 정의                           │
│                                                     │
│  Tailwind CSS 사용 시점:                             │
│  ✓ 레이아웃 (flex, grid, positioning)                │
│  ✓ 반응형 디자인 (md:, lg:, fold:)                   │
│  ✓ 단일 속성 조정 (margin, padding, color)           │
│  ✓ 상태 variant (hover:, focus:, disabled:)          │
│  ✓ 일회성 스타일 (특정 컴포넌트에만 필요한 스타일)      │
│                                                     │
│  금지 사항:                                          │
│  ✗ Foundation 속성을 Tailwind로 덮어쓰기              │
│  ✗ 같은 속성을 두 시스템에서 동시 정의                 │
│  ✗ inline style과 Tailwind 동시 사용 (같은 속성)      │
│  ✗ @apply 남용                                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 부록: 현재 Foundation CSS 변수 목록

### 범용 토큰 (Tailwind @theme 등록 권장)
- `--radius-{4,6,8,12,16,circle}`
- `--shadow-{1,2,3}`
- `--spacing-{2,4,8,12,16,20,24,32,40,48,56,64,80}`
- `--color-primary-{50~900}`
- `--color-success-{50~950}`
- `--color-warning-{50~950}`
- `--color-danger-{50~950}`

### 컴포넌트 전용 토큰 (`:root` 유지)
- `--dialog-*` (17개)
- `--card-*` (28개)
- `--toast-*` (22개)
- `--btn-*` (5개)
- `--list-*` (16개)
- `--slider-*` (16개)
- `--search-*` (5개)
- `--z-*` (9개)
- `--text-*` (15개, 타이포그래피)
