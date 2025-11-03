from django.urls import path, include
app_name = 'core'
urlpatterns = [
    path("", include('core.routes.web',namespace='web')),
    path("api/", include('core.routes.api',namespace='api')),
]