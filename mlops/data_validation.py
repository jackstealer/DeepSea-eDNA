"""
Data Validation System for DeepSea eDNA API
Input validation, sequence quality checks, and data sanitization
"""
import re
import logging
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, validator

logger = logging.getLogger(__name__)


class SequenceFormat(str, Enum):
    """Supported sequence formats"""
    DNA = "dna"
    RNA = "rna"
    PROTEIN = "protein"


class ValidationLevel(str, Enum):
    """Validation strictness levels"""
    STRICT = "strict"
    MODERATE = "moderate"
    LENIENT = "lenient"


class ValidationResult(BaseModel):
    """Validation result"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    cleaned_sequence: Optional[str] = None
    quality_score: float = 0.0
    metadata: Dict[str, Any] = {}


class DataValidator:
    """
    Comprehensive data validation system
    """
    
    # Valid nucleotides
    DNA_NUCLEOTIDES = set("ATCG")
    DNA_AMBIGUOUS = set("ATCGRYMKSWHBVDN")  # IUPAC codes
    RNA_NUCLEOTIDES = set("AUCG")
    AMINO_ACIDS = set("ACDEFGHIKLMNPQRSTVWY")
    
    # Validation rules
    MIN_SEQUENCE_LENGTH = 10
    MAX_SEQUENCE_LENGTH = 10000
    MAX_N_PERCENT = 0.1  # 10% Ns allowed
    
    def __init__(self, level: ValidationLevel = ValidationLevel.MODERATE):
        self.level = level
        logger.info(f"DataValidator initialized with level: {level}")
    
    def validate_sequence(
        self,
        sequence: str,
        format: SequenceFormat = SequenceFormat.DNA
    ) -> ValidationResult:
        """
        Validate a DNA/RNA/Protein sequence
        
        Args:
            sequence: The sequence to validate
            format: Expected format (DNA, RNA, or PROTEIN)
        
        Returns:
            ValidationResult with validation status
        """
        result = ValidationResult(valid=True)
        
        if not sequence:
            result.valid = False
            result.errors.append("Empty sequence")
            return result
        
        # Convert to uppercase
        sequence = sequence.upper().strip()
        
        # Length validation
        if len(sequence) < self.MIN_SEQUENCE_LENGTH:
            result.valid = False
            result.errors.append(f"Sequence too short (min {self.MIN_SEQUENCE_LENGTH})")
        
        if len(sequence) > self.MAX_SEQUENCE_LENGTH:
            result.valid = False
            result.errors.append(f"Sequence too long (max {self.MAX_SEQUENCE_LENGTH})")
        
        # Format-specific validation
        if format == SequenceFormat.DNA:
            result = self._validate_dna(sequence, result)
        elif format == SequenceFormat.RNA:
            result = self._validate_rna(sequence, result)
        elif format == SequenceFormat.PROTEIN:
            result = self._validate_protein(sequence, result)
        
        # Calculate quality score
        result.quality_score = self._calculate_quality_score(sequence, result)
        
        # Store metadata
        result.metadata = {
            "length": len(sequence),
            "format": format.value,
            "validation_level": self.level.value
        }
        
        return result
    
    def _validate_dna(self, sequence: str, result: ValidationResult) -> ValidationResult:
        """Validate DNA sequence"""
        # Check for invalid characters
        valid_chars = self.DNA_AMBIGUOUS if self.level != ValidationLevel.STRICT else self.DNA_NUCLEOTIDES
        invalid_chars = set(sequence) - valid_chars
        
        if invalid_chars:
            if self.level == ValidationLevel.STRICT:
                result.valid = False
                result.errors.append(f"Invalid DNA characters: {invalid_chars}")
            else:
                result.warnings.append(f"Ambiguous characters found: {invalid_chars}")
        
        # Check N content
        n_count = sequence.count('N')
        n_percent = n_count / len(sequence) if len(sequence) > 0 else 0
        
        if n_percent > self.MAX_N_PERCENT:
            if self.level == ValidationLevel.STRICT:
                result.valid = False
                result.errors.append(f"Too many N's: {n_percent:.1%} (max {self.MAX_N_PERCENT:.1%})")
            else:
                result.warnings.append(f"High N content: {n_percent:.1%}")
        
        # GC content check
        gc_count = sequence.count('G') + sequence.count('C')
        gc_content = gc_count / len(sequence) if len(sequence) > 0 else 0
        
        if gc_content < 0.3 or gc_content > 0.7:
            result.warnings.append(f"Unusual GC content: {gc_content:.1%}")
        
        # Clean sequence
        if self.level != ValidationLevel.STRICT:
            cleaned = ''.join(c for c in sequence if c in self.DNA_NUCLEOTIDES)
            result.cleaned_sequence = cleaned
        else:
            result.cleaned_sequence = sequence
        
        return result
    
    def _validate_rna(self, sequence: str, result: ValidationResult) -> ValidationResult:
        """Validate RNA sequence"""
        valid_chars = self.RNA_NUCLEOTIDES
        invalid_chars = set(sequence) - valid_chars
        
        if invalid_chars:
            result.valid = False
            result.errors.append(f"Invalid RNA characters: {invalid_chars}")
        
        result.cleaned_sequence = sequence
        return result
    
    def _validate_protein(self, sequence: str, result: ValidationResult) -> ValidationResult:
        """Validate protein sequence"""
        valid_chars = self.AMINO_ACIDS
        invalid_chars = set(sequence) - valid_chars - {'X', '*'}  # X=unknown, *=stop
        
        if invalid_chars:
            result.valid = False
            result.errors.append(f"Invalid amino acid characters: {invalid_chars}")
        
        result.cleaned_sequence = sequence
        return result
    
    def _calculate_quality_score(self, sequence: str, result: ValidationResult) -> float:
        """Calculate overall quality score (0-1)"""
        score = 1.0
        
        # Penalize for errors
        score -= len(result.errors) * 0.2
        
        # Penalize for warnings
        score -= len(result.warnings) * 0.1
        
        # Penalize for N content
        n_percent = sequence.count('N') / len(sequence) if len(sequence) > 0 else 0
        score -= n_percent * 0.3
        
        return max(0.0, min(1.0, score))
    
    def validate_batch(
        self,
        sequences: List[str],
        format: SequenceFormat = SequenceFormat.DNA
    ) -> List[ValidationResult]:
        """Validate multiple sequences"""
        return [self.validate_sequence(seq, format) for seq in sequences]
    
    def sanitize_input(self, text: str) -> str:
        """Sanitize user input"""
        # Remove control characters
        text = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', text)
        # Limit length
        text = text[:10000]
        return text.strip()


class FileValidator:
    """Validate uploaded files"""
    
    ALLOWED_EXTENSIONS = {'.fasta', '.fa', '.fastq', '.fq', '.csv', '.tsv'}
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    @staticmethod
    def validate_file(filename: str, size: int) -> ValidationResult:
        """Validate file upload"""
        result = ValidationResult(valid=True)
        
        # Check extension
        ext = filename[filename.rfind('.'):].lower() if '.' in filename else ''
        if ext not in FileValidator.ALLOWED_EXTENSIONS:
            result.valid = False
            result.errors.append(f"Invalid file type: {ext}. Allowed: {FileValidator.ALLOWED_EXTENSIONS}")
        
        # Check size
        if size > FileValidator.MAX_FILE_SIZE:
            result.valid = False
            result.errors.append(f"File too large: {size/1024/1024:.1f}MB (max {FileValidator.MAX_FILE_SIZE/1024/1024}MB)")
        
        result.metadata = {
            "filename": filename,
            "size_bytes": size,
            "extension": ext
        }
        
        return result
