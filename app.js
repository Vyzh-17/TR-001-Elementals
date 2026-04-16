import { MissionMap } from './map.js';
import { MissionUI } from './ui.js';

/**
 * AeroSync Phase 2.1 - Robust Intelligence Engine
 * Fixes: Segment-level intersection checks & detour injection
 */

class AeroSyncApp {
    constructor() {
        this.missionMap = new MissionMap('map');
        this.currentMission = null;
        this.isSimulating = false;

        // Mock No-Fly Zones (NFZ)
        this.nfz = [
            { id: "NFZ_01", name: "Power Station Alpha", coords: [[10.003, 78.003], [10.007, 78.003], [10.007, 78.007], [10.003, 78.007]] },
            { id: "NFZ_02", name: "Restricted Heliport", coords: [[10.008, 78.01], [10.012, 78.01], [10.012, 78.014], [10.008, 78.014]] }
        ];

        this.init();
    }

    init() {
        this.missionMap.drawNoFlyZones(this.nfz);
        this.attachListeners();
    }

    attachListeners() {
        document.getElementById('generate-mission-btn').addEventListener('click', () => this.planMission());
        document.getElementById('start-simulation-btn').addEventListener('click', () => this.runSimulation());
        document.getElementById('toggle-map-style').addEventListener('click', () => this.missionMap.toggleMapStyle());
        document.getElementById('toggle-nfz').addEventListener('change', (e) => {
            if (e.target.checked) this.missionMap.layers.zones.addTo(this.missionMap.map);
            else this.missionMap.map.removeLayer(this.missionMap.layers.zones);
        });
    }

    // --- MATHEMATICAL UTILITIES (The "Heart" Fixes) ---

    /**
     * CCW Algorithm to check if lines (p1-p2) and (q1-q2) intersect
     */
    doLinesIntersect(p1, p2, q1, q2) {
        const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
        return (ccw(p1, q1, q2) !== ccw(p2, q1, q2)) && (ccw(p1, p2, q1) !== ccw(p1, p2, q2));
    }

    /**
     * Checks if a segment intersects any edge of a polygon
     */
    doesSegmentIntersectPolygon(p1, p2, polygon) {
        for (let i = 0; i < polygon.length; i++) {
            const q1 = polygon[i];
            const q2 = polygon[(i + 1) % polygon.length];
            if (this.doLinesIntersect(p1, p2, q1, q2)) return true;
        }
        return false;
    }

    isPointInPolygon(point, vs) {
        let x = point[0], y = point[1], inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // --- CORE LOGIC UPGRADES ---

    /**
     * Advanced Rerouting: Displaces points and injects detour vertices to avoid NFZ
     */
    /**
     * Advanced Rerouting: Two-Phase collision avoidance engine
     */
    reroutePath(path, zones) {
        // --- PHASE 1: WAYPOINT DISPLACEMENT ---
        // Moves any waypoint that is already inside an NFZ to its nearest boundary
        let sanitizedPath = path.map(p => {
            const zone = zones.find(z => this.isPointInPolygon(p, z.coords));
            if (zone) {
                const lats = zone.coords.map(c => c[0]);
                const lngs = zone.coords.map(c => c[1]);
                const maxLat = Math.max(...lats);
                const minLat = Math.min(...lats);
                const maxLng = Math.max(...lngs);
                const minLng = Math.min(...lngs);

                const centerLat = (maxLat + minLat) / 2;
                const centerLng = (maxLng + minLng) / 2;

                // Escape horizontally or vertically based on distance to nearest edge
                if (Math.abs(p[1] - centerLng) > Math.abs(p[0] - centerLat)) {
                    return [p[0], p[1] > centerLng ? maxLng + 0.002 : minLng - 0.002];
                } else {
                    return [p[0] > centerLat ? maxLat + 0.002 : minLat - 0.002, p[1]];
                }
            }
            return p;
        });

        // --- PHASE 2: DIRECTIONAL SEGMENT REROUTING ---
        // Injects detour points until all line segments are clear of NFZ
        let optimizedPath = [...sanitizedPath];
        let hasIntersections = true;
        let iterations = 0;

        while (hasIntersections && iterations < 15) {
            hasIntersections = false;
            const newPath = [optimizedPath[0]];

            for (let i = 0; i < optimizedPath.length - 1; i++) {
                const p1 = optimizedPath[i];
                const p2 = optimizedPath[i + 1];
                
                const intersectingZone = zones.find(z => this.doesSegmentIntersectPolygon(p1, p2, z.coords));
                
                if (intersectingZone) {
                    hasIntersections = true;
                    const lats = intersectingZone.coords.map(c => c[0]);
                    const lngs = intersectingZone.coords.map(c => c[1]);
                    const maxLat = Math.max(...lats);
                    const minLat = Math.min(...lats);
                    const maxLng = Math.max(...lngs);
                    const minLng = Math.min(...lngs);

                    const midLat = (p1[0] + p2[0]) / 2;
                    const midLng = (p1[1] + p2[1]) / 2;

                    // If segment is primarily vertical, shift detour horizontally
                    const isVertical = Math.abs(p1[0] - p2[0]) > Math.abs(p1[1] - p2[1]);
                    
                    let detour;
                    if (isVertical) {
                        const targetLng = midLng > (maxLng + minLng) / 2 ? maxLng + 0.005 : minLng - 0.005;
                        detour = [midLat, targetLng];
                    } else {
                        const targetLat = midLat > (maxLat + minLat) / 2 ? maxLat + 0.005 : minLat - 0.005;
                        detour = [targetLat, midLng];
                    }
                    
                    newPath.push(detour);
                }
                newPath.push(p2);
            }
            optimizedPath = newPath;
            iterations++;
        }
        return optimizedPath;
    }

    /**
     * Robust Validation: Checks segments as well as points
     */
    validateMission(path, alt, batteryCost, specs) {
        const violations = [];
        let zoneViolation = false;

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            for (let z of this.nfz) {
                if (this.isPointInPolygon(p1, z.coords) || this.doesSegmentIntersectPolygon(p1, p2, z.coords)) {
                    zoneViolation = true;
                    violations.push({ type: 'NFZ_INTERSECTION', zone: z.name });
                    break;
                }
            }
        }

        return [
            { title: 'Altitude Limit', valid: alt <= specs.maxAlt, msg: alt > specs.maxAlt ? 'Exceeds Ceiling' : 'Safe Height' },
            { title: 'Battery Reserve', valid: batteryCost < 100, msg: batteryCost > 100 ? 'Power Risk' : 'Power OK' },
            { title: 'Zone Integrity', valid: !zoneViolation, msg: zoneViolation ? 'Intersects NFZ' : 'Clear Airspace', violations }
        ];
    }

