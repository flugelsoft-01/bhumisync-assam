# NESFIC 2026 Proposal — Problem Statement `NESFIC-D-49`
**Title:** *One Change, Everywhere: Automatic Synchronisation Across Land Record Systems in Assam*  
**Track:** Government Track — Revenue & Disaster Management Department, Government of Assam  
**Proposed Solution Name:** **BhumiSync Assam**  
**Organization:** Flugelsoft Labs | **Lead Applicant:** Kalyanjit Hatibaruah  
**Live Prototype URL:** https://bhumisync-assam.pages.dev/

---

## 1. Problem understanding & user workflow
Land administration in Assam relies on multiple specialized digital platforms—**Dharitree (ILRMS)** for textual Records of Rights (Jamabandi and Chitha), **Bhunaksha** for cadastral spatial maps, **Panjeeyan (e-Registration)** for Sub-Registrar property deeds, **e-Khajana** for land revenue demand/collection, and **Mission Basundhara** for citizen service workflows. Currently, these systems operate with asynchronous, manual, or batch-coupled handoffs. When a citizen registers a sale deed at a Sub-Registrar Office (Panjeeyan) or receives Circle Officer (CO) approval for a mutation, partition, or land reclassification, the update does not automatically propagate in real time across all connected databases.

In the current workflow, Lot Mondals, Circle Officers, and Sub-Registrars must re-enter or manually reconcile data across portals. For example, a Dag partition approved in Dharitree may leave Bhunaksha showing the undivided polygon for weeks, or a mutation may leave e-Khajana billing the previous pattadar.

**Users & Beneficiaries:**
- **Citizens & Pattadars:** Face delayed mutation reflection, repeated office visits, and risk of fraud (such as dual-sale of already-transferred land).
- **Revenue & Registration Officials (COs, Lot Mondals, Sub-Registrars):** Spend significant time on manual data reconciliation and resolving inter-portal discrepancies.
- **State Governance & Banks:** Require consistent, trustworthy land title and encumbrance data for credit, PM-KISAN, and infrastructure acquisition.

**Gaps Addressed & Intended Outcome:**
BhumiSync Assam bridges the synchronization gap between textual, spatial, registration, and revenue ledgers. The intended outcome is **"One Change, Everywhere"**: once an authorized land modification is approved, it validates invariants and automatically propagates across all connected registries within seconds—eliminating manual re-entry, preventing spatial-textual drift, and providing a tamper-evident audit trail.

---

## 2. Proposed solution & key features
**BhumiSync Assam** is an event-driven, transactional synchronization middleware and control plane designed to sit non-invasively above Assam’s existing land record systems without requiring core legacy database rewrites. Whenever an authorized change (mutation, partition, reclassification, or deed registration) is committed in any source portal, BhumiSync captures the event via a **Transactional Outbox**, validates domain invariants, and fans it out reliably to all target systems.

**Main Modules & Key Features:**
1. **Canonical Land Event Envelope (ULPIN / Dag-Patta Schema):** Standardizes parcel updates across District, Circle, Mouza, Village, Patta, and Dag identifiers, supporting Assam-specific land units (Bigha-Katha-Lessa and square meters).
2. **Invariant & Conflict Guardrail Engine:** Automatically enforces domain rules before propagation—such as **Area Conservation** (sum of child Dag areas must equal parent Dag area), ownership share sum checks, and vector-clock version ordering to prevent stale overwrites.
3. **Resilient Adapter Bus with Transactional Outbox:** Guarantees at-least-once, idempotent delivery to Panjeeyan, Dharitree, Bhunaksha, and e-Khajana adapters. If any downstream portal is temporarily offline or lagging, events queue safely in the outbox and auto-reconcile upon recovery.
4. **Conflict Quarantine & Human-in-the-Loop (HITL) Queue:** Any anomaly (e.g., concurrent conflicting edits or spatial-textual area mismatch) is isolated in a quarantine queue for Circle Officer review rather than silently corrupting records.
5. **Hash-Chained Immutable Audit Ledger & Parity Monitor:** Every propagation step is cryptographically hash-chained (`prevHash -> entryHash`) with real-time 4-way parity verification.

