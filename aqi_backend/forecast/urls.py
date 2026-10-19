from django.urls import path
from . import views

urlpatterns = [
    path("forecast/", views.forecast_view),
    path("live-aqi/", views.live_aqi_view),
    path("model-predict/", views.model_predict_view),
    path("register/", views.register_view),  
    path("login/", views.login_view)
]
