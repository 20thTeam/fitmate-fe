// 3D 운동방 배치 값과, 3D 좌표 위에 DOM(스크린 내용·이름표)을 겹치는 계산.
// 스크린 내용은 3D 안이 아니라 같은 React 트리의 DOM이라, 3D가 다시 그려져도 내용이 다시 만들어지지 않는다.
import { Vector3, type Camera } from 'three'

// Figma 1:5: 스크린 아랫변이 무대 바닥에 거의 닿고, 가로:세로가 약 2:1
export const SCREEN_W = 8.8
export const SCREEN_H = 4.3
/** 스크린 가운데 위치. 카메라도 이 근처를 바라본다. */
export const SCREEN_CENTER: [number, number, number] = [0, 0.4 + SCREEN_H / 2, -2.6]
/** 스크린 왼쪽에서 AI 코치 시범 칸이 차지하는 비율. 오른쪽에는 동작 이름·설명 DOM이 온다 */
export const COACH_SCREEN_RATIO = 0.45
/** 스크린 안 DOM 크기(px). 실제 화면 크기는 카메라 위치에 따라 matrix3d로 늘이고 줄인다. */
export const SCREEN_PX_W = 640
export const SCREEN_PX_H = Math.round((SCREEN_PX_W * SCREEN_H) / SCREEN_W)
/** 스크린 판 앞면 z (틀 두께의 절반 + 조금) */
export const SCREEN_FACE_Z = SCREEN_CENTER[2] + 0.16

export const BODY_R = 0.72
/** 3D 모델 캐릭터 키. 원본은 1.9m라 무대·스크린 크기에 맞춰 줄인다 */
export const MODEL_H = 2.0
/**
 * 캐릭터 줄 위치. 스크린 아랫변과 하단 패널 사이에 보이게 둔다.
 * 대기 화면은 하단 패널이 얇아 앞쪽에, 운동 중에는 패널이 커서 스크린 바로 앞에 세운다.
 */
export const ROW_Z = { tour: 4.3, front: 0.6 } as const
/**
 * 하단 패널이 없는 운동 화면(공개 운동방)의 캐릭터 줄 위치. 앞으로 당겨 약 1.5배 크게 보여서 다리 움직임이 보인다 (#91).
 * 더 당기면 발이 화면 아래로 잘리고, 5명일 때 양 끝 캐릭터가 위쪽 패널에 가린다.
 */
export const ROW_Z_FRONT_OPEN = 4
const GAP = 2.2
/**
 * 이름표 높이. 대기 화면은 머리 위, 운동 중에는 카메라가 낮아 머리 위 이름표가
 * 스크린 아래 테두리에 겹쳐서 발밑에 단다 (#7).
 */
export const TAG_Y = { tour: MODEL_H + 0.12, front: -0.12 } as const

/** n명 중 i번째 캐릭터의 x 위치 (가운데 정렬) */
export const figureX = (i: number, n: number) => (i - (n - 1) / 2) * GAP

/** 스크린 네 모서리 (왼위 → 오른위 → 오른아래 → 왼아래) */
export const SCREEN_CORNERS = [
  new Vector3(SCREEN_CENTER[0] - SCREEN_W / 2, SCREEN_CENTER[1] + SCREEN_H / 2, SCREEN_FACE_Z),
  new Vector3(SCREEN_CENTER[0] + SCREEN_W / 2, SCREEN_CENTER[1] + SCREEN_H / 2, SCREEN_FACE_Z),
  new Vector3(SCREEN_CENTER[0] + SCREEN_W / 2, SCREEN_CENTER[1] - SCREEN_H / 2, SCREEN_FACE_Z),
  new Vector3(SCREEN_CENTER[0] - SCREEN_W / 2, SCREEN_CENTER[1] - SCREEN_H / 2, SCREEN_FACE_Z),
]

/** 월드 좌표 → 캔버스 px. 카메라 뒤면 false. out에 [x, y]를 쓴다. */
export function projectToPx(world: Vector3, camera: Camera, width: number, height: number, temp: Vector3, out: number[], offset = 0) {
  temp.copy(world).project(camera)
  out[offset] = ((temp.x + 1) / 2) * width
  out[offset + 1] = ((1 - temp.y) / 2) * height
  return temp.z < 1
}

/**
 * w×h 사각형을 네 점(quad: x0,y0,…,x3,y3)에 맞추는 CSS matrix3d (원근 변환).
 * transform-origin은 0 0 이어야 한다.
 */
export function quadToMatrix3d(quad: number[], w: number, h: number) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = quad
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = den === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / den
  const hh = den === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / den
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + hh * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + hh * y3
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`
}
