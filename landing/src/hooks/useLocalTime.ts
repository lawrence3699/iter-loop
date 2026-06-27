import { useEffect, useState } from 'react'

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatNow(): string {
  return clockFormatter.format(new Date())
}

/**
 * Live local wall-clock time as `HH:MM`, refreshed every second — a small nod
 * to iter-loop running entirely on your machine.
 */
export function useLocalTime(): string {
  const [time, setTime] = useState<string>(formatNow)

  useEffect(() => {
    const id = window.setInterval(() => setTime(formatNow()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return time
}
