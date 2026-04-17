import React from 'react';
import { Activity, Battery, Navigation, ArrowUp } from 'lucide-react';

const DroneCard = ({ drone }) => {
  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'in-region': return 'status-warning';
      case 'optimized': return 'status-optimized';
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
          <span className="mini-stat-label">Energy</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="mini-stat-value">{drone.energy.toFixed(1)}%</span>
            <Battery size={10} color={drone.energy < 20 ? 'red' : 'var(--green)'} />
          </div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Routing</span>
          <span className="mini-stat-value">WP-{drone.currentPath.length}</span>
        </div>
        <div className="mini-stat" style={{ gridColumn: 'span 2', marginTop: '4px' }}>
          <span className="mini-stat-label">Region</span>
          <span className="mini-stat-value" style={{ color: 'var(--cyan)', fontSize: '0.75rem' }}>{drone.region}</span>
        </div>
      </div>

      <div style={{ marginTop: '12px', height: '2px', background: 'var(--border-muted)', borderRadius: '1px' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${drone.energy}%`, 
            background: drone.energy < 20 ? 'var(--red)' : 'var(--cyan)',
            transition: 'width 0.5s ease'
          }} 
        />
      </div>
    </div>
  );
};

export default DroneCard;
