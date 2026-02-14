import type { ChartOptions } from 'chart.js'

export const dailyBarChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.parsed.y}개 완료`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 12, family: 'Pretendard' },
        color: '#a1a1aa',
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        font: { size: 11, family: 'Pretendard' },
        color: '#a1a1aa',
      },
      grid: {
        color: 'rgba(161, 161, 170, 0.1)',
      },
    },
  },
}

export const categoryDoughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        font: { size: 12, family: 'Pretendard' },
        usePointStyle: true,
        pointStyleWidth: 10,
        padding: 12,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.label}: ${ctx.parsed}개`,
      },
    },
  },
  cutout: '65%',
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function getBarChartColor(isDark: boolean): string {
  return isDark ? 'rgba(96, 165, 250, 0.8)' : 'rgba(59, 130, 246, 0.8)'
}
