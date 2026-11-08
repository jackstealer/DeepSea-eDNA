"""
File processing utilities for FASTA, FASTQ, and CSV files
"""
from typing import List, Dict, Tuple
from pathlib import Path
import csv
import io
from Bio import SeqIO
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord


class FileProcessor:
    """
    Process various file formats for DNA sequences
    """
    
    SUPPORTED_FORMATS = ['.fasta', '.fa', '.fna', '.fastq', '.fq', '.csv', '.txt']
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
    MAX_SEQUENCES = 10000  # Maximum sequences per file
    
    @staticmethod
    def validate_file(filename: str, file_size: int) -> Tuple[bool, str]:
        """
        Validate uploaded file
        Returns: (is_valid, error_message)
        """
        # Check file size
        if file_size > FileProcessor.MAX_FILE_SIZE:
            return False, f"File too large. Maximum size: {FileProcessor.MAX_FILE_SIZE / (1024*1024)} MB"
        
        # Check file extension
        file_ext = Path(filename).suffix.lower()
        if file_ext not in FileProcessor.SUPPORTED_FORMATS:
            return False, f"Unsupported format. Supported: {', '.join(FileProcessor.SUPPORTED_FORMATS)}"
        
        return True, ""
    
    @staticmethod
    def parse_fasta(content: str) -> List[Dict]:
        """
        Parse FASTA format file
        Returns list of {id, description, sequence}
        """
        sequences = []
        
        try:
            # Parse FASTA using BioPython
            fasta_io = io.StringIO(content)
            for record in SeqIO.parse(fasta_io, "fasta"):
                sequences.append({
                    "id": record.id,
                    "description": record.description,
                    "sequence": str(record.seq).upper()
                })
                
                if len(sequences) >= FileProcessor.MAX_SEQUENCES:
                    break
                    
        except Exception as e:
            raise ValueError(f"Failed to parse FASTA file: {str(e)}")
        
        return sequences
    
    @staticmethod
    def parse_fastq(content: str) -> List[Dict]:
        """
        Parse FASTQ format file (includes quality scores)
        Returns list of {id, description, sequence, quality}
        """
        sequences = []
        
        try:
            fastq_io = io.StringIO(content)
            for record in SeqIO.parse(fastq_io, "fastq"):
                sequences.append({
                    "id": record.id,
                    "description": record.description,
                    "sequence": str(record.seq).upper(),
                    "quality": record.letter_annotations.get("phred_quality", [])
                })
                
                if len(sequences) >= FileProcessor.MAX_SEQUENCES:
                    break
                    
        except Exception as e:
            raise ValueError(f"Failed to parse FASTQ file: {str(e)}")
        
        return sequences
    
    @staticmethod
    def parse_csv(content: str) -> List[Dict]:
        """
        Parse CSV format file
        Expected columns: id, sequence (optional: description)
        """
        sequences = []
        
        try:
            csv_io = io.StringIO(content)
            reader = csv.DictReader(csv_io)
            
            # Validate columns
            if not reader.fieldnames:
                raise ValueError("CSV file is empty")
            
            required_cols = ['sequence']
            if not any(col.lower() in ['sequence', 'seq', 'dna'] for col in reader.fieldnames):
                raise ValueError("CSV must have 'sequence' column")
            
            # Find sequence column (case insensitive)
            seq_col = None
            for col in reader.fieldnames:
                if col.lower() in ['sequence', 'seq', 'dna']:
                    seq_col = col
                    break
            
            # Find ID column (optional)
            id_col = None
            for col in reader.fieldnames:
                if col.lower() in ['id', 'name', 'sequence_id']:
                    id_col = col
                    break
            
            # Parse rows
            for i, row in enumerate(reader):
                sequence = row.get(seq_col, "").strip()
                if not sequence:
                    continue
                
                sequences.append({
                    "id": row.get(id_col, f"seq_{i+1}") if id_col else f"seq_{i+1}",
                    "description": "",
                    "sequence": sequence.upper()
                })
                
                if len(sequences) >= FileProcessor.MAX_SEQUENCES:
                    break
                    
        except Exception as e:
            raise ValueError(f"Failed to parse CSV file: {str(e)}")
        
        return sequences
    
    @staticmethod
    def parse_file(filename: str, content: str) -> List[Dict]:
        """
        Auto-detect format and parse file
        Returns list of {id, description, sequence}
        """
        file_ext = Path(filename).suffix.lower()
        
        if file_ext in ['.fasta', '.fa', '.fna']:
            return FileProcessor.parse_fasta(content)
        elif file_ext in ['.fastq', '.fq']:
            return FileProcessor.parse_fastq(content)
        elif file_ext in ['.csv']:
            return FileProcessor.parse_csv(content)
        elif file_ext in ['.txt']:
            # Try FASTA first, then CSV
            try:
                return FileProcessor.parse_fasta(content)
            except:
                try:
                    return FileProcessor.parse_csv(content)
                except:
                    raise ValueError("Could not parse .txt file as FASTA or CSV")
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")
    
    @staticmethod
    def validate_sequence(sequence: str, min_length: int = 50, max_length: int = 1500) -> Tuple[bool, str]:
        """
        Validate DNA sequence
        Returns: (is_valid, error_message)
        """
        if len(sequence) < min_length:
            return False, f"Sequence too short (min: {min_length} bp)"
        
        if len(sequence) > max_length:
            return False, f"Sequence too long (max: {max_length} bp)"
        
        valid_bases = set("ACGTN")
        invalid_bases = set(sequence.upper()) - valid_bases
        if invalid_bases:
            return False, f"Invalid bases: {', '.join(sorted(invalid_bases))}"
        
        return True, ""
    
    @staticmethod
    def filter_sequences(sequences: List[Dict], min_length: int = 50, max_length: int = 1500) -> Tuple[List[Dict], List[Dict]]:
        """
        Filter valid sequences and return (valid, invalid) lists
        """
        valid = []
        invalid = []
        
        for seq_data in sequences:
            sequence = seq_data["sequence"]
            is_valid, error = FileProcessor.validate_sequence(sequence, min_length, max_length)
            
            if is_valid:
                valid.append(seq_data)
            else:
                seq_data["error"] = error
                invalid.append(seq_data)
        
        return valid, invalid
    
    @staticmethod
    def create_fasta_output(results: List[Dict]) -> str:
        """
        Create FASTA format output from prediction results
        """
        fasta_lines = []
        
        for result in results:
            # Header: >seq_id | class_name | confidence
            header = f">{result['id']} | {result['class_name']} | conf={result['confidence']:.4f}"
            fasta_lines.append(header)
            
            # Sequence (wrap at 80 characters)
            sequence = result['sequence']
            for i in range(0, len(sequence), 80):
                fasta_lines.append(sequence[i:i+80])
        
        return "\n".join(fasta_lines)
    
    @staticmethod
    def create_csv_output(results: List[Dict]) -> str:
        """
        Create CSV format output from prediction results
        """
        output = io.StringIO()
        
        fieldnames = ['id', 'sequence', 'class_id', 'class_name', 'common_name', 
                      'confidence', 'sequence_length', 'processing_time_ms']
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for result in results:
            writer.writerow({
                'id': result.get('id', ''),
                'sequence': result.get('sequence', ''),
                'class_id': result.get('class_id', ''),
                'class_name': result.get('class_name', ''),
                'common_name': result.get('common_name', ''),
                'confidence': result.get('confidence', 0),
                'sequence_length': len(result.get('sequence', '')),
                'processing_time_ms': result.get('processing_time_ms', 0)
            })
        
        return output.getvalue()
