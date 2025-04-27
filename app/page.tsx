"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"

// KaTeXをクライアントサイドでのみ動的にインポート
const KaTeX = dynamic(() => import("@/components/katex-renderer"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-muted h-6 w-full rounded"></div>,
})

export default function Home() {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [currentResponse, setCurrentResponse] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { theme } = useTheme()

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, currentResponse])

  // テキストエリアの高さを自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // 送信ハンドラー
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // 入力をメッセージリストに追加
    const userMessage = { role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setThinking(true)
    setCurrentResponse("")

    try {
      // SSEストリームを開始
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: input }),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      // SSEストリームを処理
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("Response body is null")
      }

      // thinking状態を解除（最初のチャンクが来たら）
      let isFirstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.substring(6))

        for (const line of lines) {
          if (line === "[DONE]") continue
          try {
            // SSEからのデータを処理
            if (isFirstChunk) {
              setThinking(false)
              isFirstChunk = false
            }

            // タイプライター効果のためにテキストを1文字ずつ追加
            const content = line
            setCurrentResponse((prev) => prev + content)
          } catch (e) {
            console.error("Error parsing SSE data:", e)
          }
        }
      }
    } catch (error) {
      console.error("Error:", error)
      setCurrentResponse("エラーが発生しました。もう一度お試しください。")
    } finally {
      setIsLoading(false)
      // 完了したらメッセージリストに追加
      if (currentResponse) {
        setMessages((prev) => [...prev, { role: "assistant", content: currentResponse }])
        setCurrentResponse("")
      }
    }
  }

  // Cmd/Ctrl + Enterで送信
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit(e)
    }
  }

  // 会話をクリア
  const clearConversation = () => {
    setMessages([])
    setCurrentResponse("")
  }

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* ヘッダー */}
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">東大数学チューター</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={clearConversation}
            disabled={messages.length === 0 && !currentResponse}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">会話をクリア</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !currentResponse ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <h2 className="text-2xl font-bold">東大レベルの数学問題を解説します</h2>
              <p className="text-muted-foreground">
                問題文を入力して送信すると、解答方針、解答、詳しい解説を順番に表示します。
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn("flex flex-col max-w-3xl mx-auto", message.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "px-4 py-2 rounded-lg",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {message.role === "user" ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <KaTeX content={message.content} />
                  )}
                </div>
              </div>
            ))}

            {/* 現在の応答（ストリーミング中） */}
            {(thinking || currentResponse) && (
              <div className="flex flex-col max-w-3xl mx-auto items-start">
                <div className="px-4 py-2 rounded-lg bg-muted">
                  {thinking ? <div className="animate-pulse">thinking...</div> : <KaTeX content={currentResponse} />}
                </div>
              </div>
            )}

            {/* 自動スクロール用の参照ポイント */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="数学の問題を入力してください..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
            <span className="sr-only">送信</span>
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">⌘ + Enter で送信</p>
      </form>
    </main>
  )
}
