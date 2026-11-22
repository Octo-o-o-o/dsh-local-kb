window.__ModuleLoader__.load({ id: "dsh-local-kb", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
if (typeof document !== "undefined") { const sheets = {"client.css":"/* src/kb.module.css */\n.kb_root {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  padding: 20px;\n  color: var(--text-primary, #e2e8f0);\n  font-family: var(--font-sans, system-ui, -apple-system, sans-serif);\n  max-width: 1100px;\n}\n.kb_header {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 12px;\n  flex-wrap: wrap;\n}\n.kb_title {\n  margin: 0;\n  font-size: 18px;\n  font-weight: 600;\n}\n.kb_subtitle {\n  margin: 4px 0 0;\n  font-size: 12px;\n  color: var(--text-secondary, #94a3b8);\n}\n.kb_card {\n  border: 1px solid rgba(148, 163, 184, 0.22);\n  border-radius: 10px;\n  padding: 14px;\n  background: rgba(15, 23, 42, 0.55);\n}\n.kb_sectionTitle {\n  margin: 0 0 10px;\n  font-size: 14px;\n  font-weight: 600;\n}\n.kb_formRow {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.kb_input {\n  flex: 1;\n  min-width: 240px;\n  padding: 7px 10px;\n  border-radius: 6px;\n  border: 1px solid rgba(148, 163, 184, 0.35);\n  background: rgba(15, 23, 42, 0.85);\n  color: inherit;\n  font-size: 12px;\n}\n.kb_btn {\n  padding: 7px 12px;\n  border-radius: 6px;\n  border: 1px solid rgba(148, 163, 184, 0.35);\n  background: rgba(30, 41, 59, 0.8);\n  color: inherit;\n  cursor: pointer;\n  font-size: 12px;\n}\n.kb_btnPrimary {\n  border-color: #60a5fa;\n  background: rgba(96, 165, 250, 0.18);\n}\n.kb_list {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  margin-top: 10px;\n}\n.kb_row {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  border-radius: 8px;\n  background: rgba(30, 41, 59, 0.45);\n  border: 1px solid rgba(148, 163, 184, 0.15);\n  font-size: 12px;\n}\n.kb_mono {\n  font-family:\n    ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    monospace;\n  font-size: 11px;\n  color: #94a3b8;\n}\n.kb_badge {\n  display: inline-block;\n  padding: 2px 8px;\n  border-radius: 999px;\n  font-size: 11px;\n  font-weight: 600;\n  background: rgba(52, 211, 153, 0.18);\n  color: #34d399;\n}\n.kb_badgeStale {\n  background: rgba(245, 158, 11, 0.2);\n  color: #fbbf24;\n}\n.kb_empty {\n  font-size: 12px;\n  color: #94a3b8;\n  padding: 8px 0;\n}\n"}; for (const sheetPath of Object.keys(sheets)) { const tagId = "dsh-local-kb" + ":" + sheetPath; if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) { const tag = document.createElement("style"); tag.dataset.plugin = "dsh-local-kb"; tag.dataset.pluginCss = tagId; tag.textContent = sheets[sheetPath]; document.head.appendChild(tag); } } }
"use strict";
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

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);

// src/KbPanel.tsx
var import_react = require("react");

// src/kb.module.css
var kb_default = {
  root: "kb_root",
  header: "kb_header",
  title: "kb_title",
  subtitle: "kb_subtitle",
  card: "kb_card",
  sectionTitle: "kb_sectionTitle",
  formRow: "kb_formRow",
  input: "kb_input",
  btn: "kb_btn",
  btnPrimary: "kb_btnPrimary",
  list: "kb_list",
  row: "kb_row",
  mono: "kb_mono",
  badge: "kb_badge",
  badgeStale: "kb_badgeStale",
  empty: "kb_empty"
};

