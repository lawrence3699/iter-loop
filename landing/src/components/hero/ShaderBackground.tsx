import { Shader, Swirl, ChromaFlow, FlutedGlass, FilmGrain } from 'shaders/react'

const FILL: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
}

/**
 * Animated hero backdrop. The shader nodes nest as a filter chain:
 * Swirl (base texture) → ChromaFlow (orange liquid flow) → FlutedGlass
 * (glass refraction) → FilmGrain (grain), so each effect post-processes the
 * one it wraps.
 */
export function ShaderBackground() {
  return (
    <Shader style={FILL}>
      <FilmGrain strength={0.05}>
        <FlutedGlass
          aberration={0.61}
          angle={31}
          frequency={8}
          highlight={0.12}
          highlightSoftness={0}
          lightAngle={-90}
          refraction={4}
          shape="rounded"
          softness={1}
          speed={0.15}
        >
          <ChromaFlow
            baseColor="#ffffff"
            downColor="#ff5f03"
            leftColor="#ff5f03"
            rightColor="#ff5f03"
            upColor="#ff5f03"
            momentum={13}
            radius={3.5}
          >
            <Swirl colorA="#ffffff" colorB="#f0f0f0" detail={1.7} />
          </ChromaFlow>
        </FlutedGlass>
      </FilmGrain>
    </Shader>
  )
}
