from __future__ import annotations

from typing import Any, Optional
from django.http import JsonResponse


def api_success(data: Any = None, status: int = 200) -> JsonResponse:
    """통일된 성공 JSON 응답을 반환한다."""
    return JsonResponse(
        {"ok": True, "data": {} if data is None else data},
        status=status,
    )


def api_error(
    message: str,
    status: int = 400,
    errors: Optional[Any] = None,
) -> JsonResponse:
    """통일된 실패 JSON 응답을 반환한다."""
    body: dict[str, Any] = {"ok": False, "error": message}
    if errors is not None:
        body["errors"] = errors
    return JsonResponse(body, status=status)
