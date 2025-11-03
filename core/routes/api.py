from django.urls import path, include
from .. import views
app_name = 'api'
urlpatterns = [
    path("submit", views.submit, name='submit'),
    path("leaderboard", views.leaderboard_api, name='leaderboard'),
]