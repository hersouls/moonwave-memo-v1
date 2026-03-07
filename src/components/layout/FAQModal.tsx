import { useState } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'
import { ChevronDown, Search } from 'lucide-react'
import { clsx } from 'clsx'

interface FAQItem {
  q: string
  a: string
}

interface FAQCategory {
  title: string
  items: FAQItem[]
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: '메모 작성 & 편집',
    items: [
      {
        q: '메모를 어떻게 작성하나요?',
        a: '우측 하단의 + 버튼을 누르거나 Ctrl+N 단축키로 새 메모를 작성할 수 있습니다. 명령 팔레트(Ctrl+K)에서 "새 메모"를 선택해도 됩니다.',
      },
      {
        q: '마크다운을 지원하나요?',
        a: 'GFM(GitHub Flavored Markdown) 문법을 지원합니다. 제목(#), 굵게(**), 기울임(*), 코드 블록(```), 링크, 체크리스트, 인용문, 표 등을 사용할 수 있습니다. 편집기 하단 툴바에서 서식 버튼을 눌러도 됩니다.',
      },
      {
        q: '슬래시 명령어는 무엇인가요?',
        a: '편집 중 /를 입력하면 명령 메뉴가 나타납니다. /제목, /목록, /체크리스트, /코드, /인용, /구분선 등을 빠르게 삽입할 수 있고, /음성이나 /이미지로 AI 입력 기능도 사용할 수 있습니다.',
      },
      {
        q: '텍스트를 선택하면 나타나는 툴바는 무엇인가요?',
        a: '플로팅 툴바입니다. 텍스트를 드래그하여 선택하면 굵게, 기울임, 코드, 링크 서식을 바로 적용할 수 있는 미니 툴바가 나타납니다.',
      },
      {
        q: '편집 단축키가 있나요?',
        a: 'Ctrl+B(굵게), Ctrl+I(기울임), Ctrl+Shift+C(코드 블록) 단축키를 지원합니다. Ctrl+/를 누르면 전체 단축키 목록을 볼 수 있습니다.',
      },
    ],
  },
  {
    title: '편집기 고급 기능',
    items: [
      {
        q: '분할 보기(Split View)는 어떻게 사용하나요?',
        a: '데스크톱에서 편집기 상단의 분할 보기 버튼을 누르면 편집 영역과 마크다운 미리보기를 나란히 볼 수 있습니다. 다시 누르면 탭 모드로 돌아갑니다.',
      },
      {
        q: '집중 모드란 무엇인가요?',
        a: '편집기 상단의 집중 모드 버튼을 누르면 메뉴와 사이드바가 사라지고 전체 화면으로 글쓰기에 집중할 수 있습니다. 글자 수와 예상 읽기 시간도 표시됩니다. Esc 키로 나올 수 있습니다.',
      },
      {
        q: '버전 기록은 어떻게 확인하나요?',
        a: '편집기 상단의 시계 아이콘을 누르면 자동 저장된 이전 버전들을 볼 수 있습니다. 약 5분 간격 또는 100자 이상 변경 시 자동으로 스냅샷이 저장되며, 변경 내용 비교와 원하는 버전으로의 복원이 가능합니다.',
      },
      {
        q: '메모 간 연결(백링크)은 어떻게 만드나요?',
        a: '다른 메모의 제목을 [[제목]] 형식으로 입력하면 메모끼리 연결됩니다. 편집기 하단에 연결된 메모 목록이 표시되며, 클릭하면 해당 메모로 이동합니다.',
      },
    ],
  },
  {
    title: 'AI 기능',
    items: [
      {
        q: 'AI 기능을 사용하려면 어떻게 설정하나요?',
        a: '설정 > AI 서비스에서 OpenAI 또는 Anthropic API 키를 입력하세요. API 키는 이 기기의 브라우저에만 저장되며 외부 서버로 전송되지 않습니다. AI 기능 없이도 모든 기본 기능은 사용 가능합니다.',
      },
      {
        q: '음성 입력(STT)은 어떻게 사용하나요?',
        a: '편집기 하단 툴바의 마이크 아이콘을 누르거나, 슬래시 명령어 /음성을 입력하세요. 음성을 녹음하거나 오디오 파일을 업로드하면 OpenAI Whisper가 텍스트로 변환합니다. 설정에서 인식 언어를 선택할 수 있습니다.',
      },
      {
        q: '이미지에서 텍스트를 추출(OCR)하려면?',
        a: '편집기 하단 툴바의 카메라 아이콘을 누르거나, 슬래시 명령어 /이미지를 입력하세요. 사진을 업로드하거나 카메라로 촬영하면 AI가 텍스트를 추출하여 메모에 삽입합니다. 설정에서 OCR 제공자(OpenAI/Anthropic)를 선택할 수 있습니다.',
      },
      {
        q: 'AI 자동완성은 어떻게 동작하나요?',
        a: '설정 > AI 서비스에서 "AI 자동완성"을 활성화하면, 글을 쓰는 도중 AI가 다음 문장을 회색 텍스트로 제안합니다. Tab 키를 누르면 제안을 수락하고, 계속 타이핑하면 자동으로 사라집니다.',
      },
      {
        q: 'AI 요약 기능은 어떻게 사용하나요?',
        a: '메모 내용이 50자 이상이면 편집기 하단에 "AI 요약" 패널이 나타납니다. 클릭하면 AI가 메모 내용을 간결하게 요약해줍니다. "다시 생성" 버튼으로 새로운 요약을 받을 수도 있습니다.',
      },
    ],
  },
  {
    title: '메모 정리 & 관리',
    items: [
      {
        q: '메모를 중요 표시하거나 상단에 고정하려면?',
        a: '별 아이콘을 눌러 중요 표시하거나, 편집기 상단의 더보기 메뉴(⋮)에서 "상단 고정"을 선택하면 메모 목록 최상단에 고정됩니다. 모바일에서는 메모 카드를 오른쪽으로 스와이프해도 중요 표시가 됩니다.',
      },
      {
        q: '메모에 색상을 지정할 수 있나요?',
        a: '네, 메모마다 6가지 색상(흰색, 노랑, 초록, 파랑, 핑크, 보라)을 지정할 수 있습니다. 설정 > 메모에서 메모장 배경색을 변경할 수 있으며, 검색 시 색상별 필터링도 지원합니다.',
      },
      {
        q: '삭제한 메모를 복구할 수 있나요?',
        a: '네, 삭제된 메모는 휴지통으로 이동됩니다. 휴지통에서 메모를 선택하여 복구할 수 있습니다. 삭제 직후에는 하단 알림에서 "실행 취소" 버튼으로 즉시 복구도 가능합니다.',
      },
      {
        q: '여러 메모를 한꺼번에 관리하려면?',
        a: '메모 목록의 더보기 메뉴에서 "메모 선택"을 누르면 다중 선택 모드가 활성화됩니다. 여러 메모를 선택한 뒤 일괄 이동, 삭제, 중요 표시를 할 수 있습니다.',
      },
      {
        q: '모바일에서 스와이프 동작은 무엇인가요?',
        a: '메모 카드를 오른쪽으로 스와이프하면 중요 표시, 왼쪽으로 스와이프하면 삭제됩니다. 이 동작은 모바일 터치 기기에서만 작동합니다.',
      },
    ],
  },
  {
    title: '폴더 & 태그',
    items: [
      {
        q: '폴더를 어떻게 만들고 관리하나요?',
        a: '사이드바의 폴더 옆 + 버튼이나, 설정 > 메모 > 폴더 관리에서 새 폴더를 추가하고, 이름과 색상을 지정할 수 있습니다. 편집기의 더보기 메뉴(⋮) > "폴더 이동"으로 메모를 다른 폴더로 이동할 수 있습니다.',
      },
      {
        q: '태그는 어떻게 사용하나요?',
        a: '메모 본문에 #태그명 형식으로 입력하면 자동으로 태그가 추출됩니다. 메모 카드에 태그가 칩 형태로 표시되며, 태그를 클릭하면 해당 태그가 포함된 메모만 필터링됩니다. 사이드바와 대시보드의 태그 클라우드에서도 태그별 탐색이 가능합니다.',
      },
      {
        q: '기본 폴더를 변경할 수 있나요?',
        a: '설정 > 메모에서 새 메모가 저장될 기본 폴더를 변경할 수 있습니다. 새 메모 작성 시 커서 시작 위치(제목 또는 본문)도 설정할 수 있습니다.',
      },
    ],
  },
  {
    title: '검색 & 탐색',
    items: [
      {
        q: '명령 팔레트란 무엇인가요?',
        a: 'Ctrl+K를 누르면 열리는 만능 검색창입니다. 메모 제목이나 내용을 검색하여 바로 이동하거나, "새 메모", "설정", "테마 전환" 등의 액션을 빠르게 실행할 수 있습니다.',
      },
      {
        q: '메모를 검색할 때 필터를 사용할 수 있나요?',
        a: '네, 검색창 아래에 필터 옵션이 표시됩니다. 기간(오늘/이번 주/이번 달), 중요 표시 여부, 메모 색상별로 필터링하여 원하는 메모를 빠르게 찾을 수 있습니다.',
      },
      {
        q: '메모 정렬 기준을 바꿀 수 있나요?',
        a: '메모 목록의 더보기 메뉴에서 정렬 기준을 수정일순, 생성일순, 제목순으로 변경할 수 있습니다. 보기 방식도 목록과 그리드 중에서 선택할 수 있습니다.',
      },
      {
        q: '"이어서 보기" 배너는 무엇인가요?',
        a: '대시보드에서 이전에 보던 메모가 있으면 "이어서 보기" 배너가 표시됩니다. 클릭하면 마지막으로 편집하던 메모로 바로 이동할 수 있습니다.',
      },
    ],
  },
  {
    title: '대시보드 & 활동',
    items: [
      {
        q: '대시보드에서 어떤 정보를 볼 수 있나요?',
        a: '전체 메모 수, 중요 메모 수, 폴더 목록, 태그 클라우드를 한눈에 볼 수 있습니다. 프로필 카드에서 계정 정보도 표시됩니다.',
      },
      {
        q: '연속 기록(스트릭)은 무엇인가요?',
        a: '매일 메모를 작성하면 연속 기록이 쌓입니다. 대시보드에서 현재 스트릭과 최장 기록을 확인할 수 있습니다. 일정 기간(3일, 7일, 30일 등) 연속 달성 시 배지를 획득합니다.',
      },
      {
        q: '활동 히트맵은 어떻게 읽나요?',
        a: '최근 16주간의 메모 작성 활동을 색상 농도로 보여줍니다. 색이 진할수록 해당 날짜에 많은 메모를 작성한 것입니다. 메모 개수 마일스톤(10개, 50개, 100개 등) 달성 시에도 배지가 주어집니다.',
      },
    ],
  },
  {
    title: '설정 & 데이터',
    items: [
      {
        q: '데이터가 어디에 저장되나요?',
        a: '메모는 브라우저의 IndexedDB에 로컬 저장됩니다. Google 계정으로 로그인하면 Firebase를 통해 클라우드에도 자동 동기화되어 여러 기기에서 사용할 수 있습니다.',
      },
      {
        q: '오프라인에서도 사용할 수 있나요?',
        a: '네, PWA(Progressive Web App) 기술로 인터넷 없이도 메모를 작성하고 편집할 수 있습니다. 인터넷에 다시 연결되면 자동으로 동기화됩니다.',
      },
      {
        q: '앱으로 설치할 수 있나요?',
        a: '네, 설정 > 시스템 > 앱 설치에서 "설치하기" 버튼을 누르면 홈 화면에 앱을 추가할 수 있습니다. Chrome에서는 주소창의 설치 아이콘, Safari에서는 공유 > "홈 화면에 추가"로도 설치 가능합니다.',
      },
      {
        q: '다크 모드와 테마를 변경하려면?',
        a: '설정 > 일반에서 라이트/다크/시스템 테마를 선택할 수 있습니다. 강조 색상도 여러 팔레트 중에서 고를 수 있으며, 상단 헤더의 테마 버튼이나 명령 팔레트(Ctrl+K)에서 "테마 전환"으로도 빠르게 변경 가능합니다.',
      },
      {
        q: '데이터를 백업하고 복원하려면?',
        a: '설정 > 데이터 > 백업 및 복원에서 JSON 파일로 전체 데이터를 내보내기(백업)하거나, 백업 파일에서 가져오기(복원)할 수 있습니다. 중요한 데이터는 정기적으로 백업해두세요.',
      },
      {
        q: '메모가 동기화되지 않거나 앱이 느립니다.',
        a: '인터넷 연결과 Google 로그인 상태를 확인하세요. 문제가 지속되면 로그아웃 후 재로그인해보세요. 앱이 느린 경우, 휴지통에 쌓인 메모를 비우거나 브라우저 캐시를 삭제하면 도움이 됩니다.',
      },
    ],
  },
]

