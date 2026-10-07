# AGENTS.md — FreeLang Recon

## 프로젝트 개요

- 프로젝트명: freelang-recon
- 목적: FreeLang Framework용 Local Inventory와 Evidence 계약 구현
- 스택: FreeLang v11 / AFJ DB 연동 예정 / FreeLang Front 연동 예정

## 규칙

1. 새 구현은 FreeLang Script를 기본으로 한다.
2. 분석 대상은 기본적으로 실행하지 않는다.
3. 사용자 입력 경로를 받기 전 권한·경로 정책을 먼저 확정한다.
4. 관찰 사실, 추론, unknowns를 분리한다.
5. 실제 Provider 연결은 계약과 smoke test를 먼저 만든 뒤 추가한다.
6. commit·push·deploy는 명시적 요청이 있을 때만 수행한다.

## 검증

```bash
cd /root/freelang-surface-v0-clean-ek3qo2/v11
node bootstrap.js check /root/kilo-freelang/projects/freelang-recon/src/local-inventory.fl
node bootstrap.js run /root/kilo-freelang/projects/freelang-recon/src/local-inventory.fl
```

## 완료 보고

변경 파일, 동작, syntax/runtime 결과, 모바일 한계, 임시 파일 정리, commit hash, push 상태를 기록한다.
