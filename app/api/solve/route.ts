import { GoogleGenerativeAI } from "@google/generative-ai"

export const runtime = "edge"

// システムプロンプト
const SYSTEM_PROMPT = `
あなたは東京大学入試レベルの数学問題を解説する専門家です。
出力は必ず以下の順序で行ってください：

1. 解答方針：問題の解き方の概略を簡潔に説明
2. 解答：詳細な計算過程を含む完全な解答
3. 解説：なぜその解法を選んだのか、重要なポイントの説明

数式は必ずLaTeX形式で記述してください。例えば、二次方程式の解の公式は $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ のように表記します。
複雑な数式は独立した行に配置し、$$...$$で囲んでください。

回答は日本語で、高校生にもわかりやすく説明してください。
途中思考は外部に漏らさないでください。
`

export async function POST(req: Request) {
  try {
    const { question } = await req.json()

    if (!question?.trim()) {
      return new Response("質問が空です", { status: 400 })
    }

    // Gemini APIの初期化
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-04-17",
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 4096,
      },
    })

    // コンテンツ生成ストリームを開始
    const streamingResponse = await model.generateContentStream({
      systemInstruction: SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: question }] }],
    })

    // SSEストリームを作成
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamingResponse.stream) {
            const text = chunk.text()
            if (text) {
              // SSE形式でデータを送信
              controller.enqueue(encoder.encode(`data: ${text}\n\n`))
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        }
      },
    })

    // SSEレスポンスを返す
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("API error:", error)
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
