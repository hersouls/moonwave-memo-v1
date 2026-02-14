import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'

export function TermsModal() {
  const isOpen = useUIStore((state) => state.isTermsModalOpen)
  const onClose = useUIStore((state) => state.closeTermsModal)

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogHeader title="서비스 이용약관" onClose={onClose} />
      <DialogBody className="max-h-[70dvh] overflow-y-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 pr-2">
          {/* ─── 이용약관 ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Memo 서비스 이용약관
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">시행일: 2026년 2월 1일</p>

            {/* 제1조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제1조 (목적)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                이 약관은 Memo 서비스(이하 "서비스")의 이용에 관한 기본적인 사항을 규정함을
                목적으로 합니다. 서비스는 사용자에게 메모 작성, 관리, 저장 및 동기화 기능을
                제공하며, 사용자는 본 약관에 동의함으로써 서비스를 이용할 수 있습니다.
              </p>
            </div>

            {/* 제2조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제2조 (용어의 정의)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>"메모"란 사용자가 서비스를 통해 작성, 저장, 관리하는 텍스트 및 관련 데이터를 의미합니다.</li>
                <li>"사용자"란 본 약관에 동의하고 서비스를 이용하는 자를 의미합니다.</li>
                <li>"서비스"란 Memo 웹 애플리케이션 및 PWA를 통해 제공되는 메모 관리 기능 일체를 의미합니다.</li>
                <li>"동기화"란 사용자의 데이터를 여러 기기 간에 일치시키는 기능을 의미합니다.</li>
                <li>"로컬 저장소"란 사용자의 기기에 데이터를 저장하는 IndexedDB 등의 브라우저 저장 공간을 의미합니다.</li>
              </ul>
            </div>

            {/* 제3조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제3조 (서비스의 내용)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
                서비스는 다음과 같은 기능을 제공합니다.
              </p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>메모 작성, 수정, 삭제 및 관리</li>
                <li>폴더 기반 메모 분류 및 정리</li>
                <li>태그를 통한 메모 검색 및 필터링</li>
                <li>로컬 저장소(IndexedDB)를 이용한 오프라인 데이터 저장</li>
                <li>Google 계정 연동을 통한 클라우드 동기화 (Firebase)</li>
                <li>데이터 백업 및 복원 (JSON 형식)</li>
                <li>테마, 색상, 글꼴 등 개인화 설정</li>
              </ul>
            </div>

            {/* 제4조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제4조 (개인정보 보호)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스는 Google 로그인 시 사용자의 이름, 이메일, 프로필 사진 정보를 수집합니다.</li>
                <li>수집된 정보는 서비스 제공 및 사용자 식별 목적으로만 사용됩니다.</li>
                <li>사용자의 메모 데이터는 로컬 저장소 및 Firebase에 암호화되어 저장됩니다.</li>
                <li>로그인하지 않은 사용자의 데이터는 기기의 로컬 저장소에만 저장되며, 외부 서버로 전송되지 않습니다.</li>
              </ul>
            </div>

            {/* 제5조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제5조 (면책사항)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스는 무료로 제공되며, 서비스 제공자는 서비스 이용으로 인한 직접적 또는 간접적 손해에 대해 책임지지 않습니다.</li>
                <li>브라우저 저장소 삭제, 기기 초기화 등으로 인한 로컬 데이터 손실에 대해 서비스 제공자는 책임지지 않습니다.</li>
                <li>서비스는 사전 공지 없이 일시적으로 중단되거나 변경될 수 있습니다.</li>
                <li>클라우드 동기화 중 발생하는 데이터 충돌이나 손실에 대해 서비스 제공자는 최선의 노력을 다하되, 완전한 복구를 보장하지 않습니다.</li>
                <li>사용자는 중요한 데이터의 정기적인 백업을 권장합니다.</li>
              </ul>
            </div>
          </section>

          {/* ─── 개인정보 처리방침 ──────────────────────── */}
          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-8">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              개인정보 처리방침
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">시행일: 2026년 2월 1일</p>

            {/* 수집하는 개인정보 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                1. 수집하는 개인정보
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
                서비스는 Google 계정 로그인 시 다음의 정보를 수집합니다.
              </p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>Google 계정 이름 (displayName)</li>
                <li>Google 계정 이메일 주소 (email)</li>
                <li>Google 프로필 사진 URL (photoURL)</li>
                <li>Google 고유 사용자 ID (uid)</li>
              </ul>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2">
                로그인하지 않고 서비스를 이용하는 경우, 어떠한 개인정보도 수집하지 않습니다.
              </p>
            </div>

            {/* 개인정보 이용 목적 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                2. 개인정보 이용 목적
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자 식별 및 인증</li>
                <li>클라우드 동기화 서비스 제공</li>
                <li>기기 간 데이터 동기화를 위한 사용자 매칭</li>
                <li>서비스 내 프로필 표시</li>
              </ul>
            </div>

            {/* 개인정보 보관 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                3. 개인정보 보관
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자 인증 정보는 Firebase Authentication에 안전하게 보관됩니다.</li>
                <li>메모 데이터는 기기의 IndexedDB(로컬) 및 Firebase Firestore(클라우드)에 저장됩니다.</li>
                <li>설정 데이터는 브라우저의 LocalStorage에 저장됩니다.</li>
                <li>모든 클라우드 데이터는 Google Cloud Platform의 보안 인프라를 통해 보호됩니다.</li>
              </ul>
            </div>

            {/* 개인정보 삭제 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                4. 개인정보 삭제
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자는 설정 &gt; 시스템 &gt; "모든 데이터 삭제"를 통해 로컬에 저장된 모든 데이터를 삭제할 수 있습니다.</li>
                <li>Google 계정 로그아웃 시 기기에 저장된 인증 정보가 삭제됩니다.</li>
                <li>클라우드에 저장된 데이터의 완전한 삭제를 원하는 경우, 서비스 제공자에게 별도 요청할 수 있습니다.</li>
                <li>서비스 탈퇴 또는 계정 삭제 요청 시, 관련 데이터는 요청일로부터 30일 이내에 완전히 삭제됩니다.</li>
              </ul>
            </div>
          </section>

          {/* ─── 문의 ──────────────────────────────────── */}
          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              본 약관 및 개인정보 처리방침에 대한 문의사항이 있으시면 서비스 내 문의 기능을 이용해 주세요.
            </p>
          </section>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
      </DialogFooter>
    </Dialog>
  )
}
