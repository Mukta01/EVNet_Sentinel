# Paper 3: Cybersecurity Challenges in the Electric Vehicle Market

> **File**: `Final_CybersecurityChallengesinEV_CIGRECanada202323.pdf`  
> **Authors**: K. Malimage, N. Ranaweera, et al.  
> **Published**: 2023 CIGRE Canada Conference & Exhibition, Vancouver, BC, Sept. 25–28, 2023  
> **Type**: Conference Paper — Industry Analysis / Threat Landscape  

---

## 1. Paper Overview

This paper provides a **broad industry-level analysis** of the cybersecurity challenges facing the electric vehicle market. Unlike the other reference papers in our collection which focus on ML-based intrusion detection, this paper takes a **strategic and regulatory perspective**, examining the EV architecture, charging infrastructure attack surface, real-world data breaches, regulatory frameworks, and best practices. It does not propose a technical IDS solution but instead establishes the **motivational and contextual foundation** for why projects like EVNet Sentinel are necessary.

---

## 2. Relevance to EVNet Sentinel

This paper is relevant as a **contextual and motivational reference**:

- It provides **real-world case studies of data breaches** in the EV industry (Tesla, Volvo, NIO, Nissan) that justify the urgency of EV cybersecurity research.
- It defines the **EV charging infrastructure architecture** and its attack surface in non-technical terms, useful for project presentations and documentation.
- It catalogues **regulatory and compliance frameworks** (NIST, ISO/SAE 21434, NHTSA, UN Regulation 155) that inform the broader ecosystem in which EVNet Sentinel operates.
- It highlights the **power grid stability risks** from compromised charging infrastructure, reinforcing the real-world stakes of our IDS work.

---

## 3. EV Charging Infrastructure Architecture

The paper defines three key components of the charging infrastructure (per U.S. Dept. of Energy):

| Component | Description |
|---|---|
| **Station Location** | A site with one or more EVSE ports at the same address (e.g., parking garage, mall lot) |
| **EVSE Port** | Provides power to charge one vehicle at a time; may have multiple connectors |
| **Connector** | The physical plug inserted into the vehicle (e.g., CHAdeMO, CCS); only one vehicle charges at a time |

### Key Communication Protocol: OCPI and OCPP

The paper identifies the **Open Charge Point Interface (OCPI)** protocol as the industry standard for charging infrastructure, alongside OCPP (Open Charge Point Protocol) for station-to-management communication. It raises concerns about whether **secure protocols are being consistently used** across the industry.

### Architecture Risks Identified

- Routing large numbers of charge points through a single location creates **single point of failure** risk.
- Connected networks (mobile apps, cloud platforms) increase exposure to cyberattacks.
- Over-the-air (OTA) update mechanisms, if compromised, can affect entire fleets.

> **EVNet Sentinel Relevance**: Our project focuses on the OCPP communication layer between EVCS and CSMS. This paper reinforces that this is a high-value target for adversaries and that securing it is critical.

---

## 4. Attack Surface Analysis

### 4.1 Charging Infrastructure Attacks

| Attack Vector | Description | Impact |
|---|---|---|
| **Network Tampering** | Exploiting vulnerabilities in connectors and network communications | Data theft, unauthorized access |
| **Denial of Service (DoS)** | Flooding communication channels | Service disruption |
| **SQL Injection** | Exploiting web vulnerabilities in charging station interfaces | Data breach, system compromise |
| **Cross-Site Scripting (XSS)** | Exploiting web application vulnerabilities | Session hijacking, data theft |
| **Malware/Ransomware** | Introduction via connected networks or OTA updates | System compromise, ransom demands |

### 4.2 Power Grid Attacks

| Attack Type | Description | Impact |
|---|---|---|
| **Grid Destabilization** | Tampering with EV charging during peak times | Voltage fluctuations, transformer overload, outages |
| **Power Flow Manipulation** | Exploiting infrastructure to overload grid | Potential national security threat |
| **Coordinated Disruption** | Remotely disrupting multiple charging stations | Economic disruption, service denial |

**Real-World Example**: In 2022, Ukrainian hackers remotely disrupted and shut down EV charging stations in Russia while displaying anti-Putin messages — demonstrating the real-world feasibility of charging infrastructure attacks.

### 4.3 Charging Network Security Requirements

The paper identifies key security characteristics for charging networks:

1. Secure software update reception and implementation (OTA)
2. Real-time protocol translation
3. Encryption and decryption of data
4. Authentication and authorization of users
5. Secure remote monitoring, diagnostics, and control
6. Secure measurement, communication, storage, and reporting
7. Network protocol version management to reduce reconnaissance

> **EVNet Sentinel Relevance**: Our IDS addresses the detection side of these requirements, specifically identifying DoS, reconnaissance, and network-based attacks that could lead to the scenarios described above.

---

## 5. Real-World Data Breaches in the EV Market

The paper provides a detailed timeline of EV industry cybersecurity incidents:

