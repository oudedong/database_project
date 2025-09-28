from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .models import Result
from django.core.paginator import Paginator
from django.contrib.auth.models import User
from . import urls
import json

# Create your views here.

@require_GET
def main(request):
    context = {'text':'hello_world'}
    return render(request, 'core/main.html', context)

@require_GET
def login(request):
    next = request.GET.get('next')
    if next == None:
        next == urls.path('main')
    context = {'next':next}
    return render(request, 'core/login.html', context)

@require_POST
def submit(request):
    try:
        data = json.loads(request.body)
        userId = data.get('userId')
        score = data.get('score')
        time = data.get('time')
        if userId != None and score != None and time != None:
            result = Result(userId_id=userId, score=score, time=time)
            result.save()
            return HttpResponse('succeed to save',status=200)
        else:
            return HttpResponse('some field is missing...',status=400)

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
    page_obj = paginator.page(page)
    data = []

    for obj in page_obj:
        username = obj.userId.username
        score = obj.score
        time = obj.time
        temp = {
            'username': username,
            'score'   : score,
            'time'    : time
        }
        data.append(temp)
    data.append({'prev':page_obj.has_previous(), 'next':page_obj.has_previous(), 'curPage':page})
    return JsonResponse(data, safe=False)




