import { createInitialSystems } from './fixtures';
import {
  AuditEntry,
  LandEvent,
  ParcelRecord,
  QuarantineItem,
  SystemId,
  SystemState,
} from './types';

const ALL_SYSTEMS: SystemId[] = ['panjeeyan', 'dharitree', 'bhunaksha', 'ekhajana'];

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return '0x' + (h >>> 0).toString(16).padStart(8, '0');
}

export class BhumiSyncEngine {
  public systems: Record<SystemId, SystemState>;
  public auditLog: AuditEntry[] = [];
  public quarantine: QuarantineItem[] = [];
  public frozenDags = new Set<string>();
  private processedKeys = new Set<string>();
  private outboxQueue: LandEvent[] = [];

  constructor() {
    this.systems = createInitialSystems();
  }

  public setSystemStatus(systemId: SystemId, status: SystemState['status']): void {
    this.systems[systemId].status = status;
  }

  public toggleFreezeDag(dagNo: string, actor = 'CO-Dispur-Circle'): boolean {
    const prevHash = this.auditLog.length > 0 ? this.auditLog[0].entryHash : '0x00000000';
    let isNowFrozen: boolean;
    if (this.frozenDags.has(dagNo)) {
      this.frozenDags.delete(dagNo);
      isNowFrozen = false;
    } else {
      this.frozenDags.add(dagNo);
      isNowFrozen = true;
    }
    this.auditLog.unshift({
      seq: this.auditLog.length + 1,
      eventId: `LOCK-${Date.now().toString().slice(-4)}`,
      idempotencyKey: `LOCK-${dagNo}-${this.auditLog.length + 1}`,
      type: 'MUTATION_APPROVED',
      targetDag: dagNo,
      status: isNowFrozen ? 'QUARANTINED' : 'SYNCED',
      propagatedTo: [],
      failedOrPending: [],
      reason: isNowFrozen
        ? `Court-Stay / Admin Freeze enabled on ${dagNo} by ${actor}`
        : `Court-Stay / Admin Freeze lifted on ${dagNo} by ${actor}`,
      prevHash,
      entryHash: simpleHash(prevHash + dagNo + String(isNowFrozen)),
      timestamp: new Date().toISOString(),
      durationMs: 2,
    });
    return isNowFrozen;
  }

  public getOutboxDepth(): number {
    return this.outboxQueue.length;
  }

  public dispatchEvent(event: LandEvent): AuditEntry {
    const start = performance.now();
    const prevHash =
      this.auditLog.length > 0
        ? this.auditLog[this.auditLog.length - 1].entryHash
        : '0x00000000';

    // 1. Idempotency Check
    if (this.processedKeys.has(event.idempotencyKey)) {
      const entry: AuditEntry = {
        seq: this.auditLog.length + 1,
        eventId: event.eventId,
        idempotencyKey: event.idempotencyKey,
        type: event.type,
        targetDag: event.targetDag,
        status: 'SYNCED',
        propagatedTo: [],
        failedOrPending: [],
        reason: 'Idempotent replay ignored (already committed)',
        prevHash,
        entryHash: simpleHash(prevHash + event.eventId + 'REPLAY'),
        timestamp: event.timestamp,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
      };
      this.auditLog.unshift(entry);
      return entry;
    }

    // 2. Court-Stay / Freeze & Semantic Invariant Validation
    if (this.frozenDags.has(event.targetDag)) {
      return this.quarantineEvent(
        event,
        `Court-Stay / Admin Freeze active on ${event.targetDag}`,
        prevHash,
        start
      );
    }

    const sourceParcel = this.systems[event.sourceSystem].parcels[event.targetDag];
    if (!sourceParcel) {
      return this.quarantineEvent(event, `Target parcel ${event.targetDag} not found`, prevHash, start);
    }

    if (event.type === 'PARTITION_EXECUTED' && event.payload.partitionSplit) {
      const { childAreaASqM, childAreaBSqM } = event.payload.partitionSplit;
      const totalChildArea = childAreaASqM + childAreaBSqM;
      if (Math.abs(totalChildArea - sourceParcel.areaSqM) > 1) {
        return this.quarantineEvent(
          event,
          `Area conservation invariant violated: parent=${sourceParcel.areaSqM} sqm vs children=${totalChildArea} sqm`,
          prevHash,
          start
        );
      }
    }

    // 3. Propagate across all online adapters; queue offline/lagging adapters
    const propagatedTo: SystemId[] = [];
    const failedOrPending: SystemId[] = [];

    for (const sysId of ALL_SYSTEMS) {
      const sys = this.systems[sysId];
      if (sys.status === 'OFFLINE') {
        failedOrPending.push(sysId);
        continue;
      }
      this.applyToSystem(sys, event);
      propagatedTo.push(sysId);
    }

    this.processedKeys.add(event.idempotencyKey);

    if (failedOrPending.length > 0) {
      this.outboxQueue.push(event);
    }

    const status = failedOrPending.length === 0 ? 'SYNCED' : 'DEGRADED_RETRY';
    const entry: AuditEntry = {
      seq: this.auditLog.length + 1,
      eventId: event.eventId,
      idempotencyKey: event.idempotencyKey,
      type: event.type,
      targetDag: event.targetDag,
      status,
      propagatedTo,
      failedOrPending,
      reason:
        failedOrPending.length > 0
          ? `Queued in Transactional Outbox for offline nodes: ${failedOrPending.join(', ')}`
          : undefined,
      prevHash,
      entryHash: simpleHash(prevHash + event.eventId + status),
      timestamp: event.timestamp,
      durationMs: Math.max(4, Math.round(performance.now() - start) + 18),
    };

    this.auditLog.unshift(entry);
    return entry;
  }

