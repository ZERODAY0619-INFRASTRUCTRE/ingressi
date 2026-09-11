# TOMORI 공통 앱

ICPM과 PCPM은 이 소스의 동일한 웹/Caddy 이미지를 사용한다. 배포 설정은 별도 infra 저장소에 둔다.
원본 기준: f125793470bf99f19439018edf2a272ebffc4b65 (기존 PCPM HEAD).
기존 ICPM 기준 f6ff473ac19c5fdb7ab85d5c74588b7263330ff9는 이 커밋의 조상이다.

- 공통: TOMORI UI, 상태/점검 화면, 오류 피드백, OAuth 역할 동기화, 분석/GeoIP, Authentik HTTP/HTTPS 포트·TLS 수정.
- PCPM 전용: ANUBIS_PROTECTED_DOMAIN을 지정한 경우 Anubis 경로를 생성한다.
- ICPM: ANUBIS_PROTECTED_DOMAIN을 빈 값으로 지정한다. Anubis 경로는 생성하지 않는다.
- CPM_EDGE_LABEL, CPM_FEEDBACK_UPSTREAM, BASE_URL, OAUTH_ISSUER는 런타임 인스턴스 설정이다.

기존 내부 앱에도 외부 앱의 Authentik 수정 및 최신 의존성/Caddy pin이 적용된다.
이 변경은 운영 전환 전 두 인스턴스 인증 흐름을 점검해야 한다.

원본 갱신은 별도 update 브랜치에서 upstream 커밋을 병합하고 검증한다.
custom/main의 커스텀 이력은 보존한다. upstream에는 push하지 않는다.
빌드/배포 방법과 버전 고정은 infra 저장소 docs/UPDATE.ko.md를 따른다.
