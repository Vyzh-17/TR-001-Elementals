import React from 'react';
import { Activity, Battery, Navigation, ArrowUp } from 'lucide-react';

const DroneCard = ({ drone }) => {
  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'warning': return 'status-warning';
      case 'avoiding': return 'status-avoiding';
      default: return 'status-normal';
    }
  };

  return (
    <div className={`drone-card ${getStatusClass(drone.status)}`}>
      <div className="drone-card-header">
        <div className="drone-id">{drone.id}</div>
        <div className={`status-badge status-${drone.status.toLowerCase()}`}>
          {drone.status}
        </div>
      </div>
      
      <div className="drone-stats-grid">
        <div className="mini-stat">
          <span className="mini-stat-label">Altitude</span>
          <span className="mini-stat-value">{drone.alt.toFixed(1)}m</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Speed</span>
          <span className="mini-stat-value">{drone.speed.toFixed(1)} km/h</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Battery</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="mini-stat-value">{drone.battery.toFixed(1)}%</span>
            <Battery size={10} color={drone.battery < 20 ? 'red' : 'var(--green)'} />
          </div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Waypoint</span>
          <span className="mini-stat-value">WP-{drone.waypoint.toString().padStart(3, '0')}</span>
        </div>
      </div>

      <div style={{ marginTop: '12px', height: '2px', background: 'var(--border-muted)', borderRadius: '1px' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${drone.battery}%`, 
            background: drone.battery < 20 ? 'var(--red)' : 'var(--cyan)',
            transition: 'width 0.5s ease'
          }} 
        />
      </div>
    </div>
  );
};

export default DroneCard;
