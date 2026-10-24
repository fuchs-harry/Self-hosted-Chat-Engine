# Compliance checklist for Austrian companies

> **Not legal advice.** This page maps the engine's features to common GDPR and AI Act requirements so your data protection officer, works council and IT can work through them together. Laws and guidance change; verify with your advisors. State: October 2026.

## The short version

Running an AI assistant on your own server with an EU-hosted or on-prem model removes the biggest risks of "shadow AI": uncontrolled transfers to third countries, no record of processing, and no way to delete data. What remains is organizational:

1. **Pick the model and sign the contract.** A data processing agreement (DPA, *Auftragsverarbeitungsvertrag* per Art. 28 GDPR) with the model provider, unless you run on-prem.
2. **Document the processing.** Add it to your record of processing activities (*Verzeichnis von Verarbeitungstätigkeiten*, Art. 30).
3. **Involve the works council.** In Austria, a system that processes employee data usually needs a works agreement (*Betriebsvereinbarung*) under **§ 96a ArbVG**, and § 96 ArbVG may apply if it could be used to monitor performance. Do this before rollout.
4. **Inform and train employees.** Privacy notice (Art. 13), an internal AI policy, and AI literacy training (**Art. 4 AI Act**, applicable since 2 February 2025).
5. **Consider a DPIA.** A data protection impact assessment (Art. 35) is advisable when special categories of data or large knowledge bases with personal data are involved.

## GDPR: how the engine helps

| Requirement | Article | What the engine provides |
|---|---|---|
| Lawful transfers | Art. 44 ff. | Residency label per model; *EU only* switch; on-prem option (Ollama/vLLM) |
| Data minimization | Art. 5(1)(c), 25 | Reversible pseudonymization of e-mails, IBANs, cards, phone and SV numbers before cloud calls |
| Storage limitation | Art. 5(1)(e) | Configurable chat retention, enforced by the heartbeat; deleting a connector removes its documents |
| Security | Art. 32 | Self-hosted; secrets AES-256-GCM encrypted; scrypt passwords; hashed session tokens; non-root container; no external font or analytics requests |
| Access, portability | Art. 15, 20 | *Settings → Download my data* (JSON with chats, memories, files, activity) |
| Erasure | Art. 17 | Delete chats individually or all; delete memories; admins delete users with all data |
| Transparency about memory | Art. 13, 15 | Users see, edit and delete every remembered fact; memory can be switched off per user or org-wide |
| Special categories | Art. 9 | The memory extractor is instructed never to store health, religion, union membership and similar data |
| Accountability | Art. 5(2) | Audit log of logins, model use (model + residency, no content), uploads, connector syncs and settings changes; CSV export |

## EU AI Act: what applies to you

A general-purpose company assistant is typically **not** a high-risk system. As the company using it, you are a **deployer**. Timeline after the Digital Omnibus on AI (Regulation (EU) 2026/1744, in force since 27 July 2026):

| Since / from | Obligation | Status here |
|---|---|---|
| 2 Feb 2025 | **Art. 4 AI literacy**: staff using AI need sufficient competence | Organizational. Train users; the demo knowledge base contains a sample policy |
| 2 Aug 2026 | **Art. 50 transparency**: people must know they're interacting with AI; AI-generated content marked | The UI states it's an AI under every input; answers show the model used |
| 2 Dec 2027 | High-risk obligations (Annex III), deferred by the Omnibus | Only relevant if you use the assistant for high-risk purposes, e.g. **deciding about hiring, promotion or termination**. Don't. |

## Austria-specific contacts

- **Datenschutzbehörde (DSB)**: the Austrian data protection authority, <https://www.dsb.gv.at>
- **KI-Servicestelle at RTR**: the national contact point for AI Act questions, <https://www.rtr.at/ki>
- **WKO**: templates for DPAs and records of processing for members

## Choosing a model provider: questions to ask

1. Where is inference performed, and can it be pinned to the EU? Check the deployment type, e.g. *Data Zone Standard (EU)* on Azure or `eu.` profiles on Bedrock.
2. Is a DPA available, and which subprocessors are involved?
3. Are prompts used for training? (For the API offerings listed in [models.md](models.md): no, by default.)
4. How long are prompts retained for abuse monitoring, and can that be reduced (zero data retention)?
5. Is the provider subject to third-country access laws (US CLOUD Act)? Document this in your transfer impact assessment.

## Template: entry for the record of processing activities

| Field | Example |
|---|---|
| Purpose | AI-supported answering of internal questions based on company documents; drafting texts |
| Data subjects | Employees (users); persons mentioned in indexed documents |
| Data categories | Chat contents, user account data, document contents, remembered preferences |
| Recipients | Model provider X as processor (DPA dated …); none for on-prem |
| Third-country transfer | None (EU region / on-prem), or: … with SCCs + TIA |
| Retention | Chats: N days of inactivity; documents: as at the source; audit log: … |
| TOMs | See the GDPR table above |
