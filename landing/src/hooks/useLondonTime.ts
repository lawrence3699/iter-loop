import { useEffect, useState } from 'react'

const londonFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatLondonTime(): string {
  return londonFormatter.format(new Date())
}

/**
 * Live London wall-clock time as `HH:MM`, refreshed every second.
 */
export function useLondonTime(): string {
  const [time, setTime] = useState<string>(formatLondonTime)

  useEffect(() => {
    const id = window.setInterval(() => setTime(formatLondonTime()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return time
}
