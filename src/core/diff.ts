// 宿主与侧栏共用的行级 Diff 算法（唯一实现）

export type DiffLineType = 'equal' | 'add' | 'del'

export interface DiffLine {
  type: DiffLineType
  text: string
  aLine?: number
  bLine?: number
}

export interface DiffResult {
  lines: DiffLine[]
  added: number
  removed: number
}

export type DiffFoldItem =
  | { kind: 'line'; line: DiffLine }
  | { kind: 'fold'; id: string; count: number }

function splitLines(text: string): string[] {
  if (text === '') return []
  return String(text).split('\n')
}

/**
 * 行级 LCS Diff
 */
export function lineDiff(aText: string, bText: string, ignoreTrailingWs = false): DiffResult {
  const norm = (s: string) => (ignoreTrailingWs ? s.replace(/[ \t]+$/g, '') : s)
  const a = splitLines(aText).map(norm)
  const b = splitLines(bText).map(norm)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  let aLine = 1
  let bLine = 1
  let added = 0
  let removed = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'equal', text: a[i], aLine, bLine })
      i++
      j++
      aLine++
      bLine++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'del', text: a[i], aLine })
      i++
      aLine++
      removed++
    } else {
      lines.push({ type: 'add', text: b[j], bLine })
      j++
      bLine++
      added++
    }
  }
  while (i < n) {
    lines.push({ type: 'del', text: a[i], aLine })
    i++
    aLine++
    removed++
  }
  while (j < m) {
    lines.push({ type: 'add', text: b[j], bLine })
    j++
    bLine++
    added++
  }
  return { lines, added, removed }
}

/**
 * 转为 unified diff 文本
 */
export function toUnifiedDiff(
  result: DiffResult,
  aName = 'a',
  bName = 'b',
  context = 3
): string {
  if (result.added === 0 && result.removed === 0) return 'identical'
  const out: string[] = [`--- ${aName}`, `+++ ${bName}`]
  const rows = result.lines
  type Block = { start: number; end: number }
  const blocks: Block[] = []
  let bi = 0
  while (bi < rows.length) {
    while (bi < rows.length && rows[bi].type === 'equal') bi++
    if (bi >= rows.length) break
    const changeStart = bi
    while (bi < rows.length && rows[bi].type !== 'equal') bi++
    const start = Math.max(0, changeStart - context)
    const end = Math.min(rows.length, bi + context)
    if (blocks.length && start <= blocks[blocks.length - 1].end) {
      blocks[blocks.length - 1].end = end
    } else {
      blocks.push({ start, end })
    }
  }
  for (const block of blocks) {
    let aStart = 0
    let bStart = 0
    let aCount = 0
    let bCount = 0
    for (let k = block.start; k < block.end; k++) {
      const row = rows[k]
      if (row.type === 'equal' || row.type === 'del') {
        if (!aCount) aStart = row.aLine || 1
        aCount++
      }
      if (row.type === 'equal' || row.type === 'add') {
        if (!bCount) bStart = row.bLine || 1
        bCount++
      }
    }
    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`)
    for (let k = block.start; k < block.end; k++) {
      const row = rows[k]
      if (row.type === 'equal') out.push(` ${row.text}`)
      else if (row.type === 'del') out.push(`-${row.text}`)
      else out.push(`+${row.text}`)
    }
  }
  return out.join('\n')
}

/**
 * 折叠大段相等上下文：保留上下各 context 行，中间为 fold 节点
 */
export function foldDiffLines(
  lines: DiffLine[],
  context = 3,
  expanded: Record<string, boolean> = {}
): DiffFoldItem[] {
  const ctx = context == null ? 3 : context
  const exp = expanded || {}
  const out: DiffFoldItem[] = []
  let i = 0
  let foldId = 0
  while (i < lines.length) {
    if (lines[i].type !== 'equal') {
      out.push({ kind: 'line', line: lines[i] })
      i++
      continue
    }
    let j = i
    while (j < lines.length && lines[j].type === 'equal') j++
    const len = j - i
    const hideable = len > ctx * 2 + 1
    if (!hideable) {
      for (let k = i; k < j; k++) out.push({ kind: 'line', line: lines[k] })
    } else {
      const id = 'f' + foldId++
      for (let k = i; k < i + ctx; k++) out.push({ kind: 'line', line: lines[k] })
      const midStart = i + ctx
      const midEnd = j - ctx
      const midCount = midEnd - midStart
      if (exp[id]) {
        for (let k = midStart; k < midEnd; k++) out.push({ kind: 'line', line: lines[k] })
      } else {
        out.push({ kind: 'fold', id, count: midCount })
      }
      for (let k = midEnd; k < j; k++) out.push({ kind: 'line', line: lines[k] })
    }
    i = j
  }
  return out
}
