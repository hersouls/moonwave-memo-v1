import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * Fire confetti when the user hits their daily goal.
 * Watches completed-today count vs dailyGoal setting.
 */
export function useGoalConfetti() {
  const tasks = useTaskStore((s) => s.tasks)
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoal)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (!dailyGoal || dailyGoal <= 0) return

    const today = new Date().toISOString().split('T')[0]
    const completedToday = tasks.filter(
      (t) => t.status === 'completed' && t.completedAt?.startsWith(today),
    ).length

    // Fire confetti only at the exact moment the goal is reached
    if (completedToday >= dailyGoal && prevCountRef.current < dailyGoal) {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      if (!prefersReducedMotion) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6'],
        })
      }
    }
    prevCountRef.current = completedToday
  }, [tasks, dailyGoal])
}
