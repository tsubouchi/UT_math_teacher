"use client"

import { useEffect, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
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
      const tempContent = content
        .replace(/\$begin:math:display\$([\s\S]*?)\$end:math:display\$/g, "$$$$1$$")
        .replace(/\\\\boxed/g, "\\boxed")
        .replace(/\\\\/g, "\\")

      setProcessedContent(tempContent)
    } catch (error) {
      console.error("Error processing content:", error)
      setProcessedContent(content)
    }
  }, [content])

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
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(formula, {
                        displayMode: false,
                        throwOnError: false,
                      }),
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
                    className="flex justify-center my-4"
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(formula, {
                        displayMode: true,
                        throwOnError: false,
                      }),
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
          h4: ({ children }) => <h4 className="text-xl font-bold mt-8 mb-3 border-b pb-1">{children}</h4>,
          h5: ({ children }) => <h5 className="text-lg font-semibold mt-6 mb-2">{children}</h5>,
          // 強調テキストのスタイル調整
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          // テーブルのスタイル調整
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-6 py-4 whitespace-nowrap text-sm">{children}</td>,
          tr: ({ children }) => (
            <tr className="bg-white dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800">{children}</tr>
          ),
          // リストのスタイル調整
          li: ({ children }) => <li className="my-1">{children}</li>,
          // 段落のスタイル調整
          p: ({ children }) => <p className="my-2">{children}</p>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
