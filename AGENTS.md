# FITMATE 프론트엔드 규칙

이 파일은 FITMATE 프론트엔드 레포(`20thTeam/fitmate-fe`)의 작업 규칙이에요. 사람도, AI 코딩 도구(Codex, Claude Code 등)도 같은 규칙으로 일해요.

- 레포 루트에 `AGENTS.md`라는 이름으로 두면 Codex가 읽어요.
- Claude Code는 루트의 `CLAUDE.md`(`@AGENTS.md` 한 줄)를 통해 같은 내용을 읽어요.

## 프로젝트 요약

- **서비스:** 친구 2~5명이 같은 3D 운동방에서 각자 운동하는 AI 소셜 홈트 웹. 카메라로 자세를 인식해 유효 횟수를 세고, 친구에게는 관절 좌표만 보내 캐릭터 동작을 맞춰요.
- **기획 원본:** manyfast 프로젝트 "이 자료로 시작" (PRD · 기능 22개 · 정책 6개 · 유저플로우 v5). 화면을 만들기 전에 해당 기능(F-…)의 트리거·처리·예외와 관련 정책(PL-…)을 먼저 확인해요. 화면 ↔ 기능 ID 매핑은 [README.md](README.md)에 있어요.
- **화면 기준:** 데스크톱 웹 (카메라 + 3D가 들어가서 모바일은 MVP 범위 밖)
- **스택:** Vite + React + TypeScript, react-router-dom, zustand, three + @react-three/fiber + drei, @mediapipe/tasks-vision, 배포는 Vercel
- **대회:** 2026 멋쟁이사자처럼 1호선톤. 배포 URL로 시연하므로 `main`은 항상 동작해야 해요.
<!-- TODO: 제출·데모데이 일정, FE 담당 분담을 채워 주세요 -->

### 지켜야 할 원칙 (manyfast 정책)

- 측정하지 않은 값·예시 숫자를 실제 기록처럼 보여주지 않아요. 팀 경험치는 산식이 확정될 때까지 "산정 기준 준비 중"으로 둬요.
- 미정 사항은 [src/config/provisional.ts](src/config/provisional.ts)에만 두고, 화면에 "시연용 임시" 표시를 해요. 다른 파일에 임시 숫자를 흩어 놓지 않아요.
- 카메라 영상은 브라우저 밖으로 보내지 않아요. 친구에게는 관절 좌표(`PoseFrame`)만 보내요.
- 화면 코드는 `services`만 호출해요. 백엔드 주소나 `fetch`를 화면에서 직접 쓰지 않아요. 백엔드 계약은 [src/services/ports.ts](src/services/ports.ts)와 [src/types/domain.ts](src/types/domain.ts)가 기준이에요.
- `[개발용]` 버튼·기능은 `import.meta.env.DEV`에서만 보이게 하고, 배포 빌드에는 나오지 않게 해요.

## AI 도구 응답 방식

팀원은 바쁘고 작업 과정을 다 지켜보지 않아요. 잠깐 자리를 비웠다 돌아온 동료에게 말하듯 답해 주세요.

- 한국어로, "~요" 체로 답해요.
- 첫 문장은 결과예요. 요청한 일이 됐는지, 무엇을 찾았는지를 먼저 말하고 설명은 그 뒤에 붙여요.
- 짧게 써요. 뜻을 더하지 않는 말("진짜", "솔직히", "중요한 점은")과 "이제 ~를 설명할게요" 같은 예고는 빼요.
- 쉬운 말로 써요. 전문용어는 꼭 필요할 때만 쓰고, 작업하면서 스스로 만든 이름이나 줄임말은 쓰지 않아요.
- 작업을 시작하기 전에 무엇을 할지 한 문장으로 말해요.
- 여러 선택지를 비교할 때는 표로 정리하고, 추천을 하나 골라 이유와 함께 말해요. 하지 않을 선택지를 길게 나열하지 않아요.
- 파일을 언급할 때는 `[PartyRoom.tsx](src/pages/PartyRoom.tsx:12)`처럼 클릭할 수 있는 링크로 써요.
- 실패한 것, 건너뛴 것, 확인하지 못한 것은 숨기지 않고 그대로 말해요.
- 질문은 정말 막혔을 때만 해요. 이 파일이나 기존 코드로 정할 수 있는 건 정해서 진행하고, 무엇으로 정했는지 알려 줘요.
- 코드 주석도 같은 원칙이에요. 짧은 한국어로, 코드만 봐서는 알기 어려운 이유만 적어요. 관련 기능·정책 ID(F-…, PL-…)가 있으면 같이 적어요.

### 답변 끝의 진행 상황 요약

파일을 고치거나 명령을 실행한 답변은 끝에 진행 상황을 짧게 정리해요. 질문에 바로 답하는 짧은 대화에는 붙이지 않아요.

