DAINCO 물리보안 시안(v5) - 운영 메모

1) 데이터는 어디를 수정하나요?
- 제품: data/products.json
- 기술자료: data/downloads.json

2) 수정 후 파일로 열어도 최신 데이터가 보이게 하려면?
- products/index.html, downloads/index.html은 file://로 열 때 fetch가 막힐 수 있어
  HTML 내부에 JSON을 임베딩해 둡니다.
- data/*.json을 수정한 다음 아래를 실행하면 임베딩 JSON도 같이 갱신됩니다.

  python tools/update_embedded_data.py

3) 브라우저에서 더 안정적으로 보려면(권장)
- 사이트 루트(dainco_physical_security_site_v5)에서 간단한 서버를 띄워서 보세요.

  python -m http.server 8080

- 접속: http://localhost:8080
