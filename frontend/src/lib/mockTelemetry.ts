// Simulates rainfall + soil moisture sensor readings for the demo.
// Replace with a real WebSocket/polling source post-hackathon.

export interface TelemetryPoint {
  time: string;       // HH:MM:SS
  rainfall_mm: number; // mm/hr
  soil_moisture: number; // volumetric %, 0-100
}

const HAZARD_RAINFALL_MM = 40;   // mm/hr threshold
const HAZARD_SOIL_MOISTURE = 65; // % threshold

export function isHazardLevel(point: TelemetryPoint) {
  return point.rainfall_mm >= HAZARD_RAINFALL_MM || point.soil_moisture >= HAZARD_SOIL_MOISTURE;
}

export function createTelemetryStream(
  onPoint: (point: TelemetryPoint) => void,
  intervalMs = 2000
) {
  let rainfall = 8 + Math.random() * 5;
  let moisture = 30 + Math.random() * 10;
  let stormTriggered = false;

  const id = setInterval(() => {
    rainfall += (Math.random() - 0.5) * 3;
    moisture += (Math.random() - 0.5) * 2;

    if (stormTriggered) {
      rainfall += Math.random() * 8;
      moisture += Math.random() * 4;
    }

    rainfall = Math.max(0, rainfall);
    moisture = Math.min(100, Math.max(0, moisture));

    onPoint({
      time: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      rainfall_mm: Number(rainfall.toFixed(1)),
      soil_moisture: Number(moisture.toFixed(1)),
    });
  }, intervalMs);

  return {
    stop: () => clearInterval(id),
    triggerStorm: () => { stormTriggered = true; },
    resetStorm: () => { stormTriggered = false; },
  };
}

export { HAZARD_RAINFALL_MM, HAZARD_SOIL_MOISTURE };