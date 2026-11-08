// 3D 장면이 실패하면(WebGL 오류·배경 그림 로딩 실패) 2D 그림 장면으로 바꾼다.
// 에러 경계는 React에서 클래스로만 만들 수 있어서 함수 선언식 규칙의 예외다.
import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

export default class ThreeBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
