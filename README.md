# dsh-local-kb

[English](./README.en.md)

面向 DeepSeek Harness (`dsh@0.2.2-rc.5`) 的**本地确定性知识库插件**：基于 Node 26 内置 `node:sqlite` FTS5，**零原生编译、零外部运行时依赖**，支持中文 CJK 2 字及以上精准检索、安全 OOXML（DOCX/XLSX/PPTX）解析、`source_hash` 鲜度校验、强制分页读取与严格目录越界隔离。

## 核心能力

- **纯 Node 26 `node:sqlite` 双索引 FTS5**：
  - `chunks_fts_trigram`（SQLite FTS5 `trigram`）：支持 3 字符及以上任意子串匹配。
  - `chunks_fts_tokens`（纯 JS CJK 双字切片 + `unicode61`）：补齐 2 字中文核心业务词（如“标书”“合同”“违约”“审计”）确定性命中，无 C++ 原生编译负担。
- **内置纯 JS 文档解析 + 安全 OOXML 解析**：
  - 原生支持 Markdown / TXT / JSON / CSV / YAML / HTML / 常见代码文件。
  - 通过静态打包的 `fflate` 解析 `.docx` / `.xlsx` / `.pptx`：解压前执行 ZIP 中央目录 **4 配额 ZIP 炸弹预检**（文件数 ≤ 1000、单文件 ≤ 25 MiB、总解压 ≤ 100 MiB、压缩比 ≤ 100x），阻断 `..` 路径穿越、旧版加密 OLE2、加密 OOXML、XML `<!DOCTYPE`/`<!ENTITY` XXE，并自动剥离 `w:altChunk` 与 Word 修订删除内容 `<w:del>`。
  - 提供可扩展 `registerExtractor(ext, fn)` 钩子，便于接入 PDF / OCR 解析器。
- **`source_hash` 鲜度校验与增量索引**：基于文件内容 SHA-256 跳过未变更文件，读取时自动比对磁盘实时 `source_hash`（变更则标记 `stale` 并按需重索引）。
- **强制分页契约 (`offset` / `limit` / `truncated` / `nextOffset`)**：所有 `kb_read` 读取均受有界窗口限制并显式返回 `truncated` 与 `nextOffset`，防止截断遗漏导致幻觉。
- **严格 `kbOnlyMode` 边界与敏感路径封锁**：所有读取必须落入已登记知识库根目录内（`realpath` 校验防符号链接逃逸），且即使误添加用户主目录，内置敏感凭据路径（`.ssh` / `.aws` / `.env` / `.pem` 等）依然拒绝索引与读取。
- **零硬耦合协同**：自动将读取片段与截断信息登记至 `ctx.get('governanceEvidence')`（若已安装 `dsh-grounding-guard`），并向 `ctx.get('governanceAudit')`（若已安装 `dsh-audit-ledger`）写入审计事件。

## 安装

```bash
dsh plugin add github:Octo-o-o-o/dsh-local-kb
```

## 诚实边界说明

- **默认不包含二进制 PDF/OCR 引擎**：为保持零原生依赖与跨平台安装可靠性，默认支持文本类文件与 OOXML（DOCX/XLSX/PPTX）；PDF/扫描件需通过 `registerExtractor('.pdf', fn)` 接入外部解析器。
- **确定性词法/子串检索，非语义向量检索**：聚焦可复现、可审计的证据定位，不隐式调用外部 Embedding API。

## 许可协议

[Apache-2.0](./LICENSE) — Copyright 2026 OctoLab (`Octo-o-o-o`).
