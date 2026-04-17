import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Rectangle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { REGIONS } from '../engine/regionEngine.js';
import 'leaflet/dist/leaflet.css';
import { Target, Navigation2 } from 'lucide-react';

// Custom Marker component to update position without full re-render
const DroneMarker = ({ drone }) => {
  const getIconColor = (status) => {
    switch (status) {
      case 'in-region': return '#ffcc00';
      case 'optimized': return '#00ff9d';
      default: return '#00f2ff';
    }
  };

  // Custom SVG Icon for Leaflet
  const icon = L.divIcon({
    className: 'custom-drone-icon',
    html: `
      <div style="transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center;">
        <div style="
          width: 14px; 
          height: 14px; 
          background: ${getIconColor(drone.status)}; 
          border-radius: 2px;
          box-shadow: 0 0 10px ${getIconColor(drone.status)};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
        </div>
        <div style="
          margin-top: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px;
          color: white;
          background: rgba(5, 7, 10, 0.9);
          padding: 1px 4px;
          border-radius: 2px;
          white-space: nowrap;
          border: 1px solid ${getIconColor(drone.status)}44;
        ">
          ${drone.id}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });

  return (
    <Marker position={[drone.position.lat, drone.position.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false}>
        <div style={{ backgroundColor: '#0c0f14', color: '#e0e6ed', border: '1px solid #1e2631', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>
          <strong>{drone.id}</strong><br/>
          Alt: {drone.alt.toFixed(1)}m<br/>
          Spd: {drone.speed.toFixed(1)} km/h<br/>
          Pwr: <span style={{color: drone.energy < 20 ? 'red' : 'var(--green)'}}>{drone.energy.toFixed(1)}%</span>
        </div>
      </Tooltip>
    </Marker>
  );
};

const TacticalMap = ({ drones }) => {
  const center = [52.53, 13.415]; // Center between BASE_LAT and BASE_LNG + RANGE

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <div className="panel-header">
        <Target size={14} color="var(--cyan)" />
        Tactical Geospatial Environment
      </div>
      
      <div className="panel-content" style={{ padding: '0', position: 'relative', overflow: 'hidden' }}>
        <MapContainer 
          center={center} 
          zoom={14} 
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#05070a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {REGIONS.map(region => (
            <Rectangle 
              key={region.id}
              bounds={[[region.bounds.minLat, region.bounds.minLng], [region.bounds.maxLat, region.bounds.maxLng]]}
              pathOptions={{ color: 'var(--cyan)', weight: 1, fillOpacity: 0.05, dashArray: '4, 4' }}
            >
              <Tooltip direction="center" permanent={false} opacity={0.6}>
                <div style={{ backgroundColor: '#0c0f14', color: 'var(--cyan)', fontSize: '10px', border: '1px solid var(--border-muted)', padding: '2px 4px' }}>
                  {region.id}
                </div>
              </Tooltip>
            </Rectangle>
          ))}
          
          {drones.map(drone => {
             const pathObj = [[drone.position.lat, drone.position.lng], ...drone.currentPath.map(w => [w.lat, w.lng])];
             
             let pathColor = '#00f2ff';
             if (drone.status === 'optimized') pathColor = '#00ff9d';
             if (drone.status === 'in-region') pathColor = '#ffcc00';

             return (
               <React.Fragment key={drone.id}>
                 <Polyline positions={pathObj} pathOptions={{ color: pathColor, weight: 2, dashArray: '4, 6', opacity: 0.4 }} />
                 <DroneMarker drone={drone} />
               </React.Fragment>
             );
          })}

          {/* Map Controls / HUD Overlay */}
          <div className="map-hud-overlay" style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 1000,
            display: 'flex',
            gap: '12px',
            pointerEvents: 'none'
          }}>
            <div style={{ background: 'rgba(12, 15, 20, 0.8)', padding: '8px 12px', border: '1px solid var(--border-muted)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              <div style={{ color: 'var(--text-muted)' }}>VIEW_MODE</div>
              <div style={{ color: 'var(--cyan)' }}>SATELLITE_IR [ACTIVE]</div>
            </div>
            <div style={{ background: 'rgba(12, 15, 20, 0.8)', padding: '8px 12px', border: '1px solid var(--border-muted)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              <div style={{ color: 'var(--text-muted)' }}>COORDINATES</div>
              <div style={{ color: 'white' }}>52.5200 N / 13.4050 E</div>
            </div>
          </div>
        </MapContainer>
      </div>
      
      <div style={{ padding: '12px 16px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--cyan)', fontWeight: 'bold' }}>SCANNING TERRAIN...</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OBJECT_COUNT: {drones.length}</span>
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MAP_ENGINE: LEAFLET_v1.9</span>
      </div>
    </div>
  );
};

export default TacticalMap;
