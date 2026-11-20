"""Evaluate a labelled batch, fine-tune a candidate, and record a quality gate decision."""

from __future__ import annotations

import argparse
import copy
import csv
import json
import logging
import random
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.models.deep_learning import DeepTaxaClassifier, sequence_to_tensor
from app.services.model_loader import ModelLoader

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"sequence_id", "sequence", "label"}
VALID_BASES = set("ACGTN")


class SequenceDataset(Dataset):
    def __init__(self, sequences: list[str], labels: list[int], max_length: int):
        self.sequences = sequences
        self.labels = labels
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.sequences)

    def __getitem__(self, index: int):
        return (
            sequence_to_tensor(self.sequences[index], self.max_length),
            torch.tensor(self.labels[index], dtype=torch.long),
        )


def load_batch(path: Path, taxonomy: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    with path.open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError(f"{path} is empty")
    missing = REQUIRED_COLUMNS - set(rows[0])
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    ids = [row["sequence_id"].strip() for row in rows]
    if len(ids) != len(set(ids)):
        duplicates = [key for key, count in Counter(ids).items() if count > 1]
        raise ValueError(f"Duplicate sequence_id values: {duplicates}")

    known_labels = {info["name"] for info in taxonomy.values()}
    for row in rows:
        sequence = row["sequence"].strip().upper()
        if not sequence:
            raise ValueError(f"Missing sequence for {row['sequence_id']}")
        if set(sequence) - VALID_BASES:
            raise ValueError(f"Invalid DNA bases for {row['sequence_id']}")
        if not row["label"].strip():
            raise ValueError(f"Missing label for {row['sequence_id']}")
        if row["label"].strip() not in known_labels:
            raise ValueError(f"Unknown label {row['label']!r} for {row['sequence_id']}")
        row["sequence"] = sequence
        row["label"] = row["label"].strip()
    return rows


def metrics(y_true: list[int], y_pred: list[int]) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
    }


def predict(model: torch.nn.Module, sequences: list[str], max_length: int, device: str) -> list[int]:
    model.eval()
    predictions: list[int] = []
    with torch.no_grad():
        for start in range(0, len(sequences), 32):
            batch = torch.stack(
                [sequence_to_tensor(seq, max_length) for seq in sequences[start : start + 32]]
            ).to(device)
            predictions.extend(model(batch)[0].argmax(dim=1).cpu().tolist())
    return predictions


def read_training_subset(data_dir: Path, label_to_id: dict[str, int], per_class: int) -> tuple[list[str], list[int]]:
    sequences: list[str] = []
    labels: list[int] = []
    for class_dir in sorted(data_dir.glob("class_*")):
        class_id = int(class_dir.name.split("_")[1])
        files = sorted(class_dir.glob("*.fasta"))
        count = 0
        for fasta in files:
            lines = fasta.read_text().splitlines()
            current: list[str] = []
            for line in lines:
                if line.startswith(">"):
                    if current and count < per_class:
                        sequences.append("".join(current).upper())
                        labels.append(class_id)
                        count += 1
                    current = []
                else:
                    current.append(line.strip())
            if current and count < per_class:
                sequences.append("".join(current).upper())
                labels.append(class_id)
                count += 1
            if count >= per_class:
                break
    if not sequences:
        raise ValueError(f"No FASTA records found under {data_dir}")
    return sequences, labels


