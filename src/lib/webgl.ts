// 3D 운동방을 그릴 수 있는 브라우저인지 한 번만 확인한다
let webglSupport: boolean | undefined

export function canUseWebGL() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement('canvas')
      webglSupport = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    } catch {
      webglSupport = false
    }
  }
  return webglSupport
}
