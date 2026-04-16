"""
OSM Module v2 — Accurate real-world obstacle fetching from OpenStreetMap.
Uses a single combined Overpass query for speed.
Properly handles relations, multipolygons, and linear features with realistic buffers.
"""

import requests
import math
from shapely.geometry import Polygon, LineString, MultiPolygon, Point, mapping
from shapely.ops import unary_union, polygonize
from shapely.validation import make_valid

# Overpass API endpoints (fallback list)
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Buffer widths in meters for linear features
RIVER_BUFFER_M = 15      # Rivers/streams get 15m buffer
ROAD_BUFFER_M = 12        # Major roads get 12m buffer
POWERLINE_BUFFER_M = 20   # Power lines get 20m buffer (danger zone)
RAILWAY_BUFFER_M = 15     # Railways get 15m buffer

# Minimum area thresholds (sq degrees) to filter noise
MIN_BUILDING_AREA = 1e-10   # ~1 sq meter
MIN_WATER_AREA = 1e-10


def meters_to_degrees(meters, latitude):
    """Convert meters to approximate degrees at a given latitude."""
    lat_deg = meters / 111320.0
    lon_deg = meters / (111320.0 * math.cos(math.radians(latitude)))
    return (lat_deg + lon_deg) / 2  # Average for buffer


def fetch_obstacles(boundary_coords, timeout=30):
    """
    Fetch real-world obstacles from OSM for the given boundary area.
    
    Args:
        boundary_coords: List of [lon, lat] forming boundary polygon
        timeout: Overpass API timeout
    
    Returns:
        List of obstacle dicts with Shapely geometries
    """
    if not boundary_coords or len(boundary_coords) < 3:
        return []
    
    lats = [c[1] for c in boundary_coords]
    lons = [c[0] for c in boundary_coords]
    south, north = min(lats), max(lats)
    west, east = min(lons), max(lons)
    center_lat = (south + north) / 2
    
    # Pad bounding box by ~50m
    pad = meters_to_degrees(50, center_lat)
    bbox = f"{south-pad},{west-pad},{north+pad},{east+pad}"
    
    # Single combined query for ALL obstacle types
    query = f"""
    [out:json][timeout:{timeout}][bbox:{bbox}];
    (
      // Buildings
      way["building"];
      relation["building"];
      
      // Water: areas
      way["natural"="water"];
      relation["natural"="water"];
      way["water"];
      relation["water"];
      way["waterway"="riverbank"];
      relation["waterway"="riverbank"];
      way["landuse"~"reservoir|basin"];
      way["natural"="wetland"];
      
      // Water: linear (rivers, streams, canals, drains)
      way["waterway"~"river|stream|canal|drain|ditch"];
      
      // Major roads
      way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|secondary"];
      
      // Power infrastructure
      way["power"~"line|minor_line|cable"];
      node["power"="tower"];
      node["power"="pole"];
      
      // Railways
      way["railway"~"rail|light_rail|subway"];
      
      // Amenities that are tall/dangerous
      way["man_made"~"tower|chimney|mast|silo|water_tower"];
      node["man_made"~"tower|chimney|mast|silo|water_tower"];
      way["building"="church"]["building:levels"];
    );
    out body geom;
    """
    
    data = _overpass_query(query, timeout)
    if not data:
        return []
    
    elements = data.get("elements", [])
    print(f"[OSM] Raw elements fetched: {len(elements)}")
    
    boundary_poly = Polygon(boundary_coords)
    if not boundary_poly.is_valid:
        boundary_poly = make_valid(boundary_poly)
    boundary_buffered = boundary_poly.buffer(pad)
    
    obstacles = []
    
    for element in elements:
        try:
            obs = _process_element(element, center_lat)
            if obs is None:
                continue
            
            geom = obs["geometry"]
            if geom is None or geom.is_empty:
                continue
            
            # Make geometry valid
            if not geom.is_valid:
                geom = make_valid(geom)
                if geom.is_empty:
                    continue
            
            # Clip to boundary area
            if boundary_buffered.intersects(geom):
                clipped = geom.intersection(boundary_buffered)
                if not clipped.is_empty:
                    # For MultiPolygon results, extract the largest polygon
                    if clipped.geom_type == 'GeometryCollection':
                        polys = [g for g in clipped.geoms if g.geom_type in ('Polygon', 'MultiPolygon')]
                        if polys:
                            clipped = max(polys, key=lambda g: g.area)
                        else:
                            continue
                    
                    obs["geometry"] = clipped
                    obstacles.append(obs)
        except Exception as e:
            continue
    
    # Merge overlapping buildings to reduce clutter
    obstacles = _merge_nearby_obstacles(obstacles)
    
    print(f"[OSM] Final obstacles after processing: {len(obstacles)}")
    _print_summary(obstacles)
    return obstacles


