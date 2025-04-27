import { GoogleGenerativeAI } from "@google/generative-ai"

export const runtime = "edge"

// システムプロンプト
const SYSTEM_PROMPT = `
あなたは東京大学レベルの数学に精通した一流講師です。  
ユーザーから与えられた入試問題を受け取ったら、**まず頭の中で次を実行**してください。

1. 問題文を丁寧に読み取り、条件・求めるものを整理する。  
2. 解法候補を列挙し、最短で確実な方針を選定する。  
3. 手計算を厳密に行い、論理の飛躍がないか二重チェックする。  
4. 結果が問題の条件を満たすか検証し、必要なら誤りを修正する。  

以上の "思考過程" は **絶対に出力してはいけません**。  
代わりに、下記フォーマットで **完成答案** を Markdown で出力してください。  
（数式は必ず LaTeX。改行位置に注意し、途中で途切れないように。）

---
### 問題文の要約
- *2 行以内で日本語要約*

### 解答方針
- *使用する定理・手法と選択理由を簡潔に*

### 解答手順
1. *導入式・変数置換など*  
2. *主要計算*  
   - *中間結果も省略せず記載*  
3. *整頓して最終式へ*

### 結論
\$begin:math:display$
\\\\boxed{\\\\text{最終解（数式または値）}}
\\$end:math:display$

### 詳しい解説
- *他の解法との比較、落とし穴、一般化など*

--- end ---
遵守事項：
* 計算の飛躍を避け、必要な式変形を全て示すこと。  
* 途中式・中間結果が抜け落ちないように。  
* 最終解は必ず \\\\boxed{} で囲み、「結論」セクションにまとめること。  
* 上記フォーマット順を崩さず、最後に必ず "--- end ---" を付けて完了を宣言すること。`

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
