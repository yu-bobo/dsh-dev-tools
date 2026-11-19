import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { TOOL_CATALOG, runTool, type RunArgs, type ToolId } from '../core/ops.js'
import { translateText } from '../core/translate.js'

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
        '列出 dsh-dev-tools 可用的本地小工具与动作（JSON/时间戳/UUID/Base64/Hash/AES/Diff 等）。自然语言翻译不在此列表，请调用 devtools_translate。',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_a, v) => [{ type: 'text', text: String(v) }]
      },
      async execute() {
        return textOut(
          JSON.stringify(TOOL_CATALOG, null, 2) +
            '\n\nTranslation is not in this list. Call devtools_translate({ input, target, source? }).'
        )
      }
    })
  )

  ctx.tools.register(
    defineTool({
      name: 'devtools_run',
      description:
        '运行 dsh-dev-tools 中的某个本地开发者工具。tool + action 见 devtools_list；常见：json/format、timestamp/now、uuid/v4、base64/encode、hash/sha256、aes/encrypt、diff/compare。翻译请调用 devtools_translate，不要把 translate 当作这里的 tool。',
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
        input: { type: 'string', description: '输入文本（多数动作需要；diff 为左侧原文）' },
        inputB: { type: 'string', description: 'diff 右侧对比文本' },
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
            inputB: args.inputB == null ? undefined : String(args.inputB),
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

  ctx.tools.register(
    defineTool({
      name: 'devtools_translate',
      description:
        '用宿主已配置的模型翻译文本，不需要单独的翻译 API Key，会消耗模型 token。保留代码块、URL 和 {name}、%s 这类占位符。input 为原文，target 为目标语言（如 English、中文、日本語），source 可选。单次最多 12000 字。',
      parameters: {
        input: { type: 'string', required: true, description: '待翻译原文' },
        target: { type: 'string', required: true, description: '目标语言，如 English、中文、日本語' },
        source: { type: 'string', description: '源语言；省略则由模型判断' }
      },
      output: {
        schema: { type: 'string' },
        render: (_a, v) => [{ type: 'text', text: String(v) }]
      },
      async execute(args: Record<string, unknown>, exec?: { signal?: AbortSignal }) {
        try {
          return textOut(
            await translateText(
              ctx,
              {
                input: args.input == null ? '' : String(args.input),
                target: args.target == null ? '' : String(args.target),
                source: args.source == null ? undefined : String(args.source)
              },
              exec?.signal
            )
          )
        } catch (e: any) {
          return textOut(`ERROR: ${e?.message || e}`)
        }
      }
    })
  )
}
