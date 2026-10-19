from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import status
from .agent_advisory import AQIAdvisoryAgent
from .services import get_forecast, predict_raw_features, fetch_live_cpcb_data
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
    
    Returns the latest compiled station telemetry and derived city AQIs.
    """
    city = request.query_params.get("city", "Delhi")
    try:
        result = fetch_live_cpcb_data(city)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["POST"])
def model_predict_view(request):
    """
    POST /api/model-predict/
    Body: {"features": [val1, val2, ...]}
    
    Directly feeds feature inputs into the saved aqi_model.pkl to compute predictions.
    """
    try:
        features = request.data.get("features")
        if not features:
            return Response({"error": "Missing 'features' list in request payload."}, status=400)
        
        # Prediction handled safely through the service layer
        predicted_value = predict_raw_features(features)
        
        return Response({
            "status": "success",
            "predicted_aqi": round(predicted_value, 2)
        }, status=200)
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(["POST"])
def register_view(request):
    """
    POST /api/register/
    Body: {"username": "...", "email": "...", "password": "..."}
    Saves user to PostgreSQL database (auth_user table).
    """
    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.filter(email=email).exists():
        return Response({"error": "Email is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    return Response({"message": "User registered successfully.", "username": user.username}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def login_view(request):
    """
    POST /api/login/
    Body: {"username": "...", "password": "..."}
    Supports logging in with either username or email.
    """
    identifier = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not identifier or not password:
        return Response({"error": "Username/Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the entered identifier matches an email or username
    user_obj = User.objects.filter(email__iexact=identifier).first() or User.objects.filter(username__iexact=identifier).first()
    resolved_username = user_obj.username if user_obj else identifier

    # Authenticate with the resolved username
    user = authenticate(username=resolved_username, password=password)
    if user is not None:
        return Response({"message": "Login successful.", "username": user.username})
    return Response({"error": "Invalid username/email or password."}, status=status.HTTP_401_UNAUTHORIZED)

