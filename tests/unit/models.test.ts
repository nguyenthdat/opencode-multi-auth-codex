import {
  GPT_5_6_MODELS,
  REASONING_LEVELS,
  generateModelVariants,
  getDefaultModels
} from '../../src/models.js'

describe('model defaults', () => {
  it('exposes GPT-5.6 base and standalone fast models with reasoning variants', () => {
    const models = getDefaultModels()

    expect(REASONING_LEVELS).toEqual(['none', 'low', 'medium', 'high', 'xhigh', 'max'])
    for (const modelID of GPT_5_6_MODELS) {
      const model = models[modelID]
      const fastModel = models[`${modelID}-fast`]
      expect(model).toEqual(
        expect.objectContaining({
          name: `${modelID} (OAuth)`,
          reasoning: true,
          limit: { context: 530_000, input: 400_000, output: 130_000 },
          options: expect.objectContaining({ reasoningEffort: 'medium' })
        })
      )
      expect(Object.keys(model.variants)).toEqual([...REASONING_LEVELS])
      expect(model.variants.max.reasoningEffort).toBe('xhigh')
      expect(model.variants.fast).toBeUndefined()
      expect(fastModel).toEqual(
        expect.objectContaining({
          name: `${modelID}-fast (OAuth)`,
          reasoning: true,
          limit: { context: 530_000, input: 400_000, output: 130_000 },
          options: expect.objectContaining({
            reasoningEffort: 'medium',
            serviceTier: 'priority'
          })
        })
      )
      expect(Object.keys(fastModel.variants)).toEqual([...REASONING_LEVELS])
      for (const reasoningLevel of REASONING_LEVELS) {
        expect(fastModel.variants[reasoningLevel]?.serviceTier).toBe('priority')
      }
      expect(fastModel.variants.max.reasoningEffort).toBe('xhigh')
      expect(models[`${modelID}-max`]).toBeUndefined()
    }
  })

  it('keeps nested fast variants for GPT-5.5 and GPT-5.4', () => {
    const models = getDefaultModels()

    for (const modelID of ['gpt-5.5', 'gpt-5.4']) {
      expect(models[modelID]?.variants.fast).toEqual(
        expect.objectContaining({
          reasoningEffort: 'medium',
          serviceTier: 'priority'
        })
      )
      expect(models[`${modelID}-fast`]).toBeUndefined()
    }
  })

  it('builds paired base and fast entries for discovered GPT-5.6 family models', () => {
    const models = generateModelVariants([
      {
        id: 'gpt-5.6-terra',
        object: 'model',
        created: 0,
        owned_by: 'openai'
      }
    ])

    expect(Object.keys(models)).toEqual(['gpt-5.6-terra', 'gpt-5.6-terra-fast'])
    expect(models['gpt-5.6-terra']?.limit.context).toBe(530_000)
    expect(models['gpt-5.6-terra']?.limit.input).toBe(400_000)
    expect(models['gpt-5.6-terra']?.variants.max.reasoningEffort).toBe('xhigh')
    expect(models['gpt-5.6-terra']?.variants.fast).toBeUndefined()
    expect(models['gpt-5.6-terra-fast']?.options.serviceTier).toBe('priority')
    for (const reasoningLevel of REASONING_LEVELS) {
      expect(models['gpt-5.6-terra-fast']?.variants[reasoningLevel]?.serviceTier).toBe('priority')
    }
    expect(models['gpt-5.6-terra-fast']?.variants.max.reasoningEffort).toBe('xhigh')
  })
})
