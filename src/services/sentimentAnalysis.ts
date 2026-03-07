const POSITIVE_WORDS = [
  '\uC88B\uC740', '\uD589\uBCF5', '\uAC10\uC0AC', '\uC990\uAC70\uC6B4', '\uAE30\uC05C', '\uC0AC\uB791', '\uC131\uACF5', '\uC644\uB8CC', '\uB2EC\uC131', '\uCD95\uD558',
  '\uBFCC\uB4EF', '\uC124\uB808', '\uCD5C\uACE0',
]
const NEGATIVE_WORDS = [
  '\uD798\uB4E0', '\uC5B4\uB824\uC6B4', '\uC2AC\uD508', '\uC9DC\uC99D', '\uC2E4\uD328', '\uAC71\uC815', '\uC2A4\uD2B8\uB808\uC2A4', '\uBD88\uC548', '\uD654\uAC00', '\uD53C\uACE4',
  '\uC9C0\uCE5C', '\uC6B0\uC6B8',
]

export type Mood = 'positive' | 'neutral' | 'negative'

export function analyzeSentiment(text: string): Mood {
  const lower = text.toLowerCase()
  let pos = 0
  let neg = 0
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) pos++
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) neg++
  if (pos > neg + 1) return 'positive'
  if (neg > pos + 1) return 'negative'
  return 'neutral'
}
