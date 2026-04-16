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
     * Advanced Rerouting: Injects detour waypoints if segments cross NFZ
     */
    reroutePath(path, zones) {
        const optimizedPath = [];
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i+1];
            optimizedPath.push(p1);

            const intersectingZone = zones.find(z => this.doesSegmentIntersectPolygon(p1, p2, z.coords));
            
            if (intersectingZone) {
                // Determine bypass direction (Northward Detour)
                const detour = [p1[0] + 0.006, p1[1]]; 
                optimizedPath.push(detour);
            }
        }
        optimizedPath.push(path[path.length - 1]);
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
            { title: 'Battery Reserve', valid: batteryCost < 80, msg: batteryCost > 80 ? 'Power Risk' : 'Power OK' },
            { title: 'Zone Integrity', valid: !zoneViolation, msg: zoneViolation ? 'Intersects NFZ' : 'Clear Airspace', violations }
        ];
    }

    // --- MISSION LIFECYCLE ---

    async planMission() {
        const input = document.getElementById('mission-input').value.toLowerCase();
        MissionUI.setPlanningState(true);

        const strategy = input.includes('survey') ? 'coverage' : 'perimeter';
        const altitude = parseInt(input.match(/([0-9]+)\s*m/)?.[1]) || 30;
        
        const rawPath = this.generateSmartPath([10.0, 78.0], strategy);
        const optimizedPath = this.reroutePath(rawPath, this.nfz);
        
        const specs = this.getSpecs();
        const cost = this.calculateMissionCost(optimizedPath, specs.payload);
        const checks = this.validateMission(optimizedPath, altitude, cost.batteryUsed, specs);

        this.currentMission = {
            waypoints: optimizedPath,
            altitude,
            batteryCost: cost.batteryUsed,
            estTime: cost.estTime,
            isValid: checks.every(c => c.valid),
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
        const batteryUsed = (dist * 1000 * 0.015) + (payload * 0.4);
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
        this.isSimulating = true;
        
        const path = this.currentMission.waypoints;
        const speed = parseInt(document.getElementById('speed-set').value) || 8;
        let currentIdx = 0;
        let battery = 100;
        
        MissionUI.showStatus("Simulation Active", 'simulation');
        
        const animate = () => {
            if (currentIdx >= path.length - 1) {
                this.isSimulating = false;
                MissionUI.showStatus("Mission Complete", 'normal');
                return;
            }

            const start = L.latLng(path[currentIdx]);
            const end = L.latLng(path[currentIdx + 1]);
            const dist = start.distanceTo(end);
            const duration = (dist / speed) * 1000;
            const heading = (Math.atan2(end.lng - start.lng, end.lat - start.lat) * 180 / Math.PI);
            
            const stepStart = performance.now();
            
            const frame = (now) => {
                const elapsed = now - stepStart;
                const progress = Math.min(elapsed / duration, 1);
                
                const lat = start.lat + (end.lat - start.lat) * progress;
                const lng = start.lng + (end.lng - start.lng) * progress;
                
                this.missionMap.updateDroneMarker([lat, lng], heading);
                
                battery -= (dist / duration) * 0.001; 
                const remainingDist = this.calculateTotalDistance(path.slice(currentIdx)) * (1 - progress);
                MissionUI.updateHUD(remainingDist, (remainingDist * 1000) / speed, battery);

                if (progress < 1) requestAnimationFrame(frame);
                else { currentIdx++; animate(); }
            };
            requestAnimationFrame(frame);
        };
        animate();
    }
}

new AeroSyncApp();
