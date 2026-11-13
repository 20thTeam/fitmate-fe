// AI 코치 음성 안내 (브라우저 내장 음성, 새 패키지 없음).
// 여러 명이 한 공간에서 시연할 수 있어 기본은 꺼짐. 켜면 이 브라우저에 기억한다.
import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'fitmate.coachVoice'
/** 같은 문구는 이 시간 안에 다시 읽지 않는다 (실패한 동작마다 같은 말이 반복되지 않게) */
const REPEAT_MS = 8000

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function useCoachVoice() {
  const [isOn, setIsOn] = useState(() => canSpeak && readSaved())
  const lastSpoken = useRef({ text: '', at: 0 })

  useEffect(() => () => {
    if (canSpeak) window.speechSynthesis.cancel()
  }, [])

  const toggle = useCallback(() => {
    const next = !isOn
    setIsOn(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
    } catch {
      // 저장이 막혀도 이번 방문 동안은 켜고 끌 수 있다
    }
    if (!next && canSpeak) window.speechSynthesis.cancel()
  }, [isOn])

  /** 판정이 났을 때만 부른다 (매 프레임 아님) */
  const speak = useCallback((text: string) => {
    if (!isOn || !canSpeak || !text) return
    const now = Date.now()
    if (lastSpoken.current.text === text && now - lastSpoken.current.at < REPEAT_MS) return
    lastSpoken.current = { text, at: now }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.rate = 1.05
    // 앞 문구가 밀려 늦게 나오지 않게 끊고 최신 것만 읽는다
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }, [isOn])

  return { canSpeak, isOn, toggle, speak }
}
