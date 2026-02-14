import type { TaskPriority, SuggestedGroup } from '@/lib/types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const PROXY_URL = '/api/ai/proxy'
const MODEL = 'claude-sonnet-4-5-20250929'

interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Try proxy first, fallback to direct browser access */
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 1024
): Promise<string> {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })

  // Try proxy first (no API key exposed in browser)
  let response: Response
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    // If proxy returns 404/405 (not deployed), fall through to direct
    if (response.status === 404 || response.status === 405) {
      throw new Error('proxy-unavailable')
    }
  } catch {
    // Proxy not available — fallback to direct browser access
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body,
    })
  }

  if (!response.ok) {
    const errorBody = await response.text()
    if (response.status === 401) {
      throw new Error('API 키가 유효하지 않습니다. 설정에서 확인해주세요.')
    }
    if (response.status === 429) {
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
    }
    throw new Error(`AI 요청 실패 (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return textBlock?.text || ''
}

// ─── API Key Validation ─────────────────────────────

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const result = await callClaude(
      apiKey,
      'Respond with exactly: OK',
      [{ role: 'user', content: 'ping' }],
      16
    )
    return result.includes('OK') || result.length > 0
  } catch {
    return false
  }
}

// ─── Natural Language Task Parsing ──────────────────

export interface ParsedTask {
  title: string
  dueDate?: string
  priority: TaskPriority
  categoryHint?: string
  memo?: string
}

export async function parseTaskWithAI(
  apiKey: string,
  input: string,
  categories: string[]
): Promise<ParsedTask> {
  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().toLocaleDateString('ko-KR', { weekday: 'long' })

  const systemPrompt = `You are a task parsing assistant for a Korean to-do list app.
Parse the user's natural language input into structured task data.

Today: ${today} (${dayOfWeek})
Available categories: ${categories.join(', ')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "extracted task title",
  "dueDate": "YYYY-MM-DD or null",
  "priority": "none" | "low" | "medium" | "high",
  "categoryHint": "matching category name or null",
  "memo": "any additional notes or null"
}

Rules:
- Extract dates from expressions like "내일", "금요일", "다음주 월요일", "3일 후"
- Map priority keywords: "급한/긴급/중요" → high, "보통" → medium, "낮은/나중에" → low
- Match category hints to the available categories
- Keep the title clean and actionable
- Respond in Korean context`

  const result = await callClaude(
    apiKey,
    systemPrompt,
    [{ role: 'user', content: input }],
    512
  )

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found')
    const parsed = JSON.parse(jsonMatch[0])
    return {
      title: parsed.title || input,
      dueDate: parsed.dueDate || undefined,
      priority: (['none', 'low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'none') as TaskPriority,
      categoryHint: parsed.categoryHint || undefined,
      memo: parsed.memo || undefined,
    }
  } catch {
    return { title: input, priority: 'none' }
  }
}

// ─── Task Decomposition ────────────────────────────

export interface DecomposedSubtask {
  title: string
  sortOrder: number
}

export async function decomposeTaskWithAI(
  apiKey: string,
  taskTitle: string,
  taskMemo?: string
): Promise<DecomposedSubtask[]> {
  const systemPrompt = `You are a task decomposition assistant for a Korean to-do list app.
Break down the given task into 4-7 actionable subtasks.

Return ONLY valid JSON array (no markdown, no explanation):
[
  { "title": "subtask description", "sortOrder": 0 },
  ...
]

Rules:
- Each subtask should be specific and actionable
- Order subtasks logically (preparation → execution → review)
- Use Korean language for subtask titles
- Keep subtask titles concise (under 50 characters)
- Do NOT include the main task itself as a subtask`

  const userMessage = taskMemo
    ? `작업: ${taskTitle}\n메모: ${taskMemo}`
    : `작업: ${taskTitle}`

  const result = await callClaude(
    apiKey,
    systemPrompt,
    [{ role: 'user', content: userMessage }],
    512
  )

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('JSON array not found')
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.map((item: { title: string }, i: number) => ({
      title: item.title,
      sortOrder: i,
    }))
  } catch {
    throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.')
  }
}

// ─── Productivity Summary ──────────────────────────

export interface ProductivitySummary {
  summary: string
  highlights: string[]
  suggestion: string
}

export async function generateProductivitySummary(
  apiKey: string,
  stats: {
    totalCompleted: number
    totalPending: number
    completionRate: number
    topCategories: { name: string; count: number }[]
    recentDays: { date: string; completed: number }[]
    streak: number
  }
): Promise<ProductivitySummary> {
  const systemPrompt = `You are a productivity coach for a Korean to-do list app.
Analyze the user's task completion data and provide an encouraging summary.

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "2-3 sentence productivity summary in Korean",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "suggestion": "one actionable suggestion in Korean"
}

Rules:
- Be encouraging but realistic
- Use Korean language
- Reference specific numbers from the data
- Keep highlights to 2-4 items
- Make the suggestion specific and actionable`

  const userMessage = `지난 7일 생산성 데이터:
- 완료: ${stats.totalCompleted}건
- 대기중: ${stats.totalPending}건
- 완료율: ${Math.round(stats.completionRate)}%
- 연속 달성: ${stats.streak}일
- 카테고리별: ${stats.topCategories.map((c) => `${c.name}(${c.count}건)`).join(', ')}
- 일별 완료: ${stats.recentDays.map((d) => `${d.date}: ${d.completed}건`).join(', ')}`

  const result = await callClaude(
    apiKey,
    systemPrompt,
    [{ role: 'user', content: userMessage }],
    512
  )

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found')
    return JSON.parse(jsonMatch[0])
  } catch {
    return {
      summary: `이번 주 ${stats.totalCompleted}개의 작업을 완료했습니다.`,
      highlights: [`완료율: ${Math.round(stats.completionRate)}%`],
      suggestion: '매일 꾸준히 작업을 완료해보세요.',
    }
  }
}

// ─── AI Task Grouping Suggestion ──────────────────

export async function suggestTaskGroups(
  apiKey: string,
  tasks: { id: number; title: string; categoryName?: string; dueDate?: string; memo?: string }[]
): Promise<SuggestedGroup[]> {
  const systemPrompt = `You are a project management assistant for a Korean to-do list app.
Analyze the user's tasks and suggest logical groupings (3-5 groups).

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "name": "group name in Korean",
    "description": "brief description in Korean",
    "color": "#hex color",
    "taskIds": [1, 2, 3],
    "reason": "why these tasks are grouped together in Korean"
  }
]

