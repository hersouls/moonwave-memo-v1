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
    title: '메모 작성 & 편집 📝',
    items: [
      {
        q: '메모를 어떻게 작성하나요?',
        a: '우측 하단의 + 버튼을 누르거나 Ctrl+N 단축키로 새 메모를 작성할 수 있습니다. 명령 팔레트(Ctrl+K)에서 "새 메모"를 선택해도 됩니다.',
      },
      {
        q: '빠른 메모(Quick 메모)는 무엇인가요?',
        a: '대시보드 상단이나 사이드바에서 접근할 수 있는 빠른 메모는 떠오른 아이디어를 즉시 포착할 때 유용합니다. 복잡한 서식 없이 스크래치패드처럼 빠르게 텍스트를 적어둘 수 있습니다.',
      },
      {
        q: '마크다운을 지원하나요?',
        a: '네, GFM(GitHub Flavored Markdown) 문법을 완벽히 지원합니다. 제목(#), 굵게(**), 기울임(*), 코드 블록(```), 링크, 체크리스트, 인용문, 표 등을 사용할 수 있으며 편집기 상하단 툴바를 통해서도 서식을 적용할 수 있습니다.',
      },
      {
        q: '슬래시 명령어(/)는 무엇인가요?',
        a: '빈 줄에서 /를 입력하면 다양한 요소를 삽입할 수 있는 강력한 명령 메뉴가 나타납니다. 글머리 기호, 구분선 삽입뿐만 아니라 /음성, /이미지, /템플릿 등 AI와 고급 기능을 타이핑 흐름을 끊지 않고 즉시 호출할 수 있습니다.',
      },
      {
        q: '자주 쓰는 서식이나 텍스트를 저장할 수 있나요?',
        a: '네, "템플릿" 기능을 활용하세요. 회의록, 일기, 주간 보고 등 반복해서 쓰는 양식을 템플릿으로 저장한 뒤, 슬래시 명령어(/템플릿)나 편집기 상단 툴바를 통해 손쉽게 불러올 수 있습니다.',
      },
      {
        q: '주요 단축키를 알려주세요.',
        a: 'Ctrl+B(굵게), Ctrl+I(기울임), Ctrl+Shift+C(코드 블록), Ctrl+K(명령 팔레트), Ctrl+N(새 메모) 등을 지원합니다. 아무 곳에서나 Ctrl+/를 누르면 전체 단축키 가이드 창을 띄울 수 있습니다.',
      },
    ],
  },
  {
    title: '편집기 고급 기능 🛠️',
    items: [
      {
        q: '메모에 집중하고 싶어요. (집중 모드 & 타이머)',
        a: '편집기 상단의 "집중 모드" 버튼을 누르거나 F11을 눌러보세요. 사이드바와 방해 요소가 사라져 글쓰기에만 몰입할 수 있습니다. 특히 화면 우측 상단의 "뽀모도로 타이머"를 켜면 25분 집중, 5분 휴식 등 체계적인 몰입을 도와줍니다.',
      },
      {
        q: '메모 간 관계(백링크)는 어떻게 만드나요?',
        a: '본문 내용 중 다른 메모나 문서를 언급해야 할 때 [[제목]] 형식으로 입력해 보세요. 해당 메모로 바로 이동 가능한 링크가 생성되며, 편집기 하단 "관련 메모 패널"에서 서로 얽혀있는 맥락을 확인할 수 있습니다.',
      },
      {
        q: '화면 분할 뷰(Split View)는 언제 쓰나요?',
        a: '마크다운 원문 코드를 직접 보고 싶을 때나, 긴 글의 구조를 파악하며 작성할 때 유용합니다. 편집기 툴바의 분할 보기 버튼을 누르면 작성 영역과 미리보기가 나란히 표시됩니다.',
      },
      {
        q: '예전 내용으로 되돌리고 싶어요. (버전 히스토리)',
        a: '메모 편집 중 약 5분 간격, 또는 유의미한 변경 단위마다 과거 버전을 자동 저장합니다. 편집기 상단의 시계(버전) 아이콘을 누르면, 이전 시점들의 스냅샷과 변경 내용(Diff)을 한눈에 비교하고 즉시 복원할 수 있습니다.',
      },
      {
        q: '작성한 메모를 외부로 내보내거나 예쁘게 공유하고 싶어요.',
        a: '텍스트나 마크다운 파일(.md)로 다운로드할 수 있습니다. 또한, 모바일이나 SNS에 올리기 좋도록 텍스트를 예쁜 "이미지 카드"로 캡처(공유 > 카드 공유)하거나, 읽기 전용 "웹 링크"를 생성하여 전달할 수 있습니다.',
      },
    ],
  },
  {
    title: '고급 뷰 & 정렬 방식 👀',
    items: [
      {
        q: '메모를 할 일(Todo)이나 상태별로 관리할 수 있나요?',
        a: '"칸반(Kanban) 뷰"를 사용해보세요. 메모 목록 상단의 보기 방식에서 칸반을 선택하면, 상태별로 보드가 구성되어 메모를 마우스로 드래그 앤 드롭하며 직관적으로 진행 상황을 관리할 수 있습니다.',
      },
      {
        q: '과거에 작성한 기록들을 시간 순으로 돌아보고 싶어요.',
        a: '"타임라인(Timeline) 뷰"를 켜보세요. 수많은 메모들을 날짜 및 시간 축을 기준으로 주르륵 훑어보며 일기나 회고록처럼 감상할 수 있습니다.',
      },
      {
        q: '여러 메모의 폴더나 태그를 한 번에 바꾸고 싶어요.',
        a: '메모 목록 화면 상단의 "선택 모드" 아이콘을 활성화하거나, 각 메모 카드의 체크박스를 선택하세요. 하단에 나타나는 일괄 작업 바(Batch Action Bar)를 통해 여러 개의 메모를 동시에 다른 폴더로 옮기거나 삭제, 중요 표시할 수 있습니다.',
      },
    ],
  },
  {
    title: 'AI 스마트 기능 🤖',
    items: [
      {
        q: 'AI 요약 및 자동완성은 어떻게 동작하나요?',
        a: '긴 글이나 방대한 자료를 한 줄 요약 혹은箇條書き(Bullet points)로 요약해 주는 기능입니다. 설정 > AI 서비스에서 OpenAI/Anthropic 키를 연결한 뒤, 글을 쓸 때 회색 텍스트로 나타나는 다음 문장 추천(자동완성)을 Tab 기호로 수락할 수 있습니다.',
      },
      {
        q: '음성 메모(STT)와 이미지 스캔(OCR)은 정확한가요?',
        a: 'OpenAI Whisper 모델을 활용한 음성 인식은 다국어와 문맥을 파악하여 사람 수준의 높은 정확도를 보여줍니다. 이미지 텍스트 추출 또한 강력한 AI 비전 모델이 긴 문서나 사진 속의 글자를 파악하여 메모장 안으로 텍스트만 쏙 삽입해 줍니다.',
      },
      {
        q: '무엇을 써야 할지 막막할 때 도움을 받을 수 있을까요?',
        a: '대시보드의 "Writing Prompt(글감 추천) 위젯"을 확인해 보세요. AI가 창의적인 에세이 주제, 회고 질문, 또는 기술적인 고민거리 등을 던져주어 빈 화면의 공포(Blank Page Syndrome)를 극복하게 도와줍니다.',
      },
      {
        q: '내가 작성한 메모를 바탕으로 인사이트를 얻을 수 있나요?',
        a: '대시보드의 "AI 브리핑 위젯"은 최근의 작업 내용이나 메모들을 AI가 분석하여 요약 리포트를 제공하며, 사용자가 현재 집중하고 있는 주제와 성향을 짚어줍니다.',
      },
    ],
  },
  {
    title: '대시보드 & 시각화 위젯 📊',
    items: [
      {
        q: '나의 기록 습관을 눈으로 확인하고 싶어요. (히트맵 & 요약)',
        a: '대시보드에 진입하면 마치 Github 프로필처럼 최근 16주간의 메모 작성빈도를 나타내는 "활동 히트맵"을 볼 수 있습니다. 또한, 이번 주의 주요 작성량과 흐름을 요약한 "주간 요약(Weekly Digest)"도 함께 제공됩니다.',
      },
      {
        q: '지식 그래프(Knowledge Graph)가 무엇인가요?',
        a: '내 메모 안의 태그(#)들과 백링크([[연결]])들을 분석해, 어떤 주제들이 서로 밀접하게 연관되어 있는지 점(Node)과 선(Edge)으로 연결된 거미줄 형태의 시각적 지도로 보여줍니다. 아이디어의 흐름을 거시적으로 파악할 때 유용합니다.',
      },
      {
        q: '무드/감정 그래프 위젯은 어떻게 사용하나요?',
        a: '일기나 감정이 들어간 메모들을 AI가 분석하여, 최근 나의 기분 변화와 스트레스 수치를 그래프로 나타내 줍니다. 긍정, 부정, 중립적인 감정 추이를 시각화하여 멘탈 관리에 도움을 받을 수 있습니다.',
      },
    ],
  },
  {
    title: '폴더 & 태그 관리 📁',
    items: [
      {
        q: '폴더 관리는 어떻게 하나요?',
        a: '사이드바에서 직관적으로 새 폴더를 만들고 관리할 수 있습니다. 각 폴더는 아이콘과 색상을 지정해 구분하기 쉽게 꾸밀 수 있으며, 메모 카드나 에디터의 상단 메뉴에서 다른 폴더로 쉽게 이동할 수 있습니다.',
      },
      {
        q: '태그는 일반 메모와 어떻게 다르나요?',
        a: '폴더가 물리적인 "서랍장"이라면, 태그는 유연한 "라벨"입니다. 본문 어디서든 #키워드 를 입력하면 동적으로 태그가 생성되며, 여러 개의 태그를 동시에 붙이거나 대시보드의 "태그 클라우드"에서 빈도수가 높은 관심사를 한눈에 볼 수 있습니다.',
      },
    ],
  },
  {
    title: '데이터 동기화 & PWA 환경 ⚙️',
    items: [
      {
        q: '인터넷이 끊겨도 사용할 수 있나요?',
        a: '네, Memory_v1.0은 오프라인 퍼스트(Offline-First)로 설계된 PWA(Progressive Web App) 앱입니다. 인터넷이 없어도 모든 내용을 조회하고 수정할 수 있으며, 온라인 상태가 되면 자동으로 백그라운드에서 동기화됩니다.',
      },
      {
        q: '앱으로 설치해서 일반 프로그램처럼 쓰고 싶어요.',
        a: '설정 > 시스템 메뉴나 브라우저 주소창의 ⊕ 아이콘을 누르면 데스크톱/모바일에 앱을 설치할 수 있습니다. 윈도우의 작업 표시줄이나 아이폰의 홈 화면에 독립된 아이콘으로 등록되어 브라우저 탭 없이 쾌적하게 사용할 수 있습니다.',
      },
      {
        q: '내 데이터가 안전하게 관리되나요?',
        a: '기본적으로 모든 데이터는 사용자의 로컬 브라우저(IndexedDB)에 1차로 저장되고, Firebase 클라우드를 거쳐 안전하게 종단간 암호화 동기화됩니다. 불안하시다면 언제든지 설정 > 데이터 > "JSON 포맷으로 내보내기"를 통해 전수 백업파일을 받아두실 수 있습니다.',
      },
      {
        q: '다크 모드나 테마 커스터마이징이 가능한가요?',
        a: '물론입니다. 시스템 테마와 연동되는 다크 모드뿐만 아니라, 앱의 포인트 색상(강조 색상)을 다양하게 변경할 수 있습니다. Ctrl+K 명령 팔레트를 통해 단 몇 초 만에 분위기를 전환할 수 있습니다.',
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
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
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