def train_candidate(
    champion: torch.nn.Module,
    sequences: list[str],
    labels: list[int],
    max_length: int,
    device: str,
    epochs: int,
    batch_size: int,
) -> torch.nn.Module:
    candidate = copy.deepcopy(champion).to(device)
    candidate.train()
    loader = DataLoader(SequenceDataset(sequences, labels, max_length), batch_size=batch_size, shuffle=True)
    optimizer = torch.optim.AdamW(candidate.parameters(), lr=1e-4, weight_decay=5e-4)
    criterion = torch.nn.CrossEntropyLoss()
    for epoch in range(epochs):
        total_loss = 0.0
        for batch, target in loader:
            optimizer.zero_grad()
            logits, _ = candidate(batch.to(device))
            loss = criterion(logits, target.to(device))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(candidate.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()
        logger.info("candidate epoch %d/%d loss=%.4f", epoch + 1, epochs, total_loss / len(loader))
    candidate.eval()
    return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--new-data", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "monitoring" / "latest")
    parser.add_argument("--training-data", type=Path, default=ROOT / "data" / "training" / "marine_diverse")
    parser.add_argument("--champion-dir", type=Path, default=ROOT / "ml_models" / "marine_model")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--per-class", type=int, default=20)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--mlflow-tracking-uri", default="", help="Optional MLflow tracking URI")
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    loader = ModelLoader()
    loader.load_from_files(
        args.champion_dir / "model_config.json",
        args.champion_dir / "taxonomy_map.json",
        args.champion_dir / "best_model.pth",
    )
    taxonomy = loader.taxonomy_map
    label_to_id = {info["name"]: int(class_id) for class_id, info in taxonomy.items()}
    rows = load_batch(args.new_data, taxonomy)
    logger.info("validated batch: %d rows; target distribution=%s", len(rows), dict(Counter(r["label"] for r in rows)))

    sequences = [row["sequence"] for row in rows]
    labels = [label_to_id[row["label"]] for row in rows]
    champion_model = loader.classifier.to(args.device)
    champion_reference = copy.deepcopy(champion_model).to(args.device)
    max_length = loader.model_config["max_sequence_length"]
    champion_predictions = predict(champion_model, sequences, max_length, args.device)
    champion_metrics = metrics(labels, champion_predictions)

    order = list(range(len(rows)))
    random.shuffle(order)
    split = max(1, int(len(order) * 0.8))
    train_indices, gate_indices = order[:split], order[split:]
    if not gate_indices:
        gate_indices = train_indices[-1:]
        train_indices = train_indices[:-1]

    old_sequences, old_labels = read_training_subset(args.training_data, label_to_id, args.per_class)
    old_order = list(range(len(old_sequences)))
    random.shuffle(old_order)
    old_split = max(1, int(len(old_order) * 0.8))
    old_train_indices, old_eval_indices = old_order[:old_split], old_order[old_split:]
    old_train_sequences = [old_sequences[i] for i in old_train_indices]
    old_train_labels = [old_labels[i] for i in old_train_indices]
    old_eval_sequences = [old_sequences[i] for i in old_eval_indices]
    old_eval_labels = [old_labels[i] for i in old_eval_indices]

    candidate_model = train_candidate(
        champion_reference,
        old_train_sequences + [sequences[i] for i in train_indices],
        old_train_labels + [labels[i] for i in train_indices],
        max_length,
        args.device,
        args.epochs,
        batch_size=32,
    )
    gate_labels = old_eval_labels + [labels[i] for i in gate_indices]
    gate_sequences = old_eval_sequences + [sequences[i] for i in gate_indices]
    gate_champion = metrics(gate_labels, predict(champion_model, gate_sequences, max_length, args.device))
    gate_candidate = metrics(gate_labels, predict(candidate_model, gate_sequences, max_length, args.device))

    gate_metric = "f1"
    eligible = gate_candidate[gate_metric] >= gate_champion[gate_metric]
    decision = {
        "metric": gate_metric,
        "candidate_score": gate_candidate[gate_metric],
        "champion_score": gate_champion[gate_metric],
        "eligible_for_promotion": eligible,
        "champion_overwritten": False,
        "reason": "candidate meets or exceeds champion on held-out labelled batch"
        if eligible
        else "candidate is below champion on held-out labelled batch; retain champion",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }

    candidate_dir = args.output_dir / "candidate_model"
    if candidate_dir.exists():
        shutil.rmtree(candidate_dir)
    candidate_dir.mkdir()
    checkpoint = torch.load(args.champion_dir / "best_model.pth", map_location=args.device)
    checkpoint["model_state_dict"] = candidate_model.state_dict()
    checkpoint["monitoring_quality_gate"] = decision
    torch.save(checkpoint, candidate_dir / "best_model.pth")
    shutil.copy2(args.champion_dir / "model_config.json", candidate_dir / "model_config.json")
    shutil.copy2(args.champion_dir / "taxonomy_map.json", candidate_dir / "taxonomy_map.json")

    report = {
        "workflow": "model_quality_monitoring_and_retraining",
        "new_data": str(args.new_data),
        "validated_rows": len(rows),
        "missing_values": 0,
        "duplicate_ids": 0,
        "target_distribution": dict(Counter(row["label"] for row in rows)),
        "existing_model_evaluation": champion_metrics,
        "quality_gate_holdout": {
            "rows": len(gate_sequences),
            "champion": gate_champion,
            "candidate": gate_candidate,
        },
        "combined_dataset_evaluation": {
            "rows": len(gate_sequences),
            "historical_rows": len(old_eval_sequences),
            "new_batch_rows": len(gate_indices),
            "champion": gate_champion,
            "candidate": gate_candidate,
            "note": "Metrics use a held-out split from the combined historical sample and new batch.",
        },
        "candidate_artifact": str(candidate_dir),
        "quality_gate_decision": decision,
        "mlflow": {"tracked": False, "reason": "No tracking URI supplied; local report is authoritative."},
    }
    (args.output_dir / "evaluation_report.json").write_text(json.dumps(report, indent=2))
    (args.output_dir / "quality_gate_decision.json").write_text(json.dumps(decision, indent=2))
    if args.mlflow_tracking_uri:
        import mlflow

        mlflow.set_tracking_uri(args.mlflow_tracking_uri)
        with mlflow.start_run(run_name=f"monitor-retrain-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}") as run:
            mlflow.set_tags({"workflow": "model_quality_monitoring_and_retraining", "dataset": args.new_data.name})
            mlflow.log_metrics(
                {
                    "champion_f1": gate_champion["f1"],
                    "candidate_f1": gate_candidate["f1"],
                    "candidate_eligible": float(eligible),
                }
            )
            mlflow.log_artifact(str(args.output_dir / "evaluation_report.json"), artifact_path="reports")
            mlflow.log_artifact(str(args.output_dir / "quality_gate_decision.json"), artifact_path="reports")
            mlflow.log_artifacts(str(candidate_dir), artifact_path="candidate_model")
            report["mlflow"] = {"tracked": True, "run_id": run.info.run_id}
        (args.output_dir / "evaluation_report.json").write_text(json.dumps(report, indent=2))
    logger.info("quality gate: %s", decision["reason"])
    logger.info("report: %s", args.output_dir / "evaluation_report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
