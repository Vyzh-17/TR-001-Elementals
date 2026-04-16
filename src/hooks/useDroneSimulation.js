import { useState, useEffect, useRef } from 'react';

// Center of Berlin
const BASE_LAT = 52.5200;
const BASE_LNG = 13.4050;
const RANGE = 0.02; // Approx 2km

const INITIAL_DRONES = [
  { id: 'DRN-001', alt: 120, speed: 45, battery: 88, status: 'Normal', waypoint: 2, lat: BASE_LAT + 0.005, lng: BASE_LNG + 0.005, targetLat: BASE_LAT + 0.015, targetLng: BASE_LNG + 0.015 },
  { id: 'DRN-002', alt: 110, speed: 42, battery: 74, status: 'Normal', waypoint: 4, lat: BASE_LAT + 0.015, lng: BASE_LNG + 0.005, targetLat: BASE_LAT + 0.005, targetLng: BASE_LNG + 0.015 },
  { id: 'DRN-003', alt: 130, speed: 50, battery: 92, status: 'Normal', waypoint: 1, lat: BASE_LAT + 0.002, lng: BASE_LNG + 0.002, targetLat: BASE_LAT + 0.018, targetLng: BASE_LNG + 0.018 },
  { id: 'DRN-004', alt: 115, speed: 38, battery: 65, status: 'Normal', waypoint: 3, lat: BASE_LAT + 0.010, lng: BASE_LNG + 0.018, targetLat: BASE_LAT + 0.010, targetLng: BASE_LNG + 0.002 },
];

export function useDroneSimulation() {
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [alerts, setAlerts] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const decisionCooldown = useRef({});

  useEffect(() => {
    const interval = setInterval(() => {
      setDrones(prevDrones => {
        // 1. Update Positions & Stats
        const updatedDrones = prevDrones.map(drone => {
          const dLat = drone.targetLat - drone.lat;
          const dLng = drone.targetLng - drone.lng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          
          let newLat = drone.lat;
          let newLng = drone.lng;
          
          if (dist > 0.0001) {
            newLat += (dLat / dist) * 0.00005;
            newLng += (dLng / dist) * 0.00005;
          } else {
            // Pick new target if reached
            return {
              ...drone,
              targetLat: BASE_LAT + Math.random() * RANGE,
              targetLng: BASE_LNG + Math.random() * RANGE,
              waypoint: (drone.waypoint % 10) + 1
            };
          }

          return {
            ...drone,
            lat: newLat,
            lng: newLng,
            alt: drone.alt + (Math.random() - 0.5) * 0.5,
            battery: Math.max(0, drone.battery - 0.005),
            speed: 40 + Math.random() * 10
          };
        });

        // 2. Collision Detection
        const newAlerts = [];
        const currentDecisions = [];
        
        for (let i = 0; i < updatedDrones.length; i++) {
          for (let j = i + 1; j < updatedDrones.length; j++) {
            const d1 = updatedDrones[i];
            const d2 = updatedDrones[j];
            
            const latDiff = d1.lat - d2.lat;
            const lngDiff = d1.lng - d2.lng;
            // Rough distance in km (0.01 degree ~ 1km)
            const horizontalDist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
            const altDiff = Math.abs(d1.alt - d2.alt);

            if (horizontalDist < 0.2 && altDiff < 15) { // 200m
              const alertId = `${d1.id}-${d2.id}`;
              newAlerts.push({
                id: alertId,
                droneA: d1.id,
                droneB: d2.id,
                distance: horizontalDist.toFixed(3),
                timeToCollision: (horizontalDist / (d1.speed / 3600)).toFixed(1),
                timestamp: Date.now()
              });

              if (!decisionCooldown.current[alertId] || Date.now() - decisionCooldown.current[alertId] > 5000) {
                const action = `Drone ${d2.id} altitude increased from ${d2.alt.toFixed(0)}m to ${(d2.alt + 20).toFixed(0)}m`;
                currentDecisions.push({
                  id: Date.now() + j,
                  message: action,
                  type: 'Altitude Correction'
                });
                
                d2.alt += 20;
                d1.status = 'Warning';
                d2.status = 'Avoiding';
                
                decisionCooldown.current[alertId] = Date.now();
              }
            } else {
              if (d1.status !== 'Normal' && horizontalDist > 0.4) d1.status = 'Normal';
              if (d2.status !== 'Normal' && horizontalDist > 0.4) d2.status = 'Normal';
            }
          }
        }

        if (currentDecisions.length > 0) {
          setDecisions(prev => [currentDecisions[0], ...prev].slice(0, 5));
        }
        setAlerts(newAlerts);
        
        return updatedDrones;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return { drones, alerts, decisions };
}
