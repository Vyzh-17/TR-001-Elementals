"""
Rule-Based NLP Parser Module
Converts natural language drone commands into structured mission JSON.

Supported patterns:
  - "survey/scan the area at <N>m" → grid_scan
  - "patrol/fly the perimeter at <N>m" → perimeter
  - "avoid <obstacle>" → constraints
  - "inspect point at <lat>,<lon>" → point_inspect
"""

import re


# --- Keyword Mappings ---
MISSION_KEYWORDS = {
    "grid_scan": [
        r"\bsurvey\b", r"\bscan\b", r"\bgrid\b", r"\bsearch\b",
        r"\bmap\b", r"\bmapping\b", r"\bcover\b", r"\bsweep\b"
    ],
    "perimeter": [
        r"\bpatrol\b", r"\bperimeter\b", r"\bboundary\b",
        r"\bcircle\b", r"\bfence\b", r"\bedge\b"
    ],
    "point_inspect": [
        r"\binspect\b", r"\bcheck\b", r"\blook\s*at\b",
        r"\bexamine\b", r"\bmonitor\b"
    ]
}

OBSTACLE_KEYWORDS = [
    "river", "lake", "pond", "water",
    "building", "tower", "structure", "house",
    "tree", "forest", "vegetation",
    "road", "highway",
    "powerline", "power line", "wire",
    "no-fly", "no fly", "restricted"
]

# --- Altitude Extraction ---
ALTITUDE_PATTERNS = [
    r"at\s+(\d+)\s*(?:m|meters?|metres?)",
    r"(\d+)\s*(?:m|meters?|metres?)\s+(?:altitude|alt|height|high)",
    r"altitude\s+(?:of\s+)?(\d+)",
    r"height\s+(?:of\s+)?(\d+)",
    r"fly\s+(?:at\s+)?(\d+)\s*m",
]

# --- Constraint Extraction ---
AVOID_PATTERNS = [
    r"avoid(?:ing)?\s+(?:the\s+)?(.+?)(?:\s+and\s+|\s*,\s*|\s*$)",
    r"stay\s+(?:away\s+)?from\s+(?:the\s+)?(.+?)(?:\s+and\s+|\s*,\s*|\s*$)",
    r"don'?t\s+(?:fly\s+)?(?:over|near|through)\s+(?:the\s+)?(.+?)(?:\s+and\s+|\s*,\s*|\s*$)",
    r"skip\s+(?:the\s+)?(.+?)(?:\s+and\s+|\s*,\s*|\s*$)",
]

# --- Speed Extraction ---
SPEED_PATTERNS = [
    r"at\s+(\d+)\s*(?:m/s|ms)",
    r"speed\s+(?:of\s+)?(\d+)",
    r"(\d+)\s*(?:m/s)\s+speed",
]


def parse_mission_type(text: str) -> str:
    """Detect mission type from natural language."""
    text_lower = text.lower()
    
    scores = {}
    for mission_type, patterns in MISSION_KEYWORDS.items():
        score = sum(1 for p in patterns if re.search(p, text_lower))
        if score > 0:
            scores[mission_type] = score
    
    if scores:
        return max(scores, key=scores.get)
    
    # Default to grid_scan
    return "grid_scan"


def parse_altitude(text: str) -> int:
    """Extract altitude in meters from text. Default: 30m."""
    text_lower = text.lower()
    
    for pattern in ALTITUDE_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            alt = int(match.group(1))
            return max(10, min(alt, 120))  # Clamp to 10-120m
    
    return 30  # Default altitude


def parse_constraints(text: str) -> list:
    """Extract obstacle constraints (things to avoid)."""
    text_lower = text.lower()
    constraints = []
    
    # Try avoid patterns first
    for pattern in AVOID_PATTERNS:
        matches = re.finditer(pattern, text_lower)
        for match in matches:
            phrase = match.group(1).strip()
            # Match against known obstacle keywords
            for keyword in OBSTACLE_KEYWORDS:
                if keyword in phrase:
                    canonical = _canonicalize_obstacle(keyword)
                    if canonical not in constraints:
                        constraints.append(canonical)
    
    # Also scan for obstacle keywords directly after "avoid" type words
    if not constraints:
        for keyword in OBSTACLE_KEYWORDS:
            if keyword in text_lower:
                # Check if it's in an avoidance context
                avoid_context = re.search(
                    rf"(?:avoid|skip|no|without|except)\s.*{re.escape(keyword)}",
                    text_lower
                )
                if avoid_context:
                    canonical = _canonicalize_obstacle(keyword)
                    if canonical not in constraints:
                        constraints.append(canonical)
    
    return constraints


def parse_speed(text: str) -> float:
    """Extract speed in m/s. Default: 5.0 m/s."""
    text_lower = text.lower()
    
    for pattern in SPEED_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            speed = float(match.group(1))
            return max(1.0, min(speed, 20.0))  # Clamp 1-20 m/s
    
    return 5.0


def _canonicalize_obstacle(keyword: str) -> str:
    """Map obstacle keywords to canonical names used in GeoJSON."""
    mapping = {
        "river": "river", "lake": "water", "pond": "water", "water": "water",
        "building": "building", "tower": "building", "structure": "building",
        "house": "building",
        "tree": "vegetation", "forest": "vegetation", "vegetation": "vegetation",
        "road": "road", "highway": "road",
        "powerline": "powerline", "power line": "powerline", "wire": "powerline",
        "no-fly": "no_fly_zone", "no fly": "no_fly_zone", "restricted": "no_fly_zone",
    }
    return mapping.get(keyword, keyword)


def parse_command(text: str) -> dict:
    """
    Main entry point: parse a natural language command into structured mission data.
    
    Input:  "Survey the area at 30m and avoid river"
    Output: {
        "raw_input": "Survey the area at 30m and avoid river",
        "mission_type": "grid_scan",
        "altitude": 30,
        "speed": 5.0,
        "constraints": ["river"]
    }
    """
    result = {
        "raw_input": text,
        "mission_type": parse_mission_type(text),
        "altitude": parse_altitude(text),
        "speed": parse_speed(text),
        "constraints": parse_constraints(text),
    }
    
    return result


# --- Quick test ---
if __name__ == "__main__":
    tests = [
        "Survey the area at 30m and avoid river",
        "Patrol the perimeter at 50m",
        "Scan at 20m avoiding building and river",
        "Inspect the area at 45 meters, stay away from the no-fly zone",
        "Map the region at 60m speed 8m/s skip the forest",
    ]
    
    for t in tests:
        print(f"\nInput: {t}")
        result = parse_command(t)
        import json
        print(f"Output: {json.dumps(result, indent=2)}")
