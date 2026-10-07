# Codex 작업 기록

## 현재 상태

- Phase 1 완료 / Phase 2: Local Inventory
- 대상 실행: 금지
- Provider: `local-inventory`
- 저장: AFJ DB 연동 예정
- 화면: FreeLang Framework에서 연동 예정

## Phase 1 점검

- JSON parse/serialize: v11 기본 builtin
- stdin lines: `scripts/native-capability-probe.mjs`
- binary file bytes: Node `readFile` adapter
- file SHA-256: Node `crypto` adapter; FreeLang `sha256-file` fallback
- 결과: Phase 1 PASS

## 알려진 런타임 제한

v11의 native 실행 경로에서 `sha256` 계열 호출이 문자열이 아닌 함수 객체로 반환되는 현상을 확인했다. 현재는 FreeLang의 `shell-safe`로 고정된 `sha256sum` 명령을 호출하고 임시 manifest 파일을 즉시 삭제한다.

이 어댑터는 사용자 입력 명령을 실행하지 않으며, 다음 단계에서 플랫폼별 digest provider로 추상화한다.

## 상태 보고

```text
FREELANG_AFJ=USED
FREELANG_AFJ_DB=NOT_APPLICABLE
FREELANG_FRONT=NOT_APPLICABLE
OTHER_LANGUAGE=USED
OTHER_LANGUAGE_REASON=고정 sha256sum 시스템 명령을 FreeLang shell-safe로 최소 호출
```
