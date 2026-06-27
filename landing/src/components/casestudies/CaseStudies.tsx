import { PROJECTS } from '../../data/site'
import { BadgeRow } from '../ui/BadgeRow'
import { ProjectCard } from './ProjectCard'

/**
 * Section 3 — featured client work on a light-gray field.
 */
export function CaseStudies() {
  return (
    <section className="bg-[#F5F5F5] pb-16 pt-16 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-28">
      <div className="mx-auto w-full max-w-[1440px]">
        <BadgeRow
          number="2"
          label="What's inside"
          borderClassName="border-gray-300"
          className="mb-6 px-5 sm:mb-8 sm:px-8 lg:px-12"
        />

        <h2 className="mb-10 px-5 text-[clamp(1.75rem,7vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-gray-900 sm:mb-14 sm:px-8 sm:text-[clamp(2.5rem,5vw,4.2rem)] lg:mb-16 lg:px-12">
          Built for the loop
        </h2>

        <div className="grid grid-cols-1 gap-5 px-5 sm:gap-6 sm:px-8 md:grid-cols-2 lg:gap-7 lg:px-12">
          {PROJECTS.map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </div>
      </div>
    </section>
  )
}
