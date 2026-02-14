import { Dialog } from '@/components/ui/Dialog'
import { useUIStore } from '@/stores/uiStore'
import { clsx } from 'clsx'
import { ChevronDown, HelpCircle, MessageCircleQuestion, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

interface FAQItem {
  q: string
  a: React.ReactNode
}

interface FAQCategory {
  category: string
  questions: FAQItem[]
}

const FAQ_ITEMS: FAQCategory[] = [
  {
    category: '1. 작업 관리',
    questions: [
      {
        q: '작업은 어떻게 만드나요?',
        a: (
          <div className="space-y-2">
            <p>화면 하단의 "+" 버튼 또는 사이드 메뉴의 "새 작업 추가" 버튼을 눌러 새 작업을 만들 수 있습니다.</p>
            <p>작업을 만들 때 다음 항목을 설정할 수 있습니다:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>제목</strong>: 작업의 이름 (필수)</li>
              <li><strong>카테고리</strong>: 작업 분류 (작업, 개인, 위시리스트 등)</li>
              <li><strong>우선순위</strong>: 없음, 낮음, 보통, 높음</li>
              <li><strong>마감일/시간</strong>: 언제까지 완료해야 하는지</li>
              <li><strong>메모</strong>: 상세 내용이나 참고사항</li>
            </ul>
          </div>
        ),
      },
      {
        q: '작업을 완료하면 어떻게 되나요?',
        a: (
          <div className="space-y-2">
            <p>작업 목록에서 체크박스를 탭하면 작업이 완료 처리됩니다. 완료된 작업은 완료 로그에 기록되어 통계에 반영됩니다.</p>
            <p>
              <strong>연속 달성(스트릭):</strong> 매일 작업을 완료하면 연속 달성 기록이 쌓입니다. 프로필 페이지에서 현재 스트릭을 확인할 수 있습니다.
            </p>
            <p>완료된 작업은 목록에서 줄이 그어지며, 필터를 통해 완료된 작업만 따로 볼 수 있습니다.</p>
          </div>
        ),
      },
      {
        q: '하위 작업(서브태스크)은 어떻게 사용하나요?',
        a: (
          <div className="space-y-2">
            <p>작업 상세 화면에서 하위 작업을 추가할 수 있습니다. 하나의 큰 작업을 여러 단계로 나눠서 관리할 때 유용합니다.</p>
            <p><strong>사용 예시:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>"프로젝트 보고서 작성" → "자료 조사", "초안 작성", "검토 및 수정"</li>
              <li>"이사 준비" → "박스 구매", "짐 정리", "청소"</li>
            </ul>
            <p>각 하위 작업은 독립적으로 완료 처리할 수 있으며, 모든 하위 작업이 완료되면 상위 작업도 완료하기 쉬워집니다.</p>
          </div>
        ),
      },
    ],
  },
  {
    category: '2. 카테고리 & 정리',
    questions: [
      {
        q: '카테고리는 어떻게 관리하나요?',
        a: (
          <div className="space-y-2">
            <p>기본으로 "작업", "개인", "위시리스트" 3개의 카테고리가 제공됩니다. 프로필 페이지에서 새 카테고리를 추가하거나, 기존 카테고리의 이름과 색상을 변경할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>카테고리별 색상:</strong> 각 카테고리에 고유 색상을 지정하여 작업 목록에서 한눈에 구분할 수 있습니다.</li>
              <li><strong>카테고리 삭제:</strong> 카테고리를 삭제하면 해당 카테고리의 작업은 "미분류"로 변경됩니다.</li>
            </ul>
          </div>
        ),
      },
      {
        q: '작업을 필터링하거나 정렬할 수 있나요?',
        a: (
          <div className="space-y-2">
            <p>작업 목록 상단의 필터 옵션을 사용하면 다양한 기준으로 작업을 볼 수 있습니다.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <strong>필터링 기준:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>카테고리별 보기</li>
                  <li>별표(중요) 작업만 보기</li>
                  <li>완료/미완료 상태별 보기</li>
                  <li>마감일 기준 보기</li>
                </ul>
              </div>
              <div>
                <strong>정렬 기준:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>마감일 순</li>
                  <li>우선순위 순</li>
                  <li>생성일 순</li>
                  <li>이름 순</li>
                </ul>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    category: '3. 캘린더 & 일정',
    questions: [
      {
        q: '캘린더 뷰는 어떻게 사용하나요?',
        a: (
          <div className="space-y-2">
            <p>하단 네비게이션에서 "캘린더" 탭을 선택하면 월별 캘린더 뷰를 볼 수 있습니다.</p>
            <p><strong>캘린더 기능:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>마감일이 설정된 작업이 해당 날짜에 표시됩니다.</li>
              <li>날짜를 탭하면 그 날의 작업 목록을 확인할 수 있습니다.</li>
              <li>완료된 작업은 점(dot)으로 표시되어 달성 현황을 한눈에 볼 수 있습니다.</li>
              <li>좌우 스와이프로 월을 이동할 수 있습니다.</li>
            </ul>
          </div>
        ),
      },
      {
        q: '마감일 알림은 어떻게 설정하나요?',
        a: (
          <div className="space-y-2">
            <p>작업을 만들거나 수정할 때 마감일과 시간을 설정할 수 있습니다. 설정 {'>'} 알람 설정에서 "마감 리마인더"를 켜면, 마감일에 알림을 받을 수 있습니다.</p>
            <p><strong>알림 받기:</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>설정에서 "브라우저 알림"을 활성화합니다.</li>
              <li>"마감 리마인더" 토글을 켭니다.</li>
              <li>작업에 마감일과 알람 시간을 설정합니다.</li>
            </ol>
            <p className="text-sm text-zinc-500">브라우저 알림이 허용되어 있어야 정상적으로 알림을 받을 수 있습니다.</p>
          </div>
        ),
      },
    ],
  },
  {
    category: '4. 반복 작업 & 알림',
    questions: [
      {
        q: '반복 작업은 어떻게 설정하나요?',
        a: (
          <div className="space-y-2">
            <p>작업 생성/수정 시 반복 설정을 할 수 있습니다.</p>
            <p><strong>반복 유형:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>매일</strong>: 매일 반복되는 작업 (운동, 일기 쓰기 등)</li>
              <li><strong>매주</strong>: 특정 요일에 반복 (주간 회의, 장보기 등)</li>
              <li><strong>매월</strong>: 매월 특정 날짜에 반복 (월세, 정기 결제 등)</li>
              <li><strong>매년</strong>: 매년 특정 날짜에 반복 (생일, 기념일 등)</li>
            </ul>
            <p>반복 간격도 조절할 수 있어서 "2일마다", "3주마다" 같은 설정이 가능합니다. 종료일을 설정하면 해당 날짜까지만 반복됩니다.</p>
          </div>
        ),
      },
      {
        q: '지연된 작업 알림은 무엇인가요?',
        a: (
          <div className="space-y-2">
            <p>마감일이 지난 미완료 작업이 있으면 "지연 알림"을 받을 수 있습니다. 설정 {'>'} 알람 설정에서 "지연 알림" 토글을 켜면 활성화됩니다.</p>
            <p>지연된 작업은 작업 목록에서 별도의 색상으로 표시되어 놓친 작업을 빠르게 확인하고 처리할 수 있습니다.</p>
            <p>지연된 작업이 많아지면 알림 드롭다운에서도 확인할 수 있습니다.</p>
          </div>
        ),
      },
    ],
  },
  {
    category: '5. 데이터 & 백업',
    questions: [
      {
        q: '내 데이터는 어디에 저장되나요?',
        a: (
          <div className="space-y-2">
            <p>모든 데이터는 <strong>사용자의 브라우저 내부 저장소(IndexedDB)</strong>에만 저장됩니다. 서버로 전송되는 데이터는 없으며, 개발자도 사용자의 데이터에 접근할 수 없습니다.</p>
            <p><strong>Local-First 아키텍처:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>인터넷 연결 없이도 사용 가능</li>
              <li>개인정보가 외부로 유출될 위험 없음</li>
              <li>빠른 데이터 접근 속도</li>
            </ul>
            <p className="text-red-500/80 dark:text-red-400/80 text-sm">단, 브라우저의 "사이트 데이터 삭제" 시 데이터가 초기화될 수 있으므로 주기적인 백업을 강력히 권장합니다.</p>
          </div>
        ),
      },
      {
        q: '백업과 복원은 어떻게 하나요?',
        a: (
          <div className="space-y-2">
            <p>설정 {'>'} 데이터 관리에서 백업과 복원을 할 수 있습니다.</p>
            <div>
              <strong>로컬 백업:</strong>
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>"백업 다운로드" 버튼을 누르면 JSON 파일이 다운로드됩니다.</li>
                <li>"복원" 버튼을 눌러 이전에 다운로드한 백업 파일을 선택하면 데이터가 복원됩니다.</li>
              </ol>
            </div>
            <div>
              <strong>Google Drive 백업:</strong>
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Google 계정을 연동합니다.</li>
                <li>"지금 Google Drive에 백업하기" 버튼으로 클라우드에 저장합니다.</li>
                <li>클라우드 백업 파일 목록에서 원하는 시점의 백업을 선택하여 복원합니다.</li>
              </ol>
            </div>
            <p>다른 기기에서 데이터를 옮기려면 백업 파일을 해당 기기로 전송한 후 복원하세요.</p>
          </div>
        ),
      },
    ],
  },
  {
    category: '6. 문제 해결',
    questions: [
      {
        q: '데이터가 사라졌어요. 복구할 수 있나요?',
        a: (
          <div className="space-y-2">
            <p>브라우저 캐시 삭제, 시크릿 모드 사용 등의 이유로 데이터가 사라질 수 있습니다.</p>
            <p><strong>복구 방법:</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이전에 백업 파일을 만들어둔 경우: 설정 {'>'} 데이터 관리 {'>'} 복원으로 복구</li>
              <li>Google Drive에 백업한 경우: Google Drive 연동 후 클라우드 백업에서 복원</li>
              <li>백업이 없는 경우: 안타깝게도 데이터를 복구할 수 없습니다.</li>
            </ol>
            <p>데이터 손실을 방지하려면 <strong>정기적인 백업</strong>을 해주세요. 앱에서 7일 이상 백업을 하지 않으면 백업 알림이 표시됩니다.</p>
          </div>
        ),
      },
      {
        q: '앱이 느리거나 오류가 발생해요.',
        a: (
          <div className="space-y-2">
            <p>대부분의 문제는 다음 방법으로 해결됩니다:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li><strong>새로고침(F5):</strong> 페이지를 새로고침해 보세요.</li>
              <li><strong>캐시 삭제:</strong> 브라우저 설정에서 이 사이트의 캐시만 삭제해 보세요. (주의: "사이트 데이터"를 삭제하면 작업 데이터도 삭제됩니다.)</li>
              <li><strong>PWA 재설치:</strong> 설치된 앱을 삭제하고 다시 설치해 보세요.</li>
              <li><strong>브라우저 업데이트:</strong> 최신 버전의 Chrome, Safari, Firefox를 사용하세요.</li>
            </ol>
            <p>문제가 지속되면 설정 {'>'} 위험 영역 {'>'} 모든 데이터 삭제로 초기화할 수 있습니다. (반드시 백업 후 진행하세요.)</p>
          </div>
        ),
      },
    ],
  },
]

export function FAQModal() {
  const isOpen = useUIStore((state) => state.isFAQModalOpen)
  const onClose = useUIStore((state) => state.closeFAQModal)
  const [openIndex, setOpenIndex] = useState<string | null>('0-0')
  const [searchQuery, setSearchQuery] = useState('')

  const toggleItem = (id: string) => {
    setOpenIndex(openIndex === id ? null : id)
  }

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS

    const lowerQuery = searchQuery.toLowerCase()
    return FAQ_ITEMS.map((section) => ({
      ...section,
      questions: section.questions.filter((item) => {
        // We only search the question text because the answer is now ReactNode
        // If we want to search answers, we'd need a plain text version of the answer or traverse the ReactNode (complex).
        // For now, let's stick to searching questions for simplicity and performance, 
        // or we could add a `keywords` field to FAQItem if strict answer searching is needed.
        // Actually, let's just search the question for now as the answer is complex.
        return item.q.toLowerCase().includes(lowerQuery)
      }),
    })).filter((section) => section.questions.length > 0)
  }, [searchQuery])

  // Clear search when closing
  const handleClose = () => {
    setSearchQuery('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} size="2xl" noPadding>
      <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              사용자 메뉴얼 & FAQ
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <span className="sr-only">닫기</span>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="질문 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border-none rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400/50 transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-h-[70dvh] overflow-y-auto">
        {!searchQuery && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              To-Do List는 작업을 효율적으로 관리하고 일정을 추적하는 도구입니다.
              아래 메뉴얼을 통해 각 기능의 정확한 의미와 활용법을 확인하세요.
            </p>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          filteredItems.map((section, catIdx) => (
            <div key={catIdx}>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 px-1 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-500 rounded-full" />
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.questions.map((item) => {
                  // Generate a unique ID that survives filtering if possible, or just use the question string as part of key
                  // Using catIdx-qIdx might break if filtered? 
                  // Actually, filteredItems creates NEW arrays, so indices reset.
                  // But since we want to toggle content, we need a stable ID if the user searches, toggles, then clears search?
                  // For simplicity, let's just use the question text as a unique key for the toggle state.
                  const id = item.q
                  const isExpanded = openIndex === id

                  return (
                    <div
                      key={item.q}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/50 transition-all duration-200"
                    >
                      <button
                        onClick={() => toggleItem(id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <MessageCircleQuestion
                            className={clsx(
                              'w-5 h-5 flex-shrink-0 mt-0.5 transition-colors',
                              isExpanded ? 'text-indigo-500' : 'text-zinc-500'
                            )}
                          />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {item.q}
                          </span>
                        </div>
                        <ChevronDown
                          className={clsx(
                            'w-4 h-4 text-zinc-500 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pl-8 sm:pl-12 bg-white dark:bg-transparent">
                          <div className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                            {item.a}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </Dialog>
  )
}
