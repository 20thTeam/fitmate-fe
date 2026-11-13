# FITMATE (프론트엔드)

2026 멋쟁이사자처럼 1호선톤 출품작. 친구 2~5명이 같은 3D 운동방에서 각자 운동하는 AI 소셜 홈트 데스크톱 웹 MVP.
기획 원본: manyfast 프로젝트 "이 자료로 시작" (PRD · 기능 22개 · 정책 6개 · 유저플로우 v5).

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

배포: Vercel (SPA 새로고침 대응은 `vercel.json`).

## 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | Vite + React + TypeScript | 카메라·3D가 전부 클라이언트라 SPA가 단순함 |
| 라우팅 | react-router-dom | |
| 상태 | zustand | 화면 간 공유 상태만 둔다 |
| 3D | three + @react-three/fiber + drei | 캐릭터 · 운동 공간 |
| 포즈 인식 | @mediapipe/tasks-vision (Pose Landmarker) | 브라우저 안에서 분석 → 영상 서버 전송 없음 (PL-XJUIRF 권장안) |

## 구조

```
src/
  types/domain.ts        도메인 타입 (manyfast dataSpec 기준) ← 백엔드와 공유할 계약
  services/
    ports.ts             프론트가 기대하는 백엔드 인터페이스
    index.ts             구현 선택 (VITE_BACKEND=local | http)
    local/               백엔드 없이 동작하는 구현 (localStorage + BroadcastChannel)
  lib/recommend.ts       규칙 기반 추천 (로컬 폴백)
  config/provisional.ts  ⚠️ PM 미승인 임시값 모음 (운동 목록, 난도 규칙 등)
  hooks/
    useCamera.ts         카메라 권한·스트림·장치 선택
    useRoom.ts           실시간 운동방 입장·참가자·응원
    useWorkout.ts        내 운동 진행 (세트·유효 횟수·일시정지 제외 시간)
    usePose.ts           카메라 영상에서 관절 인식 (MediaPipe, 브라우저 안에서만)
    useRepCounting.ts    관절 → 운동별 판정 → 유효 횟수·자세 피드백 반영
  lib/pose/              관절 각도 계산과 운동별 1회 인정 판정 (기준값은 config/provisional.ts)
  components/            ui(공통 조각), Backdrop(배경), CameraCheck, EnterLoading, GoalIcon
    room/                운동방 조각: Scene(3D 무대+패널, 실패 시 2D 그림), ModeTabs, ParticipantPanel, RoutinePanels,
                         SummaryBar, GuideScreen, CharacterFloor, WorkoutHud, ProgressRing, InviteModal
    three/               3D 운동방: Room3D(캔버스·카메라), Environment(무대·스크린·나무), Characters3D, layout(스크린 DOM 겹치기)
  styles/                디자인 시스템: tokens.css(색·모양 값, friend/public 테마), base.css, components.css
  assets/                Figma 시안에서 받은 배경·아이콘·캐릭터 그림
  pages/                 화면 (유저플로우 v5 순서)
  store/app.ts           클라이언트 상태
```

## 화면 ↔ 기능 매핑

디자인 기준은 Figma `1호선톤` 파일(1440×1024)이에요. 친구 화면은 `friend` 테마(선셋·보라), 공개 운동방과 그 결과는 `public` 테마(바다·파랑)예요.

