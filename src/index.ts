import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { TRANSLATE_MAX_BODY_BYTES, TRANSLATE_PATH, TranslateError, translateText, type TranslateInput } from './core/translate.js'
import { registerTools } from './tools/registerTools.js'

export const name = 'dev-tools'
export const inject = ['tools', 'llm', 'webServer']

function rejectionStatus(ctx: Context, req: IncomingMessage): number | undefined {
  let connection: Context['connection']
  try {
    connection = ctx.connection
  } catch {
    return
  }
  if (!connection || typeof connection.requestRejection !== 'function') return
  const rejected = connection.requestRejection(req)
  if (rejected == null) return
  if (typeof rejected === 'number') return rejected
  const status = rejected.status ?? rejected.statusCode
  return typeof status === 'number' ? status : 401
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }
    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buf.length
      if (size > limit) {
        fail(new TranslateError('body too large', 413))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', (err) => {
      fail(err instanceof Error ? err : new Error(String(err)))
    })
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function handleTranslate(ctx: Context, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('allow', 'POST')
    res.end()
    return
  }
  const denied = rejectionStatus(ctx, req)
  if (denied) {
    sendJson(res, denied, { ok: false, error: 'unauthorized' })
    return
  }
  const ac = new AbortController()
  // 请求体读完后 IncomingMessage 就会 close，不能拿它判断客户端断开。
  const onClose = () => {
    if (!res.writableFinished) ac.abort()
  }
  res.on('close', onClose)
  try {
    const raw = await readBody(req, TRANSLATE_MAX_BODY_BYTES)
    let payload: TranslateInput
    try {
      const parsed = raw ? JSON.parse(raw) : {}
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TranslateError('invalid JSON')
      }
      payload = parsed as TranslateInput
    } catch (e) {
      if (e instanceof TranslateError) throw e
      throw new TranslateError('invalid JSON')
    }
    const text = await translateText(ctx, payload, ac.signal)
    sendJson(res, 200, { ok: true, text })
  } catch (e) {
    if (ac.signal.aborted || res.writableEnded) return
    const status = e instanceof TranslateError ? e.status : 502
    const error = e instanceof Error ? e.message : String(e)
    sendJson(res, status, { ok: false, error })
  } finally {
    res.off('close', onClose)
  }
}

/**
 * Dev Tools dsh 插件：侧栏开发者工具箱 + Agent 工具
 */
export function apply(ctx: Context) {
  registerTools(ctx)
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: TRANSLATE_PATH,
      handler: (req, res) => {
        void handleTranslate(ctx, req, res)
      }
    })
  )
  ctx.logger?.info?.('[dev-tools] agent tools registered')
}
