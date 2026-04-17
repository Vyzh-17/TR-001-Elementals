import React from 'react';
import { Route, CheckCircle, Zap } from 'lucide-react';

const ClearancePanel = ({ replanEvents }) => {
  return (
    <div className="panel" style={{ flex: 1, borderTop: '1px solid var(--border-muted)', backgroundColor: '#070a10' }}>
      <div className="panel-header" style={{ borderTop: 'none', backgroundColor: '#0b1320', color: '#00f2ff', fontWeight: 'bold' }}>
        <Zap size={14} color="var(--green)" />
        Power & Collision Protocol
      </div>
      
      <div className="panel-content">
        {replanEvents.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Awaiting Region Entry...
          </div>
        ) : (
          replanEvents.map((event, idx) => (
            <div key={event.id + idx} className="alert-card" style={{ animation: 'none', border: '1px solid #00f2ff44', background: '#00223322', marginBottom: '16px' }}>
              <div style={{ color: 'var(--cyan)', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={12} color="var(--green)" /> PATH CHANGED ON REGION ENTRY
              </div>

              <div style={{ fontSize: '0.8rem', color: '#e0e6ed', marginBottom: '8px', lineHeight: '1.4' }}>
                <strong style={{color:'var(--cyan)'}}>{event.droneId}</strong> entered <strong>{event.region}</strong> and was about to collide. The system instantly rerouted the trajectory.
              </div>
              
              <div style={{ fontSize: '0.75rem', color: '#7f8ea3', marginBottom: '8px' }}>
                Route Selected: <strong style={{color:'white'}}>{event.updatedPathName}</strong> (replacing {event.originalPathName})
              </div>

              <div style={{ background: '#0c0f14', border: '1px solid #1e2631', padding: '8px', borderRadius: '4px', marginTop: '12px' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Battery Utilization Cost Prediction
                </div>
                <div className="drone-stats-grid">
                  <div className="mini-stat">
                    <span className="mini-stat-label">Direct (Collision Risk)</span>
                    <span className="mini-stat-value" style={{ color: 'var(--yellow)', textDecoration: 'line-through' }}>{event.energyBefore} kW</span>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-stat-label">Optimized Evasion</span>
                    <span className="mini-stat-value" style={{ color: 'var(--green)', fontWeight: 'bold' }}>{event.energyAfter} kW</span>
                  </div>
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClearancePanel;
