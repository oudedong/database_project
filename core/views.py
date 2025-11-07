from django.shortcuts import render
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.http import require_GET, require_POST
from django.urls import reverse
from .models import Result
from django.core.paginator import Paginator
from django.contrib.auth.models import User
from .valify import valify
import json
import datetime
from django.db import connection

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
        seed = data.get('seed')
        actions = data.get('actions')

        #유저확인
        if not (request.user.is_authenticated and request.user.id == userId):
            return HttpResponse('wrong user info',status=400)
        #점수검증
        if not valify(actions, 5, score, seed):
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

@require_GET
def leaderboard_api(request):
    #페이지 크기, 번호, 날짜범위 설정
    page = request.GET.get('page')
    date_range:str = request.GET.get('range')
    page_size = request.GET.get('page_size')
    date_st = None
    date_end = None
    if page_size is None: page_size = 10
    if page is None: page = 1 
    else: page = int(page)
    if not date_range is None:
        date_st, date_end = date_range.split('~')
        date_st = datetime.datetime.strptime(date_st, '%Y%m%d')
        date_end = datetime.datetime.strptime(date_end, '%Y%m%d')

    # #db로 부터 범위내 결과들을 불러옴(프로시저 사용)
    with connection.cursor() as cursor:
        cursor.execute("CALL get_result_by_range(%s, %s)", [date_st,date_end])
        paginator = Paginator(cursor.fetchall(), page_size)

    #형식에 맞게 반환함
    page_obj = paginator.page(page)
    to_response = {'scores':[]}
    for obj in page_obj:
        temp = {
            'username': obj[0],
            'time'    : obj[1],
            'score'   : obj[2],
            'date'    : obj[3]
        }
        to_response['scores'].append(temp)
    to_response['page_info'] = {'prev':page_obj.has_previous(), 'next':page_obj.has_previous(), 'curPage':page, 'num_pages':paginator.num_pages}
    return JsonResponse(to_response, safe=False)




