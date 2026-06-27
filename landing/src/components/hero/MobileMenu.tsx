import { Clock } from 'lucide-react'
import { NAV_LINKS, GITHUB_URL } from '../../data/site'
import { OrangeButton } from '../ui/OrangeButton'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
  time: string
}

/**
 * Full-screen mobile menu: dimmed backdrop + white bottom sheet that slides up.
 * Always mounted so the open/close transition can play in both directions.
 */
export function MobileMenu({ open, onClose, time }: MobileMenuProps) {
  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-500 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 mx-3 mb-3 rounded-2xl bg-white p-6 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[13px] text-gray-600">
          <Clock size={14} />
          <span>{time} local</span>
        </div>

        <nav className="mt-6 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              onClick={onClose}
              className="text-[28px] font-medium leading-[32px] text-gray-900"
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="mt-8">
          <OrangeButton
            label="Get started"
            onClick={() => {
              onClose()
              window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')
            }}
          />
        </div>
      </div>
    </div>
  )
}