def _process_element(element, center_lat):
    """Process a single OSM element into an obstacle dict."""
    tags = element.get("tags", {})
    etype = element.get("type")  # node, way, relation
    
    # --- Buildings ---
    if "building" in tags:
        geom = _build_polygon(element)
        if geom and geom.area > MIN_BUILDING_AREA:
            name = tags.get("name", "")
            btype = tags.get("building", "yes")
            if not name or name == "yes":
                name = _building_name(tags)
            return {
                "name": name,
                "type": "building",
                "geometry": geom,
                "properties": {"building": btype, "levels": tags.get("building:levels", "")},
            }
    
    # --- Water areas ---
    if tags.get("natural") == "water" or tags.get("water") or \
       tags.get("waterway") == "riverbank" or \
       tags.get("landuse") in ("reservoir", "basin") or \
       tags.get("natural") == "wetland":
        geom = _build_polygon(element)
        if geom and geom.area > MIN_WATER_AREA:
            name = tags.get("name", "")
            if not name:
                if tags.get("water"):
                    name = tags["water"].replace("_", " ").title()
                elif tags.get("natural") == "wetland":
                    name = "Wetland"
                elif tags.get("landuse") == "reservoir":
                    name = "Reservoir"
                else:
                    name = "Water Body"
            return {
                "name": name,
                "type": "river",
                "geometry": geom,
                "properties": {"water_type": tags.get("water", tags.get("natural", ""))},
            }
    
    # --- Water lines (rivers, streams) ---
    if tags.get("waterway") in ("river", "stream", "canal", "drain", "ditch"):
        buf = meters_to_degrees(RIVER_BUFFER_M, center_lat)
        geom = _build_line_buffer(element, buf)
        if geom:
            name = tags.get("name", "")
            if not name:
                name = tags.get("waterway", "river").title()
            return {
                "name": name,
                "type": "river",
                "geometry": geom,
                "properties": {"waterway": tags.get("waterway", "")},
            }
    
    # --- Roads ---
    if "highway" in tags:
        hw = tags["highway"]
        buf = meters_to_degrees(ROAD_BUFFER_M, center_lat)
        geom = _build_line_buffer(element, buf)
        if geom:
            name = tags.get("name", "")
            if not name:
                name = hw.replace("_", " ").title()
            return {
                "name": name,
                "type": "road",
                "geometry": geom,
                "properties": {"highway": hw},
            }
    
    # --- Power lines ---
    if tags.get("power") in ("line", "minor_line", "cable"):
        buf = meters_to_degrees(POWERLINE_BUFFER_M, center_lat)
        geom = _build_line_buffer(element, buf)
        if geom:
            return {
                "name": tags.get("name", "Power Line"),
                "type": "powerline",
                "geometry": geom,
                "properties": {"power": tags.get("power", "")},
            }
    
    # --- Power towers/poles (point obstacles) ---
    if etype == "node" and tags.get("power") in ("tower", "pole"):
        lat = element.get("lat")
        lon = element.get("lon")
        if lat and lon:
            buf = meters_to_degrees(10, center_lat)  # 10m radius
            geom = Point(lon, lat).buffer(buf)
            return {
                "name": tags.get("name", f"Power {tags['power'].title()}"),
                "type": "powerline",
                "geometry": geom,
                "properties": {"power": tags["power"]},
            }
    
    # --- Railways ---
    if "railway" in tags:
        buf = meters_to_degrees(RAILWAY_BUFFER_M, center_lat)
        geom = _build_line_buffer(element, buf)
        if geom:
            return {
                "name": tags.get("name", "Railway"),
                "type": "road",  # treat railways like roads for avoidance
                "geometry": geom,
                "properties": {"railway": tags.get("railway", "")},
            }
    
    # --- Tall structures (towers, chimneys) ---
    if tags.get("man_made") in ("tower", "chimney", "mast", "silo", "water_tower"):
        if etype == "node":
            lat, lon = element.get("lat"), element.get("lon")
            if lat and lon:
                buf = meters_to_degrees(15, center_lat)
                geom = Point(lon, lat).buffer(buf)
                return {
                    "name": tags.get("name", tags["man_made"].replace("_", " ").title()),
                    "type": "building",
                    "geometry": geom,
                    "properties": {"man_made": tags["man_made"]},
                }
        else:
            geom = _build_polygon(element)
            if geom:
                return {
                    "name": tags.get("name", tags["man_made"].replace("_", " ").title()),
                    "type": "building",
                    "geometry": geom,
                    "properties": {"man_made": tags["man_made"]},
                }
    
    return None


