from app.tools.parsers import (
    parse_subfinder_output,
    parse_httpx_output,
    parse_naabu_output,
    parse_nuclei_output,
    parse_sqlmap_output,
    wrap_untrusted_evidence,
    EVIDENCE_DELIMITER,
    EVIDENCE_END,
)


def test_evidence_wrapping():
    raw_evidence = "<script>alert('xss')</script>"
    wrapped = wrap_untrusted_evidence(raw_evidence)
    assert EVIDENCE_DELIMITER in wrapped
    assert EVIDENCE_END in wrapped
    assert raw_evidence in wrapped


def test_subfinder_parsing():
    raw = "sub1.example.com\nsub2.example.com\n"
    res = parse_subfinder_output(raw)
    assert res.subdomains == ["sub1.example.com", "sub2.example.com"]
    assert res.source == "subfinder"


def test_httpx_parsing():
    raw_json = '{"url": "https://sub.example.com", "status_code": 200, "title": "Dashboard"}\n'
    res = parse_httpx_output(raw_json)
    assert len(res.live_hosts) == 1
    assert res.live_hosts[0]["url"] == "https://sub.example.com"
    assert res.live_hosts[0]["status_code"] == 200


def test_naabu_parsing():
    raw = "example.com:80\nexample.com:443\n"
    res = parse_naabu_output(raw)
    assert len(res.open_ports) == 2
    assert res.open_ports[0]["port"] == 80
    assert res.open_ports[1]["port"] == 443


def test_nuclei_parsing():
    raw_json = '{"template-id": "cve-2023-1234", "info": {"severity": "high", "description": "RCE"}, "matched-at": "https://example.com"}\n'
    res = parse_nuclei_output(raw_json)
    assert len(res.findings) == 1
    assert res.findings[0]["template_id"] == "cve-2023-1234"
    assert res.findings[0]["severity"] == "high"


def test_sqlmap_parsing():
    raw_stdout = "GET parameter 'id' is vulnerable. Type: boolean-based blind. back-end DBMS: MySQL"
    res = parse_sqlmap_output(raw_stdout)
    assert res.vulnerable is True
    assert res.injection_type == "boolean-based blind"
    assert res.dbms == "MySQL"
    assert EVIDENCE_DELIMITER in res.evidence
