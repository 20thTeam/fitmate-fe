// 캐릭터 목록 (Figma 프로필 설정 시안: 원형 4종).
// 3D 모델은 옷 색이 가까운 캐릭터에 임시로 붙였다. 프로필 화면 그림이 3D 캐릭터로 바뀌면 다시 맞춘다.
// 모델을 불러오지 못하면 운동방에서 공 모양으로 나온다.
import pink from '../assets/char/c1.svg'
import yellow from '../assets/char/c2.svg'
import green from '../assets/char/c3.svg'
import blue from '../assets/char/c4.svg'
// Mixamo 뼈대가 들어간 GLB (FBX를 Blender로 변환, 텍스처 1024px)
import boy1Model from '../assets/characters/boy1.glb?url'
import boy2Model from '../assets/characters/boy2.glb?url'
import girl1Model from '../assets/characters/girl1.glb?url'
import girl2Model from '../assets/characters/girl2.glb?url'

export interface Character {
  id: string
  name: string
  image: string
  /** 친구 목록 네모 아바타에 쓰는 위→아래 그라데이션 */
  gradient: [string, string]
  /** 운동방 3D 모델. 없으면 공 모양으로 세운다 */
  modelUrl?: string
}

export const CHARACTERS: Character[] = [
  { id: 'char-1', name: '핑크', image: pink, gradient: ['#F1E4E9', '#EA5790'], modelUrl: girl2Model },
  { id: 'char-2', name: '옐로', image: yellow, gradient: ['#FFFBDD', '#FFF07C'], modelUrl: girl1Model },
  { id: 'char-3', name: '블루', image: blue, gradient: ['#BCC6FF', '#4A40FF'], modelUrl: boy1Model },
  { id: 'char-4', name: '그린', image: green, gradient: ['#B2EF93', '#63CD2E'], modelUrl: boy2Model },
]

const FALLBACK = CHARACTERS[0]

export const characterOf = (id: string) => CHARACTERS.find((c) => c.id === id) ?? FALLBACK

export const characterGradient = (id: string) => {
  const [from, to] = characterOf(id).gradient
  return `linear-gradient(180deg, ${from}, ${to})`
}
