import type { OpenAIModel, ProviderModel, ProviderModelOptions } from './types.js'

const MODELS_ENDPOINT = 'https://api.openai.com/v1/models'

export const REASONING_LEVELS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const
type ReasoningLevel = (typeof REASONING_LEVELS)[number]

export const GPT_5_6_MODELS = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] as const

const MODEL_LIMITS: Record<string, { context: number; input?: number; output: number }> = {
  'gpt-5.6-sol': { context: 530_000, input: 400_000, output: 130_000 },
  'gpt-5.6-luna': { context: 530_000, input: 400_000, output: 130_000 },
  'gpt-5.6-terra': { context: 530_000, input: 400_000, output: 130_000 },
  'gpt-5.5': { context: 530000, input: 400000, output: 130000 },
  'gpt-5.4': { context: 1050000, input: 922000, output: 128000 },
  'gpt-5.3': { context: 272000, output: 128000 },
  'gpt-5.3-codex-spark': { context: 272000, output: 128000 },
  'gpt-5.2': { context: 272000, output: 128000 },
  'gpt-5.3-codex': { context: 272000, output: 128000 },
  'gpt-5.2-codex': { context: 272000, output: 128000 },
  'gpt-5.1': { context: 272000, output: 128000 },
  'gpt-5.1-codex': { context: 272000, output: 128000 },
  'gpt-5.1-codex-max': { context: 272000, output: 128000 },
  'gpt-5.1-codex-mini': { context: 272000, output: 128000 }
}

function getModelLimits(modelId: string): { context: number; input?: number; output: number } {
  for (const [prefix, limits] of Object.entries(MODEL_LIMITS)) {
    if (modelId.startsWith(prefix)) return limits
  }
  return { context: 128000, output: 32000 }
}

function isGPT56Family(baseId: string): boolean {
  return baseId.startsWith('gpt-5.6-')
}

function buildReasoningOptions(
  level: ReasoningLevel,
  serviceTier?: 'priority'
): ProviderModelOptions {
  // OpenAI names its strongest effort "xhigh"; expose "max" as an OpenCode alias.
  const reasoningEffort = level === 'max' ? 'xhigh' : level

  return {
    reasoningEffort,
    reasoningSummary:
      reasoningEffort === 'high' || reasoningEffort === 'xhigh' ? 'detailed' : 'auto',
    textVerbosity: 'medium',
    include: ['reasoning.encrypted_content'],
    store: false,
    ...(serviceTier ? { serviceTier } : {})
  }
}

function supportsFastMode(baseId: string): boolean {
  return baseId === 'gpt-5.5' || baseId === 'gpt-5.4'
}

function getReasoningLevels(baseId: string): readonly ReasoningLevel[] {
  if (isGPT56Family(baseId)) return REASONING_LEVELS
  if (baseId === 'gpt-5.1-codex-mini') return ['medium', 'high']
  if (baseId === 'gpt-5.1-codex') return ['low', 'medium', 'high']
  if (baseId === 'gpt-5.1') return ['none', 'low', 'medium', 'high']
  if (baseId.includes('codex')) return ['low', 'medium', 'high', 'xhigh']
  return ['none', 'low', 'medium', 'high', 'xhigh']
}

function buildProviderModel(modelId: string, serviceTier?: 'priority'): ProviderModel {
  const variants = Object.fromEntries(
    getReasoningLevels(modelId).map((level) => [level, buildReasoningOptions(level, serviceTier)])
  )

  if (supportsFastMode(modelId)) {
    variants.fast = {
      ...buildReasoningOptions('medium'),
      serviceTier: 'priority'
    }
  }

  return {
    name: `${modelId} (OAuth)`,
    reasoning: true,
    limit: getModelLimits(modelId),
    modalities: {
      input: ['text', 'image'],
      output: ['text']
    },
    options: buildReasoningOptions('medium', serviceTier),
    variants
  }
}

function addProviderModels(result: Record<string, ProviderModel>, baseId: string): void {
  result[baseId] = buildProviderModel(baseId)

  if (isGPT56Family(baseId)) {
    const fastModelId = `${baseId}-fast`
    result[fastModelId] = buildProviderModel(fastModelId, 'priority')
  }
}

export async function fetchAvailableModels(token: string): Promise<OpenAIModel[]> {
  try {
    const res = await fetch(MODELS_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) {
      console.error(`[multi-auth] Failed to fetch models: ${res.status}`)
      return []
    }

    const data = (await res.json()) as { data?: OpenAIModel[] }
    return data.data || []
  } catch (err) {
    console.error('[multi-auth] Error fetching models:', err)
    return []
  }
}

export function filterGPT5Models(models: OpenAIModel[]): OpenAIModel[] {
  return models.filter((m) => m.id.match(/^gpt-5/))
}

export function generateModelVariants(baseModels: OpenAIModel[]): Record<string, ProviderModel> {
  const result: Record<string, ProviderModel> = {}

  for (const model of baseModels) {
    addProviderModels(result, model.id)
  }

  return result
}

export function getDefaultModels(): Record<string, ProviderModel> {
  const defaults = [
    ...GPT_5_6_MODELS,
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3',
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex',
    'gpt-5.2',
    'gpt-5.2-codex',
    'gpt-5.1',
    'gpt-5.1-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini'
  ]

  const result: Record<string, ProviderModel> = {}

  for (const baseId of defaults) {
    addProviderModels(result, baseId)
  }

  return result
}

let cachedModels: Record<string, ProviderModel> | null = null
let cacheExpiry = 0

export async function getModels(token?: string): Promise<Record<string, ProviderModel>> {
  const now = Date.now()
  const CACHE_TTL = 60 * 60 * 1000

  if (cachedModels && now < cacheExpiry) {
    return cachedModels
  }

  if (token) {
    const fetched = await fetchAvailableModels(token)
    const gpt5 = filterGPT5Models(fetched)

    if (gpt5.length > 0) {
      cachedModels = generateModelVariants(gpt5)
      cacheExpiry = now + CACHE_TTL
      return cachedModels
    }
  }

  cachedModels = getDefaultModels()
  cacheExpiry = now + CACHE_TTL
  return cachedModels
}