export function FAQModal() {
  const isOpen = useUIStore((s) => s.isFAQModalOpen)
  const onClose = useUIStore((s) => s.closeFAQModal)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set([0]))

  const toggleCategory = (index: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const filteredData = searchQuery.trim()
    ? FAQ_DATA.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.items.length > 0)
    : FAQ_DATA

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogHeader title="도움말 (FAQ)" onClose={onClose} />
      <DialogBody className="max-h-[70dvh] fold:max-h-[60dvh] overflow-y-auto">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="질문 검색..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* FAQ Categories */}
        {filteredData.length === 0 ? (
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-8">
            검색 결과가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredData.map((category) => {
              const originalIndex = FAQ_DATA.indexOf(
                FAQ_DATA.find((c) => c.title === category.title)!
              )
              const isExpanded = searchQuery.trim() || expandedCategories.has(originalIndex)

              return (
                <div
                  key={category.title}
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(originalIndex)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {category.title}
                    </span>
                    <ChevronDown
                      className={clsx(
                        'w-4 h-4 text-zinc-400 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700">
                      {category.items.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className={clsx(
                            'px-4 py-3',
                            itemIndex > 0 && 'border-t border-zinc-100 dark:border-zinc-800'
                          )}
                        >
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                            Q. {item.q}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            {item.a}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
      </DialogFooter>
    </Dialog>
  )
}
