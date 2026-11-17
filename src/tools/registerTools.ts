import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { TOOL_CATALOG, runTool, type RunArgs, type ToolId } from '../core/ops.js'

function textOut(text: string) {
  return text
}

/**
 * 注册 Dev Tools 相关 agent 工具
 */
export function registerTools(ctx: Context): void {
  ctx.tools.register(
    defineTool({
      name: 'devtools_list',
      description:
        '列出 dsh-dev-tools 可用的开发者小工具与动作（JSON/时间戳/UUID/Base64/Hash/AES 等）。调用具体转换前可先看此列表。',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_a, v) => [{ type: 'text', text: String(v) }]
      },
      async execute() {
        return textOut(JSON.stringify(TOOL_CATALOG, null, 2))
      }
    })
  )

  ctx.tools.register(
    defineTool({
      name: 'devtools_run',
      description:
        '运行 dsh-dev-tools 中的某个开发者工具。tool + action 见 devtools_list；常见：json/format、timestamp/now、uuid/v4、base64/encode、hash/sha256、aes/encrypt。',
      parameters: {
        tool: {
          type: 'string',
          required: true,
          description: `工具 id：${TOOL_CATALOG.map((t) => t.id).join(' | ')}`
        },
        action: {
          type: 'string',
          required: true,
          description: '动作名，见对应工具的 actions'
        },
        input: { type: 'string', description: '输入文本（多数动作需要）' },
        key: { type: 'string', description: '密钥/口令（hash hmac、aes 需要）' },
        count: { type: 'number', description: 'uuid 批量数量，1–100' },
        unit: { type: 'string', description: 'timestamp 单位：s | ms' },
        fromBase: { type: 'number', description: 'number-base 源进制 2–36' },
        toBase: { type: 'number', description: 'number-base 目标进制 2–36' }
      },
      output: {
        schema: { type: 'string' },
        render: (_a, v) => [{ type: 'text', text: String(v) }]
      },
      async execute(args: Record<string, unknown>) {
        try {
          const runArgs: RunArgs = {
            tool: String(args.tool || '') as ToolId,
            action: String(args.action || ''),
            input: args.input == null ? undefined : String(args.input),
            key: args.key == null ? undefined : String(args.key),
            count: args.count == null ? undefined : Number(args.count),
            unit: args.unit === 'ms' ? 'ms' : args.unit === 's' ? 's' : undefined,
            fromBase: args.fromBase == null ? undefined : Number(args.fromBase),
            toBase: args.toBase == null ? undefined : Number(args.toBase)
          }
          return textOut(runTool(runArgs))
        } catch (e: any) {
          return textOut(`ERROR: ${e?.message || e}`)
        }
      }
    })
  )
}
