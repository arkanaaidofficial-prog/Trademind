import type { Violation } from '@/hooks/useRuleViolations'

export default function RuleViolationBanner({ violations }: { violations: Violation[] }) {
  if (!violations.length) return null

  const errors   = violations.filter(v => v.severity === 'error')
  const warnings = violations.filter(v => v.severity === 'warning')

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-red-400 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-red-400 text-xs font-semibold">Pelanggaran Rules ({errors.length})</p>
          </div>
          <ul className="space-y-1">
            {errors.map((v, i) => (
              <li key={i} className="text-red-300 text-xs flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-amber-400 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-amber-400 text-xs font-semibold">Peringatan ({warnings.length})</p>
          </div>
          <ul className="space-y-1">
            {warnings.map((v, i) => (
              <li key={i} className="text-amber-300 text-xs flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
