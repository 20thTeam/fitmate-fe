// 잠깐 떴다 사라지는 안내 문구 하나
import { useEffect, useRef, useState } from 'react'

const TOAST_MS = 2500

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const show = (text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), TOAST_MS)
  }

  return { message, show }
}
