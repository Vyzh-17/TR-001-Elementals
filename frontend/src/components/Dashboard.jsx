import React from 'react';
import { useDroneSimulation } from '../hooks/useDroneSimulation';
import StatsPanel from './StatsPanel';
import TacticalMap from './TacticalMap';
import AlertPanel from './AlertPanel';
import ClearancePanel from './ClearancePanel';
import { Crosshair, ShieldAlert, Cpu } from 'lucide-react';

const Dashboard = () => {
  const { drones, alerts, decisions, replanEvents } = useDroneSimulation();

  return (
    <div className="dashboard-container">
      <div className="tactical-grid" />
      
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px', background: 'rgba(0, 242, 255, 0.1)', border: '1px solid var(--cyan)', borderRadius: '4px' }}>
            <Crosshair color="var(--cyan)" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              AeroSync <span style={{ color: 'var(--cyan)' }}>Tactical</span>
            </h1>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '-2px' }}>
              UNMANNED AIRSPACE CONTROL SYSTEM // v2.0.4
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Satellite Link</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>STABLE [99.2%]</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Encryption</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>AES-256 ACTIVE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Clock</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {new Date().toLocaleTimeString('en-GB', { hour12: false })}
            </span>
          </div>
        </div>
      </header>

      <main className="main-layout">
        <StatsPanel drones={drones} />
        <TacticalMap drones={drones} />
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1px', background: 'var(--border-muted)', overflow: 'hidden' }}>
          <AlertPanel alerts={alerts} decisions={decisions} />
          <ClearancePanel replanEvents={replanEvents} />
        </div>
      </main>

      <footer style={{ height: '32px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', px: '24px', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 5px var(--green)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 'bold' }}>SYSTEMS NOMINAL</span>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>NETWORK LOAD: 14%</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>LATENCY: 12ms</span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
          &copy; 2026 ANTIGRAVITY DEFENSE SYSTEMS
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