- **지금 상태:** 무엇이 바뀌었고 어디까지 됐는지 2~3문장
- **남은 것:** 안 된 것, 확인 못 한 것 (커밋 안 함, 실제 카메라로 확인 안 함 등)
- **다음 할 일:** 이어서 해야 할 작업. 사용자가 정해야 할 게 있으면 질문 하나로 묻고 추천안을 먼저 적어요.

```
지금 상태: 스쿼트 유효 횟수 판정을 usePose에 붙였고 로컬 카메라로 10회 중 10회 인식됐어요.
남은 것: 런지·플랭크 판정은 아직이고, 커밋하지 않았어요.
다음 할 일: 커밋할까요? (추천: feat: 스쿼트 유효 횟수 판정 추가 (#14))
```

## AI 도구 작업 규칙

- 커밋, 푸시, PR 생성은 요청받았을 때만 해요. 할 때는 아래 커밋·브랜치 규칙을 따라요.
- 새 패키지를 설치하기 전에 무엇을 왜 설치하는지 먼저 물어봐요.
- API 키는 코드에 직접 쓰지 않고 `.env`에만 둬요. `.env` 내용은 출력하지 않아요. `VITE_`로 시작하는 값은 브라우저에 그대로 노출된다는 점도 기억해요. 새 환경변수를 추가하면 `.env.example`에도 값 없이 적어요.
- 화면을 만들면 로딩·실패·빈 화면도 같이 만들어요. 카메라 권한 거부, 카메라 없음, 포즈 모델 로딩 실패, 방 인원 초과(5명)도 예외 화면에 포함해요.
- 백엔드 API가 정해지지 않은 부분은 `services/local`로 먼저 만들고, `ports.ts`의 인터페이스를 바꿨다면 BE에 알려야 한다고 답변에 적어요.
- 로컬 실시간(`BroadcastChannel`)은 같은 브라우저 탭끼리만 연결돼요. 여러 명 시연을 확인할 때는 탭 여러 개로 확인했다고 적고, 다른 PC 간 동작은 확인 못 한 것으로 적어요.
- 3D·포즈 인식은 무거워요. 매 프레임 실행되는 코드(`useFrame`, 포즈 콜백)에서 zustand 상태를 매번 바꾸거나 새 객체를 만들지 않아요.

## 커밋 메시지

```
<type>: <무엇을 왜 바꿨는지> (#이슈번호)
```

```
feat: 파티 운동방에 친구 응원 보내기 추가 (#12)
fix: 카메라 권한 거부 시 빈 화면이 뜨는 문제 수정 (#18)
```

| type | 쓰는 경우 |
| --- | --- |
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `design` | CSS·레이아웃 등 화면 모양만 변경 |
| `refactor` | 동작은 그대로 두고 코드 구조 개선 |
| `style` | 포매팅, 세미콜론 등 코드 의미가 바뀌지 않는 수정 |
| `remove` | 파일·코드·기능 삭제 |
| `chore` | 패키지 설치, 빌드·환경 설정, `.gitignore` 등 |
| `docs` | 문서 수정 |
| `test` | 테스트 코드 |

- 어떻게(how)보다 무엇(what)과 왜(why)를 적어요.
- 하나의 커밋에는 하나의 일만 담아요.

## 브랜치

| 브랜치 | 설명 |
| --- | --- |
| `main` | 배포 브랜치. Vercel이 자동 배포하고 이 URL로 시연해요. 직접 푸시하지 않고 PR로만 합쳐요. |
| `feature/#이슈번호-작업내용` | 작업 브랜치. 예: `feature/#12-cheer` |

- 작업 브랜치는 이슈 하나당 하나씩 만들어요.
- 브랜치를 푸시하거나 PR을 올리면 Vercel이 미리보기 URL을 만들어 줘요. 거기서 카메라·3D가 실제로 동작하는지 확인한 뒤 `main`에 합쳐요.
- PR은 다른 FE 한 명이 확인하고 합쳐요. 합친 브랜치는 삭제해요.
- 해커톤이라 `develop`, `release` 브랜치는 두지 않아요.

## 코드 규칙

### 이름 짓기

- 변수·함수는 카멜 케이스: `routineId`, `fetchRoutine`
- 컴포넌트와 컴포넌트 파일은 파스칼 케이스: `RoutineList.tsx`
- 커스텀 훅은 `use`로 시작: `useCamera`, `usePose`
- 상수는 대문자 스네이크 케이스: `MAX_PARTICIPANTS`, `PROVISIONAL_ROUTINES`
  - `const`로 선언했다고 모두 상수는 아니에요. 앱 어디서도 바뀌지 않는 값만 상수로 써요.
