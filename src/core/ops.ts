import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export type ToolId =
  | 'json'
  | 'timestamp'
  | 'uuid'
  | 'base64'
  | 'url'
  | 'hash'
  | 'aes'
  | 'hex'
  | 'jwt'
  | 'text-case'
  | 'number-base'
  | 'query-string'

export const TOOL_CATALOG: Array<{
  id: ToolId
  actions: string[]
  summary: string
}> = [
  {
    id: 'json',
    actions: ['format', 'minify', 'validate', 'to_yaml', 'from_yaml'],
    summary: 'JSON format/minify/validate and JSON↔YAML'
  },
  {
    id: 'timestamp',
    actions: ['now', 'to_datetime', 'to_unix'],
    summary: 'Unix timestamp ↔ datetime (ms/s)'
  },
  {
    id: 'uuid',
    actions: ['v4'],
    summary: 'Generate UUID v4 (batch)'
  },
  {
    id: 'base64',
    actions: ['encode', 'decode'],
    summary: 'Base64 encode/decode (utf8)'
  },
  {
    id: 'url',
    actions: ['encode', 'decode'],
    summary: 'URL encode/decode component'
  },
  {
    id: 'hash',
    actions: ['md5', 'sha1', 'sha256', 'sha512', 'hmac_sha256'],
    summary: 'Message digest / HMAC'
  },
  {
    id: 'aes',
    actions: ['encrypt', 'decrypt'],
    summary: 'AES-256-GCM with PBKDF2 passphrase'
  },
  {
    id: 'hex',
    actions: ['to_hex', 'from_hex'],
    summary: 'UTF-8 ↔ hex'
  },
  {
    id: 'jwt',
    actions: ['decode'],
    summary: 'Decode JWT header/payload (no verify)'
  },
  {
    id: 'text-case',
    actions: ['camel', 'pascal', 'snake', 'kebab', 'upper', 'lower', 'title'],
    summary: 'Case conversion'
  },
  {
    id: 'number-base',
    actions: ['convert'],
    summary: 'Convert integer between bases 2–36'
  },
  {
    id: 'query-string',
    actions: ['parse', 'stringify'],
    summary: 'Query string ↔ JSON object'
  }
]

export interface RunArgs {
  tool: ToolId | string
  action: string
  input?: string
  key?: string
  count?: number
  unit?: 's' | 'ms'
  fromBase?: number
  toBase?: number
  timezone?: string
}

function requireInput(input: string | undefined): string {
  if (input == null) throw new Error('input is required')
  return input
}

function uuidV4(): string {
  const buf = randomBytes(16)
  buf[6] = (buf[6] & 0x0f) | 0x40
  buf[8] = (buf[8] & 0x3f) | 0x80
  const hex = buf.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function toCamel(s: string, pascal = false): string {
  const parts = s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase()
      if (i === 0 && !pascal) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

function toSnake(s: string, sep = '_'): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, `$1${sep}$2`)
    .replace(/[^a-zA-Z0-9]+/g, sep)
    .replace(new RegExp(`${sep}+`, 'g'), sep)
    .replace(new RegExp(`^${sep}|${sep}$`, 'g'), '')
    .toLowerCase()
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function parseUnix(input: string, unit: 's' | 'ms' = 's'): Date {
  const n = Number(input.trim())
  if (!Number.isFinite(n)) throw new Error('invalid unix timestamp')
  const ms = unit === 'ms' || Math.abs(n) >= 1e12 ? n : n * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) throw new Error('invalid date')
  return d
}

function aesEncrypt(plain: string, passphrase: string): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256')
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, tag, enc]).toString('base64')
}