  public flushOutbox(): number {
    if (this.outboxQueue.length === 0) return 0;
    let flushed = 0;
    const remaining: LandEvent[] = [];

    for (const evt of this.outboxQueue) {
      const stillOffline: SystemId[] = [];
      for (const sysId of ALL_SYSTEMS) {
        const sys = this.systems[sysId];
        if (sys.status === 'OFFLINE') {
          stillOffline.push(sysId);
        } else {
          // Apply if not already at latest version
          this.applyToSystem(sys, evt);
        }
      }
      if (stillOffline.length > 0) {
        remaining.push(evt);
      } else {
        flushed++;
        const prevHash =
          this.auditLog.length > 0 ? this.auditLog[0].entryHash : '0x00000000';
        this.auditLog.unshift({
          seq: this.auditLog.length + 1,
          eventId: `${evt.eventId}-RECONCILE`,
          idempotencyKey: `${evt.idempotencyKey}-RECONCILE`,
          type: evt.type,
          targetDag: evt.targetDag,
          status: 'SYNCED',
          propagatedTo: [...ALL_SYSTEMS],
          failedOrPending: [],
          reason: 'Outbox reconciled automatically upon node recovery',
          prevHash,
          entryHash: simpleHash(prevHash + evt.eventId + 'RECONCILE'),
          timestamp: new Date().toISOString(),
          durationMs: 14,
        });
      }
    }

    this.outboxQueue = remaining;
    return flushed;
  }

  private applyToSystem(sys: SystemState, event: LandEvent): void {
    const existing = sys.parcels[event.targetDag];
    if (!existing) return;

    if (event.type === 'MUTATION_APPROVED') {
      sys.parcels[event.targetDag] = {
        ...existing,
        ownerName: event.payload.newOwner ?? existing.ownerName,
        lastDeedNo: event.payload.newDeedNo ?? existing.lastDeedNo,
        revenueDueInr: event.payload.newRevenueInr ?? existing.revenueDueInr,
        version: existing.version + 1,
      };
    } else if (event.type === 'CLASSIFICATION_CHANGED') {
      sys.parcels[event.targetDag] = {
        ...existing,
        landClass: event.payload.newLandClass ?? existing.landClass,
        revenueDueInr: event.payload.newRevenueInr ?? existing.revenueDueInr,
        version: existing.version + 1,
      };
    } else if (event.type === 'PARTITION_EXECUTED' && event.payload.partitionSplit) {
      const split = event.payload.partitionSplit;
      const ratioA = split.childAreaASqM / existing.areaSqM;
      const wA = Math.round(existing.geometry.w * ratioA);
      const wB = existing.geometry.w - wA;

      delete sys.parcels[event.targetDag];
      const childA: ParcelRecord = {
        ...existing,
        dagNo: split.childDagA,
        ownerName: split.childOwnerA,
        areaSqM: split.childAreaASqM,
        areaBighaKathaLessa: `${(split.childAreaASqM / 1337.8).toFixed(2)}B`,
        revenueDueInr: Math.round(existing.revenueDueInr * ratioA),
        version: existing.version + 1,
        geometry: {
          ...existing.geometry,
          w: wA - 3,
          color: '#6366f1',
        },
      };
      const childB: ParcelRecord = {
        ...existing,
        dagNo: split.childDagB,
        ownerName: split.childOwnerB,
        areaSqM: split.childAreaBSqM,
        areaBighaKathaLessa: `${(split.childAreaBSqM / 1337.8).toFixed(2)}B`,
        revenueDueInr: Math.round(existing.revenueDueInr * (1 - ratioA)),
        version: existing.version + 1,
        geometry: {
          ...existing.geometry,
          x: existing.geometry.x + wA + 3,
          w: wB - 3,
          color: '#ec4899',
        },
      };
      sys.parcels[split.childDagA] = childA;
      sys.parcels[split.childDagB] = childB;
    }

    sys.lastSyncedVersion = Math.max(sys.lastSyncedVersion, existing.version + 1);
  }