- Boolean은 `is`, `has`, `can`으로 시작하고 부정형은 피해요: `isLoading` (O), `isNotLoaded` (X)
- 함수 이름만 보고 무엇을 하는지 알 수 있게 지어요: `countValidRep`
- 전역 변수는 최소화해요. 한 함수에서만 쓰는 값은 그 함수 안에서 선언해요.

### 함수 정의

```tsx
// 컴포넌트는 함수 선언식
export default function PartyRoom() {}

// 컴포넌트 안의 함수는 화살표 함수
const handleCheer = () => {}
```

### 포매팅

- 지금 코드에 맞춰 세미콜론 없이, 작은따옴표를 써요.
- 린트는 `npm run lint`(oxlint)예요. 커밋 전에 `npm run lint`와 `npm run build`가 통과하는지 확인해요.

### TypeScript

- `any`는 쓰지 않아요. 타입을 모르면 `unknown`으로 받고 좁혀서 써요.
- 백엔드와 공유하는 도메인 타입은 [src/types/domain.ts](src/types/domain.ts)에 둬요 (manyfast dataSpec 기준). 한 기능에서만 쓰는 타입은 그 파일 안에 둬요.
- API 응답 타입은 BE와 정한 형식을 그대로 옮겨 적어요.

## 폴더 구조

```
src/
├── main.tsx                # 진입점
├── App.tsx                 # 라우트 정의 (프로필 없으면 /profile로 보냄)
├── index.css               # 전역 스타일
│
├── pages/                  # 화면 (유저플로우 v5 순서)
│   ├── Landing.tsx         # /
│   ├── ProfileSetup.tsx    # /profile 닉네임·캐릭터
│   ├── Home.tsx            # /home
│   ├── GoalSelect.tsx      # /goal 목표 선택 + 추천 로딩
│   ├── RoutineConfirm.tsx  # /routine/:routineId
│   ├── PartyRoom.tsx       # /room/:routineId 파티 운동방
│   ├── Result.tsx          # /result/:sessionId 결과 + 다음 회차 추천
│   ├── History.tsx         # /history 성장 기록
│   └── Sunset.tsx          # /sunset 선셋 에어로빅 (P1)
│
├── components/             # 여러 화면이 같이 쓰는 UI
├── hooks/                  # useCamera 등 커스텀 훅
├── lib/                    # 순수 함수 (recommend: 규칙 기반 추천 폴백, format)
├── config/
│   ├── characters.ts       # 캐릭터 목록
│   └── provisional.ts      # ⚠️ PM 미승인 임시값 (여기에만 둠)
├── store/app.ts            # zustand. 화면 간 공유 상태만 둬요
├── types/domain.ts         # 도메인 타입 ← 백엔드와 공유할 계약
└── services/
    ├── ports.ts            # 프론트가 기대하는 백엔드 인터페이스
    ├── index.ts            # 구현 선택 (VITE_BACKEND=local | http)
    ├── local/              # 백엔드 없이 동작 (localStorage + BroadcastChannel)
    └── http/               # (예정) 팀 백엔드 어댑터
```

- 새 화면은 `pages/`에 파일 하나로 만들고 [App.tsx](src/App.tsx)에 라우트를 추가해요. README의 화면 ↔ 기능 매핑 표도 같이 고쳐요.
- 3D 장면·캐릭터 컴포넌트가 늘어나면 `components/three/`에 모아요.
- 로그인은 MVP에서 빠졌으니 `auth` 폴더는 만들지 않아요. 사용자는 같은 브라우저의 임시 프로필로 구분해요.

## 이슈·PR 템플릿

`.github/ISSUE_TEMPLATE/`과 `.github/pull_request_template.md`에 넣어요.

### 버그 이슈

```markdown
---
name: 버그
about: 버그 신고
title: '[버그] '
labels: bug
---

## 무슨 문제인가요

## 재현 방법
1.
2.

## 기대한 동작

## 스크린샷·환경
<!-- 브라우저, 카메라 기기, 배포 URL인지 로컬인지, 참가 인원 -->
```

### 기능 이슈

```markdown
---
name: 기능
about: 만들 기능
title: '[기능] '
labels: enhancement
---

## 만들 것
<!-- manyfast 기능 ID: F-… -->

## 할 일
- [ ]
- [ ]

## 참고
<!-- 디자인 시안, manyfast 기능·정책, API -->
```

### PR

```markdown
## 무엇을 했나요
<!-- manyfast 기능 ID: F-… -->

## 스크린샷
<!-- 화면 변경이 없으면 지워 주세요 -->

## 체크리스트
- [ ] 커밋 메시지 규칙을 지켰어요
- [ ] `npm run lint`, `npm run build`가 통과해요
- [ ] Vercel 미리보기 URL에서 카메라·3D 동작을 확인했어요
- [ ] 로딩·실패·빈 화면, 카메라 권한 거부를 확인했어요 (해당되는 경우)
- [ ] 임시값은 `config/provisional.ts`에만 뒀어요

resolves #
```
