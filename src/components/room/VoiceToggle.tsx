// AI 코치 음성 켜기·끄기. 브라우저가 음성을 지원하지 않으면 그리지 않는다.
import type { useCoachVoice } from '../../hooks/useCoachVoice'

export default function VoiceToggle({ voice }: { voice: ReturnType<typeof useCoachVoice> }) {
  if (!voice.canSpeak) return null
  return (
    <button type="button" className={`voice-toggle ${voice.isOn ? 'is-on' : ''}`} aria-pressed={voice.isOn} onClick={voice.toggle}>
      <span aria-hidden>{voice.isOn ? '🔊' : '🔈'}</span>
      코치 음성 {voice.isOn ? '켜짐' : '꺼짐'}
    </button>
  )
}
