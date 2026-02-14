import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface TaskEmptyStateProps {
  className?: string
}

export function TaskEmptyState({ className }: TaskEmptyStateProps) {
  const getContextualMessage = () => {
    const hour = new Date().getHours()

    if (hour >= 5 && hour < 12) {
      return {
        title: '좋은 아침입니다! ☀️',
        description: '오늘의 목표를 세우고 하루를 시작해보세요.'
      }
    } else if (hour >= 12 && hour < 18) {
      return {
        title: '오후도 힘내세요! 💪',
        description: '남은 작업들을 차근차근 처리해보세요.'
      }
    } else if (hour >= 18 && hour < 22) {
      return {
        title: '오늘 하루도 수고하셨습니다 🌙',
        description: '남은 작업을 마무리하고 휴식을 취하세요.'
      }
    } else {
      return {
        title: '편안한 밤 되세요 ⭐',
        description: '내일의 계획을 미리 세워보는 건 어떨까요?'
      }
    }
  }

  const { title, description } = getContextualMessage()

  return (
    <EmptyState
      icon={<ClipboardList className="w-full h-full" />}
      title={title}
      description={description}
      className={className}
      size="md"
    />
  )
}
