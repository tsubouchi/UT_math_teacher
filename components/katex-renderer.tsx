"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

interface KaTeXProps {
  content: string
  className?: string
}

export default function KaTeX({ content, className }: KaTeXProps) {
  const [processedContent, setProcessedContent] = useState(content)

  useEffect(() => {
    try {
      // 特殊なLaTeX表記を処理
      let tempContent = content
        .replace(/\$begin:math:display\$([\s\S]*?)\$end:math:display\$/g, "$$$$1$$")
        .replace(/\\\\boxed/g, "\\boxed")
        .replace(/\\\\/g, "\\")

      // 数式の前後に適切なスペースを確保
      tempContent = tempContent
        .replace(/([^$])\$([^$])/g, "$1 $$$2")
        .replace(/([^$])\$\$/g, "$1 $$")
        .replace(/\$\$([^$])/g, "$$ $1")

      setProcessedContent(tempContent)
    } catch (error) {
      console.error("Error processing content:", error)
      setProcessedContent(content)
    }
  }, [content])

  // KaTeXをグローバルから使用するための関数
  const renderKaTeX = (formula: string, displayMode: boolean) => {
    if (typeof window === "undefined" || !window.katex) {
      return formula
    }

    try {
      return window.katex.renderToString(formula, {
        displayMode,
        throwOnError: false,
      })
    } catch (error) {
      console.error("KaTeX rendering error:", error)
      return displayMode
        ? `<div class="text-red-500">数式エラー: ${formula}</div>`
        : `<span class="text-red-500">数式エラー: ${formula}</span>`
    }
  }

  return (
    <div className={cn("katex-content prose dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          // インライン数式
          code: ({ node, inline, className, children, ...props }) => {
            const text = String(children).replace(/\n$/, "")

            if (inline && text.startsWith("$") && text.endsWith("$")) {
              try {
                const formula = text.slice(1, -1)
                return (
                  <span
                    className="katex-inline"
                    dangerouslySetInnerHTML={{
                      __html: renderKaTeX(formula, false),
                    }}
                  />
                )
              } catch (error) {
                console.error("KaTeX inline error:", error)
                return <code className="text-red-500">{text}</code>
              }
            }

            // ブロック数式
            if (text.startsWith("$$") && text.endsWith("$$")) {
              try {
                const formula = text.slice(2, -2)
                return (
                  <div
                    className="katex-block my-4 py-2 flex justify-center"
                    dangerouslySetInnerHTML={{
                      __html: renderKaTeX(formula, true),
                    }}
                  />
                )
              } catch (error) {
                console.error("KaTeX block error:", error)
                return <pre className="text-red-500">{text}</pre>
              }
            }

            // 通常のコード
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // 見出しのスタイル調整
          h4: ({ children }) => (
            <h4 className="text-xl font-bold mt-8 mb-3 pb-1 border-b border-primary/30">{children}</h4>
          ),
          h5: ({ children }) => <h5 className="text-lg font-semibold mt-6 mb-2 text-primary">{children}</h5>,
          // 強調テキストのスタイル調整
          strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
          // テーブルのスタイル調整
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-6 py-4 whitespace-nowrap text-sm">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-muted/30">{children}</tr>,
          // リストのスタイル調整
          ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          // 段落のスタイル調整
          p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
