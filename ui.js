/**
 * AeroSync Phase 2 - UI & Telemetry Bridge Module
 */

export class MissionUI {
    static updateHUD(dist, timeRaw, battery) {
        document.getElementById('stat-distance').innerText = `${dist.toFixed(2)} km`;
        
        const mins = Math.floor(timeRaw / 60);
        const secs = Math.floor(timeRaw % 60);
        document.getElementById('stat-time').innerText = `${mins}m ${secs}s`;
        
        document.getElementById('stat-battery').innerText = `${Math.round(battery)}%`;
    }

    static showStatus(text, type = 'normal') {
        const badge = document.getElementById('status-text');
        const pulse = document.getElementById('status-pulse');
        badge.innerText = text;

        if (type === 'error') {
            pulse.style.background = '#ef4444';
        } else if (type === 'simulation') {
            pulse.style.background = '#ffab40';
        } else {
            pulse.style.background = '#00e5ff';
        }
    }

    static showAlert(msg, isVisible) {
        const banner = document.getElementById('status-alert');
        const msgEl = document.getElementById('alert-msg');
        
        if (isVisible) {
            banner.classList.remove('hidden');
            msgEl.innerText = msg;
        } else {
            banner.classList.add('hidden');
        }
    }

    static renderValidation(checks) {
        const container = document.getElementById('validation-report');
        container.innerHTML = '';
        
        checks.forEach(check => {
            const div = document.createElement('div');
            div.className = check.valid ? 'success-check' : 'violation';
            div.innerHTML = `<h4>${check.valid ? '✅' : '⚠️'} ${check.title}</h4><p>${check.msg}</p>`;
            container.appendChild(div);
        });

        document.getElementById('validation-panel').classList.remove('hidden');
    }

    static setPlanningState(isPlanning) {
        const btn = document.getElementById('generate-mission-btn');
        if (isPlanning) {
            btn.disabled = true;
            btn.innerText = "Processing...";
        } else {
            btn.disabled = false;
            btn.innerText = "Initialize Smart Planning";
        }
    }
}
