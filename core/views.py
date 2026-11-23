from django.shortcuts import render
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.urls import reverse
from .models import Result, GameSession
from django.core.paginator import Paginator
from .valify2 import verify_full_game_log
import json
import datetime
import secrets
import uuid
from django.db import transaction
from django.db.models import OuterRef, Subquery, F
from django.utils import timezone
from tree_puzzle.api_utils import api_success, api_error

SESSION_TTL = datetime.timedelta(hours=24)

@ensure_csrf_cookie
@require_GET
def main(request):
    return render(request, 'core/main.html')

@require_POST
def start_game(request):
    """비로그인 세션 기반으로 새 게임 세션을 시작하고 만료/이전 미제출 세션을 정리한다."""
    seed = secrets.randbelow(1_000_000)
    now = timezone.now()
    prev_id = request.session.get('active_game_session_id')

    with transaction.atomic():
        if prev_id:
            try:
                prev_uuid = uuid.UUID(str(prev_id))
                GameSession.objects.filter(id=prev_uuid, submitted_at__isnull=True).delete()
            except (ValueError, TypeError, AttributeError):
                pass
        GameSession.objects.filter(
            submitted_at__isnull=True,
            started_at__lt=now - SESSION_TTL,
        ).delete()
        session = GameSession.objects.create(seed=seed)

    request.session['active_game_session_id'] = str(session.id)
    return api_success({'session_id': str(session.id), 'seed': session.seed})

@require_POST
def submit(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError, ValueError):
        return api_error('invalid json', status=400)

    if not isinstance(data, dict):
        return api_error('invalid payload', status=400)

    requires = ['session_id', 'nickname', 'score', 'actions']
    for key in requires:
        if data.get(key) is None:
            return api_error(f'field {key} is missing...', status=400)

    nickname = str(data.get('nickname', '')).strip()
    if not (1 <= len(nickname) <= 20):
        return api_error('nickname must be between 1 and 20 characters', status=400)

    try:
        session_uuid = uuid.UUID(str(data.get('session_id')))
    except (ValueError, TypeError, AttributeError):
        return api_error('invalid session_id', status=400)

    if request.session.get('active_game_session_id') != str(session_uuid):
        return api_error('invalid session', status=403)

    with transaction.atomic():
        session = (
            GameSession.objects
            .select_for_update()
            .filter(id=session_uuid)
            .first()
        )
        if session is None:
            return api_error('session not found', status=404)

        if session.submitted_at is not None:
            return api_error('already submitted', status=409)

        now = timezone.now()
        if now - session.started_at > SESSION_TTL:
            return api_error('session expired', status=400)

        verify_payload = {
            'seed': session.seed,
            'score': data.get('score'),
            'actions': data.get('actions'),
        }
        if not verify_full_game_log(verify_payload, 5):
            return api_error('valification fail', status=400)

        elapsed_seconds = max(0, int((now - session.started_at).total_seconds()))
        game = Result.objects.create(
            nickname=nickname,
            score=int(data['score']),
            time=elapsed_seconds,
        )
        session.submitted_at = now
        session.result = game
        session.save(update_fields=['submitted_at', 'result'])

    return api_success({'nickname': game.nickname, 'score': game.score, 'time': game.time})

@require_GET
def leaderboard(request):
    return render(request, 'core/leaderboard.html')

# ─────────────────────────────
# 리더보드 조회 (Django ORM 통일: SQLite / MySQL 공통)
# 반환 형식: [(nickname, time, score, date), ...]
# ─────────────────────────────
def _rank_by_range(date_st, date_end):
    qs = Result.objects.all()
    if date_st is not None and date_end is not None:
        qs = qs.filter(date__range=(date_st, date_end))
    qs = qs.order_by('-score', 'time', 'id')
    return [(r.nickname, r.time, r.score, r.date) for r in qs]

def _rank_by_user():
    best_id = (
        Result.objects
        .filter(nickname=OuterRef('nickname'))
        .order_by('-score', 'time', '-date', '-id')
        .values('id')[:1]
    )
    qs = (
        Result.objects
        .annotate(best_id=Subquery(best_id))
        .filter(id=F('best_id'))
        .order_by('-score', 'time', 'id')
    )
    return [(r.nickname, r.time, r.score, r.date) for r in qs]

@require_GET
def leaderboard_api(request):
    #페이지 크기, 번호, 날짜범위 설정
    try:
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
    except ValueError:
        return api_error('page, page_size must be integers', status=400)

    if page < 1:
        return api_error('page must be >= 1', status=400)
    if not (1 <= page_size <= 100):
        return api_error('page_size must be between 1 and 100', status=400)

    type = request.GET.get('type', 'date_rank')

    if type == 'user_rank':
        rows = _rank_by_user()
    elif type == 'date_rank':
        date_range = request.GET.get('range')
        date_st = None
        date_end = None
        if date_range:
            try:
                date_st, date_end = date_range.split('~')
                date_st = datetime.datetime.strptime(date_st, '%Y%m%d').date()
                date_end = datetime.datetime.strptime(date_end, '%Y%m%d').date()
            except ValueError:
                return api_error('range must be YYYYMMDD~YYYYMMDD', status=400)
        rows = _rank_by_range(date_st, date_end)
    else:
        return api_error(f'unknown type: {type}', status=400)

    #형식에 맞게 반환함
    paginator = Paginator(rows, page_size)
    page_obj = paginator.get_page(page)
    scores = [
        {
            'username': username,
            'time': time,
            'score': score,
            'date': date,
        }
        for username, time, score, date in page_obj
    ]
    page_info = {
        'prev': page_obj.has_previous(),
        'next': page_obj.has_next(),
        'curPage': page_obj.number,
        'num_pages': paginator.num_pages,
    }
    return api_success({'scores': scores, 'page_info': page_info})




