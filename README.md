# FreeLang Recon

FreeLang Framework용 증거 중심 정적 분석 계층입니다.

REA처럼 분석 Provider를 연결할 수 있지만, 결과를 FreeLang Coding Script와 AFJ DB의 실행 흐름에 맞는 `Evidence / Unknowns` 계약으로 정리하는 것이 목적입니다.

## Phase 2

현재 구현은 대상 파일을 실행하지 않고, `RECON_INVENTORY_TARGET` 또는 저장소의 fixture 디렉터리 목록과 manifest digest를 생성합니다.

## Phase 1 환경 점검

환경 점검 결과는 [ENVIRONMENT-CHECK.md](docs/ENVIRONMENT-CHECK.md)에 기록했습니다. JSON은 v11 기본 기능을 사용하고, stdin·바이너리 파일·파일 SHA-256은 최소 native adapter로 보강했습니다.

Native probe:

```bash
printf 'hello\nworld\n' | node scripts/native-capability-probe.mjs tests/phase1-sample.bin
```

```text
target
  → local inventory
  → manifest
  → SHA-256 digest
  → evidence + unknowns
```

## 실행

```bash
cd "$FREELANG_V11_ROOT"
node bootstrap.js check "$RECON_ROOT/src/local-inventory.fl"
node bootstrap.js run "$RECON_ROOT/src/local-inventory.fl"
```

## 다음 단계

- 사용자 입력 경로의 권한·경로 정책
- 재귀 inventory
- AFJ DB persistence
- REA MCP adapter
- Ghidra/Hopper provider adapter

## 안전 범위

- 소유하거나 분석 권한이 있는 대상만 사용한다.
- 대상 실행은 기본적으로 하지 않는다.
- 분석 결과와 추론·미확정 사항을 구분한다.

현재는 설계·Phase 2 구현 저장소이며, 실제 네이티브 디컴파일러는 연결하지 않았습니다.
