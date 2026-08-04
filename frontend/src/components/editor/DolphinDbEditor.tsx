import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

import "@/assets/lib/monaco";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";

const snippets = [
  ["submitOrder", "Backtest::submitOrder(context.engine, (${1:symbol}, ${2:tradeTime}, 5, ${3:price}, ${4:quantity}, 1), \"${5:strategy}\")"],
  ["getPosition", "Backtest::getPosition(context.engine, ${1:symbol}, \"stock\")"],
  ["getAvailableCash", "Backtest::getAvailableCash(context.engine, \"stock\")"],
  ["getLastData", "backtest::getLastData(context, message, ${1:false})"]
] as const;

export default function DolphinDbEditor({ modelPath, onChange, onValidityChange, readOnly = false, validate, value }: { modelPath: string; onChange: (value: string) => void; onValidityChange?: (valid: boolean) => void; readOnly?: boolean; validate?: (value: string) => boolean; value: string }) {
  const theme = useAppStore((state) => state.theme);
  const disposable = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => () => disposable.current?.dispose(), []);

  const mount: OnMount = (editor, monaco) => {
    const uri = editor.getModel()?.uri.toString();
    if (!uri) return;
    disposable.current?.dispose();
    disposable.current = monaco.languages.registerCompletionItemProvider("dolphindb", {
      triggerCharacters: [":", "."],
      provideCompletionItems(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
        if (model.uri.toString() !== uri) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return { suggestions: snippets.map(([label, insertText]) => ({ label, detail: "DolphinDB 回测 API", insertText, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, kind: monaco.languages.CompletionItemKind.Function, range })) };
      }
    });
  };

  function change(source = "") {
    onChange(source);
    if (onValidityChange && validate) onValidityChange(validate(source));
  }

  return <MonacoEditorFrame className="min-h-0"><Editor beforeMount={configureDolphinDb} height="100%" language="dolphindb" onChange={change} onMount={mount} options={{ automaticLayout: true, bracketPairColorization: { enabled: true }, cursorBlinking: "smooth", fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace", fontLigatures: true, fontSize: 13, formatOnPaste: true, lineHeight: 21, minimap: { enabled: false }, padding: { top: 16, bottom: 16 }, quickSuggestions: true, readOnly, scrollBeyondLastLine: false, suggest: { preview: true, showSnippets: true }, tabSize: 4, wordWrap: "on" }} path={modelPath} theme={theme === "dark" ? "vs-dark" : "light"} value={value} /></MonacoEditorFrame>;
}

function configureDolphinDb(monaco: Monaco) {
  if (!monaco.languages.getLanguages().some((language: { id: string }) => language.id === "dolphindb")) monaco.languages.register({ id: "dolphindb" });
  monaco.languages.setMonarchTokensProvider("dolphindb", {
    keywords: ["def", "if", "else", "for", "while", "return", "mutable", "true", "false", "NULL"],
    tokenizer: { root: [[/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }], [/\d+(\.\d+)?/, "number"], [/"([^"\\]|\\.)*"/, "string"], [/\/\*/, "comment", "@comment"], [/\/\/.*$/, "comment"]], comment: [[/[^*/]+/, "comment"], [/\*\//, "comment", "@pop"], [/[*/]/, "comment"]] }
  });
}
