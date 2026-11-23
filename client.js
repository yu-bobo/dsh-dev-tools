/**
 * Dev Tools browser UI: pinable tool tabs + manage panel.
 * Local transforms run in the page. Translation posts to the host model route.
 */
window.__ModuleLoader__.load({
  id: 'dsh-developer-tools',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    let ReactDOM = null
    try { ReactDOM = require('react-dom') } catch { ReactDOM = null }

    let ui = null
    try { ui = require('@deepseek-ai/dsh-client-ui-primitives') } catch { ui = null }
    const UiButton = ui && ui.Button
    const UiToast = ui && ui.Toast
    const IconCopy = ui && (ui.IconCopyOutlineRegular || ui.IconDuplicateOutlineRegular)
    // 与 DSH 左侧栏固定按钮同款：未固定 Outline，已固定 Fill
    const IconPinOutline = ui && ui.IconPinOutlineRegular
    const IconPinFill = ui && ui.IconPinFillRegular
    const IconSettings = ui && (ui.IconSettingsOutlineRegular || ui.IconOptionsOutlineRegular)
    const IconFolderHost = ui && (ui.IconFolderOutlineRegular || ui.IconDocumentOutlineRegular || ui.IconAttachOutlineRegular)
    const IconClearHost = ui && (ui.IconDismissOutlineRegular || ui.IconDeleteOutlineRegular || ui.IconEraserOutlineRegular)

    function IconOpenSvg(props) {
      return h('svg', {
        width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, ...props
      },
        h('path', { d: 'M7 3.5H4.2A1.2 1.2 0 0 0 3 4.7v6.6A1.2 1.2 0 0 0 4.2 12.5H7' }),
        h('path', { d: 'M7.5 8h5.5' }),
        h('path', { d: 'M10.8 5.2L13.5 8l-2.7 2.8' })
      )
    }

    function IconFileSvg(props) {
      if (IconFolderHost) return h(IconFolderHost, { size: 14, ...props })
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, ...props
      },
        h('path', { d: 'M3.5 5.2A1.7 1.7 0 0 1 5.2 3.5h3.1L11.5 6.7v4.1a1.7 1.7 0 0 1-1.7 1.7H5.2A1.7 1.7 0 0 1 3.5 10.8V5.2z' }),
        h('path', { d: 'M8.2 3.5V6.7h3.2' })
      )
    }

    function IconClearSvg(props) {
      if (IconClearHost) return h(IconClearHost, { size: 14, ...props })
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, ...props
      },
        h('path', { d: 'M4.2 4.2l7.6 7.6' }),
        h('path', { d: 'M11.8 4.2l-7.6 7.6' })
      )
    }

    function IconPinSvg(props) {
      if (IconPinOutline) return h(IconPinOutline, { size: 14, ...props })
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': true, ...props
      },
        h('path', { d: 'M10.2 2.4H5.8c-.5 0-.9.5-.8 1l.4 1.8c-.9.6-1.5 1.6-1.5 2.7 0 .5.4.9.9.9h1.6V13c0 .4.3.7.7.7s.7-.3.7-.7V8.8h1.6c.5 0 .9-.4.9-.9 0-1.1-.6-2.1-1.5-2.7l.4-1.8c.1-.5-.3-1-.8-1z' })
      )
    }

    function IconUnpinSvg(props) {
      if (IconPinFill) return h(IconPinFill, { size: 14, ...props })
      return h(IconPinSvg, props)
    }

    const PANEL_ID = 'dev-tools'
    const NS = 'devTools'
    const STORAGE_KEY = 'dsh-developer-tools:prefs:v1'
    const MANAGE_ID = '__manage__'

    const TOOL_DEFS = [
      { id: 'json', mark: '{}', tone: 'sky', zh: 'JSON', en: 'JSON', descZh: '格式化 / 压缩 / 校验', descEn: 'Format / minify / validate' },
      { id: 'timestamp', mark: 'TS', tone: 'amber', zh: '时间戳', en: 'Timestamp', descZh: 'Unix ↔ 日期时间', descEn: 'Unix ↔ datetime' },
      { id: 'uuid', mark: 'ID', tone: 'violet', zh: 'UUID', en: 'UUID', descZh: '批量生成 UUID v4', descEn: 'Batch UUID v4' },
      { id: 'base64', mark: '64', tone: 'teal', zh: 'Base64', en: 'Base64', descZh: '编解码', descEn: 'Encode / decode' },
      { id: 'url', mark: 'URL', tone: 'blue', zh: 'URL', en: 'URL', descZh: 'URL 编解码', descEn: 'URL encode / decode' },
      { id: 'hash', mark: '#', tone: 'rose', zh: 'Hash', en: 'Hash', descZh: 'MD5 / SHA / HMAC', descEn: 'MD5 / SHA / HMAC' },
      { id: 'aes', mark: 'AES', tone: 'indigo', zh: 'AES', en: 'AES', descZh: 'AES-GCM 口令加解密', descEn: 'AES-GCM passphrase' },
      { id: 'hex', mark: '0x', tone: 'slate', zh: 'Hex', en: 'Hex', descZh: 'UTF-8 ↔ Hex', descEn: 'UTF-8 ↔ Hex' },
      { id: 'jwt', mark: 'JWT', tone: 'orange', zh: 'JWT', en: 'JWT', descZh: '解码（不验签）', descEn: 'Decode (no verify)' },
      { id: 'text-case', mark: 'Aa', tone: 'green', zh: '命名风格', en: 'Case', descZh: 'camel / snake / kebab…', descEn: 'camel / snake / kebab…' },
      { id: 'number-base', mark: '2ⁿ', tone: 'cyan', zh: '进制', en: 'Base', descZh: '2–36 进制互转', descEn: 'Base 2–36 convert' },
      { id: 'query-string', mark: '?=', tone: 'lime', zh: 'Query', en: 'Query', descZh: 'Query ↔ JSON', descEn: 'Query ↔ JSON' },
      { id: 'diff', mark: '≠', tone: 'fuchsia', zh: '文本 Diff', en: 'Diff', descZh: '左右对比 / 选文件', descEn: 'Side-by-side / pick files' },
      { id: 'translate', mark: 'Tr', tone: 'sky', zh: '翻译', en: 'Translate', descZh: '用当前模型翻译', descEn: 'Translate with the current model' }
    ]

    const DEFAULT_PINS = ['json', 'timestamp', 'uuid', 'base64', 'hash']

    const DICTIONARIES = {
      en: {
        panelLabel: 'Dev Tools',
        manage: 'Manage',
        pin: 'Pin',
        unpin: 'Unpin',
        pinned: 'Pinned tabs',
        allTools: 'All tools',
        dragHint: 'Drag chips to reorder pinned tabs. Pin tools from the catalog below.',
        moveUp: 'Up',
        moveDown: 'Down',
        dragHandle: 'Drag to reorder',
        input: 'Input',
        output: 'Output',
        copy: 'Copy',
        copied: 'Copied',
        run: 'Run',
        clear: 'Clear',
        key: 'Key / passphrase',
        count: 'Count',
        unit: 'Unit',
        fromBase: 'From base',
        toBase: 'To base',
        format: 'Format',
        minify: 'Minify',
        validate: 'Validate',
        encode: 'Encode',
        decode: 'Decode',
        encrypt: 'Encrypt',
        decrypt: 'Decrypt',
        now: 'Now',
        toDatetime: 'To datetime',
        toUnix: 'To unix',
        generate: 'Generate',
        parse: 'Parse',
        stringify: 'Stringify',
        toHex: 'To hex',
        fromHex: 'From hex',
        valid: 'Valid JSON',
        error: 'Error',
        empty: 'No pinned tools yet',
        algo: 'Algorithm',
        open: 'Open',
        closeTemp: 'Close',
        workspace: 'Workspace',
        pinOrder: 'Tab order',
        catalog: 'Catalog',
        pinnedBadge: 'Pinned',
        chars: '{n} chars',
        swap: 'Swap I/O',
        hintManage: 'Pin daily tools, then drag chips to set tab order.',
        statusReady: 'Ready',
        original: 'Original',
        modified: 'Modified',
        pickFile: 'File',
        readingFile: 'Reading…',
        swapAB: 'Swap',
        identical: 'Texts are identical',
        ignoreWs: 'Ignore trailing WS',
        expandN: 'Expand {n} lines',
        copyUnified: 'Copy unified',
        compare: 'Compare',
        diffEmpty: 'Paste or open two texts to see the diff',
        diffStats: '+{a} / −{r}',
        clearFile: 'Clear file',
        largeDiffHint: 'Large input — click Compare to refresh',
        translate: 'Translate',
        translating: 'Translating…',
        cancel: 'Cancel',
        translateCancelled: 'Cancelled',
        targetLang: 'Target language',
        sourceLang: 'Source (optional)',
        customLang: 'Custom',
        targetRequired: 'Enter a target language'
      },
      zh: {
        panelLabel: '开发工具',
        manage: '管理',
        pin: '固定',
        unpin: '取消固定',
        pinned: '已固定标签',
        allTools: '全部工具',
        dragHint: '拖拽下方芯片可调整顶栏 Tab 顺序；从目录固定/取消工具。',
        moveUp: '上移',
        moveDown: '下移',
        dragHandle: '拖拽排序',
        input: '输入',
        output: '输出',
        copy: '复制',
        copied: '已复制',
        run: '运行',
        clear: '清空',
        key: '密钥 / 口令',
        count: '数量',
        unit: '单位',
        fromBase: '源进制',
        toBase: '目标进制',
        format: '格式化',
        minify: '压缩',
        validate: '校验',
        encode: '编码',
        decode: '解码',
        encrypt: '加密',
        decrypt: '解密',
        now: '当前时间',
        toDatetime: '转日期时间',
        toUnix: '转时间戳',
        generate: '生成',
        parse: '解析',
        stringify: '序列化',
        toHex: '转 Hex',
        fromHex: '从 Hex',
        valid: 'JSON 合法',
        error: '错误',
        empty: '还没有固定任何工具',
        algo: '算法',
        open: '打开',
        closeTemp: '关闭',
        workspace: '工作区',
        pinOrder: '标签顺序',
        catalog: '工具目录',
        pinnedBadge: '已固定',
        chars: '{n} 字符',
        swap: '交换输入输出',
        hintManage: '固定常用工具后，拖拽芯片即可调整顶栏 Tab 顺序。',
        statusReady: '就绪',
        original: '原文',
        modified: '对比',
        pickFile: '选文件',
        readingFile: '读取中…',
        swapAB: '交换',
        identical: '两侧文本完全相同',
        ignoreWs: '忽略行尾空白',
        expandN: '展开 {n} 行',
        copyUnified: '复制 Unified',
        compare: '对比',
        diffEmpty: '粘贴或选择两个文件以查看差异',
        diffStats: '+{a} / −{r}',
        clearFile: '清除文件名',
        largeDiffHint: '文本较大，请点击「对比」刷新',
        translate: '翻译',
        translating: '翻译中…',
        cancel: '取消',
        translateCancelled: '已取消',
        targetLang: '目标语言',
        sourceLang: '源语言（可选）',
        customLang: '自定义',
        targetRequired: '请填写目标语言'
      }
    }

    const CSS = `
      :root, .dsh-dt-root {
        --dsh-dt-border: color-mix(in srgb, var(--dsw-alias-label-primary, #111) 10%, transparent);
        --dsh-dt-border-strong: color-mix(in srgb, var(--dsw-alias-label-primary, #111) 16%, transparent);
        --dsh-dt-soft: color-mix(in srgb, var(--dsw-alias-label-primary, #111) 4%, transparent);
        --dsh-dt-soft-2: color-mix(in srgb, var(--dsw-alias-label-primary, #111) 7%, transparent);
        --dsh-dt-radius: var(--dsw-radius-md, 12px);
        --dsh-dt-radius-sm: var(--dsw-radius-sm, 8px);
        --dsh-dt-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", ui-monospace, Menlo, Consolas, monospace;
        --dsh-dt-ease: cubic-bezier(.22, 1, .36, 1);
      }
      .dsh-dt-root {
        position: relative;
        box-sizing: border-box;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        line-height: 1.45;
        overflow: hidden;
      }
      .dsh-dt-root *, .dsh-dt-root *::before, .dsh-dt-root *::after { box-sizing: border-box; }

      .dsh-dt-tabs {
        display: flex;
        gap: 4px;
        padding: calc(var(--dsh-frame-top-clearance, 0px) + 10px) 16px 0;
        border-bottom: 1px solid var(--dsh-dt-border);
        flex-shrink: 0;
        overflow-x: auto;
        overflow-y: hidden;
        align-items: flex-end;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .dsh-dt-tabs::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
      .dsh-dt-tab {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        padding: 9px 12px 11px;
        margin-bottom: -1px;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        font-size: 12.5px;
        letter-spacing: 0.01em;
        border-radius: 0;
        white-space: nowrap;
        transition: color .18s var(--dsh-dt-ease), border-color .18s var(--dsh-dt-ease);
      }
      .dsh-dt-tab:hover {
        color: var(--dsw-alias-label-primary);
        background: transparent;
      }
      .dsh-dt-tab[data-active="1"] {
        color: var(--dsw-alias-label-primary);
        border-bottom-color: var(--dsw-alias-brand-primary);
        font-weight: 600;
        background: transparent;
      }
      .dsh-dt-tab[data-temp="1"] {
        font-style: italic;
        color: var(--dsw-alias-label-secondary);
      }
      .dsh-dt-tab[data-temp="1"][data-active="1"] {
        color: var(--dsw-alias-label-primary);
      }
      .dsh-dt-tab-temp {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding-right: 4px;
      }
      .dsh-dt-tab-close {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        width: 18px;
        height: 18px;
        border-radius: 4px;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
      }
      .dsh-dt-tab-close:hover {
        color: var(--dsw-alias-label-primary);
        background: var(--dsh-dt-soft-2);
      }
      .dsh-dt-tab-manage {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        min-width: 36px;
        padding-left: 0;
        padding-right: 0;
        color: var(--dsw-alias-label-secondary);
      }

      .dsh-dt-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 14px 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .dsh-dt-keep {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .dsh-dt-keep[hidden] { display: none; }
      .dsh-dt-stage {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: dsh-dt-in .28s var(--dsh-dt-ease);
      }
      @keyframes dsh-dt-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: none; }
      }

      .dsh-dt-hero {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px 12px;
        padding: 2px 2px 0;
      }
      .dsh-dt-hero-identity {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1 1 160px;
      }
      .dsh-dt-mark {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-family: var(--dsh-dt-mono);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: -0.02em;
        flex-shrink: 0;
        border: 1px solid var(--dsh-dt-border);
        background: var(--dsw-alias-bg-layer-1, var(--dsh-dt-soft));
        box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent);
      }
      .dsh-dt-mark[data-tone="sky"] { color: #0284c7; background: color-mix(in srgb, #0ea5e9 14%, transparent); border-color: color-mix(in srgb, #0ea5e9 28%, transparent); }
      .dsh-dt-mark[data-tone="amber"] { color: #b45309; background: color-mix(in srgb, #f59e0b 16%, transparent); border-color: color-mix(in srgb, #f59e0b 28%, transparent); }
      .dsh-dt-mark[data-tone="violet"] { color: #6d28d9; background: color-mix(in srgb, #8b5cf6 14%, transparent); border-color: color-mix(in srgb, #8b5cf6 28%, transparent); }
      .dsh-dt-mark[data-tone="teal"] { color: #0f766e; background: color-mix(in srgb, #14b8a6 14%, transparent); border-color: color-mix(in srgb, #14b8a6 28%, transparent); }
      .dsh-dt-mark[data-tone="blue"] { color: #1d4ed8; background: color-mix(in srgb, #3b82f6 14%, transparent); border-color: color-mix(in srgb, #3b82f6 28%, transparent); }
      .dsh-dt-mark[data-tone="rose"] { color: #be123c; background: color-mix(in srgb, #f43f5e 14%, transparent); border-color: color-mix(in srgb, #f43f5e 28%, transparent); }
      .dsh-dt-mark[data-tone="indigo"] { color: #3730a3; background: color-mix(in srgb, #6366f1 14%, transparent); border-color: color-mix(in srgb, #6366f1 28%, transparent); }
      .dsh-dt-mark[data-tone="slate"] { color: #334155; background: color-mix(in srgb, #64748b 14%, transparent); border-color: color-mix(in srgb, #64748b 28%, transparent); }
      .dsh-dt-mark[data-tone="orange"] { color: #c2410c; background: color-mix(in srgb, #fb923c 16%, transparent); border-color: color-mix(in srgb, #fb923c 28%, transparent); }
      .dsh-dt-mark[data-tone="green"] { color: #15803d; background: color-mix(in srgb, #22c55e 14%, transparent); border-color: color-mix(in srgb, #22c55e 28%, transparent); }
      .dsh-dt-mark[data-tone="cyan"] { color: #0e7490; background: color-mix(in srgb, #06b6d4 14%, transparent); border-color: color-mix(in srgb, #06b6d4 28%, transparent); }
      .dsh-dt-mark[data-tone="lime"] { color: #4d7c0f; background: color-mix(in srgb, #84cc16 14%, transparent); border-color: color-mix(in srgb, #84cc16 28%, transparent); }
      .dsh-dt-mark[data-tone="fuchsia"] { color: #a21caf; background: color-mix(in srgb, #d946ef 14%, transparent); border-color: color-mix(in srgb, #d946ef 28%, transparent); }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-mark { filter: saturate(1.05) brightness(1.15); }
      .dsh-dt-hero-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
      .dsh-dt-hero-title {
        margin: 0;
        font-size: 16px;
        font-weight: 650;
        letter-spacing: -0.02em;
        line-height: 1.25;
      }
      .dsh-dt-hero-desc {
        margin: 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
      }

      .dsh-dt-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        margin-left: auto;
        max-width: 100%;
      }
      .dsh-dt-chiprow, .dsh-dt-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .dsh-dt-meta {
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        font-family: var(--dsh-dt-mono);
      }

      .dsh-dt-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .dsh-dt-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .dsh-dt-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 120px; }
      .dsh-dt-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-secondary);
      }
      .dsh-dt-input, .dsh-dt-textarea {
        width: 100%;
        border: 1px solid var(--dsh-dt-border);
        border-radius: var(--dsh-dt-radius-sm);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
        color: var(--dsw-alias-label-primary);
        padding: 8px 10px;
        font: inherit;
        outline: none !important;
        box-shadow: none !important;
      }
      .dsh-dt-input {
        height: 32px;
        min-height: 32px;
        padding: 0 10px;
        font-size: 12px;
      }
      .dsh-dt-input:hover,
      .dsh-dt-input:focus {
        border-color: var(--dsh-dt-border);
        box-shadow: none !important;
        outline: none !important;
      }
      .dsh-dt-textarea:hover,
      .dsh-dt-textarea:focus {
        border-color: transparent;
        background: var(--dsh-dt-soft);
        box-shadow: none !important;
        outline: none !important;
      }
      .dsh-dt-select {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: auto;
        min-width: 0;
        height: 32px;
        vertical-align: middle;
        border: 0;
        padding: 0;
        background: transparent;
        box-shadow: none;
      }
      .dsh-dt-select-trigger {
        appearance: none;
        width: 100%;
        height: 32px;
        min-height: 32px;
        padding: 0 28px 0 10px;
        border: 1px solid var(--dsh-dt-border);
        border-radius: var(--dsh-dt-radius-sm);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        outline: none !important;
        box-shadow: none !important;
      }
      .dsh-dt-select-trigger:hover,
      .dsh-dt-select-trigger[data-open="1"],
      .dsh-dt-select-trigger:focus,
      .dsh-dt-select-trigger:focus-visible {
        border-color: var(--dsh-dt-border);
        outline: none !important;
        box-shadow: none !important;
      }
      .dsh-dt-select-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        flex: 1;
      }
      .dsh-dt-select-caret {
        position: absolute;
        right: 10px;
        top: 50%;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 5px solid currentColor;
        opacity: 0.55;
        pointer-events: none;
        transform: translateY(-35%);
        transition: transform .16s var(--dsh-dt-ease);
      }
      .dsh-dt-select-trigger[data-open="1"] + .dsh-dt-select-caret,
      .dsh-dt-select[data-open="1"] .dsh-dt-select-caret {
        transform: translateY(-65%) rotate(180deg);
      }
      .dsh-dt-select-menu {
        position: fixed;
        z-index: 100000;
        max-height: 220px;
        overflow: auto;
        padding: 4px;
        border-radius: 8px;
        border: 1px solid #e5e5e5;
        background-color: #ffffff !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        isolation: isolate;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
      }
      .dsh-dt-select-menu[data-scheme="dark"] {
        border-color: #3a3a3a;
        background-color: #1f1f1f !important;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
      }
      .dsh-dt-select-option {
        appearance: none;
        display: block;
        width: 100%;
        border: 0;
        background-color: #ffffff !important;
        color: #111111;
        text-align: left;
        border-radius: 6px;
        padding: 7px 10px;
        font-size: 12px;
        line-height: 18px;
        cursor: pointer;
        opacity: 1 !important;
      }
      .dsh-dt-select-menu[data-scheme="dark"] .dsh-dt-select-option {
        background-color: #1f1f1f !important;
        color: #f5f5f5;
      }
      .dsh-dt-select-option:hover {
        background-color: #f3f3f3 !important;
      }
      .dsh-dt-select-menu[data-scheme="dark"] .dsh-dt-select-option:hover {
        background-color: #2a2a2a !important;
      }
      .dsh-dt-select-option[data-selected="1"] {
        color: #2563eb !important;
        background-color: #eef5ff !important;
        font-weight: 600;
      }
      .dsh-dt-select-menu[data-scheme="dark"] .dsh-dt-select-option[data-selected="1"] {
        color: #93c5fd !important;
        background-color: #243247 !important;
      }
      .dsh-dt-textarea {
        flex: 1;
        min-height: 180px;
        resize: vertical;
        font-family: var(--dsh-dt-mono);
        font-size: 12.5px;
        line-height: 1.55;
        padding: 10px 12px;
        border: 1px solid transparent;
        border-radius: var(--dsh-dt-radius-sm);
        background: var(--dsh-dt-soft);
      }
      .dsh-dt-textarea::placeholder {
        color: color-mix(in srgb, var(--dsw-alias-label-secondary) 70%, transparent);
      }
      .dsh-dt-pane {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        padding: 10px;
        border: 1px solid var(--dsh-dt-border);
        border-radius: var(--dsh-dt-radius);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
        box-shadow: none;
      }
      .dsh-dt-pane:focus-within {
        border-color: var(--dsh-dt-border);
        box-shadow: none;
      }
      .dsh-dt-pane-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 28px;
      }
      .dsh-dt-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        flex: 1;
        min-height: 280px;
      }
      @media (max-width: 760px) {
        .dsh-dt-split { grid-template-columns: 1fr; }
      }

      .dsh-dt-btn {
        appearance: none;
        border: 1px solid var(--dsh-dt-border);
        background: var(--dsw-alias-bg-layer-1, transparent);
        color: var(--dsw-alias-label-primary);
        border-radius: 999px;
        height: 30px;
        padding: 0 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        white-space: nowrap;
        transition: transform .12s var(--dsh-dt-ease), background .16s var(--dsh-dt-ease), border-color .16s var(--dsh-dt-ease), box-shadow .16s var(--dsh-dt-ease);
      }
      .dsh-dt-btn:hover {
        background: var(--dsh-dt-soft-2);
        border-color: var(--dsh-dt-border-strong);
      }
      .dsh-dt-btn:active { transform: translateY(1px); }
      .dsh-dt-btn[data-primary="1"] {
        background: var(--dsw-alias-brand-primary);
        border-color: transparent;
        color: #fff;
        box-shadow: 0 6px 16px color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent);
      }
      .dsh-dt-btn[data-primary="1"]:hover {
        filter: brightness(1.05);
        background: var(--dsw-alias-brand-primary);
      }
      .dsh-dt-btn[data-ghost="1"] {
        background: transparent;
      }
      .dsh-dt-btn[data-active="1"] {
        border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
        color: var(--dsw-alias-brand-primary);
      }
      .dsh-dt-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }

      .dsh-dt-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dsh-dt-section-title {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin: 4px 0 0;
      }
      .dsh-dt-section-title h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-secondary);
      }
      .dsh-dt-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }
      .dsh-dt-tile {
        appearance: none;
        text-align: left;
        border: 1px solid var(--dsh-dt-border);
        border-radius: var(--dsh-dt-radius);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 0;
        cursor: default;
        position: relative;
      }
      .dsh-dt-tile:hover {
        border-color: var(--dsh-dt-border-strong);
      }
      .dsh-dt-tile[data-pinned="1"] {
        border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent);
      }
      .dsh-dt-tile-top {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding-right: 64px;
        min-width: 0;
      }
      .dsh-dt-tile-actions {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .dsh-dt-tile-copy {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .dsh-dt-tile-title { font-weight: 650; font-size: 13.5px; letter-spacing: -0.01em; }
      .dsh-dt-tile-desc {
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 1.45;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .dsh-dt-pinbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: stretch;
        min-height: 44px;
        padding: 8px;
        border-radius: var(--dsh-dt-radius);
        border: 1px dashed var(--dsh-dt-border-strong);
        background: var(--dsh-dt-soft);
        transition: border-color .16s var(--dsh-dt-ease), background .16s var(--dsh-dt-ease);
      }
      .dsh-dt-pinbar[data-over="1"] {
        border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent);
      }
      .dsh-dt-pinchip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px 8px 8px;
        border-radius: 999px;
        border: 1px solid var(--dsh-dt-border);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
        cursor: grab;
        user-select: none;
        touch-action: none;
        transition: transform .12s var(--dsh-dt-ease), box-shadow .16s var(--dsh-dt-ease), opacity .16s var(--dsh-dt-ease), border-color .16s var(--dsh-dt-ease);
      }
      .dsh-dt-pinchip:active { cursor: grabbing; }
      .dsh-dt-pinchip[data-dragging="1"] {
        opacity: 0.45;
        transform: scale(0.98);
      }
      .dsh-dt-pinchip[data-drop="1"] {
        border-color: var(--dsw-alias-brand-primary);
      }
      .dsh-dt-grip {
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        color: var(--dsw-alias-label-secondary);
        opacity: 0.7;
        flex-shrink: 0;
      }
      .dsh-dt-pinchip strong { font-size: 12.5px; font-weight: 650; }
      .dsh-dt-pinchip .dsh-dt-actions { gap: 2px; }
      .dsh-dt-btn[data-icon="1"] {
        width: 28px;
        min-width: 28px;
        height: 28px;
        padding: 0;
        border-radius: var(--dsw-radius-sm, 8px);
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        border-color: transparent;
      }
      .dsh-dt-btn[data-icon="1"]:hover {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-interactive-bg-hover, var(--dsh-dt-soft-2));
        border-color: transparent;
      }
      .dsh-dt-btn[data-icon="1"][data-primary="1"],
      .dsh-dt-btn[data-icon="1"][data-active="1"] {
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        border-color: transparent;
        box-shadow: none;
      }
      .dsh-dt-btn svg {
        display: block;
        flex-shrink: 0;
      }

      /* 自定义 tooltip，替代浏览器原生 title；默认向下展开，避免顶部被 overflow 裁切 */
      [data-tip] {
        position: relative;
      }
      [data-tip]::before,
      [data-tip]::after {
        position: absolute;
        left: 50%;
        transform: translateX(-50%) translateY(-4px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .14s var(--dsh-dt-ease), transform .14s var(--dsh-dt-ease);
        z-index: 40;
      }
      [data-tip]::after {
        content: attr(data-tip);
        top: calc(100% + 8px);
        padding: 5px 8px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--dsw-alias-label-primary, #111) 92%, transparent);
        color: var(--dsw-alias-bg-base, #fff);
        font-size: 11px;
        font-weight: 500;
        line-height: 1.3;
        white-space: nowrap;
        letter-spacing: 0.01em;
        box-shadow: 0 6px 16px color-mix(in srgb, #000 18%, transparent);
      }
      [data-tip]::before {
        content: '';
        top: calc(100% + 2px);
        border: 5px solid transparent;
        border-bottom-color: color-mix(in srgb, var(--dsw-alias-label-primary, #111) 92%, transparent);
      }
      [data-tip]:hover::before,
      [data-tip]:hover::after,
      [data-tip]:focus-visible::before,
      [data-tip]:focus-visible::after {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .dsh-dt-err {
        color: var(--dsw-alias-state-error-primary, #c62828);
        font-size: 12px;
        white-space: pre-wrap;
        padding: 8px 10px;
        border-radius: var(--dsh-dt-radius-sm);
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c62828) 10%, transparent);
      }
      .dsh-dt-ok { color: var(--dsw-alias-state-success-primary, #2e7d32); font-size: 12px; }
      .dsh-dt-empty {
        padding: 18px;
        border: 1px dashed var(--dsh-dt-border-strong);
        border-radius: var(--dsh-dt-radius);
        color: var(--dsw-alias-label-secondary);
        text-align: center;
      }

      /* Diff tool */
      .dsh-dt-diff-layout {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dsh-dt-diff-editors {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        flex: 0 0 auto;
        min-height: 160px;
        max-height: 38%;
      }
      @media (max-width: 760px) {
        .dsh-dt-diff-editors { grid-template-columns: 1fr; max-height: none; }
      }
      .dsh-dt-diff-pane {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        padding: 10px;
        border: 1px solid var(--dsh-dt-border);
        border-radius: var(--dsh-dt-radius);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
      }
      .dsh-dt-diff-pane .dsh-dt-textarea {
        min-height: 120px;
        max-height: 220px;
        resize: vertical;
      }
      .dsh-dt-filechip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        max-width: 140px;
        height: 22px;
        padding: 0 6px 0 8px;
        border-radius: 999px;
        border: 1px solid var(--dsh-dt-border);
        background: var(--dsh-dt-soft);
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
        overflow: hidden;
      }
      .dsh-dt-filechip span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-dt-filechip button {
        appearance: none;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        padding: 0 2px;
        font-size: 12px;
        line-height: 1;
        opacity: 0.7;
      }
      .dsh-dt-filechip button:hover { opacity: 1; }
      .dsh-dt-diff-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        justify-content: space-between;
      }
      .dsh-dt-diff-stats {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--dsh-dt-mono);
        font-size: 12px;
        font-weight: 650;
      }
      .dsh-dt-diff-stats [data-k="add"] { color: #15803d; }
      .dsh-dt-diff-stats [data-k="del"] { color: #be123c; }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-stats [data-k="add"] { color: #86efac; }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-stats [data-k="del"] { color: #fda4af; }
      .dsh-dt-diff-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        user-select: none;
        cursor: pointer;
      }
      .dsh-dt-diff-toggle input { accent-color: var(--dsw-alias-brand-primary); }
      .dsh-dt-diff-view {
        flex: 1;
        min-height: 180px;
        overflow: auto;
        border: 1px solid var(--dsh-dt-border);
        border-radius: var(--dsh-dt-radius);
        background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
        font-family: var(--dsh-dt-mono);
        font-size: 12px;
        line-height: 1.55;
        animation: dsh-dt-diff-in .22s var(--dsh-dt-ease);
      }
      @keyframes dsh-dt-diff-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: none; }
      }
      .dsh-dt-diff-empty {
        display: grid;
        place-items: center;
        min-height: 160px;
        padding: 24px;
        color: var(--dsw-alias-label-secondary);
        text-align: center;
        gap: 8px;
      }
      .dsh-dt-diff-empty-mark {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        font-size: 20px;
        font-weight: 700;
        color: #a21caf;
        background: color-mix(in srgb, #d946ef 12%, transparent);
        border: 1px solid color-mix(in srgb, #d946ef 26%, transparent);
        margin: 0 auto 4px;
      }
      .dsh-dt-diff-identical {
        display: grid;
        place-items: center;
        min-height: 140px;
        padding: 24px;
        color: #15803d;
        font-weight: 600;
        background: color-mix(in srgb, #22c55e 8%, transparent);
      }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-identical {
        color: #86efac;
        background: color-mix(in srgb, #22c55e 12%, transparent);
      }
      .dsh-dt-diff-row {
        display: grid;
        grid-template-columns: 44px 44px 18px 1fr;
        gap: 0;
        min-height: 20px;
        border-left: 3px solid transparent;
        padding-right: 10px;
      }
      .dsh-dt-diff-row[data-type="del"] {
        background: color-mix(in srgb, #f43f5e 10%, transparent);
        border-left-color: color-mix(in srgb, #f43f5e 70%, transparent);
      }
      .dsh-dt-diff-row[data-type="add"] {
        background: color-mix(in srgb, #22c55e 10%, transparent);
        border-left-color: color-mix(in srgb, #22c55e 70%, transparent);
      }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-row[data-type="del"] {
        background: color-mix(in srgb, #f43f5e 16%, transparent);
      }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-row[data-type="add"] {
        background: color-mix(in srgb, #22c55e 14%, transparent);
      }
      .dsh-dt-diff-gutter {
        text-align: right;
        padding: 0 8px;
        color: color-mix(in srgb, var(--dsw-alias-label-secondary) 70%, transparent);
        user-select: none;
        font-variant-numeric: tabular-nums;
      }
      .dsh-dt-diff-row[data-type="del"] .dsh-dt-diff-gutter[data-side="a"],
      .dsh-dt-diff-row[data-type="add"] .dsh-dt-diff-gutter[data-side="b"] {
        font-weight: 650;
        color: inherit;
      }
      .dsh-dt-diff-row[data-type="del"] .dsh-dt-diff-gutter[data-side="a"] { color: #be123c; }
      .dsh-dt-diff-row[data-type="add"] .dsh-dt-diff-gutter[data-side="b"] { color: #15803d; }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-row[data-type="del"] .dsh-dt-diff-gutter[data-side="a"] { color: #fda4af; }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-row[data-type="add"] .dsh-dt-diff-gutter[data-side="b"] { color: #86efac; }
      .dsh-dt-diff-sign {
        text-align: center;
        user-select: none;
        font-weight: 650;
      }
      .dsh-dt-diff-row[data-type="del"] .dsh-dt-diff-sign { color: #be123c; }
      .dsh-dt-diff-row[data-type="add"] .dsh-dt-diff-sign { color: #15803d; }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-row[data-type="del"] .dsh-dt-diff-sign { color: #fda4af; }
      .dsh-dt-root[data-scheme="dark"] .dsh-dt-diff-row[data-type="add"] .dsh-dt-diff-sign { color: #86efac; }
      .dsh-dt-diff-text {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
        padding: 0 4px;
        min-width: 0;
      }
      .dsh-dt-diff-fold {
        appearance: none;
        width: 100%;
        border: 0;
        border-top: 1px dashed var(--dsh-dt-border);
        border-bottom: 1px dashed var(--dsh-dt-border);
        background: var(--dsh-dt-soft);
        color: var(--dsw-alias-label-secondary);
        font-size: 11.5px;
        font-family: inherit;
        padding: 6px 12px;
        cursor: pointer;
        text-align: center;
        transition: background .14s var(--dsh-dt-ease), color .14s var(--dsh-dt-ease);
      }
      .dsh-dt-diff-fold:hover {
        background: var(--dsh-dt-soft-2);
        color: var(--dsw-alias-label-primary);
      }
      .dsh-dt-hidden-file {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
    `

    function isToolId(id) {
      return TOOL_DEFS.some((t) => t.id === id)
    }

    function loadPrefs() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { pinned: DEFAULT_PINS.slice(), temps: [], active: DEFAULT_PINS[0] }
        const data = JSON.parse(raw)
        const pinned = Array.isArray(data.pinned)
          ? data.pinned.filter((id) => isToolId(id))
          : DEFAULT_PINS.slice()
        const pinnedSet = new Set(pinned)
        const temps = Array.isArray(data.temps)
          ? data.temps.filter((id) => isToolId(id) && !pinnedSet.has(id))
          : []
        // 允许临时打开未固定工具：active 可以是任意合法工具 id
        const active = data.active === MANAGE_ID || isToolId(data.active)
          ? data.active
          : (pinned[0] || MANAGE_ID)
        return { pinned: pinned.length ? pinned : DEFAULT_PINS.slice(), temps, active }
      } catch {
        return { pinned: DEFAULT_PINS.slice(), temps: [], active: DEFAULT_PINS[0] }
      }
    }

    function savePrefs(prefs) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    }

    // 工具输入态：模块级内存，切走 DSH 侧栏卸载 React 后仍可恢复
    const workspaceMem = Object.create(null)

    function readToolField(toolId, key, fallback) {
      const tool = workspaceMem[toolId]
      if (!tool || typeof tool !== 'object') return fallback
      if (!(key in tool)) return fallback
      const v = tool[key]
      if (typeof fallback === 'string') return typeof v === 'string' ? v : fallback
      if (typeof fallback === 'number') return typeof v === 'number' && Number.isFinite(v) ? v : fallback
      if (typeof fallback === 'boolean') return typeof v === 'boolean' ? v : fallback
      return v == null ? fallback : v
    }

    function writeToolFields(toolId, patch) {
      const prev = workspaceMem[toolId] && typeof workspaceMem[toolId] === 'object'
        ? workspaceMem[toolId]
        : {}
      workspaceMem[toolId] = Object.assign({}, prev, patch)
    }

    function uuidV4() {
      if (crypto.randomUUID) return crypto.randomUUID()
      const buf = new Uint8Array(16)
      crypto.getRandomValues(buf)
      buf[6] = (buf[6] & 0x0f) | 0x40
      buf[8] = (buf[8] & 0x3f) | 0x80
      const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }

    async function shaDigest(algo, text) {
      const map = { sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' }
      const name = map[algo]
      if (!name) throw new Error('unsupported algo in browser: ' + algo)
      const buf = await crypto.subtle.digest(name, new TextEncoder().encode(text))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    // 简易 MD5（浏览器无 WebCrypto MD5）
    function md5(str) {
      function cmn(q, a, b, x, s, t) {
        a = (a + q + x + t) | 0
        return (((a << s) | (a >>> (32 - s))) + b) | 0
      }
      function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t) }
      function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t) }
      function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t) }
      function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t) }
      function toUtf8(s) {
        return unescape(encodeURIComponent(s))
      }
      const msg = toUtf8(str)
      const n = msg.length
      const words = []
      for (let i = 0; i < n; i++) words[i >> 2] |= msg.charCodeAt(i) << ((i % 4) * 8)
      words[n >> 2] |= 0x80 << ((n % 4) * 8)
      const bitLen = n * 8
      words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen
      let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878
      for (let i = 0; i < words.length; i += 16) {
        const oa = a, ob = b, oc = c, od = d
        a = ff(a, b, c, d, words[i + 0], 7, -680876936)
        d = ff(d, a, b, c, words[i + 1], 12, -389564586)
        c = ff(c, d, a, b, words[i + 2], 17, 606105819)
        b = ff(b, c, d, a, words[i + 3], 22, -1044525330)
        a = ff(a, b, c, d, words[i + 4], 7, -176418897)
        d = ff(d, a, b, c, words[i + 5], 12, 1200080426)
        c = ff(c, d, a, b, words[i + 6], 17, -1473231341)
        b = ff(b, c, d, a, words[i + 7], 22, -45705983)
        a = ff(a, b, c, d, words[i + 8], 7, 1770035416)
        d = ff(d, a, b, c, words[i + 9], 12, -1958414417)
        c = ff(c, d, a, b, words[i + 10], 17, -42063)
        b = ff(b, c, d, a, words[i + 11], 22, -1990404162)
        a = ff(a, b, c, d, words[i + 12], 7, 1804603682)
        d = ff(d, a, b, c, words[i + 13], 12, -40341101)
        c = ff(c, d, a, b, words[i + 14], 17, -1502002290)
        b = ff(b, c, d, a, words[i + 15], 22, 1236535329)
        a = gg(a, b, c, d, words[i + 1], 5, -165796510)
        d = gg(d, a, b, c, words[i + 6], 9, -1069501632)
        c = gg(c, d, a, b, words[i + 11], 14, 643717713)
        b = gg(b, c, d, a, words[i + 0], 20, -373897302)
        a = gg(a, b, c, d, words[i + 5], 5, -701558691)
        d = gg(d, a, b, c, words[i + 10], 9, 38016083)
        c = gg(c, d, a, b, words[i + 15], 14, -660478335)
        b = gg(b, c, d, a, words[i + 4], 20, -405537848)
        a = gg(a, b, c, d, words[i + 9], 5, 568446438)
        d = gg(d, a, b, c, words[i + 14], 9, -1019803690)
        c = gg(c, d, a, b, words[i + 3], 14, -187363961)
        b = gg(b, c, d, a, words[i + 8], 20, 1163531501)
        a = gg(a, b, c, d, words[i + 13], 5, -1444681467)
        d = gg(d, a, b, c, words[i + 2], 9, -51403784)
        c = gg(c, d, a, b, words[i + 7], 14, 1735328473)
        b = gg(b, c, d, a, words[i + 12], 20, -1926607734)
        a = hh(a, b, c, d, words[i + 5], 4, -378558)
        d = hh(d, a, b, c, words[i + 8], 11, -2022574463)
        c = hh(c, d, a, b, words[i + 11], 16, 1839030562)
        b = hh(b, c, d, a, words[i + 14], 23, -35309556)
        a = hh(a, b, c, d, words[i + 1], 4, -1530992060)
        d = hh(d, a, b, c, words[i + 4], 11, 1272893353)
        c = hh(c, d, a, b, words[i + 7], 16, -155497632)
        b = hh(b, c, d, a, words[i + 10], 23, -1094730640)
        a = hh(a, b, c, d, words[i + 13], 4, 681279174)
        d = hh(d, a, b, c, words[i + 0], 11, -358537222)
        c = hh(c, d, a, b, words[i + 3], 16, -722521979)
        b = hh(b, c, d, a, words[i + 6], 23, 76029189)
        a = hh(a, b, c, d, words[i + 9], 4, -640364487)
        d = hh(d, a, b, c, words[i + 12], 11, -421815835)
        c = hh(c, d, a, b, words[i + 15], 16, 530742520)
        b = hh(b, c, d, a, words[i + 2], 23, -995338651)
        a = ii(a, b, c, d, words[i + 0], 6, -198630844)
        d = ii(d, a, b, c, words[i + 7], 10, 1126891415)
        c = ii(c, d, a, b, words[i + 14], 15, -1416354905)
        b = ii(b, c, d, a, words[i + 5], 21, -57434055)
        a = ii(a, b, c, d, words[i + 12], 6, 1700485571)
        d = ii(d, a, b, c, words[i + 3], 10, -1894986606)
        c = ii(c, d, a, b, words[i + 10], 15, -1051523)
        b = ii(b, c, d, a, words[i + 1], 21, -2054922799)
        a = ii(a, b, c, d, words[i + 8], 6, 1873313359)
        d = ii(d, a, b, c, words[i + 15], 10, -30611744)
        c = ii(c, d, a, b, words[i + 6], 15, -1560198380)
        b = ii(b, c, d, a, words[i + 13], 21, 1309151649)
        a = ii(a, b, c, d, words[i + 4], 6, -145523070)
        d = ii(d, a, b, c, words[i + 11], 10, -1120210379)
        c = ii(c, d, a, b, words[i + 2], 15, 718787259)
        b = ii(b, c, d, a, words[i + 9], 21, -343485551)
        a = (a + oa) | 0; b = (b + ob) | 0; c = (c + oc) | 0; d = (d + od) | 0
      }
      function rhex(n) {
        let s = ''
        for (let j = 0; j < 4; j++) s += ((n >> (j * 8)) & 0xff).toString(16).padStart(2, '0')
        return s
      }
      return rhex(a) + rhex(b) + rhex(c) + rhex(d)
    }

    async function hmacSha256(key, text) {
      const enc = new TextEncoder()
      const cryptoKey = await crypto.subtle.importKey(
        'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(text))
      return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    async function deriveAesKey(passphrase, salt) {
      const enc = new TextEncoder()
      const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    }

    function b64encodeBytes(bytes) {
      let s = ''
      bytes.forEach((b) => { s += String.fromCharCode(b) })
      return btoa(s)
    }

    function b64decodeBytes(b64) {
      const bin = atob(b64.trim())
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    }

    // 布局与 Node 端一致：salt(16) + iv(12) + tag(16) + ciphertext
    async function aesEncrypt(plain, passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await deriveAesKey(passphrase, salt)
      const cipher = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plain)
      ))
      const tag = cipher.subarray(cipher.length - 16)
      const enc = cipher.subarray(0, cipher.length - 16)
      const packed = new Uint8Array(16 + 12 + 16 + enc.length)
      packed.set(salt, 0)
      packed.set(iv, 16)
      packed.set(tag, 28)
      packed.set(enc, 44)
      return b64encodeBytes(packed)
    }

    async function aesDecrypt(payload, passphrase) {
      const buf = b64decodeBytes(payload)
      if (buf.length < 16 + 12 + 16) throw new Error('ciphertext too short')
      const salt = buf.subarray(0, 16)
      const iv = buf.subarray(16, 28)
      const tag = buf.subarray(28, 44)
      const enc = buf.subarray(44)
      const data = new Uint8Array(enc.length + tag.length)
      data.set(enc, 0)
      data.set(tag, enc.length)
      const key = await deriveAesKey(passphrase, salt)
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
      return new TextDecoder().decode(plain)
    }

    function toCamel(s, pascal) {
      const parts = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^a-zA-Z0-9]+/).filter(Boolean)
      return parts.map((p, i) => {
        const lower = p.toLowerCase()
        if (i === 0 && !pascal) return lower
        return lower.charAt(0).toUpperCase() + lower.slice(1)
      }).join('')
    }

    function toSnake(s, sep) {
      return s
        .replace(/([a-z0-9])([A-Z])/g, '$1' + sep + '$2')
        .replace(/[^a-zA-Z0-9]+/g, sep)
        .replace(new RegExp(sep + '+', 'g'), sep)
        .replace(new RegExp('^' + sep + '|' + sep + '$', 'g'), '')
        .toLowerCase()
    }

    function decodeJwt(token) {
      const parts = token.trim().split('.')
      if (parts.length < 2) throw new Error('invalid JWT')
      const dec = (p) => {
        const b64 = p.replace(/-/g, '+').replace(/_/g, '/')
        const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
        return decodeURIComponent(escape(atob(pad)))
      }
      return JSON.stringify({
        header: JSON.parse(dec(parts[0])),
        payload: JSON.parse(dec(parts[1])),
        signature: parts[2] || null
      }, null, 2)
    }

    function convertBase(raw, fromBase, toBase) {
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'
      let neg = false
      let body = String(raw).trim().toLowerCase()
      if (body.startsWith('-')) { neg = true; body = body.slice(1) }
      if (!body) throw new Error('empty number')
      let value = 0n
      for (const ch of body) {
        const d = digits.indexOf(ch)
        if (d < 0 || d >= fromBase) throw new Error('invalid digit "' + ch + '"')
        value = value * BigInt(fromBase) + BigInt(d)
      }
      if (value === 0n) return '0'
      if (toBase === 10) return (neg ? '-' : '') + value.toString(10)
      let out = ''
      let v = value
      while (v > 0n) {
        out = digits[Number(v % BigInt(toBase))] + out
        v = v / BigInt(toBase)
      }
      return neg ? '-' + out : out
    }

    /* __DIFF_SHARED_START__ */
