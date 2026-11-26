import { ParcelRecord, SystemId, SystemState } from './types';

export const INITIAL_PARCELS: Record<string, ParcelRecord> = {
  'DAG-104': {
    dagNo: 'DAG-104',
    pattaNo: 'PATTA-412',
    pattaType: 'Myadi',
    district: 'Kamrup (Metro)',
    circle: 'Dispur',
    mouza: 'Beltola',
    village: 'Hatigaon',
    ownerName: 'Ananya Bora',
    areaBighaKathaLessa: '1B-2K-10L',
    areaSqM: 2000,
    landClass: 'Basti (Residential)',
    revenueDueInr: 1250,
    lastDeedNo: 'DEED-2024-8812',
    version: 1,
    geometry: { x: 20, y: 20, w: 150, h: 110, color: '#0ea5e9' },
  },
  'DAG-105': {
    dagNo: 'DAG-105',
    pattaNo: 'PATTA-419',
    pattaType: 'Myadi',
    district: 'Kamrup (Metro)',
    circle: 'Dispur',
    mouza: 'Beltola',
    village: 'Hatigaon',
    ownerName: 'Raktim Kalita',
    areaBighaKathaLessa: '2B-0K-0L',
    areaSqM: 2675,
    landClass: 'Rupit (Agricultural)',
    revenueDueInr: 840,
    lastDeedNo: 'DEED-2023-4409',
    version: 1,
    geometry: { x: 185, y: 20, w: 165, h: 110, color: '#10b981' },
  },
  'DAG-106': {
    dagNo: 'DAG-106',
    pattaNo: 'PATTA-508',
    pattaType: 'Nisf-Khiraj',
    district: 'Kamrup (Metro)',
    circle: 'Dispur',
    mouza: 'Beltola',
    village: 'Hatigaon',
    ownerName: 'Dipankar Das',
    areaBighaKathaLessa: '0B-4K-5L',
    areaSqM: 1120,
    landClass: 'Commercial',
    revenueDueInr: 3400,
    lastDeedNo: 'DEED-2025-1102',
    version: 1,
    geometry: { x: 20, y: 145, w: 330, h: 85, color: '#f59e0b' },
  },
};

function cloneParcels(): Record<string, ParcelRecord> {
  return JSON.parse(JSON.stringify(INITIAL_PARCELS));
}

export function createInitialSystems(): Record<SystemId, SystemState> {
  return {
    panjeeyan: {
      id: 'panjeeyan',
      name: 'Panjeeyan (e-Registration)',
      subtitle: 'Sub-Registrar Deed Registry',
      status: 'ONLINE',
      lastSyncedVersion: 1,
      latencyMs: 38,
      parcels: cloneParcels(),
    },
    dharitree: {
      id: 'dharitree',
      name: 'Dharitree (ILRMS)',
      subtitle: 'Jamabandi & Chitha RoR',
      status: 'ONLINE',
      lastSyncedVersion: 1,
      latencyMs: 44,
      parcels: cloneParcels(),
    },
    bhunaksha: {
      id: 'bhunaksha',
      name: 'Bhunaksha Assam',
      subtitle: 'Cadastral Spatial Maps',
      status: 'ONLINE',
      lastSyncedVersion: 1,
      latencyMs: 62,
      parcels: cloneParcels(),
    },
    ekhajana: {
      id: 'ekhajana',
      name: 'e-Khajana',
      subtitle: 'Land Revenue & Cess Ledger',
      status: 'ONLINE',
      lastSyncedVersion: 1,
      latencyMs: 29,
      parcels: cloneParcels(),
    },
  };
}
