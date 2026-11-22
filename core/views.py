from django.shortcuts import render
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.http import require_GET, require_POST
from django.urls import reverse
from .models import Result, GameSession
from django.core.paginator import Paginator
from django.contrib.auth.models import User
from .valify2 import verify_full_game_log
import json
import datetime
import secrets
import uuid
from django.db import connection, transaction
from django.db.models import OuterRef, Subquery, F
from django.utils import timezone
from tree_puzzle.api_utils import api_success, api_error

@require_GET
def main(request):
    return render(request, 'core/main.html')

@require_POST
def start_game(request):
    """새 게임 세션을 시작하고 서버에서 난수 시드를 발급한다."""
    if not request.user.is_authenticated:
        return api_error('authentication required', status=401)

    seed = secrets.randbelow(1_000_000)
    with transaction.atomic():
        GameSession.objects.filter(user=request.user, submitted_at__isnull=True).delete()
        session = GameSession.objects.create(user=request.user, seed=seed)

    return api_success({'session_id': str(session.id), 'seed': session.seed})

@require_POST
def submit(request):
    if not request.user.is_authenticated:
        return api_error('authentication required', status=401)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError, ValueError):
        return api_error('invalid json', status=400)

    if not isinstance(data, dict):
        return api_error('invalid payload', status=400)

    requires = ['session_id', 'score', 'actions']
    for key in requires:
        if data.get(key) is None:
            return api_error(f'field {key} is missing...', status=400)

    try:
        session_uuid = uuid.UUID(str(data.get('session_id')))
    except (ValueError, TypeError, AttributeError):
        return api_error('invalid session_id', status=400)

    with transaction.atomic():
        session = (
            GameSession.objects
            .select_for_update()
            .filter(id=session_uuid, user=request.user)
            .first()
        )
        if session is None:
            return api_error('session not found', status=404)

        if session.submitted_at is not None:
            return api_error('already submitted', status=409)

        verify_payload = {
            'seed': session.seed,
            'score': data.get('score'),
            'actions': data.get('actions'),
        }
        if not verify_full_game_log(verify_payload, 5):
            return api_error('valification fail', status=400)

        now = timezone.now()
        elapsed_seconds = max(0, int((now - session.started_at).total_seconds()))
        game = Result.objects.create(
            user=request.user,
            score=int(data['score']),
            time=elapsed_seconds,
        )
        session.submitted_at = now
        session.result = game
        session.save(update_fields=['submitted_at', 'result'])

    return api_success({'score': game.score, 'time': game.time})

@require_GET
def leaderboard(request):
    return render(request, 'core/leaderboard.html')

# ─────────────────────────────
# 리더보드 조회
# MySQL이면 저장 프로시저, 그 외(SQLite 등)는 같은 결과를 내는 ORM 쿼리를 사용
# 반환 형식: [(username, time, score, date), ...]
# ─────────────────────────────
def _rank_by_range(date_st, date_end):
    if connection.vendor == 'mysql':
        with connection.cursor() as cursor:
            cursor.execute("CALL get_result_by_range(%s, %s)", [date_st, date_end])
            return [(row[0], row[1], row[2], row[3]) for row in cursor.fetchall()]

    # get_result_by_range와 동일: 기간 내 기록을 점수 내림차순, 같으면 시간 오름차순
    qs = Result.objects.select_related('user')
    if date_st is not None and date_end is not None:
        qs = qs.filter(date__range=(date_st, date_end))
    qs = qs.order_by('-score', 'time', 'id')
    return [(r.user.username, r.time, r.score, r.date) for r in qs]

def _rank_by_user():
    if connection.vendor == 'mysql':
        with connection.cursor() as cursor:
            cursor.execute("CALL get_result_by_user()", [])
            return [(row[0], row[1], row[2], row[3]) for row in cursor.fetchall()]

    # get_result_by_user와 동일: 스칼라 상관 서브쿼리로 유저별 최고 기록 1건을 고른 뒤 점수 내림차순
    best_id = (Result.objects
               .filter(user=OuterRef('user'))
               .order_by('-score', 'time', '-date', '-id')
               .values('id')[:1])
    qs = (Result.objects.select_related('user')
          .annotate(best_id=Subquery(best_id))
          .filter(id=F('best_id'))
          .order_by('-score', 'time', 'id'))
    return [(r.user.username, r.time, r.score, r.date) for r in qs]

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




