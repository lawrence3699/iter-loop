import { Clock, Menu, X, RefreshCw } from 'lucide-react'
import { NAV_LINKS, AVAILABILITY_TEXT, GITHUB_URL } from '../../data/site'
import { TextRollButton } from '../ui/TextRollButton'

interface NavbarProps {
  time: string
  menuOpen: boolean
  onToggleMenu: () => void
}

export function Navbar({ time, menuOpen, onToggleMenu }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between rounded-full bg-white p-[5px]">
      {/* Left: logo + primary links */}
      <div className="flex items-center gap-6 pl-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 sm:h-10 sm:w-10">
          <RefreshCw
            className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]"
            strokeWidth={2.5}
          />
        </div>
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-[14px] text-gray-900 transition-colors duration-300 hover:text-gray-500"
            >
              {link}
            </a>
          ))}
        </div>
      </div>

      {/* Right: availability + clock + CTA (desktop) */}
      <div className="hidden items-center gap-4 md:flex">
        <span className="hidden text-[13px] text-gray-600 lg:block">
          {AVAILABILITY_TEXT}
        </span>
        <div className="flex items-center gap-1.5 text-[13px] text-gray-600">
          <Clock size={14} />
          <span>{time} local</span>
        </div>
        <TextRollButton
          label="View on GitHub"
          onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}
          className="bg-gray-900 py-2 pl-5 pr-2 text-[13px] text-white"
          circleClassName="h-6 w-6 bg-white"
          arrowClassName="text-gray-900"
          arrowSize={14}
        />
      </div>

      {/* Mobile toggle */}
      <button
        type="button"
        onClick={onToggleMenu}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white md:hidden"
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
    </nav>
  )
}
