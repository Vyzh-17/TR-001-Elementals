/**
 * AeroSync Intelligence System - AI Mission Parser (Final Integrated Version)
 * Uses the reference data-flow structure with the Gemini Energy backend.
 */

export class MissionParser {
    constructor() {
        this.apiEndpoint = 'http://localhost:5000/api/plan';
    }

    /**
     * Sends mission description to the backend for AI-optimized planning
     */
    async parse(naturalLanguage, specs = {}) {
        try {
            console.log("AeroSync Parser: Contacting AI Backend...");
            
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mission_description: naturalLanguage,
                    max_altitude: specs.maxAlt || 120,
                    max_speed: specs.speed || 15,
                    battery_minutes: specs.batteryMins || 45
                })
            });

            if (!response.ok) throw new Error("Backend Offline");
            
            const data = await response.json();
            return this.normalizeAIData(data, naturalLanguage);
            
        } catch (e) {
            console.warn("AeroSync Parser: Falling back to Local Heuristics.", e);
            return this.localHeuristicFallback(naturalLanguage);
        }
    }

    /**
     * Normalizes the AI response into the format expected by app.js (Array-based coords)
     */
    normalizeAIData(aiResponse, rawInput) {
        if (!aiResponse.flight_plan || !aiResponse.flight_plan.waypoints) {
            return this.localHeuristicFallback(rawInput);
        }

        const wpList = aiResponse.flight_plan.waypoints;

        return {
            mission_type: aiResponse.mission_summary?.type || "survey",
            area: aiResponse.mission_summary?.area || "Identified Target",
            altitude: wpList[0]?.alt || 30,
            // CRITICAL: Convert AI {lat, lon} objects to [lat, lon] arrays
            waypoints: wpList.map(w => [w.lat, w.lon]),
            actions: wpList.map(w => w.action || 'move'),
            energy: aiResponse.energy_analysis || { estimated_usage_percentage: 15 },
            feasibility: aiResponse.feasibility_report || { battery_ok: true }
        };
    }

    localHeuristicFallback(input) {
        const lower = input.toLowerCase();
        let type = lower.includes("survey") || lower.includes("coverage") ? "survey" : "perimeter";
        
        // Match name after survey/the
        const areaMatch = input.match(/(?:survey|coverage|the)\s+([\w\s]+?)(?:\s+at|and|avoid|$)/i);
        const area = areaMatch ? areaMatch[1].trim() : "Target Area";

        return {
            mission_type: type,
            area: area,
            altitude: 30,
            waypoints: null, // Signals app.js to generate the grid
            actions: ["takeoff", type, "landing"]
        };
    }
}
