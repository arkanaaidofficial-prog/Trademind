import type { Trade } from '@/types/trade'

export type SpotHolding = {
  symbol: string
  quantity: number
  avg_cost: number
  latest_price: number
  cost_basis: number
  estimated_value: number
  unrealized_pnl: number
  realized_pnl: number
  total_fees: number
  buy_qty: number
  sell_qty: number
  buy_trades: number
  sell_trades: number
  last_trade_at: string
}

export type SpotPortfolioStats = {
  holdings_count: number
  spot_trades: number
  buy_trades: number
  sell_trades: number
  total_cost_basis: number
  estimated_value: number
  unrealized_pnl: number
  realized_pnl: number
  total_fees: number
}

type WorkingHolding = SpotHolding & {
  remaining_cost: number
}

function round(value: number, digits = 8) {
  const scale = 10 ** digits
  return Math.round((Number.isFinite(value) ? value : 0) * scale) / scale
}

function tradeQuantity(trade: Trade) {
  return Math.max(0, Number(trade.position_size ?? 0))
}

function tradePrice(trade: Trade) {
  return Number(trade.entry_price ?? 0)
}

function tradeFee(trade: Trade) {
  return Number(trade.fee ?? 0) + Number(trade.funding_fee ?? 0)
}

export function getSpotTrades(trades: Trade[]) {
  return trades
    .filter(trade => (trade.trade_account_type ?? 'spot') === 'spot')
    .sort((a, b) => new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime())
}

export function calculateSpotHoldings(trades: Trade[]): SpotHolding[] {
  const holdings = new Map<string, WorkingHolding>()

  for (const trade of getSpotTrades(trades)) {
    const symbol = trade.symbol?.toUpperCase()
    if (!symbol) continue

    const qty = tradeQuantity(trade)
    const price = tradePrice(trade)
    const fee = tradeFee(trade)
    if (!qty || !price) continue

    const current = holdings.get(symbol) ?? {
      symbol,
      quantity: 0,
      avg_cost: 0,
      latest_price: price,
      cost_basis: 0,
      estimated_value: 0,
      unrealized_pnl: 0,
      realized_pnl: 0,
      total_fees: 0,
      buy_qty: 0,
      sell_qty: 0,
      buy_trades: 0,
      sell_trades: 0,
      last_trade_at: trade.entry_at,
      remaining_cost: 0,
    }

    current.latest_price = price
    current.last_trade_at = trade.entry_at
    current.total_fees += fee

    if (trade.position_type === 'long') {
      const buyCost = qty * price + fee
      current.quantity += qty
      current.remaining_cost += buyCost
      current.buy_qty += qty
      current.buy_trades += 1
    } else {
      const sellQty = Math.min(qty, current.quantity)
      const avgCost = current.quantity > 0 ? current.remaining_cost / current.quantity : 0
      const releasedCost = avgCost * sellQty
      const proceeds = sellQty * price
      const sellFee = sellQty > 0 ? fee * (sellQty / qty) : fee

      current.realized_pnl += sellQty > 0
        ? proceeds - releasedCost - sellFee
        : Number(trade.net_pnl ?? 0)
      current.quantity -= sellQty
      current.remaining_cost -= releasedCost
      current.sell_qty += sellQty
      current.sell_trades += 1

      if (current.quantity <= 0.00000001) {
        current.quantity = 0
        current.remaining_cost = 0
      }
    }

    current.avg_cost = current.quantity > 0 ? current.remaining_cost / current.quantity : 0
    current.cost_basis = current.remaining_cost
    current.estimated_value = current.quantity * current.latest_price
    current.unrealized_pnl = current.estimated_value - current.cost_basis

    holdings.set(symbol, current)
  }

  return Array.from(holdings.values())
    .map(({ remaining_cost: _remainingCost, ...holding }) => ({
      ...holding,
      quantity: round(holding.quantity),
      avg_cost: round(holding.avg_cost),
      latest_price: round(holding.latest_price),
      cost_basis: round(holding.cost_basis, 2),
      estimated_value: round(holding.estimated_value, 2),
      unrealized_pnl: round(holding.unrealized_pnl, 2),
      realized_pnl: round(holding.realized_pnl, 2),
      total_fees: round(holding.total_fees, 2),
      buy_qty: round(holding.buy_qty),
      sell_qty: round(holding.sell_qty),
    }))
    .sort((a, b) => b.estimated_value - a.estimated_value)
}

export function calculateSpotPortfolioStats(trades: Trade[]): SpotPortfolioStats {
  const spotTrades = getSpotTrades(trades)
  const holdings = calculateSpotHoldings(spotTrades)
  const openHoldings = holdings.filter(holding => holding.quantity > 0)

  return {
    holdings_count: openHoldings.length,
    spot_trades: spotTrades.length,
    buy_trades: spotTrades.filter(trade => trade.position_type === 'long').length,
    sell_trades: spotTrades.filter(trade => trade.position_type === 'short').length,
    total_cost_basis: round(openHoldings.reduce((sum, holding) => sum + holding.cost_basis, 0), 2),
    estimated_value: round(openHoldings.reduce((sum, holding) => sum + holding.estimated_value, 0), 2),
    unrealized_pnl: round(openHoldings.reduce((sum, holding) => sum + holding.unrealized_pnl, 0), 2),
    realized_pnl: round(holdings.reduce((sum, holding) => sum + holding.realized_pnl, 0), 2),
    total_fees: round(holdings.reduce((sum, holding) => sum + holding.total_fees, 0), 2),
  }
}
