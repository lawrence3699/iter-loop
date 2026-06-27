import { OrangeButton } from '../ui/OrangeButton'
import { PartnerBadge } from '../ui/PartnerBadge'
import { GITHUB_URL } from '../../data/site'

/**
 * Hero copy block anchored to the bottom of the viewport: label, headline,
 * and the primary CTA row.
 */
export function HeroContent() {
  return (
    <div>
      <p className="mb-5 text-[13px] tracking-wide text-gray-900 sm:mb-8 sm:text-[14px]">
        iter-loop
      </p>

      <h1 className="text-[clamp(1.75rem,7vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-gray-900 sm:text-[clamp(2.5rem,5vw,4.2rem)]">
        One engine executes.
        <span className="sm:hidden"> </span>
        <br className="hidden sm:block" />
        Another reviews.
        <span className="sm:hidden"> </span>
        <br className="hidden sm:block" />
        Repeat until perfect.
      </h1>

      <div className="mt-8 flex flex-col items-start gap-4 sm:mt-12 sm:flex-row sm:items-center sm:gap-5">
        <OrangeButton
          label="Get started"
          onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}
        />
        <PartnerBadge />
      </div>
    </div>
  )
}
