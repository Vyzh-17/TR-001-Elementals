/**
 * SkyPlan — Main Application Module v2
 * Orchestrates drawing, form submission, API calls, and Map + UI coordination.
 */

let lastMissionData = null;

document.addEventListener('DOMContentLoaded', () => {
    MapModule.init();
    UIModule.init();

    // --- Command Form ---
    const form = document.getElementById('command-form');
    const input = document.getElementById('command-input');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const command = input.value.trim();
        if (!command) return;

        if (!MapModule.hasBoundary()) {
            UIModule.showError('Please draw an operational boundary on the map first.');
            return;
        }
        await planMission(command);
    });

    // --- Example Chips ---
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            const cmd = chip.dataset.cmd;
            input.value = cmd;
            input.focus();

            if (!MapModule.hasBoundary()) {
                UIModule.showError('Please draw an operational boundary on the map first.');
                return;
            }
            await planMission(cmd);
        });
    });

    // --- Draw Buttons ---
    document.getElementById('draw-boundary-btn').addEventListener('click', () => {
        MapModule.startDrawBoundary();
    });

    document.getElementById('draw-obstacle-btn').addEventListener('click', () => {
        if (!MapModule.hasBoundary()) {
            UIModule.showError('Draw the operational boundary first, then add obstacles.');
            return;
        }
        MapModule.startDrawObstacle();
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        MapModule.clearAll();
        UIModule.reset();
        lastMissionData = null;
    });

    document.getElementById('draw-cancel-btn').addEventListener('click', () => {
        MapModule.cancelDraw();
    });

    // --- Obstacle Modal ---
    let selectedObstacleType = null;

    document.querySelectorAll('.obstacle-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.obstacle-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedObstacleType = btn.dataset.type;
        });
    });

    document.getElementById('obstacle-confirm-btn').addEventListener('click', () => {
        if (!selectedObstacleType) {
            // Flash the grid
            document.getElementById('obstacle-type-grid').style.border = '1px solid #ef4444';
            setTimeout(() => { document.getElementById('obstacle-type-grid').style.border = 'none'; }, 1000);
            return;
        }
        const name = document.getElementById('obstacle-name-input').value.trim();
        MapModule.confirmObstacle(selectedObstacleType, name);
        document.getElementById('obstacle-modal').style.display = 'none';
        selectedObstacleType = null;
    });

    document.getElementById('obstacle-cancel-btn').addEventListener('click', () => {
        MapModule.cancelObstacle();
        document.getElementById('obstacle-modal').style.display = 'none';
        selectedObstacleType = null;
    });

    // --- Export ---
    document.getElementById('export-json-btn').addEventListener('click', () => {
        if (!lastMissionData) return;
        const blob = new Blob([JSON.stringify(lastMissionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mission_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    input.focus();
});

async function planMission(command) {
    UIModule.showLoading();

    const geometry = MapModule.getDrawnGeometry();

    try {
        const res = await fetch('/api/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: command,
                boundary: geometry.boundary,
                obstacles: geometry.obstacles,
            }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            UIModule.hideLoading();
            UIModule.showError(data.error || 'Mission planning failed');
            return;
        }

        lastMissionData = data;
        UIModule.hideLoading();
        UIModule.showResults(data);
        MapModule.renderMission(data.waypoints);

    } catch (err) {
        UIModule.hideLoading();
        UIModule.showError('Connection failed — is the server running?');
        console.error('Plan mission error:', err);
    }
}