**What Changes vs. Current Approach:**
Replaces manual multi-portal updates and periodic batch scripts with automated, sub-second, invariant-checked propagation and real-time discrepancy visibility.

---

## 3. Describe User Journey, Wireframes, Prototype & Proof of Work
**Proposed User Journey:**
1. **Trigger & Approval:** A Sub-Registrar registers a deed in Panjeeyan or a Circle Officer approves a mutation/partition in Dharitree/Mission Basundhara.
2. **Capture & Validation:** BhumiSync’s Outbox captures the approved event, checks idempotency, and runs spatial-textual invariant checks (e.g., verifying `childAreaA + childAreaB == parentArea`).
3. **Auto-Propagation:** Within milliseconds, the adapter bus updates Dharitree (Jamabandi owner/version), Bhunaksha (cadastral polygon split/metadata), Panjeeyan (deed linkage), and e-Khajana (updated pattadar revenue demand).
4. **Exception Handling (If Offline/Conflict):** If Bhunaksha is offline, the event stays in `DEGRADED_RETRY` and auto-reconciles when online. If an invariant fails, it enters `QUARANTINED` for CO resolution.
5. **Audit & Citizen Confidence:** Officials view live 4/4 system parity on the Control Plane; citizens receive consistent records across all portals immediately.

**Prototype, Wireframes & Proof of Work Evidence:**
We have built and verified a working interactive MVP (**BhumiSync Assam Control Plane**) using React, TypeScript, Vite, and Vitest, modeling all four Assam land portals (Panjeeyan, Dharitree, Bhunaksha, and e-Khajana) with live SVG cadastral map rendering.

**Included in the Proof of Work PDF:**
- **Wireframes & Architecture:** End-to-end event flow and UI layout mockups.
- **Live MVP Simulation Outputs:** Screenshots and state tables demonstrating Sale Mutation propagation, Dag Partition splitting (`DAG-104` into `DAG-104/A` and `DAG-104/B`), offline node recovery via Transactional Outbox, and Area-Conservation Quarantine.
- **Automated Test Report:** `vitest` suite passing 4/4 core invariant, idempotency, and recovery tests.

---

## 4. Technology & solution architecture
BhumiSync Assam uses a decoupled, cloud-native **Event-Driven Microservices & Change-Data-Capture (CDC)** architecture designed for high reliability and easy integration with NIC/State Data Centre infrastructure.

**Software Stack:**
- **Control Plane UI:** React 18, TypeScript, Vite, SVG Cadastral Visualizer.
- **Sync Orchestration Core:** Node.js (TypeScript) / Go microservices implementing the Saga/Outbox pattern and idempotency store.
- **Event Streaming & Outbox:** Apache Kafka or NATS JetStream with persistent dead-letter queues (DLQ) and PostgreSQL/PostGIS for canonical state snapshots and hash-chained audit logs.
- **Spatial & Document Validation:** PostGIS / Turf.js geometry validation for Bhunaksha polygon topology checks (no overlaps/gaps on Dag splits).

**Algorithms, Rules & AI/ML:**
- **Deterministic Rule Engine:** Enforces strict mathematical invariants (area conservation, 100% share summation, version-clock monotonic ordering) and idempotency keys.
- **AI/ML Reconciliation Assistant (Phase 2):** Fuzzy entity-resolution (phonetic/transliteration matching across Assamese/English/Bengali scripts using IndicBERT / Levenshtein-Jaro-Winkler) to flag legacy name mismatches between Panjeeyan deeds and Dharitree Jamabandi records for human review.

**APIs, Integrations & Data Flow:**
- **Adapter Pattern:** REST/GraphQL/SOAP-XML or Debezium CDC connectors wrap each legacy system (Panjeeyan, Dharitree, Bhunaksha, e-Khajana) without modifying core schemas.
- **Data Flow:** `Source Approval -> Outbox -> Invariant Validator -> Event Bus -> Parallel Adapters -> Parity Monitor & Audit Ledger`.
- **Hosting:** Containerized (Docker/Kubernetes) deployable on MeghRaj (GI Cloud), Assam State Data Centre (SDC), or NIC cloud environments.

