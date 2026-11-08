"""
Export Formats for DeepSea eDNA API
Support for BIOM, JSON, CSV, and other export formats
"""
import json
import csv
import logging
from io import StringIO
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ExportManager:
    """
    Manage data export in multiple formats
    """
    
    @staticmethod
    def to_json(data: Any, pretty: bool = True) -> str:
        """Export to JSON"""
        indent = 2 if pretty else None
        return json.dumps(data, indent=indent, default=str)
    
    @staticmethod
    def to_csv(data: List[Dict[str, Any]], columns: List[str] = None) -> str:
        """Export to CSV"""
        if not data:
            return ""
        
        output = StringIO()
        
        # Auto-detect columns if not provided
        if columns is None:
            columns = list(data[0].keys())
        
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows(data)
        
        return output.getvalue()
    
    @staticmethod
    def to_biom(
        predictions: List[Dict[str, Any]],
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Export to BIOM format (Biological Observation Matrix)
        Format specification: http://biom-format.org/
        """
        # Build observation matrix
        observations = []
        observation_ids = []
        
        for i, pred in enumerate(predictions):
            obs_id = f"OTU_{i}"
            observation_ids.append(obs_id)
            observations.append({
                "id": obs_id,
                "metadata": {
                    "taxonomy": pred.get("taxon_name", "Unknown"),
                    "confidence": pred.get("confidence", 0.0),
                    "rank": pred.get("rank", "species")
                }
            })
        
        # BIOM format v2.1
        biom_data = {
            "id": "deepsea_edna_predictions",
            "format": "Biological Observation Matrix 1.0.0",
            "format_url": "http://biom-format.org",
            "type": "OTU table",
            "generated_by": "DeepSea eDNA API v2.0",
            "date": datetime.utcnow().isoformat(),
            "rows": observations,
            "columns": [
                {
                    "id": "Sample_1",
                    "metadata": metadata or {}
                }
            ],
            "matrix_type": "sparse",
            "matrix_element_type": "float",
            "shape": [len(observations), 1],
            "data": [[i, 0, pred.get("confidence", 1.0)] for i, pred in enumerate(predictions)]
        }
        
        return biom_data
    
    @staticmethod
    def to_fasta(sequences: List[Dict[str, Any]]) -> str:
        """Export to FASTA format"""
        output = []
        
        for i, seq_data in enumerate(sequences):
            seq_id = seq_data.get("id", f"seq_{i}")
            sequence = seq_data.get("sequence", "")
            taxon = seq_data.get("taxon_name", "Unknown")
            confidence = seq_data.get("confidence", 0.0)
            
            # FASTA header
            header = f">{seq_id} |taxon={taxon}|confidence={confidence:.4f}"
            output.append(header)
            
            # Sequence (wrapped at 80 characters)
            for j in range(0, len(sequence), 80):
                output.append(sequence[j:j+80])
        
        return "\n".join(output)
    
    @staticmethod
    def to_tsv(data: List[Dict[str, Any]], columns: List[str] = None) -> str:
        """Export to TSV (tab-separated values)"""
        if not data:
            return ""
        
        output = StringIO()
        
        if columns is None:
            columns = list(data[0].keys())
        
        writer = csv.DictWriter(output, fieldnames=columns, delimiter='\t')
        writer.writeheader()
        writer.writerows(data)
        
        return output.getvalue()
    
    @staticmethod
    def predictions_to_csv(predictions: List[Dict[str, Any]]) -> str:
        """Convert predictions to CSV format"""
        csv_data = []
        for pred in predictions:
            csv_data.append({
                "sequence": pred.get("sequence", ""),
                "predicted_class": pred.get("taxon_name", ""),
                "confidence": pred.get("confidence", 0.0),
                "rank": pred.get("rank", ""),
                "is_novel": pred.get("is_novel", False)
            })
        return ExportManager.to_csv(csv_data)
