from django.shortcuts import render
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.http import require_GET, require_POST
from django.urls import reverse

@require_GET
def redirect_to_main(request):
    return HttpResponseRedirect(reverse('core:web:main'))