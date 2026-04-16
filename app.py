"""
Drone Mission Planner — Flask Backend v3
Auto-fetches real-world obstacles from OpenStreetMap via Overpass API.
Uses Shapely for geometry, geopy for distance.
"""

from flask import Flask, render_template, request, jsonify
from modules.parser import parse_command
from modules.environment import Environment
from modules.osm import fetch_obstacles
from modules.planner import generate_path, calculate_total_distance
from modules.validator import validate_mission
from shapely.geometry import mapping

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/fetch_obstacles", methods=["POST"])
def api_fetch_obstacles():
    """
    Fetch real-world obstacles from OSM for a user-drawn boundary.
    
    Accepts: { "boundary": [[lon,lat], ...] }
    Returns: GeoJSON FeatureCollection of obstacles found in the area.
    """
    data = request.get_json()
    boundary_coords = data.get("boundary")
    
    if not boundary_coords or len(boundary_coords) < 3:
        return jsonify({"error": "Need at least 3 boundary points"}), 400
    
    try:
        obstacles = fetch_obstacles(boundary_coords)
        
        # Convert to GeoJSON for the frontend
        features = []
        for obs in obstacles:
            geom = obs["geometry"]
            # Simplify complex geometries for faster frontend rendering
            if geom.geom_type in ("Polygon", "MultiPolygon") and not geom.is_empty:
                simplified = geom.simplify(0.00002, preserve_topology=True)
                if not simplified.is_empty:
                    geom = simplified
            
            features.append({
                "type": "Feature",
                "properties": {
                    "type": obs["type"],
                    "name": obs["name"],
                },
                "geometry": mapping(geom),
            })
        
        # Count by type
        type_counts = {}
        for f in features:
            t = f["properties"]["type"]
            type_counts[t] = type_counts.get(t, 0) + 1
        
        return jsonify({
            "type": "FeatureCollection",
            "features": features,
            "count": len(features),
            "type_counts": type_counts,
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch obstacles: {str(e)}"}), 500


@app.route("/api/plan", methods=["POST"])
def plan_mission():
    """
    Plan a drone mission.
    
    Accepts: {
        "command": "Survey the area at 30m and avoid river",
        "boundary": [[lon,lat], ...],
        "obstacles": [{"type","name","coordinates"}, ...],   # User-drawn
        "osm_obstacles": true/false                          # Whether to also fetch OSM data
    }
    """
    data = request.get_json()
    
    if not data or "command" not in data:
        return jsonify({"error": "Missing 'command' field"}), 400
    
    command = data["command"].strip()
    if not command:
        return jsonify({"error": "Command cannot be empty"}), 400
    
    boundary_coords = data.get("boundary")
    user_obstacles = data.get("obstacles", [])
    use_osm = data.get("osm_obstacles", True)
    
    if not boundary_coords or len(boundary_coords) < 3:
        return jsonify({"error": "Please draw an operational boundary on the map first."}), 400
    
    try:
        # Build environment from user-drawn geometry
        env = Environment.from_drawn(boundary_coords, user_obstacles)
        
        # Auto-fetch real-world obstacles from OSM
        if use_osm:
            try:
                osm_obstacles = fetch_obstacles(boundary_coords)
                for obs in osm_obstacles:
                    env.add_obstacle(obs)
            except Exception as e:
                print(f"[WARNING] OSM fetch failed, continuing without: {e}")
        
        # Step 1: Parse command
        mission = parse_command(command)
        
        # Step 2: Get obstacles to avoid
        avoid_geom = env.get_all_obstacle_union(mission.get("constraints", []))
        
        # Always avoid no-fly zones
        if avoid_geom is None:
            nfz = env.get_obstacles_by_type("no_fly_zone")
            if nfz:
                from shapely.ops import unary_union
                avoid_geom = unary_union([o["geometry"].buffer(0.0001) for o in nfz])
        
        # Step 3: Generate waypoints
        boundary = env.get_boundary()
        waypoints = generate_path(mission, boundary, avoid_geom)
        
        # Step 4: Validate
        validation = validate_mission(
            waypoints=waypoints,
            mission=mission,
            boundary=boundary,
            avoid_geom=avoid_geom,
            obstacles=env.obstacles,
        )
        
        return jsonify({
            "success": True,
            "mission": mission,
            "waypoints": waypoints,
            "validation": validation,
            "path_distance_m": calculate_total_distance(waypoints),
            "obstacles_found": len(env.obstacles),
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/examples", methods=["GET"])
def get_examples():
    return jsonify({"examples": [
        "Survey the area at 30m and avoid river",
        "Patrol the perimeter at 50m",
        "Scan at 20m avoiding building and river",
        "Map the region at 40m",
        "Sweep at 25m avoid road and powerline",
    ]})


if __name__ == "__main__":
    print("\n🚁 AeroSync — Drone Mission Planner v3")
    print("=" * 45)
    print("  📡 Real-world obstacles via OpenStreetMap")
    print("  📐 Geometry engine: Shapely")
    print("  📏 Distance: geopy + haversine")
    print("  🌍 Works on ANY area worldwide")
    print(f"  🔗 Server: http://localhost:5000")
    print("=" * 45 + "\n")
    
    app.run(debug=True, host="0.0.0.0", port=5000)
