/**
 * SkyPlan — UI Module v2
 * Renders mission results, stats, alerts, and waypoints.
 */
const UIModule = (() => {
    const els = {};

    function cacheElements() {
        els.emptyState = document.getElementById('empty-state');
        els.missionResults = document.getElementById('mission-results');
        els.statusBanner = document.getElementById('status-banner');
        els.statusIcon = document.getElementById('status-icon');
        els.statusValue = document.getElementById('status-value');
        els.parsedBody = document.getElementById('parsed-body');
        els.statsBody = document.getElementById('stats-body');
        els.alertsCard = document.getElementById('alerts-card');
        els.alertsBody = document.getElementById('alerts-body');
        els.waypointsBody = document.getElementById('waypoints-body');
        els.waypointCount = document.getElementById('waypoint-count');
        els.headerStatus = document.getElementById('header-status');
    }

    function init() { cacheElements(); }

    function showResults(data) {
        els.emptyState.style.display = 'none';
        els.missionResults.style.display = 'flex';
        els.missionResults.style.flexDirection = 'column';
        els.missionResults.style.gap = '12px';
        renderStatus(data.validation);
        renderParsed(data.mission);
        renderStats(data.validation.stats);
        renderAlerts(data.validation);
        renderWaypoints(data.waypoints);
        updateHeader(data.validation.safe);
    }

    function renderStatus(v) {
        els.statusBanner.className = 'status-banner';
        if (!v.safe) {
            els.statusBanner.classList.add('unsafe');
            els.statusIcon.innerHTML = '✕';
            els.statusValue.textContent = 'Mission Unsafe — Cannot Proceed';
        } else if (v.warnings.length > 0) {
            els.statusBanner.classList.add('warning');
            els.statusIcon.innerHTML = '⚠';
            els.statusValue.textContent = 'Mission Safe — With Warnings';
        } else {
            els.statusBanner.classList.add('safe');
            els.statusIcon.innerHTML = '✓';
            els.statusValue.textContent = 'Mission Safe — Ready to Fly';
        }
    }

    function renderParsed(m) {
        const types = { grid_scan:'🔲 Grid Scan', perimeter:'🔄 Perimeter', point_inspect:'📍 Inspect' };
        let h = row('Mission Type', types[m.mission_type] || m.mission_type);
        h += row('Altitude', m.altitude + 'm');
        h += row('Speed', m.speed + ' m/s');
        if (m.constraints && m.constraints.length) {
            const tags = m.constraints.map(c => `<span class="constraint-tag">${c}</span>`).join(' ');
            h += `<div class="parsed-item"><span class="parsed-key">Avoid</span><div>${tags}</div></div>`;
        } else {
            h += row('Avoid', 'None');
        }
        els.parsedBody.innerHTML = h;
    }

    function row(k, v) {
        return `<div class="parsed-item"><span class="parsed-key">${k}</span><span class="parsed-value">${v}</span></div>`;
    }

    function renderStats(s) {
        const bc = s.battery_usage_pct > 90 ? 'danger' : s.battery_usage_pct > 70 ? 'warning' : '';
        els.statsBody.innerHTML = `
            <div class="stat-item"><span class="stat-value">${s.total_distance_km}</span><span class="stat-label">Distance (km)</span></div>
            <div class="stat-item"><span class="stat-value">${s.num_waypoints}</span><span class="stat-label">Waypoints</span></div>
            <div class="stat-item"><span class="stat-value">${s.estimated_flight_time_min}</span><span class="stat-label">Flight (min)</span></div>
            <div class="stat-item battery ${bc}"><span class="stat-value">${s.battery_usage_pct}%</span><span class="stat-label">Battery</span></div>
            <div class="stat-item"><span class="stat-value">${s.altitude_m}m</span><span class="stat-label">Altitude</span></div>
            <div class="stat-item"><span class="stat-value">${s.speed_mps}</span><span class="stat-label">Speed (m/s)</span></div>`;
    }

    function renderAlerts(v) {
        if (!v.warnings.length && !v.errors.length) { els.alertsCard.style.display = 'none'; return; }
        els.alertsCard.style.display = 'block';
        let h = '';
        v.errors.forEach(e => { h += `<div class="alert-item error"><span class="alert-icon">🚫</span><span>${e}</span></div>`; });
        v.warnings.forEach(w => { h += `<div class="alert-item warning"><span class="alert-icon">⚠️</span><span>${w}</span></div>`; });
        els.alertsBody.innerHTML = h;
    }

    function renderWaypoints(wps) {
        els.waypointCount.textContent = wps.length;
        const max = 50, show = wps.slice(0, max);
        let h = '';
        show.forEach((wp, i) => {
            h += `<div class="wp-row"><span class="wp-index">${i + 1}</span><span class="wp-coords">${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}</span><span class="wp-alt">${wp.alt}m</span></div>`;
        });
        if (wps.length > max) h += `<div class="wp-row" style="justify-content:center;color:var(--text-muted);">... and ${wps.length - max} more</div>`;
        els.waypointsBody.innerHTML = h;
    }

    function updateHeader(safe) {
        const dot = els.headerStatus.querySelector('.status-dot');
        const txt = els.headerStatus.querySelector('.status-text');
        if (safe) { dot.style.background = 'var(--success)'; dot.style.boxShadow = '0 0 8px var(--success)'; txt.textContent = 'Mission Planned ✓'; }
        else { dot.style.background = 'var(--danger)'; dot.style.boxShadow = '0 0 8px var(--danger)'; txt.textContent = 'Mission Unsafe ✕'; }
    }

    function showLoading() {
        document.getElementById('submit-btn').classList.add('loading');
        const dot = els.headerStatus.querySelector('.status-dot');
        const txt = els.headerStatus.querySelector('.status-text');
        dot.style.background = 'var(--warning)'; dot.style.boxShadow = '0 0 8px var(--warning)'; txt.textContent = 'Planning...';
    }

    function hideLoading() { document.getElementById('submit-btn').classList.remove('loading'); }

    function showError(msg) {
        els.emptyState.style.display = 'none';
        els.missionResults.style.display = 'flex'; els.missionResults.style.flexDirection = 'column'; els.missionResults.style.gap = '12px';
        els.statusBanner.className = 'status-banner unsafe'; els.statusIcon.innerHTML = '✕'; els.statusValue.textContent = msg;
        els.parsedBody.innerHTML = ''; els.statsBody.innerHTML = ''; els.alertsCard.style.display = 'none';
        els.waypointsBody.innerHTML = ''; els.waypointCount.textContent = '0';
        const dot = els.headerStatus.querySelector('.status-dot');
        const txt = els.headerStatus.querySelector('.status-text');
        dot.style.background = 'var(--danger)'; dot.style.boxShadow = '0 0 8px var(--danger)'; txt.textContent = 'Error';
    }

    function reset() {
        els.emptyState.style.display = 'flex';
        els.missionResults.style.display = 'none';
        const dot = els.headerStatus.querySelector('.status-dot');
        const txt = els.headerStatus.querySelector('.status-text');
        dot.style.background = 'var(--success)'; dot.style.boxShadow = '0 0 8px var(--success)'; txt.textContent = 'System Ready';
    }

    return { init, showResults, showLoading, hideLoading, showError, reset };
})();
