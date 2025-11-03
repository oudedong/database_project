from django.urls import path, include
from .. import views
app_name = 'web'
urlpatterns = [
    path("", views.main, name='main'),
    path("leaderboard/", views.leaderboard, name='leaderboard'),
]