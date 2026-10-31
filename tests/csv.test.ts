// tests/csv.test.ts
// Kesejajaran header CSV dan baris contohnya. Tanpa tes ini, menambah
// satu kolom tanpa menambah contohnya akan menggeser SELURUH kolom di
// berkas template yang diunduh Bapak — dan pergeseran itu baru ketahuan
// setelah data salah masuk.

import { describe, it, expect } from 'vitest'
import { CSV_HEADERS, CSV_TEMPLATE_ROW } from '@/lib/importExport'

describe('template CSV', () => {
  it('jumlah kolom contoh sama dengan jumlah header', () => {
    expect(CSV_TEMPLATE_ROW).toHaveLength(CSV_HEADERS.length)
  })

  it('tidak ada nama header yang kembar', () => {
    expect(new Set(CSV_HEADERS).size).toBe(CSV_HEADERS.length)
  })

  it('kolom MAE/MFE ikut diekspor', () => {
    expect(CSV_HEADERS).toContain('mae_price')
    expect(CSV_HEADERS).toContain('mfe_price')
  })
})
