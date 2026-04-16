import React from 'react';
import { LayoutGrid, Cpu, Radio, Shield } from 'lucide-react';
import DroneCard from './DroneCard';

const StatsPanel = ({ drones }) => {
  const activeDrones = drones.length;
  const warnings = drones.filter(d => d.status !== 'Normal').length;

  return (
    <div className="panel" style={{ borderRight: '1px solid var(--border-muted)' }}>
      <div className="panel-header">
        <LayoutGrid size={14} color="var(--cyan)" />
        Fleet Overview
      </div>
      
      <div className="panel-content">
        <div className="drone-stats-grid" style={{ marginBottom: '24px' }}>
          <div className="mini-stat" style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '4px' }}>
            <span className="mini-stat-label">Total Active</span>
            <span className="mini-stat-value" style={{ fontSize: '1.5rem', color: 'var(--cyan)' }}>{activeDrones}</span>
          </div>
          <div className="mini-stat" style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '4px' }}>
            <span className="mini-stat-label">System State</span>
            <span className="mini-stat-value" style={{ fontSize: '1.2rem', color: warnings > 0 ? 'var(--yellow)' : 'var(--green)' }}>
              {warnings > 0 ? 'CAUTION' : 'OPTIMAL'}
            </span>
          </div>
        </div>

        <div className="panel-header" style={{ marginLeft: '-16px', marginRight: '-16px', marginBottom: '16px' }}>
          <Radio size={14} color="var(--cyan)" />
          Drone Telemetry
        </div>

        <div className="drone-list">
          {drones.map(drone => (
            <DroneCard key={drone.id} drone={drone} />
          ))}
        </div>
      </div>
      
      <div style={{ padding: '12px 16px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={12} color="var(--green)" />
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Auto-Avoidance System: ENABLED</span>
      </div>
    </div>
  );
};

export default StatsPanel;