function aesDecrypt(payload: string, passphrase: string): string {
  const buf = Buffer.from(payload.trim(), 'base64')
  if (buf.length < 16 + 12 + 16) throw new Error('ciphertext too short')
  const salt = buf.subarray(0, 16)
  const iv = buf.subarray(16, 28)
  const tag = buf.subarray(28, 44)
  const data = buf.subarray(44)
  const key = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

function decodeJwt(token: string): string {
  const parts = token.trim().split('.')
  if (parts.length < 2) throw new Error('invalid JWT')
  const decodePart = (p: string) => {
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return Buffer.from(pad, 'base64').toString('utf8')
  }
  let header: unknown
  let payload: unknown
  try {
    header = JSON.parse(decodePart(parts[0]))
    payload = JSON.parse(decodePart(parts[1]))
  } catch {
    throw new Error('JWT header/payload is not JSON')
  }
  return JSON.stringify({ header, payload, signature: parts[2] || null }, null, 2)
}

/**
 * 执行单个开发者工具动作，返回纯文本结果
 */
export function runTool(args: RunArgs): string {
  const tool = String(args.tool || '') as ToolId
  const action = String(args.action || '')
  const input = args.input
  const catalog = TOOL_CATALOG.find((t) => t.id === tool)
  if (!catalog) throw new Error(`unknown tool: ${tool}`)
  if (!catalog.actions.includes(action)) {
    throw new Error(`unknown action "${action}" for ${tool}; allowed: ${catalog.actions.join(', ')}`)
  }

  switch (tool) {
    case 'json': {
      const raw = requireInput(input)
      if (action === 'format') return JSON.stringify(JSON.parse(raw), null, 2)
      if (action === 'minify') return JSON.stringify(JSON.parse(raw))
      if (action === 'validate') {
        JSON.parse(raw)
        return 'valid'
      }
      if (action === 'to_yaml') return stringifyYaml(JSON.parse(raw))
      if (action === 'from_yaml') return JSON.stringify(parseYaml(raw), null, 2)
      break
    }
    case 'timestamp': {
      if (action === 'now') {
        const ms = Date.now()
        return JSON.stringify(
          {
            unix_s: Math.floor(ms / 1000),
            unix_ms: ms,
            iso: new Date(ms).toISOString(),
            local: new Date(ms).toString()
          },
          null,
          2
        )
      }
      if (action === 'to_datetime') {
        const unit = args.unit === 'ms' ? 'ms' : 's'
        const d = parseUnix(requireInput(input), unit)
        return JSON.stringify(
          {
            unix_s: Math.floor(d.getTime() / 1000),
            unix_ms: d.getTime(),
            iso: d.toISOString(),
            local: d.toString()
          },
          null,
          2
        )
      }
      if (action === 'to_unix') {
        const raw = requireInput(input).trim()
        const d = /^\d+$/.test(raw) ? parseUnix(raw, args.unit === 'ms' ? 'ms' : 's') : new Date(raw)
        if (Number.isNaN(d.getTime())) throw new Error('invalid datetime')
        const unit = args.unit === 'ms' ? 'ms' : 's'
        return String(unit === 'ms' ? d.getTime() : Math.floor(d.getTime() / 1000))
      }
      break
    }
    case 'uuid': {
      const count = Math.min(Math.max(Number(args.count) || 1, 1), 100)
      return Array.from({ length: count }, () => uuidV4()).join('\n')
    }
    case 'base64': {
      const raw = requireInput(input)
      if (action === 'encode') return Buffer.from(raw, 'utf8').toString('base64')
      return Buffer.from(raw.trim(), 'base64').toString('utf8')
    }
    case 'url': {
      const raw = requireInput(input)
      if (action === 'encode') return encodeURIComponent(raw)
      return decodeURIComponent(raw)
    }
    case 'hash': {
      const raw = requireInput(input)
      if (action === 'hmac_sha256') {
        const key = args.key
        if (!key) throw new Error('key is required for hmac_sha256')
        return createHmac('sha256', key).update(raw, 'utf8').digest('hex')
      }
      const algo = action as 'md5' | 'sha1' | 'sha256' | 'sha512'
      return createHash(algo).update(raw, 'utf8').digest('hex')
    }
    case 'aes': {
      const raw = requireInput(input)
      const key = args.key
      if (!key) throw new Error('key (passphrase) is required')
      if (action === 'encrypt') return aesEncrypt(raw, key)
      return aesDecrypt(raw, key)
    }
    case 'hex': {
      const raw = requireInput(input)
      if (action === 'to_hex') return Buffer.from(raw, 'utf8').toString('hex')
      const hex = raw.trim().replace(/\s+/g, '')
      if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2) throw new Error('invalid hex')
      return Buffer.from(hex, 'hex').toString('utf8')
    }
    case 'jwt':
      return decodeJwt(requireInput(input))
    case 'text-case': {
      const raw = requireInput(input)
      if (action === 'camel') return toCamel(raw, false)
      if (action === 'pascal') return toCamel(raw, true)
      if (action === 'snake') return toSnake(raw, '_')
      if (action === 'kebab') return toSnake(raw, '-')
      if (action === 'upper') return raw.toUpperCase()
      if (action === 'lower') return raw.toLowerCase()
      if (action === 'title') return titleCase(raw)
      break
    }
    case 'number-base': {
      const raw = requireInput(input).trim()
      const fromBase = Number(args.fromBase) || 10
      const toBase = Number(args.toBase) || 16
      if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
        throw new Error('fromBase/toBase must be 2–36')
      }
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'
      let neg = false
      let body = raw.toLowerCase()
      if (body.startsWith('-')) {
        neg = true
        body = body.slice(1)
      }
      if (!body) throw new Error('empty number')
      let value = 0n
      for (const ch of body) {
        const d = digits.indexOf(ch)
        if (d < 0 || d >= fromBase) throw new Error(`invalid digit "${ch}" for base ${fromBase}`)
        value = value * BigInt(fromBase) + BigInt(d)
      }
      if (toBase === 10) return (neg ? '-' : '') + value.toString(10)
      if (value === 0n) return '0'
      let out = ''
      let v = value
      while (v > 0n) {
        out = digits[Number(v % BigInt(toBase))] + out
        v = v / BigInt(toBase)
      }
      return neg ? '-' + out : out
    }
    case 'query-string': {
      const raw = requireInput(input)
      if (action === 'parse') {
        const q = raw.startsWith('?') ? raw.slice(1) : raw
        const obj: Record<string, string | string[]> = {}
        for (const part of q.split('&')) {
          if (!part) continue
          const eq = part.indexOf('=')
          const k = decodeURIComponent(eq >= 0 ? part.slice(0, eq) : part)
          const v = decodeURIComponent(eq >= 0 ? part.slice(eq + 1) : '')
          if (k in obj) {
            const cur = obj[k]
            obj[k] = Array.isArray(cur) ? [...cur, v] : [cur as string, v]
          } else obj[k] = v
        }
        return JSON.stringify(obj, null, 2)
      }
      const data = JSON.parse(raw) as Record<string, unknown>
      const parts: string[] = []
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
          for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`)
        } else if (v != null) {
          parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        }
      }
      return parts.join('&')
    }
  }
  throw new Error(`unhandled ${tool}/${action}`)
}
