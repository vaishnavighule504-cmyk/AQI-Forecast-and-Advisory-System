from django.urls import path
from . import views

urlpatterns = [
    path("forecast/", views.forecast_view),
    path("live-aqi/", views.live_aqi_view),
]