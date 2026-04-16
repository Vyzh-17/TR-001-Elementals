/**
 * AeroSync Phase 2 - Geospatial Visualization Module
 */

export const MAP_DEFAULTS = {
    center: [10.0, 78.0],
    zoom: 14,
    dark: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', // Switched to standard for debugging
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

export class MissionMap {
    constructor(elementId) {
        console.log("Initializing AeroSync Map Engine on element:", elementId);
        this.map = L.map(elementId, { 
            zoomControl: false, 
            attributionControl: false,
            fadeAnimation: false 
        }).setView(MAP_DEFAULTS.center, MAP_DEFAULTS.zoom);
        
        this.layers = {
            base: L.tileLayer(MAP_DEFAULTS.dark).addTo(this.map),
            path: null,
            drone: null,
            zones: L.layerGroup().addTo(this.map),
            waypoints: L.layerGroup().addTo(this.map)
        };

        // System Check Marker
        L.marker(MAP_DEFAULTS.center).addTo(this.map).bindPopup("Map Engine Active");

        this.satelliteLayer = L.tileLayer(MAP_DEFAULTS.satellite);
    }

    drawPath(waypoints, isValid = true, colorOverride = null) {
        if (this.layers.path) this.map.removeLayer(this.layers.path);
        
        // Premium Glow Dynamic Color Palette
        const pathColor = colorOverride || (isValid ? '#00e5ff' : '#ff4757');
        
        this.layers.path = L.polyline(waypoints, {
            color: pathColor, 
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round',
            // Using a thinner dash for a professional 'fiber' look
            dashArray: isValid ? null : '5, 10'
        }).addTo(this.map);

        this.map.fitBounds(this.layers.path.getBounds(), { padding: [50, 50] });
        return this.layers.path;
    }

    drawNoFlyZones(zones) {
        this.layers.zones.clearLayers();
        zones.forEach(zone => {
            L.polygon(zone.coords, {
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.3,
                weight: 2
            }).addTo(this.layers.zones).bindTooltip("Restricted: " + zone.name);
        });
    }

    renderWaypoints(waypoints, showLabels, actions = []) {
        this.layers.waypoints.clearLayers();
        if (!showLabels) return;

        waypoints.forEach((wp, i) => {
            const action = actions[i] || 'Transit';
            let color = '#fff';
            
            if (action.includes('ascend')) color = '#00e5ff';
            else if (action.includes('scan')) color = '#00fa9a';
            else if (action.includes('return')) color = '#ef4444';

            const marker = L.circleMarker(wp, { 
                radius: action.includes('scan') ? 10 : 5, 
                color: color, 
                weight: 2,
                fillOpacity: 0.7 
            }).addTo(this.layers.waypoints);

            marker.bindPopup(`
                <div style="font-family: 'Share Tech Mono'; color: #000; min-width: 120px;">
                    <div style="border-bottom: 1px solid #ddd; margin-bottom: 5px; font-weight: 800;">POINT ${i+1}</div>
                    <strong>ACT:</strong> ${action.toUpperCase()}<br>
                    <strong>POS:</strong> ${wp[0].toFixed(4)}, ${wp[1].toFixed(4)}
                </div>
            `);

            if (waypoints.length < 20) {
                marker.bindTooltip(`${i+1}`, { permanent: false, direction: 'top' });
            }
        });
    }

    toggleMapStyle() {
        if (this.map.hasLayer(this.layers.base)) {
            this.map.removeLayer(this.layers.base);
            this.satelliteLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.satelliteLayer);
            this.layers.base.addTo(this.map);
        }
    }

    updateDroneMarker(latlng, heading) {
        if (!this.layers.drone) {
            const droneIcon = L.divIcon({
                className: 'drone-icon',
                html: `
                    <div class="drone-marker-wrapper" id="drone-node">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        <div class="drone-pulse"></div>
                    </div>`
            });
            this.layers.drone = L.marker(latlng, { icon: droneIcon }).addTo(this.map);
        }

        this.layers.drone.setLatLng(latlng);
        const node = document.getElementById('drone-node');
        if (node) node.style.transform = `rotate(${heading}deg)`;
    }

    clearDrone() {
        if (this.layers.drone) {
            this.map.removeLayer(this.layers.drone);
            this.layers.drone = null;
        }
    }
}
