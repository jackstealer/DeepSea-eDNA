<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:06101F,45:0E7490,100:22D3EE&height=210&section=header&text=DeepSea%20eDNA%20AI&fontSize=52&fontColor=ffffff&fontAlignY=36&desc=Marine%20biodiversity%20from%20environmental%20DNA%20%E2%80%A2%20end-to-end%20MLOps&descAlignY=58&descSize=17&animation=fadeIn" width="100%" alt="DeepSea eDNA AI"/>

<a href="https://app.16-179-237-170.sslip.io">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=2800&pause=700&color=22D3EE&center=true&vCenter=true&width=760&lines=%F0%9F%A7%AC+DNA+sequence+in+%E2%86%92+marine+taxon+out;%F0%9F%A7%A0+CNN+%2B+self-attention+%E2%80%A2+95.0%25+held-out+accuracy;%F0%9F%93%A6+MLflow+registry+%E2%80%A2+models%3A%2F%2Fmarine-edna-classifier%40champion;%F0%9F%90%B3+Docker+%E2%80%A2+GitHub+Actions+%E2%80%A2+AWS+EC2+%2B+HTTPS" alt="Typing intro"/>
</a>

<p>
  <a href="https://app.16-179-237-170.sslip.io"><img src="https://img.shields.io/badge/%F0%9F%9A%80_Live_Demo-Open_App-22D3EE?style=for-the-badge&labelColor=06101F" alt="Live demo"/></a>
  <a href="https://api.16-179-237-170.sslip.io/api/docs"><img src="https://img.shields.io/badge/%F0%9F%93%9A_API-Swagger_Docs-0E7490?style=for-the-badge&labelColor=06101F" alt="API docs"/></a>
  <a href="https://github.com/jackstealer/DeepSea-eDNA/actions/workflows/ci-cd.yml"><img src="https://img.shields.io/github/actions/workflow/status/jackstealer/DeepSea-eDNA/ci-cd.yml?branch=main&style=for-the-badge&label=CI%2FCD&logo=githubactions&logoColor=white&labelColor=06101F" alt="CI/CD status"/></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Accuracy-95.0%25-10B981?style=flat-square" alt="Accuracy"/>
  <img src="https://img.shields.io/badge/Training_data-48%2C000_sequences-0EA5E9?style=flat-square" alt="Data"/>
  <img src="https://img.shields.io/badge/Taxa-8-6366F1?style=flat-square" alt="Taxa"/>
  <img src="https://img.shields.io/badge/Tests-47_passing-22C55E?style=flat-square&logo=pytest&logoColor=white" alt="Tests"/>
  <img src="https://img.shields.io/badge/License-MIT-F59E0B?style=flat-square" alt="License"/>
</p>

<p>
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/PyTorch-2.x-EE4C2C?style=flat-square&logo=pytorch&logoColor=white" alt="PyTorch"/>
  <img src="https://img.shields.io/badge/FastAPI-0.136+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/MLflow-3.17-0194E2?style=flat-square&logo=mlflow&logoColor=white" alt="MLflow"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/AWS-EC2_%2B_CloudFormation-FF9900?style=flat-square&logo=amazonwebservices&logoColor=white" alt="AWS"/>
</p>

**🌊 Paste a DNA sequence collected from sea water and find out which group of marine animals left it behind, served by a production-style MLOps platform.**