  private quarantineEvent(
    event: LandEvent,
    reason: string,
    prevHash: string,
    start: number
  ): AuditEntry {
    this.quarantine.unshift({
      id: `Q-${this.quarantine.length + 1}`,
      event,
      reason,
      detectedAt: event.timestamp,
      resolved: false,
    });

    const entry: AuditEntry = {
      seq: this.auditLog.length + 1,
      eventId: event.eventId,
      idempotencyKey: event.idempotencyKey,
      type: event.type,
      targetDag: event.targetDag,
      status: 'QUARANTINED',
      propagatedTo: [],
      failedOrPending: ALL_SYSTEMS,
      reason,
      prevHash,
      entryHash: simpleHash(prevHash + event.eventId + 'QUARANTINED'),
      timestamp: event.timestamp,
      durationMs: Math.max(2, Math.round(performance.now() - start)),
    };
    this.auditLog.unshift(entry);
    return entry;
  }

  public resolveQuarantine(
    quarantineId: string,
    decision: 'APPROVE_OVERRIDE' | 'REJECT',
    officer = 'CO-Dispur-Circle',
    note = ''
  ): boolean {
    const item = this.quarantine.find((q) => q.id === quarantineId);
    if (!item || item.resolved) return false;

    item.resolved = true;
    item.resolution = decision;
    item.resolvedBy = officer;
    item.resolutionNote = note || (decision === 'APPROVE_OVERRIDE' ? 'Approved by Circle Officer' : 'Rejected by Circle Officer');

    const prevHash = this.auditLog.length > 0 ? this.auditLog[0].entryHash : '0x00000000';

    if (decision === 'APPROVE_OVERRIDE') {
      const propagatedTo: SystemId[] = [];
      for (const sysId of ALL_SYSTEMS) {
        if (this.systems[sysId].status !== 'OFFLINE') {
          this.applyToSystem(this.systems[sysId], item.event);
          propagatedTo.push(sysId);
        }
      }
      this.processedKeys.add(item.event.idempotencyKey);
      this.auditLog.unshift({
        seq: this.auditLog.length + 1,
        eventId: `${item.event.eventId}-OVERRIDE`,
        idempotencyKey: `${item.event.idempotencyKey}-OVERRIDE`,
        type: item.event.type,
        targetDag: item.event.targetDag,
        status: 'SYNCED',
        propagatedTo,
        failedOrPending: [],
        reason: `CO Override Approved (${item.id}) by ${officer}: ${item.resolutionNote}`,
        prevHash,
        entryHash: simpleHash(prevHash + item.id + 'OVERRIDE'),
        timestamp: new Date().toISOString(),
        durationMs: 12,
      });
    } else {
      this.auditLog.unshift({
        seq: this.auditLog.length + 1,
        eventId: `${item.event.eventId}-REJECT`,
        idempotencyKey: `${item.event.idempotencyKey}-REJECT`,
        type: item.event.type,
        targetDag: item.event.targetDag,
        status: 'QUARANTINED',
        propagatedTo: [],
        failedOrPending: [],
        reason: `Quarantined Event Rejected (${item.id}) by ${officer}: ${item.resolutionNote}`,
        prevHash,
        entryHash: simpleHash(prevHash + item.id + 'REJECT'),
        timestamp: new Date().toISOString(),
        durationMs: 5,
      });
    }

    return true;
  }

  public runReconciliationSweep(): { flushed: number; parity: { inSync: boolean; mismatches: string[] } } {
    const flushed = this.flushOutbox();
    const parity = this.checkGlobalParity();
    return { flushed, parity };
  }

  public checkGlobalParity(): { inSync: boolean; mismatches: string[] } {
    const mismatches: string[] = [];
    const base = this.systems.dharitree.parcels;
    const baseKeys = Object.keys(base).sort();

    for (const sysId of ALL_SYSTEMS) {
      if (sysId === 'dharitree') continue;
      const target = this.systems[sysId].parcels;
      const targetKeys = Object.keys(target).sort();
      if (JSON.stringify(baseKeys) !== JSON.stringify(targetKeys)) {
        mismatches.push(`${sysId}: Dag set mismatch vs Dharitree`);
        continue;
      }
      for (const k of baseKeys) {
        if (
          base[k].ownerName !== target[k].ownerName ||
          base[k].areaSqM !== target[k].areaSqM ||
          base[k].landClass !== target[k].landClass
        ) {
          mismatches.push(`${sysId} [${k}]: attribute drift detected`);
        }
      }
    }

    return { inSync: mismatches.length === 0, mismatches };
  }
}
