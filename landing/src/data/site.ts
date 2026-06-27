// Static content for the Axion Studio landing page.
// Kept as data so copy and asset URLs live in one place, not scattered in JSX.

export const NAV_LINKS = ['Projects', 'Studio', 'Journal', 'Connect'] as const

export const AVAILABILITY_TEXT = 'Taking on projects for Q1 2026'

export interface ImageAsset {
  readonly src: string
  readonly alt: string
}

export const ABOUT_IMAGES: { readonly small: ImageAsset; readonly large: ImageAsset } = {
  small: {
    src: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090123_74be96d4-9c1b-40cf-932a-96f4f4babed3.png&w=1280&q=85',
    alt: 'Axion Studio creative direction still',
  },
  large: {
    src: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090133_c157d30b-a99a-4477-bec1-a446149ec3f2.png&w=1280&q=85',
    alt: 'Axion Studio brand experience still',
  },
}

export type ProjectIcon = 'link' | 'arrow'

export interface ProjectCardData {
  readonly title: string
  readonly description: string
  readonly videoSrc: string
  /** Tailwind classes controlling the media frame aspect ratio + placeholder background. */
  readonly frameClassName: string
  readonly hover: {
    readonly variant: 'light' | 'dark'
    readonly label: string
    /** Literal Tailwind class so the JIT scanner can see the expanded width. */
    readonly expandedWidthClass: string
    readonly icon: ProjectIcon
  }
}

export const PROJECTS: readonly ProjectCardData[] = [
  {
    title: 'Narrativ',
    description:
      'Winner of Site of the Month 2025 — an interactive 3D showcase driving record engagement',
    videoSrc:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260516_122702_390f5305-8719-41d5-ae80-d23ab3796c28.mp4',
    frameClassName: 'aspect-[329/246] bg-[#1a1d2e]',
    hover: {
      variant: 'light',
      label: 'Learn more',
      expandedWidthClass: 'group-hover:w-[148px]',
      icon: 'link',
    },
  },
  {
    title: 'Luminar',
    description:
      'Transforming a dated platform into a conversion-focused brand experience',
    videoSrc:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260516_123323_f909c2b8-ff6c-4edf-882b-8ebcdbe389b5.mp4',
    frameClassName: 'aspect-square bg-[#6b6b6b]',
    hover: {
      variant: 'dark',
      label: 'View case study',
      expandedWidthClass: 'group-hover:w-[168px]',
      icon: 'arrow',
    },
  },
]
