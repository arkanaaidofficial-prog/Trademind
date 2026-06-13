'use client'

import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  tone?: 'danger' | 'primary'
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  loading = false,
  tone = 'danger',
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-500/60'
    : 'bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-500/60'

  function handleOpenChange(nextOpen: boolean) {
    if (!loading) onOpenChange(nextOpen)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70" />
        <Dialog.Content
          onEscapeKeyDown={event => { if (loading) event.preventDefault() }}
          onPointerDownOutside={event => { if (loading) event.preventDefault() }}
          className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#2a2a3a] bg-[#14141e] p-5 shadow-2xl shadow-black/50 focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.6 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold text-white">{title}</Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-1.5 text-sm leading-relaxed text-gray-400">{description}</div>
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#2a2a3a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void onConfirm()}
              className={`inline-flex min-w-[96px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              )}
              {loading ? 'Memproses...' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
