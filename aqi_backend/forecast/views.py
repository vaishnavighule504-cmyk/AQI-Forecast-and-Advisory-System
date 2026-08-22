import os
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .agent_advisory import AQIAdvisoryAgent
from .services import get_forecast
from .models import AQIReading

@api_view(["GET", "POST"])
def forecast_view(request):
    """
    GET /api/forecast?city=X&profile=Y
    POST /api/forecast (body: {"city": "X", "profile": "Y"})
    
    Generates 1-day and 2-day ahead AQI forecast predictions (using model or baseline)
    and attaches personalized health advisories.
    """
    if request.method == "GET":
        city = request.query_params.get("city", "Delhi")
        profile = request.query_params.get("profile", "General Public")
    else:
        city = request.data.get("city", "Delhi")
        profile = request.data.get("profile", "General Public")

    try:
        # 1. Fetch 1-day and 2-day-ahead predictions from service layer
        forecast_data = get_forecast(city)
        
        # 2. Instantiate agent for advisory and translation generation
        agent = AQIAdvisoryAgent()
        
        # Decorate 1-Day Forecast with Advisory Details
        aqi_1d = forecast_data["forecast_1d"]["value"]
        cat_1d, col_1d, adv_1d = agent.generate_health_advisory(aqi_1d, profile, city_name=city)
        llm_adv_1d = agent.generate_llm_health_advisory(aqi_1d, cat_1d, profile, city)
        forecast_data["forecast_1d"].update({
            "category": cat_1d,
            "color": col_1d,
            "static_advisory": adv_1d,
            "advisory": llm_adv_1d,
            "profile": profile
        })
        
        # Decorate 2-Day Forecast with Advisory Details
        aqi_2d = forecast_data["forecast_2d"]["value"]
        cat_2d, col_2d, adv_2d = agent.generate_health_advisory(aqi_2d, profile, city_name=city)
        llm_adv_2d = agent.generate_llm_health_advisory(aqi_2d, cat_2d, profile, city)
        forecast_data["forecast_2d"].update({
            "category": cat_2d,
            "color": col_2d,
            "static_advisory": adv_2d,
            "advisory": llm_adv_2d,
            "profile": profile
        })
        
        # Backwards compatibility keys at root level for legacy single-day frontend endpoints
        forecast_data.update({
            "predicted_aqi": aqi_1d,
            "forecast_date": forecast_data["forecast_1d"]["date"],
            "category": cat_1d,
            "color": col_1d,
            "advisory": llm_adv_1d,
            "profile": profile
        })
        
        return Response(forecast_data)
        
    except ValueError as val_err:
        return Response({"error": str(val_err)}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(["GET"])
def live_aqi_view(request):
    """
    GET /api/live-aqi?city=X
    
    Returns the latest compiled station telemetry, pollutant concentrations, and derived city AQIs.
    """
    city = request.query_params.get("city", "Delhi")
    try:
        from .services import fetch_live_cpcb_data
        result = fetch_live_cpcb_data(city)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)