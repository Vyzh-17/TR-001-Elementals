import os
import json
from flask import Flask, request, jsonify, send_from_directory
import google.generativeai as genai
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app) # Enable Cross-Origin Resource Sharing

# Attempt to configure Gemini if environment variable is present
# Integrated User API Key
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

SYSTEM_PROMPT = """You are an advanced Autonomous Drone Mission Planning AI.

Your task is to convert natural language mission descriptions into an optimized, safe, and battery-efficient drone flight plan.

## 🚁 Drone Capabilities (Anti-Gravity Enabled)
- The drone has anti-gravity technology:
  - Near-zero energy consumption during hovering
  - Highly efficient vertical ascent and descent
  - Smooth 3D movement with minimal drag
- Energy is primarily consumed during horizontal movement and acceleration

## 🎯 Objectives
1. Convert the mission into a structured flight plan
2. Optimize trajectory to minimize battery usage
3. Ensure safe navigation in 3D space
4. Validate feasibility based on constraints
5. Ensure mission completion within battery limits

## 🧠 Planning Strategy (VERY IMPORTANT)
- Prefer vertical ascent first, then minimal horizontal traversal
- Use hovering (anti-gravity) for scanning instead of continuous movement
- Minimize sharp turns and unnecessary path deviations
- Use shortest-path routing (Euclidean distance or grid-based pathfinding)
- Avoid re-visiting the same coordinates
- Plan an energy-efficient return path
- Keep a minimum 20% battery reserve for safety

## ⚠️ Constraints & Environment
- Do NOT exceed max altitude
- Maintain at least 5m distance from obstacles
- Avoid restricted airspace zones (if provided)
- **Extreme Weather**: If temperature > 40°C or Humidity > 80%, recommend shorter segments to avoid motor overheating.
- **Air Density**: Account for higher battery drain in extreme heat (lower lift).
- Ensure full return-to-base capability
- Abort or adjust mission if battery is insufficient

## Output Generation
Return ONLY structured JSON in the following format:
{
  "mission_summary": {
    "type": "...",
    "area": "...",
    "strategy": "battery-optimized anti-gravity trajectory"
  },
  "flight_plan": {
    "waypoints": [
      {
        "lat": 0.0,
        "lon": 0.0,
        "alt": 0.0,
        "action": "ascend | move | hover | scan | return"
      }
    ],
    "speed_profile": [
      {
        "segment": 1,
        "speed": 0.0
      }
    ]
  },
  "energy_analysis": {
    "estimated_usage_percentage": 0.0,
    "optimization_notes": "...",
    "hover_efficiency_used": true
  },
  "feasibility_report": {
    "battery_ok": true,
    "collision_risk": "low",
    "altitude_ok": true,
    "mission_time_minutes": 0,
    "return_safe": true,
    "warnings": []
  }
}"""

