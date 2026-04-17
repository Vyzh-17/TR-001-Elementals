export function calculateDistance(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;
  let dist = 0;
  for (let i=0; i<waypoints.length-1; i++) {
      const dx = waypoints[i+1].lat - waypoints[i].lat;
      const dy = waypoints[i+1].lng - waypoints[i].lng;
      // Approximate 1 degree ~ 111 km
      dist += Math.sqrt(dx*dx + dy*dy) * 111;
  }
  return dist;
}

export function estimateEnergy(pathDist, payloadFactor = 1.0) {
  // Energy = distance * factor + payload factor
  const baseFactor = 4.5; // percent per km
  return Number((pathDist * baseFactor * payloadFactor).toFixed(2));
}
