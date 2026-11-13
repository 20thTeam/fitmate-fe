// 팀 백엔드 호출 도우미. 응답은 { resultCode, msg, data } 형식이다.
// 응답이 늦으면 끊고 오류로 돌려서 화면이 대비 흐름(재시도·규칙 기반 추천)으로 넘어가게 한다.

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** 기본 응답 대기 시간. 넘기면 'timeout' 오류 */
const DEFAULT_TIMEOUT_MS = 8000

export const hasApiUrl = BASE_URL !== ''

/** 운동방 실시간 연결 주소. 따로 없으면 API 주소의 /ws (https → wss) */
export const WS_URL = import.meta.env.VITE_WS_URL || (hasApiUrl ? `${BASE_URL.replace(/^http/, 'ws')}/ws` : '')

export type ApiErrorKind = 'timeout' | 'network' | 'http'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  /** 서버 resultCode (예: '409-1'). 응답 본문이 없으면 '' */
  readonly code: string

  constructor(kind: ApiErrorKind, message: string, status = 0, code = '') {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
  }
}

interface RsData<T> {
  resultCode: string
  msg: string
  data: T
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  token?: string | null
  /** 운영 API(/api/admin/*) 키 */
  adminKey?: string
  timeoutMs?: number
}

function isRsData(v: unknown): v is RsData<unknown> {
  return typeof v === 'object' && v !== null && 'resultCode' in v
}

export async function request<T>(path: string, { method = 'GET', body, token, adminKey, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['X-Participant-Token'] = token
  if (adminKey) headers['X-Admin-Key'] = adminKey

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    const isTimeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
    throw new ApiError(isTimeout ? 'timeout' : 'network', isTimeout ? '서버 응답이 늦어요' : '서버에 연결할 수 없어요')
  }

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const code = isRsData(json) ? json.resultCode : ''
    const msg = isRsData(json) ? json.msg : `요청 실패 (${res.status})`
    throw new ApiError('http', msg, res.status, code)
  }
  if (!isRsData(json)) throw new ApiError('http', '응답 형식이 올바르지 않아요', res.status)
  return json.data as T
}
