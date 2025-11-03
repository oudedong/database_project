from django.urls import path
from .. import views
app_name = 'api'
urlpatterns = [
    path("login/", views.login_api, name='login'),
    path("logout/", views.logout_api, name='logout'),
    path("register/", views.register_api, name='register'),
    path("check/", views.check_status, name='check_status'),
]