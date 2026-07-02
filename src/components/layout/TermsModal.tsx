import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'

export function TermsModal() {
  const isOpen = useUIStore((state) => state.isTermsModalOpen)
  const onClose = useUIStore((state) => state.closeTermsModal)

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogHeader title="서비스 이용약관" onClose={onClose} />
      <DialogBody className="max-h-[70dvh] fold:max-h-[60dvh] overflow-y-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 pr-2">
          {/* ─── 이용약관 ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Memo 서비스 이용약관
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">시행일: 2026년 2월 15일</p>

            {/* 제1조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제1조 (목적)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                이 약관은 Moonwave(이하 "서비스 제공자")가 제공하는 Memo 서비스(이하 "서비스")의
                이용에 관한 기본적인 사항을 규정함을 목적으로 합니다. 서비스는 웹 애플리케이션 및
                프로그레시브 웹 앱(PWA)의 형태로 제공되며, 사용자에게 메모 작성·관리·저장·동기화
                및 AI 기반 부가 기능을 제공합니다. 사용자는 본 약관에 동의함으로써 서비스를
                이용할 수 있습니다.
              </p>
            </div>

            {/* 제2조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제2조 (용어의 정의)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li><strong>"메모"</strong>란 사용자가 서비스를 통해 작성·저장·관리하는 텍스트, 마크다운, 태그, 이미지 및 관련 메타데이터를 의미합니다.</li>
                <li><strong>"사용자"</strong>란 본 약관에 동의하고 서비스를 이용하는 자를 의미합니다.</li>
                <li><strong>"서비스"</strong>란 Memo 웹 애플리케이션 및 PWA를 통해 제공되는 메모 관리 기능 일체를 의미합니다.</li>
                <li><strong>"동기화"</strong>란 Google 계정 연동 시 사용자의 데이터를 Firebase Firestore를 통해 여러 기기 간에 실시간으로 일치시키는 기능을 의미합니다.</li>
                <li><strong>"로컬 저장소"</strong>란 사용자의 기기에 데이터를 저장하는 IndexedDB 및 LocalStorage 등의 브라우저 저장 공간을 의미합니다.</li>
                <li><strong>"AI 기능"</strong>이란 사용자가 직접 입력한 외부 API 키(OpenAI, Anthropic)를 통해 제공되는 음성 인식(STT), 이미지 텍스트 추출(OCR), 자동완성, 태그 제안, 요약 등의 부가 기능을 의미합니다.</li>
                <li><strong>"API 키"</strong>란 외부 AI 서비스(OpenAI, Anthropic)에 접근하기 위해 사용자가 직접 발급·입력하는 인증 키를 의미합니다.</li>
                <li><strong>"PWA"</strong>란 Progressive Web App의 약자로, 브라우저에서 설치하여 네이티브 앱처럼 사용할 수 있는 웹 애플리케이션 형태를 의미합니다.</li>
                <li><strong>"버전 기록"</strong>이란 메모의 편집 이력을 로컬에 저장하여 이전 버전으로 복원할 수 있는 기능을 의미합니다.</li>
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

              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-3 mb-1">가. 기본 메모 기능</p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
                <li>메모 작성, 수정, 삭제 및 관리</li>
                <li>마크다운(Markdown) 문법을 활용한 서식 편집 및 미리보기</li>
                <li>슬래시 명령(/) 메뉴를 통한 빠른 서식 입력 (제목, 목록, 체크리스트, 코드 블록, 인용, 구분선)</li>
                <li>텍스트 선택 시 플로팅 툴바 (굵게, 기울임, 코드, 링크)</li>
                <li>메모 버전 기록 및 이전 버전 복원 (단어 단위 변경 비교 제공)</li>
                <li>메모 즐겨찾기(별표) 및 고정(핀)</li>
                <li>메모 색상 지정 (흰색, 노랑, 초록, 파랑, 핑크, 보라)</li>
              </ul>

              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-3 mb-1">나. 정리 및 검색</p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
                <li>폴더 기반 메모 분류 및 정리 (사용자 폴더 생성·수정·삭제)</li>
                <li>태그 기반 메모 분류 (해시태그 자동 변환 옵션 포함)</li>
                <li>전체 텍스트 검색 및 필터링 (기간별, 색상별, 즐겨찾기 필터)</li>
                <li>명령 팔레트를 통한 빠른 탐색</li>
                <li>목록 보기 및 그리드 보기 전환</li>
                <li>여러 메모 일괄 선택 및 일괄 작업 (삭제, 이동, 즐겨찾기)</li>
              </ul>

              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-3 mb-1">다. AI 부가 기능 (API 키 필요)</p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
                <li>음성 인식(STT): 음성 파일 업로드 또는 직접 녹음을 통한 텍스트 변환 (OpenAI Whisper 사용, 최대 25MB)</li>
                <li>이미지 OCR: 이미지 업로드 또는 카메라 촬영을 통한 텍스트 추출 (GPT-4o Vision 또는 Claude Sonnet 사용, 최대 20MB)</li>
                <li>AI 자동완성: 메모 작성 중 문맥 기반 문장 제안</li>
                <li>자동 태그 제안: 메모 내용 분석을 통한 태그 추천</li>
                <li>메모 요약: 긴 메모의 2~3문장 요약 생성</li>
              </ul>

              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-3 mb-1">라. 저장 및 동기화</p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
                <li>로컬 저장소(IndexedDB)를 이용한 오프라인 데이터 저장</li>
                <li>Google 계정 연동을 통한 Firebase Firestore 클라우드 동기화</li>
                <li>데이터 백업(JSON 형식) 및 복원</li>
                <li>삭제된 메모의 휴지통 보관 및 복원</li>
              </ul>

              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-3 mb-1">마. 개인화 및 기타</p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
                <li>테마 설정 (라이트, 다크, 시스템 자동 감지)</li>
                <li>색상 팔레트 변경 (기본, 오션, 로즈, 퍼플, 포레스트)</li>
                <li>글꼴 및 글자 크기 설정</li>
                <li>고대비 모드 (접근성)</li>
                <li>PWA 설치를 통한 오프라인 및 네이티브 앱 형태 이용</li>
                <li>활동 히트맵, 연속 기록(스트릭), 마일스톤 배지 등 동기부여 기능</li>
                <li>키보드 단축키 지원</li>
              </ul>
            </div>

            {/* 제4조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제4조 (서비스 이용 조건)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스는 최신 웹 브라우저(Chrome, Edge, Safari, Firefox 등)에서 이용할 수 있습니다. 구형 브라우저에서는 일부 기능이 제한될 수 있습니다.</li>
                <li>클라우드 동기화를 이용하려면 Google 계정으로 로그인해야 합니다. Google 계정 없이도 로컬 저장을 통해 모든 기본 기능을 이용할 수 있습니다.</li>
                <li>AI 기능을 이용하려면 사용자가 직접 OpenAI 또는 Anthropic에서 API 키를 발급받아 서비스에 입력해야 합니다. API 키 발급 및 이용에 따른 비용은 전적으로 사용자의 부담입니다.</li>
                <li>PWA 설치는 선택 사항이며, 브라우저를 통해서도 동일한 기능을 이용할 수 있습니다.</li>
              </ul>
            </div>

            {/* 제5조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제5조 (사용자의 의무)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자는 자신의 API 키를 안전하게 관리할 책임이 있으며, API 키의 유출·도용으로 인한 피해에 대해 서비스 제공자는 책임지지 않습니다.</li>
                <li>사용자는 서비스를 이용하여 법령에 위반되는 콘텐츠를 작성·저장·전송해서는 안 됩니다.</li>
                <li>사용자는 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.</li>
                <li>사용자는 타인의 개인정보, 지적재산권 등의 권리를 침해해서는 안 됩니다.</li>
                <li>사용자는 중요한 데이터의 정기적인 백업을 권장합니다.</li>
              </ul>
            </div>

            {/* 제6조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제6조 (AI 기능 이용)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>AI 기능은 사용자가 직접 입력한 외부 API 키를 통해 작동하며, 서비스 제공자는 AI 기능을 위한 별도의 서버를 운영하지 않습니다.</li>
                <li>사용자가 입력한 API 키는 사용자의 브라우저(LocalStorage)에만 저장되며, 서비스 제공자의 서버로 전송되지 않습니다.</li>
                <li>AI 기능 이용 시, 사용자의 메모 내용(텍스트, 이미지, 음성 파일)이 해당 API 제공사(OpenAI, Anthropic)의 서버로 직접 전송됩니다. 이에 대한 데이터 처리는 각 API 제공사의 이용약관 및 개인정보처리방침을 따릅니다.</li>
                <li>AI 기능이 생성한 결과물(텍스트 변환, 태그 제안, 요약, 자동완성 등)의 정확성이나 완전성을 보장하지 않으며, 사용자는 결과물을 검토하고 필요에 따라 수정해야 합니다.</li>
                <li>AI 기능의 이용은 선택 사항이며, API 키를 입력하지 않아도 메모의 모든 기본 기능을 이용할 수 있습니다.</li>
                <li>API 키 발급·이용에 따르는 비용 및 해당 API 제공사의 이용 정책 준수 의무는 사용자에게 있습니다.</li>
              </ul>
            </div>

            {/* 제7조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제7조 (데이터 저장 및 동기화)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자의 메모, 폴더, 이미지, 버전 기록은 기본적으로 브라우저의 IndexedDB에 로컬 저장됩니다.</li>
                <li>설정 데이터(테마, 글꼴, API 키, 개인화 옵션 등)는 브라우저의 LocalStorage에 저장됩니다.</li>
                <li>Google 계정으로 로그인한 경우, 메모와 폴더 데이터가 Firebase Firestore를 통해 클라우드에 동기화됩니다.</li>
                <li>동기화 중 데이터 충돌이 발생하는 경우, 가장 최근에 수정된 데이터가 우선 적용됩니다. 서비스 제공자는 충돌 해결을 위해 최선의 노력을 다하되, 완전한 복구를 보장하지 않습니다.</li>
                <li>사용자는 설정 메뉴를 통해 전체 데이터를 JSON 형식으로 백업하거나, 백업 파일을 가져와 데이터를 복원할 수 있습니다.</li>
                <li>메모 삭제 시 즉시 영구 삭제되지 않고 휴지통으로 이동되며, 사용자가 영구 삭제를 선택하기 전까지 복원이 가능합니다.</li>
              </ul>
            </div>

            {/* 제8조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제8조 (지식재산권)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스의 소스 코드, 디자인, 기능, 상표 등 지식재산권은 서비스 제공자에게 귀속됩니다.</li>
                <li>사용자가 작성한 메모, 업로드한 이미지 및 음성 파일 등 사용자 콘텐츠에 대한 소유권은 사용자에게 있습니다.</li>
                <li>서비스 제공자는 사용자 콘텐츠에 대해 서비스 운영 및 동기화 제공에 필요한 범위 내에서만 제한적 이용 권한을 가집니다.</li>
              </ul>
            </div>

            {/* 제9조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제9조 (면책사항)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스는 무료로 제공되며, 서비스 제공자는 서비스 이용으로 인한 직접적 또는 간접적 손해에 대해 책임지지 않습니다.</li>
                <li>브라우저 데이터 삭제, 기기 초기화, 브라우저 저장소 정리 등으로 인한 로컬 데이터 손실에 대해 서비스 제공자는 책임지지 않습니다.</li>
                <li>클라우드 동기화 중 발생하는 데이터 충돌, 지연 또는 손실에 대해 서비스 제공자는 최선을 다하되 완전한 복구를 보장하지 않습니다.</li>
                <li>AI 기능의 결과물(텍스트 변환, 요약, 태그 제안 등)의 정확성, 적절성에 대해 서비스 제공자는 책임지지 않습니다.</li>
                <li>제3자 서비스(Google, Firebase, OpenAI, Anthropic 등)의 장애, 정책 변경, 서비스 중단으로 인한 영향에 대해 서비스 제공자는 책임지지 않습니다.</li>
                <li>서비스는 사전 공지 없이 일시적으로 중단되거나 변경, 종료될 수 있습니다.</li>
                <li>사용자의 API 키 관리 소홀로 인한 비용 발생 또는 보안 사고에 대해 서비스 제공자는 책임지지 않습니다.</li>
              </ul>
            </div>

            {/* 제10조 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                제10조 (약관의 변경)
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스 제공자는 필요한 경우 본 약관을 변경할 수 있으며, 변경 시 앱 내에 공지합니다.</li>
                <li>변경된 약관은 공지된 시행일부터 효력이 발생합니다.</li>
                <li>사용자가 변경된 약관의 시행일 이후에도 계속하여 서비스를 이용하는 경우, 변경된 약관에 동의한 것으로 간주합니다.</li>
              </ul>
            </div>
          </section>

          {/* ─── 개인정보 처리방침 ──────────────────────── */}
          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-8">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              개인정보 처리방침
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">시행일: 2026년 2월 15일</p>

            {/* 1. 수집하는 개인정보 */}
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
                모든 데이터는 사용자의 기기에만 저장됩니다.
              </p>
            </div>

            {/* 2. 개인정보 이용 목적 */}
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

            {/* 3. 개인정보 보관 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                3. 개인정보 보관
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자 인증 정보는 Firebase Authentication에 안전하게 보관됩니다.</li>
                <li>메모 및 폴더 데이터는 기기의 IndexedDB(로컬) 및 Firebase Firestore(클라우드)에 저장됩니다.</li>
                <li>설정 및 API 키 데이터는 브라우저의 LocalStorage에 저장되며, 서비스 제공자의 서버로 전송되지 않습니다.</li>
                <li>메모 버전 기록 및 이미지 데이터는 기기의 IndexedDB에 로컬 저장됩니다.</li>
                <li>모든 클라우드 데이터는 Google Cloud Platform의 보안 인프라를 통해 보호됩니다.</li>
              </ul>
            </div>

            {/* 4. 제3자 제공 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                4. 제3자 제공
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
                서비스는 다음의 경우에 한하여 사용자 데이터가 제3자에게 전달될 수 있습니다.
              </p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li><strong>Firebase / Google Cloud Platform:</strong> Google 계정 로그인 시, 인증 정보 및 메모·폴더 데이터가 동기화를 위해 Firebase에 저장됩니다.</li>
                <li><strong>OpenAI:</strong> 사용자가 OpenAI API 키를 입력하고 AI 기능을 사용하는 경우, 메모 텍스트(최대 3,000자), 이미지(최대 20MB), 음성 파일(최대 25MB)이 OpenAI 서버로 직접 전송됩니다.</li>
                <li><strong>Anthropic:</strong> 사용자가 Anthropic API 키를 입력하고 AI 기능을 사용하는 경우, 메모 텍스트 및 이미지가 Anthropic 서버로 직접 전송됩니다.</li>
              </ul>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2">
                AI 기능을 사용하지 않는 경우(API 키 미입력), 메모 콘텐츠는 AI 제공사에 전송되지 않습니다.
                모든 API 호출은 사용자의 브라우저에서 해당 서비스로 직접 이루어지며, 서비스 제공자의 서버를 경유하지 않습니다.
              </p>
            </div>

            {/* 5. 개인정보 삭제 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                5. 개인정보 삭제
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>사용자는 설정 &gt; 시스템 &gt; "모든 데이터 삭제"를 통해 로컬에 저장된 모든 데이터(메모, 폴더, 설정, API 키)를 삭제할 수 있습니다.</li>
                <li>Google 계정 로그아웃 시 기기에 저장된 인증 정보가 삭제됩니다.</li>
                <li>클라우드에 저장된 데이터의 완전한 삭제를 원하는 경우, 서비스 제공자에게 별도 요청할 수 있습니다.</li>
                <li>서비스 탈퇴 또는 계정 삭제 요청 시, 관련 데이터는 요청일로부터 30일 이내에 완전히 삭제됩니다.</li>
                <li>브라우저의 사이트 데이터 삭제 기능을 통해서도 로컬 데이터를 삭제할 수 있습니다.</li>
              </ul>
            </div>

            {/* 6. 쿠키 및 추적 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                6. 쿠키 및 추적
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스는 쿠키(Cookie)를 사용하지 않습니다.</li>
                <li>제3자 추적 스크립트(Google Analytics 등)를 포함하지 않습니다.</li>
                <li>서비스는 사용자 설정 저장을 위해 브라우저의 LocalStorage만 사용하며, 이는 사용자의 기기를 떠나지 않습니다.</li>
                <li>Firebase Authentication은 인증 세션 유지를 위해 브라우저의 IndexedDB를 사용할 수 있습니다.</li>
              </ul>
            </div>

            {/* 7. 아동 보호 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                7. 아동 보호
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1.5 list-disc list-inside">
                <li>서비스는 만 14세 미만의 아동을 대상으로 하지 않습니다.</li>
                <li>만 14세 미만의 아동이 서비스를 이용하려면 법정대리인의 동의가 필요합니다.</li>
                <li>만 14세 미만 아동의 개인정보가 수집된 사실을 인지한 경우, 해당 정보를 즉시 삭제합니다.</li>
              </ul>
            </div>
          </section>

          {/* ─── 문의 ──────────────────────────────────── */}
          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              본 약관 및 개인정보 처리방침에 대한 문의사항이 있으시면 서비스 내 문의 기능을 이용해 주세요.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Moonwave · memo.moonwave.kr
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
