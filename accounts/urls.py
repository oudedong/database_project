from django.urls import path
from . import views
app_name = 'accounts'
urlpatterns = [

    path("login/", views.mylogin, name='login'),

    path("login_api/", views.login_api, name='login_api'),
    path("logout_api/", views.logout_api, name='logout_api'),
    path("register_api/", views.register_api, name='register_api'),
    path("check_api/", views.check_status, name='check_status_api'),
]