// src/KbPanel.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function KbPanel({
  rpc,
  t
}) {
  const [roots, setRoots] = (0, import_react.useState)([]);
  const [newRootPath, setNewRootPath] = (0, import_react.useState)("");
  const [query, setQuery] = (0, import_react.useState)("");
  const [hits, setHits] = (0, import_react.useState)([]);
  const [statusMsg, setStatusMsg] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const refresh = (0, import_react.useCallback)(async () => {
    try {
      const res = await rpc.call("listRoots");
      setRoots(res.roots ?? []);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    }
  }, [rpc]);
  (0, import_react.useEffect)(() => {
    void refresh();
  }, [refresh]);
  const handleAddRoot = async () => {
    if (!newRootPath.trim()) return;
    setBusy(true);
    try {
      const res = await rpc.call("addRoot", {
        rootPath: newRootPath.trim(),
        indexNow: true
      });
      setNewRootPath("");
      setStatusMsg(`Indexed ${res.summary?.indexed ?? 0} file(s), skipped ${res.summary?.skippedUnchanged ?? 0}.`);
      await refresh();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const handleReindex = async (rootPath) => {
    setBusy(true);
    try {
      const summary = await rpc.call("indexRoot", {
        rootPath
      });
      setStatusMsg(`Reindexed ${rootPath}: +${summary.indexed}, unchanged ${summary.skippedUnchanged}, -${summary.removed}.`);
      await refresh();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const handleSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const res = await rpc.call("search", { query: query.trim(), limit: 15 });
      setHits(res.hits ?? []);
      setStatusMsg(`Found ${res.hits?.length ?? 0} hit(s).`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: kb_default.title, children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: kb_default.subtitle, children: t("subtitle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: kb_default.btn, onClick: refresh, disabled: busy, children: t("action.refresh") })
    ] }),
    statusMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.row, children: statusMsg }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: kb_default.sectionTitle, children: t("section.roots") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.formRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            className: kb_default.input,
            value: newRootPath,
            onChange: (e) => setNewRootPath(e.target.value),
            placeholder: t("placeholder.root")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `${kb_default.btn} ${kb_default.btnPrimary}`, onClick: handleAddRoot, disabled: busy, children: t("action.addAndIndex") })
      ] }),
      roots.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.empty, children: t("empty.roots") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.list, children: roots.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: r.label }),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: kb_default.badge, children: [
              r.documentCount,
              " docs"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.mono, children: r.rootPath })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: kb_default.btn, onClick: () => handleReindex(r.rootPath), disabled: busy, children: t("action.reindex") })
      ] }, r.rootPath)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: kb_default.sectionTitle, children: t("section.search") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: kb_default.formRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            className: kb_default.input,
            value: query,
            onChange: (e) => setQuery(e.target.value),
            placeholder: t("placeholder.query"),
            onKeyDown: (e) => {
              if (e.key === "Enter") void handleSearch();
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `${kb_default.btn} ${kb_default.btnPrimary}`, onClick: handleSearch, disabled: busy, children: t("action.search") })
      ] }),
      hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.empty, children: t("empty.hits") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.list, children: hits.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.row, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: h.relPath }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${kb_default.badge} ${h.stale ? kb_default.badgeStale ?? "" : ""}`, children: h.stale ? "stale" : h.matchSource }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: kb_default.mono, children: [
            "[",
            h.charStart,
            "..",
            h.charEnd,
            "] \xB7 ",
            h.sourceHash.slice(0, 10)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: kb_default.mono, children: h.excerpt.slice(0, 220) })
      ] }) }, `${h.docId}:${h.chunkIndex}`)) })
    ] })
  ] });
}

// src/client.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var NS = "dshLocalKb";
var PANEL_ID = "dsh-local-kb";
function KbIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2.5", y: "2", width: "11", height: "12", rx: "2", stroke: "currentColor", strokeWidth: "1.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5.2 5.5H10.8M5.2 8H10.8M5.2 10.5H8.5", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" })
  ] });
}
var inject = ["slots", "locale", "layout", "connection"];
function apply(ctx) {
  ctx.effect(() => {
    const disposeZh = ctx.locale.register(NS, "zh", {
      nav: "\u672C\u5730\u77E5\u8BC6\u5E93",
      title: "\u672C\u5730\u786E\u5B9A\u6027\u77E5\u8BC6\u5E93 (FTS5 + \u5B89\u5168 OOXML)",
      subtitle: "Node 26 \u5185\u7F6E node:sqlite \u53CC\u7D22\u5F15 \xB7 DOCX/XLSX/PPTX \u5B89\u5168\u89E3\u6790 \xB7 source_hash \u9C9C\u5EA6\u6821\u9A8C \xB7 \u5F3A\u5236\u5206\u9875",
      "action.refresh": "\u5237\u65B0",
      "action.addAndIndex": "\u6DFB\u52A0\u5E76\u5EFA\u7ACB\u7D22\u5F15",
      "action.reindex": "\u589E\u91CF\u91CD\u7D22\u5F15",
      "action.search": "\u786E\u5B9A\u6027\u68C0\u7D22",
      "section.roots": "\u6388\u6743\u77E5\u8BC6\u5E93\u6839\u76EE\u5F55 (kbOnlyMode)",
      "section.search": "FTS5 CJK + Trigram \u68C0\u7D22\u6D4B\u8BD5",
      "placeholder.root": "\u8F93\u5165\u672C\u5730\u6587\u4EF6\u5939\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u4F8B\u5982 C:\\Docs\\Specs",
      "placeholder.query": "\u8F93\u5165 2 \u5B57\u4EE5\u4E0A\u4E2D\u6587\u8BCD\u6216\u82F1\u6587\u5173\u952E\u5B57\u2026",
      "empty.roots": "\u5C1A\u672A\u767B\u8BB0\u77E5\u8BC6\u5E93\u6839\u76EE\u5F55",
      "empty.hits": "\u6682\u65E0\u68C0\u7D22\u547D\u4E2D"
    });
    const disposeEn = ctx.locale.register(NS, "en", {
      nav: "Local KB",
      title: "Local Deterministic Knowledge Base",
      subtitle: "Node 26 node:sqlite dual FTS5 \xB7 Safe OOXML (DOCX/XLSX/PPTX) \xB7 source_hash freshness \xB7 bounded reads",
      "action.refresh": "Refresh",
      "action.addAndIndex": "Add & Index",
      "action.reindex": "Re-index",
      "action.search": "Search",
      "section.roots": "Authorized KB Roots (kbOnlyMode)",
      "section.search": "FTS5 CJK + Trigram Search Preview",
      "placeholder.root": "Absolute directory path, e.g. /Users/alice/docs",
      "placeholder.query": "Enter 2+ char CJK terms or ASCII keywords...",
      "empty.roots": "No KB roots registered yet",
      "empty.hits": "No search hits yet"
    });
    return () => {
      disposeZh();
      disposeEn();
    };
  }, "dsh-local-kb: dictionaries");
  const t = ctx.locale.bind(NS);
  const rpc = {
    async call(method, payload) {
      const res = await ctx.connection.rpc.call("/api", "dshLocalKb", {
        method,
        payload: payload ?? {}
      });
      if (!res.ok) throw new Error(res.error?.message ?? `RPC failed: ${method}`);
      return res.value;
    }
  };
  ctx.slots.inject(
    "main",
    () => ctx.slots.register(
      {
        name: "main",
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ rpc, t })
      },
      KbPanel
    )
  );
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: PANEL_ID,
        order: 65,
        locale: NS,
        label: () => t("nav")
      },
      KbIcon
    )
  );
}

return module.exports; } });