// generated from src/core/diff.ts — do not edit
"use strict";
var __DSH_DT_DIFF__ = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/diff.ts
  var diff_exports = {};
  __export(diff_exports, {
    foldDiffLines: () => foldDiffLines,
    lineDiff: () => lineDiff,
    toUnifiedDiff: () => toUnifiedDiff
  });
  function splitLines(text) {
    if (text === "") return [];
    return String(text).split("\n");
  }
  function lineDiff(aText, bText, ignoreTrailingWs = false) {
    const norm = (s) => ignoreTrailingWs ? s.replace(/[ \t]+$/g, "") : s;
    const a = splitLines(aText).map(norm);
    const b = splitLines(bText).map(norm);
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i2 = n - 1; i2 >= 0; i2--) {
      for (let j2 = m - 1; j2 >= 0; j2--) {
        if (a[i2] === b[j2]) dp[i2][j2] = dp[i2 + 1][j2 + 1] + 1;
        else dp[i2][j2] = Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
      }
    }
    const lines = [];
    let i = 0;
    let j = 0;
    let aLine = 1;
    let bLine = 1;
    let added = 0;
    let removed = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        lines.push({ type: "equal", text: a[i], aLine, bLine });
        i++;
        j++;
        aLine++;
        bLine++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        lines.push({ type: "del", text: a[i], aLine });
        i++;
        aLine++;
        removed++;
      } else {
        lines.push({ type: "add", text: b[j], bLine });
        j++;
        bLine++;
        added++;
      }
    }
    while (i < n) {
      lines.push({ type: "del", text: a[i], aLine });
      i++;
      aLine++;
      removed++;
    }
    while (j < m) {
      lines.push({ type: "add", text: b[j], bLine });
      j++;
      bLine++;
      added++;
    }
    return { lines, added, removed };
  }
  function toUnifiedDiff(result, aName = "a", bName = "b", context = 3) {
    if (result.added === 0 && result.removed === 0) return "identical";
    const out = [`--- ${aName}`, `+++ ${bName}`];
    const rows = result.lines;
    const blocks = [];
    let bi = 0;
    while (bi < rows.length) {
      while (bi < rows.length && rows[bi].type === "equal") bi++;
      if (bi >= rows.length) break;
      const changeStart = bi;
      while (bi < rows.length && rows[bi].type !== "equal") bi++;
      const start = Math.max(0, changeStart - context);
      const end = Math.min(rows.length, bi + context);
      if (blocks.length && start <= blocks[blocks.length - 1].end) {
        blocks[blocks.length - 1].end = end;
      } else {
        blocks.push({ start, end });
      }
    }
    for (const block of blocks) {
      let aStart = 0;
      let bStart = 0;
      let aCount = 0;
      let bCount = 0;
      for (let k = block.start; k < block.end; k++) {
        const row = rows[k];
        if (row.type === "equal" || row.type === "del") {
          if (!aCount) aStart = row.aLine || 1;
          aCount++;
        }
        if (row.type === "equal" || row.type === "add") {
          if (!bCount) bStart = row.bLine || 1;
          bCount++;
        }
      }
      out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
      for (let k = block.start; k < block.end; k++) {
        const row = rows[k];
        if (row.type === "equal") out.push(` ${row.text}`);
        else if (row.type === "del") out.push(`-${row.text}`);
        else out.push(`+${row.text}`);
      }
    }
    return out.join("\n");
  }
  function foldDiffLines(lines, context = 3, expanded = {}) {
    const ctx = context == null ? 3 : context;
    const exp = expanded || {};
    const out = [];
    let i = 0;
    let foldId = 0;
    while (i < lines.length) {
      if (lines[i].type !== "equal") {
        out.push({ kind: "line", line: lines[i] });
        i++;
        continue;
      }
      let j = i;
      while (j < lines.length && lines[j].type === "equal") j++;
      const len = j - i;
      const hideable = len > ctx * 2 + 1;
      if (!hideable) {
        for (let k = i; k < j; k++) out.push({ kind: "line", line: lines[k] });
      } else {
        const id = "f" + foldId++;
        for (let k = i; k < i + ctx; k++) out.push({ kind: "line", line: lines[k] });
        const midStart = i + ctx;
        const midEnd = j - ctx;
        const midCount = midEnd - midStart;
        if (exp[id]) {
          for (let k = midStart; k < midEnd; k++) out.push({ kind: "line", line: lines[k] });
        } else {
          out.push({ kind: "fold", id, count: midCount });
        }
        for (let k = midEnd; k < j; k++) out.push({ kind: "line", line: lines[k] });
      }
      i = j;
    }
    return out;
  }
  return __toCommonJS(diff_exports);
})();
var lineDiff = __DSH_DT_DIFF__.lineDiff;
var toUnifiedDiff = __DSH_DT_DIFF__.toUnifiedDiff;
var foldDiffLines = __DSH_DT_DIFF__.foldDiffLines;
/* __DIFF_SHARED_END__ */

    function Btn({ primary, ghost, active, disabled, onClick, children, icon, title, iconOnly }) {
      // 统一自绘按钮，保证插件内视觉一致（不混用宿主 Button 造型）
      void UiButton
      const onlyIcon = !!iconOnly || (icon && (children == null || children === ''))
      return h('button', {
        type: 'button',
        className: 'dsh-dt-btn',
        'aria-label': title || undefined,
        'data-tip': title || undefined,
        'data-primary': primary ? '1' : '0',
        'data-ghost': ghost ? '1' : '0',
        'data-active': active ? '1' : '0',
        'data-icon': onlyIcon ? '1' : '0',
        disabled: !!disabled,
        onClick
      }, icon || null, onlyIcon ? null : children)
    }

    function Select({ style, value, onChange, title, options }) {
      const [open, setOpen] = useState(false)
      const [menuStyle, setMenuStyle] = useState(null)
      const rootRef = useRef(null)
      const menuRef = useRef(null)
      const list = Array.isArray(options) ? options : []
      const current = list.find((o) => String(o.value) === String(value))
      const label = current ? current.label : (value == null ? '' : String(value))
      const scheme = (typeof document !== 'undefined' &&
        ((document.documentElement.getAttribute('data-theme') || '').includes('dark') ||
          (document.documentElement.getAttribute('data-color-scheme') || '').includes('dark') ||
          (document.querySelector('.dsh-dt-root') || {}).getAttribute?.('data-scheme') === 'dark'))
        ? 'dark'
        : 'light'

      const placeMenu = useCallback(() => {
        const el = rootRef.current
        if (!el) return
        const a = el.getBoundingClientRect()
        const width = Math.max(a.width, 120)
        let left = a.left
        let top = a.bottom + 4
        const maxH = 220
        if (top + Math.min(maxH, list.length * 34 + 12) > window.innerHeight - 8) {
          top = Math.max(8, a.top - 4 - Math.min(maxH, list.length * 34 + 12))
        }
        if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
        setMenuStyle({
          position: 'fixed',
          left: Math.round(left) + 'px',
          top: Math.round(top) + 'px',
          width: Math.round(width) + 'px',
          zIndex: 100000
        })
      }, [list.length])

      useEffect(() => {
        if (!open) {
          setMenuStyle(null)
          return undefined
        }
        placeMenu()
        const onDoc = (e) => {
          const t = e.target
          if (rootRef.current && rootRef.current.contains(t)) return
          if (menuRef.current && menuRef.current.contains(t)) return
          setOpen(false)
        }
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('resize', placeMenu)
        window.addEventListener('scroll', placeMenu, true)
        document.addEventListener('mousedown', onDoc, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          window.removeEventListener('resize', placeMenu)
          window.removeEventListener('scroll', placeMenu, true)
          document.removeEventListener('mousedown', onDoc, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [open, placeMenu])

      const menu = open && menuStyle
        ? h('div', {
            ref: menuRef,
            className: 'dsh-dt-select-menu',
            role: 'listbox',
            'data-scheme': scheme,
            style: menuStyle
          },
            list.map((o) =>
              h('button', {
                key: String(o.value),
                type: 'button',
                role: 'option',
                className: 'dsh-dt-select-option',
                'data-selected': String(o.value) === String(value) ? '1' : '0',
                onClick: () => {
                  if (typeof onChange === 'function') onChange(o.value)
                  setOpen(false)
                }
              }, o.label)
            )
          )
        : null

      const portalMenu = menu && ReactDOM && ReactDOM.createPortal
        ? ReactDOM.createPortal(menu, document.body)
        : menu

      return h('div', {
        ref: rootRef,
        className: 'dsh-dt-select',
        style,
        'data-open': open ? '1' : '0',
        'data-tip': open ? undefined : (title || undefined)
      },
        h('button', {
          type: 'button',
          className: 'dsh-dt-select-trigger',
          'data-open': open ? '1' : '0',
          'aria-label': title || undefined,
          'aria-expanded': open ? 'true' : 'false',
          'aria-haspopup': 'listbox',
          onClick: () => setOpen((v) => !v)
        },
          h('span', { className: 'dsh-dt-select-label' }, label || '—')
        ),
        h('span', { className: 'dsh-dt-select-caret', 'aria-hidden': true }),
        portalMenu
      )
    }

    function PanelIcon(props) {
      // 侧栏入口：工具箱
      return h('svg', {
        width: 18, height: 18, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, ...props
      },
        h('rect', { x: 2, y: 5.5, width: 12, height: 8.5, rx: 1.4 }),
        h('path', { d: 'M5.2 5.5V4.2A1.7 1.7 0 0 1 6.9 2.5h2.2A1.7 1.7 0 0 1 10.8 4.2v1.3' }),
        h('path', { d: 'M2 9h12' }),
        h('path', { d: 'M8 9v2.2' })
      )
    }

    function detectScheme() {
      const el = document.documentElement
      const attr = (el.getAttribute('data-theme') || el.getAttribute('data-color-scheme') || el.className || '').toLowerCase()
      if (attr.includes('dark')) return 'dark'
      if (attr.includes('light')) return 'light'
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    function ToolShell({ tool, lang, t, children, extras, actions, status }) {
      const title = lang === 'zh' ? tool.zh : tool.en
      const desc = lang === 'zh' ? tool.descZh : tool.descEn
      return h('div', { className: 'dsh-dt-stage', key: tool.id },
        h('div', { className: 'dsh-dt-hero' },
          h('div', { className: 'dsh-dt-hero-identity' },
            h('div', { className: 'dsh-dt-mark', 'data-tone': tool.tone || 'slate' }, tool.mark || '•'),
            h('div', { className: 'dsh-dt-hero-text' },
              h('h2', { className: 'dsh-dt-hero-title' }, title),
              h('p', { className: 'dsh-dt-hero-desc' }, desc)
            )
          ),
          h('div', { className: 'dsh-dt-toolbar' },
            extras || null,
            h('div', { className: 'dsh-dt-chiprow' }, ...(actions || [])),
            status ? h('span', { className: 'dsh-dt-meta' }, status) : null
          )
        ),
        children
      )
    }

    function ToolIO({ t, input, setInput, output, setOutput, error }) {
      const [copied, setCopied] = useState(false)
      const copy = async (text) => {
        try {
          await navigator.clipboard.writeText(text || '')
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
          return true
        } catch {
          return false
        }
      }
      const swap = () => {
        setInput(output || '')
        setOutput(input || '')
      }
      const inCount = (input || '').length
      const outCount = (output || '').length
      return h(React.Fragment, null,
        h('div', { className: 'dsh-dt-split' },
          h('div', { className: 'dsh-dt-pane' },
            h('div', { className: 'dsh-dt-pane-head' },
              h('div', { className: 'dsh-dt-label' }, t('input')),
              h('div', { className: 'dsh-dt-actions' },
                h('span', { className: 'dsh-dt-meta' }, t('chars').replace('{n}', String(inCount))),
                h(Btn, {
                  ghost: true,
                  icon: h(IconClearSvg),
                  onClick: () => { setInput(''); setOutput('') }
                }, t('clear'))
              )
            ),
            h('textarea', {
              className: 'dsh-dt-textarea',
              value: input,
              onChange: (e) => setInput(e.target.value),
              spellCheck: false,
              placeholder: '…'
            })
          ),
          h('div', { className: 'dsh-dt-pane' },
            h('div', { className: 'dsh-dt-pane-head' },
              h('div', { className: 'dsh-dt-label' }, t('output')),
              h('div', { className: 'dsh-dt-actions' },
                h('span', { className: 'dsh-dt-meta' }, t('chars').replace('{n}', String(outCount))),
                h(Btn, { ghost: true, title: t('swap'), onClick: swap }, '⇄'),
                h(Btn, {
                  ghost: true,
                  icon: IconCopy ? h(IconCopy) : null,
                  onClick: async () => { await copy(output) }
                }, copied ? t('copied') : t('copy'))
              )
            ),
            h('textarea', {
              className: 'dsh-dt-textarea',
              'data-out': '1',
              value: output,
              readOnly: true,
              spellCheck: false,
              placeholder: '—'
            })
          )
        ),
        error ? h('div', { className: 'dsh-dt-err' }, error) : null
      )
    }

    function useMemState(toolId, key, defaultValue) {
      const [value, setValue] = useState(() => readToolField(toolId, key, defaultValue))
      const setPersisted = useCallback((next) => {
        setValue((prev) => {
          const resolved = typeof next === 'function' ? next(prev) : next
          writeToolFields(toolId, { [key]: resolved })
          return resolved
        })
      }, [toolId, key])
      return [value, setPersisted]
    }

    function useToolState(toolId) {
      const [input, setInput] = useMemState(toolId, 'input', '')
      const [output, setOutput] = useMemState(toolId, 'output', '')
      const [error, setError] = useState('')
      const run = async (fn) => {
        setError('')
        try {
          const out = await fn()
          setOutput(out == null ? '' : String(out))
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
        }
      }
      return { input, setInput, output, setOutput, error, setError, run }
    }

    function JsonTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      return h(ToolShell, {
        tool, lang, t,
        actions: [
          h(Btn, { primary: true, key: 'f', onClick: () => s.run(() => JSON.stringify(JSON.parse(s.input), null, 2)) }, t('format')),
          h(Btn, { key: 'm', onClick: () => s.run(() => JSON.stringify(JSON.parse(s.input))) }, t('minify')),
          h(Btn, { key: 'v', onClick: () => s.run(() => { JSON.parse(s.input); return t('valid') }) }, t('validate'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function TimestampTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const [unit, setUnit] = useMemState(tool.id, 'unit', 's')
      return h(ToolShell, {
        tool, lang, t,
        extras: h(Select, {
          style: { width: 148 },
          value: unit,
          title: t('unit'),
          onChange: setUnit,
          options: [
            { value: 's', label: 'seconds' },
            { value: 'ms', label: 'milliseconds' }
          ]
        }),
        actions: [
          h(Btn, {
            primary: true, key: 'now',
            onClick: () => s.run(() => {
              const ms = Date.now()
              return JSON.stringify({
                unix_s: Math.floor(ms / 1000),
                unix_ms: ms,
                iso: new Date(ms).toISOString(),
                local: new Date(ms).toString()
              }, null, 2)
            })
          }, t('now')),
          h(Btn, {
            key: 'dt',
            onClick: () => s.run(() => {
              const n = Number(s.input.trim())
              if (!Number.isFinite(n)) throw new Error('invalid unix')
              const ms = unit === 'ms' || Math.abs(n) >= 1e12 ? n : n * 1000
              const d = new Date(ms)
              return JSON.stringify({
                unix_s: Math.floor(d.getTime() / 1000),
                unix_ms: d.getTime(),
                iso: d.toISOString(),
                local: d.toString()
              }, null, 2)
            })
          }, t('toDatetime')),
          h(Btn, {
            key: 'unix',
            onClick: () => s.run(() => {
              const raw = s.input.trim()
              const d = /^\d+$/.test(raw)
                ? new Date(unit === 'ms' || raw.length >= 13 ? Number(raw) : Number(raw) * 1000)
                : new Date(raw)
              if (Number.isNaN(d.getTime())) throw new Error('invalid datetime')
              return String(unit === 'ms' ? d.getTime() : Math.floor(d.getTime() / 1000))
            })
          }, t('toUnix'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function UuidTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const [count, setCount] = useMemState(tool.id, 'count', 5)
      return h(ToolShell, {
        tool, lang, t,
        extras: h('input', {
          className: 'dsh-dt-input', type: 'number', min: 1, max: 100, value: count,
          style: { width: 88 },
          'data-tip': t('count'),
          'aria-label': t('count'),
          onChange: (e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
        }),
        actions: [
          h(Btn, {
            primary: true, key: 'g',
            onClick: () => s.run(() => Array.from({ length: count }, () => uuidV4()).join('\n'))
          }, t('generate'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function CodecTool({ t, lang, tool, mode }) {
      const s = useToolState(tool.id)
      return h(ToolShell, {
        tool, lang, t,
        actions: [
          h(Btn, {
            primary: true, key: 'e',
            onClick: () => s.run(() => {
              if (mode === 'base64') return btoa(unescape(encodeURIComponent(s.input)))
              if (mode === 'url') return encodeURIComponent(s.input)
              return [...new TextEncoder().encode(s.input)].map((b) => b.toString(16).padStart(2, '0')).join('')
            })
          }, mode === 'hex' ? t('toHex') : t('encode')),
          h(Btn, {
            key: 'd',
            onClick: () => s.run(() => {
              if (mode === 'base64') return decodeURIComponent(escape(atob(s.input.trim())))
              if (mode === 'url') return decodeURIComponent(s.input)
              const hex = s.input.trim().replace(/\s+/g, '')
              if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2) throw new Error('invalid hex')
              const bytes = new Uint8Array(hex.length / 2)
              for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
              return new TextDecoder().decode(bytes)
            })
          }, mode === 'hex' ? t('fromHex') : t('decode'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function HashTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const [algo, setAlgo] = useMemState(tool.id, 'algo', 'sha256')
      const [key, setKey] = useMemState(tool.id, 'key', '')
      return h(ToolShell, {
        tool, lang, t,
        extras: h('div', { className: 'dsh-dt-row' },
          h(Select, {
            style: { width: 156 },
            value: algo,
            title: t('algo'),
            onChange: setAlgo,
            options: [
              { value: 'md5', label: 'MD5' },
              { value: 'sha1', label: 'SHA-1' },
              { value: 'sha256', label: 'SHA-256' },
              { value: 'sha512', label: 'SHA-512' },
              { value: 'hmac_sha256', label: 'HMAC-SHA256' }
            ]
          }),
          algo === 'hmac_sha256'
            ? h('input', {
                className: 'dsh-dt-input', style: { width: 140 }, value: key,
                placeholder: t('key'),
                'data-tip': t('key'),
                'aria-label': t('key'),
                onChange: (e) => setKey(e.target.value)
              })
            : null
        ),
        actions: [
          h(Btn, {
            primary: true, key: 'r',
            onClick: () => s.run(async () => {
              if (algo === 'md5') return md5(s.input)
              if (algo === 'hmac_sha256') {
                if (!key) throw new Error('key required')
                return hmacSha256(key, s.input)
              }
              return shaDigest(algo, s.input)
            })
          }, t('run'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function AesTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const [key, setKey] = useMemState(tool.id, 'key', '')
      return h(ToolShell, {
        tool, lang, t,
        extras: h('input', {
          className: 'dsh-dt-input', type: 'password', value: key, style: { width: 160 },
          onChange: (e) => setKey(e.target.value),
          placeholder: t('key'),
          'data-tip': t('key'),
          'aria-label': t('key')
        }),
        actions: [
          h(Btn, {
            primary: true, key: 'e',
            onClick: () => s.run(async () => {
              if (!key) throw new Error('passphrase required')
              return aesEncrypt(s.input, key)
            })
          }, t('encrypt')),
          h(Btn, {
            key: 'd',
            onClick: () => s.run(async () => {
              if (!key) throw new Error('passphrase required')
              return aesDecrypt(s.input, key)
            })
          }, t('decrypt'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function JwtTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      return h(ToolShell, {
        tool, lang, t,
        actions: [h(Btn, { primary: true, key: 'd', onClick: () => s.run(() => decodeJwt(s.input)) }, t('decode'))],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function CaseTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const act = (fn) => () => s.run(() => fn(s.input))
      return h(ToolShell, {
        tool, lang, t,
        actions: [
          h(Btn, { primary: true, key: 'c', onClick: act((x) => toCamel(x, false)) }, 'camelCase'),
          h(Btn, { key: 'p', onClick: act((x) => toCamel(x, true)) }, 'PascalCase'),
          h(Btn, { key: 's', onClick: act((x) => toSnake(x, '_')) }, 'snake_case'),
          h(Btn, { key: 'k', onClick: act((x) => toSnake(x, '-')) }, 'kebab-case'),
          h(Btn, { key: 'u', onClick: act((x) => x.toUpperCase()) }, 'UPPER'),
          h(Btn, { key: 'l', onClick: act((x) => x.toLowerCase()) }, 'lower')
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function NumberBaseTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const [fromBase, setFromBase] = useMemState(tool.id, 'fromBase', 10)
      const [toBase, setToBase] = useMemState(tool.id, 'toBase', 16)
      return h(ToolShell, {
        tool, lang, t,
        extras: h('div', { className: 'dsh-dt-row' },
          h('input', {
            className: 'dsh-dt-input', type: 'number', min: 2, max: 36, value: fromBase, style: { width: 72 },
            'data-tip': t('fromBase'),
            'aria-label': t('fromBase'),
            onChange: (e) => setFromBase(Number(e.target.value) || 10)
          }),
          h('span', { className: 'dsh-dt-meta' }, '→'),
          h('input', {
            className: 'dsh-dt-input', type: 'number', min: 2, max: 36, value: toBase, style: { width: 72 },
            'data-tip': t('toBase'),
            'aria-label': t('toBase'),
            onChange: (e) => setToBase(Number(e.target.value) || 16)
          })
        ),
        actions: [
          h(Btn, {
            primary: true, key: 'r',
            onClick: () => s.run(() => convertBase(s.input, fromBase, toBase))
          }, t('run'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    function QueryTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      return h(ToolShell, {
        tool, lang, t,
        actions: [
          h(Btn, {
            primary: true, key: 'p',
            onClick: () => s.run(() => {
              const q = s.input.startsWith('?') ? s.input.slice(1) : s.input
              const obj = {}
              q.split('&').forEach((part) => {
                if (!part) return
                const eq = part.indexOf('=')
                const k = decodeURIComponent(eq >= 0 ? part.slice(0, eq) : part)
                const v = decodeURIComponent(eq >= 0 ? part.slice(eq + 1) : '')
                if (k in obj) obj[k] = [].concat(obj[k], v)
                else obj[k] = v
              })
              return JSON.stringify(obj, null, 2)
            })
          }, t('parse')),
          h(Btn, {
            key: 's',
            onClick: () => s.run(() => {
              const data = JSON.parse(s.input)
              const parts = []
              Object.keys(data).forEach((k) => {
                const v = data[k]
                if (Array.isArray(v)) v.forEach((item) => parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(item))))
                else if (v != null) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
              })
              return parts.join('&')
            })
          }, t('stringify'))
        ],
        children: h(ToolIO, { t, input: s.input, setInput: s.setInput, output: s.output, setOutput: s.setOutput, error: s.error })
      })
    }

    /**
     * 文本 Diff：双栏输入/选文件，实时行级着色对比
     */
    function DiffTool({ t, lang, tool }) {
      const [left, setLeft] = useMemState(tool.id, 'left', '')
      const [right, setRight] = useMemState(tool.id, 'right', '')
      const [leftName, setLeftName] = useMemState(tool.id, 'leftName', '')
      const [rightName, setRightName] = useMemState(tool.id, 'rightName', '')
      const [leftReading, setLeftReading] = useState(false)
      const [rightReading, setRightReading] = useState(false)
      const [ignoreWs, setIgnoreWs] = useMemState(tool.id, 'ignoreWs', false)
      const [expanded, setExpanded] = useState({})
      const [copied, setCopied] = useState(false)
      // 已提交参与对比的文本快照（debounce / 手动对比后更新）
      const [committed, setCommitted] = useState(() => ({
        left: readToolField(tool.id, 'left', ''),
        right: readToolField(tool.id, 'right', ''),
        ignoreWs: readToolField(tool.id, 'ignoreWs', false)
      }))
      const leftFileRef = useRef(null)
      const rightFileRef = useRef(null)
      const debounceRef = useRef(null)

      const lineCount = (text) => (text === '' ? 0 : text.split('\n').length)
      const isLarge = lineCount(left) > 2000 || lineCount(right) > 2000

      const commitDiff = useCallback((nextLeft, nextRight, nextIgnore) => {
        setCommitted({
          left: nextLeft,
          right: nextRight,
          ignoreWs: !!nextIgnore
        })
        setExpanded({})
      }, [])

      useEffect(() => {
        // 大文本加长 debounce，避免 LCS 卡顿
        const delay = isLarge ? 280 : 120
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          commitDiff(left, right, ignoreWs)
        }, delay)
        return () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
        }
      }, [left, right, ignoreWs, isLarge, commitDiff])

      const result = useMemo(
        () => lineDiff(committed.left, committed.right, committed.ignoreWs),
        [committed]
      )

      const folded = useMemo(
        () => foldDiffLines(result.lines, 3, expanded),
        [result, expanded]
      )

      const editorsEmpty = left === '' && right === ''
      const bothEmpty = committed.left === '' && committed.right === ''
      const identical = !bothEmpty && result.added === 0 && result.removed === 0
      const pending = left !== committed.left || right !== committed.right || ignoreWs !== committed.ignoreWs

      const status = bothEmpty
        ? ''
        : identical
          ? t('identical')
          : t('diffStats').replace('{a}', String(result.added)).replace('{r}', String(result.removed))

      const readFile = (side, file) => {
        if (!file) return
        const setReading = side === 'a' ? setLeftReading : setRightReading
        const setText = side === 'a' ? setLeft : setRight
        const setName = side === 'a' ? setLeftName : setRightName
        setReading(true)
        setName(file.name)
        const reader = new FileReader()
        reader.onload = () => {
          const text = String(reader.result == null ? '' : reader.result)
          setText(text)
          setReading(false)
          const other = side === 'a' ? right : left
          const nextLeft = side === 'a' ? text : other
          const nextRight = side === 'a' ? other : text
          // 大文件或选文件后立刻提交，避免等待 debounce
          if (lineCount(nextLeft) > 2000 || lineCount(nextRight) > 2000) {
            commitDiff(nextLeft, nextRight, ignoreWs)
          }
        }
        reader.onerror = () => {
          setReading(false)
        }
        reader.readAsText(file, 'UTF-8')
      }

      const swap = () => {
        setLeft(right)
        setRight(left)
        setLeftName(rightName)
        setRightName(leftName)
        if (isLarge) commitDiff(right, left, ignoreWs)
      }

      const clearAll = () => {
        setLeft('')
        setRight('')
        setLeftName('')
        setRightName('')
        commitDiff('', '', ignoreWs)
      }

      const copyUnified = async () => {
        const text = toUnifiedDiff(result, leftName || 'a', rightName || 'b')
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch { /* ignore */ }
      }

      const renderPane = (side) => {
        const isA = side === 'a'
        const value = isA ? left : right
        const setValue = isA ? setLeft : setRight
        const name = isA ? leftName : rightName
        const setName = isA ? setLeftName : setRightName
        const reading = isA ? leftReading : rightReading
        const fileRef = isA ? leftFileRef : rightFileRef
        const label = isA ? t('original') : t('modified')
        return h('div', { className: 'dsh-dt-diff-pane' },
          h('div', { className: 'dsh-dt-pane-head' },
            h('div', { className: 'dsh-dt-row', style: { gap: 8, minWidth: 0 } },
              h('div', { className: 'dsh-dt-label' }, label),
              name
                ? h('div', { className: 'dsh-dt-filechip', title: name },
                    h('span', null, name),
                    h('button', {
                      type: 'button',
                      'aria-label': t('clearFile'),
                      'data-tip': t('clearFile'),
                      onClick: () => setName('')
                    }, '×')
                  )
                : null
            ),
            h('div', { className: 'dsh-dt-actions' },
              h('span', { className: 'dsh-dt-meta' }, t('chars').replace('{n}', String(value.length))),
              h('input', {
                ref: fileRef,
                className: 'dsh-dt-hidden-file',
                type: 'file',
                accept: '.txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yaml,.yml,.csv,.log,.tsv,text/*',
                onChange: (e) => {
                  const f = e.target.files && e.target.files[0]
                  readFile(side, f)
                  e.target.value = ''
                }
              }),
              h(Btn, {
                ghost: true,
                disabled: reading,
                icon: h(IconFileSvg),
                onClick: () => fileRef.current && fileRef.current.click()
              }, reading ? t('readingFile') : t('pickFile')),
              h(Btn, {
                ghost: true,
                icon: h(IconClearSvg),
                onClick: () => { setValue(''); setName('') }
              }, t('clear'))
            )
          ),
          h('textarea', {
            className: 'dsh-dt-textarea',
            value,
            onChange: (e) => setValue(e.target.value),
            spellCheck: false,
            placeholder: '…'
          })
        )
      }

      const viewBody = editorsEmpty
        ? h('div', { className: 'dsh-dt-diff-empty' },
            h('div', { className: 'dsh-dt-diff-empty-mark' }, '≠'),
            h('div', null, t('diffEmpty'))
          )
        : bothEmpty && pending
          ? h('div', { className: 'dsh-dt-diff-empty' },
              h('div', { className: 'dsh-dt-diff-empty-mark' }, '≠'),
              h('div', null, isLarge ? t('largeDiffHint') : t('statusReady'))
            )
          : identical
          ? h('div', { className: 'dsh-dt-diff-identical' }, t('identical'))
          : folded.map((item, idx) => {
              if (item.kind === 'fold') {
                return h('button', {
                  key: 'fold-' + item.id + '-' + idx,
                  type: 'button',
                  className: 'dsh-dt-diff-fold',
                  onClick: () => setExpanded((prev) => Object.assign({}, prev, { [item.id]: true }))
                }, t('expandN').replace('{n}', String(item.count)))
              }
              const line = item.line
              const sign = line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '
              return h('div', {
                key: 'row-' + idx,
                className: 'dsh-dt-diff-row',
                'data-type': line.type
              },
                h('div', { className: 'dsh-dt-diff-gutter', 'data-side': 'a' },
                  line.aLine != null ? String(line.aLine) : ''),
                h('div', { className: 'dsh-dt-diff-gutter', 'data-side': 'b' },
                  line.bLine != null ? String(line.bLine) : ''),
                h('div', { className: 'dsh-dt-diff-sign' }, sign),
                h('div', { className: 'dsh-dt-diff-text' }, line.text === '' ? ' ' : line.text)
              )
            })

      return h(ToolShell, {
        tool, lang, t,
        status: pending ? '' : status,
        actions: [
          h(Btn, {
            primary: true,
            key: 'cmp',
            onClick: () => commitDiff(left, right, ignoreWs)
          }, t('compare')),
          h(Btn, { key: 'swap', onClick: swap }, t('swapAB')),
          h(Btn, { key: 'clear', onClick: clearAll }, t('clear')),
          h(Btn, {
            key: 'copy',
            ghost: true,
            disabled: bothEmpty,
            icon: IconCopy ? h(IconCopy) : null,
            onClick: copyUnified
          }, copied ? t('copied') : t('copyUnified'))
        ],
        extras: h('div', { className: 'dsh-dt-row' },
          h('label', { className: 'dsh-dt-diff-toggle' },
            h('input', {
              type: 'checkbox',
              checked: ignoreWs,
              onChange: (e) => {
                const next = !!e.target.checked
                setIgnoreWs(next)
                if (isLarge) commitDiff(left, right, next)
              }
            }),
            t('ignoreWs')
          ),
          !bothEmpty && !identical
            ? h('span', { className: 'dsh-dt-diff-stats' },
                h('span', { 'data-k': 'add' }, '+' + result.added),
                h('span', { 'data-k': 'del' }, '−' + result.removed)
              )
            : null,
          isLarge
            ? h('span', { className: 'dsh-dt-meta' }, t('largeDiffHint'))
            : null
        ),
        children: h('div', { className: 'dsh-dt-diff-layout' },
          h('div', { className: 'dsh-dt-diff-editors' },
            renderPane('a'),
            renderPane('b')
          ),
          h('div', {
            className: 'dsh-dt-diff-view',
            key: 'diff-' + committed.left.length + '-' + committed.right.length + '-' + result.added + '-' + result.removed + '-' + (identical ? 'same' : 'chg')
          }, viewBody)
        )
      })
    }

    function ManagePage({ t, lang, pinned, setPinned, openTool, togglePin }) {
      const labelOf = (tool) => (lang === 'zh' ? tool.zh : tool.en)
      const descOf = (tool) => (lang === 'zh' ? tool.descZh : tool.descEn)
      const isPinned = (id) => pinned.includes(id)
      const [dragId, setDragId] = useState(null)
      const [overId, setOverId] = useState(null)
      const [barOver, setBarOver] = useState(false)

      const toggle = (id) => {
        if (typeof togglePin === 'function') togglePin(id)
        else setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id)))
      }

      const reorder = (fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return
        setPinned((prev) => {
          const from = prev.indexOf(fromId)
          const to = prev.indexOf(toId)
          if (from < 0 || to < 0) return prev
          const next = prev.slice()
          next.splice(from, 1)
          next.splice(to, 0, fromId)
          return next
        })
      }

      const onDragStart = (id, e) => {
        setDragId(id)
        try {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', id)
        } catch { /* ignore */ }
      }

      const onDragOverChip = (id, e) => {
        e.preventDefault()
        e.stopPropagation()
        try { e.dataTransfer.dropEffect = 'move' } catch { /* ignore */ }
        if (id !== overId) setOverId(id)
      }

      const onDropChip = (id, e) => {
        e.preventDefault()
        e.stopPropagation()
        const from = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || dragId
        reorder(from, id)
        setDragId(null)
        setOverId(null)
        setBarOver(false)
      }

      const onDragEnd = () => {
        setDragId(null)
        setOverId(null)
        setBarOver(false)
      }

      return h('div', { className: 'dsh-dt-stage' },
        h('section', { className: 'dsh-dt-section' },
          h('div', { className: 'dsh-dt-section-title' },
            h('h3', null, t('pinOrder')),
            h('span', { className: 'dsh-dt-meta' }, t('dragHint'))
          ),
          pinned.length === 0
            ? h('div', { className: 'dsh-dt-empty' }, t('empty'))
            : h('div', {
                className: 'dsh-dt-pinbar',
                'data-over': barOver ? '1' : '0',
                onDragOver: (e) => {
                  e.preventDefault()
                  setBarOver(true)
                },
                onDragLeave: () => setBarOver(false),
                onDrop: (e) => {
                  e.preventDefault()
                  setBarOver(false)
                  setDragId(null)
                  setOverId(null)
                }
              },
                pinned.map((id) => {
                  const tool = TOOL_DEFS.find((x) => x.id === id)
                  if (!tool) return null
                  return h('div', {
                    key: id,
                    className: 'dsh-dt-pinchip',
                    draggable: true,
                    'data-dragging': dragId === id ? '1' : '0',
                    'data-drop': overId === id && dragId !== id ? '1' : '0',
                    onDragStart: (e) => onDragStart(id, e),
                    onDragOver: (e) => onDragOverChip(id, e),
                    onDrop: (e) => onDropChip(id, e),
                    onDragEnd
                  },
                    h('span', {
                      className: 'dsh-dt-grip',
                      'data-tip': t('dragHandle'),
                      'aria-hidden': true
                    },
                      h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'currentColor' },
                        h('circle', { cx: 3.5, cy: 3, r: 1.1 }),
                        h('circle', { cx: 8.5, cy: 3, r: 1.1 }),
                        h('circle', { cx: 3.5, cy: 6, r: 1.1 }),
                        h('circle', { cx: 8.5, cy: 6, r: 1.1 }),
                        h('circle', { cx: 3.5, cy: 9, r: 1.1 }),
                        h('circle', { cx: 8.5, cy: 9, r: 1.1 })
                      )
                    ),
                    h('div', { className: 'dsh-dt-mark', 'data-tone': tool.tone, style: { width: 28, height: 28, borderRadius: 8, fontSize: 10 } }, tool.mark),
                    h('strong', null, labelOf(tool)),
                    h('div', {
                      className: 'dsh-dt-actions',
                      // 避免点按钮时触发拖拽
                      onMouseDown: (e) => e.stopPropagation(),
                      onPointerDown: (e) => e.stopPropagation()
                    },
                      h(Btn, {
                        ghost: true,
                        iconOnly: true,
                        title: t('open'),
                        icon: h(IconOpenSvg),
                        onClick: () => openTool(id)
                      }),
                      h(Btn, {
                        ghost: true,
                        iconOnly: true,
                        title: t('unpin'),
                        icon: h(IconUnpinSvg),
                        onClick: () => toggle(id)
                      })
                    )
                  )
                })
              )
        ),
        h('section', { className: 'dsh-dt-section' },
          h('div', { className: 'dsh-dt-section-title' },
            h('h3', null, t('catalog')),
            h('span', { className: 'dsh-dt-meta' }, String(TOOL_DEFS.length))
          ),
          h('div', { className: 'dsh-dt-grid' },
            TOOL_DEFS.map((tool) =>
              h('div', {
                key: tool.id,
                className: 'dsh-dt-tile',
                'data-pinned': isPinned(tool.id) ? '1' : '0'
              },
                h('div', { className: 'dsh-dt-tile-actions' },
                  h(Btn, {
                    ghost: true,
                    iconOnly: true,
                    title: t('open'),
                    icon: h(IconOpenSvg),
                    onClick: () => openTool(tool.id)
                  }),
                  h(Btn, {
                    ghost: true,
                    iconOnly: true,
                    title: isPinned(tool.id) ? t('unpin') : t('pin'),
                    icon: isPinned(tool.id) ? h(IconUnpinSvg) : h(IconPinSvg),
                    onClick: () => toggle(tool.id)
                  })
                ),
                h('div', { className: 'dsh-dt-tile-top' },
                  h('div', { className: 'dsh-dt-mark', 'data-tone': tool.tone }, tool.mark),
                  h('div', { className: 'dsh-dt-tile-copy' },
                    h('div', { className: 'dsh-dt-tile-title' }, labelOf(tool)),
                    h('div', { className: 'dsh-dt-tile-desc' }, descOf(tool))
                  )
                )
              )
            )
          )
        )
      )
    }

    const TARGET_LANGS = [
      { value: 'zh', label: '简体中文' },
      { value: 'zh-Hant', label: '繁體中文' },
      { value: 'en', label: 'English' },
      { value: 'ja', label: '日本語' },
      { value: 'ko', label: '한국어' },
      { value: 'fr', label: 'Français' },
      { value: 'de', label: 'Deutsch' },
      { value: 'es', label: 'Español' },
      { value: 'pt', label: 'Português' },
      { value: 'it', label: 'Italiano' },
      { value: 'ru', label: 'Русский' },
      { value: 'ar', label: 'العربية' },
      { value: 'hi', label: 'हिन्दी' },
      { value: 'th', label: 'ไทย' },
      { value: 'vi', label: 'Tiếng Việt' },
      { value: 'id', label: 'Bahasa Indonesia' },
      { value: 'ms', label: 'Bahasa Melayu' },
      { value: 'tr', label: 'Türkçe' },
      { value: 'pl', label: 'Polski' },
      { value: 'nl', label: 'Nederlands' },
      { value: 'uk', label: 'Українська' },
      { value: 'sv', label: 'Svenska' },
      { value: 'cs', label: 'Čeština' },
      { value: 'el', label: 'Ελληνικά' },
      { value: 'he', label: 'עברית' },
      { value: 'fa', label: 'فارسی' }
    ]

    /**
     * 用宿主模型翻译文本
     */
    function TranslateTool({ t, lang, tool }) {
      const s = useToolState(tool.id)
      const [target, setTarget] = useMemState(tool.id, 'target', lang === 'en' ? 'zh' : 'en')
      const [customTarget, setCustomTarget] = useMemState(tool.id, 'customTarget', '')
      const [source, setSource] = useMemState(tool.id, 'source', '')
      const [busy, setBusy] = useState(false)
      const abortRef = useRef(null)
      const picked = TARGET_LANGS.find((item) => item.value === target)
      const targetLabel = picked ? picked.label : customTarget.trim()

      const run = async () => {
        if (busy) return
        if (!targetLabel) {
          s.setError(t('targetRequired'))
          return
        }
        const ac = new AbortController()
        abortRef.current = ac
        setBusy(true)
        s.setError('')
        try {
          const res = await fetch('/dev-tools/translate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              input: s.input,
              target: targetLabel,
              source: source.trim() || undefined
            }),
            signal: ac.signal
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data || data.ok === false) {
            throw new Error((data && data.error) || ('HTTP ' + res.status))
          }
          s.setOutput(data.text == null ? '' : String(data.text))
        } catch (e) {
          if (e && e.name === 'AbortError') s.setError(t('translateCancelled'))
          else s.setError(e && e.message ? e.message : String(e))
        } finally {
          setBusy(false)
          abortRef.current = null
        }
      }

      return h(ToolShell, {
        tool, lang, t,
        status: busy ? t('translating') : '',
        extras: h('div', { className: 'dsh-dt-row' },
          h(Select, {
            style: { width: 176 },
            title: t('targetLang'),
            value: target,
            onChange: setTarget,
            options: TARGET_LANGS.concat([{ value: 'custom', label: t('customLang') }])
          }),
          target === 'custom'
            ? h('input', {
                className: 'dsh-dt-input',
                style: { width: 148 },
                value: customTarget,
                placeholder: t('customLang'),
                'aria-label': t('targetLang'),
                onChange: (e) => setCustomTarget(e.target.value)
              })
            : null,
          h('input', {
            className: 'dsh-dt-input',
            style: { width: 160 },
            value: source,
            placeholder: t('sourceLang'),
            'aria-label': t('sourceLang'),
            'data-tip': t('sourceLang'),
            onChange: (e) => setSource(e.target.value)
          })
        ),
        actions: [
          h(Btn, { primary: true, key: 'go', disabled: busy, onClick: run }, t('translate')),
          busy ? h(Btn, { key: 'stop', onClick: () => abortRef.current && abortRef.current.abort() }, t('cancel')) : null
        ],
        children: h(ToolIO, {
          t,
          input: s.input,
          setInput: s.setInput,
          output: s.output,
          setOutput: s.setOutput,
          error: s.error
        })
      })
    }

    function ToolPage({ id, t, lang }) {
      const tool = TOOL_DEFS.find((x) => x.id === id)
      if (!tool) return h('div', { className: 'dsh-dt-muted' }, 'Unknown tool')
      const common = { t, lang, tool }
      if (id === 'json') return h(JsonTool, common)
      if (id === 'timestamp') return h(TimestampTool, common)
      if (id === 'uuid') return h(UuidTool, common)
      if (id === 'base64') return h(CodecTool, { ...common, mode: 'base64' })
      if (id === 'url') return h(CodecTool, { ...common, mode: 'url' })
      if (id === 'hex') return h(CodecTool, { ...common, mode: 'hex' })
      if (id === 'hash') return h(HashTool, common)
      if (id === 'aes') return h(AesTool, common)
      if (id === 'jwt') return h(JwtTool, common)
      if (id === 'text-case') return h(CaseTool, common)
      if (id === 'number-base') return h(NumberBaseTool, common)
      if (id === 'query-string') return h(QueryTool, common)
      if (id === 'diff') return h(DiffTool, common)
      if (id === 'translate') return h(TranslateTool, common)
      return h('div', { className: 'dsh-dt-muted' }, 'Unknown tool')
    }

    function App({ t, lang }) {
      const initial = useMemo(() => loadPrefs(), [])
      const [pinned, setPinned] = useState(initial.pinned)
      const [temps, setTemps] = useState(initial.temps || [])
      const [active, setActive] = useState(initial.active)
      const [scheme, setScheme] = useState('light')
      // 切走的工具页保持挂载，避免翻译输入和结果被清掉
      const [kept, setKept] = useState([])

      useEffect(() => {
        // 固定列表变化时，从临时列表剔除已固定项
        setTemps((prev) => prev.filter((id) => !pinned.includes(id)))
      }, [pinned])

      useEffect(() => {
        savePrefs({ pinned, temps, active })
      }, [pinned, temps, active])

      useEffect(() => {
        if (active !== MANAGE_ID && !isToolId(active)) {
          setActive(pinned[0] || temps[0] || MANAGE_ID)
        }
      }, [pinned, temps, active])

      useEffect(() => {
        const sync = () => setScheme(detectScheme())
        sync()
        const mo = new MutationObserver(sync)
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color-scheme', 'class'] })
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        if (mq.addEventListener) mq.addEventListener('change', sync)
        else if (mq.addListener) mq.addListener(sync)
        return () => {
          mo.disconnect()
          if (mq.removeEventListener) mq.removeEventListener('change', sync)
          else if (mq.removeListener) mq.removeListener(sync)
        }
      }, [])

      const tabLabel = (id) => {
        if (id === MANAGE_ID) return t('manage')
        const tool = TOOL_DEFS.find((x) => x.id === id)
        if (!tool) return id
        return lang === 'zh' ? tool.zh : tool.en
      }

      const openTool = useCallback((id) => {
        if (!isToolId(id)) return
        if (!pinned.includes(id)) {
          setTemps((prev) => (prev.includes(id) ? prev : prev.concat(id)))
        }
        setActive(id)
      }, [pinned])

      const togglePin = useCallback((id) => {
        setPinned((prev) => {
          if (prev.includes(id)) {
            // 取消固定后保留为临时 Tab，避免从顶栏消失
            setTemps((t) => (t.includes(id) ? t : t.concat(id)))
            return prev.filter((x) => x !== id)
          }
          setTemps((t) => t.filter((x) => x !== id))
          return prev.concat(id)
        })
      }, [])

      const closeTemp = useCallback((id) => {
        setTemps((prev) => {
          const next = prev.filter((x) => x !== id)
          setActive((cur) => {
            if (cur !== id) return cur
            return pinned[0] || next[0] || MANAGE_ID
          })
          return next
        })
      }, [pinned])

      const tempTabs = temps.filter((id) => isToolId(id) && !pinned.includes(id))
      const alive = new Set(pinned.concat(temps))
      const panels = kept.filter((id) => alive.has(id) && isToolId(id))
      if (active !== MANAGE_ID && isToolId(active) && alive.has(active) && !panels.includes(active)) {
        panels.push(active)
      }
      const panelKey = panels.join('\n')

      useEffect(() => {
        const next = panelKey ? panelKey.split('\n') : []
        setKept((prev) => (
          prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next
        ))
      }, [panelKey])

      return h('div', { className: 'dsh-dt-root', 'data-scheme': scheme },
        h('style', null, CSS),
        h('div', { className: 'dsh-dt-tabs', role: 'tablist' },
          pinned.map((id) =>
            h('button', {
              key: id,
              type: 'button',
              role: 'tab',
              className: 'dsh-dt-tab',
              'data-active': active === id ? '1' : '0',
              onClick: () => setActive(id)
            }, tabLabel(id))
          ),
          tempTabs.map((id) =>
            h('div', {
              key: 'temp-' + id,
              className: 'dsh-dt-tab-temp',
              role: 'presentation'
            },
              h('button', {
                type: 'button',
                role: 'tab',
                className: 'dsh-dt-tab',
                'data-temp': '1',
                'data-active': active === id ? '1' : '0',
                onClick: () => setActive(id)
              }, tabLabel(id)),
              h('button', {
                type: 'button',
                className: 'dsh-dt-tab-close',
                'data-tip': t('closeTemp'),
                'aria-label': t('closeTemp'),
                onClick: (e) => {
                  e.stopPropagation()
                  closeTemp(id)
                }
              }, '×')
            )
          ),
          h('button', {
            type: 'button',
            role: 'tab',
            className: 'dsh-dt-tab dsh-dt-tab-manage',
            'data-active': active === MANAGE_ID ? '1' : '0',
            'data-tip': t('manage'),
            'aria-label': t('manage'),
            onClick: () => setActive(MANAGE_ID)
          }, IconSettings
            ? h(IconSettings)
            : h('svg', {
                width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
                stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
                'aria-hidden': true
              },
                h('circle', { cx: 8, cy: 8, r: 2.2 }),
                h('path', { d: 'M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M3.9 3.9l.9.9M11.2 11.2l.9.9M3.9 12.1l.9-.9M11.2 4.8l.9-.9' })
              )
          )
        ),
        h('div', { className: 'dsh-dt-body' },
          active === MANAGE_ID
            ? h(ManagePage, { t, lang, pinned, setPinned, openTool, togglePin })
            : null,
          panels.map((id) =>
            h('div', {
              key: id,
              className: 'dsh-dt-keep',
              hidden: active !== id
            }, h(ToolPage, { id, t, lang }))
          )
        )
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dev-tools: dictionaries')
        const translate = ctx.locale.bind(NS)
        const t = (key) => {
          try { return translate(key) } catch { return DICTIONARIES.zh[key] || key }
        }
        const langOf = () => {
          try {
            const cur = ctx.locale && ctx.locale.current
            const v = typeof cur === 'function' ? cur() : cur
            return String(v || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
          } catch {
            return 'zh'
          }
        }

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 26,
              label: () => translate('panelLabel'),
              locale: NS
            },
            PanelIcon
          )
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: PANEL_ID, locale: NS },
            function DevToolsMain() {
              return h(App, { t, lang: langOf() })
            }
          )
        )
      }
    }
  }
})
