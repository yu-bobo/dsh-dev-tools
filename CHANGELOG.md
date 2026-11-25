# Changelog

## 0.1.3

- JSON 格式化输出改为可折叠树视图，key 分层着色、value 按类型着色，适配浅色/暗色
- 切换 DSH 侧栏后保留各工具输入内容

## 0.1.2

- 新增翻译：侧栏输入与 `devtools_translate` 共用宿主当前默认模型，不另备翻译密钥
- 单次最多 12000 字；保留代码块、URL 与占位符

## 0.1.1

- 新增文本 Diff：双栏输入 / 选文件、实时行级着色、折叠上下文、忽略行尾空白、复制 Unified
- Diff 算法单源：`src/core/diff.ts`，构建时嵌入侧栏，与宿主共用
- Agent：`devtools_run` 支持 `diff` / `compare`（`input` + `inputB`）

## 0.1.0

- 首版：侧栏工具箱 + Pin/Tab 管理
- 工具：JSON、时间戳、UUID、Base64、URL、Hash、AES、Hex、JWT、命名风格、进制、Query
- Agent：`devtools_list` / `devtools_run`