[🎬 Demo](#-see-it-in-action) •
[🧭 Workflow](#-end-to-end-workflow) •
[🧠 Model](#-the-model) •
[📦 MLflow](#-mlflow-model-lifecycle) •
[🔄 CI/CD](#-cicd-pipelines) •
[☁️ AWS](#%EF%B8%8F-deployment-on-aws) •
[🚀 Quick start](#-quick-start) •
[📚 API](#-api-reference)

</div>

---

## 🎬 See it in action

<div align="center">

<img src="docs/assets/demo-tour.gif" width="92%" alt="Tour of the DeepSea eDNA AI web app: sign in, dashboard, classify, taxa explorer, model registry, history"/>

<sub>👆 Sign in → personal dashboard → classify a sequence → explore taxa → MLflow-backed model registry → your history</sub>

</div>

<table>
<tr>
<td width="50%" align="center">

**🧬 Classify a sequence**

<img src="docs/assets/demo-classify.gif" alt="Classifying a real Atlantic cod COI sequence"/>

<sub>A real Atlantic cod (<i>Gadus morhua</i>) COI barcode → <b>Gadiformes, 93.8 %</b></sub>

</td>
<td width="50%" align="center">

**🐟 Explore the taxa**

<img src="docs/assets/demo-taxa.gif" alt="Interactive Taxa Explorer with model performance per taxon"/>

<sub>Per-taxon precision/recall, confusions, top species, marker genes and a live test</sub>

</td>
</tr>
</table>

> 🌐 **Try it live:** **https://app.16-179-237-170.sslip.io**. Create a free account, or sign in with Google.

---

## 📖 Table of contents

- [🌍 What is this project?](#-what-is-this-project)
- [✨ Highlights](#-highlights)
- [🧭 End-to-end workflow](#-end-to-end-workflow)
- [🧪 The data](#-the-data)
- [🧠 The model](#-the-model)
- [📦 MLflow model lifecycle](#-mlflow-model-lifecycle)
- [⚡ How a prediction is served](#-how-a-prediction-is-served)
- [🔄 CI/CD pipelines](#-cicd-pipelines)
- [♻️ Retraining and the approval gate](#%EF%B8%8F-retraining-and-the-approval-gate)
- [☁️ Deployment on AWS](#%EF%B8%8F-deployment-on-aws)
- [🖥️ The web app, page by page](#%EF%B8%8F-the-web-app-page-by-page)
- [🔐 Security](#-security)
- [🚀 Quick start](#-quick-start)
- [📚 API reference](#-api-reference)
- [🧪 Testing](#-testing)
- [🗂️ Project structure](#%EF%B8%8F-project-structure)
- [🛠️ Tech stack](#%EF%B8%8F-tech-stack)
- [🗺️ Roadmap](#%EF%B8%8F-roadmap)
- [🆘 Troubleshooting](#-troubleshooting)

---

## 🌍 What is this project?

Every animal in the ocean sheds tiny traces of DNA (skin cells, mucus, waste) into the water. This is **environmental DNA (eDNA)**. Scientists filter sea water, sequence the DNA, and get thousands of short **barcode** sequences (strings of `A`, `C`, `G`, `T`). The hard part is answering **"which animals do these come from?"**

**DeepSea eDNA AI** answers it in milliseconds. A deep-learning model reads a barcode and assigns it to one of **8 marine taxonomic groups**. Around the model sits a complete **MLOps platform**: experiment tracking, a model registry with approval gates, a Dockerized API, automated tests, CI/CD, monitoring, user accounts and a cloud deployment.

<details>
<summary><b>🧬 New to eDNA? Click for a 30-second primer</b></summary>

<br/>

| Term | Meaning |
|---|---|
| **eDNA** | DNA collected from the environment (water, soil) instead of from the animal itself |
| **Barcode** | A short, standard gene region that differs between species. **COI** (cytochrome c oxidase I) is the classic animal barcode |
| **FASTA / FASTQ** | Text formats for DNA. A `>` header line, then the sequence (FASTQ adds per-base quality) |
| **Taxonomy** | Kingdom → Phylum → Class → **Order** → Family → Genus → Species. We predict at order/class level |
| **GenBank / NCBI** | The public DNA database our 48,000 training sequences come from |
| **Novel taxon** | A sequence from a group the model doesn't know. Flagged when confidence < 70 % |

</details>

---

## ✨ Highlights

<table>
<tr>
<td width="33%" valign="top">

### 🧠 Deep learning
- **CNN + multi-head self-attention** classifier (PyTorch)
- **95.0 %** accuracy on 9,600 held-out sequences
- Novelty flag for unknown taxa (< 70 % confidence)
- Reverse-complement + mutation **augmentation**
- Class-balanced sampling for imbalanced data

</td>
<td width="33%" valign="top">

### 📦 MLOps
- **MLflow** experiment tracking + **Model Registry**
- Serves `models:/marine-edna-classifier@champion`
- **Approval gate**: challenger must match or beat the champion
- **Hot reload** of a new champion, no restart
- Prometheus `/metrics`, health checks, Redis cache

</td>
<td width="33%" valign="top">

### 🚢 Engineering
- **FastAPI** + PostgreSQL + Alembic migrations
- **Docker compose** stack (6 services)
- **47 pytest tests**, CI on SQLite **and** PostgreSQL
- **GitHub Actions**: lint → test → E2E → publish to GHCR
- **AWS EC2** via CloudFormation, auto-HTTPS with Caddy

</td>
</tr>
<tr>
<td valign="top">

### 🖥️ Web app
- React 19 + TypeScript + Tailwind, light/dark
- Single, batch and **file (FASTA/FASTQ)** analysis
- Interactive **Taxa Explorer** built from real data
- Personal history, exports (JSON/CSV/TSV/BIOM/FASTA)

</td>
<td valign="top">

### 🔐 Accounts & security
- Email/password, **Google** and **GitHub** sign-in
- JWT access + rotating refresh tokens, revocation
- **RBAC**: admin · scientist · viewer · api_user
- Rate-limited login, private per-user data

</td>
<td valign="top">

### 🔬 Science
- Shannon & Simpson **diversity**, evenness
- Per-taxon precision / recall / F1 + confusions
- 4,826 species across 3 phyla in the training set
- Every result records the **model version** used

</td>
</tr>
</table>

---

## 🧭 End-to-end workflow

The full lifecycle, from raw DNA to a monitored production model, and back to retraining:

```mermaid
flowchart LR
    subgraph DATA["🧪 Data"]
        A["🌐 NCBI GenBank<br/>48,000 sequences"] --> B["🗂️ FASTA per class<br/>class_0 … class_7"]
        B --> C["🧹 Validate & clean<br/>IUPAC letters, U→T"]
        C --> D["🔢 Encode & pad<br/>A=1 C=2 G=3 T=4 · 1,000 bp"]
    end

    subgraph TRAIN["🧠 Training"]
        D --> E["🏋️ train_model.py<br/>CNN + self-attention"]
        E --> F["📊 Evaluate<br/>accuracy · precision · recall"]
    end

    subgraph REG["📦 MLflow"]
        F --> G["📝 Tracking<br/>params · metrics · artifacts"]
        G --> H["🏷️ Registry<br/>new version @challenger"]
        H --> I{"⚖️ Approval gate<br/>val_accuracy ≥ champion?"}
        I -- yes --> J["🏆 @champion"]
        I -- no --> K["🛑 keep current champion"]
    end

    subgraph SERVE["🚀 Serving"]
        J --> L["🐳 FastAPI container<br/>loads models:/…@champion"]
        L --> M["🖥️ React web app"]
        L --> N["📈 /metrics · /health<br/>novelty & confidence"]
    end

    N -. drift / new data .-> O["♻️ Retraining workflow<br/>GitHub Actions"]
    O -.-> E

    style DATA fill:#0b1a33,stroke:#22d3ee,color:#e2e8f0
    style TRAIN fill:#0b1a33,stroke:#a78bfa,color:#e2e8f0
    style REG fill:#0b1a33,stroke:#38bdf8,color:#e2e8f0
    style SERVE fill:#0b1a33,stroke:#34d399,color:#e2e8f0
```

| # | MLOps stage | 🛠️ Where it lives in this repo |
|---|---|---|
| 1️⃣ | **Data ingestion** | `data/training/marine_diverse/class_*/sequences.fasta` (NCBI GenBank) |
| 2️⃣ | **Data validation** | `clean_sequence()` in `backend/app/api/models.py`, `SequenceProcessor` (length/quality filters) |
| 3️⃣ | **Preprocessing** | `sequence_to_tensor()` in `backend/app/models/deep_learning.py` |
| 4️⃣ | **Training** | `backend/training/train_model.py` |
| 5️⃣ | **Experiment tracking** | MLflow runs (params, per-epoch metrics, artifacts) |
| 6️⃣ | **Evaluation** | validation split + `scripts/build_taxa_catalog.py` (reproduces the held-out split) |
| 7️⃣ | **Model registry** | `backend/app/ml/registry.py`: `marine-edna-classifier`, `@champion` / `@challenger` |
| 8️⃣ | **Deployment** | `Dockerfile`, `docker-compose.yml`, `deploy/aws/` |
| 9️⃣ | **Monitoring** | `/health`, `/metrics` (Prometheus), Monitoring page, novelty flags |
| 🔟 | **Retraining** | `.github/workflows/model-training.yml` + approval gate |

---

## 🧪 The data

**48,000 DNA sequences from NCBI GenBank**, **4,826 species**, mostly **COI** and **cytochrome b** barcodes (plus 16S/12S/18S rRNA, NADH and control region).

```mermaid
pie showData
    title Training sequences per taxon
    "Perciformes 🐟" : 10000
    "Decapoda 🦀" : 8000
    "Bivalvia 🦪" : 6000
    "Gastropoda 🐌" : 6000
    "Salmoniformes 🐟" : 5000
    "Clupeiformes 🐟" : 5000
    "Gadiformes 🐟" : 5000
    "Pleuronectiformes 🐟" : 3000
```

<details>
<summary><b>⚖️ How the class imbalance is handled</b></summary>

<br/>

Perciformes has **3×** more sequences than Pleuronectiformes. Without care, the model would just guess the big class. The fixes:

1. 🎯 **Weighted random sampler**: rare classes are drawn more often, so batches are balanced
2. ⚖️ **Class-weighted cross-entropy**: mistakes on rare classes cost more
3. 🔍 **Per-class metrics**: precision/recall for every taxon, not just overall accuracy

</details>

<details>
<summary><b>🧹 Validation & preprocessing details</b></summary>

<br/>

| Step | What happens |
|---|---|
| Clean | FASTA headers and whitespace removed, uppercase, **U → T** (RNA → DNA) |
| Validate | Only IUPAC letters `ACGTURYSWKMBDHVN` accepted. Anything else → HTTP **422** listing the bad characters |
| File filters | Uploaded reads kept if **100–2,000 bp**, FASTQ quality checked, identical reads **dereplicated** with abundance counts |
| Encode | `A→1 C→2 G→3 T→4`, others (N, ambiguity codes) `→0` |
| Pad / truncate | Fixed length **1,000** (covers almost every barcode) |
| Augment (training only) | Random **reverse complement** and **~1 % point mutations** |

</details>

---

## 🧠 The model

**`DeepTaxaClassifier`**: a 1-D CNN finds short DNA motifs, and self-attention links patterns that are far apart along the sequence.

```mermaid
flowchart TB
    IN["🧬 DNA → 1,000 integers"] --> EMB["🔤 Embedding · 5 → 128"]
    EMB --> C1["🔍 Conv1d k=3 · BatchNorm · ReLU · Dropout"]
    C1 --> C2["🔍 Conv1d k=5 · 256 channels"]
    C2 --> C3["🔍 Conv1d k=7 · 256 channels"]
    C3 --> ATT["👀 Multi-head self-attention · 8 heads<br/>+ residual + LayerNorm"]
    ATT --> POOL["📉 Global max pooling"]
    POOL --> MLP["🧮 Dense 256 → 256 → 128 → 8<br/>ReLU · Dropout 0.4"]
    MLP --> OUT["🎯 Softmax → 8 probabilities<br/>top class + confidence · novel if < 0.7"]

    style IN fill:#06101f,stroke:#22d3ee,color:#e2e8f0
    style OUT fill:#06101f,stroke:#34d399,color:#e2e8f0
```

<details>
<summary><b>🏋️ Training recipe</b></summary>

<br/>

| Setting | Value |
|---|---|
| Split | 80 / 20, `random_split` with **seed 42** (reproducible) |
| Optimizer | **AdamW**, lr 0.001, batch 32 |
| Schedule | **CosineAnnealingWarmRestarts** |
| Loss | Cross-entropy with class weights + **label smoothing 0.1** |
| Regularisation | Dropout 0.2 (conv) / 0.4 (dense), augmentation, **early stopping** (patience 15) |
| Best epoch | 52 (of up to 100) |
| Extras | Optuna tuning (`--tune_hyperparameters`), k-fold CV (`--cross_validation`), `--max_per_class` for quick CI runs |
| Artifact | `best_model.pth` (~15 MB) + `model_config.json` + `taxonomy_map.json` |

</details>

### 📊 Results on 9,600 held-out sequences

| Taxon | Rank · Phylum | Common name | Precision | Recall | Recall bar |
|---|---|---|---:|---:|---|
| 🦪 **Bivalvia** | Class · Mollusca | Clams, mussels, oysters | 98.0 % | **98.6 %** | `██████████` |
| 🐌 **Gastropoda** | Class · Mollusca | Snails and slugs | 99.2 % | **98.4 %** | `██████████` |
| 🦀 **Decapoda** | Order · Arthropoda | Crabs, lobsters, shrimps | 99.7 % | **96.7 %** | `█████████▋` |
| 🐟 **Salmoniformes** | Order · Chordata | Salmon, trout, chars | 93.2 % | **96.6 %** | `█████████▋` |
| 🐟 **Gadiformes** | Order · Chordata | Cods, hakes | 96.5 % | **93.9 %** | `█████████▍` |
| 🐟 **Clupeiformes** | Order · Chordata | Herrings, sardines, anchovies | 90.0 % | **93.9 %** | `█████████▍` |
| 🐟 **Perciformes** | Order · Chordata | Perch-like fishes | 92.9 % | **91.2 %** | `█████████▏` |
| 🐟 **Pleuronectiformes** | Order · Chordata | Flatfishes | 85.2 % | **90.3 %** | `█████████` |
| | | **Overall accuracy** | | **95.0 %** | |

> 💡 **Why are the fish confused more?** The five fish orders are all ray-finned fishes (*Actinopterygii*), so their DNA is similar. Crabs and molluscs sit in different phyla and are almost never confused.
> The numbers are regenerated by `scripts/build_taxa_catalog.py`, which re-creates the exact held-out split. The training run logged 94.18 % because its validation batches were augmented; on clean sequences the score is 95.0 %.

---

## 📦 MLflow model lifecycle

The API never loads a hand-picked weights file. It serves **whichever version holds the `@champion` alias**.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Bootstrap: first start (model-init)
    Bootstrap --> Champion: bundled model registered as v1
    Training --> Challenger: train_model.py registers vN
    Challenger --> Gate: promote_if_better()
    Gate --> Champion: val_accuracy ≥ champion
    Gate --> Rejected: worse than champion
    Champion --> Serving: POST /api/model/reload (hot swap)
    Serving --> Training: retraining workflow
    Champion --> Champion: rollback = move alias to an older version
```

| Concept | Value in this project |
|---|---|
| 🧪 Experiment | `marine-edna-classification` |
| 🏃 Run | `bundled-baseline`, `train-<timestamp>` (params, per-epoch metrics, reports) |
| 📦 Registered model | `marine-edna-classifier` (MLflow **pyfunc**, "models from code") |
| 🏷️ Aliases | `@champion` (served) · `@challenger` (candidate) |
| 🗄️ Backend store | SQLite `/mlflow/mlflow.db` (runs, params, registry) |
| 📁 Artifacts | proxied by the server (`--artifacts-destination`), so containers only need the tracking URI |
| 🛡️ Server | `ghcr.io/mlflow/mlflow:v3.17.2`, `--allowed-hosts` (DNS-rebinding protection) |

<details>
<summary><b>🔌 localhost vs <code>mlflow:5000</code> vs <code>host.docker.internal</code></b></summary>

<br/>

Inside a container, `localhost` is **the container itself**.

- In **docker compose** the backend reaches MLflow by service name: `MLFLOW_TRACKING_URI=http://mlflow:5000`
- A standalone container talking to MLflow on your **host** uses `http://host.docker.internal:5000` (Docker Desktop; on Linux add `--add-host=host.docker.internal:host-gateway`)

```bash
# MLflow on the host (MLflow 3.5+ checks Host headers, so allow the Docker hostname)
mlflow server --host 0.0.0.0 --port 5000 --allowed-hosts "localhost:5000,host.docker.internal:5000"

docker build -t deepsea-edna-api:v2 .
docker run --rm -e MLFLOW_TRACKING_URI=http://host.docker.internal:5000 deepsea-edna-api:v2 python -m app.ml.cli bootstrap
docker run -d --name ml-api -p 8000:8000 \
  -e MLFLOW_TRACKING_URI=http://host.docker.internal:5000 -e MODEL_SOURCE=mlflow deepsea-edna-api:v2
```

MLflow (5000) and FastAPI (8000) are independent ports.

</details>

<details>
<summary><b>🏋️ Train, register, promote, reload (commands)</b></summary>

<br/>

```bash
cd backend
pip install -r requirements.txt -r training/requirements.txt
export MLFLOW_TRACKING_URI=http://localhost:5000

# Logs params + per-epoch metrics + reports, registers a new version as @challenger,
# --promote runs the approval gate
python training/train_model.py --data_dir ../data/training/marine_diverse --output_dir ./out --epochs 50 --promote

python -m app.ml.cli info                  # current @champion / @challenger
python -m app.ml.cli promote --version 3   # manual promotion through the same gate
```

Then click **Reload @champion** on the Model Registry page (or `POST /api/model/reload`). Cache keys include the model version, so stale predictions are never served.

| Setting | Default | Meaning |
|---|---|---|
| `MODEL_SOURCE` | `auto` | `mlflow` = registry only (fail fast) · `local` = bundled files · `auto` = registry, else bundled |
| `MLFLOW_TRACKING_URI` | _(empty)_ | `http://mlflow:5000` in compose |
| `MLFLOW_MODEL_NAME` | `marine-edna-classifier` | registered model |
| `MLFLOW_MODEL_ALIAS` | `champion` | alias the API serves |

</details>

---

## ⚡ How a prediction is served

```mermaid
sequenceDiagram
    autonumber
    actor U as 👩‍🔬 Scientist
    participant W as 🖥️ React app
    participant C as 🔒 Caddy (HTTPS)
    participant A as ⚡ FastAPI
    participant R as 🧊 Redis
    participant M as 🧠 Model @champion
    participant D as 🐘 PostgreSQL

    U->>W: paste sequence, click Classify
    W->>C: POST /api/predict + JWT
    C->>A: forward (X-Real-IP)
    A->>A: verify token & permission, clean + validate DNA
    A->>R: cache lookup (model version + sequence hash)
    alt cache hit
        R-->>A: cached result
    else cache miss
        A->>M: encode → CNN + attention → softmax
        M-->>A: taxon, confidence, probabilities, novelty
        A->>R: store (1 h TTL)
    end
    A->>D: save to your history
    A-->>W: JSON result
    W-->>U: taxon card, probability chart, lineage
```

<details>
<summary><b>📄 Example response</b></summary>

```json
{
  "predicted_class": "Gadiformes",
  "confidence": 0.938,
  "alternatives": [{ "class": "Perciformes", "confidence": 0.031 }],
  "probabilities": { "Gadiformes": 0.938, "Perciformes": 0.031, "...": 0.0 },
  "class_id": 3,
  "rank": "order",
  "lineage": ["Animalia", "Chordata", "Actinopterygii", "Gadiformes"],
  "is_novel": false,
  "cached": false
}
```

</details>

---

## 🔄 CI/CD pipelines

Three GitHub Actions workflows live in `.github/workflows/`:

```mermaid
flowchart LR
    P(["📤 push / PR"]) --> L["🧹 Lint<br/>flake8"]
    P --> T["🧪 Backend tests<br/>matrix: SQLite · PostgreSQL"]
    P --> F["🎨 Frontend<br/>type-check + build"]
    P --> S["🛡️ Security<br/>Trivy · Bandit"]
    L & T & F --> E["🐳 E2E<br/>docker compose up<br/>smoke test: model from MLflow<br/>restart = no duplicate version"]
    E -->|main / v* tag| G["📦 Publish tested images<br/>ghcr.io · sha-xxxxxxx · latest"]
    G -.->|one command via AWS SSM| AWS["☁️ EC2<br/>git pull · compose up --build"]

    style E fill:#06101f,stroke:#22d3ee,color:#e2e8f0
    style G fill:#06101f,stroke:#34d399,color:#e2e8f0
```

| Workflow | ⏰ Trigger | 🔧 What it does |
|---|---|---|
| **CI/CD Pipeline** `ci-cd.yml` | push, PR, tags, manual | lint · 47 tests on 2 databases · frontend build · Trivy/Bandit · full-stack E2E with MLflow · publish images to **GHCR** |
| **Model Retraining** `model-training.yml` | manual or `repository_dispatch: retrain` | train → register `@challenger` → approval gate → summary + artifacts |
| **Pull Request Checks** `pr-checks.yml` | PR opened/updated | change summary, warns on PRs > 1,000 lines |

> ✅ This is **Continuous Delivery**: every change on `main` produces tested, versioned images. Deploying to AWS is one command.

---

## ♻️ Retraining and the approval gate

```mermaid
flowchart LR
    T(["▶️ Run workflow<br/>or API trigger"]) --> B["🏁 Ensure baseline<br/>cli bootstrap"]
    B --> TR["🏋️ Train<br/>epochs · max_per_class"]
    TR --> R["🏷️ Register vN<br/>@challenger"]
    R --> G{"⚖️ challenger val_accuracy<br/>≥ champion?"}
    G -- ✅ yes --> P["🏆 Move @champion<br/>tag approved_at"]
    G -- ❌ no --> K["🛑 Champion unchanged<br/>reason in run summary"]
    P --> RL["🔁 POST /api/model/reload"]
```

- 🎛️ Inputs: `epochs` (default 3), `max_per_class` (default 300, empty = full 48k), `promote` (default true)
- 🗄️ Uses your MLflow server if the `MLFLOW_TRACKING_URI` secret is set, otherwise a throwaway store uploaded as an artifact
- 🛡️ The gate stops a weaker model from ever reaching users. Rollback = move the alias back.

---

## ☁️ Deployment on AWS

One CloudFormation stack builds everything: **EC2 `t3.small`** in Sydney (`ap-southeast-2`), running the **same docker compose stack as CI**, behind **Caddy** with automatic **Let's Encrypt HTTPS** on `sslip.io` hostnames. No domain needed.

```mermaid
flowchart TB
    U(["🌍 Users"]) -->|HTTPS 443| EIP["📌 Elastic IP<br/>16.179.237.170"]
    subgraph AWS["☁️ AWS ap-southeast-2 · default VPC"]
        EIP --> SG["🧱 Security group<br/>only 80 / 443"]
        SG --> EC2
        subgraph EC2["🖥️ EC2 t3.small · Amazon Linux 2023 · IMDSv2 · encrypted gp3"]
            CA["🔒 Caddy<br/>auto TLS"] -->|app.*| FE["🎨 nginx + React"]
            CA -->|api.*| BE["⚡ FastAPI"]
            BE --> PG[("🐘 PostgreSQL")]
            BE --> RD[("🧊 Redis")]
            BE --> MF["📦 MLflow<br/>@champion"]
        end
        SSM["🔐 SSM Parameter Store<br/>/deepsea-edna/*"] -. secrets at boot .-> EC2
    end
    GH["🐙 GitHub repo"] -. git clone .-> EC2
    DEV(["👨‍💻 Admin"]) -. SSM Session Manager, no SSH .-> EC2
```

| | |
|---|---|
| 🌐 App | https://app.16-179-237-170.sslip.io |
| 📚 API | https://api.16-179-237-170.sslip.io/api/docs |
| 🧱 Open ports | **80, 443 only**. API, frontend and MLflow are bound to `127.0.0.1` |
| 🔐 Secrets | SSM Parameter Store (SecureString), never in Git or user data |
| ✅ Ready check | `CreationPolicy` + `cfn-signal` mark the stack complete only once the app answers over **HTTPS** |
| 💰 Cost | ≈ $26 / month (instance + IPv4 + 30 GB disk) |

<details>
<summary><b>🚀 Deploy it yourself (3 steps)</b></summary>

<br/>

```bash
# 1) secrets
P=/deepsea-edna
aws ssm put-parameter --name $P/SECRET_KEY        --type SecureString --value "$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
aws ssm put-parameter --name $P/POSTGRES_PASSWORD --type SecureString --value "$(python -c 'import secrets;print(secrets.token_hex(16))')"
aws ssm put-parameter --name $P/ADMIN_EMAILS      --type String       --value you@example.com

# 2) stack
VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query "Vpcs[0].VpcId" --output text)
SUBNET=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query "Subnets[0].SubnetId" --output text)
aws cloudformation create-stack --stack-name deepsea-edna --template-body file://deploy/aws/ec2-stack.yml \
  --capabilities CAPABILITY_IAM --parameters ParameterKey=VpcId,ParameterValue=$VPC ParameterKey=SubnetId,ParameterValue=$SUBNET
aws cloudformation wait stack-create-complete --stack-name deepsea-edna

# 3) URLs
aws cloudformation describe-stacks --stack-name deepsea-edna --query "Stacks[0].Outputs" --output table
```

**Update to the latest `main`:** `cd /opt/deepsea && git pull && docker compose -f docker-compose.yml -f deploy/aws/docker-compose.aws.yml up -d --build` (run through SSM).
Full guide: [`deploy/aws/README.md`](deploy/aws/README.md)

</details>

---

## 🖥️ The web app, page by page

<div align="center">
<img src="docs/assets/screenshot-dashboard.png" width="49%" alt="Personal dashboard"/>
<img src="docs/assets/screenshot-taxa.png" width="49%" alt="Taxa Explorer"/>
</div>

| Page | 👀 What you can do | 👤 Who |
|---|---|---|
| 🔑 **Login** | Email/password or **Google / GitHub**, create account. Stats read from the measured catalog | everyone |
| 🏠 **Dashboard** | Your classifications, 7-day activity, average confidence, novel count, top taxa, recent jobs. Admins also see CPU / memory / disk and component health | everyone (+admin) |
| 🧬 **Classify** | **Single** sequence (probability chart for all 8 taxa, lineage, novelty), **Batch** FASTA, **File upload** (FASTA/FASTQ background job with diversity indices and exports) | everyone |
| 🕘 **My History** | Every sequence you classified and every file analysis, filter by taxon, paginated, private | everyone |
| 🐟 **Taxa Explorer** | Taxonomy tree, search & sort, per-taxon precision/recall/F1, "mistaken for" chips, top species (NCBI links), marker genes, **live test with a real GenBank sequence** | everyone |
| 📦 **Model Registry** | Live **serving model** card (`models:/…@champion`, version, run), reload from MLflow, compare / activate / rollback / archive versions | view: all · manage: scientist+ |
| 🧪 **Experiments** | Create and run A/B experiments, see confidence intervals, p-value and the winner | view: all · manage: scientist+ |
| 📈 **Monitoring** | Live CPU/memory, requests & errors per minute, cache telemetry, clear cache | admin |
| 🛡️ **Admin** | Users, roles, enable/disable, revoked tokens, role → permission matrix | admin |
| ⚙️ **Settings** | Profile, theme, backend URL & connection test | everyone |

---

## 🔐 Security

<details>
<summary><b>Click to expand the security model</b></summary>

<br/>

| Area | Implementation |
|---|---|
| 🔑 Passwords | **bcrypt** hashes, weak passwords rejected |
| 🎫 Tokens | JWT HS256: **30-min access** + **7-day refresh** (rotated on use), unique `jti`, **revoked on logout** |
| 👥 Roles | `admin` (everything) · `scientist` (classify + manage models/experiments) · `viewer` (default) · `api_user` (predict only) |
| 👑 First admin | Emails in `ADMIN_EMAILS` become admin automatically. No default admin account exists |
| 🚦 Brute force | **10 login/register attempts per minute per IP** → HTTP 429 (real IP via trusted proxy header) |
| 🌐 OAuth | Authorization-code flow, signed `state` bound to an httpOnly cookie, tokens returned in the URL **fragment** |
| 🙈 Privacy | Users only see their own history, jobs and exports. Path traversal blocked |
| 🧱 Headers / CORS | `X-Frame-Options: DENY`, `nosniff`, Referrer & Permissions policies. CORS limited to the app origin |
| 🐳 Containers | API runs as a **non-root** user. DB and Redis are never published |

</details>

---

## 🚀 Quick start

### 🐳 Option A: Docker compose (recommended)

```bash
git clone https://github.com/jackstealer/DeepSea-eDNA.git
cd DeepSea-eDNA
cp .env.example .env          # set SECRET_KEY, POSTGRES_PASSWORD, ADMIN_EMAILS (+ optional OAuth keys)
docker compose up -d --build
```

| Service | URL |
|---|---|
| 🖥️ Web app | http://localhost:3000 |
| 📚 API docs | http://localhost:8000/api/docs |
| 📦 MLflow UI | http://localhost:5000 |

```mermaid
flowchart LR
    db[("🐘 db")] --> be["⚡ backend"]
    rd[("🧊 redis")] --> be
    ml["📦 mlflow"] --> mi["🏁 model-init<br/>v1 @champion"] --> be
    be --> fe["🎨 frontend"]
```

Database migrations run automatically, and `model-init` registers the bundled model as **v1 @champion** the first time.

### 💻 Option B: Local development

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements-dev.txt
cd backend && uvicorn app.main:app --reload --port 8000

# frontend (new terminal, repo root)
npm install && npm run dev                              # http://localhost:3000
```

<details>
<summary><b>🔑 Enable Google / GitHub sign-in</b></summary>

<br/>

- **Google:** Cloud Console → APIs & Services → Credentials → OAuth client (Web). Redirect URI `http://localhost:8000/auth/oauth/google/callback` (your `BACKEND_PUBLIC_URL` in production). Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **GitHub:** Settings → Developer settings → OAuth Apps. Callback `http://localhost:8000/auth/oauth/github/callback`. Set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
- Restart the backend. Buttons appear only for configured providers.

</details>

<details>
<summary><b>⚙️ Main environment variables</b></summary>

<br/>

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | signs JWTs (the API refuses the default in production) |
| `ADMIN_EMAILS` | comma-separated admin emails |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | database |
| `FRONTEND_URL` / `BACKEND_PUBLIC_URL` / `CORS_ORIGINS` | public URLs |
| `GOOGLE_*` / `GITHUB_*` | OAuth apps |
| `MLFLOW_MODEL_NAME` / `MLFLOW_MODEL_ALIAS` / `MLFLOW_EXPERIMENT` / `MODEL_SOURCE` | model serving |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` / `LOGIN_RATE_LIMIT_PER_MINUTE` | auth policy |
| `MAX_UPLOAD_SIZE` / `LOG_LEVEL` | limits and logging |
| `VITE_API_BASE_URL` | API URL baked into the frontend build |

</details>

---

## 📚 API reference

Interactive docs: **`/api/docs`** (Swagger) · Prometheus metrics: **`/metrics`**

<details>
<summary><b>🧭 All endpoint groups</b></summary>

<br/>

| Group | Endpoints |
|---|---|
| ❤️ Health | `GET /health` · `GET /health/detailed` |
| 🔑 Auth | `POST /auth/register` · `POST /auth/token` · `POST /auth/refresh` · `POST /auth/logout` · `GET/PATCH /auth/me` · `GET /auth/providers` |
| 🌐 OAuth | `GET /auth/oauth/{google,github}/login` · `GET /auth/oauth/{provider}/callback` |
| 🛡️ Admin | `GET /auth/users` · `PATCH /auth/users/{id}` · `GET /auth/permissions` · `GET /auth/security-stats` |
| 🧬 Predict | `POST /api/predict` · `POST /api/predict/batch` |
| 📁 Files | `POST /api/upload` · `POST /api/analyze` · `GET /api/results/{job_id}` · `GET /api/export/{job_id}?format=json\|csv\|tsv\|biom\|fasta` |
| 📦 Serving | `GET /api/model/serving` · `POST /api/model/reload` · `GET /api/models` |
| 👤 Workspace | `GET /me/stats` · `GET /me/predictions` · `GET /me/jobs` |
| 🏷️ Versions | `/versions` list · history · statistics · compare · register · activate · rollback · archive · deprecate |
| 🧪 A/B tests | `/experiments` create · start · pause · resume · stop · results |
| 📈 Monitoring | `/monitoring/system` · `/monitoring/application` · `/monitoring/dashboard` |
| 🧊 Cache | `/cache/stats` · `/cache/backend` · `POST /cache/clear` |

</details>

```bash
# 1) log in
TOKEN=$(curl -s -X POST http://localhost:8000/auth/token \
  -d "username=you@example.com&password=<password>" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2) classify
curl -s -X POST http://localhost:8000/api/predict \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sequence": "ACCCTTTATCTCGTATTTGGTGCCTGAGCCGGCATAGTCGGAACAGCCCTAAGCCTGCTCATTCGAGCAGAGCTAAGTCAACCTGG"}'
```

---

## 🧪 Testing

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -v                                                   # SQLite
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/test python -m pytest tests -v
python ../scripts/smoke_test.py --api http://localhost:8000 --mlflow http://localhost:5000 \
  --email you@example.com --expect-source mlflow                            # end-to-end
```

| Suite | Covers |
|---|---|
| `test_integration.py` | accounts, tokens, RBAC, predictions & history privacy, file analysis + exports, OAuth (incl. forged state), rate limiting, security headers |
| `test_mlflow.py` | bootstrap once, champion matches local model, pyfunc interface, **approval gate**, model-source modes, **hot reload** |
| `smoke_test.py` | a live stack: health → MLflow champion → login → served from MLflow → prediction → history → frontend |

---

## 🗂️ Project structure

<details>
<summary><b>📁 Click to expand</b></summary>

```text
DeepSea-eDNA/
├── backend/
│   ├── app/
│   │   ├── api/                  # Routers: auth, oauth, me, models, upload, analysis,
│   │   │                         #   export, versions, experiments, system
│   │   ├── core/                 # Settings, security (JWT/RBAC), rate limiting, logging
│   │   ├── db/                   # SQLAlchemy models, session, Alembic migrations
│   │   ├── ml/                   # MLflow registry, pyfunc wrapper, registry CLI
│   │   ├── models/
│   │   │   └── deep_learning.py  # CNN + self-attention classifier
│   │   ├── services/             # Model loader/serving, sequence processing, users
│   │   └── main.py               # FastAPI application
│   ├── tests/                    # pytest suite (API, auth, MLflow)
│   ├── training/
│   │   ├── train_model.py        # Training + MLflow logging + promotion
│   │   └── requirements.txt      # Extra training dependencies
│   ├── alembic.ini
│   ├── requirements.txt          # API runtime dependencies
│   └── requirements-dev.txt      # + test dependencies
├── mlops/                        # A/B testing, model versioning, monitoring,
│                                 #   cache manager, export formats
├── ml_models/marine_model/       # Bundled model: weights, config, taxonomy map
├── data/training/marine_diverse/ # Training dataset (8 classes, 48,000 sequences)
├── scripts/
│   ├── smoke_test.py             # End-to-end check of a running stack (used in CI)
│   └── build_taxa_catalog.py     # Regenerates src/data/taxaCatalog.json
├── src/                          # React + TypeScript frontend
│   ├── components/               # Layout, auth, UI primitives
│   ├── data/                     # Taxa catalog (generated) + curated descriptions
│   ├── pages/                    # Routed pages
│   └── lib/, store/, types/      # API client, state, shared types
├── deploy/
│   ├── nginx.conf                # Frontend container web server
│   └── aws/                      # EC2 CloudFormation stack, Caddy HTTPS, compose override
├── docs/assets/                  # README GIFs and screenshots
├── .github/workflows/            # CI/CD, PR checks, model retraining
├── docker-compose.yml            # Full stack: frontend, API, PostgreSQL, Redis, MLflow
├── Dockerfile                    # API image (CPU PyTorch, non-root)
├── Dockerfile.frontend           # Multi-stage: Node build → nginx
└── README.md
```

</details>

---

## 🛠️ Tech stack

<div align="center">

| Layer | Tools |
|---|---|
| 🧠 ML | ![PyTorch](https://img.shields.io/badge/-PyTorch-EE4C2C?logo=pytorch&logoColor=white) ![NumPy](https://img.shields.io/badge/-NumPy-013243?logo=numpy&logoColor=white) ![Biopython](https://img.shields.io/badge/-Biopython-2E7D32) ![Optuna](https://img.shields.io/badge/-Optuna-2F4F8F) |
| 📦 MLOps | ![MLflow](https://img.shields.io/badge/-MLflow-0194E2?logo=mlflow&logoColor=white) ![Prometheus](https://img.shields.io/badge/-Prometheus-E6522C?logo=prometheus&logoColor=white) ![Redis](https://img.shields.io/badge/-Redis-DC382D?logo=redis&logoColor=white) |
| ⚡ Backend | ![FastAPI](https://img.shields.io/badge/-FastAPI-009688?logo=fastapi&logoColor=white) ![SQLAlchemy](https://img.shields.io/badge/-SQLAlchemy-D71F00?logo=sqlalchemy&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-4169E1?logo=postgresql&logoColor=white) ![JWT](https://img.shields.io/badge/-JWT-000000?logo=jsonwebtokens&logoColor=white) |
| 🎨 Frontend | ![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/-Vite-646CFF?logo=vite&logoColor=white) ![Tailwind](https://img.shields.io/badge/-Tailwind-06B6D4?logo=tailwindcss&logoColor=white) ![TanStack Query](https://img.shields.io/badge/-TanStack_Query-FF4154?logo=reactquery&logoColor=white) |
| 🚢 DevOps | ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/-GitHub_Actions-2088FF?logo=githubactions&logoColor=white) ![nginx](https://img.shields.io/badge/-nginx-009639?logo=nginx&logoColor=white) ![Caddy](https://img.shields.io/badge/-Caddy-1F88C0?logo=caddy&logoColor=white) |
| ☁️ Cloud | ![AWS EC2](https://img.shields.io/badge/-EC2-FF9900?logo=amazonec2&logoColor=white) ![CloudFormation](https://img.shields.io/badge/-CloudFormation-FF4F8B?logo=amazonwebservices&logoColor=white) ![SSM](https://img.shields.io/badge/-SSM-527FFF?logo=amazonwebservices&logoColor=white) ![Let's Encrypt](https://img.shields.io/badge/-Let's_Encrypt-003A70?logo=letsencrypt&logoColor=white) |

</div>

---

## 🗺️ Roadmap

- [x] 🧠 CNN + self-attention classifier with novelty flag
- [x] 📦 MLflow tracking, registry, aliases and approval gate
- [x] 🐳 Dockerized FastAPI serving `@champion` with hot reload
- [x] 🔄 GitHub Actions CI/CD with E2E and GHCR publishing
- [x] ☁️ AWS EC2 deployment with automatic HTTPS
- [x] 🐟 Interactive, data-driven Taxa Explorer
- [ ] 📉 Automated drift reports (Evidently AI) that trigger retraining
- [ ] 🚀 Continuous deployment to AWS via GitHub OIDC
- [ ] 🗄️ MLflow on PostgreSQL + S3 artifacts, RDS for the app database
- [ ] ⚖️ Real traffic splitting between two models for A/B tests
- [ ] 🧬 More taxa and hierarchical (species-level) prediction

---

## 🆘 Troubleshooting

<details>
<summary><b>🐳 The backend container won't start</b></summary>

`docker compose logs backend`. Common causes: MLflow not healthy yet (`MODEL_SOURCE=mlflow` fails fast; check `docker compose logs mlflow model-init`), the default `SECRET_KEY` in production, or port 8000 already in use.
</details>

<details>
<summary><b>🔑 Google says <code>redirect_uri_mismatch</code></b></summary>

Add `<BACKEND_PUBLIC_URL>/auth/oauth/google/callback` to the OAuth client's **Authorized redirect URIs** in Google Cloud Console. In "Testing" mode, add your account as a test user.
</details>

<details>
<summary><b>💾 High memory / slow first start</b></summary>

PyTorch + MLflow + PostgreSQL need about 2 GB. Give Docker Desktop 4 GB+. The first build downloads CPU-only PyTorch (the image stays ~0.6 GB).
</details>

<details>
<summary><b>🔄 The site still shows the old version after a deploy</b></summary>

Hard refresh (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>). `index.html` is served `no-cache` and assets are content-hashed, so a new build always loads.
</details>

---

## 🤝 Contributing

1. 🍴 Fork and create a branch: `git checkout -b feature/amazing-feature`
2. 🧪 Run the tests: `cd backend && python -m pytest tests` and `npm run build`
3. 📝 Use clear commit messages (`feat:`, `fix:`, `docs:` …)
4. 🔃 Open a pull request. CI runs automatically.

## 📄 License

Released under the **MIT License**.

<div align="center">

### 🌊 Built for faster, cheaper marine biodiversity monitoring

If this project helped you, consider giving it a ⭐

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:22D3EE,55:0E7490,100:06101F&height=120&section=footer" width="100%" alt=""/>

</div>
