function generateWaypoints(data) {
  const altitude = data.altitude || 30;

  // Base location (dummy for now — Bangalore coords)
  const baseLat = 12.9716;
  const baseLon = 77.5946;

  let waypoints = [];

  // 🟢 ZIGZAG pattern (for survey)
  if (data.pattern === "zigzag") {
    waypoints = [
      { lat: baseLat, lon: baseLon, alt: altitude },
      { lat: baseLat, lon: baseLon + 0.002, alt: altitude },

      { lat: baseLat + 0.001, lon: baseLon + 0.002, alt: altitude },
      { lat: baseLat + 0.001, lon: baseLon, alt: altitude },

      { lat: baseLat + 0.002, lon: baseLon, alt: altitude },
      { lat: baseLat + 0.002, lon: baseLon + 0.002, alt: altitude }
    ];
  }

  // 🟢 PERIMETER pattern
  else if (data.pattern === "perimeter") {
    waypoints = [
      { lat: baseLat, lon: baseLon, alt: altitude },
      { lat: baseLat, lon: baseLon + 0.002, alt: altitude },
      { lat: baseLat + 0.002, lon: baseLon + 0.002, alt: altitude },
      { lat: baseLat + 0.002, lon: baseLon, alt: altitude },
      { lat: baseLat, lon: baseLon, alt: altitude }
    ];
  }

  // 🟢 DEFAULT (if pattern unknown → simple path)
  else {
    waypoints = [
      { lat: baseLat, lon: baseLon, alt: altitude },
      { lat: baseLat + 0.001, lon: baseLon + 0.001, alt: altitude }
    ];
  }

  return waypoints;
}

// ✅ VERY IMPORTANT (export correctly)
module.exports = generateWaypoints;