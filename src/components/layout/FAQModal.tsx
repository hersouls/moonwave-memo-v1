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
    title: '메모 관리',
    items: [
      {
        q: '메모를 어떻게 작성하나요?',
        a: '우측 하단의 + 버튼을 누르거나 Ctrl+N 단축키로 새 메모를 작성할 수 있습니다.',
      },
      {
        q: '삭제한 메모를 복구할 수 있나요?',
        a: '네, 삭제된 메모는 휴지통으로 이동됩니다. 휴지통에서 메모를 선택하여 복구할 수 있습니다. 휴지통을 비우면 영구 삭제됩니다.',
      },
      {
        q: '메모를 중요 표시하려면 어떻게 하나요?',
        a: '메모 카드에서 별 아이콘을 누르거나, 메모 편집 화면 상단의 별 아이콘을 눌러 중요 표시할 수 있습니다.',
      },
      {
        q: '메모를 다른 폴더로 이동하려면?',
        a: '메모 편집 화면의 더보기 메뉴(⋮)에서 "폴더 이동"을 선택하거나, 메모 목록에서 여러 메모를 선택하여 일괄 이동할 수 있습니다.',
      },
    ],
  },
  {
    title: '폴더 & 태그',
    items: [
      {
        q: '폴더를 어떻게 만드나요?',
        a: '설정 또는 폴더 선택 화면에서 새 폴더를 추가할 수 있습니다.',
      },
      {
        q: '태그는 어떻게 사용하나요?',
        a: '메모 본문에 #태그명 형식으로 입력하면 자동으로 태그가 추출됩니다. 사이드바에서 태그별로 메모를 필터링할 수 있습니다.',
      },
      {
        q: '기본 폴더를 변경할 수 있나요?',
        a: '설정 > 메모 설정에서 새 메모의 기본 폴더를 변경할 수 있습니다.',
      },
    ],
  },
  {
    title: '마크다운',
    items: [
      {
        q: '마크다운이란 무엇인가요?',
        a: '마크다운은 간단한 문법으로 텍스트를 서식 있는 문서로 변환하는 방식입니다. 예: **굵게**, *기울임*, # 제목 등을 사용할 수 있습니다.',
      },
      {
        q: '어떤 마크다운 문법을 지원하나요?',
        a: '제목(#), 굵게(**), 기울임(*), 코드 블록(```), 링크, 이미지, 표, 체크리스트, 인용문 등 GFM(GitHub Flavored Markdown) 문법을 지원합니다.',
      },
      {
        q: '마크다운 미리보기는 어떻게 보나요?',
        a: '메모 편집 화면에서 "미리보기" 탭을 눌러 렌더링된 결과를 확인할 수 있습니다.',
      },
      {
        q: '편집 단축키가 있나요?',
        a: 'Ctrl+B (굵게), Ctrl+I (기울임), Ctrl+K (링크), Ctrl+Shift+C (코드 블록), Esc (뒤로가기) 단축키를 지원합니다.',
      },
    ],
  },
  {
    title: '동기화 & 백업',
    items: [
      {
        q: '데이터가 어디에 저장되나요?',
        a: '메모는 브라우저의 IndexedDB에 로컬 저장됩니다. Google 계정으로 로그인하면 Firebase를 통해 클라우드에도 동기화됩니다.',
      },
      {
        q: '오프라인에서도 사용할 수 있나요?',
        a: '네, PWA 기술을 사용하여 오프라인에서도 메모를 작성하고 편집할 수 있습니다. 인터넷 연결 시 자동으로 동기화됩니다.',
      },
      {
        q: '데이터를 백업하려면?',
        a: '설정 > 데이터 관리에서 JSON 형식으로 데이터를 내보내기(백업)할 수 있습니다. 같은 메뉴에서 백업 파일을 가져오기(복원)할 수 있습니다.',
      },
    ],
  },
  {
    title: '문제 해결',
    items: [
      {
        q: '앱이 느리게 동작합니다.',
        a: '브라우저 캐시를 삭제하거나, 휴지통에 쌓인 메모를 비워보세요. 메모가 매우 많은 경우 성능에 영향을 줄 수 있습니다.',
      },
      {
        q: '동기화가 되지 않습니다.',
        a: '인터넷 연결을 확인하고, Google 계정이 정상적으로 로그인되어 있는지 확인해주세요. 문제가 지속되면 로그아웃 후 다시 로그인해보세요.',
      },
      {
        q: '데이터가 사라졌습니다.',
        a: '브라우저 데이터를 초기화하면 로컬 데이터가 삭제될 수 있습니다. Google 계정으로 로그인했다면 클라우드에서 복구가 가능합니다.',
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
      <DialogBody className="max-h-[70dvh] overflow-y-auto">
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
