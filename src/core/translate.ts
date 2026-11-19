import type { Context } from '@deepseek-ai/cordis'

export const TRANSLATE_PATH = '/dev-tools/translate'
export const TRANSLATE_MAX_CHARS = 12000
export const TRANSLATE_MAX_BODY_BYTES = 100 * 1024

export class TranslateError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TranslateError'
    this.status = status
  }
}

export interface TranslateInput {
  input?: string
  target?: string
  source?: string
}

interface StreamChunk {
  type: string
  text?: string
  block?: { type?: string; text?: string }
  reason?: { kind?: string; failure?: { code?: string } }
}

function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function rowId(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const row = value as { id?: unknown; name?: unknown; provider?: unknown }
  if (typeof row.id === 'string' && row.id) return row.id
  if (typeof row.provider === 'string' && row.provider) return row.provider
  if (typeof row.name === 'string' && row.name) return row.name
  return ''
}

function defaultSelection(ctx: Context): { provider: string; model: string } | undefined {
  let svc: unknown
  try {
    svc = ctx.get('agentDefaultModel')
  } catch {
    return
  }
  if (!svc || typeof svc !== 'object' || typeof (svc as { currentSelection?: unknown }).currentSelection !== 'function') {
    return
  }
  let selection: { provider?: unknown; model?: unknown }
  try {
    selection = (svc as { currentSelection: () => { provider?: unknown; model?: unknown } }).currentSelection()
  } catch {
    return
  }
  const provider = typeof selection?.provider === 'string' ? selection.provider.trim() : ''
  const model = typeof selection?.model === 'string' ? selection.model.trim() : ''
  if (!provider || !model) return
  return { provider, model }
}

async function advertisedModel(ctx: Context, provider: string): Promise<string | undefined> {
  try {
    const models = asRows(await ctx.llm.listModels(provider)).map(rowId).filter(Boolean)
    if (!models.length) return
    return models.find((id) => /flash/i.test(id)) || models[0]
  } catch {
    return
  }
}

// 优先用当前默认模型。deepseek-official 可能已注册但没有目录，账号登录实际走 deepseek-account。
export async function resolveTranslateModel(ctx: Context): Promise<{ provider: string; model: string }> {
  const selected = defaultSelection(ctx)
  if (selected) return selected
  const providers = asRows(await ctx.llm.listProviders()).map(rowId).filter(Boolean)
  if (!providers.length) throw new TranslateError('no model provider is configured', 503)
  const preferred = ['deepseek-account', 'deepseek-official']
  const ordered = [
    ...preferred.filter((id) => providers.includes(id)),
    ...providers.filter((id) => !preferred.includes(id))
  ]
  let fallback: { provider: string; model: string } | undefined
  for (const provider of ordered) {
    const model = await advertisedModel(ctx, provider)
    if (!model) continue
    const choice = { provider, model }
    if (/flash/i.test(model)) return choice
    if (!fallback) fallback = choice
  }
  if (fallback) return fallback
  throw new TranslateError('no model is advertised', 503)
}

// source 为空时让模型自行判断源语言。
export function buildTranslatePrompt(input: string, target: string, source?: string): string {
  return [
    'Translate the following text.',
    `Target language: ${target}.`,
    source ? `Source language: ${source}.` : 'Detect the source language.',
    'Return only the translated text.',
    'Keep markdown structure, fenced code, inline code, URLs, file paths, and placeholders like {name}, {{name}}, %s, and %d unchanged.',
    'Do not add quotes or commentary.',
    '',
    input
  ].join('\n')
}

const WRAPPER_LANG = new Set(['', 'markdown', 'md', 'text', 'txt', 'plaintext'])

// 只去掉模型在整段译文外多包的纯文本围栏。带语言标记的代码块保留。
export function unwrapFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```') || !trimmed.endsWith('```')) return trimmed
  const inner = trimmed.slice(3, -3)
  const nl = inner.indexOf('\n')
  const head = (nl === -1 ? inner : inner.slice(0, nl)).trim()
  if (head.includes('```') || (head !== '' && /\s/.test(head))) return trimmed
  if (!WRAPPER_LANG.has(head.toLowerCase())) return trimmed
  if (nl === -1) return ''
  return inner.slice(nl + 1).replace(/\n$/, '')
}

function normalizeRequest(raw: TranslateInput): { input: string; target: string; source?: string } {
  const input = raw.input == null ? '' : String(raw.input)
  const target = raw.target == null ? '' : String(raw.target).trim()
  const source = raw.source == null ? '' : String(raw.source).trim()
  if (!input.trim()) throw new TranslateError('input is required')
  if (input.length > TRANSLATE_MAX_CHARS) {
    throw new TranslateError(`input exceeds ${TRANSLATE_MAX_CHARS} characters`)
  }
  if (!target) throw new TranslateError('target is required')
  return { input, target, source: source || undefined }
}

// 调用宿主模型翻译一段文本。凭据留在已配置的 provider 里。
export async function translateText(ctx: Context, raw: TranslateInput, signal?: AbortSignal): Promise<string> {
  const { input, target, source } = normalizeRequest(raw)
  if (signal?.aborted) throw new TranslateError('aborted', 499)
  const { provider, model } = await resolveTranslateModel(ctx)
  let delta = ''
  let blockText = ''
  let finishKind = ''
  let finishCode = ''
  const stream = ctx.llm.stream({
    provider,
    model,
    signal,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: buildTranslatePrompt(input, target, source) }]
      }
    ]
  })
  for await (const chunk of stream as AsyncIterable<StreamChunk>) {
    if (signal?.aborted) throw new TranslateError('aborted', 499)
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') delta += chunk.text
    if (chunk.type === 'block-end' && chunk.block?.type === 'text' && typeof chunk.block.text === 'string') {
      blockText = chunk.block.text
    }
    if (chunk.type === 'finish') {
      finishKind = chunk.reason?.kind || ''
      finishCode = chunk.reason?.failure?.code || ''
    }
  }
  if (finishKind === 'error' || finishKind === 'aborted') {
    throw new TranslateError(finishCode || finishKind, 502)
  }
  const text = unwrapFence(delta || blockText)
  if (!text) throw new TranslateError('model returned empty text', 502)
  return text
}
