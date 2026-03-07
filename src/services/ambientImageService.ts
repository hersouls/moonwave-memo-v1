import { useSettingsStore } from '@/stores/settingsStore'
import { getAmbientImage, saveAmbientImage, clearExpiredAmbientImages } from './database'
import type { AmbientImage, WeatherCondition } from '@/lib/types'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS

function getOpenAIKey(): string {
  return useSettingsStore.getState().settings.ai.openaiApiKey
}

function hasApiKey(): boolean {
  return !!getOpenAIKey()
}

// ─── Seasonal / Weather Ambient Image ───────────────

function getSeasonalContext(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const hour = now.getHours()

  let season = ''
  if (month >= 3 && month <= 5) season = 'spring with cherry blossoms and soft green leaves'
  else if (month >= 6 && month <= 8) season = 'summer with warm sunlight and lush greenery'
  else if (month >= 9 && month <= 11) season = 'autumn with golden and red foliage'
  else season = 'winter with snow-covered landscape and cozy atmosphere'

  let timeOfDay = ''
  if (hour >= 5 && hour < 9) timeOfDay = 'early morning with soft golden sunrise light'
  else if (hour >= 9 && hour < 17) timeOfDay = 'daytime with gentle natural lighting'
  else if (hour >= 17 && hour < 21) timeOfDay = 'sunset with warm orange and purple sky'
  else timeOfDay = 'nighttime with moonlight and starry sky'

  return `${season}, ${timeOfDay}`
}

function getWeatherContext(weather?: WeatherCondition | null): string {
  switch (weather) {
    case 'rain': return 'gentle rain falling, wet surfaces, puddles reflecting light'
    case 'snow': return 'light snowfall, frost on windows, winter wonderland'
    case 'overcast': return 'soft overcast sky, diffused light, calm and peaceful'
    case 'clear': return 'clear sky, bright and optimistic atmosphere'
    default: return ''
  }
}

export async function generateAmbientImage(weather?: WeatherCondition | null): Promise<AmbientImage | null> {
  if (!hasApiKey()) return null

  // Check cache first
  const cached = await getAmbientImage('ambient')
  if (cached) return cached

  await clearExpiredAmbientImages()

  const seasonContext = getSeasonalContext()
  const weatherContext = weather ? getWeatherContext(weather) : ''

  const prompt = `A minimal flat vector illustration of a peaceful workspace scene. ${seasonContext}. ${weatherContext}. Soft pastel colors, very clean and simple, no text, no people, subtle and calming. Style: modern flat design illustration with gentle gradients. The image should work as a subtle background decoration without being distracting.`

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getOpenAIKey()}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) return null

    const now = new Date()
    const image: Omit<AmbientImage, 'id'> = {
      type: 'ambient',
      prompt,
      imageUrl: `data:image/png;base64,${b64}`,
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ONE_DAY_MS).toISOString(),
    }

    await saveAmbientImage(image)
    return image as AmbientImage
  } catch {
    return null
  }
}

// ─── World-Building Canvas ──────────────────────────

function buildWorldPrompt(topTags: Array<{ tag: string; count: number }>, totalWords: number): string {
  // Map tags to visual themes
  const tagThemes: Record<string, string> = {
    '개발': 'futuristic sci-fi workspace with holographic screens and neon accents',
    '프로그래밍': 'futuristic coding laboratory with floating code snippets',
    '코딩': 'cyberpunk developer workstation with glowing monitors',
    '일기': 'warm cozy study room with wooden desk, books, and warm lighting',
    '일상': 'comfortable living room with plants and sunlight through windows',
    '아이디어': 'creative workshop with lightbulbs, sketchbooks, and colorful notes on walls',
    '프로젝트': 'organized office with kanban boards and architectural blueprints',
    '미팅': 'modern conference room with panoramic city view',
    '공부': 'academic library with tall bookshelves and reading lamps',
    '여행': 'world map with travel markers, suitcases, and postcards',
    '요리': 'warm kitchen with herbs, spices, and cooking ingredients',
    '운동': 'serene outdoor trail with mountains and fresh morning air',
    '음악': 'cozy music room with instruments and vinyl records',
    '독서': 'quiet reading nook with floor-to-ceiling bookshelves and an armchair',
    '영화': 'home cinema setup with film posters and ambient backlighting',
    '쇼핑': 'modern boutique display with curated items and soft lighting',
  }

  // Build the primary scene from top tags
  let primaryScene = 'a peaceful personal workspace'
  for (const { tag } of topTags) {
    if (tagThemes[tag]) {
      primaryScene = tagThemes[tag]
      break
    }
  }

  // Secondary elements from other tags
  const secondaryElements: string[] = []
  for (const { tag } of topTags.slice(1, 4)) {
    if (tagThemes[tag]) {
      secondaryElements.push(tagThemes[tag].split(' with ')[1] || '')
    }
  }

  // Richness based on total writing volume
  let richness = 'simple and minimal'
  if (totalWords > 50000) richness = 'rich and detailed with many elements'
  else if (totalWords > 20000) richness = 'moderately detailed with some decorative elements'
  else if (totalWords > 5000) richness = 'clean with a few meaningful details'

  const extraDetails = secondaryElements.filter(Boolean).join(', ')

  return `A minimal flat vector illustration of ${primaryScene}. ${extraDetails ? `Include subtle elements: ${extraDetails}.` : ''} The scene should be ${richness}. Style: modern flat design, soft pastel colors, gentle gradients, no text, no people. This represents a personal "knowledge forest" that has grown from writing ${totalWords.toLocaleString()} words. The image should work as a subtle background decoration.`
}

export async function generateWorldBuildingImage(
  topTags: Array<{ tag: string; count: number }>,
  totalWords: number
): Promise<AmbientImage | null> {
  if (!hasApiKey()) return null
  if (topTags.length === 0) return null

  // Check cache (world-building images last a week)
  const cached = await getAmbientImage('world-building')
  if (cached) return cached

  await clearExpiredAmbientImages()

  const prompt = buildWorldPrompt(topTags, totalWords)

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getOpenAIKey()}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) return null

    const now = new Date()
    const tagNames = topTags.map((t) => t.tag)
    const image: Omit<AmbientImage, 'id'> = {
      type: 'world-building',
      prompt,
      imageUrl: `data:image/png;base64,${b64}`,
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ONE_WEEK_MS).toISOString(),
      tags: tagNames,
    }

    await saveAmbientImage(image)
    return image as AmbientImage
  } catch {
    return null
  }
}
