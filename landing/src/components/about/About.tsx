import { ABOUT_IMAGES } from '../../data/site'
import { BadgeRow } from '../ui/BadgeRow'
import { OrangeButton } from '../ui/OrangeButton'

/**
 * Section 2 — studio introduction. Stacks paragraph/CTA over two images on
 * small screens; switches to a three-column image-flanked grid at lg.
 */
export function About() {
  return (
    <section className="overflow-hidden bg-white pb-12 pt-16 sm:pb-16 sm:pt-20 lg:pb-24 lg:pt-32">
      <div className="mx-auto w-full max-w-[1440px]">
        <BadgeRow
          number="1"
          label="Introducing Axion"
          borderClassName="border-gray-200"
          className="mb-6 px-5 sm:mb-8 sm:px-8 lg:px-12"
        />

        <h2 className="mb-12 px-5 text-[clamp(1.5rem,4vw,3.2rem)] font-medium leading-[1.12] tracking-[-0.02em] text-gray-900 sm:mb-16 sm:px-8 lg:mb-28 lg:px-12">
          Strategy-led creatives, delivering
          <br />
          results in digital and beyond.
        </h2>

        {/* Mobile / tablet: stacked */}
        <div className="px-5 sm:px-8 lg:hidden">
          <p className="text-[15px] font-medium leading-[1.6] text-gray-900 sm:text-[17px]">
            Through research, creative thinking and iteration we help growing
            brands realize their digital full potential.
          </p>
          <div className="mt-6">
            <OrangeButton label="About our studio" />
          </div>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-5">
            <img
              src={ABOUT_IMAGES.small.src}
              alt={ABOUT_IMAGES.small.alt}
              loading="lazy"
              className="aspect-[438/346] w-full rounded-xl object-cover sm:w-[45%] sm:rounded-2xl"
            />
            <img
              src={ABOUT_IMAGES.large.src}
              alt={ABOUT_IMAGES.large.alt}
              loading="lazy"
              className="aspect-[900/600] w-full rounded-xl object-cover sm:w-[55%] sm:rounded-2xl"
            />
          </div>
        </div>

        {/* Desktop: image · copy · image */}
        <div className="hidden grid-cols-[26%_1fr_48%] items-end gap-6 lg:grid lg:px-12 xl:gap-8">
          <div className="self-end">
            <img
              src={ABOUT_IMAGES.small.src}
              alt={ABOUT_IMAGES.small.alt}
              loading="lazy"
              className="aspect-[438/346] w-full rounded-2xl object-cover"
            />
          </div>

          <div className="flex justify-end self-start">
            <div>
              <p className="whitespace-nowrap text-[16px] font-medium leading-[1.65] text-gray-900 sm:text-[18px]">
                Through research, creative thinking
                <br />
                and iteration we help growing brands
                <br />
                realize their digital full potential.
              </p>
              <div className="mt-6">
                <OrangeButton label="About our studio" />
              </div>
            </div>
          </div>

          <div className="self-end">
            <img
              src={ABOUT_IMAGES.large.src}
              alt={ABOUT_IMAGES.large.alt}
              loading="lazy"
              className="aspect-[3/2] w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
