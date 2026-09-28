# The +privacy Track — GDPR / RGPD by Design

`+privacy` is for a feature that collects, stores, shares, profiles or deletes **personal data** — any
information about an identified or identifiable person (GDPR Art. 4(1)): a name, an email address, an
IP address, a device ID, a location, a support ticket. It composes with every other track — a sign-up
flow is often `core +tdd +sec +privacy`, a recommendation engine `core +ai +privacy`.

> **Not legal advice.** This reference turns the GDPR's engineering obligations into spec sections and
> tests. The legal assessment — lawful basis, whether a DPIA is required, transfer safeguards — belongs
> to your DPO or counsel; the spec records their decision and makes it testable.

---

## When to turn it on

| Signal strength | Examples |
|---|---|
| **Strong** (one is enough) | GDPR, RGPD, LGPD, CCPA, HIPAA, personal data, PII, DPIA, data subject, right to erasure, data portability, data retention, anonymization / pseudonymization · *dados pessoais, titular dos dados, direito ao apagamento, AIPD, CNPD* · *datos personales, derecho de supresión, EIPD, AEPD* |
| **Weak** (needs a second one) | user data, user profile, email address, phone number, date of birth, cookies, geolocation, health data, opt-in / opt-out, unsubscribe, privacy, **consent**, retention period / policy · *dados do utilizador, privacidade, consentimento* · *datos de usuario, privacidad, consentimiento* |

Since 1.14, GDPR / RGPD / HIPAA are `+privacy` signals (they used to switch `+saas` on). Consent and retention
words are weak on purpose: an OAuth consent screen or a trash folder's retention period is no personal-data
processing until another privacy signal says so. A negated signal ("no personal data", "sem dados pessoais") keeps the
track off and says so. Rules for every track: `classification-matrix.md`.

Turn it on later with `spec_add_track {name, track: "privacy"}` (`dev-spec add-track <feature> privacy`);
`remove: true` turns it off without deleting anything.

---

## What the track adds

| Artifact | What `+privacy` puts there |
|---|---|
| `requirements.md` | `#### [PRIVACY] Acceptance Criteria (EARS)` — **US-1.AC-13** export of the subject's data, machine-readable, within one month; **US-1.AC-14** erasure in every store within one month; **US-1.AC-15** deletion / anonymization when the retention period ends |
| `design.md` | 6 mandatory sections, each seeded with the `> **TODO**` sentinel: `[PRIVACY] Personal Data Inventory` · `Lawful Basis & Purpose` · `Retention & Deletion` · `Data Subject Rights` · `Processors & International Transfers` · `DPIA (when required — Art. 35)` |
| `tasks.md` | `## Story US-1 — Privacy`: inventory + lawful basis, data subject requests end to end, the retention job |
| `test-plan.md` (with `+tdd`) | a row per criterion: complete export, nothing left after erasure, expiry job |
| `steering/privacy.md` | roles (controller, DPO, supervisory authority), Art. 5 principles, records of processing, lawful bases in use, retention schedule, request handling, processors, breach response |
| `checklist.md` / `spec_finish` | rights verified end to end on the real stores; retention scheduled; notice and records updated; DPIA decision on file |

`spec_doctor` runs **`privacy-sections`** — FAIL while a `[PRIVACY]` section is missing, empty or still
holds the TODO line; the **design approval is refused** for the same reason. `spec_clarify` asks for the
data subject rights and the retention periods when `requirements.md` says nothing about them. Headings
match in EN/PT/ES (`Inventário de Dados Pessoais`, `Base Jurídica y Finalidad`…); the `[PRIVACY]`
marker stays English.

---

## The principles behind the sections (Art. 5)

| Principle (Art. 5(1)) | What it means for the design | Section |
|---|---|---|
| (a) lawfulness, fairness, transparency | a lawful basis for each purpose; people are told (Arts. 13–14) | Lawful Basis & Purpose |
| (b) purpose limitation | data collected for X is not reused for Y without a new basis | Lawful Basis & Purpose |
| (c) data minimisation | collect only the fields the purpose needs | Personal Data Inventory |
| (d) accuracy | people can correct their data (Art. 16) | Data Subject Rights |
| (e) storage limitation | a retention period per category, then delete or anonymize | Retention & Deletion |
| (f) integrity and confidentiality | security of processing (Art. 32) | `+sec`, if on |
| Art. 5(2) accountability | you can **show** compliance — the spec and its approvals are part of that record | all |

---

## Filling each section

### [PRIVACY] Personal Data Inventory
One row per field: field · category · source (the person, a third party, derived) · where it is
stored (every copy: database, cache, search index, logs, analytics, backups) · who can read it. Flag
**special categories** (Art. 9: health, biometric, genetic, racial or ethnic origin, political
opinions, religious or philosophical beliefs, trade-union membership, sex life / orientation) and
criminal-offence data (Art. 10)
— they need an Art. 9(2) condition on top of the Art. 6 basis. Minimise: every field needs a purpose.

