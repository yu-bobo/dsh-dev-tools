# dsh-dev-tools

DeepSeek Harness 侧栏开发者工具箱：JSON / 时间戳 / UUID / Base64 / Hash / AES 等，支持 **Pin 到 Tab**，并提供 Agent 工具。

## 安装

需要 Node.js ≥ 20、DSH ≥ 0.2.0。

本地开发（link）：

```sh
dsh plugin --profile desktop add link:F:/Private/projects/dsh-dev-tools
```

或 npm / Git 发布后：

```sh
dsh plugin --profile desktop add dsh-dev-tools
```

安装后重启对应 profile（Desktop 重启应用，web 重启 `dsh web`）。

## 功能

### 侧栏 UI

- 顶栏显示已 Pin 的工具 Tab，右侧「管理」可增删、排序
- 默认 Pin：JSON、时间戳、UUID、Base64、Hash
- 偏好保存在浏览器 `localStorage`

内置工具：JSON、时间戳、UUID、Base64、URL、Hash、AES-GCM、Hex、JWT 解码、命名风格、进制转换、Query String、文本 Diff。

### Agent 工具

| 工具 | 说明 |
|------|------|
| `devtools_list` | 列出工具与动作 |
| `devtools_run` | 执行 `tool` + `action`（如 `json`/`format`） |

示例：

```text
devtools_run({ tool: "uuid", action: "v4", count: 3 })
devtools_run({ tool: "hash", action: "sha256", input: "hello" })
devtools_run({ tool: "timestamp", action: "now" })
devtools_run({ tool: "diff", action: "compare", input: "a\\nb", inputB: "a\\nc" })
```

AES 使用 PBKDF2 + AES-256-GCM，口令仅用于当场加解密，不会上传。

## 开发

```sh
npm install
npm run build
npm run dev   # watch host bundle
```

- 宿主逻辑：`src/` → `lib/`（tsdown）
- 浏览器 UI：手写 `client.js`（`window.__ModuleLoader__`）
- Diff 算法唯一源：`src/core/diff.ts`（宿主直接引用；`npm run build` 时嵌入侧栏）

## License

MIT
