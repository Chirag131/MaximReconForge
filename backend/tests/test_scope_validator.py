import pytest
from app.core.scope_validator import (
    is_valid_domain_syntax,
    is_private_ip,
    validate_target_domain,
    ScopeValidationError,
)


def test_domain_syntax_validation():
    assert is_valid_domain_syntax("example.com") is True
    assert is_valid_domain_syntax("sub.domain.example.co.uk") is True
    assert is_valid_domain_syntax("-invalid.com") is False
    assert is_valid_domain_syntax("invalid..com") is False


def test_private_ip_detection():
    assert is_private_ip("127.0.0.1") is True
    assert is_private_ip("10.0.0.1") is True
    assert is_private_ip("172.16.0.1") is True
    assert is_private_ip("192.168.1.1") is True
    assert is_private_ip("8.8.8.8") is False


def test_blocklist_validation():
    with pytest.raises(ScopeValidationError, match="blocklist"):
        validate_target_domain("google.com")
