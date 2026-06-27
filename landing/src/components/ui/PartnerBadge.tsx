import { StarburstIcon } from './StarburstIcon'

/**
 * White "Open source / MIT" credential pill shown beside the hero CTA.
 */
export function PartnerBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-[4px] bg-white px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] sm:gap-3 sm:px-4 sm:py-2.5">
      <StarburstIcon className="h-5 w-5 fill-current text-[#E8704E] sm:h-6 sm:w-6" />
      <span className="text-[13px] font-medium text-gray-900 sm:text-[14px]">
        Open source
      </span>
      <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white sm:px-2 sm:text-[11px]">
        MIT
      </span>
    </div>
  )
}
