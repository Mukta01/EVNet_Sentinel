# EVNet Sentinel Use Case Diagram

Based on the provided Software Requirements Specification (SRS) (Version 1.2) for the EVNet Sentinel project, here is a detailed Use Case diagram. The diagram captures the primary actors (roles) specified in Section 2.3 and their respective use cases across the different subsystems of the project (Section 2.2 and Section 4).

```mermaid
flowchart LR
    %% Define Actors
    Admin(("Administrator /\nResearcher"))
    Analyst(("Security Analyst /\nDashboard Viewer"))
    Simulator(("Traffic Simulator\n(System Role)"))

    %% System Boundary
    subgraph EVNet_Sentinel [EVNet Sentinel System]
        direction TB
        
        subgraph Data_Pipeline [Data Preprocessing & ML Engine]
            UC1([Load Datasets])
            UC2([Trigger Training Pipelines])
            UC3([Tune Hyperparameters])
            UC4([Review Classification Reports])
            UC13([Parse & Scale Data])
            UC14([Mask PII / Drop Low-Value Features])
        end
        
        subgraph Dashboard [Interactive Dashboard]
            UC5([View Main Dashboard & Metrics])
            UC6([View Live Alert Feed])
            UC7([Control Simulation/Playback])
            UC8([Configure Synthetic Injection Ratio])
            UC9([Download Anomalous Traffic CSV])
            UC12([Investigate Anomalies])
        end
        
        subgraph Sim_Module [Simulation & Evaluation]
            UC10([Replay Labelled Traffic])
            UC11([Inject Synthetic Malicious Traffic])
        end
    end

    %% Connect Actors to Use Cases
    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4

    Analyst --> UC5
    Analyst --> UC6
    Analyst --> UC7
    Analyst --> UC8
    Analyst --> UC9
    Analyst --> UC12

    Simulator --> UC10
    Simulator --> UC11

    %% Internal System Dependencies (includes/extends)
    UC1 -.->|<<includes>>| UC13
    UC13 -.->|<<includes>>| UC14
    UC2 -.->|<<includes>>| UC13
    UC10 -.->|<<triggers>>| UC6
    UC11 -.->|<<triggers>>| UC6
```

## Roles and Responsibilities Breakdown:

1. **Administrator / Researcher**:
   - Focuses on the backend ML lifecycle.
   - Loads the CICEVSE2024 datasets.
   - Triggers the training pipelines for the static batch models (RF, SVM, LR, DT) and the online adaptive model (ARF with ADWIN).
   - Tunes hyperparameters to optimize performance.
   - Reviews offline classification reports.

2. **Security Analyst / Dashboard Viewer**:
   - Focuses on the Next.js/React frontend.
   - Interacts with the real-time alerting dashboard.
   - Controls the simulation playback (play/pause/speed).
   - Monitors the live alert feed, animated confusion matrix, and performance metrics.
   - Adjusts the injection ratio of synthetic attack traffic to test the system's robustness.
   - Downloads CSV logs of anomalous traffic for further investigation.

3. **Traffic Simulator (System Role)**:
   - An automated system actor that programmatically replays labelled traffic.
   - Injects supplementary synthetic malicious traffic into the data stream to evaluate the system's attack coverage and robustness (especially for handling flooding-style traffic).
