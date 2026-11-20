"""
Build src/data/taxaCatalog.json for the Taxa Explorer from the real training data and model.

    python scripts/build_taxa_catalog.py [--skip-metrics]

Per class: species/genus/marker-gene composition, sequence statistics and a representative
sequence (from the FASTA headers and sequences), plus the model's precision/recall/F1 on the
held-out validation split, reproduced exactly as backend/training/train_model.py makes it
(random_split of the dataset with 20% validation and torch.Generator().manual_seed(42)).
Run where the backend's dependencies are installed (e.g. inside the API image).
"""
import argparse
import json
import re
import statistics
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "training" / "marine_diverse"
OUT = ROOT / "src" / "data" / "taxaCatalog.json"

MARKERS = [  # first match wins
    ("Mitogenome", r"complete (mitochondrial )?genome|mitochondrion, complete"),
    ("COI", r"cytochrome c oxidase subunit (I|1)\b|\bCOI\b|\bCOX1\b|\bCO1\b"),
    ("Cytochrome b", r"cytochrome b\b|\bcytb\b"),
    ("16S rRNA", r"\b16S\b"),
    ("12S rRNA", r"\b12S\b"),
    ("18S/28S rRNA", r"\b(18S|28S)\b"),
    ("NADH dehydrogenase", r"NADH dehydrogenase|\bnad\d|\bND\d"),
    ("Control region", r"control region|D-loop"),
    ("Nuclear transcript", r"PREDICTED|mRNA"),
]
MARKER_RES = [(name, re.compile(rx, re.I)) for name, rx in MARKERS]
NOT_SPECIES = {"sp.", "cf.", "aff.", "nr.", "x"}


def read_fasta(path: Path):
    header, chunks = None, []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith(">"):
                if header is not None:
                    yield header, "".join(chunks)
                header, chunks = line[1:], []
            elif line:
                chunks.append(line)
    if header is not None:
        yield header, "".join(chunks)


def parse_header(header: str):
    """'NCBI_X.1 X.1 [PREDICTED:] Genus species ...' -> (source, accession, genus, species, marker)"""
    parts = header.split()
    source = parts[0].split("_", 1)[0] if "_" in parts[0] else "unknown"
    accession = parts[1] if len(parts) > 1 else parts[0]
    words = [w for w in parts[2:] if w != "PREDICTED:"]
    genus = words[0] if words and words[0][:1].isupper() else None
    species = None
    if genus and len(words) > 1 and words[1].islower() and words[1] not in NOT_SPECIES:
        species = f"{genus} {words[1]}"
    marker = next((name for name, rx in MARKER_RES if rx.search(header)), "Other")
    return source, accession, genus, species, marker


def gc_percent(seq: str) -> float:
    acgt = sum(seq.count(b) for b in "ACGT")
    return 100 * (seq.count("G") + seq.count("C")) / acgt if acgt else 0.0


def composition(class_dir: Path):
    sequences = list(read_fasta(class_dir / "sequences.fasta"))
    species, genera, markers, sources = Counter(), Counter(), Counter(), Counter()
    lengths, gcs, candidates = [], [], []
    for header, seq in sequences:
        seq = seq.upper()
        source, accession, genus, sp, marker = parse_header(header)
        sources[source] += 1
        markers[marker] += 1
        if genus:
            genera[genus] += 1
        if sp:
            species[sp] += 1
        lengths.append(len(seq))
        gcs.append(gc_percent(seq))
        if sp and marker == "COI" and 300 <= len(seq) <= 700 and "N" not in seq:
            candidates.append((sp, accession, seq))

    top_species = [s for s, _ in species.most_common(1)]
    example = next((c for c in candidates if c[0] in top_species), candidates[0] if candidates else None)
    total = len(sequences)
    return [seq for _, seq in sequences], {
        "trainingCount": total,
        "speciesCount": len(species),
        "genusCount": len(genera),
        "topSpecies": [{"name": s, "count": n} for s, n in species.most_common(12)],
        "markers": [{"name": m, "count": n} for m, n in markers.most_common()],
        "sources": dict(sources.most_common()),
        "length": {
            "min": min(lengths), "median": int(statistics.median(lengths)),
            "mean": round(statistics.mean(lengths)), "max": max(lengths),
        },
        "gcPercent": round(statistics.mean(gcs), 1),
        "example": {"species": example[0], "accession": example[1], "marker": "COI", "sequence": example[2]}
        if example else None,
    }


