import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// レート制限のための簡易的なメモリストア
// 注: 本番環境では Redis などの外部ストアを使用することを推奨
const RATE_LIMIT_DURATION = 60 * 1000 // 1分
const MAX_REQUESTS_PER_MINUTE = 30 // 1分あたり30リクエスト

interface RateLimitRecord {
  count: number
  timestamp: number
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// 古いレコードをクリーンアップする関数
function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.timestamp > RATE_LIMIT_DURATION) {
      rateLimitStore.delete(key)
    }
  }
}

// 定期的にクリーンアップを実行
setInterval(cleanupRateLimitStore, RATE_LIMIT_DURATION)

export function middleware(request: NextRequest) {
  // APIエンドポイントのみをレート制限
  if (request.nextUrl.pathname.startsWith("/api/solve")) {
    // IPアドレスをキーとして使用
    const ip = request.ip || "anonymous"
    const now = Date.now()

    // レコードが存在しない場合は新規作成
    if (!rateLimitStore.has(ip)) {
      rateLimitStore.set(ip, { count: 1, timestamp: now })
      return NextResponse.next()
    }

    const record = rateLimitStore.get(ip)!

    // 期限切れのレコードをリセット
    if (now - record.timestamp > RATE_LIMIT_DURATION) {
      rateLimitStore.set(ip, { count: 1, timestamp: now })
      return NextResponse.next()
    }

    // レート制限を超えた場合
    if (record.count >= MAX_REQUESTS_PER_MINUTE) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": `${Math.ceil((record.timestamp + RATE_LIMIT_DURATION - now) / 1000)}`,
        },
      })
    }

    // カウントを増やして続行
    record.count++
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/api/:path*",
}
