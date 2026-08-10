# Feature Engineering Plan — CICEVSE2024 Dataset for EVNet Sentinel

## 1. Background & Motivation

EVNet Sentinel reproduces and extends the **Makhmudov et al. (2025)** pipeline ([paper_4_makhmudov_online_ml.md](file:///Users/shard/projects/EVNet_Sentinel/docs/papers/paper_4_makhmudov_online_ml.md)) which uses the **CICEVSE2024 dataset** from the Canadian Institute for Cybersecurity. The paper achieves **99.13% binary / 98.40% multiclass accuracy** using only the **Network Traffic** subset, processed through **NFStream** into 86 flow-level features. Our feature engineering must faithfully replicate this, while also documenting the two additional data domains (Host Events, Power Consumption) that the dataset provides for potential future extensions.

---

## 2. Complete Dataset Inventory

The dataset at [CICEVSE2024_Dataset/](file:///Users/shard/projects/EVNet_Sentinel/datasets/CICEVSE2024_Dataset) contains **3 data domains**:

| Domain | Location | Raw Source | Files | Rows (approx.) | Features |
|---|---|---|---|---|---|
| **Network Traffic** | `Network Traffic/EVSE-A/csv/` (28 files) + `EVSE-B/csv/` (31 files) | NFStream from pcaps | 59 CSVs | ~2.74M combined | 86 (NFStream flow features) |
| **Host Events** | `Host Events/EVSE-B-HPC-Kernel-Events-Combined.csv` | `perf stat` + kernel tracepoints | 1 combined CSV + 41 individual | ~8,474 | 915 (HPC counters + kernel events) |
| **Power Consumption** | `Power Consumption/EVSE-B-PowerCombined.csv` | I²C Wattmeter | 1 CSV | ~115,298 | 10 (voltage, current, power + labels) |

### 2.1 Experiment Scenario Matrix

From the dataset's [Experiment Scenarios diagram](file:///Users/shard/projects/EVNet_Sentinel/datasets/CICEVSE2024_Dataset/Experiment%20Scenarios.PNG):

| Scenario | EVSE State | Behavior | Description |
|---|---|---|---|
| SNI1 | Idle | Benign | OCPP heartbeat only, no EVCC |
| SNC1 | Charging | Benign | V2G (ISO 15118) + OCPP charging data |
| SMI1 | Idle | Network Attacks | OCPP heartbeat + network attacks |
| SMC1 | Charging | Network Attacks | V2G + OCPP + network attacks |
| SMI2 | Idle | Host Attacks | OCPP heartbeat + host attacks (Backdoor, Cryptojacking) |
| SMC2 | Charging | Host Attacks | V2G + OCPP + host attacks |

### 2.2 Attack Taxonomy (15 Classes for Multiclass)

| Category | Attack Name | Applicable To |
|---|---|---|
| **Benign** | Normal traffic | Network, Host, Power |
| **Reconnaissance** | TCP Port Scan | Network |
| | Service Version Detection | Network |
| | OS Fingerprinting | Network |
| | Aggressive Scan | Network |
| | Syn Stealth Scan | Network |
| | Vulnerability Scan | Network |
| **DoS** | SYN Flood | Network |
| | TCP Flood | Network |
| | UDP Flood | Network |
| | ICMP Flood | Network |
| | ICMP Fragmentation | Network |
| | PSH-ACK Flood | Network |
| | Slowloris | Network |
| | Synonymous IP Flood | Network |
| **Host-Based** | Backdoor | Host, Power |
| | Cryptojacking | Host, Power |

> [!NOTE]
> EVSE-B additionally has **MaliciousEV** scenarios (6 files) simulating a compromised Electric Vehicle performing recon attacks via the V2G (ISO 15118) interface.

---

## 3. Domain A — Network Traffic (PRIMARY for EVNet Sentinel)

### 3.1 Raw Feature Set (86 columns from NFStream)

The [pcap2csv.py](file:///Users/shard/projects/EVNet_Sentinel/datasets/CICEVSE2024_Dataset/Network%20Traffic/pcap2csv.py) script uses `NFStreamer(source=..., statistical_analysis=True)` to extract these 86 features:

| # | Feature Group | Columns | Count | Description |
|---|---|---|---|---|
| 1 | **Identifiers** | `id`, `expiration_id` | 2 | Flow tracking IDs (internal to NFStream) |
| 2 | **Network Addresses** | `src_ip`, `src_mac`, `src_oui`, `dst_ip`, `dst_mac`, `dst_oui` | 6 | IP and MAC addresses of endpoints |
| 3 | **Ports & Protocol** | `src_port`, `dst_port`, `protocol`, `ip_version`, `vlan_id`, `tunnel_id` | 6 | Transport/network layer identifiers |
| 4 | **Bidirectional Timing** | `bidirectional_first_seen_ms`, `bidirectional_last_seen_ms`, `bidirectional_duration_ms` | 3 | Flow start, end, duration |
| 5 | **Bidirectional Volume** | `bidirectional_packets`, `bidirectional_bytes` | 2 | Total packets and bytes in both directions |
| 6 | **Src→Dst Timing** | `src2dst_first_seen_ms`, `src2dst_last_seen_ms`, `src2dst_duration_ms` | 3 | Forward direction timing |
| 7 | **Src→Dst Volume** | `src2dst_packets`, `src2dst_bytes` | 2 | Forward direction volume |
| 8 | **Dst→Src Timing** | `dst2src_first_seen_ms`, `dst2src_last_seen_ms`, `dst2src_duration_ms` | 3 | Backward direction timing |
| 9 | **Dst→Src Volume** | `dst2src_packets`, `dst2src_bytes` | 2 | Backward direction volume |
| 10 | **Packet Size Stats (Bidir)** | `bidirectional_min_ps`, `bidirectional_mean_ps`, `bidirectional_stddev_ps`, `bidirectional_max_ps` | 4 | Statistical distribution of packet sizes |
| 11 | **Packet Size Stats (Src→Dst)** | `src2dst_min_ps`, `src2dst_mean_ps`, `src2dst_stddev_ps`, `src2dst_max_ps` | 4 | Forward packet size distribution |
| 12 | **Packet Size Stats (Dst→Src)** | `dst2src_min_ps`, `dst2src_mean_ps`, `dst2src_stddev_ps`, `dst2src_max_ps` | 4 | Backward packet size distribution |
| 13 | **Inter-Arrival Time (Bidir)** | `bidirectional_min_piat_ms`, `bidirectional_mean_piat_ms`, `bidirectional_stddev_piat_ms`, `bidirectional_max_piat_ms` | 4 | Timing gaps between packets |
| 14 | **Inter-Arrival Time (Src→Dst)** | `src2dst_min_piat_ms`, `src2dst_mean_piat_ms`, `src2dst_stddev_piat_ms`, `src2dst_max_piat_ms` | 4 | Forward IAT distribution |
| 15 | **Inter-Arrival Time (Dst→Src)** | `dst2src_min_piat_ms`, `dst2src_mean_piat_ms`, `dst2src_stddev_piat_ms`, `dst2src_max_piat_ms` | 4 | Backward IAT distribution |
| 16 | **TCP Flags (Bidir)** | `bidirectional_syn_packets`, `bidirectional_cwr_packets`, `bidirectional_ece_packets`, `bidirectional_urg_packets`, `bidirectional_ack_packets`, `bidirectional_psh_packets`, `bidirectional_rst_packets`, `bidirectional_fin_packets` | 8 | Bidirectional TCP flag counts |
| 17 | **TCP Flags (Src→Dst)** | `src2dst_syn_packets` … `src2dst_fin_packets` | 8 | Forward TCP flags |
| 18 | **TCP Flags (Dst→Src)** | `dst2src_syn_packets` … `dst2src_fin_packets` | 8 | Backward TCP flags |
| 19 | **Application Layer** | `application_name`, `application_category_name`, `application_is_guessed`, `application_confidence` | 4 | NFStream's DPI classification |
| 20 | **Metadata (Strings)** | `requested_server_name`, `client_fingerprint`, `server_fingerprint`, `user_agent`, `content_type` | 5 | HTTP/TLS metadata fields |
| | | **TOTAL** | **86** | |

### 3.2 Feature Engineering — What to DROP and WHY

Following the Makhmudov et al. preprocessing (from their [Preprocessing notebook](https://github.com/TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems/blob/main/Preprocessing_CICEVSE2024_NT.ipynb)):

#### Category 1: Identifier / Metadata Columns (DROP — non-predictive)

| Column | Reason to Drop |
|---|---|
| `id` | NFStream internal flow counter — sequential, no behavioral information |
| `expiration_id` | Flow expiration reason code — not a traffic characteristic |
| `src_ip`, `dst_ip` | Would cause model to memorize testbed IPs, not generalize to new networks |
| `src_mac`, `dst_mac` | Same issue — hardcoded to 6 specific MACs in the testbed |
| `src_oui`, `dst_oui` | Vendor OUI prefix — memorizes Raspberry Pi / Grizzl-E hardware, not attack patterns |

> **Why?** These features are *environment-specific identifiers*. A model trained on `src_ip = 192.168.137.85` being the attacker would fail entirely on any other network. The paper removes these to ensure the model learns *behavioral patterns* (packet sizes, timing, flags) rather than *who is talking*.

#### Category 2: String / Categorical Metadata (DROP — sparse, non-numeric)

| Column | Reason to Drop |
|---|---|
| `requested_server_name` | TLS SNI — mostly empty for non-HTTPS traffic |
| `client_fingerprint` | JA3 hash — sparse, testbed-specific |
| `server_fingerprint` | JA3S hash — sparse, testbed-specific |
| `user_agent` | HTTP User-Agent — mostly empty for EV protocols (OCPP/ISO 15118) |
| `content_type` | HTTP Content-Type — mostly empty |

> **Why?** These fields are >80% null/empty across the dataset. EV charging protocols (OCPP over WebSocket, ISO 15118 over TLS) don't populate standard HTTP metadata. Keeping them would introduce massive sparsity and noise.

#### Category 3: Application Layer Strings (DROP or ENCODE)

| Column | Action | Reason |
|---|---|---|
| `application_name` | **DROP** | NFStream DPI guess (e.g., "HTTP", "TLS", "ICMP") — can be derived from `protocol` and port |
| `application_category_name` | **DROP** | Higher-level category ("Web", "Network") — redundant with protocol |
| `application_is_guessed` | **DROP** | Boolean flag about DPI confidence — meta-information, not traffic behavior |
| `application_confidence` | **DROP** | DPI confidence score — about NFStream internals, not about the flow itself |

#### Category 4: Zero-Variance / Near-Zero Columns (DROP — >80% zeros)

| Column | Reason |
|---|---|
| `vlan_id` | Always 0 in testbed (no VLANs configured) |
| `tunnel_id` | Always 0 (no tunneling) |

> **Why?** Features with constant or near-constant values provide zero discriminative power. They cannot help distinguish attacks from normal traffic because they have the same value for both classes.

### 3.3 Feature Engineering — What to KEEP and WHY

After dropping the above, we retain **~66–68 numerical features** that capture the *behavioral signature* of network flows:

#### Tier 1: CRITICAL Features (Strongest Discriminative Power)

| Feature Group | Why Critical | What Attacks They Detect |
|---|---|---|
| **Packet Size Statistics** (12 features: min/mean/stddev/max × bidir/src2dst/dst2src) | Attacks have distinct packet size fingerprints. DoS floods use fixed-size packets (e.g., SYN=54 bytes). Recon scans use small probes. Normal OCPP/V2G has variable-size payloads. | DoS (all variants), Reconnaissance |
| **Inter-Arrival Time Statistics** (12 features) | Attack timing is dramatically different from normal traffic. Floods have near-zero IAT (μs gaps). Normal OCPP heartbeats have ~30s IAT. | SYN/TCP/UDP Flood vs. Benign, Slowloris (very high IAT) |
| **TCP Flag Counts** (24 features) | TCP flags are the DNA of an attack. SYN floods → massive SYN counts, zero ACK. PSH-ACK floods → massive PSH+ACK. RST storms from port scans. | SYN Flood, SYN Stealth, PSH-ACK Flood, Port Scan |

#### Tier 2: IMPORTANT Features (Strong Signal)

| Feature Group | Why Important | What Attacks They Detect |
|---|---|---|
| **Bidirectional Duration** (3 features) | Flood attacks create very short flows (single packet). Slowloris creates very long flows. Normal V2G sessions have predictable durations. | Slowloris, Flood attacks, Benign baseline |
| **Packet/Byte Counts** (6 features) | Volume asymmetry is a key indicator. DoS → high src2dst, low dst2src. Recon → balanced small flows. Benign → balanced moderate flows. | DoS (volume spike), Recon (many small flows) |
| **Protocol** | Differentiates TCP (most attacks), UDP (UDP Flood), ICMP (ICMP Flood/Fragmentation) | ICMP Flood, UDP Flood |
| **Ports** (`src_port`, `dst_port`) | Port scanning creates flows to sequential dst_ports. Flood attacks target specific ports (e.g., 8080 OCPP). | Port Scan, Service Detection |

#### Tier 3: SUPPORTING Features (Useful Context)

| Feature Group | Why Useful |
|---|---|
| **IP Version** | Should always be 4 in testbed; anomaly if IPv6 appears |
| **Directional Timing** (src2dst/dst2src first/last seen) | Temporal ordering helps detect asymmetric attacks |

### 3.4 Final Feature Pipeline (Reproducing the Paper)

```python
# Columns to DROP (per Makhmudov et al. preprocessing)
DROP_COLUMNS = [
    # Identifiers
    'id', 'expiration_id',
    # Network addresses (would overfit to testbed)
    'src_ip', 'src_mac', 'src_oui',
    'dst_ip', 'dst_mac', 'dst_oui',
    # Near-zero variance
    'vlan_id', 'tunnel_id',
    # String metadata (sparse/empty)
    'requested_server_name', 'client_fingerprint',
    'server_fingerprint', 'user_agent', 'content_type',
    # Application layer DPI (redundant with protocol)
    'application_name', 'application_category_name',
    'application_is_guessed', 'application_confidence',
    # Label column (target, not a feature)
    'Label',
]

# Resulting feature count: 86 - 20 dropped - 1 label = ~65 features
# Preprocessing: StandardScaler (zero mean, unit variance)
```

---

## 4. Domain B — Host Events (EVSE-B Only)

### 4.1 Overview

Located at [Host Events/](file:///Users/shard/projects/EVNet_Sentinel/datasets/CICEVSE2024_Dataset/Host%20Events), this data captures **Hardware Performance Counters (HPC)** and **Kernel Events** from the Raspberry Pi running EVSE-B, sampled every 5 seconds.

- **Total Features**: 915 columns (see [Readme.txt](file:///Users/shard/projects/EVNet_Sentinel/datasets/CICEVSE2024_Dataset/Host%20Events/Readme.txt))
- **Rows**: ~8,474 (combined preprocessed CSV)
- **Label Columns**: `State`, `Attack`, `Scenario`, `Label`, `interface`

### 4.2 Feature Categories

| Category | Example Features | Count (approx.) | What They Measure |
|---|---|---|---|
| **HPC — Branch Prediction** | `br_immed_spec`, `br_indirect_spec`, `br_mis_pred`, `br_pred` | ~10 | CPU branch prediction behavior — cryptojacking disrupts normal branch patterns |
| **HPC — Cache** | `l1d_cache`, `l1d_cache_refill`, `l2d_cache`, `cache-misses` | ~30 | Cache hit/miss rates — malware causes anomalous cache behavior |
| **HPC — Instructions** | `inst_retired`, `inst_spec`, `instructions`, `cpu-cycles` | ~10 | Instruction throughput — cryptojacking massively increases CPU cycles |
| **HPC — Memory** | `mem_access`, `mem_access_rd`, `mem_access_wr` | ~5 | Memory access patterns |
| **HPC — TLB** | `dTLB-load-misses`, `iTLB-load-misses`, `l1d_tlb_refill` | ~8 | Translation Lookaside Buffer misses |
| **Kernel — Scheduling** | `sched_sched_switch`, `sched_sched_wakeup`, `context-switches` | ~25 | Process scheduling behavior — backdoors cause anomalous scheduling |
| **Kernel — Network** | `net_net_dev_queue`, `net_netif_receive_skb`, `tcp_*` | ~30 | Network stack events — relevant for network-triggered host anomalies |
| **Kernel — Syscalls** | `syscalls_sys_enter_*`, `syscalls_sys_exit_*` | ~600+ | Individual system call counts — backdoors use unusual syscall patterns |
| **Kernel — Memory/IO** | `kmem_*`, `block_*`, `writeback_*` | ~80 | Kernel memory allocation and block IO — cryptojacking is IO-intensive |

### 4.3 Why NOT Used by Makhmudov et al.?

> [!IMPORTANT]
> The Makhmudov paper **only uses Network Traffic** features. Host Events are part of the CICEVSE2024 dataset but were not used in the online learning pipeline we are reproducing. They are relevant for **host-based attack detection** (Backdoor, Cryptojacking) which cannot be detected by network traffic alone.

### 4.4 Potential Future Use for EVNet Sentinel

If we extend beyond the paper:
- **Cryptojacking Detection**: HPC counters (`cpu-cycles`, `instructions`, `cache-misses`) are gold-standard indicators. Cryptomining causes sustained high CPU utilization with specific cache patterns.
- **Backdoor Detection**: Syscall sequences (`execve`, `connect`, `bind`, `sendto`) can reveal reverse shells or command-and-control communication.
- **Challenge**: 915 features × 8,474 samples is a wide-and-short dataset. Would require aggressive feature selection (PCA, mutual information, or domain-specific selection).

---

## 5. Domain C — Power Consumption (EVSE-B Only)

### 5.1 Overview

Located at [Power Consumption/](file:///Users/shard/projects/EVNet_Sentinel/datasets/CICEVSE2024_Dataset/Power%20Consumption), this is a time-series dataset from an I²C wattmeter attached to the Raspberry Pi (EVSE-B), sampled at 1-second intervals.

### 5.2 Features

| Feature | Type | Description |
|---|---|---|
| `time` | Timestamp | Sample timestamp |
| `shunt_voltage` | Float (mV) | Voltage drop across shunt resistor |
| `bus_voltage_V` | Float (V) | DC bus voltage supply |
| `current_mA` | Float (mA) | EVSE-B current consumption |
| `power_mW` | Float (mW) | EVSE-B power consumption |
| `State` | Categorical | Idle / Charging |
| `Attack` | Categorical | Specific attack name or None |
| `Attack-Group` | Categorical | DoS / Reconnaissance / Cryptojacking / Backdoor / Benign |
| `Label` | Binary | attack / benign |
| `interface` | Categorical | OCPP / ISO15118 |

### 5.3 Why It Matters (Physical Side-Channel)

Power consumption is a **physical side-channel** that can detect attacks invisible to network monitoring:
- **Cryptojacking**: Causes sustained elevated power draw (CPU mining at 100%)
- **Backdoor**: May cause intermittent power spikes during C2 communication
- **DoS during charging**: Power remains normal but network is disrupted — useful for correlation

### 5.4 Why NOT Used by Makhmudov et al.?

Same reason as Host Events — the paper focuses exclusively on the network traffic modality. Power data is complementary and could enable **multi-modal fusion** in future work.

---

## 6. Proposed Changes for Feature Engineering Implementation

### Phase 1 (Reproduce the Paper — MUST DO)

#### [NEW] [feature_engineering.py](file:///Users/shard/projects/EVNet_Sentinel/backend/feature_engineering.py)

A Python module that:
1. Loads all Network Traffic CSVs from EVSE-A + EVSE-B
2. Concatenates into a single DataFrame (~2.74M rows × 86 columns)
3. Drops the 20 non-predictive columns identified in §3.2
4. Handles the `Label` column to create binary (Benign vs Attack) and multiclass (15-class) targets
5. Applies `StandardScaler` normalization
6. Outputs the clean, ready-to-stream dataset

#### [NEW] [preprocessing_config.py](file:///Users/shard/projects/EVNet_Sentinel/backend/preprocessing_config.py)

Central configuration file defining:
- `DROP_COLUMNS` list
- `LABEL_MAPPINGS` for binary and multiclass
- Feature group definitions for dashboard visualization

### Phase 2 (Extend Beyond the Paper — FUTURE)

#### [NEW] Host Events preprocessing pipeline
#### [NEW] Power Consumption preprocessing pipeline
#### [NEW] Multi-modal feature fusion

---

## 7. Open Questions

> [!IMPORTANT]
> **Q1**: Should we implement the feature engineering as standalone Python scripts (for notebook-style exploration) or as importable modules in the `backend/` directory (for integration with the FastAPI pipeline)?

> [!IMPORTANT]
> **Q2**: The original paper uses **all 59 CSV files** concatenated. Some EVSE-B Network Traffic files are quite large (e.g., `EVSE-B-charging-syn-stealth.csv` at 80MB). Do you want to start with a subset for development, or work with the full ~2.74M rows from the beginning?

> [!IMPORTANT]
> **Q3**: Do you want to include the **Host Events** and **Power Consumption** domains in this feature engineering phase, or keep them strictly for a future phase?

---

## 8. Verification Plan

### Automated Tests
```bash
# After implementation, verify:
python -m pytest backend/tests/test_feature_engineering.py -v

# Key assertions:
# 1. Combined dataset has ~2.74M rows
# 2. After dropping columns: ~65-66 features remain
# 3. No string columns in final feature matrix
# 4. No NaN/Inf values after StandardScaler
# 5. Binary labels: exactly 2 classes (0=Benign, 1=Attack)
# 6. Multiclass labels: exactly 15 classes
```

### Manual Verification
- Compare our preprocessed feature count against the Makhmudov notebook output (87 columns raw → same feature set after drops)
- Verify class distribution matches the paper's reported ~1.2M instances