def validation_metrics(all_sequences, all_labels, taxonomy, batch_size):
    """Model metrics on the exact validation split train_model.py held out"""
    sys.path.insert(0, str(ROOT / "backend"))
    import torch
    from torch.utils.data import random_split
    from app.services.model_loader import ModelLoader

    val_size = int(len(all_sequences) * 0.2)
    _, val_split = random_split(
        range(len(all_sequences)), [len(all_sequences) - val_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )
    indices = list(val_split.indices)

    loader = ModelLoader()
    model_dir = ROOT / "ml_models" / "marine_model"
    loader.load_from_files(model_dir / "model_config.json", model_dir / "taxonomy_map.json", model_dir / "best_model.pth")
    name_to_id = {v["name"]: int(k) for k, v in loader.taxonomy_map.items()}

    preds = []
    for start in range(0, len(indices), batch_size):
        batch = [all_sequences[i] for i in indices[start:start + batch_size]]
        preds.extend(name_to_id[p["taxon_name"]] for p in loader.predict(batch, batch_size=batch_size))
        print(f"  validated {min(start + batch_size, len(indices))}/{len(indices)}", end="\r", flush=True)
    print()
    truth = [all_labels[i] for i in indices]

    n = len(taxonomy)
    matrix = [[0] * n for _ in range(n)]
    for t, p in zip(truth, preds):
        matrix[t][p] += 1
    per_class = {}
    for c in range(n):
        tp = matrix[c][c]
        support = sum(matrix[c])
        predicted = sum(matrix[r][c] for r in range(n))
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        confused = sorted(((matrix[c][o], o) for o in range(n) if o != c and matrix[c][o]), reverse=True)[:3]
        per_class[c] = {
            "support": support, "precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4),
            "confusedWith": [{"name": taxonomy[str(o)]["name"], "count": k} for k, o in confused],
        }
    accuracy = sum(matrix[c][c] for c in range(n)) / len(truth)
    return per_class, {"accuracy": round(accuracy, 4), "samples": len(truth), "split": "20% held out, seed 42"}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-metrics", action="store_true", help="composition only (no model needed)")
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    taxonomy = json.loads((ROOT / "ml_models" / "marine_model" / "taxonomy_map.json").read_text())
    classes, all_sequences, all_labels = [], [], []
    for class_dir in sorted(DATA_DIR.iterdir()):  # same order as train_model.load_training_data
        if not class_dir.is_dir() or not class_dir.name.startswith("class_"):
            continue
        class_id = int(class_dir.name.split("_")[1])
        sequences, stats = composition(class_dir)
        all_sequences.extend(sequences)
        all_labels.extend([class_id] * len(sequences))
        info = taxonomy[str(class_id)]
        classes.append({"classId": class_id, "name": info["name"], "rank": info["rank"], "lineage": info["lineage"], **stats})
        print(f"class {class_id} {info['name']}: {stats['trainingCount']} seqs, {stats['speciesCount']} species")

    model = None
    if not args.skip_metrics:
        print("Evaluating the model on the validation split...")
        per_class, model = validation_metrics(all_sequences, all_labels, taxonomy, args.batch_size)
        for c in classes:
            c["validation"] = per_class[c["classId"]]
        print(f"validation accuracy: {model['accuracy']:.4f} on {model['samples']} sequences")

    OUT.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": DATA_DIR.name,
        "totalSequences": len(all_sequences),
        "validation": model,
        "classes": classes,
    }, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
