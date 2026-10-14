import { useState } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'
import { clsx } from 'clsx'
import { IcLineChevronDown, IcLineSearch } from '@/mw/icons'

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
    title: '메모 쓰기와 편집',
    items: [
      {
        q: '메모는 어떻게 쓰나요?',
        a: '오른쪽 아래의 + 버튼을 누르거나 Alt+N 단축키로 새 메모를 쓸 수 있어요. 명령 팔레트(Ctrl+K)에서 "새 메모"를 골라도 돼요.',
      },
      {
        q: '빠른 메모는 무엇인가요?',
        a: '빠른 메모는 대시보드 위쪽이나 사이드바에서 열 수 있어요. 떠오른 아이디어를 바로 붙잡을 때 좋아요. 복잡한 서식 없이 낙서장처럼 텍스트를 빠르게 적어 둘 수 있어요.',
      },
      {
        q: '마크다운을 지원하나요?',
        a: '네, GFM(GitHub Flavored Markdown) 문법을 모두 지원해요. 제목(#), 굵게(**), 기울임(*), 코드 블록(```), 링크, 체크리스트, 인용문, 표 등을 쓸 수 있고, 편집기 위아래 툴바로도 서식을 넣을 수 있어요.',
      },
      {
        q: '슬래시 명령어(/)는 무엇인가요?',
        a: '빈 줄에서 /를 입력하면 여러 요소를 넣을 수 있는 명령 메뉴가 나타나요. 글머리 기호와 구분선을 넣을 수 있고, /음성, /이미지, /템플릿 같은 AI와 고급 기능도 글 쓰는 흐름을 끊지 않고 바로 부를 수 있어요.',
      },
      {
        q: '자주 쓰는 서식이나 텍스트를 저장할 수 있나요?',
        a: '네, "템플릿" 기능을 써 보세요. 회의록, 일기, 주간 보고처럼 되풀이해 쓰는 양식을 템플릿으로 저장해 두면, 슬래시 명령어(/템플릿)나 편집기 위쪽 툴바에서 쉽게 불러올 수 있어요.',
      },
      {
        q: '주요 단축키를 알려 주세요.',
        a: 'Ctrl+B(굵게), Ctrl+I(기울임), Ctrl+Shift+C(코드 블록), Ctrl+K(명령 팔레트), Alt+N(새 메모) 등을 지원해요. 어디서든 Ctrl+/를 누르면 전체 단축키 안내 창이 열려요.',
      },
    ],
  },
  {
    title: '편집기 고급 기능',
    items: [
      {
        q: '메모에 집중하고 싶어요. (집중 모드 & 타이머)',
        a: '편집기 위쪽의 "집중 모드" 버튼을 누르거나 F11을 눌러 보세요. 사이드바와 방해 요소가 사라져 글쓰기에만 몰입할 수 있어요. 화면 오른쪽 위의 "뽀모도로 타이머"를 켜면 25분 집중, 5분 휴식처럼 시간을 나눠 몰입하게 도와줘요.',
      },
      {
        q: '메모 간 관계(백링크)는 어떻게 만드나요?',
        a: '본문에서 다른 메모나 문서를 언급할 때 [[제목]] 형식으로 입력해 보세요. 그 메모로 바로 가는 링크가 만들어지고, 편집기 아래쪽 "관련 메모 패널"에서 서로 이어진 맥락을 확인할 수 있어요.',
      },
      {
        q: '분할 보기는 언제 쓰나요?',
        a: '마크다운 원문을 직접 보고 싶을 때나, 긴 글의 구조를 살피며 쓸 때 좋아요. 편집기 툴바의 분할 보기 버튼을 누르면 쓰는 영역과 미리보기가 나란히 표시돼요.',
      },
      {
        q: '예전 내용으로 되돌리고 싶어요. (버전 기록)',
        a: '메모를 편집하는 동안 약 5분마다, 또는 의미 있는 변경이 있을 때마다 이전 버전을 자동으로 저장해요. 편집기 위쪽의 시계(버전) 아이콘을 누르면 이전 시점의 스냅샷과 바뀐 내용을 한눈에 비교하고 바로 복원할 수 있어요.',
      },
      {
        q: '쓴 메모를 밖으로 내보내거나 예쁘게 공유하고 싶어요.',
        a: '텍스트나 마크다운 파일(.md)로 내려받을 수 있어요. 모바일이나 SNS에 올리기 좋게 텍스트를 예쁜 "이미지 카드"로 만들거나(공유 > 카드 공유), 읽기 전용 "웹 링크"를 만들어 전할 수도 있어요.',
      },
    ],
  },
  {
    title: '보기와 정렬',
    items: [
      {
        q: '메모를 할 일이나 상태별로 관리할 수 있나요?',
        a: '"칸반 보기"를 써 보세요. 메모 목록 위쪽의 보기 방식에서 칸반을 고르면 상태별로 보드가 만들어져요. 메모를 마우스로 끌어다 놓으며 진행 상황을 관리할 수 있어요.',
      },
      {
        q: '예전에 쓴 기록을 시간순으로 돌아보고 싶어요.',
        a: '"타임라인 보기"를 켜 보세요. 많은 메모를 날짜와 시간 순서로 훑어보며 일기나 회고록처럼 읽을 수 있어요.',
      },
      {
        q: '여러 메모의 폴더나 태그를 한 번에 바꾸고 싶어요.',
        a: '메모 목록 화면 위쪽의 "선택 모드" 아이콘을 켜거나, 각 메모 카드의 체크박스를 골라 주세요. 아래에 나타나는 일괄 작업 막대에서 여러 메모를 한꺼번에 다른 폴더로 옮기거나 지우거나 중요 표시할 수 있어요.',
      },
    ],
  },
  {
    title: 'AI 기능',
    items: [
      {
        q: 'AI 요약과 자동완성은 어떻게 동작하나요?',
        a: 'AI 요약은 긴 글이나 많은 자료를 한 줄이나 글머리 기호 목록으로 줄여 주는 기능이에요. 설정 > AI 서비스에서 OpenAI/Anthropic 키를 연결하면, 글을 쓸 때 회색 글자로 나타나는 다음 문장 추천(자동완성)을 Tab 키로 받아들일 수 있어요.',
      },
      {
        q: '음성 메모(STT)와 이미지 스캔(OCR)은 정확한가요?',
        a: 'OpenAI Whisper 모델을 쓰는 음성 인식은 여러 언어와 문맥을 파악해 사람 수준의 높은 정확도를 보여 줘요. 이미지 텍스트 추출도 AI 비전 모델이 긴 문서나 사진 속 글자를 읽어 메모 안에 텍스트만 넣어 줘요.',
      },
      {
        q: '무엇을 써야 할지 막막할 때 도움을 받을 수 있을까요?',
        a: '대시보드의 "글감 추천 위젯"을 확인해 보세요. AI가 창의적인 에세이 주제, 회고 질문, 기술적인 고민거리 같은 글감을 던져 줘서 빈 화면 앞의 막막함을 이겨 내게 도와줘요.',
      },
      {
        q: '내가 쓴 메모에서 인사이트를 얻을 수 있나요?',
        a: '대시보드의 "AI 브리핑 위젯"은 최근 작업 내용과 메모를 AI가 분석해 요약 리포트를 보여 주고, 지금 집중하고 있는 주제와 성향을 짚어 줘요.',
      },
    ],
  },
  {
    title: '대시보드와 위젯',
    items: [
      {
        q: '나의 기록 습관을 눈으로 확인하고 싶어요. (히트맵 & 요약)',
        a: '대시보드에 들어가면 GitHub 프로필처럼 최근 16주 동안 메모를 얼마나 자주 썼는지 보여 주는 "활동 히트맵"을 볼 수 있어요. 이번 주에 쓴 양과 흐름을 간추린 "주간 요약"도 함께 보여 줘요.',
      },
      {
        q: '지식 그래프가 무엇인가요?',
        a: '내 메모 안의 태그(#)와 백링크([[연결]])를 분석해, 어떤 주제들이 서로 가깝게 이어져 있는지 점과 선으로 이은 거미줄 모양의 지도로 보여 줘요. 아이디어의 흐름을 크게 살펴볼 때 좋아요.',
      },
      {
        q: '무드/감정 그래프 위젯은 어떻게 쓰나요?',
        a: '일기나 감정이 담긴 메모를 AI가 분석해 최근 기분 변화와 스트레스 수치를 그래프로 보여 줘요. 긍정, 부정, 중립 감정의 흐름을 한눈에 볼 수 있어 마음 관리에 도움이 돼요.',
      },
    ],
  },
  {
    title: '폴더와 태그',
    items: [
      {
        q: '폴더는 어떻게 관리하나요?',
        a: '사이드바에서 새 폴더를 만들고 관리할 수 있어요. 폴더마다 색을 정해 구분할 수 있고, 메모 카드나 편집기 위쪽 메뉴에서 메모를 다른 폴더로 쉽게 옮길 수 있어요.',
      },
      {
        q: '태그는 폴더와 어떻게 다른가요?',
        a: '폴더가 물리적인 "서랍장"이라면, 태그는 유연한 "라벨"이에요. 본문 어디서든 #키워드 를 입력하면 태그가 바로 만들어져요. 태그를 여러 개 함께 붙일 수 있고, 대시보드의 "태그 클라우드"에서 자주 쓴 관심사를 한눈에 볼 수 있어요.',
      },
    ],
  },
  {
    title: '동기화와 앱 설치',
    items: [
      {
        q: '인터넷이 끊겨도 쓸 수 있나요?',
        a: '네, Moonwave Memo는 오프라인에서 먼저 동작하게 만든 앱이에요. 인터넷이 없어도 모든 내용을 보고 고칠 수 있고, 다시 연결되면 백그라운드에서 자동으로 동기화해요.',
      },
      {
        q: '앱으로 설치해서 일반 프로그램처럼 쓰고 싶어요.',
        a: '설정 > 시스템 메뉴나 브라우저 주소창의 ⊕ 아이콘을 누르면 데스크톱이나 모바일에 앱을 설치할 수 있어요. 윈도우의 작업 표시줄이나 아이폰의 홈 화면에 따로 아이콘이 생겨, 브라우저 탭 없이 쾌적하게 쓸 수 있어요.',
      },
      {
        q: '내 데이터가 안전하게 관리되나요?',
        a: '메모는 먼저 이 기기의 브라우저에 저장돼요. Google로 로그인하면 내 계정의 클라우드(Firebase)에도 저장돼서 다른 기기에서 이어 쓸 수 있고, 주고받는 길은 암호화돼요. 설정 > 데이터의 백업 내려받기로 전체 백업 파일을 받아 둘 수 있어요.',
      },
      {
        q: '어두운 화면으로 쓰거나 글자 크기를 바꿀 수 있나요?',
        a: '화면 테마는 시스템 설정을 따르고, 설정 > 일반이나 위쪽 바의 테마 버튼에서 밝게 · 어둡게로 바꿀 수 있어요. 글자 크기도 설정 > 일반에서 고를 수 있어요.',
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
    <Dialog open={isOpen} onClose={onClose} size="lg" full>
      <DialogHeader title="도움말" onClose={onClose} />
      <DialogBody className="min-h-0 flex-1 overflow-y-auto sm:max-h-[70dvh] sm:flex-none">
        {/* Search */}
        <div role="search" className="mb-4">
        <label className="mw-searchbar">
          <IcLineSearch size={20} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="궁금한 것을 적어요"
            aria-label="도움말에서 찾기"
            enterKeyHint="search"
          />
        </label>
        </div>

        {/* FAQ Categories */}
        {filteredData.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
            찾지 못했어요. 다른 낱말로 찾아보세요.
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
                    type="button"
                    aria-expanded={!!isExpanded}
                    className="mw-button mw-button--tertiary-subtle mw-button--large w-full justify-between"
                  >
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {category.title}
                    </span>
                    <IcLineChevronDown size={16}
                      className={clsx(
                        '  text-zinc-400 transition-transform duration-200',
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
