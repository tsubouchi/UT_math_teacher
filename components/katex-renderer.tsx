"use client"

import { useEffect, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { cn } from "@/lib/utils"

interface KaTeXProps {
  content: string
  className?: string
}

export default function KaTeX({ content, className }: KaTeXProps) {
  const [renderedContent, setRenderedContent] = useState("")

  useEffect(() => {
    // LaTeX数式をレンダリング
    try {
      // インライン数式 $...$ と ブロック数式 $$...$$ を処理
      const processedContent = content
        .split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/)
        .map((part, index) => {
          if (part.startsWith("$$") && part.endsWith("$$")) {
            // ブロック数式
            const formula = part.slice(2, -2)
            try {
              return `<div class="flex justify-center my-2">${katex.renderToString(formula, {
                displayMode: true,
                throwOnError: false,
              })}</div>`
            } catch (e) {
              console.error("KaTeX error:", e)
              return `<div class="text-red-500">数式エラー: ${part}</div>`
            }
          } else if (part.startsWith("$") && part.endsWith("$")) {
            // インライン数式
            const formula = part.slice(1, -1)
            try {
              return katex.renderToString(formula, {
                displayMode: false,
                throwOnError: false,
              })
            } catch (e) {
              console.error("KaTeX error:", e)
              return `<span class="text-red-500">数式エラー: ${part}</span>`
            }
          }
          // 通常のテキスト - 改行を保持
          return part.replace(/\n/g, "<br>")
        })
        .join("")

      setRenderedContent(processedContent)
    } catch (error) {
      console.error("Error rendering content:", error)
      setRenderedContent(`<div class="text-red-500">レンダリングエラー</div>`)
    }
  }, [content])

  return (
    <div
      className={cn("katex-content prose dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}
