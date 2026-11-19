declare module '@deepseek-ai/cordis' {
  export interface Context {
    tools: {
      register(tool: unknown): void
    }
    effect(fn: () => void | (() => void)): void
    get(name: string): unknown
    logger?: {
      info(...args: unknown[]): void
      warn(...args: unknown[]): void
      error(...args: unknown[]): void
    }
    llm: {
      listProviders(): unknown
      listModels(provider: string): Promise<unknown> | unknown
      stream(options: {
        provider: string
        model: string
        messages: Array<{
          role: 'user'
          content: Array<{ type: 'text'; text: string }>
        }>
        signal?: AbortSignal
      }): AsyncIterable<unknown>
    }
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>
      }): () => void
    }
    connection?: {
      requestRejection(
        request: import('node:http').IncomingMessage
      ): number | { status?: number; statusCode?: number } | undefined | null
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