### [PRIVACY] Lawful Basis & Purpose (Art. 6)
One basis per purpose, chosen **before** processing starts:

| Basis (Art. 6(1)) | Typical use | Engineering consequence |
|---|---|---|
| (a) consent | marketing email, non-essential cookies | freely given, specific, recorded (who, when, what text); withdrawable as easily as given (Art. 7) |
| (b) contract | the account data needed to deliver the service | only what the contract needs |
| (c) legal obligation | invoices kept for tax law | the retention period comes from that law |
| (d) vital interests | emergencies | rare |
| (e) public task | public bodies | rare in products |
| (f) legitimate interests | fraud prevention, product security | a documented balancing test; people may object (Art. 21) |

Transparency (Arts. 13–14): what the privacy notice must say — purposes, bases, recipients,
transfers, retention, rights — and when it is shown (at collection; within a month when the data
comes from someone else).

### [PRIVACY] Retention & Deletion
A retention period per category and **why** (a law, a contract, a documented need), what happens at
the end (delete, or anonymize irreversibly — pseudonymized data is still personal data), how
backups and logs expire, and legal holds. This is what US-1.AC-15 and its retention task implement.

### [PRIVACY] Data Subject Rights (Arts. 15–22)

| Right | Article | What the system must do |
|---|---|---|
| Access | 15 | give a copy of the data plus the processing information |
| Rectification | 16 | let the person correct inaccurate data |
| Erasure ("right to be forgotten") | 17 | delete when a ground applies — in every store, and tell recipients (Art. 19) |
| Restriction | 18 | keep the data but stop using it |
| Portability | 20 | export what the person provided, structured and machine-readable, when the basis is consent or contract |
| Objection | 21 | stop processing based on legitimate interests / for direct marketing |
| Automated decisions | 22 | no solely automated decision with legal effect without safeguards (human review) |

Answer **without undue delay and within one month** (Art. 12(3)), extendable by two further months for
complex requests; verify the requester's identity first. US-1.AC-13 and US-1.AC-14 are the testable
core — erasure must reach processors and derived copies (search indexes, caches, analytics).

### [PRIVACY] Processors & International Transfers
Every processor / sub-processor (hosting, email, analytics, LLM providers) with its Art. 28 contract;
where the data is stored and processed; transfers outside the EEA (Chapter V) and their safeguard —
an adequacy decision (Art. 45) or appropriate safeguards such as standard contractual clauses
(Art. 46), with a transfer assessment where required.

### [PRIVACY] DPIA (Art. 35)
A DPIA is **required** before processing that is likely to be high-risk — for example systematic and
extensive profiling with legal or similarly significant effects, large-scale processing of special
categories, or systematic monitoring of a publicly accessible area (Art. 35(3)), and whatever the
national authority lists. The section records the decision either way: *required → risks, measures,
residual risk (and prior consultation, Art. 36, if the risk stays high)*; *not required → why not*.

### Privacy by design and by default (Art. 25) · records (Art. 30)
Defaults collect the minimum, keep optional sharing off, pseudonymize where possible and keep personal
data out of logs. The controller keeps a record of processing activities (Art. 30) — the inventory and
lawful-basis sections of each `+privacy` feature are its raw material. A personal data breach is
notified to the supervisory authority within 72 hours where required (Art. 33), and to the people
affected when the risk is high (Art. 34).

---

## Tests that prove it

| Criterion | Test | Kind |
|---|---|---|
| US-1.AC-13 export | seed a subject across every store → the export holds every field of the inventory, in JSON / CSV | example |
| US-1.AC-14 erasure | erase → query every store (DB, cache, search index, processor stub) → nothing about the subject remains | example |
| US-1.AC-15 retention | records older than the period → the job deletes / anonymizes them, younger ones stay | example |
| consent (your own AC) | withdraw consent → the processing that relied on it stops | example |

---

## Portugal — CNPD and Lei n.º 58/2019

In Portugal the GDPR applies directly; **Lei n.º 58/2019, de 8 de agosto**, ensures its execution in
national law (among other things it sets the age of digital consent for information society services at
13). The supervisory authority is the **CNPD** (Comissão Nacional de Proteção de Dados) — it receives
breach notifications and publishes the list of processing operations that require a DPIA (check the
current list at cnpd.pt). In Spain the equivalent pair is the **AEPD** and the Ley Orgánica 3/2018
(LOPDGDD). Record the authority that applies in `steering/privacy.md`.

See also: `security-track.md` (Art. 32 security of processing), `ai-safety-patterns.md` (personal data
sent to model providers), `steering-templates.md`.
