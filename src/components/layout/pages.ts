/* 화면의 머리글: 화면과, 그 화면을 불러오는 동안의 모습(PageLoading)이 같은 글을 써요.
   그래야 내용이 들어올 때 제목이 바뀌지 않아요. */

export const MEMOS_TITLE = '메모'

export const CALENDAR_HEAD = { title: '캘린더', description: '날짜를 누르면 그날 쓴 메모를 볼 수 있어요.' }

/** 편집기의 제목: 편집기 맨 위의 페이지 머리에 보여요. */
export function editorTitle(isNew: boolean): string {
  return isNew ? '새 메모 쓰기' : '메모 고치기'
}

/** 홈의 제목: 시간에 맞춘 인사예요. */
export function timeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '좋은 오후예요'
  return '좋은 저녁이에요'
}

/** 홈의 설명: 오늘 날짜예요. */
export function todayLine(): string {
  return new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
}
