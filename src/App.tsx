import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  GitBranch,
  Layers,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BhumiSyncEngine } from './engine/syncEngine';
import { AdminRole, EventType, ParcelRecord, SystemId } from './engine/types';

const engineInstance = new BhumiSyncEngine();

export default function App() {
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'admin' | 'architecture'>('dashboard');
  const [adminRole, setAdminRole] = useState<AdminRole>('CIRCLE_OFFICER');
  const [sweepNotice, setSweepNotice] = useState<string>('');
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
  const unresolvedQuarantine = engineInstance.quarantine.filter((q) => !q.resolved);

  const handleExportAudit = () => {
    const blob = new Blob([JSON.stringify(engineInstance.auditLog, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bhumisync-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          <ShieldAlert size={16} /> Admin Console {unresolvedQuarantine.length > 0 ? `(${unresolvedQuarantine.length})` : ''}
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

      {activeTab === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>
                <ShieldAlert size={18} /> Revenue &amp; NIC Admin Governance Console
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                District: <strong>Kamrup (Metro)</strong> · Circle: <strong>Dispur</strong> · Mouza: <strong>Beltola</strong> · Village: <strong>Hatigaon</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Active RBAC Role:</label>
              <select
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value as AdminRole)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="CIRCLE_OFFICER">Circle Officer (HITL &amp; Freeze)</option>
                <option value="NIC_ADMIN">NIC System Admin (Outbox &amp; Sweep)</option>
                <option value="AUDITOR">Read-Only Auditor (Export Only)</option>
              </select>
              <button className="btn btn-secondary" onClick={handleExportAudit}>
                <Download size={14} /> Export Audit JSON
              </button>
            </div>
          </div>

          <div className="systems-grid">
            <div className="card">
              <h2>Circle Officer Quarantine Desk ({unresolvedQuarantine.length} Pending)</h2>
              {engineInstance.quarantine.length === 0 ? (
                <p style={{ fontSize: '0.84rem', color: '#64748b' }}>
                  No quarantined events. Trigger a mismatched Dag partition or mutate a frozen Dag to test HITL review.
                </p>
              ) : (
                engineInstance.quarantine.map((q) => (
                  <div
                    key={q.id}
                    className={`audit-item ${q.resolved ? '' : 'quarantined'}`}
                    style={{ marginBottom: 10 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>
                        {q.id} · {q.event.type} ({q.event.targetDag})
                      </span>
                      <span className="mono">{q.resolved ? q.resolution : 'PENDING REVIEW'}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#991b1b' }}>{q.reason}</div>
                    {!q.resolved ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className="btn btn-secondary"
                          disabled={adminRole === 'AUDITOR'}
                          style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                          onClick={() => {
                            engineInstance.resolveQuarantine(q.id, 'APPROVE_OVERRIDE', adminRole);
                            rerender();
                          }}
                        >
                          Approve Override
                        </button>
                        <button
                          className="btn btn-danger"
                          disabled={adminRole === 'AUDITOR'}
                          style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                          onClick={() => {
                            engineInstance.resolveQuarantine(q.id, 'REJECT', adminRole);
                            rerender();
                          }}
                        >
                          Reject Event
                        </button>
                      </div>
                    ) : (
                      <div className="mono" style={{ marginTop: 4, color: '#475569' }}>
                        Resolved by {q.resolvedBy}: {q.resolutionNote}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <h2>Court-Stay / Dag Freeze Locks &amp; Parity Sweep</h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 10 }}>
                Frozen Dags block automatic mutation propagation and route attempts to Quarantine.
              </p>
              <table className="parcel-table" style={{ marginBottom: 14 }}>
                <thead>
                  <tr>
                    <th>Dag</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableDags.map((dag) => {
                    const isFrozen = engineInstance.frozenDags.has(dag);
                    return (
                      <tr key={dag}>
                        <td className="mono">{dag}</td>
                        <td>{engineInstance.systems.dharitree.parcels[dag].ownerName}</td>
                        <td>
                          <span className={`badge ${isFrozen ? 'badge-err' : 'badge-ok'}`} style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
                            {isFrozen ? 'FROZEN' : 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            disabled={adminRole === 'AUDITOR'}
                            style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                            onClick={() => {
                              engineInstance.toggleFreezeDag(dag, adminRole);
                              rerender();
                            }}
                          >
                            {isFrozen ? <Unlock size={12} /> : <Lock size={12} />}
                            {isFrozen ? 'Unfreeze' : 'Freeze'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: 'auto' }}
                  disabled={adminRole === 'AUDITOR'}
                  onClick={() => {
                    const res = engineInstance.runReconciliationSweep();
                    setSweepNotice(
                      `Sweep complete: ${res.flushed} outbox event(s) flushed · Parity: ${
                        res.parity.inSync ? '4/4 In Sync' : `${res.parity.mismatches.length} mismatch(es)`
                      }`
                    );
                    rerender();
                  }}
                >
                  <RefreshCw size={14} /> Run Reconciliation Sweep
                </button>
                {sweepNotice && <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>{sweepNotice}</span>}
              </div>
            </div>
          </div>
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

      <footer className="app-footer">
        <div className="footer-disclaimer">
          <strong>Disclaimer:</strong> This application is a functional MVP prototype and simulation built for{' '}
          <strong>NESFIC 2026 Problem Statement NESFIC-D-49</strong>. All parcel records, Dag/Patta identifiers,
          and portal adapters shown here use synthetic demonstration data and are not connected to live
          Government of Assam production databases (Dharitree, Bhunaksha, Panjeeyan, or e-Khajana).
        </div>
        <div className="footer-meta">
          <span>
            &copy; {new Date().getFullYear()} <strong>Flugelsoft Labs</strong>. All rights reserved.
          </span>
          <span>
            Lead Applicant: <strong>Kalyanjit Hatibaruah</strong> · Live Prototype:{' '}
            <a
              href="https://bhumisync-assam.pages.dev/"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#1d4ed8', fontWeight: 600 }}
            >
              bhumisync-assam.pages.dev
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
