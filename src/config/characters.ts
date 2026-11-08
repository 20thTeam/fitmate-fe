// 캐릭터 목록 (Figma 프로필 설정 시안: 원형 4종). 3D 모델이 준비되면 modelUrl을 추가한다.
import pink from '../assets/char/c1.svg'
import yellow from '../assets/char/c2.svg'
import green from '../assets/char/c3.svg'
import blue from '../assets/char/c4.svg'

export interface Character {
  id: string
  name: string
  image: string
  /** 친구 목록 네모 아바타에 쓰는 위→아래 그라데이션 */
  gradient: [string, string]
}

export const CHARACTERS: Character[] = [
  { id: 'char-1', name: '핑크', image: pink, gradient: ['#F1E4E9', '#EA5790'] },
  { id: 'char-2', name: '옐로', image: yellow, gradient: ['#FFFBDD', '#FFF07C'] },
  { id: 'char-3', name: '블루', image: blue, gradient: ['#BCC6FF', '#4A40FF'] },
  { id: 'char-4', name: '그린', image: green, gradient: ['#B2EF93', '#63CD2E'] },
]

const FALLBACK = CHARACTERS[0]

export const characterOf = (id: string) => CHARACTERS.find((c) => c.id === id) ?? FALLBACK

export const characterGradient = (id: string) => {
  const [from, to] = characterOf(id).gradient
  return `linear-gradient(180deg, ${from}, ${to})`
}
