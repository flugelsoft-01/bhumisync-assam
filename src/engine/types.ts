export type SystemId = 'panjeeyan' | 'dharitree' | 'bhunaksha' | 'ekhajana';

export type EventType =
  | 'MUTATION_APPROVED'
  | 'PARTITION_EXECUTED'
  | 'CLASSIFICATION_CHANGED'
  | 'REVENUE_UPDATED';

export type SyncStatus = 'SYNCED' | 'PROPAGATING' | 'QUARANTINED' | 'DEGRADED_RETRY';

export interface ParcelRecord {
  dagNo: string;
  pattaNo: string;
  pattaType: 'Myadi' | 'Eksona' | 'Nisf-Khiraj';
  district: string;
  circle: string;
  mouza: string;
  village: string;
  ownerName: string;
  areaBighaKathaLessa: string;
  areaSqM: number;
  landClass: 'Basti (Residential)' | 'Rupit (Agricultural)' | 'Commercial' | 'Sali (Wetland)';
  revenueDueInr: number;
  lastDeedNo: string;
  version: number;
  geometry: {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
  };
}

export interface SystemState {
  id: SystemId;
  name: string;
  subtitle: string;
  status: 'ONLINE' | 'LAGGING' | 'OFFLINE';
  lastSyncedVersion: number;
  latencyMs: number;
  parcels: Record<string, ParcelRecord>;
}

export interface LandEvent {
  eventId: string;
  idempotencyKey: string;
  type: EventType;
  sourceSystem: SystemId;
  targetDag: string;
  timestamp: string;
  approvedBy: string;
  payload: {
    newOwner?: string;
    newLandClass?: ParcelRecord['landClass'];
    newRevenueInr?: number;
    newDeedNo?: string;
    partitionSplit?: {
      childDagA: string;
      childAreaASqM: number;
      childOwnerA: string;
      childDagB: string;
      childAreaBSqM: number;
      childOwnerB: string;
    };
  };
}

export interface AuditEntry {
  seq: number;
  eventId: string;
  idempotencyKey: string;
  type: EventType;
  targetDag: string;
  status: SyncStatus;
  propagatedTo: SystemId[];
  failedOrPending: SystemId[];
  reason?: string;
  prevHash: string;
  entryHash: string;
  timestamp: string;
  durationMs: number;
}

export interface QuarantineItem {
  id: string;
  event: LandEvent;
  reason: string;
  detectedAt: string;
  resolved: boolean;
  resolution?: 'APPROVE_OVERRIDE' | 'REJECT';
  resolvedBy?: string;
  resolutionNote?: string;
}

export type AdminRole = 'CIRCLE_OFFICER' | 'NIC_ADMIN' | 'AUDITOR';
