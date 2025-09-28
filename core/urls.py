from django.urls import path, include
from . import views
app_name = 'core'
urlpatterns = [
    path("", views.main, name='main'),
    path("login", views.login, name='login'),
    path("submit", views.submit, name='submit'),
    path("leaderboard", views.leaderboard, name='leaderboard'),
    path("leaderboard_api", views.leaderboard_api, name='leaderboard_api'),
]