# views.py
from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_POST, require_GET
from django.http import JsonResponse, HttpResponse
from django.contrib.auth import login, logout
User = get_user_model()

@require_POST
def login_api(request):
    form = AuthenticationForm(request, data=request.POST)
    if form.is_valid():
        login(request, form.get_user())
        return JsonResponse({'ok':True})
    return JsonResponse({'ok':False, 'errors':form.errors}, status=400)
@require_POST
def logout_api(request):
    logout(request)
    return HttpResponse(status=200)
@require_POST
def register_api(request):
    form = UserCreationForm(request.POST)
    if form.is_valid():
        user = form.save()
        login(request, user)
        return JsonResponse({'ok':True})
    return JsonResponse({'ok':False, 'errors':form.errors}, status=400)
@require_GET
def check_status(request):
    to_response = {'ok':False, 'user':None}
    if request.user.is_authenticated:
        user = request.user
        to_response['ok'] = True
        to_response['user'] = {'id':user.id, 'username':user.get_username()}
    return JsonResponse(to_response)