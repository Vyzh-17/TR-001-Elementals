import { calculateDistance, estimateEnergy } from './energyCalculator.js';
import { REGIONS } from './regionEngine.js';

function isPathColliding(path1, path2) {
  if (!path1 || !path2 || path1.length === 0 || path2.length === 0) return false;
  const minLen = Math.min(path1.length, path2.length);
  for (let i=0; i<minLen; i++) {
      const p1 = path1[i];
      const p2 = path2[i] || path2[path2.length-1];
      const dx = p1.lat - p2.lat;
      const dy = p1.lng - p2.lng;
      const dist = Math.sqrt(dx*dx + dy*dy) * 111; 
      if (dist < 0.15) return true;
  }
  return false;
}

function isInsideRegion(lat, lng, bounds) {
    if (!bounds) return false;
    return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

export function generateAlternativePaths(drone, regionId) {
  const current = { lat: drone.position.lat, lng: drone.position.lng };
  const region = REGIONS.find(r => r.id === regionId);
  const bounds = region ? region.bounds : null;

  if (!bounds) return [];

  // Find where the drone's path EXITS this region
  let exitPoint = null;
  let remainingPath = [];
  
  const pathArr = drone.originalPath || drone.currentPath || drone.waypoints;
  for (let i = 0; i < pathArr.length; i++) {
      if (!isInsideRegion(pathArr[i].lat, pathArr[i].lng, bounds)) {
          exitPoint = pathArr[i];
          remainingPath = pathArr.slice(i + 1);
          break;
      }
  }

  // If the path ends inside the region, use the final point
  if (!exitPoint) {
      exitPoint = pathArr[pathArr.length - 1];
      remainingPath = [];
  }
  
  if (!exitPoint) return [];

  // Inside the region alternatives
  // 1. Direct segment
  const p1 = [current, exitPoint];

  // 2. Shift path North/East
  const edgeN = bounds.maxLat - 0.0005;
  const edgeE = bounds.maxLng - 0.0005;
  const p2 = [
      current,
      { lat: edgeN, lng: current.lng },
      { lat: edgeN, lng: edgeE },
      exitPoint
  ];
  
  // 3. Shift path South/West
  const edgeS = bounds.minLat + 0.0005;
  const edgeW = bounds.minLng + 0.0005;
  const p3 = [
      current,
      { lat: edgeS, lng: current.lng },
      { lat: edgeS, lng: edgeW },
      exitPoint
  ];

  return [
      { name: 'Direct Segment', localWaypoints: p1, remaining: remainingPath },
      { name: 'Local Route Shift Alpha', localWaypoints: p2, remaining: remainingPath },
      { name: 'Local Route Shift Beta', localWaypoints: p3, remaining: remainingPath }
  ];
}

export function findOptimalPath(drone, otherDrones, regionId) {
  const alternatives = generateAlternativePaths(drone, regionId);
  
  let bestAlt = null;
  let minEnergy = Infinity;
  
  for (const alt of alternatives) {
      let collides = false;
      for (const other of otherDrones) {
          if (other.id !== drone.id && isPathColliding(alt.localWaypoints, other.currentPath || other.waypoints)) {
              collides = true;
              break;
          }
      }
      
      const segmentDist = calculateDistance(alt.localWaypoints);
      const segmentEnergy = estimateEnergy(segmentDist);
      
      if (!collides && segmentEnergy < minEnergy) {
          bestAlt = { 
              fullPath: [...alt.localWaypoints, ...alt.remaining], 
              name: alt.name, 
              energyCost: segmentEnergy 
          };
          minEnergy = segmentEnergy;
      }
  }
  
  if (!bestAlt && alternatives.length > 0) {
      const forced = alternatives[1];
      const segmentDist = calculateDistance(forced.localWaypoints);
      bestAlt = { 
          fullPath: [...forced.localWaypoints, ...forced.remaining], 
          name: forced.name, 
          energyCost: estimateEnergy(segmentDist) 
      };
  }
  
  return bestAlt;
}
