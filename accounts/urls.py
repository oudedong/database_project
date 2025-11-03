from django.urls import path, include
app_name = 'accounts'
urlpatterns = [
    path("", include('accounts.routes.web', namespace='web')),
    path("api/", include('accounts.routes.api', namespace='api')),
]