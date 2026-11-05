from django.shortcuts import render
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.http import require_GET, require_POST
from django.urls import reverse
from .models import Result
from django.core.paginator import Paginator
from django.contrib.auth.models import User
from .valify2 import verify_full_game_log
import json
import datetime
from django.db import connection
from django.db.models import OuterRef, Subquery, F

@require_GET
def main(request):
    return render(request, 'core/main.html')

@require_POST
def submit(request):
    try:
        data = json.loads(request.body)
        requires = ['userId','score', 'time', 'actions','seed']

        #데이터 다 있나 확인
        for key in requires:
            temp = data.get(key)
            if temp is None:
                return HttpResponse(f'field {key} is missing...',status=400)
        
        userId = data.get('userId')
        score = data.get('score')
        time = data.get('time')

        #유저확인
        if not (request.user.is_authenticated and request.user.id == userId):
            return HttpResponse('wrong user info',status=400)
        #점수검증
        if not verify_full_game_log(data, 5):
            return HttpResponse('valification fail',status=400)
        
        #저장
        game = Result()
        game.user = User.objects.get(id=userId)
        game.score = score
        game.time = time
        game.save()

        return HttpResponse('succeed to save',status=200)

    except Exception as e:
        return HttpResponse(f'{e}',status=400)

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
        return HttpResponse('page, page_size must be integers', status=400)
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
                return HttpResponse('range must be YYYYMMDD~YYYYMMDD', status=400)
        rows = _rank_by_range(date_st, date_end)
    else:
        return HttpResponse(f'unknown type: {type}', status=400)

    #형식에 맞게 반환함
    paginator = Paginator(rows, page_size)
    page_obj = paginator.get_page(page)
    to_response = {'scores':[]}
    for username, time, score, date in page_obj:
        to_response['scores'].append({
            'username': username,
            'time'    : time,
            'score'   : score,
            'date'    : date,
        })
    to_response['page_info'] = {'prev':page_obj.has_previous(), 'next':page_obj.has_next(), 'curPage':page_obj.number, 'num_pages':paginator.num_pages}
    return JsonResponse(to_response, safe=False)




