import { ArrowRight } from 'lucide-react'
import type { ProjectCardData } from '../../data/site'
import { LinkIcon } from '../ui/LinkIcon'

interface ProjectCardProps {
  project: ProjectCardData
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { videoSrc, frameClassName, description, title, hover } = project
  const isDark = hover.variant === 'dark'

  const iconColor = isDark ? 'text-white' : 'text-gray-900'
  const iconClass = `-rotate-45 transition-transform duration-300 group-hover:rotate-0 ${iconColor}`

  return (
    <div>
      <div
        className={`group relative cursor-pointer overflow-hidden rounded-2xl ${frameClassName}`}
      >
        <video
          className="h-full w-full object-cover"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Expanding hover pill */}
        <div
          className={`absolute bottom-4 left-4 flex h-9 w-9 items-center justify-end overflow-hidden rounded-full transition-all duration-300 ease-in-out ${
            isDark ? 'bg-gray-900' : 'bg-white'
          } ${hover.expandedWidthClass}`}
        >
          <span
            className={`whitespace-nowrap pl-4 text-[13px] font-medium opacity-0 transition-opacity delay-100 duration-300 group-hover:opacity-100 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {hover.label}
          </span>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
            {hover.icon === 'arrow' ? (
              <ArrowRight size={14} className={iconClass} />
            ) : (
              <LinkIcon className={`h-[14px] w-[14px] ${iconClass}`} />
            )}
          </span>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-gray-600 sm:text-[14px]">
        {description}
      </p>
      <h3 className="mt-1 text-[14px] font-semibold text-gray-900 sm:text-[15px]">
        {title}
      </h3>
    </div>
  )
}
