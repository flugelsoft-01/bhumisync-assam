import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  Layers,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BhumiSyncEngine } from './engine/syncEngine';
import { EventType, ParcelRecord, SystemId } from './engine/types';

const engineInstance = new BhumiSyncEngine();

export default function App() {
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'architecture' | 'audit'>('dashboard');
  const [eventType, setEventType] = useState<EventType>('MUTATION_APPROVED');
  const [targetDag, setTargetDag] = useState<string>('DAG-104');
  const [newOwner, setNewOwner] = useState<string>('Pranjal Sharma');
  const [newLandClass, setNewLandClass] = useState<ParcelRecord['landClass']>('Commercial');
  const [splitAreaA, setSplitAreaA] = useState<number>(1200);
  const [splitAreaB, setSplitAreaB] = useState<number>(800);

  const rerender = () => setTick((t) => t + 1);
  const parity = engineInstance.checkGlobalParity();
  const availableDags = Object.keys(engineInstance.systems.dharitree.parcels);

  const handleDispatch = () => {
    const id = `EVT-${Math.floor(1000 + Math.random() * 9000)}`;
    engineInstance.dispatchEvent({
      eventId: id,
      idempotencyKey: `KEY-${id}`,
      type: eventType,
      sourceSystem: eventType === 'MUTATION_APPROVED' ? 'panjeeyan' : 'dharitree',
      targetDag,
      timestamp: new Date().toISOString(),
      approvedBy: 'CO-Dispur-Circle',
      payload:
        eventType === 'MUTATION_APPROVED'
          ? {
              newOwner,
              newDeedNo: `DEED-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            }
          : eventType === 'CLASSIFICATION_CHANGED'
          ? {
              newLandClass,
              newRevenueInr: newLandClass === 'Commercial' ? 4200 : 1100,
            }
          : {
              partitionSplit: {
                childDagA: `${targetDag}/A`,
                childAreaASqM: Number(splitAreaA),
                childOwnerA: newOwner,
                childDagB: `${targetDag}/B`,
                childAreaBSqM: Number(splitAreaB),
                childOwnerB: engineInstance.systems.dharitree.parcels[targetDag]?.ownerName || 'Co-Sharer',
              },
            },
    });
    const updatedDags = Object.keys(engineInstance.systems.dharitree.parcels);
    if (!updatedDags.includes(targetDag) && updatedDags.length > 0) {
      setTargetDag(updatedDags[0]);
    }
    rerender();
  };

  const toggleNode = (sysId: SystemId) => {
    const cur = engineInstance.systems[sysId].status;
    engineInstance.setSystemStatus(sysId, cur === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
    if (cur === 'OFFLINE') {
      engineInstance.flushOutbox();
    }
    rerender();
  };

  const bhunakshaParcels = Object.values(engineInstance.systems.bhunaksha.parcels);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <h1>BhumiSync Assam — NESFIC-D-49 Control Plane</h1>
          <p>
            One Change, Everywhere: Event-Driven Synchronization across Panjeeyan, Dharitree, Bhunaksha &amp; e-Khajana
          </p>
        </div>
        <div className="badge-row">
          <span className={`badge ${parity.inSync ? 'badge-ok' : 'badge-warn'}`}>
            {parity.inSync ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {parity.inSync ? '4/4 Systems In Parity' : `${parity.mismatches.length} Drift Detected`}
          </span>
          <span className="badge badge-dark">
            Outbox Queue: {engineInstance.getOutboxDepth()}
          </span>
          <span className="badge badge-dark">
            Quarantined: {engineInstance.quarantine.length}
          </span>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Activity size={16} /> Live Sync Simulator
        </button>
        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <ShieldCheck size={16} /> Hash-Chained Audit &amp; Quarantine ({engineInstance.auditLog.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          <Layers size={16} /> Architecture &amp; User Journey
        </button>
      </nav>

      {activeTab === 'dashboard' && (
        <div className="grid-2">
          <aside className="card">
            <h2>
              <GitBranch size={18} /> Trigger Approved Change
            </h2>
            <div className="form-group">
              <label>Workflow Event Type</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                <option value="MUTATION_APPROVED">Sale Mutation Approved (Panjeeyan → All)</option>
                <option value="PARTITION_EXECUTED">Dag Partition / Split (Dharitree → All)</option>
                <option value="CLASSIFICATION_CHANGED">Land Reclassification (Dharitree → All)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target Dag (Hatigaon Village, Dispur Circle)</label>
              <select value={targetDag} onChange={(e) => setTargetDag(e.target.value)}>
                {availableDags.map((d) => (
                  <option key={d} value={d}>
                    {d} ({engineInstance.systems.dharitree.parcels[d].areaSqM} sqm)
                  </option>
                ))}
              </select>
            </div>

            {eventType === 'MUTATION_APPROVED' && (
              <div className="form-group">
                <label>New Transferee / Owner Name</label>
                <input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
              </div>
            )}

            {eventType === 'CLASSIFICATION_CHANGED' && (
              <div className="form-group">
                <label>New Land Classification</label>
                <select
                  value={newLandClass}
                  onChange={(e) => setNewLandClass(e.target.value as ParcelRecord['landClass'])}
                >
                  <option value="Basti (Residential)">Basti (Residential)</option>
                  <option value="Rupit (Agricultural)">Rupit (Agricultural)</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Sali (Wetland)">Sali (Wetland)</option>
                </select>
              </div>
            )}

            {eventType === 'PARTITION_EXECUTED' && (
              <>
                <div className="form-group">
                  <label>Child Dag A Owner</label>
                  <input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Child Dag A Area (sqm) + Child Dag B Area (sqm)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      value={splitAreaA}
                      onChange={(e) => setSplitAreaA(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      value={splitAreaB}
                      onChange={(e) => setSplitAreaB(Number(e.target.value))}
                    />
                  </div>
                  <small style={{ color: '#64748b', fontSize: '0.73rem' }}>
                    Tip: Enter mismatched sum to test Area Conservation Quarantine!
                  </small>
                </div>
              </>
            )}

            <button className="btn btn-primary" onClick={handleDispatch}>
              <RefreshCw size={15} /> Approve &amp; Auto-Propagate
            </button>

            <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <h2 style={{ fontSize: '0.9rem' }}>Bhunaksha Cadastral Map (Live SVG)</h2>
              <svg
                viewBox="0 0 370 250"
                style={{ width: '100%', background: '#f1f5f9', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                {bhunakshaParcels.map((p) => (
                  <g key={p.dagNo}>
                    <rect
                      x={p.geometry.x}
                      y={p.geometry.y}
                      width={p.geometry.w}
                      height={p.geometry.h}
                      fill={p.geometry.color}
                      fillOpacity={0.22}
                      stroke={p.geometry.color}
                      strokeWidth={2}
                      rx={4}
                    />
                    <text
                      x={p.geometry.x + 8}
                      y={p.geometry.y + 20}
                      fontSize="11"
                      fontWeight="700"
                      fill="#0f172a"
                    >
                      {p.dagNo}
                    </text>
                    <text x={p.geometry.x + 8} y={p.geometry.y + 36} fontSize="10" fill="#334155">
                      {p.ownerName}
                    </text>
                    <text x={p.geometry.x + 8} y={p.geometry.y + 50} fontSize="9" fill="#475569">
                      {p.areaSqM} sqm · v{p.version}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </aside>

          <main>
            <div className="systems-grid">
              {Object.values(engineInstance.systems).map((sys) => (
                <div key={sys.id} className={`sys-card ${sys.status === 'OFFLINE' ? 'offline' : ''}`}>
                  <div className="sys-header">
                    <div>
                      <div className="sys-title">
                        <Database size={14} style={{ display: 'inline', marginRight: 5 }} />
                        {sys.name}
                      </div>
                      <div className="sys-sub">{sys.subtitle}</div>
                    </div>
                    <button
                      className={`btn ${sys.status === 'ONLINE' ? 'btn-secondary' : 'btn-danger'}`}
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                      onClick={() => toggleNode(sys.id)}
                    >
                      {sys.status === 'ONLINE' ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {sys.status}
                    </button>
                  </div>

                  <table className="parcel-table">
                    <thead>
                      <tr>
                        <th>Dag</th>
                        <th>Owner</th>
                        <th>Area</th>
                        <th>Class / Rev</th>
                        <th>Ver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(sys.parcels).map((p) => (
                        <tr key={p.dagNo}>
                          <td className="mono">{p.dagNo}</td>
                          <td>{p.ownerName}</td>
                          <td>{p.areaSqM}m²</td>
                          <td>
                            {p.landClass.split(' ')[0]} · ₹{p.revenueDueInr}
                          </td>
                          <td className="mono">v{p.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </main>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <h2>Hash-Chained Immutable Sync Ledger &amp; Quarantine</h2>
          {engineInstance.auditLog.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
              No events dispatched yet. Trigger an approved mutation, partition, or reclassification on the Live Sync Simulator tab.
            </p>
          ) : (
            engineInstance.auditLog.map((a) => (
              <div
                key={a.seq}
                className={`audit-item ${
                  a.status === 'QUARANTINED' ? 'quarantined' : a.status === 'DEGRADED_RETRY' ? 'degraded' : ''
                }`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>
                    #{a.seq} · {a.type} ({a.targetDag}) — {a.status}
                  </span>
                  <span className="mono">{a.durationMs} ms</span>
                </div>
                {a.reason && <div style={{ marginTop: 4, color: '#991b1b' }}>{a.reason}</div>}
                <div className="mono" style={{ marginTop: 4, color: '#475569' }}>
                  Propagated: [{a.propagatedTo.join(', ') || 'none'}] | Hash: {a.entryHash} (prev: {a.prevHash})
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'architecture' && (
        <div className="card">
          <h2>BhumiSync Assam — Event-Driven Synchronization Architecture</h2>
          <div className="arch-box">{`[1] Approved Change (Circle Officer / Sub-Registrar / Mission Basundhara)
         │
         ▼
[2] Transactional Outbox + Canonical Land Event Envelope (ULPIN / Dag-Patta ID)
         │
         ▼
[3] Invariant & Conflict Guardrail Engine
    ├── Area Conservation Check (Σ child Dag areas == parent Dag area)
    ├── Idempotency & Vector Clock Ordering
    └── Anomaly / Drift? ──▶ [Quarantine Queue + Human-in-the-Loop Review]
         │ (Valid)
         ▼
[4] Fan-Out Adapter Bus (NATS JetStream / Kafka + Dead-Letter Retry)
    ├──▶ Panjeeyan Adapter   (Sub-Registrar Deeds)
    ├──▶ Dharitree Adapter   (Jamabandi / Chitha RoR)
    ├──▶ Bhunaksha Adapter   (Cadastral Polygon Geometry)
    └──▶ e-Khajana Adapter   (Land Revenue & Cess Demand)
         │
         ▼
[5] Hash-Chained Immutable Audit Ledger + Real-Time Parity Monitor`}</div>
        </div>
      )}
    </div>
  );
}
