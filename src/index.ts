import type { Context } from '@deepseek-ai/cordis'
import { registerTools } from './tools/registerTools.js'

export const name = 'dev-tools'
export const inject = ['tools']

/**
 * Dev Tools dsh 插件：侧栏开发者工具箱 + Agent 工具
 */
export function apply(ctx: Context) {
  registerTools(ctx)
  ctx.logger?.info?.('[dev-tools] agent tools registered')
}