---

## 5. Development methodology & intermediate steps
We follow an **Agile, Test-Driven, and Domain-Co-Designed** methodology structured into five iterative stages:

1. **Discovery & Schema Mapping:**
   - Map exact field-level schemas, state transitions, and ULPIN/Dag-Patta keys across Dharitree, Bhunaksha, Panjeeyan, and e-Khajana.
   - Define the Canonical Land Event Envelope and catalog edge cases (joint pattas, partial mutations, pending court stays).
2. **Architecture & Wireframe Design:**
   - Design the Transactional Outbox, Adapter contracts, and Circle Officer Quarantine UI wireframes.
   - Establish non-functional targets: sub-5-second propagation latency, zero silent data loss, and 100% idempotency.
3. **Interactive Prototype (Completed in MVP):**
   - Built the BhumiSync Control Plane, 4-system simulator, live Bhunaksha SVG polygon splitter, offline-node outbox recovery, and hash-chained audit ledger.
   - Verified core invariants via automated `vitest` unit/integration tests.
4. **Sandbox Integration & AI Entity-Matching:**
   - Replace mock adapters with API/CDC connectors against anonymized departmental sandbox dumps.
   - Train and calibrate the Assamese-English transliteration/entity-matching model for legacy record reconciliation.
5. **Security Hardening, Load Testing & Refinement:**
   - Conduct stress testing (10,000+ concurrent District/Circle events), VAPT security audits, and Circle Officer usability refinement prior to pilot sign-off.

---

## 6. Development timeline & milestones
**Indicative 24-Week (6-Month) Development & Validation Roadmap:**

- **Phase 1 (Weeks 1–4): Discovery & Canonical Schema Freeze**
  - *Deliverables:* Field mapping specification across Dharitree, Bhunaksha, Panjeeyan, and e-Khajana; Canonical Event Schema v1.0; API/CDC integration blueprint.
  - *Dependencies:* Access to anonymized sample schemas and departmental workflow sign-off.
- **Phase 2 (Weeks 5–10): Core Sync Engine & Adapter Framework**
  - *Deliverables:* Production Outbox service, NATS/Kafka event bus, Idempotency & Invariant Engine, and first two live sandbox adapters (Dharitree + e-Khajana).
  - *Milestone:* Automated end-to-end textual sync in staging.
- **Phase 3 (Weeks 11–16): Spatial Adapter, Quarantine UI & AI Reconciliation**
  - *Deliverables:* Bhunaksha PostGIS topology adapter, Panjeeyan deed adapter, Circle Officer HITL Quarantine Dashboard, and Assamese/English entity-matching module.
  - *Milestone:* Full 4-system staging integration complete.
- **Phase 4 (Weeks 17–20): Performance, Security & UAT**
  - *Deliverables:* Load test report (simulated state-wide peak), CERT-In aligned VAPT audit, and User Acceptance Testing (UAT) with Revenue officials.
  - *Milestone:* **Solution Ready for Pilot Validation at Week 20.**
- **Phase 5 (Weeks 21–24): Controlled Circle-Level Shadow Pilot**
  - *Deliverables:* Shadow-mode deployment in 1–2 Revenue Circles, parity discrepancy report, and final production readiness dossier.

---

## 7. Data & information requirements
**Development & Testing Data Needs:**
- **Textual Land Records (Anonymized):** Sample Jamabandi and Chitha extracts (Patta type, Dag number, area in Bigha-Katha-Lessa, land classification, owner shares) in JSON/CSV/SQL dump format.
- **Spatial Data:** Sample Bhunaksha cadastral village maps in GeoJSON/Shapefile format with Dag polygon topology.
- **Registration & Revenue Samples:** Sample Panjeeyan deed registration payloads and e-Khajana demand/receipt structures.
- **Legacy Discrepancy Corpus:** Historical examples of mismatched owner spellings (Assamese/English transliteration) and un-split Dag records for calibrating conflict detection.

