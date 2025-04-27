// グローバルなKaTeXの型定義
interface Window {
  katex: {
    renderToString: (
      formula: string,
      options: {
        displayMode?: boolean
        throwOnError?: boolean
        [key: string]: any
      },
    ) => string
  }
}
