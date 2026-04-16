"""
Environment Module v2
Supports both file-based and dynamically drawn boundaries/obstacles.
"""

import json
import os
from shapely.geometry import shape, mapping, Point, Polygon
from shapely.ops import unary_union


class Environment:
    """Manages the operational area and obstacles."""
    
    def __init__(self):
        self.boundary = None          # Shapely Polygon
        self.obstacles = []           # List of {"name", "type", "geometry" (Shapely)}
        self.no_fly_zones = []        # Subset of obstacles
    
    @classmethod
    def from_drawn(cls, boundary_coords, obstacles_raw):
        """
        Create Environment from user-drawn coordinates (from frontend).
        
        Args:
            boundary_coords: List of [lon, lat] pairs forming the boundary polygon
            obstacles_raw: List of {"type": "river", "name": "...", "coordinates": [[lon,lat],...]}
        """
        env = cls()
        
        # Parse boundary — coords are [lon, lat]
        if boundary_coords and len(boundary_coords) >= 3:
            env.boundary = Polygon(boundary_coords)
            if not env.boundary.is_valid:
                env.boundary = env.boundary.buffer(0)
        
        # Parse obstacles
        for obs in obstacles_raw:
            coords = obs.get("coordinates", [])
            if len(coords) >= 3:
                geom = Polygon(coords)
                if not geom.is_valid:
                    geom = geom.buffer(0)
                
                entry = {
                    "name": obs.get("name", obs.get("type", "obstacle")),
                    "type": obs.get("type", "unknown"),
                    "geometry": geom,
                    "properties": obs,
                }
                env.obstacles.append(entry)
                
                if obs.get("type") == "no_fly_zone":
                    env.no_fly_zones.append(entry)
        
        return env
    
    @classmethod
    def from_geojson_file(cls, geojson_path):
        """Create Environment from a GeoJSON file (legacy support)."""
        env = cls()
        
        with open(geojson_path, "r") as f:
            raw = json.load(f)
        
        for feature in raw.get("features", []):
            props = feature.get("properties", {})
            geom = shape(feature["geometry"])
            ftype = props.get("type", "unknown")
            fname = props.get("name", "unnamed")
            
            if ftype == "boundary":
                env.boundary = geom
            elif ftype == "no_fly_zone":
                entry = {"name": fname, "type": ftype, "geometry": geom, "properties": props}
                env.obstacles.append(entry)
                env.no_fly_zones.append(entry)
            else:
                env.obstacles.append({"name": fname, "type": ftype, "geometry": geom, "properties": props})
        
        return env
    
    def add_obstacle(self, obs_dict):
        """
        Add an obstacle dynamically (e.g., from OSM fetch).
        obs_dict: {"name", "type", "geometry" (Shapely), "properties"}
        """
        self.obstacles.append(obs_dict)
        if obs_dict.get("type") == "no_fly_zone":
            self.no_fly_zones.append(obs_dict)
    
    def get_boundary(self):
        return self.boundary
    
    def get_boundary_coords(self):
        if self.boundary is None:
            return []
        coords = list(self.boundary.exterior.coords)
        return [[c[1], c[0]] for c in coords]  # [lon,lat] → [lat,lon]
    
    def get_obstacles_by_type(self, obstacle_type):
        return [o for o in self.obstacles if o["type"] == obstacle_type]
    
    def get_obstacles_by_name(self, name):
        name_lower = name.lower()
        return [o for o in self.obstacles if name_lower in o["name"].lower()]
    
    def get_constraint_obstacles(self, constraints):
        matched = []
        seen = set()
        for constraint in constraints:
            for o in self.get_obstacles_by_type(constraint) + self.get_obstacles_by_name(constraint):
                key = id(o)
                if key not in seen:
                    matched.append(o)
                    seen.add(key)
        return matched
    
    def get_all_obstacle_union(self, constraints=None):
        if constraints:
            obstacles = self.get_constraint_obstacles(constraints)
        else:
            obstacles = self.no_fly_zones
        
        if not obstacles:
            return None
        
        geoms = [o["geometry"].buffer(0.0001) for o in obstacles]  # ~11m buffer
        return unary_union(geoms)
    
    def is_point_safe(self, lat, lon, avoid_geom=None):
        point = Point(lon, lat)
        if self.boundary and not self.boundary.contains(point):
            return False
        if avoid_geom and avoid_geom.contains(point):
            return False
        return True
    
    def to_frontend_geojson(self):
        features = []
        if self.boundary:
            features.append({
                "type": "Feature",
                "properties": {"type": "boundary", "name": "Operational Area"},
                "geometry": mapping(self.boundary),
            })
        for obs in self.obstacles:
            features.append({
                "type": "Feature",
                "properties": {"type": obs["type"], "name": obs["name"]},
                "geometry": mapping(obs["geometry"]),
            })
        return {"type": "FeatureCollection", "features": features}
