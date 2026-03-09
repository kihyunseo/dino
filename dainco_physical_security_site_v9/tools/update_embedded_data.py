"""DAINCO 물리보안 시안(v5) - 임베디드 데이터 동기화 도구

왜 필요한가?
- 이 시안은 products/index.html, downloads/index.html에서
  1) 서버로 열면(fetch 가능) ../data/*.json을 읽고
  2) 파일로 직접 열면(file://, fetch 불가) HTML 내부에 임베딩된 JSON(<script type="application/json">)을 사용합니다.

따라서 data/products.json, data/downloads.json을 수정한 뒤에는
HTML 내부의 임베딩 JSON도 같이 업데이트해줘야, "파일로 열어도" 최신 데이터가 보입니다.

사용법
1) (권장) 사이트 루트에서 실행
   python tools/update_embedded_data.py

2) 완료 후
   - products/index.html
   - downloads/index.html
   내부의 JSON이 갱신됩니다.
"""

from __future__ import annotations

import json
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except Exception as e:
    raise SystemExit("bs4(beautifulsoup4) 패키지가 필요합니다. pip install beautifulsoup4") from e

ROOT = Path(__file__).resolve().parents[1]

TARGETS = [
    (ROOT / "products" / "index.html", ROOT / "data" / "products.json", "products-data"),
    (ROOT / "downloads" / "index.html", ROOT / "data" / "downloads.json", "downloads-data"),
]


def main() -> None:
    for html_path, json_path, script_id in TARGETS:
        if not html_path.exists():
            print(f"[SKIP] HTML 없음: {html_path}")
            continue
        if not json_path.exists():
            print(f"[SKIP] JSON 없음: {json_path}")
            continue

        data = json.loads(json_path.read_text(encoding="utf-8"))
        soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
        script = soup.find("script", {"id": script_id})
        if not script:
            print(f"[WARN] script id='{script_id}' 없음: {html_path}")
            continue

        script.string = json.dumps(data, ensure_ascii=False)
        html_path.write_text(str(soup), encoding="utf-8")
        print(f"[OK] {html_path.name} 임베딩 데이터 갱신 완료 ({script_id})")


if __name__ == "__main__":
    main()
