// AI 가이드 시범과 함께 보여줄 동작 안내 문구와 사진. 측정값이 아니라 고정 안내다.
// 운동 목록이 확정되면 같이 고친다.
import lungePhoto from '../assets/icons/lunge.png'
import stretchPhoto from '../assets/icons/thumb.png'

export const EXERCISE_GUIDE: Record<string, string> = {
  squat: '발을 어깨 너비로 벌리고, 무릎이 발끝을 넘지 않도록 앉았다 일어나세요.',
  hip_hinge: '허리를 곧게 편 채 엉덩이를 뒤로 빼며 상체를 숙였다 돌아오세요.',
  plank: '팔꿈치를 어깨 아래에 두고 머리부터 발끝까지 일직선을 유지하세요.',
  lunge: '한 발을 앞으로 내딛고 양 무릎이 90도가 되도록 내려가세요.',
  jumping_jack: '점프하며 발을 벌리고 양팔을 머리 위까지 올렸다 내리세요.',
  high_knees: '제자리에서 무릎을 허리 높이까지 번갈아 빠르게 올리세요.',
  aerobic_jumping_jack: '발을 어깨 너비로 벌리고 점프할 때 양팔을 머리 위까지 올려주세요. 무릎은 살짝 구부린 상태를 유지하세요.',
}

export const guideOf = (exerciseId: string) => EXERCISE_GUIDE[exerciseId] ?? '가이드 동작을 따라 해보세요.'

/** 시안에서 받은 동작 사진. 사진이 없는 운동은 null (화면에서 기본 그림을 보여준다). */
const EXERCISE_PHOTO: Record<string, string> = {
  lunge: lungePhoto,
}

export const photoOf = (exerciseId: string): string | null => EXERCISE_PHOTO[exerciseId] ?? null

/** 운동방 요약 바의 '오늘의 운동' 썸네일 (시안 이미지) */
export const ROUTINE_THUMB = stretchPhoto
