import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'

const PROMPTS = [
  '오늘 가장 기억에 남는 순간은?',
  '1년 후의 나에게 편지를 쓴다면?',
  '최근 읽은 책/영화에서 인상 깊었던 점은?',
  '오늘 감사한 세 가지를 적어보세요.',
  '지금 이 순간 가장 하고 싶은 일은?',
  '최근 배운 것 중 가장 유용했던 것은?',
  '5년 전의 나에게 해주고 싶은 말은?',
  '오늘 하루를 한 단어로 표현하면?',
  '나를 가장 행복하게 만드는 것은?',
  '이번 주에 도전하고 싶은 것은?',
  '가장 좋아하는 장소와 그 이유는?',
  '최근에 받은 가장 좋은 조언은?',
  '지금 고민 중인 것이 있다면?',
  '오늘 만난 사람에게서 느낀 점은?',
  '내가 가장 잘하는 것은?',
  '어릴 때의 꿈과 지금의 꿈은?',
  '최근 나를 웃게 만든 일은?',
  '가장 소중한 인간관계는?',
  '오늘 배운 새로운 사실은?',
  '나만의 스트레스 해소법은?',
  '가장 기억에 남는 여행은?',
  '올해 이루고 싶은 목표는?',
  '나에게 영감을 주는 사람은?',
  '최근 나를 성장시킨 경험은?',
  '가장 좋아하는 음식과 추억은?',
  '10년 후 나는 어디에 있을까?',
  '오늘의 날씨가 나에게 주는 느낌은?',
  '가장 최근에 도전한 것은?',
  '나의 하루 루틴에서 바꾸고 싶은 것은?',
  '가장 좋아하는 계절과 그 이유는?',
  '오늘 가장 많이 생각한 것은?',
  '나만의 모닝 루틴을 만든다면?',
  '가장 자랑스러운 성취는?',
  '이번 달에 시작하고 싶은 습관은?',
  '나를 설레게 하는 것은?',
  '가장 좋아하는 노래와 그 이유는?',
  '오늘 나에게 주고 싶은 칭찬은?',
  '최근 읽은 글 중 기억에 남는 문장은?',
  '나의 이상적인 하루는 어떤 모습일까?',
  '가장 좋아하는 취미와 시작한 계기는?',
  '오늘 일어난 작은 기적은?',
  '내 인생의 터닝 포인트는?',
  '지금 가장 필요한 것은?',
  '가장 좋아하는 시간대와 그 이유는?',
  '나에게 힘을 주는 말은?',
  '최근 새로 알게 된 사람은?',
  '가장 많이 사용하는 앱과 그 이유는?',
  '오늘의 점심 메뉴를 특별하게 만든다면?',
  '나만의 작은 행복 리스트를 만든다면?',
  '이번 주말에 하고 싶은 것은?',
  '가장 오래된 친구와의 추억은?',
  '내가 세상에 기여할 수 있는 것은?',
]

function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

export function WritingPromptWidget() {
  const navigate = useNavigate()

  const prompt = useMemo(() => {
    const dayOfYear = getDayOfYear()
    return PROMPTS[dayOfYear % PROMPTS.length]
  }, [])

  return (
    <WidgetCard icon={Lightbulb} tint="amber" title="오늘의 글감">
      <p className="mb-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {prompt}
      </p>

      <button
        type="button"
        onClick={() => navigate('/memo/new')}
        className="inline-flex min-h-11 items-center gap-1 -mx-2 -my-1 rounded-lg px-2 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100/60 dark:text-amber-400 dark:hover:bg-amber-900/20"
      >
        이 주제로 작성하기
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </WidgetCard>
  )
}
