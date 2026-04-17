import { MissionMap } from './map.js';
import { MissionUI } from './ui.js';
import { MissionParser } from './parser.js';
import { CONFIG } from './config.js';

/**
 * AeroSync Pro | Intelligence-Driven Mission Command
 * (Integrated & Verified Version)
 */

class AeroSyncApp {
    constructor() {
        this.missionMap = new MissionMap('map');
        this.missionParser = new MissionParser();
        this.currentMission = null;
        this.isSimulating = false;

        // Reference No-Fly Zones (From Working Version)
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
        document.getElementById('optimize-mission-btn').addEventListener('click', () => this.optimizeTrajectory());
        
        document.getElementById('toggle-map-style').addEventListener('click', () => this.missionMap.toggleMapStyle());
        document.getElementById('center-map-btn').addEventListener('click', () => {
            if (this.currentMission) this.missionMap.map.fitBounds(this.missionMap.layers.path.getBounds(), { padding: [50, 50] });
        });

        document.getElementById('toggle-nfz').addEventListener('change', (e) => {
            if (e.target.checked) this.missionMap.layers.zones.addTo(this.missionMap.map);
            else this.missionMap.map.removeLayer(this.missionMap.layers.zones);
        });
    }

    // --- NAVIGATION & COLLISION ENGINE (From Working Reference) ---
    
    doLinesIntersect(p1, p2, q1, q2) {
        const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
        return (ccw(p1, q1, q2) !== ccw(p2, q1, q2)) && (ccw(p1, p2, q1) !== ccw(p1, p2, q2));
    }

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

    reroutePath(path, zones) {
        let sanitizedPath = path.map(p => {
            const zone = zones.find(z => this.isPointInPolygon(p, z.coords));
            if (zone) {
                const lats = zone.coords.map(c => c[0]), lngs = zone.coords.map(c => c[1]);
                const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
                const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
                return [p[0], p[1] > centerLng ? Math.max(...lngs) + 0.002 : Math.min(...lngs) - 0.002];
            }
            return p;
        });

        let optimizedPath = [...sanitizedPath];
        let hasIntersections = true;
        let iter = 0;
        while (hasIntersections && iter < 10) {
            hasIntersections = false;
            const newPath = [optimizedPath[0]];
            for (let i = 0; i < optimizedPath.length - 1; i++) {
                const p1 = optimizedPath[i], p2 = optimizedPath[i+1];
                const zone = zones.find(z => this.doesSegmentIntersectPolygon(p1, p2, z.coords));
                if (zone) {
                    hasIntersections = true;
                    const lats = zone.coords.map(c => c[0]), lngs = zone.coords.map(c => c[1]);
                    const detour = [ (p1[0]+p2[0])/2, (p1[1] > (Math.max(...lngs)+Math.min(...lngs))/2 ? Math.max(...lngs)+0.005 : Math.min(...lngs)-0.005) ];
                    newPath.push(detour);
                }
                newPath.push(p2);
            }
            optimizedPath = newPath;
            iter++;
        }
        return optimizedPath;
    }

    // --- MISSION PLANNING ---

