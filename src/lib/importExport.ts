// src/lib/importExport.ts
// CSV import and export utilities for TradeMind Journal

import type { Trade } from '@/types/trade';

// ─── CSV TEMPLATE HEADERS ─────────────────────────────────────
export const CSV_HEADERS = [
  'symbol', 'market_type', 'exchange', 'position_type', 'mode',
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
  'BTCUSDT', 'crypto', 'Binance', 'long', 'manual',
  'Breakout', 'breakout', '4H',
  '2025-06-07 09:00', '2025-06-07 12:00',
  '67000', '68500',
  '0.05', '5',
  '66000', '69000',
  '50', '2',
  '12', '0',
  '75', '63', 'win', '1.26',
  'trending', 'EMA cross + volume spike', 'TP hit',
  '', '', '',
  '', '',
];

/**
 * Generate a blank CSV template string for download
 */
export function generateCsvTemplate(): string {
  const header = CSV_HEADERS.join(',');
  const example = CSV_TEMPLATE_ROW.map(v => `"${v}"`).join(',');
  return `${header}\n${example}`;
}

/**
 * Parse CSV rows into Trade objects
 * Returns { trades, errors }
 */
export function parseCsvToTrades(
  csvText: string,
  userId: string
): { trades: Partial<Trade>[]; errors: Array<{ row: number; message: string }> } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { trades: [], errors: [{ row: 0, message: 'CSV file is empty or has no data rows' }] };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const trades: Partial<Trade>[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    try {
      const values = parseCsvLine(rawLine);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? ''; });

      // Required fields
      if (!row.symbol) { errors.push({ row: i + 1, message: 'Missing required field: symbol' }); continue; }
      if (!row.entry_at) { errors.push({ row: i + 1, message: 'Missing required field: entry_at' }); continue; }
      if (!row.entry_price || isNaN(+row.entry_price)) { errors.push({ row: i + 1, message: 'Invalid entry_price' }); continue; }
      if (!row.position_type || !['long','short'].includes(row.position_type)) {
        errors.push({ row: i + 1, message: 'position_type must be "long" or "short"' }); continue;
      }

      const trade: Partial<Trade> = {
        user_id: userId,
        symbol: row.symbol.toUpperCase(),
        market_type: (row.market_type as Trade['market_type']) || 'crypto',
        exchange: row.exchange || undefined,
        position_type: row.position_type as Trade['position_type'],
        mode: (row.mode as Trade['mode']) || 'manual',
        strategy_name: row.strategy_name || undefined,
        setup_type: (row.setup_type as Trade['setup_type']) || undefined,
        timeframe: (row.timeframe as Trade['timeframe']) || undefined,
        entry_at: new Date(row.entry_at).toISOString(),
        exit_at: row.exit_at ? new Date(row.exit_at).toISOString() : undefined,
        entry_price: +row.entry_price,
        exit_price: row.exit_price ? +row.exit_price : undefined,
        position_size: row.position_size ? +row.position_size : undefined,
        leverage: row.leverage ? +row.leverage : 1,
        stop_loss: row.stop_loss ? +row.stop_loss : undefined,
        take_profit: row.take_profit ? +row.take_profit : undefined,
        risk_amount: row.risk_amount ? +row.risk_amount : undefined,
        risk_percent: row.risk_percent ? +row.risk_percent : undefined,
        fee: row.fee ? +row.fee : 0,
        funding_fee: row.funding_fee ? +row.funding_fee : 0,
        gross_pnl: row.gross_pnl ? +row.gross_pnl : undefined,
        net_pnl: row.net_pnl ? +row.net_pnl : undefined,
        result: (row.result as Trade['result']) || undefined,
        r_multiple: row.r_multiple ? +row.r_multiple : undefined,
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

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Export trades array to CSV string
 */
export function tradesToCsv(trades: Trade[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = trades.map(t => {
    const values = [
      t.symbol, t.market_type, t.exchange ?? '', t.position_type, t.mode,
      t.strategy_name ?? '', t.setup_type ?? '', t.timeframe ?? '',
      t.entry_at, t.exit_at ?? '',
      t.entry_price, t.exit_price ?? '',
      t.position_size ?? '', t.leverage ?? '',
      t.stop_loss ?? '', t.take_profit ?? '',
      t.risk_amount ?? '', t.risk_percent ?? '',
      t.fee ?? 0, t.funding_fee ?? 0,
      t.gross_pnl ?? '', t.net_pnl ?? '', t.result ?? '', t.r_multiple ?? '',
      t.market_condition ?? '',
      escapeCsvField(t.entry_reason ?? ''),
      escapeCsvField(t.exit_reason ?? ''),
      escapeCsvField(t.mistake_notes ?? ''),
      escapeCsvField(t.lesson_learned ?? ''),
      (t.tags ?? []).join(';'),
      t.bot_name ?? '', t.bot_version ?? '',
    ];
    return values.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(',');
  });
  return [header, ...rows].join('\n');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger browser download of text content as a file
 */
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