Rules:
- Group related tasks by theme, project, or goal
- Use Korean for all text
- Choose distinct hex colors for each group: #3B82F6, #10B981, #F59E0B, #EF4444, #8B5CF6, #EC4899, #06B6D4
- Each task should appear in at most one group
- Not all tasks need to be grouped — skip unrelated ones
- Provide 3-5 groups maximum
- Keep names concise (under 20 characters)`

  const taskList = tasks.map((t) =>
    `[${t.id}] ${t.title}${t.categoryName ? ` (${t.categoryName})` : ''}${t.dueDate ? ` 마감:${t.dueDate}` : ''}${t.memo ? ` 메모:${t.memo.slice(0, 50)}` : ''}`
  ).join('\n')

  const result = await callClaude(
    apiKey,
    systemPrompt,
    [{ role: 'user', content: `다음 할일들을 분석하여 관련 작업끼리 그룹으로 묶어주세요:\n\n${taskList}` }],
    1024
  )

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('JSON array not found')
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.map((g: SuggestedGroup) => ({
      name: g.name,
      description: g.description || '',
      color: g.color || '#3B82F6',
      taskIds: Array.isArray(g.taskIds) ? g.taskIds : [],
      reason: g.reason || '',
    }))
  } catch {
    throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.')
  }
}

// ─── AI Next Steps Suggestion ─────────────────────

export interface NextStepsSuggestion {
  summary: string
  nextSteps: string[]
  tip: string
}

export async function suggestNextSteps(
  apiKey: string,
  groupName: string,
  tasks: { title: string; status: string; dueDate?: string }[]
): Promise<NextStepsSuggestion> {
  const systemPrompt = `You are a project management coach for a Korean to-do list app.
Analyze the group's task progress and suggest next steps.

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "1-2 sentence progress summary in Korean",
  "nextSteps": ["step 1", "step 2", "step 3"],
  "tip": "one helpful tip in Korean"
}

Rules:
- Analyze which tasks are completed vs pending
- Suggest prioritized next actions
- Use Korean language
- Keep nextSteps to 2-4 items
- Make the tip specific to this group`

  const taskList = tasks.map((t) =>
    `[${t.status === 'completed' ? '✅' : '⬜'}] ${t.title}${t.dueDate ? ` (마감: ${t.dueDate})` : ''}`
  ).join('\n')

  const result = await callClaude(
    apiKey,
    systemPrompt,
    [{ role: 'user', content: `그룹: ${groupName}\n\n작업 목록:\n${taskList}` }],
    512
  )

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found')
    return JSON.parse(jsonMatch[0])
  } catch {
    const completed = tasks.filter((t) => t.status === 'completed').length
    return {
      summary: `${tasks.length}개 작업 중 ${completed}개 완료됨.`,
      nextSteps: ['남은 작업을 확인하고 우선순위를 정해보세요.'],
      tip: '가장 긴급한 작업부터 처리하세요.',
    }
  }
}
