import { ArrowRight } from 'lucide-react'

interface TextRollButtonProps {
  label: string
  onClick?: () => void
  type?: 'button' | 'submit'
  /** Shell utilities: background, hover background, text size, padding. */
  className?: string
  /** Arrow badge utilities: size + background. */
  circleClassName?: string
  /** Arrow glyph utilities: colour. */
  arrowClassName?: string
  /** lucide icon pixel size. */
  arrowSize?: number
}

const SMOOTH = 'duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]'

/**
 * Pill button with two signature hover effects:
 *  - the label "rolls" up to a duplicate copy (vertical text-roll)
 *  - the trailing arrow rotates -45deg inside its circular badge
 */
export function TextRollButton({
  label,
  onClick,
  type = 'button',
  className = '',
  circleClassName = '',
  arrowClassName = '',
  arrowSize = 16,
}: TextRollButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`group inline-flex items-center gap-3 rounded-full font-medium transition-colors duration-300 ${className}`}
    >
      <span className="relative flex h-[20px] flex-col overflow-hidden">
        <span
          className={`flex flex-col transition-transform ${SMOOTH} group-hover:-translate-y-1/2`}
        >
          <span className="flex h-[20px] items-center whitespace-nowrap">{label}</span>
          <span className="flex h-[20px] items-center whitespace-nowrap">{label}</span>
        </span>
      </span>
      <span
        className={`flex flex-shrink-0 items-center justify-center rounded-full ${circleClassName}`}
      >
        <ArrowRight
          size={arrowSize}
          className={`transition-transform ${SMOOTH} group-hover:-rotate-45 ${arrowClassName}`}
        />
      </span>
    </button>
  )
}