OPTIMIZE_SYSTEM_PROMPT = """You are a drone trajectory optimization engine.

Your task is to take an already generated flight trajectory and optimize it for maximum battery efficiency without violating mission constraints.

## 🎯 Objectives
- Reduce total energy consumption
- Ensure mission completes within battery limits
- Preserve mission intent and coverage
- Maintain safe return-to-base

## 🧠 Optimization Strategy
Apply the following improvements:

1. Path Optimization:
   - Remove redundant or overlapping waypoints
   - Replace zig-zag paths with smoother curves or straight segments
   - Minimize total horizontal distance traveled

2. Movement Optimization:
   - Prefer vertical ascent/descent over long horizontal detours
   - Reduce unnecessary altitude fluctuations
   - Use constant altitude where possible

3. Hover Optimization:
   - Replace slow movement-based scanning with hover + scan actions
   - Insert hover points instead of continuous traversal when applicable

4. Speed Optimization:
   - Use optimal speed (not always max speed) to reduce energy spikes
   - Slow down near dense waypoints or obstacles

5. Turn Optimization:
   - Reduce sharp turns
   - Smooth trajectory transitions

6. Return Path Optimization:
   - Ensure shortest energy-efficient return path
   - Reserve at least 20% battery for return

## 🔋 Energy Calculation
- Estimate total energy usage based on:
  - Distance traveled (horizontal vs vertical)
  - Number of turns
  - Speed variations
- Ensure: total_energy_usage ≤ 80% of battery capacity

## ⚠️ Constraints
- Do NOT change mission objective
- Do NOT violate: Max altitude, Obstacle avoidance rules, Restricted zones
- Maintain waypoint coverage of target area

## 📤 Output Format (STRICT JSON ONLY)
{
  "optimized_flight_plan": {
    "waypoints": [...],
    "modifications": [
      ...
    ]
  },
  "energy_comparison": {
    "original_usage_percentage": ...,
    "optimized_usage_percentage": ...,
    "savings_percentage": ...
  },
  "feasibility": {
    "battery_ok": true,
    "return_safe": true,
    "notes": "..."
  }
}"""

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/plan', methods=['POST'])
def plan_mission():
    data = request.json
    mission_description = data.get('mission_description', '')
    max_altitude = data.get('max_altitude', 120)
    max_speed = data.get('max_speed', 15)
    battery_minutes = data.get('battery_minutes', 30)

    temperature = data.get('temperature', 25)
    humidity = data.get('humidity', 40)

    user_input = f"""Mission Description: {mission_description}

Drone Specifications:
- Max Altitude: {max_altitude} meters
- Max Speed: {max_speed} m/s
- Battery Capacity: {battery_minutes} minutes
- Temperature: {temperature}°C
- Humidity: {humidity}%
- Energy Consumption Model: Horizontal movement HIGH energy, Vertical LOW energy, Hovering NEGLIGIBLE energy.
"""

    if not api_key:
        return jsonify({
            "mission_summary": {
                "type": "Simulation",
                "area": "Local Origin",
                "strategy": "battery-optimized anti-gravity trajectory (MOCK)"
            },
            "flight_plan": {
                "waypoints": [
                    {"lat": 10.003, "lon": 78.003, "alt": max_altitude * 0.1, "action": "ascend"},
                    {"lat": 10.005, "lon": 78.005, "alt": max_altitude * 0.8, "action": "move"},
                    {"lat": 10.007, "lon": 78.007, "alt": max_altitude * 0.8, "action": "scan"},
                    {"lat": 10.005, "lon": 78.005, "alt": max_altitude * 0.2, "action": "hover"},
                    {"lat": 10.003, "lon": 78.003, "alt": max_altitude * 0.1, "action": "return"}
                ],
                "speed_profile": [{"segment": 1, "speed": max_speed * 0.5}]
            },
            "energy_analysis": {
                "estimated_usage_percentage": 18.5,
                "optimization_notes": "Mock mode: using vertical ascent and efficient hover. Set GEMINI_API_KEY environment variable for real AI generation.",
                "hover_efficiency_used": True
            },
            "feasibility_report": {
                "battery_ok": True,
                "collision_risk": "low",
                "altitude_ok": True,
                "mission_time_minutes": int(battery_minutes * 0.5),
                "return_safe": True,
                "warnings": ["NO GEMINI_API_KEY DETECTED - USING MOCK GENERATION."]
            }
        })

    try:
        model = genai.GenerativeModel(model_name='gemini-1.5-flash',
                                      system_instruction=SYSTEM_PROMPT,
                                      generation_config={"response_mime_type": "application/json"})
        response = model.generate_content(user_input)
        return jsonify(json.loads(response.text))
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Quota" in error_msg:
            return jsonify({
                "mission_summary": {
                    "type": "Simulation",
                    "area": "Rate Limited Region",
                    "strategy": "Quota Exceeded - Using Mock Anti-Gravity Trajectory"
                },
                "flight_plan": {
                    "waypoints": [
                        {"lat": 27.1751, "lon": 78.0421, "alt": 150.0, "action": "ascend"},
                        {"lat": 27.1751, "lon": 78.0421, "alt": 150.0, "action": "hover"},
                        {"lat": 27.1750, "lon": 78.0422, "alt": 150.0, "action": "scan"},
                        {"lat": 27.1751, "lon": 78.0421, "alt": 10.0, "action": "return"}
                    ],
                    "speed_profile": [{"segment": 1, "speed": 5.0}]
                },
                "energy_analysis": {
                    "estimated_usage_percentage": 25.0,
                    "optimization_notes": "API Rate Limit Exceeded. Mock plan generated to preserve UI functionality.",
                    "hover_efficiency_used": True
                },
                "feasibility_report": {
                    "battery_ok": True,
                    "collision_risk": "low",
                    "altitude_ok": True,
                    "mission_time_minutes": 15,
                    "return_safe": True,
                    "warnings": ["QUOTA EXCEEDED (429). USING CACHED MOCK TRAJECTORY."]
                }
            })
        return jsonify({"error": str(e)}), 500