def _build_polygon(element):
    """Build a Shapely polygon from an OSM way or relation."""
    etype = element.get("type")
    
    if etype == "way":
        geom_data = element.get("geometry", [])
        if len(geom_data) >= 3:
            coords = [(p["lon"], p["lat"]) for p in geom_data]
            try:
                poly = Polygon(coords)
                if not poly.is_valid:
                    poly = make_valid(poly)
                if poly.geom_type == 'MultiPolygon':
                    # Return largest polygon
                    return max(poly.geoms, key=lambda g: g.area)
                return poly if not poly.is_empty else None
            except Exception:
                return None
    
    elif etype == "relation":
        return _build_relation_polygon(element)
    
    return None


def _build_relation_polygon(element):
    """
    Build polygon from OSM relation (multipolygon).
    Properly handles outer and inner rings.
    """
    members = element.get("members", [])
    
    outer_rings = []
    inner_rings = []
    
    for member in members:
        role = member.get("role", "outer")
        geom_data = member.get("geometry", [])
        
        if not geom_data or len(geom_data) < 2:
            continue
        
        coords = [(p["lon"], p["lat"]) for p in geom_data]
        
        if role == "outer":
            outer_rings.append(coords)
        elif role == "inner":
            inner_rings.append(coords)
    
    if not outer_rings:
        return None
    
    # Try to merge outer ring segments (they may be split across members)
    merged_outer = _merge_ring_segments(outer_rings)
    merged_inner = _merge_ring_segments(inner_rings) if inner_rings else []
    
    polygons = []
    for ring in merged_outer:
        if len(ring) < 3:
            continue
        try:
            # Close ring if not closed
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            
            # Find inner rings that fall inside this outer ring
            outer_poly = Polygon(ring)
            if not outer_poly.is_valid:
                outer_poly = make_valid(outer_poly)
            
            holes = []
            for inner in merged_inner:
                if len(inner) >= 3:
                    if inner[0] != inner[-1]:
                        inner.append(inner[0])
                    try:
                        inner_poly = Polygon(inner)
                        if outer_poly.contains(inner_poly.centroid):
                            holes.append(inner)
                    except Exception:
                        pass
            
            if holes:
                poly = Polygon(ring, holes)
            else:
                poly = Polygon(ring)
            
            if not poly.is_valid:
                poly = make_valid(poly)
            
            if not poly.is_empty:
                polygons.append(poly)
        except Exception:
            continue
    
    if not polygons:
        return None
    
    if len(polygons) == 1:
        return polygons[0]
    
    # Return union of all outer polygons
    try:
        return unary_union(polygons)
    except Exception:
        return polygons[0]


