"""
Validation Module v2
Uses geopy for accurate distance, Shapely for collision detection.
Includes airspace rules.
"""

from shapely.geometry import Point
from geopy.distance import geodesic


# --- Default Drone Specs ---
DEFAULT_SPECS = {
    "max_range_m": 10000,        # Max flight distance on one battery
    "min_altitude_m": 10,        # Minimum safe altitude (m)
    "max_altitude_m": 120,       # Maximum legal altitude (m) — DGCA India rules
    "max_speed_mps": 15,         # Maximum speed m/s
    "min_waypoint_spacing_m": 2, # Minimum distance between waypoints
}

# --- Simulated No-Fly Zones (airports, military) ---
# These are checked in addition to OSM obstacles
KNOWN_RESTRICTED_ZONES = [
    # Major Indian airports (5km radius)
    {"name": "Chennai Airport", "lat": 12.9941, "lon": 80.1709, "radius_m": 5000},
    {"name": "Coimbatore Airport", "lat": 11.0300, "lon": 77.0434, "radius_m": 5000},
    {"name": "Mumbai Airport", "lat": 19.0896, "lon": 72.8656, "radius_m": 5000},
    {"name": "Delhi Airport", "lat": 28.5562, "lon": 77.1000, "radius_m": 5000},
    {"name": "Bangalore Airport", "lat": 13.1986, "lon": 77.7066, "radius_m": 5000},
    {"name": "Hyderabad Airport", "lat": 17.2403, "lon": 78.4294, "radius_m": 5000},
]


def calculate_total_distance_geopy(waypoints: list) -> float:
    """Calculate total path distance in meters using geopy (geodesic)."""
    total = 0.0
    for i in range(1, len(waypoints)):
        p1 = (waypoints[i-1]["lat"], waypoints[i-1]["lon"])
        p2 = (waypoints[i]["lat"], waypoints[i]["lon"])
        total += geodesic(p1, p2).meters
    return round(total, 1)


def validate_mission(waypoints: list, mission: dict, boundary=None, avoid_geom=None,
                      obstacles=None, specs: dict = None) -> dict:
    """
    Validate a complete mission.
    Returns: { "safe": bool, "warnings": [...], "errors": [...], "stats": {...} }
    """
    specs = specs or DEFAULT_SPECS
    warnings = []
    errors = []
    
    altitude = mission.get("altitude", 30)
    speed = mission.get("speed", 5.0)
    
    # --- No waypoints ---
    if not waypoints:
        errors.append("No waypoints generated. Area may be too small or blocked by obstacles.")
        return _build_result(False, warnings, errors, _empty_stats())
    
    # --- Altitude checks ---
    if altitude < specs["min_altitude_m"]:
        errors.append(f"Altitude {altitude}m below minimum ({specs['min_altitude_m']}m)")
    elif altitude > specs["max_altitude_m"]:
        errors.append(f"Altitude {altitude}m exceeds legal limit ({specs['max_altitude_m']}m) — DGCA rules")
    elif altitude < 20:
        warnings.append(f"Altitude {altitude}m is very low — ground collision risk")
    elif altitude > 100:
        warnings.append(f"Altitude {altitude}m is high — reduced survey resolution")
    
    # --- Speed ---
    if speed > specs["max_speed_mps"]:
        warnings.append(f"Speed {speed}m/s exceeds recommended max ({specs['max_speed_mps']}m/s)")
    
    # --- Distance (geopy geodesic) ---
    total_distance = calculate_total_distance_geopy(waypoints)
    battery_pct = (total_distance / specs["max_range_m"]) * 100
    
    if total_distance > specs["max_range_m"]:
        errors.append(
            f"Distance ({total_distance:.0f}m) exceeds battery range ({specs['max_range_m']}m). "
            f"Needs {battery_pct:.0f}% battery."
        )
    elif battery_pct > 80:
        warnings.append(f"Battery at {battery_pct:.0f}% — limited return reserve.")
    
    # --- Obstacle collision ---
    collision_count = 0
    if avoid_geom:
        for wp in waypoints:
            if avoid_geom.contains(Point(wp["lon"], wp["lat"])):
                collision_count += 1
    
    if collision_count > 0:
        errors.append(f"{collision_count} waypoint(s) inside obstacle zones!")
    
    # --- Boundary check ---
    out_of_bounds = 0
    if boundary:
        for wp in waypoints:
            if not boundary.contains(Point(wp["lon"], wp["lat"])):
                out_of_bounds += 1
    
    if out_of_bounds > 0:
        warnings.append(f"{out_of_bounds} waypoint(s) outside operational boundary.")
    
    # --- No-fly zone violations ---
    if obstacles:
        nfz_violations = 0
        for wp in waypoints:
            pt = Point(wp["lon"], wp["lat"])
            for obs in obstacles:
                if obs["type"] == "no_fly_zone" and obs["geometry"].contains(pt):
                    nfz_violations += 1
                    break
        if nfz_violations > 0:
            errors.append(f"{nfz_violations} waypoint(s) in NO-FLY ZONES!")
    
    # --- Airspace rules: check against known airports ---
    center_lat = sum(wp["lat"] for wp in waypoints) / len(waypoints)
    center_lon = sum(wp["lon"] for wp in waypoints) / len(waypoints)
    
    for zone in KNOWN_RESTRICTED_ZONES:
        dist = geodesic((center_lat, center_lon), (zone["lat"], zone["lon"])).meters
        if dist < zone["radius_m"]:
            errors.append(
                f"⚠️ Within {zone['radius_m']/1000:.0f}km of {zone['name']}! "
                f"Distance: {dist/1000:.1f}km. Drone flight restricted."
            )
        elif dist < zone["radius_m"] * 1.5:
            warnings.append(
                f"Near {zone['name']} ({dist/1000:.1f}km away). "
                f"Restricted zone starts at {zone['radius_m']/1000:.0f}km."
            )
    
    # --- Minimum waypoints ---
    if len(waypoints) < 2:
        warnings.append("Fewer than 2 waypoints — mission may not be useful.")
    
    # --- Stats ---
    est_time = total_distance / speed if speed > 0 else 0
    
    stats = {
        "total_distance_m": round(total_distance, 1),
        "total_distance_km": round(total_distance / 1000, 2),
        "num_waypoints": len(waypoints),
        "estimated_flight_time_s": round(est_time, 1),
        "estimated_flight_time_min": round(est_time / 60, 1),
        "battery_usage_pct": round(battery_pct, 1),
        "altitude_m": altitude,
        "speed_mps": speed,
        "collision_count": collision_count,
        "out_of_bounds_count": out_of_bounds,
    }
    
    return _build_result(len(errors) == 0, warnings, errors, stats)


def _build_result(safe, warnings, errors, stats):
    return {"safe": safe, "warnings": warnings, "errors": errors, "stats": stats}


def _empty_stats():
    return {
        "total_distance_m": 0, "total_distance_km": 0, "num_waypoints": 0,
        "estimated_flight_time_s": 0, "estimated_flight_time_min": 0,
        "battery_usage_pct": 0, "altitude_m": 0, "speed_mps": 0,
        "collision_count": 0, "out_of_bounds_count": 0,
    }
