"""
Path Planning Module
Generates drone waypoints for grid_scan and perimeter missions.
"""

import math
from shapely.geometry import Point, Polygon, LineString, MultiPolygon
from shapely.ops import unary_union


# --- Constants ---
EARTH_RADIUS = 6371000  # meters


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS * c


def meters_to_degrees_lat(meters):
    """Convert meters to approximate degrees latitude."""
    return meters / 111320.0


def meters_to_degrees_lon(meters, latitude):
    """Convert meters to approximate degrees longitude at given latitude."""
    return meters / (111320.0 * math.cos(math.radians(latitude)))


def plan_grid_scan(boundary: Polygon, altitude: float, avoid_geom=None, spacing_mult: float = 2.0):
    """
    Generate grid (zig-zag) scan waypoints within the boundary.
    
    Args:
        boundary: Shapely Polygon of the operational area
        altitude: Flight altitude in meters
        avoid_geom: Shapely geometry of obstacles to avoid (union)
        spacing_mult: Multiplier for grid spacing (spacing = altitude * spacing_mult)
    
    Returns:
        List of {"lat", "lon", "alt"} waypoints
    """
    if boundary is None:
        return []
    
    bounds = boundary.bounds  # (minlon, minlat, maxlon, maxlat)
    min_lon, min_lat, max_lon, max_lat = bounds
    
    # Grid spacing based on altitude (higher = wider spacing for camera FOV)
    spacing_m = altitude * spacing_mult
    center_lat = (min_lat + max_lat) / 2
    
    dlat = meters_to_degrees_lat(spacing_m)
    dlon = meters_to_degrees_lon(spacing_m, center_lat)
    
    waypoints = []
    row = 0
    lat = min_lat + dlat / 2  # Start half-spacing inside
    
    while lat <= max_lat:
        if row % 2 == 0:
            # Left to right
            lon = min_lon + dlon / 2
            while lon <= max_lon:
                _try_add_waypoint(waypoints, lat, lon, altitude, boundary, avoid_geom)
                lon += dlon
        else:
            # Right to left (zig-zag)
            lon = max_lon - dlon / 2
            while lon >= min_lon:
                _try_add_waypoint(waypoints, lat, lon, altitude, boundary, avoid_geom)
                lon -= dlon
        
        lat += dlat
        row += 1
    
    return waypoints


def plan_perimeter(boundary: Polygon, altitude: float, avoid_geom=None, point_spacing_m: float = 30.0):
    """
    Generate perimeter patrol waypoints along the boundary edge.
    
    Args:
        boundary: Shapely Polygon  
        altitude: Flight altitude in meters
        avoid_geom: Shapely geometry of obstacles to avoid
        point_spacing_m: Distance between waypoints along perimeter in meters
    
    Returns:
        List of {"lat", "lon", "alt"} waypoints
    """
    if boundary is None:
        return []
    
    # Inset the boundary slightly so drone stays inside
    inset_m = 5  # 5m inside the boundary
    center_lat = boundary.centroid.y
    inset_deg = meters_to_degrees_lat(inset_m)
    inset_boundary = boundary.buffer(-inset_deg)
    
    if inset_boundary.is_empty:
        inset_boundary = boundary
    
    # Get perimeter as a line and interpolate points
    if isinstance(inset_boundary, MultiPolygon):
        perimeter_line = inset_boundary.geoms[0].exterior
    else:
        perimeter_line = inset_boundary.exterior
    
    total_length = perimeter_line.length
    spacing_deg = meters_to_degrees_lat(point_spacing_m)
    num_points = max(4, int(total_length / spacing_deg))
    
    waypoints = []
    for i in range(num_points):
        fraction = i / num_points
        point = perimeter_line.interpolate(fraction, normalized=True)
        lat, lon = point.y, point.x
        
        # Check obstacle avoidance
        if avoid_geom and avoid_geom.contains(Point(lon, lat)):
            continue
        
        waypoints.append({
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "alt": altitude,
        })
    
    # Close the loop — add the first point at the end
    if waypoints:
        waypoints.append(waypoints[0].copy())
    
    return waypoints


def plan_point_inspect(boundary: Polygon, altitude: float, avoid_geom=None):
    """
    Generate a simple hover-inspect mission at the center of the area.
    
    Returns:
        List of {"lat", "lon", "alt"} waypoints (just the center + approach)
    """
    if boundary is None:
        return []
    
    center = boundary.centroid
    center_lat, center_lon = center.y, center.x
    
    # Create a small approach pattern — fly to center from boundary edge
    approach = boundary.exterior.interpolate(0)
    
    waypoints = [
        {"lat": round(approach.y, 6), "lon": round(approach.x, 6), "alt": altitude},
        {"lat": round(center_lat, 6), "lon": round(center_lon, 6), "alt": altitude},
    ]
    
    return waypoints


def _try_add_waypoint(waypoints, lat, lon, alt, boundary, avoid_geom):
    """Add waypoint only if it's inside boundary and outside obstacles."""
    point = Point(lon, lat)
    
    if not boundary.contains(point):
        return
    
    if avoid_geom and avoid_geom.contains(point):
        return
    
    waypoints.append({
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "alt": alt,
    })


def calculate_total_distance(waypoints: list) -> float:
    """Calculate total path distance in meters."""
    total = 0.0
    for i in range(1, len(waypoints)):
        total += haversine_distance(
            waypoints[i - 1]["lat"], waypoints[i - 1]["lon"],
            waypoints[i]["lat"], waypoints[i]["lon"]
        )
    return round(total, 1)


def generate_path(mission: dict, boundary: Polygon, avoid_geom=None) -> list:
    """
    Main entry point for path generation.
    
    Args:
        mission: Parsed mission dict from parser (mission_type, altitude, etc.)
        boundary: Operational area polygon
        avoid_geom: Union of obstacles to avoid
    
    Returns:
        List of waypoint dicts
    """
    mission_type = mission.get("mission_type", "grid_scan")
    altitude = mission.get("altitude", 30)
    
    if mission_type == "grid_scan":
        return plan_grid_scan(boundary, altitude, avoid_geom)
    elif mission_type == "perimeter":
        return plan_perimeter(boundary, altitude, avoid_geom)
    elif mission_type == "point_inspect":
        return plan_point_inspect(boundary, altitude, avoid_geom)
    else:
        return plan_grid_scan(boundary, altitude, avoid_geom)
