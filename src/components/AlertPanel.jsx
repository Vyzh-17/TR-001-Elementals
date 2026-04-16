import React from 'react';
import { AlertTriangle, Zap } from 'lucide-react';

const AlertPanel = ({ alerts, decisions }) => {
  return (
    <div className="panel" style={{ height: '100%', borderLeft: '1px solid var(--border-muted)' }}>
      <div className="panel-header">
        <AlertTriangle size={14} color="var(--red)" />
        Active Conflicts
      </div>
      
      <div className="panel-content">
        {alerts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No collision risks detected
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className="alert-card">
              <div style={{ color: 'var(--red)', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
                ⚠ Potential Collision Detected
              </div>
              <div style={{ color: 'white', fontSize: '0.85rem', marginBottom: '10px' }}>
                {alert.droneA} vs {alert.droneB}
              </div>
              <div className="drone-stats-grid">
                <div className="mini-stat">
                  <span className="mini-stat-label">Distance</span>
                  <span className="mini-stat-value" style={{ color: 'var(--red)' }}>{alert.distance} km</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-stat-label">Est. Time</span>
                  <span className="mini-stat-value">{alert.timeToCollision}s</span>
                </div>
              </div>
            </div>
          ))
        )}

        <div className="panel-header" style={{ borderTop: '1px solid var(--border-muted)', marginTop: '20px', marginLeft: '-16px', marginRight: '-16px' }}>
          <Zap size={14} color="var(--cyan)" />
          System Decisions
        </div>

        <div style={{ marginTop: '16px' }}>
          {decisions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Pending system actions...
            </div>
          ) : (
            decisions.map(decision => (
              <div key={decision.id} style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-muted)', pb: '8px' }}>
                <div style={{ color: 'var(--cyan)', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {decision.type}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  Action Taken: <span style={{ color: 'var(--green)' }}>{decision.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertPanel;