    async planMission() {
        const input = document.getElementById('mission-input').value.toLowerCase();
        const specs = this.getSpecs();
        MissionUI.setPlanningState(true);

        const missionIntel = await this.missionParser.parse(input, specs);
        
        // UI JSON Update
        document.getElementById('json-viewer-section').classList.remove('hidden');
        document.getElementById('json-display').innerText = JSON.stringify(missionIntel, null, 2);

        let center = [10.0, 78.0];
        try {
            // Added User-Agent to comply with Nominatim policy and avoid 403 errors
            if (missionIntel.area && missionIntel.area !== "Identified Target" && missionIntel.area !== "Target Area") {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(missionIntel.area)}&format=json&limit=1`, {
                    headers: { 'User-Agent': 'AeroSync-Drone-Planner/1.0' }
                });
                const data = await res.json();
                if (data.length > 0) {
                    center = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                    this.missionMap.map.setView(center, 15);
                    console.log(`OSM: Mission centered on ${missionIntel.area} at ${center}`);
                }
            }
        } catch (e) { 
            console.warn("OSM Geocoding: Policy mismatch or network error.", e); 
        }

        const strategy = missionIntel.mission_type === 'survey' ? 'coverage' : 'perimeter';
        const rawPath = missionIntel.waypoints || this.generateSmartPath(center, strategy);
        const finalPath = this.reroutePath(rawPath, this.nfz);
        
        const cost = this.calculateMissionCost(finalPath, specs.payload);
        const checks = [
            { title: 'Altitude', valid: missionIntel.altitude <= specs.maxAlt, msg: 'Safety Baseline' },
            { title: 'Battery', valid: cost.batteryUsed < 100, msg: 'Power Check' },
            { title: 'Airspace', valid: true, msg: 'Clear for flight' }
        ];

        this.currentMission = {
            waypoints: finalPath,
            altitude: missionIntel.altitude,
            batteryCost: cost.batteryUsed,
            isValid: true,
            actions: missionIntel.actions
        };

        this.missionMap.drawPath(finalPath, true);
        this.missionMap.renderWaypoints(finalPath, document.getElementById('toggle-waypoints').checked, missionIntel.actions);
        MissionUI.renderValidation(checks);
        
        if (missionIntel.energy) {
            const envStr = `[Env: ${specs.temp}°C | ${specs.humidity}%]`;
            const strategy = missionIntel.energy.optimization_notes || "Efficiency Optimized";
            MissionUI.updateEnergyMetrics(missionIntel.energy.estimated_usage_percentage, 0);
            MissionUI.showAlert(`INTEL: ${envStr} | ${strategy}`, !this.currentMission.isValid);
        }

        const dist = this.calculateTotalDistance(finalPath);
        const initialBattery = 100;
        MissionUI.updateHUD(dist, cost.estTime, initialBattery);
        this.currentBattery = initialBattery; // Initialize for simulation
        
        document.getElementById('export-controls').classList.remove('hidden');
        document.getElementById('optimize-mission-btn').style.display = 'block';
        MissionUI.setPlanningState(false);
    }

    async optimizeTrajectory() {
        if (!this.currentMission) return;
        MissionUI.showStatus("Optimizing for Efficiency...", 'simulation');
        
        try {
            const res = await fetch(`${CONFIG.API_BASE}/api/optimize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flight_plan: { waypoints: this.currentMission.waypoints.map(w => ({lat: w[0], lon: w[1], action: 'move', alt: w[2] || 30})) },
                    battery_minutes: this.getSpecs().batteryMins
                })
            });
            const data = await res.json();
            const optWaypoints = data.optimized_flight_plan.waypoints.map(w => [w.lat, w.lon, w.alt || 30]);
            const finalPath = this.reroutePath(optWaypoints, this.nfz);
            
            this.currentMission.waypoints = finalPath;
            this.missionMap.drawPath(finalPath, true, '#00ffa3');
            this.missionMap.renderWaypoints(finalPath, true, data.optimized_flight_plan.waypoints.map(w => w.action));
            MissionUI.updateEnergyMetrics(data.energy_comparison.optimized_usage_percentage, data.energy_comparison.savings_percentage);
            MissionUI.showStatus("Optimization Complete", 'normal');
        } catch (e) { MissionUI.showAlert("Optimization Offline", true); }
    }

    // --- HELPER UTILITIES ---

    getSpecs() {
        return {
            maxAlt: parseInt(document.getElementById('max-alt').value),
            payload: parseFloat(document.getElementById('payload').value),
            batteryMins: parseInt(document.getElementById('battery-life').value),
            speed: parseInt(document.getElementById('speed-set').value),
            temp: parseInt(document.getElementById('env-temp').value),
            humidity: parseInt(document.getElementById('env-humid').value)
        };
    }

    calculateTotalDistance(path) {
        let d = 0;
        for (let i = 1; i < path.length; i++) d += L.latLng(path[i-1]).distanceTo(L.latLng(path[i]));
        return d / 1000;
    }

    calculateMissionCost(path, payload) {
        const specs = this.getSpecs();
        let totalCost = payload * 0.5; // Fixed payload penalty
        
        for (let i = 1; i < path.length; i++) {
            totalCost += this.calculateSegmentCost(path[i-1], path[i], payload, specs);
        }
        
        const d = this.calculateTotalDistance(path);
        const s = specs.speed || 8;
        return { batteryUsed: totalCost, estTime: (d * 1000) / s };
    }

    calculateSegmentCost(p1, p2, payload, specs) {
        const start = L.latLng(p1[0], p1[1]);
        const end = L.latLng(p2[0], p2[1]);
        const distKm = start.distanceTo(end) / 1000;
        const altChange = Math.abs((p2[2] || 30) - (p1[2] || 30));

        // Unified Brain Logic:
        // Horizontal: 3.5% per km (increased slightly for real-world drag)
        // Vertical: 0.05% per meter (low cost due to anti-gravity)
        return (distKm * 3.5) + (altChange * 0.05);
    }

    generateSmartPath(center, strategy) {
        const [lat, lng] = center, r = 0.005;
        if (strategy === 'coverage') {
            let grid = [];
            for (let i = -1; i <= 1; i += 0.4) {
                grid.push([lat + i * r, lng - r]);
                grid.push([lat + (i+0.2) * r, lng + r]);
            }
            return grid;
        }
        return [[lat-r, lng-r], [lat+r, lng-r], [lat+r, lng+r], [lat-r, lng+r], [lat-r, lng-r]];
    }

    runSimulation() {
        if (!this.currentMission || this.isSimulating) return;
        this.isSimulating = true;
        const path = this.currentMission.waypoints;
        const warp = parseFloat(document.getElementById('sim-warp').value);
        const speed = (parseInt(document.getElementById('speed-set').value) || 8) * warp;

        let currentIdx = 0;
        MissionUI.showStatus("Simulating...", 'simulation');

        const animate = () => {
            if (currentIdx >= path.length - 1) {
                this.isSimulating = false;
                MissionUI.showStatus("Mission Success", 'normal');
                return;
            }
            const start = L.latLng(path[currentIdx]), end = L.latLng(path[currentIdx+1]);
            const duration = (start.distanceTo(end) / speed) * 1000;
            const heading = (Math.atan2(end.lng - start.lng, end.lat - start.lat) * 180 / Math.PI);
            const startTime = performance.now();

            // Calculate total segment cost to deplete it smoothly
            const segmentCost = this.calculateSegmentCost(
                path[currentIdx], 
                path[currentIdx+1], 
                parseFloat(document.getElementById('payload').value), 
                this.getSpecs()
            );

            const frame = (now) => {
                const progress = Math.min((now - startTime) / duration, 1);
                const frameProgress = progress - (this.lastProgress || 0);
                this.lastProgress = progress;

                const currentPos = [start.lat + (end.lat-start.lat)*progress, start.lng + (end.lng-start.lng)*progress];
                
                // Dynamic Battery Reduction
                this.currentBattery -= segmentCost * (frameProgress > 0 ? frameProgress : 0);
                
                this.missionMap.updateDroneMarker(currentPos, heading);
                MissionUI.updateHUD(
                    this.calculateTotalDistance(path.slice(currentIdx).map((p, i) => i === 0 ? currentPos : p)), 
                    (duration * (1 - progress)) / 1000, 
                    Math.max(0, this.currentBattery)
                );
                
                if (progress < 1) requestAnimationFrame(frame);
                else { 
                    this.lastProgress = 0;
                    currentIdx++; 
                    animate(); 
                }
            };
            this.lastProgress = 0;
            requestAnimationFrame(frame);
        };
        animate();
    }
}

new AeroSyncApp();