**Processing, Annotation & Standards:**
- All PII (Aadhaar/mobile numbers) must be masked/hashed in development and staging datasets.
- Standardize spatial projections (e.g., WGS84 / UTM Zone 46N) and area conversion constants (1 Bigha = 5 Katha = 100 Lessa = 1,337.8 sq.m in Assam standard) across adapters.

**Dependencies & Explicit Assumptions:**
- **No Unconfirmed Production Access Assumed:** Current MVP uses synthetic Assam-structured fixtures. Production/pilot integration assumes the Revenue & Disaster Management Department / NIC will provide either read-only sandbox APIs, CDC replica access, or anonymized schema dumps during Phase 1, along with designated departmental nodal officers for UAT.

---

## 8. Team, manpower & expertise
**Indicative Team Structure (6–7 Members across Phases):**

1. **Tech Lead / Distributed Systems Architect (1 FTE, Phases 1–5):**
   - *Expertise:* Event-driven architecture, Kafka/NATS, Saga/Outbox patterns, fault-tolerant state synchronization.
2. **Backend & Integration Engineers (2 FTEs, Phases 2–5):**
   - *Expertise:* TypeScript/Node.js, Go, PostgreSQL, REST/SOAP/CDC legacy system adapters, cryptographic audit logging.
3. **GIS & Spatial Systems Specialist (1 FTE, Phases 1–4):**
   - *Expertise:* PostGIS, GeoJSON/Shapefile topology validation, Bhunaksha polygon splitting and area-conservation algorithms.
4. **AI/ML & NLP Engineer (1 FTE, Phases 3–4):**
   - *Expertise:* Indic-language entity resolution, fuzzy string matching (Assamese/English transliteration), anomaly scoring.
5. **Frontend & UX Engineer (1 FTE, Phases 2–5):**
   - *Expertise:* React, TypeScript, interactive map/diff UIs, accessible government operator dashboards.
6. **QA, Security & Domain SME Liaison (1 FTE, Phases 1–5):**
   - *Expertise:* Automated testing, VAPT/compliance, Assam Revenue & Mission Basundhara workflow validation.

**Critical Specialist Skills:**
Deep understanding of distributed systems consistency (idempotency, out-of-order events), GIS polygon topology (preventing sliver/overlap errors during Dag partitions), and Assam’s land tenure terminology (Myadi/Eksona Patta, Dag, Chitha, Jamabandi).

---

## 9. Testing, validation & evidence
**Development Testing Strategy:**
- **Unit & Invariant Testing (`vitest`):** Verifies core guarantees—atomic 4-system propagation, Dag area-conservation enforcement, idempotent replay handling, and Transactional Outbox recovery when a downstream node goes offline.
- **Contract & Chaos Testing:** Simulates network partitions, out-of-order events, duplicate webhooks, and malformed spatial geometries to ensure zero silent data corruption.
- **Performance Benchmarking:** Measures p95/p99 end-to-end propagation latency and throughput under simulated state-wide mutation loads.

**Proposed Quality & Performance Measures:**
- **Sync Parity Rate:** 100% consistency across online adapters after event settlement.
- **Propagation Latency:** < 5 seconds (p95) from source approval to all target portals.
- **Zero Silent Failures:** 100% of invariant violations or dead-letter events surfaced in the Quarantine Queue.
- **Idempotency Accuracy:** 0 duplicate mutations or version drifts under repeated event delivery.

**Evidence of Progress (MVP Verified):**
The working BhumiSync Assam prototype and its automated `vitest` suite are implemented and executed locally, with all 4 core test suites passing (propagation, area conservation quarantine, idempotency, and offline node reconciliation) and live UI simulation results documented in the attached Proof of Work PDF.

---

## 10. Security, privacy, safety & compliance
**Security & Access Control:**
- **Zero-Trust Inter-Service Auth:** Mutual TLS (mTLS) and OAuth2/JWT service tokens between BhumiSync adapters and departmental portals.
- **Role-Based Access Control (RBAC):** Strict separation between automated system propagation, Circle Officer quarantine resolution, and read-only audit inspection.

