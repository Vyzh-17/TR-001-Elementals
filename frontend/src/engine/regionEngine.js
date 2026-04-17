export const REGIONS = [
  { id: 'Region-Alpha', bounds: { minLat: 52.515, maxLat: 52.525, minLng: 13.400, maxLng: 13.410 } },
  { id: 'Region-Beta',  bounds: { minLat: 52.525, maxLat: 52.535, minLng: 13.410, maxLng: 13.420 } },
  { id: 'Region-Gamma', bounds: { minLat: 52.535, maxLat: 52.545, minLng: 13.400, maxLng: 13.410 } }
];

export function determineRegion(lat, lng) {
  for (let r of REGIONS) {
     if (lat >= r.bounds.minLat && lat <= r.bounds.maxLat && 
         lng >= r.bounds.minLng && lng <= r.bounds.maxLng) {
         return r.id;
     }
  }
  return 'Transit Zone';
}

export function detectRegionalConflicts(drones) {
  const regionMap = {};
  drones.forEach(d => {
      if (d.region !== 'Transit Zone') {
          if (!regionMap[d.region]) regionMap[d.region] = [];
          regionMap[d.region].push(d);
      }
  });
  
  return Object.entries(regionMap)
      .filter(([_, list]) => list.length > 1)
      .map(([region, list]) => ({ region, drones: list }));
}
