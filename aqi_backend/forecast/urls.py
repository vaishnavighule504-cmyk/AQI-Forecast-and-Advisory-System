from django.urls import path
from . import views

urlpatterns = [
    path("forecast/", views.forecast_view),
    path("live-aqi/", views.live_aqi_view),
    path("model-predict/", views.model_predict_view),  # <-- New model endpoint
]