import os

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .agent_advisory import AQIAdvisoryAgent


@api_view(["GET"])
def forecast_view(request):
    city = request.GET.get("city", "Delhi")
    profile = request.GET.get("profile", "General Public")

    # Currently only Delhi model exists
    if city.lower() != "delhi":
        return Response(
            {
                "error": "Currently only Delhi model is available."
            },
            status=400
        )

    # Path to models/prophet_delhi.pkl
    base_dir = os.path.dirname(
        os.path.dirname(
            os.path.dirname(__file__)
        )
    )

    model_path = os.path.join(
        base_dir,
        "models",
        "prophet_delhi.pkl"
    )

    # Load AI Agent
    agent = AQIAdvisoryAgent(model_path)

    predicted_aqi, forecast_date = agent.predict_tomorrow_aqi()

    category, color, advisory = agent.generate_health_advisory(
        predicted_aqi,
        profile
    )

    return Response({
        "city": city,
        "forecast_date": forecast_date,
        "predicted_aqi": predicted_aqi,
        "category": category,
        "color": color,
        "profile": profile,
        "advisory": advisory
    })