def _merge_ring_segments(segments):
    """
    Merge OSM way segments that share endpoints into complete rings.
    OSM relations often split rings across multiple way members.
    """
    if not segments:
        return []
    
    # If any segment is already a closed ring, keep it
    complete = []
    open_segs = []
    
    for seg in segments:
        if len(seg) >= 3 and seg[0] == seg[-1]:
            complete.append(seg)
        elif len(seg) >= 2:
            open_segs.append(list(seg))
    
    # Try to stitch open segments together
    while open_segs:
        current = open_segs.pop(0)
        changed = True
        
        while changed:
            changed = False
            remaining = []
            
            for seg in open_segs:
                # Check if seg connects to end of current
                if _coords_close(current[-1], seg[0]):
                    current.extend(seg[1:])
                    changed = True
                elif _coords_close(current[-1], seg[-1]):
                    current.extend(reversed(seg[:-1]))
                    changed = True
                elif _coords_close(current[0], seg[-1]):
                    current = seg[:-1] + current
                    changed = True
                elif _coords_close(current[0], seg[0]):
                    current = list(reversed(seg[1:])) + current
                    changed = True
                else:
                    remaining.append(seg)
            
            open_segs = remaining
        
        complete.append(current)
    
    return complete


def _coords_close(c1, c2, threshold=0.00001):
    """Check if two coordinates are approximately equal."""
    return abs(c1[0] - c2[0]) < threshold and abs(c1[1] - c2[1]) < threshold


def _build_line_buffer(element, buffer_deg):
    """Build a buffered polygon from a linear OSM way."""
    if element.get("type") != "way":
        return None
    
    geom_data = element.get("geometry", [])
    if len(geom_data) < 2:
        return None
    
    coords = [(p["lon"], p["lat"]) for p in geom_data]
    try:
        line = LineString(coords)
        buffered = line.buffer(buffer_deg, cap_style=2)  # flat caps
        if buffered.is_valid and not buffered.is_empty:
            return buffered
        return make_valid(buffered) if not buffered.is_empty else None
    except Exception:
        return None


def _building_name(tags):
    """Generate a readable name for a building from its tags."""
    if tags.get("amenity"):
        return tags["amenity"].replace("_", " ").title()
    if tags.get("shop"):
        return f"Shop ({tags['shop']})"
    if tags.get("office"):
        return f"Office ({tags['office']})"
    btype = tags.get("building", "yes")
    if btype != "yes":
        return btype.replace("_", " ").title()
    return "Building"


def _merge_nearby_obstacles(obstacles):
    """Merge overlapping obstacles of the same type to reduce clutter."""
    # Group by type
    groups = {}
    for obs in obstacles:
        t = obs["type"]
        if t not in groups:
            groups[t] = []
        groups[t].append(obs)
    
    result = []
    for obs_type, obs_list in groups.items():
        if obs_type == "building" and len(obs_list) > 200:
            # Too many buildings — merge clusters
            try:
                geoms = [o["geometry"] for o in obs_list if o["geometry"] and not o["geometry"].is_empty]
                merged = unary_union(geoms)
                if merged.geom_type == 'MultiPolygon':
                    for poly in merged.geoms:
                        result.append({
                            "name": "Building Cluster",
                            "type": "building",
                            "geometry": poly,
                            "properties": {"merged": True},
                        })
                else:
                    result.append({
                        "name": "Building Cluster",
                        "type": "building",
                        "geometry": merged,
                        "properties": {"merged": True},
                    })
            except Exception:
                result.extend(obs_list)
        else:
            result.extend(obs_list)
    
    return result


def _overpass_query(query, timeout=30):
    """Execute Overpass query with fallback servers."""
    for url in OVERPASS_URLS:
        try:
            response = requests.post(url, data={"data": query}, timeout=timeout + 5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            print(f"[OSM] Timeout on {url}, trying next...")
            continue
        except requests.exceptions.RequestException as e:
            print(f"[OSM] Error on {url}: {e}, trying next...")
            continue
    
    print("[OSM] All Overpass servers failed!")
    return {"elements": []}


def _print_summary(obstacles):
    """Print a summary of fetched obstacles."""
    counts = {}
    for obs in obstacles:
        t = obs["type"]
        counts[t] = counts.get(t, 0) + 1
    
    parts = [f"{v} {k}{'s' if v != 1 else ''}" for k, v in sorted(counts.items())]
    print(f"[OSM] Summary: {', '.join(parts) if parts else 'none'}")
