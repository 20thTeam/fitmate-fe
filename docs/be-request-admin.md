# FITMATE BE 요청서 — 운영 화면(/admin)용 API (2026-11-11, FE)

FE에 시연 운영용 화면 `/admin`을 만들었어요. manyfast 기획에는 없는 화면이고, 시연 때 방 현황과 참가자·기록을 한눈에 보려는 용도예요.

기준: Swagger `/v3/api-docs` (2026-11-11 확인). 지금은 운영용 API가 없어서 `GET /api/rooms`, `GET /api/teams/{teamId}/xp`만 쓰고, 아래 네 가지는 화면에 "서버 API 준비 중"으로 표시해 뒀어요.

경로·필드 이름은 FE 제안이에요. 기존 응답 형식(`{ resultCode, msg, data }`)과 기존 필드 이름을 그대로 따랐어요. 바꾸고 싶은 부분은 알려 주세요.

## 먼저 정할 것: 운영 API 인증

지금 인증은 참가자 토큰(`X-Participant-Token`)뿐이라, 아래 API를 그대로 열면 누구나 전체 참가자와 기록을 볼 수 있어요.

- 제안: 운영 API는 `X-Admin-Key` 헤더로 서버 환경변수의 키와 비교해요. 운영자가 화면에 직접 입력하고 FE는 코드·환경변수에 넣지 않아요 (`VITE_` 값은 브라우저에 그대로 노출돼요).
- 특히 4번(초기화)은 키 없이 열면 안 돼요.

## 우선순위

| 순서 | API | 쓰는 곳 | 없으면 |
| --- | --- | --- | --- |
| 1 | 방 접속자 현황 | 시연 중 누가 들어와 있는지 확인 | 화면을 직접 봐야 알 수 있어요 |
| 2 | 전체 참가자 목록 | 시연 참가자 확인 | 본인 브라우저 정보만 보여요 |
| 3 | 전체 운동 기록 목록 | 기록·경험치 적립 확인 | 본인 기록만 보여요 |
| 4 | 시연 데이터 초기화 | 리허설 뒤 정리 | DB를 직접 지워야 해요 |

---

## 1. 방 접속자 현황 — `GET /api/admin/rooms`

지금 `GET /api/rooms`에 접속자 정보를 더한 형태예요.

```json
{
  "data": [
    {
      "roomId": 1,
      "name": "FITMATE 운동방",
      "capacity": 5,
      "teamId": 1,
      "teamName": "FITMATE 팀",
      "participants": [
        { "participantId": 12, "nickname": "민지", "characterCode": "CHARACTER_01", "connected": true }
      ]
    }
  ]
}
```

- `participants`: REST 입장(`POST /api/rooms/{roomId}/enter`)을 한 참가자
- `connected`: 지금 웹소켓(`/ws`)으로 연결돼 있는지. 구분이 어렵다면 연결된 참가자만 내려줘도 돼요.

## 2. 전체 참가자 목록 — `GET /api/admin/participants`

```json
{
  "data": [
    {
      "participantId": 12,
      "nickname": "민지",
      "characterCode": "CHARACTER_01",
      "roomId": 1,
      "createdAt": "2026-11-11T20:15:00",
      "workoutCount": 3
    }
  ]
}
```

- `ParticipantResponse`에 `createdAt`, `workoutCount`(확정된 운동 기록 수)를 더했어요.
- **`clientToken`은 내려주지 않아요.** 토큰이 있으면 그 참가자인 척할 수 있어요.
- 최근 만든 순 정렬. 시연 규모라 페이지 나누기는 없어도 되고, 필요하면 `?page=&size=`로 해 주세요.

## 3. 전체 운동 기록 목록 — `GET /api/admin/workouts`

```json
{
  "data": [
    {
      "workoutId": 31,
      "participantId": 12,
      "nickname": "민지",
      "roomId": 1,
      "routineId": 20,
      "roundNo": 2,
      "goal": "POSTURE",
      "goalName": "자세 개선",
      "status": "FINISHED",
      "startedAt": "2026-11-11T20:20:00",
      "finishedAt": "2026-11-11T20:31:00",
      "elapsedSeconds": 660,
      "totalValidCount": 63,
      "earnedXp": 63
    }
  ]
}
```

- `HistoryWorkoutResponse`의 요약 필드에 `participantId`, `nickname`, `roomId`, `status`를 더했어요. 운동별 상세(`records`)는 목록에는 없어도 돼요.
- 진행 중(`IN_PROGRESS`) 기록도 포함해 주세요. 그때 `finishedAt`, `elapsedSeconds`, `totalValidCount`, `earnedXp`는 `null`이에요.
- 측정하지 못한 기록은 `totalValidCount`를 0이 아니라 `null`로 주세요. FE는 측정 못 한 값을 0회로 보여주지 않아요.
- 최근 시작한 순 정렬. `?participantId=`로 한 사람 기록만 볼 수 있으면 좋아요.

## 4. 시연 데이터 초기화 — `POST /api/admin/reset`

리허설 때 쌓인 참가자·루틴·운동 기록·팀 경험치를 지우고, 운동방과 팀은 남겨요.

```json
{ "data": { "deletedParticipants": 14, "deletedWorkouts": 22, "resetTeams": 1 } }
```

- 되돌릴 수 없으니 FE에서 한 번 더 확인하고 호출해요.
- 초기화 뒤 기존 토큰으로 `GET /api/participants/me`를 부르면 지금처럼 404를 주면 돼요. FE는 404면 프로필을 다시 만들게 해요.
- 운영 키 없이는 동작하지 않게 해 주세요. 급하지 않으면 이번 시연에서는 빼도 돼요.

---

## FE 쪽 상태

- 화면: `src/pages/Admin.tsx`, 계약: `src/services/ports.ts`의 `AdminService`
- API가 생기면 `AdminService`에 `listParticipants`, `listWorkouts`를 더하고 "준비 중" 자리를 표로 바꿔요.
