interface BadgeRowProps {
  number: string
  label: string
  /** Border colour utility for the pill, e.g. `border-gray-200`. */
  borderClassName?: string
  /** Positioning utilities (padding / margin) applied to the row wrapper. */
  className?: string
}

/**
 * Numbered circle + outlined pill label used to introduce a section.
 */
export function BadgeRow({
  number,
  label,
  borderClassName = 'border-gray-200',
  className = '',
}: BadgeRowProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white sm:h-7 sm:w-7 sm:text-[12px]">
        {number}
      </span>
      <span
        className={`rounded-full border ${borderClassName} px-3 py-1 text-[12px] font-medium text-gray-900 sm:px-4 sm:py-1.5 sm:text-[13px]`}
      >
        {label}
      </span>
    </div>
  )
}
