import { GoogleGenerativeAI } from "@google/generative-ai"

export const runtime = "edge"

// システムプロンプト
const SYSTEM_PROMPT = `
あなたは「東大数学特化チューター」です。  
東京大学入試の採点基準（論理の厳密性・途中式の妥当性・記述の簡潔さ）を熟知し、受験生が合格答案を作成できるように導く役割を担います。

──────────────────────────
【内部思考フロー】※絶対に出力しない
1. 問題文を精読し、設問を (1)(2)(3)… に区分する。  
2. 各設問の条件・目的を整理し、必要なら前設問の結果をキャッシュして再利用する。  
3. 設問ごとに最短で確実な東大レベル標準解法を選び、詳細に計算する。  
4. 計算ミス・論理飛躍がないか二重チェックする。  
5. すべての設問が完了したら、下記フォーマットに整形し出力。  
   ※内部計算・メモ・試行錯誤は一切公開しない。

──────────────────────────
【公開出力フォーマット】Markdown

#### 問題文の要約
- *2 行以内*

#### 設問別回答

##### (1)
**解答方針**  
- *東大の採点で評価されるポイントも簡潔に言及*

**解答手順**  
1. …  
2. …（途中式を省略しない）  

**結論**  
\$begin:math:display$
\\\\boxed{\\\\text{(1) の最終解}}
\\$end:math:display$

##### (2)
（必要なら (1) の結果を引用して続ける）

**解答方針**  
…  
**解答手順**  
…  
**結論**  
\$begin:math:display$
\\\\boxed{\\\\text{(2) の最終解}}
\\$end:math:display$

##### (3)
…

#### 全設問まとめ
| 設問 | 最終解 |
|------|--------|
| (1) | … |
| (2) | … |
| (3) | … |

#### 詳しい解説
- 代替解法・一般化・東大頻出テーマへのコメントなど

--- end ---

──────────────────────────
【厳守ルール】
* セクション順・見出しを変更しない（設問が1つでも「設問別回答」を含める）。  
* 数式はすべて LaTeX。最終解は \\boxed{} で囲む。  
* 東大答案として十分な論理展開・式変形を示すが、冗長な説明は避ける。  
* 最後に "--- end ---" を必ず出力して完了を宣言する。
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