| Date | Company | Incident | Root Cause |
|---|---|---|---|
| **Feb 2018** | Tesla | Cryptojacking — cloud servers hijacked for crypto mining | Exposed Kubernetes dashboard, no password protection |
| **Feb 2021** | Tesla | Internal data breach — newly hired engineer leaked sensitive data to Dropbox | Lack of data loss prevention; violation of least privilege principle |
| **Jun 2018** | Tesla | Insider threat — former employee stole gigabytes of data | Insufficient access controls |
| **Jan 2021** | Tesla | Former employee sued for stealing software code for Xpeng | Competition-driven insider threat |
| **Jul 2020** | Tesla | Sued Rivian alleging employees stole trade secrets | Competitive espionage |
| **Jan 2023** | Volvo | Ransomware attack — hacker selling stolen data | Unknown vulnerability |
| **Dec 2022** | NIO | Blackmailed for US$2.25M after data breach | External hacking |
| **Mar 2021** | Tesla (Verkada) | Hackers accessed security cameras inside Tesla facilities | Compromise of third-party vendor (Verkada) |
| **Jan 2023** | Nissan North America | Data breach via third-party provider | Third-party supply chain compromise |

### Key Insights from Breach Analysis

1. **Insider threats dominate**: Most breaches resulted from internal system compromise, not external EV attacks.
2. **Competition drives espionage**: Employee data theft is often motivated by competitive advantage.
3. **Least privilege principle violations**: Many incidents could have been prevented with proper identity access management.
4. **Third-party risk**: Supply chain and third-party vendor vulnerabilities are significant attack vectors.

> **EVNet Sentinel Relevance**: While our project focuses on network-level IDS, these case studies provide important context for the broader threat landscape. The cryptojacking incident (2018) is particularly relevant as cryptojacking is one of the attack types in the CICEVSE2024 dataset we use.

---

## 6. Regulatory and Compliance Frameworks

The paper surveys the regulatory landscape governing EV cybersecurity:

| Framework | Organization | Scope |
|---|---|---|
| **NIST Cybersecurity Framework** | NIST (U.S.) | General cybersecurity best practices across industries |
| **ISO/SAE 21434:2021** | ISO/SAE | "Road Vehicles — Cybersecurity Engineering" — covers 7 areas from concept to decommissioning |
| **UN Regulation No. 155** | UNECE | Cyber security management system requirements for vehicle type approval |
| **NHTSA Cybersecurity Guidance** | NHTSA (U.S.) | Best practices for modern vehicle cybersecurity |
| **Auto-ISAC Best Practices** | Auto-ISAC | Automotive industry cybersecurity sharing and analysis |
| **Consumer Privacy Protection Principles** | Autos Innovate | Consumer privacy in vehicle technologies and services |
| **NEVI Standards** | FHWA (U.S.) | National Electric Vehicle Infrastructure standards and requirements |

### Key Gap Identified

> The paper notes that there is **no public database or certification registry** to verify which EV makers are certified under ISO/SAE 21434 — a significant gap in the current EV market.

> **EVNet Sentinel Relevance**: These frameworks provide the regulatory backdrop for our project. Specifically, ISO/SAE 21434's emphasis on cybersecurity throughout the product lifecycle and NIST's framework for detection and response directly align with what EVNet Sentinel implements on the detection side.

---

## 7. Best Practices Recommended

The paper recommends the following cybersecurity best practices for EV manufacturers and infrastructure providers:

1. **Vulnerability Management**: Regular security assessments and prompt patching.
2. **Data Protection**: Strong encryption for customer information, vehicle telemetry, and software updates.
3. **Data Security Controls**: Access controls to prevent unauthorized data access.
4. **Timely Software Updates**: Addressing vulnerabilities through regular updates.
5. **Network Communication Security**: Strong encryption, TLS, and authentication mechanisms.
6. **Physical Security**: Locked cabinets, closed access ports, tamper-indicating seals.
7. **Threat Intelligence**: Proactive collection and analysis of threat intelligence.
8. **Compliance Adoption**: Implementing frameworks like ISO/SAE 21434 and NIST.

---

## 8. Key Takeaways for EVNet Sentinel

1. **Real-world urgency is established**: The paper demonstrates through case studies that EV cybersecurity threats are not theoretical — they are happening today.
2. **Power grid risks justify our work**: Compromised charging infrastructure can destabilize power grids, making IDS systems like EVNet Sentinel critical infrastructure.
3. **Cryptojacking is a real EV threat**: Tesla's 2018 cryptojacking incident validates the inclusion of cryptojacking in the CICEVSE2024 dataset and our detection pipeline.
4. **Regulatory alignment matters**: EVNet Sentinel's detection capabilities align with the detection and response functions of the NIST Cybersecurity Framework and ISO/SAE 21434.
5. **This paper is ideal for project introductions**: Its non-technical, industry-level analysis makes it perfect for presentations, SRS documents, and project motivation sections.

---

## 9. Citation

```bibtex
@inproceedings{malimage2023cybersecurity,
  title={Cybersecurity Challenges in the Electric Vehicle Market},
  author={Malimage, K. and Ranaweera, N. and others},
  booktitle={2023 CIGRE Canada Conference \& Exhibition},
  year={2023},
  address={Vancouver, BC, Canada},
  month={September}
}
```
