# Phase 1 환경 점검

확인 대상: FreeLang v11 runtime / 현재 Termux Linux 환경

상태: **Phase 1 완료**

## 결과

| 기능 | 상태 | 확인 방법 | 결론 |
|---|---|---|---|
| stdin 줄 읽기 | native adapter 필요 | v11 표준 builtin 검색 + `shell-safe cat /dev/stdin` 실행 | 자식 프로세스 stdin 미전달 확인, Node adapter 사용 |
| JSON 파싱 | 지원 | `json-parse` 실행 | 기본 제공 |
| JSON 직렬화 | 지원 | `json-stringify` 실행 | 기본 제공 |
| 바이너리 파일 읽기 | 어댑터 필요 | `file-read`는 텍스트 반환, binary 파일 전용 read builtin 없음 | Node adapter에서 `readFile` 검증 |
| SHA-256 문자열 | 문서상 지원 / native 경로 확인 필요 | `sha256` 호출이 함수 객체로 반환되는 경로 확인 | 파일 digest는 `sha256sum` adapter 사용 |
| SHA-256 파일 | 어댑터 필요 | v11 native hash 경로 이상 + `sha256sum` 확인 | Node adapter와 `sha256-file` 제공 |

## 구현된 어댑터

`src/native-adapter.fl`는 사용자 입력을 shell 문자열로 합치지 않고 `shell-safe`의 프로그램·인자 배열 방식만 사용한다. stdin은 shell child로 전달되지 않으므로 `scripts/native-capability-probe.mjs`가 담당한다.

- `binary-file-base64`
- `sha256-file`

`scripts/native-capability-probe.mjs`:

- stdin 줄 읽기
- Node `readFile` 기반 바이너리 byte 읽기
- Node `crypto.createHash("sha256")` 파일 digest
- JSON parse/serialize

## 실행 검증

```bash
printf 'hello\nworld\n' | node /root/kilo-freelang/projects/freelang-recon/scripts/native-capability-probe.mjs /root/kilo-freelang/projects/freelang-recon/tests/phase1-sample.bin
```

예상 결과에는 다음이 포함된다.

- stdin 줄 배열
- JSON roundtrip 문자열
- 샘플 파일의 byte 수
- 샘플 파일 SHA-256

## 제한

- 현재 adapter는 Linux/Termux의 `cat`, `base64`, `sha256sum` 명령에 의존한다.
- target path는 adapter가 자동으로 허용하지 않는다. 상위 정책 계층이 권한·allowlist를 먼저 검사해야 한다.
- 대상 파일을 실행하지 않는다.

## 실제 결과

`native-capability-probe.mjs` 실행 결과:

- stdin lines: `hello`, `world`
- JSON roundtrip: `{"name":"rea","phase":1}`
- binary bytes: `30`
- SHA-256: `4dc1cbf02f24751da6195fbf84a723ed471e946825721f7b94b9c8a24e3505a9`
