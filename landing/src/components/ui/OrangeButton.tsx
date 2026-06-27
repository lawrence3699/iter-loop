import { TextRollButton } from './TextRollButton'

interface OrangeButtonProps {
  label: string
  onClick?: () => void
}

/**
 * The brand-orange CTA used in the hero, the about section, and the mobile menu.
 */
export function OrangeButton({ label, onClick }: OrangeButtonProps) {
  return (
    <TextRollButton
      label={label}
      onClick={onClick}
      className="bg-[#F26522] py-2 pl-5 pr-2 text-[13px] text-white hover:bg-[#e05a1a] sm:pl-6 sm:text-[14px]"
      circleClassName="h-7 w-7 bg-white sm:h-8 sm:w-8"
      arrowClassName="text-[#F26522]"
      arrowSize={16}
    />
  )
}