| 경로 | 화면 | 기능 ID |
|---|---|---|
| `/` | 랜딩 | F-SNDWGO |
| `/profile` | 닉네임·캐릭터 | F-MZLVEJ |
| `/home` | 홈 | F-HIPEHA |
| `/goal` | 목표 선택 + 추천 로딩 | F-FTENXM, F-UZFEMP |
| `/routine/:id` | (예전 주소) `/room/:id`로 이동 | — |
| `/room/:routineId` | 친구 운동방 입장 대기(루틴 확인·친구 초대) → 카메라 확인 → 입장 로딩 → 운동 진행 → 휴식 | F-WBCAEC, F-STRTHT, F-ERSUOK, F-WJAOCO, F-WGMOYG, F-ZGIFAX, F-XNIIJM, F-WLBEFJ, F-EUQUBE, F-JENTLD, F-HEIEZC, F-SZCKIV |
| `/result/:sessionId` | 운동 완료 + 다음 회차 추천(이전 회차 비교) | F-XXCKUD, F-SYGFQC, F-WBCAEC, F-WFAMYP |
| `/history` | 성장 기록 | F-YBENHN |
| `/sunset` | 공개 운동방(선셋 에어로빅) 입장 대기 → 카메라 확인 → 운동 진행 (`?sunset=open`으로 개발 중 오픈 상태 확인) | F-DXORMB (P1) |
| `/admin` | 운영 화면: 서버 연결·운동방·팀 경험치·이 브라우저 참가자 확인, 이 브라우저 데이터 지우기. 메뉴에 링크가 없고 `VITE_ADMIN_PASSWORD` 암호로 열어요. 전체 참가자·전체 기록은 BE API 준비 중 | — (manyfast 기획에 없는 화면) |
| `/univ-contest` | 학교 대항 스쿼트 20초 챌린지: 학교별 누적·한 판 최고 기록 현황 → 이름·학교 선택 → 판 대기(최대 4명, 누구나 시작) → 5초 카운트다운 후 20초 스쿼트 → 이번 판 1등. 노트북 1대에 1명. 누구나 열 수 있고 메뉴 링크는 없어요. 학교 목록은 `provisional.ts` 임시값, 서버 챌린지 API가 없으면 이 브라우저에만 저장돼요 | — (manyfast 기획에 없는 시연 당일 이벤트) |

## 백엔드 연동 가이드

화면 코드는 `services`만 호출한다. 백엔드가 준비되면 `services/http/`에 `Services`(ports.ts)를
구현하고 `services/index.ts`에서 `VITE_BACKEND=http`일 때 연결하면 끝.

필요한 API (ports.ts 기준):

| 서비스 | 메서드 | 제안 엔드포인트 |
|---|---|---|
| profile | create | `POST /users` → Profile |
| routine | recommendFirst | `POST /routines { userId, goal }` |
| routine | recommendNext | `POST /routines/next { sessionId }` (같은 세션은 같은 결과) |
| routine | get | `GET /routines/:id` |
| record | saveSession | `POST /sessions` (sessionId로 중복 저장 방지) |
| record | getSession / listSessions | `GET /sessions/:id`, `GET /users/:id/sessions` |
| team | applySession / get | `POST /teams/:roomId/apply`, `GET /teams/:roomId` |
| realtime | join(roomId, me, { maxParticipants, initial }) | WebSocket `/ws?room=` (친구 파티 5명 제한, 선셋은 제한 없음) |

실시간 메시지(JSON): `hello | state {Participant}`, `bye {userId}`, `pose {PoseFrame}`, `cheer {CheerEvent}`.
서버는 같은 방에 브로드캐스트하고, `cheer`는 `toUserId`에게만 전달, 방 인원 5명 초과 시 거절.

> 로컬 구현의 실시간은 **같은 브라우저 탭끼리만** 연결된다. 서로 다른 PC 시연에는 WebSocket 서버가 필요하다.

## 지켜야 할 원칙 (manyfast 정책)

- 측정하지 않은 값·예시 숫자를 실제 기록처럼 보여주지 않는다. 팀 경험치는 산식 확정 전까지 "산정 기준 준비 중".
- 미정 사항은 `config/provisional.ts`에만 두고, 화면에 "시연용 임시" 표시를 한다.
- 카메라 영상은 브라우저 밖으로 보내지 않는다. 친구에게는 관절 좌표만 보낸다.
- `[개발용] 유효 +1` 버튼은 `npm run dev`에서만 보이고 배포 빌드에는 없다.

## 남은 작업

- [ ] 포즈 인식 훅 (`usePose`) + 운동별 유효 횟수 판정
- [ ] 3D 운동 공간 · 캐릭터 · 리타게팅 · AI 가이드
- [ ] 친구 캐릭터 동작 동기화 (pose 메시지)
- [ ] 랜딩/프로필 3D 장면
- [ ] 디자인 시안 반영
- [ ] HTTP/WebSocket 백엔드 어댑터
