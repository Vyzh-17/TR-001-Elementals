import { useState, useEffect, useRef } from 'react';
import { determineRegion, detectRegionalConflicts } from '../engine/regionEngine.js';
import { findOptimalPath } from '../engine/pathOptimizer.js';
import { estimateEnergy, calculateDistance } from '../engine/energyCalculator.js';

// Center of Berlin
const BASE_LAT = 52.5200;
const BASE_LNG = 13.4050;
const RANGE = 0.02;

function createRandomDestination() {
    return {
        lat: BASE_LAT + (Math.random() - 0.5) * RANGE * 2,
        lng: BASE_LNG + (Math.random() - 0.5) * RANGE * 2
    };
}

const INITIAL_DRONES = [
  { id: 'DRN-001', alt: 120, speed: 45, energy: 88, status: 'normal', region: 'Transit Zone', position: { lat: 52.520, lng: 13.385 }, originalPath: [ {lat: 52.520, lng: 13.430} ], currentPath: [ {lat: 52.520, lng: 13.430} ] },
  { id: 'DRN-002', alt: 110, speed: 42, energy: 74, status: 'normal', region: 'Transit Zone', position: { lat: 52.520, lng: 13.435 }, originalPath: [ {lat: 52.520, lng: 13.385} ], currentPath: [ {lat: 52.520, lng: 13.385} ] },
  { id: 'DRN-003', alt: 130, speed: 50, energy: 92, status: 'normal', region: 'Transit Zone', position: { lat: 52.535, lng: 13.405 }, originalPath: [ {lat: 52.505, lng: 13.405} ], currentPath: [ {lat: 52.505, lng: 13.405} ] },
  { id: 'DRN-004', alt: 115, speed: 38, energy: 65, status: 'normal', region: 'Transit Zone', position: { lat: 52.505, lng: 13.405 }, originalPath: [ {lat: 52.535, lng: 13.405} ], currentPath: [ {lat: 52.535, lng: 13.405} ] },
];

export function useDroneSimulation() {
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [alerts, setAlerts] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [replanEvents, setReplanEvents] = useState([]);
  const regionLock = useRef({});

  useEffect(() => {
    const interval = setInterval(() => {
      setDrones(prevDrones => {
        let updatedDrones = prevDrones.map(drone => {
          let newPos = { ...drone.position };
          let currentPath = [...drone.currentPath];
          let status = drone.status;

          if (currentPath.length > 0) {
              const target = currentPath[0];
              const dLat = target.lat - newPos.lat;
              const dLng = target.lng - newPos.lng;
              const dist = Math.sqrt(dLat * dLat + dLng * dLng);
              
              if (dist > 0.0002) {
                  const moveStep = (drone.speed / 3600) * 0.1 * 0.01; 
                  newPos.lat += (dLat / dist) * Math.min(moveStep, dist);
                  newPos.lng += (dLng / dist) * Math.min(moveStep, dist);
              } else {
                  currentPath.shift();
                  if (currentPath.length === 0) {
                      const newDest = createRandomDestination();
                      currentPath.push(newDest);
                      drone.originalPath = [newDest];
                      status = 'normal';
                  }
              }
          }

          const currentRegion = determineRegion(newPos.lat, newPos.lng);
          if (currentRegion !== 'Transit Zone' && status !== 'optimized') {
              status = 'in-region';
          }

          return {
            ...drone,
            position: newPos,
            currentPath: currentPath,
            region: currentRegion,
            energy: Math.max(0, drone.energy - 0.01),
            status: status
          };
        });

        const conflicts = detectRegionalConflicts(updatedDrones);
        const newAlerts = [];
        const newDecisions = [];
        const newReplanEvents = [];
        const now = Date.now();

        conflicts.forEach(({ region, drones: regionDrones }) => {
            if (regionLock.current[region] && now - regionLock.current[region] < 5000) {
                return;
            }

            let replannedDrones = 0;

            regionDrones.forEach(d1 => {
                if (d1.status === 'optimized') return; // Already optimized
                
                // Track standard segment
                const directPathSeg = [d1.position, d1.currentPath[0] || d1.originalPath[0]];
                const ogEnergy = estimateEnergy(calculateDistance(directPathSeg));
                
                const result = findOptimalPath(d1, updatedDrones, region);
                
                if (result && !result.name.includes('Direct')) {
                    d1.currentPath = result.fullPath;
                    d1.status = 'optimized';
                    
                    newReplanEvents.push({
                        id: Date.now() + d1.id,
                        droneId: d1.id,
                        region: region,
                        originalPathName: 'Direct Segment',
                        updatedPathName: result.name,
                        energyBefore: ogEnergy.toFixed(1),
                        energyAfter: result.energyCost.toFixed(1),
                        status: 'Path Optimized'
                    });

                    newDecisions.push({
                        id: Date.now() + d1.id + 'D',
                        message: `Drone ${d1.id} executed internal path shift in ${region}`,
                        type: 'Local Adaptive Optimization'
                    });

                    replannedDrones++;
                }
            });

            if (replannedDrones > 0) {
                regionLock.current[region] = now;
            }
        });

        if (newDecisions.length > 0) setDecisions(prev => [...newDecisions, ...prev].slice(0, 5));
        if (newReplanEvents.length > 0) setReplanEvents(prev => [...newReplanEvents, ...prev].slice(0, 5));
        
        return updatedDrones;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return { drones, alerts, decisions, replanEvents };
}
