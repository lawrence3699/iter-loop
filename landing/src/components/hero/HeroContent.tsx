import { OrangeButton } from '../ui/OrangeButton'
import { PartnerBadge } from '../ui/PartnerBadge'

/**
 * Hero copy block anchored to the bottom of the viewport: label, headline,
 * and the primary CTA row.
 */
export function HeroContent() {
  return (
    <div>
      <p className="mb-5 text-[13px] tracking-wide text-gray-900 sm:mb-8 sm:text-[14px]">
        Axion Studio
      </p>

      <h1 className="text-[clamp(1.75rem,7vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-gray-900 sm:text-[clamp(2.5rem,5vw,4.2rem)]">
        We craft digital experiences
        <span className="sm:hidden"> </span>
        <br className="hidden sm:block" />
        for brands ready to dominate
        <span className="sm:hidden"> </span>
        <br className="hidden sm:block" />
        their category online.
      </h1>

      <div className="mt-8 flex flex-col items-start gap-4 sm:mt-12 sm:flex-row sm:items-center sm:gap-5">
        <OrangeButton label="Start a project" />
        <PartnerBadge />
      </div>
    </div>
  )
}
