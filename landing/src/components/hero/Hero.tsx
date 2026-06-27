import { useState } from 'react'
import { useLocalTime } from '../../hooks/useLocalTime'
import { ShaderBackground } from './ShaderBackground'
import { Navbar } from './Navbar'
import { MobileMenu } from './MobileMenu'
import { HeroContent } from './HeroContent'

/**
 * Section 1 — full-viewport hero: animated shader backdrop, pill navbar, and
 * bottom-anchored headline / CTA.
 */
export function Hero() {
  const [menuOpen, setMenuOpen] = useState(false)
  const time = useLocalTime()

  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#EFEFEF]">
      {/* Animated shader overlay */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <ShaderBackground />
      </div>

      {/* Navigation */}
      <header className="relative z-20 mx-auto w-full max-w-[1440px] p-2 sm:p-3">
        <Navbar
          time={time}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((prev) => !prev)}
        />
      </header>

      {/* Bottom-anchored hero content (flex-1 spacer pushes it down) */}
      <div className="relative z-20 flex flex-1 flex-col justify-end">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-14 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
          <HeroContent />
        </div>
      </div>

      {/* Mobile menu overlay */}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} time={time} />
    </section>
  )
}
