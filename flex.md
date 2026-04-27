graph TD
    %% Global Org Structure
    subgraph ORG [Organizational Hierarchy]
        Dept[Departments] --> SubDept[Sub-Departments]
        SubDept --> Designations[Roles & Designations]
    end

    %% Main Lifecycle
    Start((New Hire)) --> TA[Talent Acquisition]
    TA --> Onboarding[Onboarding & Docs]
    
    %% Core Hub
    Onboarding --> Core[Core HR Hub]
    Designations -.-> Core

    %% Daily Operations & Finance
    subgraph OPS [Operational & Financial Loop]
        Core --> Att[Attendance & Leave]
        
        %% Financial Components
        Core --> Finance[Employee Finance]
        Finance --> Loans[Loan Management / EMI]
        Finance --> PF[Provident Fund / Gratuity]
        
        %% Payroll Engine
        Att --> Payroll[Payroll Engine]
        Loans --> Payroll
        PF --> Payroll
        Payroll --> Compliance[Tax & Statutory]
    end

    %% Performance & Development
    subgraph GROWTH [Performance & Growth]
        Core --> KPI[Goals & KPIs]
        KPI --> Appraisal[Performance Review]
        Appraisal --> LND[Learning & Training]
    end

    %% Exit Logic
    Core --> Exit{Separation?}
    Exit -- Resigned/Terminated --> Clearance[Exit Clearance]
    Clearance --> FF[Final Settlement]
    FF --> Archive((Archived Records))

    %% System Integrations
    Payroll -.-> GL[Finance/General Ledger]
    Onboarding -.-> Asset[IT/Asset Tracking]

    %% Styling
    style ORG fill:#f5f5f5,stroke:#333,stroke-dasharray: 5 5
    style OPS fill:#e3f2fd,stroke:#01579b
    style GROWTH fill:#f1f8e9,stroke:#33691e