from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .models import Result
from django.core.paginator import Paginator
from django.contrib.auth.models import User
from . import urls
from .valify import valify
import json

@require_GET
def main(request):
    return render(request, 'core/main.html')

@require_POST
def submit(request):
    try:

        data = json.loads(request.body)
        requires = ['userId','score', 'time', 'actions','seed']

        #데이터 다 있나 확인..
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
            return HttpResponse('wrong user info...',status=400)
        #점수검증
        if not valify(actions, 5, score, seed):
            return HttpResponse('valification fail... did you cheat?',status=400)
        
        #저장
        game = Result()
        game.userId = User.objects.get(id=userId)
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

    page_size = 10

    all_result = Result.objects.all().order_by('-score')
    paginator = Paginator(all_result, page_size)
    page = request.GET.get('page')
    if page is None: page = 1
    page_obj = paginator.page(page)
    to_response = {'scores':[]}

    for obj in page_obj:
        temp = {
            'username': obj.userId.username,
            'score'   : obj.score,
            'time'    : obj.time,
            'date'    : obj.date
        }
        to_response['scores'].append(temp)
    to_response['page_info'] = {'prev':page_obj.has_previous(), 'next':page_obj.has_previous(), 'curPage':page}
    return JsonResponse(to_response, safe=False)




