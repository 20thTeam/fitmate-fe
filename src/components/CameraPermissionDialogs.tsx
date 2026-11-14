// 카메라 권한 안내 창 (F-ZGIFAX). 카메라 없이는 운동을 셀 수 없어서
//  - 처음: 왜 필요한지, 브라우저 창에서 '허용'을 누르라고 미리 알려 준다
//  - 차단됨: 브라우저별로 다시 허용하는 순서를 보여 준다
import { useState } from 'react'
import { Modal } from './ui'

// isCounting: 횟수를 세는 방인지. 공개 운동방은 캐릭터를 움직이는 데만 카메라를 쓴다 (#87)
export function CameraIntroDialog({ onAllow, onLater, isCounting = true }: { onAllow: () => void; onLater: () => void; isCounting?: boolean }) {
  return (
    <Modal label="카메라 사용 안내">
      <h2 className="sheet-title">카메라를 허용해 주세요</h2>
      <p className="sheet-sub" style={{ lineHeight: 1.5 }}>
        FITMATE는 카메라로 자세를 인식해서<br />{isCounting ? '제대로 한 동작만 횟수로 세요.' : '내 캐릭터가 똑같이 움직이게 해요.'}
      </p>

      {/* 브라우저 권한 창 모양: 어디를 눌러야 하는지 보여 준다 */}
      <div className="permission-mock" aria-hidden>
        <span className="permission-mock-title">{location.host}에서 다음 권한을 요청합니다</span>
        <span className="permission-mock-row">📷 카메라 사용</span>
        <div className="permission-mock-actions">
          <span className="permission-mock-btn">차단</span>
          <span className="permission-mock-btn is-allow">허용</span>
        </div>
      </div>

      <ul className="sheet-points">
        <li>다음에 브라우저가 카메라 사용을 물어보면 <strong>'허용'</strong>을 눌러 주세요.</li>
        <li>영상은 내 브라우저 안에서만 분석하고 저장하거나 보내지 않아요. 친구에게는 관절 위치만 전달돼요.</li>
      </ul>

      <div className="sheet-actions">
        <button className="btn btn-sheet" onClick={onLater}>나중에 하기</button>
        <button className="btn btn-sheet-primary" onClick={onAllow}>카메라 허용하기</button>
      </div>
    </Modal>
  )
}

type Browser = 'chrome' | 'safari' | 'firefox'

const BROWSER_LABEL: Record<Browser, string> = { chrome: 'Chrome · Edge', safari: 'Safari', firefox: 'Firefox' }

const BROWSER_STEPS: Record<Browser, string[]> = {
  chrome: [
    '주소창 왼쪽의 사이트 정보 아이콘을 눌러요.',
    "'카메라'를 '허용'으로 바꿔요.",
    "아래 '다시 시도'를 눌러요. 그래도 안 되면 새로고침해 주세요.",
  ],
  safari: [
    "화면 위 메뉴에서 Safari → 설정 → '웹사이트' 탭을 열어요.",
    `왼쪽 '카메라'를 누르고 ${location.host}을(를) '허용'으로 바꿔요.`,
    "아래 '다시 시도'를 눌러요.",
  ],
  firefox: [
    '주소창 왼쪽의 카메라(권한) 아이콘을 눌러요.',
    "'차단됨' 옆의 X를 눌러 차단을 풀어요.",
    "아래 '다시 시도'를 누르고, 다시 물어보면 '허용'을 눌러요.",
  ],
}

function detectBrowser(): Browser {
  const ua = navigator.userAgent
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'safari'
  return 'chrome'
}

export function CameraBlockedDialog({ onRetry, onBack, onClose, isCounting = true }: { onRetry: () => void; onBack: () => void; onClose: () => void; isCounting?: boolean }) {
  const [browser, setBrowser] = useState<Browser>(detectBrowser)
  return (
    <Modal onClose={onClose} label="카메라 권한 허용 방법">
      <h2 className="sheet-title">카메라가 차단되어 있어요</h2>
      <p className="sheet-sub" style={{ lineHeight: 1.5 }}>{isCounting ? '카메라를 허용해야 운동 횟수를 셀 수 있어요.' : '카메라를 허용해야 내 캐릭터가 따라 움직여요.'}<br />아래 순서대로 허용해 주세요.</p>

      <div className="seg" role="tablist" aria-label="브라우저 선택">
        {(Object.keys(BROWSER_LABEL) as Browser[]).map((b) => (
          <button key={b} role="tab" aria-selected={browser === b} className={`seg-item ${browser === b ? 'is-active' : ''}`} onClick={() => setBrowser(b)}>
            {BROWSER_LABEL[b]}
          </button>
        ))}
      </div>

      <ol className="sheet-steps">
        {BROWSER_STEPS[browser].map((step) => <li key={step}>{step}</li>)}
      </ol>

      <p className="sheet-sub" style={{ fontSize: 13, lineHeight: 1.5 }}>
        그래도 안 되면 컴퓨터 설정에서 브라우저의 카메라 사용을 켜 주세요.<br />
        Mac: 시스템 설정 → 개인정보 보호 및 보안 → 카메라<br />
        Windows: 설정 → 개인 정보 → 카메라
      </p>

      <div className="sheet-actions">
        <button className="btn btn-sheet" onClick={onBack}>운동방으로 돌아가기</button>
        <button className="btn btn-sheet-primary" onClick={onRetry}>다시 시도</button>
      </div>
    </Modal>
  )
}
