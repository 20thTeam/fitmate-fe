// localStorage 래퍼. 시크릿 창 등에서 막혀도 앱이 죽지 않게 메모리로 대체한다.

const memory = new Map<string, string>()

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key) ?? memory.get(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    const raw = memory.get(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value)
  memory.set(key, raw)
  try {
    localStorage.setItem(key, raw)
  } catch {
    /* 메모리에만 유지 */
  }
}

export const uid = () => crypto.randomUUID()
