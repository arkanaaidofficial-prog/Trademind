export type TradeAccountType = 'spot' | 'futures' | 'margin'

export type ScreenshotJsonItem = {
  url: string
  name?: string
  stage?: 'before' | 'during' | 'after'
}
