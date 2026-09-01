# EVNet Sentinel Activity Diagrams

Here are the Mermaid.js versions of the **Activity Diagram** and **Swimlane Diagram**, isolated specifically for the single use case: **Administrator / Researcher (Data Loading & Training Models)**.

## 1. Activity Diagram (Data Loading & Training)
This diagram maps the sequential flow of actions for preparing the data and training the models, ending when the system is ready for monitoring.

```mermaid
flowchart TD
    %% Define nodes
    Start(((Start)))
    A1([Load Datasets<br/>Administrator / Researcher])
    A2([Parse & Scale Data])
    A3([Mask PII / Drop Low-Value Features])
    A4([Trigger Training Pipelines])
    A5([Train Machine Learning Model])
    A6([Tune Hyperparameters])
    A7([Review Classification Reports])
    End(((System Ready for Monitoring)))

    %% Connections
    Start --> A1
    A1 --> A2
    A2 --> A3
    A3 --> A4
    A4 --> A5
    A5 --> A6
    A6 --> A7
    A7 --> End

    %% Styling
    style Start fill:#000,stroke:#000,color:#fff
    style End fill:#000,stroke:#000,stroke-width:2px,color:#fff
    
    %% Green styling matching the "Data Preparation & Training" phase
    classDef admin fill:#d5e8d4,stroke:#82b366,stroke-width:1px,color:#000
    class A1,A2,A3,A4,A5,A6,A7 admin
```

---

## 2. Swimlane Diagram (Data Loading & Training)
This diagram divides the same training workflow into its two core actors: the **Administrator / Researcher** and the **EVNet Sentinel System**.

```mermaid
flowchart TD
    %% Define Swimlanes
    subgraph Admin["Administrator / Researcher"]
        direction TB
        S1([Load Datasets])
        S2([Trigger Training Pipelines])
        S3([Tune Hyperparameters])
        S4([Review Classification Reports])
    end

    subgraph System["EVNet Sentinel System"]
        direction TB
        Y1([Parse & Scale Data])
        Y2([Mask PII / Drop Low-Value Features])
        Y3([Train Machine Learning Model])
        Y4([Validate Model & Generate Results])
    end

    %% Connections
    S1 --> Y1
    Y1 --> Y2
    Y2 --> Y3
    S2 --> Y3
    Y3 --> Y4
    S3 <--> Y4
    Y4 --> S4

    %% Colors matching the original image
    classDef adminBox fill:#d5e8d4,stroke:#82b366,stroke-width:1px,color:#000
    class S1,S2,S3,S4 adminBox
    
    classDef systemBox fill:#dae8fc,stroke:#6c8ebf,stroke-width:1px,color:#000
    class Y1,Y2,Y3,Y4 systemBox
```
