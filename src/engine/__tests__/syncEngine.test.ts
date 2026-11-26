import { describe, expect, it } from 'vitest';
import { BhumiSyncEngine } from '../syncEngine';

describe('BhumiSyncEngine — NESFIC-D-49 Invariants & Sync Guarantees', () => {
  it('propagates an approved sale mutation atomically across all 4 Assam land systems', () => {
    const engine = new BhumiSyncEngine();
    const res = engine.dispatchEvent({
      eventId: 'EVT-101',
      idempotencyKey: 'KEY-101',
      type: 'MUTATION_APPROVED',
      sourceSystem: 'panjeeyan',
      targetDag: 'DAG-104',
      timestamp: '2026-11-26T08:00:00Z',
      approvedBy: 'CO-Dispur',
      payload: { newOwner: 'Pranjal Sharma', newDeedNo: 'DEED-2026-9901' },
    });

    expect(res.status).toBe('SYNCED');
    expect(res.propagatedTo).toHaveLength(4);
    expect(engine.checkGlobalParity().inSync).toBe(true);
    expect(engine.systems.dharitree.parcels['DAG-104'].ownerName).toBe('Pranjal Sharma');
    expect(engine.systems.bhunaksha.parcels['DAG-104'].ownerName).toBe('Pranjal Sharma');
    expect(engine.systems.ekhajana.parcels['DAG-104'].ownerName).toBe('Pranjal Sharma');
  });

  it('enforces Dag area-conservation invariant and quarantines mismatched partitions', () => {
    const engine = new BhumiSyncEngine();
    const res = engine.dispatchEvent({
      eventId: 'EVT-102',
      idempotencyKey: 'KEY-102',
      type: 'PARTITION_EXECUTED',
      sourceSystem: 'dharitree',
      targetDag: 'DAG-104', // 2000 sqm
      timestamp: '2026-11-26T08:05:00Z',
      approvedBy: 'CO-Dispur',
      payload: {
        partitionSplit: {
          childDagA: 'DAG-104/A',
          childAreaASqM: 1200,
          childOwnerA: 'Ananya Bora',
          childDagB: 'DAG-104/B',
          childAreaBSqM: 950, // sum = 2150 != 2000
          childOwnerB: 'Pranjal Sharma',
        },
      },
    });

    expect(res.status).toBe('QUARANTINED');
    expect(engine.quarantine).toHaveLength(1);
    expect(engine.systems.dharitree.parcels['DAG-104']).toBeDefined();
  });

  it('ignores duplicate idempotency keys without double-incrementing versions', () => {
    const engine = new BhumiSyncEngine();
    const evt = {
      eventId: 'EVT-103',
      idempotencyKey: 'KEY-103-DUP',
      type: 'CLASSIFICATION_CHANGED' as const,
      sourceSystem: 'dharitree' as const,
      targetDag: 'DAG-105',
      timestamp: '2026-11-26T08:10:00Z',
      approvedBy: 'CO-Dispur',
      payload: { newLandClass: 'Commercial' as const, newRevenueInr: 4200 },
    };

    engine.dispatchEvent(evt);
    const replay = engine.dispatchEvent(evt);

    expect(replay.reason).toContain('Idempotent replay ignored');
    expect(engine.systems.ekhajana.parcels['DAG-105'].version).toBe(2);
  });

  it('queues events in Transactional Outbox when a node is offline and reconciles on recovery', () => {
    const engine = new BhumiSyncEngine();
    engine.setSystemStatus('bhunaksha', 'OFFLINE');

    const res = engine.dispatchEvent({
      eventId: 'EVT-104',
      idempotencyKey: 'KEY-104',
      type: 'MUTATION_APPROVED',
      sourceSystem: 'panjeeyan',
      targetDag: 'DAG-106',
      timestamp: '2026-11-26T08:15:00Z',
      approvedBy: 'CO-Dispur',
      payload: { newOwner: 'Neha Choudhury' },
    });

    expect(res.status).toBe('DEGRADED_RETRY');
    expect(engine.getOutboxDepth()).toBe(1);
    expect(engine.checkGlobalParity().inSync).toBe(false);

    engine.setSystemStatus('bhunaksha', 'ONLINE');
    const flushed = engine.flushOutbox();

    expect(flushed).toBe(1);
    expect(engine.getOutboxDepth()).toBe(0);
    expect(engine.checkGlobalParity().inSync).toBe(true);
    expect(engine.systems.bhunaksha.parcels['DAG-106'].ownerName).toBe('Neha Choudhury');
  });

  it('blocks mutations on a frozen Dag and supports Circle Officer quarantine resolution', () => {
    const engine = new BhumiSyncEngine();
    engine.toggleFreezeDag('DAG-104', 'CIRCLE_OFFICER');

    const blocked = engine.dispatchEvent({
      eventId: 'EVT-105',
      idempotencyKey: 'KEY-105',
      type: 'MUTATION_APPROVED',
      sourceSystem: 'panjeeyan',
      targetDag: 'DAG-104',
      timestamp: '2026-11-26T08:20:00Z',
      approvedBy: 'SubRegistrar-Dispur',
      payload: { newOwner: 'Unauthorized Buyer' },
    });

    expect(blocked.status).toBe('QUARANTINED');
    expect(engine.quarantine).toHaveLength(1);
    expect(engine.systems.dharitree.parcels['DAG-104'].ownerName).toBe('Ananya Bora');

    const resolved = engine.resolveQuarantine(engine.quarantine[0].id, 'REJECT', 'CIRCLE_OFFICER', 'Court stay active');
    expect(resolved).toBe(true);
    expect(engine.quarantine[0].resolved).toBe(true);
    expect(engine.quarantine[0].resolution).toBe('REJECT');
  });
});
