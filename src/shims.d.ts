declare module '@deepseek-ai/cordis' {
  export interface Context {
    tools: {
      register(tool: unknown): void
    }
    effect(fn: () => void | (() => void)): void
    logger?: {
      info(...args: unknown[]): void
      warn(...args: unknown[]): void
      error(...args: unknown[]): void
    }
  }
}

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool<TArgs = Record<string, unknown>, TOut = unknown>(def: {
    name: string
    description: string
    parameters?: Record<string, unknown>
    output?: {
      schema?: unknown
      render?: (args: TArgs, value: TOut) => Array<{ type: string; text: string }>
    }
    execute: (args: TArgs, exec?: { signal?: AbortSignal }) => Promise<TOut> | TOut
  }): unknown
}
