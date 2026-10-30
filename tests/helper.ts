// tests/helper.ts
// Pembangun objek Trade untuk tes. Dibuat seminimal mungkin supaya setiap
// tes hanya menyebut field yang benar-benar diuji — kalau sebuah tes
// menyebut field, berarti field itu memang bagian dari kontrak.

import type { Trade } from '@/types/trade'

let urutan = 0

export function tr(p: Partial<Trade> = {}): Trade {
  urutan += 1
  return {
    id: p.id ?? `t${urutan}`,
    user_id: 'pemilik',
    market_type: 'crypto',
    symbol: 'BTCUSDT',
    position_type: 'long',
    mode: 'manual',
    entry_at: '2026-01-01T00:00:00.000Z',
    entry_price: 100,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...p,
  } as Trade
}

/** Trade bot seperti yang benar-benar dikirim `peta_trade` di bot-futures:
 *  ada `result` + `r_multiple`, TIDAK ada `net_pnl` / `gross_pnl`. */
export function trBot(p: Partial<Trade> = {}): Trade {
  return tr({
    mode: 'bot',
    bot_name: 'Crypto Futures AI Agent',
    market_type: 'futures',
    trade_account_type: 'futures',
    net_pnl: null as unknown as undefined,
    gross_pnl: null as unknown as undefined,
    ...p,
  })
}