@app.route('/api/optimize', methods=['POST'])
def optimize_trajectory():
    data = request.json
    flight_plan = data.get('flight_plan', {})
    battery_minutes = data.get('battery_minutes', 30)
    max_speed = data.get('max_speed', 15)

    user_input = f"""1. Existing Flight Plan (JSON):
{json.dumps(flight_plan, indent=2)}

2. Drone Specifications:
- Battery Capacity: {battery_minutes} minutes
- Max Speed: {max_speed} m/s

3. Energy Model:
- Horizontal movement → HIGH energy consumption
- Vertical movement → LOW energy consumption
- Hovering → NEGLIGIBLE energy (anti-gravity enabled)
- Turning/sharp direction changes → MODERATE energy penalty
"""

    if not api_key:
        return jsonify({
            "optimized_flight_plan": {
                "waypoints": [
                    {"lat": 0.0, "lon": 0.0, "alt": 15.0, "action": "ascend"},
                    {"lat": 0.0, "lon": 0.0, "alt": 15.0, "action": "hover"},
                    {"lat": 0.0, "lon": 0.0, "alt": 15.0, "action": "return"}
                ],
                "modifications": [
                    "MOCK: Removed overlapping waypoints",
                    "MOCK: Consolidated horizontal scan into central hover"
                ]
            },
            "energy_comparison": {
                "original_usage_percentage": 50.0,
                "optimized_usage_percentage": 25.0,
                "savings_percentage": 50.0
            },
            "feasibility": {
                "battery_ok": True,
                "return_safe": True,
                "notes": "NO GEMINI_API_KEY DETECTED - USING MOCK GENERATION."
            }
        })

    try:
        model = genai.GenerativeModel(model_name='gemini-1.5-flash',
                                      system_instruction=OPTIMIZE_SYSTEM_PROMPT,
                                      generation_config={"response_mime_type": "application/json"})
        response = model.generate_content(user_input)
        return jsonify(json.loads(response.text))
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Quota" in error_msg:
            return jsonify({
                "optimized_flight_plan": {
                    "waypoints": [
                        {"lat": 27.1751, "lon": 78.0421, "alt": 150.0, "action": "ascend"},
                        {"lat": 27.1750, "lon": 78.0422, "alt": 150.0, "action": "hover_and_scan"},
                        {"lat": 27.1750, "lon": 78.0422, "alt": 10.0, "action": "return"}
                    ],
                    "modifications": [
                        "MOCK: Eliminated redundant horizontal movement",
                        "MOCK: Consolidated scan into single efficient hover due to Rate Limit Exceeded (429)."
                    ]
                },
                "energy_comparison": {
                    "original_usage_percentage": 25.0,
                    "optimized_usage_percentage": 10.0,
                    "savings_percentage": 60.0
                },
                "feasibility": {
                    "battery_ok": True,
                    "return_safe": True,
                    "notes": "QUOTA EXCEEDED. This is a mock optimization to preserve UI functionality."
                }
            })
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Use the PORT environment variable provided by Render
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