**Privacy & Data Protection:**
- **DPDP Act 2023 Alignment:** Data minimization in event payloads—only parcel identifiers, legal title attributes, and authorized hashes are transmitted; sensitive citizen PII remains in primary vaults.
- **Encryption:** TLS 1.3 in transit; AES-256 encryption at rest for outbox queues and audit snapshots.

**Auditability, Safety & Human-in-the-Loop (HITL):**
- **Tamper-Evident Audit Ledger:** Every state change is recorded with `prevHash -> entryHash` cryptographic chaining, actor ID, timestamp, and before/after diffs.
- **Safety Guardrails & Human Review:** BhumiSync never auto-resolves ambiguous conflicts. Any area mismatch, court-stay flag, or low-confidence name match is automatically **quarantined** and requires explicit digital sign-off by an authorized Circle Officer.
- **Interoperability:** Built around open standards (ULPIN / Bhu-Aadhaar, GeoJSON, OpenAPI 3.0) and GIGW/MeghRaj hosting guidelines.

---

## 11. Innovation & differentiation
**Novel Element:**
Most government integration attempts rely on brittle nightly batch scripts or invasive core-database rewrites. **BhumiSync Assam** introduces a **non-invasive, invariant-enforcing Event-Driven Control Plane** tailored specifically to Assam’s land tenure model. Its key innovation is combining a **Transactional Outbox** with **real-time Spatial-Textual Invariant Guardrails** (e.g., guaranteeing Bhunaksha polygon area conservation alongside Dharitree Jamabandi updates) and a **Quarantine-First Human-in-the-Loop** workflow.

**Existing Alternatives & Basis of Differentiation:**
- *Manual / Portal-by-Portal Entry:* Slow, error-prone, enables dual-sale fraud. BhumiSync automates propagation in seconds.
- *Nightly ETL / Cron Batch Jobs:* High lag (24+ hours), lacks atomic spatial-textual validation, and fails silently on conflicts. BhumiSync provides real-time, idempotent, hash-audited sync with automatic offline recovery.

**IP & Dependencies:**
- **Open-Source Core:** Built on permissive open-source foundations (React, TypeScript, Node.js, PostgreSQL/PostGIS, NATS/Kafka)—avoiding vendor lock-in for the Government of Assam.
- **Proprietary IP:** The Assam-specific Canonical Land Event Schema, Spatial-Textual Invariant Validator, and Indic entity-reconciliation pipeline.

---

## 12. Resources, risks & pilot validation
**Indicative Resource & Cost Drivers:**
- **Manpower (6 months):** Core engineering, GIS, and AI/ML team (~₹18–24 Lakh indicative MVP-to-Pilot budget, aligned with NESFIC grant support).
- **Infrastructure:** Staging/pilot Kubernetes cluster on MeghRaj/SDC (3–4 VMs, managed PostgreSQL/PostGIS, message broker) — low recurring cloud footprint.

**Key Risks & Mitigations:**
1. *Legacy Portal API/Schema Drift:* Mitigated via the Adapter pattern, isolating legacy quirks from the core sync engine.
2. *Intermittent District/Circle Connectivity:* Mitigated via the Transactional Outbox and idempotent retry queues.
3. *Legacy Data Discrepancies (Historical Mismatches):* Mitigated by Quarantine + HITL Circle Officer review rather than forced overwrites.

**Pilot Validation Plan:**
Post-development, BhumiSync will be validated in a **4-week Shadow-Mode Pilot** across 1–2 Revenue Circles (e.g., Dispur / Kamrup Metro):
- **Phase A (Shadow Mode):** Mirror real approved mutations from Dharitree/Panjeeyan without writing to production, measuring parity detection accuracy, latency, and quarantine precision.
- **Phase B (Controlled Live Pilot):** Enable live auto-sync for standard single-owner mutations and partitions under Circle Officer oversight, benchmarking reduction in mutation turnaround time and zero-discrepancy compliance.
