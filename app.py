import streamlit as st
from agent_advisory import AQIAdvisoryAgent

# -------------------------------------------------------------------
# Page Configuration
# -------------------------------------------------------------------
st.set_page_config(
    page_title="AI AQI Forecast & Advisory System",
    page_icon="🫁",
    layout="centered"
)

st.title("🫁 AI AQI Forecast & Health Advisory System")
st.caption("Hybrid ML System (Prophet Models + OpenAQ Real-Time Sensor API)")

# -------------------------------------------------------------------
# Load Agent Instance
# -------------------------------------------------------------------
@st.cache_resource
def load_agent():
    return AQIAdvisoryAgent()

agent = load_agent()

# -------------------------------------------------------------------
# Input Controls
# -------------------------------------------------------------------
st.subheader("Select Parameters")
col1, col2 = st.columns(2)

with col1:
    city = st.selectbox(
        "Target City",
        ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Ahmedabad", "Kolkata"]
    )

with col2:
    profile = st.selectbox(
        "User Profile",
        ["Asthma", "Outdoor Worker", "General Public"]
    )

st.markdown("---")

# -------------------------------------------------------------------
# Prediction Execution
# -------------------------------------------------------------------
if st.button("Generate Forecast & Health Advisory", type="primary", use_container_width=True):
    with st.spinner(f"Fetching OpenAQ sensor data and computing Prophet trend for {city}..."):
        try:
            predicted_aqi, forecast_date = agent.predict_tomorrow_aqi(city=city)
            category, color, advice = agent.generate_health_advisory(predicted_aqi, profile, city_name=city)
            hindi_translation = agent.mock_bhashini_translate(advice, target_language="Hindi")

            # Success Header
            st.markdown(f"### Forecast Results for {city}")
            st.caption(f"Target Forecast Date: **{forecast_date}**")

            # Metrics Section
            m_col1, m_col2 = st.columns(2)
            with m_col1:
                st.metric(label="Predicted AQI Tomorrow", value=predicted_aqi)
            with m_col2:
                st.metric(label="CPCB Category Band", value=f"{category}", delta=f"Color: {color}")

            st.markdown("---")

            # Actionable Advisories
            st.markdown("### Actionable Health Guidance")
            st.info(f"**Personalized Guidance ({profile}):**\n\n{advice}")
            st.success(f"**Bhashini Regional Output (Hindi):**\n\n{hindi_translation}")

        except FileNotFoundError as fnf_err:
            st.error(f"Model File Error: {fnf_err}")
        except Exception as e:
            st.error(f"An unexpected error occurred: {e}")