// src/lib/importExport.ts
// CSV import and export utilities for TradeMind Journal

import type { Trade } from '@/types/trade';

const TRADE_ACCOUNT_VALUES = ['spot', 'futures', 'margin'];
const POSITION_VALUES = ['long', 'short'];
const RESULT_VALUES = ['win', 'loss', 'breakeven'];
const MARKET_VALUES = ['crypto', 'forex', 'saham', 'futures', 'other'];
const MODE_VALUES = ['manual', 'bot', 'copytrade', 'signal'];

export const CSV_HEADERS = [
  'symbol', 'market_type', 'trade_account_type', 'exchange', 'position_type', 'mode',
  'strategy_name', 'setup_type', 'timeframe',
  'entry_at', 'exit_at',
  'entry_price', 'exit_price',
  'position_size', 'leverage',
  'stop_loss', 'take_profit',
  'risk_amount', 'risk_percent',
  'fee', 'funding_fee',
  'gross_pnl', 'net_pnl', 'result', 'r_multiple',
  'market_condition', 'entry_reason', 'exit_reason',
  'mistake_notes', 'lesson_learned', 'tags',
  'bot_name', 'bot_version',
];

export const CSV_TEMPLATE_ROW = [
  'BTCUSDT', 'crypto', 'spot', 'Binance', 'long', 'manual',
  'Breakout', 'breakout', '4H',
  '2025-06-07 09:00', '2025-06-07 12:00',
  '67000', '68500',
  '0.05', '1',
  '66000', '69000',
  '50', '2',
  '12', '0',
  '75', '63', 'win', '1.26',
  'trending', 'EMA cross + volume spike', 'TP hit',
  '', '', '',
  '', '',
];

export function generateCsvTemplate(): string {
  const header = CSV_HEADERS.map(escapeCsvField).join(',');
  const example = CSV_TEMPLATE_ROW.map(escapeCsvField).join(',');
  return `${header}\n${example}`;
}

export function parseCsvToTrades(
  csvText: string,
  userId: string
): { trades: Partial<Trade>[]; errors: Array<{ row: number; message: string }> } {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { trades: [], errors: [{ row: 0, message: 'CSV file is empty or has no data rows' }] };
  }

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const trades: Partial<Trade>[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.every(value => !value.trim())) continue;

    try {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? ''; });

      const symbol = row.symbol.toUpperCase();
      const entryAt = parseDate(row.entry_at);
      const exitAt = row.exit_at ? parseDate(row.exit_at) : undefined;
      const entryPrice = parseRequiredNumber(row.entry_price, 'entry_price');
      const positionType = row.position_type.toLowerCase();
      const result = row.result.toLowerCase();
      const marketType = MARKET_VALUES.includes(row.market_type) ? row.market_type : 'crypto';
      const mode = MODE_VALUES.includes(row.mode) ? row.mode : 'manual';
      const tradeAccountType = TRADE_ACCOUNT_VALUES.includes(row.trade_account_type)
        ? row.trade_account_type
        : 'spot';

      if (!symbol) { errors.push({ row: i + 1, message: 'Missing required field: symbol' }); continue; }
      if (!row.entry_at) { errors.push({ row: i + 1, message: 'Missing required field: entry_at' }); continue; }
      if (!POSITION_VALUES.includes(positionType)) {
        errors.push({ row: i + 1, message: 'position_type must be "long" or "short"' }); continue;
      }
      if (result && !RESULT_VALUES.includes(result)) {
        errors.push({ row: i + 1, message: 'result must be "win", "loss", or "breakeven"' }); continue;
      }

      const trade: Partial<Trade> = {
        user_id: userId,
        symbol,
        market_type: marketType as Trade['market_type'],
        trade_account_type: tradeAccountType as Trade['trade_account_type'],
        exchange: row.exchange || undefined,
        position_type: positionType as Trade['position_type'],
        mode: mode as Trade['mode'],
        strategy_name: row.strategy_name || undefined,
        setup_type: (row.setup_type as Trade['setup_type']) || undefined,
        timeframe: (row.timeframe as Trade['timeframe']) || undefined,
        entry_at: entryAt,
        exit_at: exitAt,
        entry_price: entryPrice,
        exit_price: parseOptionalNumber(row.exit_price),
        position_size: parseOptionalNumber(row.position_size),
        leverage: parseOptionalNumber(row.leverage) ?? (tradeAccountType === 'spot' ? 1 : undefined),
        stop_loss: parseOptionalNumber(row.stop_loss),
        take_profit: parseOptionalNumber(row.take_profit),
        risk_amount: parseOptionalNumber(row.risk_amount),
        risk_percent: parseOptionalNumber(row.risk_percent),
        fee: parseOptionalNumber(row.fee) ?? 0,
        funding_fee: tradeAccountType === 'spot' ? 0 : parseOptionalNumber(row.funding_fee) ?? 0,
        gross_pnl: parseOptionalNumber(row.gross_pnl),
        net_pnl: parseOptionalNumber(row.net_pnl),
        result: result ? result as Trade['result'] : undefined,
        r_multiple: parseOptionalNumber(row.r_multiple),
        market_condition: (row.market_condition as Trade['market_condition']) || undefined,
        entry_reason: row.entry_reason || undefined,
        exit_reason: row.exit_reason || undefined,
        mistake_notes: row.mistake_notes || undefined,
        lesson_learned: row.lesson_learned || undefined,
        tags: row.tags ? row.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
        bot_name: row.bot_name || undefined,
        bot_version: row.bot_version || undefined,
      };

      trades.push(trade);
    } catch (err) {
      errors.push({ row: i + 1, message: `Parse error: ${(err as Error).message}` });
    }
  }

  return { trades, errors };
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function parseDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed.toISOString();
}

function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return parsed;
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function tradesToCsv(trades: Trade[]): string {
  const header = CSV_HEADERS.map(escapeCsvField).join(',');
  const rows = trades.map(t => {
    const values = [
      t.symbol, t.market_type, t.trade_account_type ?? 'spot', t.exchange ?? '', t.position_type, t.mode,
      t.strategy_name ?? '', t.setup_type ?? '', t.timeframe ?? '',
      t.entry_at, t.exit_at ?? '',
      t.entry_price, t.exit_price ?? '',
      t.position_size ?? '', t.leverage ?? '',
      t.stop_loss ?? '', t.take_profit ?? '',
      t.risk_amount ?? '', t.risk_percent ?? '',
      t.fee ?? 0, t.funding_fee ?? 0,
      t.gross_pnl ?? '', t.net_pnl ?? '', t.result ?? '', t.r_multiple ?? '',
      t.market_condition ?? '',
      t.entry_reason ?? '',
      t.exit_reason ?? '',
      t.mistake_notes ?? '',
      t.lesson_learned ?? '',
      (t.tags ?? []).join(';'),
      t.bot_name ?? '', t.bot_version ?? '',
    ];
    return values.map(value => escapeCsvField(String(value))).join(',');
  });
  return [header, ...rows].join('\n');
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadFile(content: string, filename: string, mimeType = 'text/csv'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
