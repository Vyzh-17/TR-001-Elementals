document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('mission-form');
    const loadingOverlay = document.getElementById('loading-overlay');
    const summaryContent = document.getElementById('summary-content');
    const jsonOutput = document.getElementById('json-output');
    
    // Metrics elements
    const valBattery = document.getElementById('val-battery');
    const valRisk = document.getElementById('val-risk');
    const valTime = document.getElementById('val-time');
    const valFeasible = document.getElementById('val-feasible');

    // Leaflet map setup
    let currentFlightPlan = null;
    
    const map = L.map('map', {zoomControl: true, scrollWheelZoom: true}).setView([34.0522, -118.2437], 13);
    
    // Add dark cyber-styled base map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    let currentPolyline = null;
    let currentMarkers = [];

    // Toast functionality
    const toastContainer = document.getElementById('toast-container');
    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.innerHTML = isError ? `<strong>WARNING:</strong> ${message}` : message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('mission-description').value;
        const altitude = parseInt(document.getElementById('max-altitude').value);
        const speed = parseInt(document.getElementById('max-speed').value);
        const battery = parseInt(document.getElementById('battery-minutes').value);

        // Show loading
        loadingOverlay.classList.remove('hidden');

        try {
            const response = await fetch('/api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mission_description: description,
                    max_altitude: altitude,
                    max_speed: speed,
                    battery_minutes: battery
                })
            });

            const data = await response.json();
            
            if(data.error) {
                showToast(data.error, true);
                if (data.mission_summary) updateDashboard(data); // If mock data appended
            } else {
                updateDashboard(data);
                showToast("Trajectory generated successfully!");
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to connect to the Drone AI Backend.', true);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    });

    function updateDashboard(data) {
        // Update summary
        const sum = data.mission_summary;
        summaryContent.innerHTML = `
            <strong>TYPE:</strong> ${sum.type}<br>
            <strong>AREA:</strong> ${sum.area}<br>
            <strong>STRATEGY:</strong> <span style="color:var(--primary-neon)">${sum.strategy}</span>
        `;

        // Update JSON
        jsonOutput.textContent = JSON.stringify(data, null, 2);
        
        // Store the original flight plan and show optimize button
        currentFlightPlan = data.flight_plan;
        document.getElementById('optimize-btn').style.display = 'block';

        // Update Metrics
        const rep = data.feasibility_report;
        const eng = data.energy_analysis;
        
        valBattery.textContent = `${eng.estimated_usage_percentage}%`;
        valBattery.className = 'value ' + (eng.estimated_usage_percentage > 80 ? 'danger' : (eng.estimated_usage_percentage > 50 ? 'warn' : 'good'));

        valRisk.textContent = rep.collision_risk.toUpperCase();
        valRisk.className = 'value ' + (rep.collision_risk === 'high' ? 'danger' : (rep.collision_risk === 'medium' ? 'warn' : 'good'));

        valTime.textContent = rep.mission_time_minutes;
        
        valFeasible.textContent = rep.battery_ok && rep.return_safe ? 'YES' : 'NO';
        valFeasible.className = 'value ' + (rep.battery_ok && rep.return_safe ? 'good' : 'danger');

        // Draw Map
        drawWaypoints(data.flight_plan.waypoints);
    }

    document.getElementById('optimize-btn').addEventListener('click', async () => {
        if (!currentFlightPlan) return;
        const speed = parseInt(document.getElementById('max-speed').value);
        const battery = parseInt(document.getElementById('battery-minutes').value);
        
        loadingOverlay.querySelector('.loading-text').textContent = 'APPLYING ANTI-GRAVITY OPTIMIZATIONS...';
        loadingOverlay.classList.remove('hidden');

        try {
            const response = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flight_plan: currentFlightPlan,
                    max_speed: speed,
                    battery_minutes: battery
                })
            });

            const data = await response.json();
            if(data.error) {
                showToast(data.error, true);
                if (data.optimized_flight_plan) updateOptimizedDashboard(data);
            } else {
                updateOptimizedDashboard(data);
                showToast("Mission perfectly optimized!", false);
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to connect to the Drone AI Backend.', true);
        } finally {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.querySelector('.loading-text').textContent = 'GENERATING ANTI-GRAVITY FLIGHT PATH...';
        }
    });

    function updateOptimizedDashboard(data) {
        const mods = data.optimized_flight_plan.modifications || [];
        summaryContent.innerHTML = `
            <strong>STRATEGY:</strong> <span style="color:var(--primary-neon)">Trajectory Optimized</span><br>
            <strong>MODIFICATIONS:</strong><br>
            <ul style="margin:5px 0 0 0; padding-left:15px; font-size:13px; color:#cccccc;">
                ${mods.map(m => `<li>${m}</li>`).join('')}
            </ul>
        `;

        jsonOutput.textContent = JSON.stringify(data, null, 2);

        const rep = data.feasibility;
        const eng = data.energy_comparison;
        
        valBattery.textContent = `${eng.optimized_usage_percentage}%`;
        valBattery.className = 'value ' + (eng.optimized_usage_percentage > 80 ? 'danger' : (eng.optimized_usage_percentage > 50 ? 'warn' : 'good'));

        valRisk.textContent = `-${eng.savings_percentage}% ENERGY`;
        valRisk.className = 'value good';
        
        valTime.textContent = '--';
        
        valFeasible.textContent = rep.battery_ok && rep.return_safe ? 'YES' : 'NO';
        valFeasible.className = 'value ' + (rep.battery_ok && rep.return_safe ? 'good' : 'danger');

        drawWaypoints(data.optimized_flight_plan.waypoints, true);
        currentFlightPlan = data.optimized_flight_plan;
    }

    function drawWaypoints(waypoints, isOptimized = false) {
        if (!waypoints || waypoints.length === 0) return;
        
        if (!isOptimized) {
            if (currentPolyline) map.removeLayer(currentPolyline);
            if (window.oldPolyline) map.removeLayer(window.oldPolyline);
            currentMarkers.forEach(m => map.removeLayer(m));
            currentMarkers = [];
            currentPolyline = null;
            window.oldPolyline = null;
        } else {
            // Keep the old line visible in background, colored red and dimmed
            if (currentPolyline) {
                currentPolyline.setStyle({ color: '#ff2a2a', opacity: 0.35, dashArray: '2, 6' });
                window.oldPolyline = currentPolyline;
            }
            // Clear only the markers so the map isn't cluttered
            currentMarkers.forEach(m => map.removeLayer(m));
            currentMarkers = [];
        }
        
        const latlngs = waypoints.map(wp => [wp.lat, wp.lon]);
        
        // Draw the main path glowing in success green if optimized
        currentPolyline = L.polyline(latlngs, {
            color: isOptimized ? '#00fa9a' : '#00f3ff', 
            weight: isOptimized ? 4 : 3, 
            opacity: 0.9,
            dashArray: '5, 5'
        }).addTo(map);

        waypoints.forEach(wp => {
            let color = '#aaaaaa';
            if (wp.action.includes('ascend')) color = '#00f3ff';
            else if (wp.action.includes('move')) color = '#ffffff';
            else if (wp.action.includes('hover') || wp.action.includes('scan')) color = isOptimized ? '#00fa9a' : '#00f3ff';
            else if (wp.action.includes('return') || wp.action.includes('land')) color = '#ff2a2a';
            else if (wp.action.includes('takeoff')) color = '#00f3ff';

            const marker = L.circleMarker([wp.lat, wp.lon], {
                radius: wp.action.includes('scan') ? (isOptimized ? 12 : 10) : 6,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: 'Share Tech Mono'; color: #000;">
                    <strong>Action:</strong> ${wp.action}<br>
                    <strong>Alt:</strong> ${wp.alt}m<br>
                    <strong>Coors:</strong> ${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}
                </div>
            `);
            currentMarkers.push(marker);
        });

        if (isOptimized && window.oldPolyline) {
            // Re-center map to safely frame both original and optimized routes
            map.fitBounds(currentPolyline.getBounds().extend(window.oldPolyline.getBounds()), {padding: [40, 40]});
        } else {
            map.fitBounds(currentPolyline.getBounds(), {padding: [40, 40]});
        }
    }
});
