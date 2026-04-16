/**
 * AeroSync Phase 2 - Geospatial Visualization Module
 */

export const MAP_DEFAULTS = {
    center: [10.0, 78.0],
    zoom: 14,
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

export class MissionMap {
    constructor(elementId) {
        this.map = L.map(elementId, { zoomControl: false, attributionControl: false }).setView(MAP_DEFAULTS.center, MAP_DEFAULTS.zoom);
        
        this.layers = {
            base: L.tileLayer(MAP_DEFAULTS.dark).addTo(this.map),
            path: null,
            drone: null,
            zones: L.layerGroup().addTo(this.map),
            waypoints: L.layerGroup().addTo(this.map)
        };

        this.satelliteLayer = L.tileLayer(MAP_DEFAULTS.satellite);
    }

    drawPath(waypoints, isValid = true) {
        if (this.layers.path) this.map.removeLayer(this.layers.path);
        
        this.layers.path = L.polyline(waypoints, {
            color: isValid ? '#00e5ff' : '#ef4444', 
            weight: 4,
            opacity: 0.9,
            dashArray: isValid ? '10, 10' : '5, 5'
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

    renderWaypoints(waypoints, showLabels) {
        this.layers.waypoints.clearLayers();
        if (!showLabels) return;

        waypoints.forEach((wp, i) => {
            L.circleMarker(wp, { radius: 4, color: '#fff' })
                .addTo(this.layers.waypoints)
                .bindTooltip(`${i+1}`, { permanent: true, direction: 'top', className: 'wp-label' });
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
