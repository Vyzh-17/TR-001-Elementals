/**
 * SkyPlan — Map Module v3
 * Interactive map with drawing + auto-fetches real-world OSM obstacles.
 */

const MapModule = (() => {
    let map = null;
    let missionLayer = null;
    let drawnItems = null;
    let osmLayer = null;           // OSM obstacle layer
    let boundaryLayer = null;
    let obstacleData = [];         // User-drawn obstacles
    let osmObstacleData = [];      // OSM-fetched obstacles (GeoJSON features)
    let currentDrawHandler = null;
    let drawMode = null;
    let pendingObstacleLayer = null;

    const OBSTACLE_COLORS = {
        boundary:    { fill: '#00e5ff', stroke: '#00e5ff', fillOpacity: 0.06, weight: 2, dashArray: '10,6' },
        river:       { fill: '#42a5f5', stroke: '#1e88e5', fillOpacity: 0.3,  weight: 1.5 },
        building:    { fill: '#ff9800', stroke: '#ef6c00', fillOpacity: 0.35, weight: 1 },
        no_fly_zone: { fill: '#f44336', stroke: '#d32f2f', fillOpacity: 0.25, weight: 2, dashArray: '6,4' },
        vegetation:  { fill: '#66bb6a', stroke: '#43a047', fillOpacity: 0.25, weight: 1.5 },
        road:        { fill: '#78909c', stroke: '#546e7a', fillOpacity: 0.2,  weight: 1.5 },
        powerline:   { fill: '#ffeb3b', stroke: '#f9a825', fillOpacity: 0.15, weight: 1.5, dashArray: '4,4' },
        water:       { fill: '#42a5f5', stroke: '#1e88e5', fillOpacity: 0.3,  weight: 1.5 },
    };

    function init() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => _createMap(pos.coords.latitude, pos.coords.longitude, 16),
                ()    => _createMap(11.023, 76.9585, 14),
                { timeout: 5000 }
            );
        } else {
            _createMap(11.023, 76.9585, 14);
        }
    }

    function _createMap(lat, lon, zoom) {
        map = L.map('map', { center: [lat, lon], zoom, zoomControl: true });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM &copy; CARTO',
            subdomains: 'abcd', maxZoom: 19,
        }).addTo(map);

        const tp = document.querySelector('.leaflet-tile-pane');
        if (tp) tp.style.filter = 'none';

        drawnItems = new L.FeatureGroup().addTo(map);
        osmLayer = new L.LayerGroup().addTo(map);
        missionLayer = new L.LayerGroup().addTo(map);

        _addLocationSearch();
        map.on(L.Draw.Event.CREATED, _onDrawCreated);
    }

    function _addLocationSearch() {
        const ctrl = L.control({ position: 'topright' });
        ctrl.onAdd = function () {
            const div = L.DomUtil.create('div', 'leaflet-location-search');
            div.innerHTML = `<input type="text" id="location-search-input" placeholder="🔍 Search any location..."
                style="width:220px;padding:8px 12px;background:#1a2035;border:1px solid rgba(255,255,255,0.15);
                color:#e2e8f0;border-radius:8px;font-size:12px;font-family:Inter,sans-serif;outline:none;">`;
            L.DomEvent.disableClickPropagation(div);
            return div;
        };
        ctrl.addTo(map);

        setTimeout(() => {
            const input = document.getElementById('location-search-input');
            if (input) {
                input.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const q = input.value.trim();
                        if (!q) return;
                        try {
                            input.style.borderColor = '#f59e0b';
                            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
                            const data = await res.json();
                            if (data.length > 0) {
                                map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16, { animate: true });
                                input.value = data[0].display_name.split(',').slice(0, 2).join(',');
                                input.style.borderColor = '#10b981';
                            } else {
                                input.style.borderColor = '#ef4444';
                            }
                        } catch { input.style.borderColor = '#ef4444'; }
                        setTimeout(() => { input.style.borderColor = 'rgba(255,255,255,0.15)'; }, 2000);
                    }
                });
            }
        }, 500);
    }

    // --- Draw Controls ---
    function startDrawBoundary() {
        if (boundaryLayer) { drawnItems.removeLayer(boundaryLayer); boundaryLayer = null; }
        osmLayer.clearLayers(); osmObstacleData = [];
        drawMode = 'boundary';
        _showBanner('Click on the map to draw your operational area. Double-click to finish.');
        currentDrawHandler = new L.Draw.Polygon(map, {
            shapeOptions: { color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.06, weight: 2, dashArray: '10,6' },
            allowIntersection: false,
        });
        currentDrawHandler.enable();
    }

    function startDrawObstacle() {
        drawMode = 'obstacle';
        _showBanner('Draw an obstacle zone. Double-click to finish.');
        currentDrawHandler = new L.Draw.Polygon(map, {
            shapeOptions: { color: '#ff9800', fillColor: '#ff9800', fillOpacity: 0.25, weight: 2 },
            allowIntersection: false,
        });
        currentDrawHandler.enable();
    }

    function cancelDraw() {
        if (currentDrawHandler) { currentDrawHandler.disable(); currentDrawHandler = null; }
        drawMode = null; _hideBanner();
    }

    function clearAll() {
        drawnItems.clearLayers(); osmLayer.clearLayers(); missionLayer.clearLayers();
        boundaryLayer = null; obstacleData = []; osmObstacleData = [];
        drawMode = null; _hideBanner(); _updateDrawStatus();
    }

    function _onDrawCreated(e) {
        const layer = e.layer;
        if (drawMode === 'boundary') {
            boundaryLayer = layer;
            layer.setStyle(OBSTACLE_COLORS.boundary);
            layer.bindTooltip('Operational Boundary', { permanent: false, direction: 'center' });
            drawnItems.addLayer(layer);
            drawMode = null; _hideBanner(); _updateDrawStatus();
            // AUTO-FETCH OSM obstacles!
            _fetchOSMObstacles();
        } else if (drawMode === 'obstacle') {
            pendingObstacleLayer = layer;
            _showObstacleModal();
            drawMode = null; _hideBanner();
        }
        currentDrawHandler = null;
    }

    async function _fetchOSMObstacles() {
        if (!boundaryLayer) return;

        const latlngs = boundaryLayer.getLatLngs()[0];
        const boundary = latlngs.map(ll => [ll.lng, ll.lat]);
        boundary.push(boundary[0]);

        // Show loading
        const statusEl = document.getElementById('osm-fetch-status');
        if (statusEl) { statusEl.textContent = 'Fetching real-world data...'; statusEl.style.color = '#f59e0b'; }

        try {
            const res = await fetch('/api/fetch_obstacles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boundary }),
            });
            const geojson = await res.json();

            if (geojson.features) {
                osmObstacleData = geojson.features;
                _renderOSMObstacles(geojson);
                if (statusEl) {
                    // Show type breakdown
                    const tc = geojson.type_counts || {};
                    const parts = [];
                    if (tc.building) parts.push(`🏢${tc.building}`);
                    if (tc.river) parts.push(`🌊${tc.river}`);
                    if (tc.road) parts.push(`🛣️${tc.road}`);
                    if (tc.powerline) parts.push(`⚡${tc.powerline}`);
                    const detail = parts.length ? ` (${parts.join(' ')})` : '';
                    statusEl.textContent = `✓ ${geojson.count} obstacles${detail}`;
                    statusEl.style.color = '#10b981';
                }
                _updateDrawStatus();
            }
        } catch (err) {
            console.error('OSM fetch failed:', err);
            if (statusEl) { statusEl.textContent = '⚠ OSM fetch failed (continue manually)'; statusEl.style.color = '#ef4444'; }
        }
    }

    function _renderOSMObstacles(geojson) {
        osmLayer.clearLayers();
        if (!geojson || !geojson.features) return;

        geojson.features.forEach(feature => {
            const type = feature.properties.type;
            const name = feature.properties.name;
            const colors = OBSTACLE_COLORS[type] || { fill: '#9e9e9e', stroke: '#757575', fillOpacity: 0.2, weight: 1 };

            try {
                const layer = L.geoJSON(feature, {
                    style: {
                        fillColor: colors.fill, fillOpacity: colors.fillOpacity,
                        color: colors.stroke, weight: colors.weight || 1,
                        opacity: 0.7, dashArray: colors.dashArray || null,
                    },
                });
                if (name && name !== 'Building') {
                    layer.bindTooltip(name, { permanent: false, direction: 'center', className: 'obstacle-tooltip' });
                }
                osmLayer.addLayer(layer);
            } catch (e) {
                // Skip invalid geometries
            }
        });
    }

    function confirmObstacle(type, name) {
        if (!pendingObstacleLayer) return;
        const colors = OBSTACLE_COLORS[type] || OBSTACLE_COLORS.building;
        pendingObstacleLayer.setStyle({
            color: colors.stroke, fillColor: colors.fill,
            fillOpacity: colors.fillOpacity, weight: colors.weight || 2,
            dashArray: colors.dashArray || null,
        });
        const displayName = name || type.replace(/_/g, ' ');
        pendingObstacleLayer.bindTooltip(displayName, { permanent: false, direction: 'center' });
        drawnItems.addLayer(pendingObstacleLayer);
        obstacleData.push({ layer: pendingObstacleLayer, type, name: displayName });
        pendingObstacleLayer = null; _updateDrawStatus();
    }

    function cancelObstacle() { pendingObstacleLayer = null; }

    function getDrawnGeometry() {
        const result = { boundary: null, obstacles: [] };

        if (boundaryLayer) {
            const latlngs = boundaryLayer.getLatLngs()[0];
            result.boundary = latlngs.map(ll => [ll.lng, ll.lat]);
            if (result.boundary.length > 0) result.boundary.push(result.boundary[0]);
        }

        // User-drawn obstacles
        obstacleData.forEach(obs => {
            const latlngs = obs.layer.getLatLngs()[0];
            const coords = latlngs.map(ll => [ll.lng, ll.lat]);
            if (coords.length > 0) coords.push(coords[0]);
            result.obstacles.push({ type: obs.type, name: obs.name, coordinates: coords });
        });

        return result;
    }

    function hasBoundary() { return boundaryLayer !== null; }

    // --- Mission rendering ---
    function renderMission(waypoints) {
        missionLayer.clearLayers();
        if (!waypoints || waypoints.length === 0) return;

        const latlngs = waypoints.map(wp => [wp.lat, wp.lon]);
        L.polyline(latlngs, { color: '#00e5ff', weight: 8, opacity: 0.12, smoothFactor: 1 }).addTo(missionLayer);
        L.polyline(latlngs, { color: '#00e5ff', weight: 2.5, opacity: 0.9, smoothFactor: 1 }).addTo(missionLayer);

        waypoints.forEach((wp, i) => {
            const isFirst = i === 0, isLast = i === waypoints.length - 1;
            let color = '#7c4dff', size = 7;
            if (isFirst) { color = '#10b981'; size = 12; }
            else if (isLast) { color = '#ef4444'; size = 12; }

            L.marker([wp.lat, wp.lon], {
                icon: L.divIcon({
                    className: 'wp-m',
                    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid rgba(255,255,255,0.7);border-radius:50%;box-shadow:0 0 5px ${color};"></div>`,
                    iconSize: [size, size], iconAnchor: [size/2, size/2],
                })
            }).bindTooltip(`WP ${i+1} | ${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)} | Alt: ${wp.alt}m`, { direction: 'top' })
            .addTo(missionLayer);
        });

        // Labels
        L.marker([waypoints[0].lat, waypoints[0].lon], {
            icon: L.divIcon({ className: 'x', html: '<div style="background:#10b981;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;box-shadow:0 2px 8px rgba(16,185,129,0.4);">START</div>', iconAnchor: [-10, 10] })
        }).addTo(missionLayer);

        const last = waypoints[waypoints.length - 1];
        L.marker([last.lat, last.lon], {
            icon: L.divIcon({ className: 'x', html: '<div style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;box-shadow:0 2px 8px rgba(239,68,68,0.4);">END</div>', iconAnchor: [-10, 10] })
        }).addTo(missionLayer);

        map.fitBounds(L.latLngBounds(latlngs).pad(0.15), { animate: true });
    }

    function clearMission() { if (missionLayer) missionLayer.clearLayers(); }

    function _showBanner(text) {
        const b = document.getElementById('draw-banner');
        document.getElementById('draw-banner-text').textContent = text;
        b.style.display = 'flex';
    }
    function _hideBanner() { document.getElementById('draw-banner').style.display = 'none'; }
    function _showObstacleModal() {
        document.getElementById('obstacle-modal').style.display = 'flex';
        document.querySelectorAll('.obstacle-type-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('obstacle-name-input').value = '';
    }
    function _updateDrawStatus() {
        const bs = document.getElementById('boundary-status');
        const os = document.getElementById('obstacle-status');
        const totalObs = obstacleData.length + osmObstacleData.length;
        if (bs) { bs.textContent = boundaryLayer ? '✓ Defined' : 'Not drawn'; bs.style.color = boundaryLayer ? '#10b981' : '#64748b'; }
        if (os) { os.textContent = `${totalObs} zone${totalObs !== 1 ? 's' : ''} (${osmObstacleData.length} from OSM)`; }
    }

    return {
        init, startDrawBoundary, startDrawObstacle, cancelDraw, clearAll,
        confirmObstacle, cancelObstacle, getDrawnGeometry, hasBoundary,
        renderMission, clearMission,
    };
})();
