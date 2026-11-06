// 캐릭터 목록. 3D 모델이 준비되면 modelUrl을 추가한다. 외형은 디자인 협의 대상.
export const CHARACTERS = [
  { id: 'char-a', name: '캐릭터 A', color: '#ffc2dc' },
  { id: 'char-b', name: '캐릭터 B', color: '#d6ccff' },
  { id: 'char-c', name: '캐릭터 C', color: '#c8f0dc' },
] as const

export const characterColor = (id: string) =>
  CHARACTERS.find((c) => c.id === id)?.color ?? '#ddd'
