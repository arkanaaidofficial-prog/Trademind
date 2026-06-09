export const TRADE_ACCOUNT_TYPES = ['spot', 'futures', 'margin'] as const

export type TradeAccountType = typeof TRADE_ACCOUNT_TYPES[number]

export const TRADE_ACCOUNT_LABELS: Record<TradeAccountType, string> = {
  spot: 'Spot',
  futures: 'Futures',
  margin: 'Margin',
}

export function formatTradeAccountType(value?: TradeAccountType | string | null): string {
  if (value === 'spot' || value === 'futures' || value === 'margin') {
    return TRADE_ACCOUNT_LABELS[value]
  }
  return TRADE_ACCOUNT_LABELS.spot
}

export type ScreenshotJsonItem = {
  url: string
  name?: string
  stage?: 'before' | 'during' | 'after'
}