    // --- MISSION LIFECYCLE ---

    async planMission() {
        const inputStr = document.getElementById('mission-input').value.toLowerCase();
        MissionUI.setPlanningState(true);

        const strategy = inputStr.includes('survey') ? 'coverage' : 'perimeter';
        const altitude = parseInt(inputStr.match(/([0-9]+)\s*m/)?.[1]) || 30;
        
        // --- REAL-WORLD GEOCODING (Nominatim API) ---
        let center = [10.0, 78.0]; // Default Fallback
        const locationQuery = inputStr.replace(/survey|coverage|perimeter|the/g, '').trim();
        
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`);
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
                center = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
                this.missionMap.map.setView(center, 15);
            }
        } catch (e) {
            console.warn("Geocoding failed, using local grid control.");
        }

        // --- INTENT VALIDATION ---
        const targetedNFZ = this.nfz.find(z => inputStr.includes(z.name.toLowerCase()) || inputStr.includes(z.id.toLowerCase()));
        
        const rawPath = this.generateSmartPath(center, strategy);
        const optimizedPath = this.reroutePath(rawPath, this.nfz);
        
        const specs = this.getSpecs();
        const cost = this.calculateMissionCost(optimizedPath, specs.payload);
        const checks = this.validateMission(optimizedPath, altitude, cost.batteryUsed, specs);

        // Explicitly block if targeting a restricted area based on intent
        if (targetedNFZ) {
            const zIdx = checks.findIndex(c => c.title === 'Zone Integrity');
            checks[zIdx].valid = false;
            checks[zIdx].msg = `RESTRICED AREA: ${targetedNFZ.name}`;
        }

        this.currentMission = {
            waypoints: optimizedPath,
            altitude,
            batteryCost: cost.batteryUsed,
            estTime: cost.estTime,
            isValid: checks.every(c => c.valid) && !targetedNFZ,
            violations: checks.find(c => c.violations)?.violations || []
        };

        setTimeout(() => {
            MissionUI.setPlanningState(false);
            this.missionMap.drawPath(optimizedPath, this.currentMission.isValid);
            this.missionMap.renderWaypoints(optimizedPath, document.getElementById('toggle-waypoints').checked);
            MissionUI.renderValidation(checks);
            MissionUI.updateHUD(this.calculateTotalDistance(optimizedPath), cost.estTime, 100);
            MissionUI.showAlert("INTEL: Segment detection enabled. Path validated.", !this.currentMission.isValid);
            document.getElementById('export-controls').classList.remove('hidden');
        }, 600);
    }

    // (Remaining utility functions preserved: generateSmartPath, calculateMissionCost, calculateTotalDistance, getSpecs, runSimulation)

    generateSmartPath(center, strategy) {
        const [lat, lng] = center;
        const radius = 0.005;
        if (strategy === 'coverage') {
            const grid = [];
            for (let i = -1; i <= 1; i += 0.4) {
                grid.push([lat + i * radius, lng - radius]);
                grid.push([lat + parseFloat((i+0.2).toFixed(2)) * radius, lng + radius]);
            }
            return grid;
        }
        return [[lat - radius, lng - radius], [lat + radius, lng - radius], [lat + radius, lng + radius], [lat - radius, lng + radius], [lat - radius, lng - radius]];
    }

    calculateMissionCost(waypoints, payload) {
        const dist = this.calculateTotalDistance(waypoints);
        const speed = parseInt(document.getElementById('speed-set').value) || 8;
        // Optimization: Reduce drain rate to 0.3% per 100m (3% per km) for realistic industrial ops
        const batteryUsed = (dist * 1000 * 0.003) + (payload * 0.5); 
        return { batteryUsed, estTime: (dist * 1000) / speed };
    }

    calculateTotalDistance(path) {
        let d = 0;
        for (let i = 1; i < path.length; i++) {
            d += L.latLng(path[i-1]).distanceTo(L.latLng(path[i]));
        }
        return d / 1000;
    }

    getSpecs() {
        return {
            maxAlt: parseInt(document.getElementById('max-alt').value),
            payload: parseFloat(document.getElementById('payload').value),
            batteryMins: parseInt(document.getElementById('battery-life').value)
        };
    }

    runSimulation() {
        if (!this.currentMission || this.isSimulating) return;

        // --- SAFETY INTERLOCK (Restored: Block only if pre-planning still fails) ---
        if (!this.currentMission.isValid) {
            MissionUI.showStatus("MISSION BLOCKED: SAFETY RISK", 'error');
            MissionUI.showAlert("EXECUTION DENIED: Path intersects restricted airspace.", true);
            return;
        }
        
        this.isSimulating = true;
        const path = this.currentMission.waypoints;
        const flightSpeed = parseInt(document.getElementById('speed-set').value) || 8;
        const warp = parseFloat(document.getElementById('sim-warp').value) || 5;
        const simSpeed = flightSpeed * warp; 
        
        let currentIdx = 0;
        let battery = 100;
        
        MissionUI.showStatus(`Executing [${warp}x Warp]`, 'simulation');
        
        const animate = () => {
            if (currentIdx >= path.length - 1) {
                this.isSimulating = false;
                MissionUI.showStatus("Mission Success", 'normal');
                return;
            }

            const start = L.latLng(path[currentIdx]);
            const end = L.latLng(path[currentIdx + 1]);
            const dist = start.distanceTo(end);
            const duration = (dist / simSpeed) * 1000;
            const heading = (Math.atan2(end.lng - start.lng, end.lat - start.lat) * 180 / Math.PI);
            
            const stepStart = performance.now();
            
            const frame = (now) => {
                const elapsed = now - stepStart;
                const progress = Math.min(elapsed / duration, 1);
                
                const lat = start.lat + (end.lat - start.lat) * progress;
                const lng = start.lng + (end.lng - start.lng) * progress;
                const currentPos = [lat, lng];

                // --- REACTIVE REROUTING LOGIC ---
                const zone = this.nfz.find(z => this.isPointInPolygon(currentPos, z.coords));
                if (zone) {
                    MissionUI.showAlert(`ALERT: Entered ${zone.name}. Rerouting...`, true);
                    
                    // 1. Capture current position as the new starting point for smooth transition
                    path[currentIdx] = [lat, lng];
                    
                    // 2. Simple escape: veer North-East until clear
                    const detour = [lat + 0.005, lng + 0.005];
                    path.splice(currentIdx + 1, 0, detour); // Inject detour into the path
                    
                    // 3. Update visual path
                    this.missionMap.drawPath(path, true);
                    this.missionMap.renderWaypoints(path, document.getElementById('toggle-waypoints').checked);
                    
                    // 4. Interrupt current segment and restart animate from current position towards detour
                    cancelAnimationFrame(this.currentFrameId);
                    setTimeout(() => animate(), 10); 
                    return;
                }

                this.missionMap.updateDroneMarker(currentPos, heading);
                
                // Real-time telemetry (at real-world rates)
                const realDistStep = dist * progress;
                const totalDistTravelled = this.calculateTotalDistance(path.slice(0, currentIdx + 1)) * 1000 + realDistStep;
                battery = 100 - (totalDistTravelled * 0.003); 

                const remainingDist = this.calculateTotalDistance(path.slice(currentIdx)) - (realDistStep / 1000);
                MissionUI.updateHUD(Math.max(0, remainingDist), (remainingDist * 1000) / flightSpeed, battery);

                if (progress < 1) {
                    this.currentFrameId = requestAnimationFrame(frame);
                } else { 
                    currentIdx++; 
                    animate(); 
                }
            };
            requestAnimationFrame(frame);
        };
        animate();
    }
}

new AeroSyncApp();
