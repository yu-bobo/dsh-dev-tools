// 将 src/core/diff.ts 打成 IIFE，嵌入 client.js 标记区，保证侧栏与宿主同一份算法
import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientPath = join(root, 'client.js')
const diffEntry = join(root, 'src/core/diff.ts')

const START = '/* __DIFF_SHARED_START__ */'
const END = '/* __DIFF_SHARED_END__ */'

const bundled = await esbuild.build({
  entryPoints: [diffEntry],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: '__DSH_DT_DIFF__',
  platform: 'neutral',
  target: ['es2020'],
  minify: false
})

const iife = bundled.outputFiles[0].text.trim()
const block = [
  START,
  '// generated from src/core/diff.ts — do not edit',
  iife,
  'var lineDiff = __DSH_DT_DIFF__.lineDiff;',
  'var toUnifiedDiff = __DSH_DT_DIFF__.toUnifiedDiff;',
  'var foldDiffLines = __DSH_DT_DIFF__.foldDiffLines;',
  END
].join('\n')

let client = readFileSync(clientPath, 'utf8')
if (!client.includes(START) || !client.includes(END)) {
  throw new Error('client.js missing __DIFF_SHARED__ markers')
}
client = client.replace(
  new RegExp(`${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`),
  () => block
)
writeFileSync(clientPath, client)
console.log('[embed-diff] synced src/core/diff.ts → client.js')

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
