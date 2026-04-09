from typing import Any, Dict, List
from pydantic import BaseModel


class ComparisonResult(BaseModel):
    changed: bool
    original_length: int
    converted_length: int
    original_line_count: int
    converted_line_count: int
    similarity_ratio: float
    diff: List[str]
    diff_count: int


class ConversionResponse(BaseModel):
    original: str
    converted: str
    comparison: ComparisonResult
    source_language: str | None = None
    target_language: str | None = None
    meta: Dict[str, Any] | None = None
    source_pipeline: Dict[str, Any] | None = None
    converted_pipeline: Dict[str, Any] | None = None
    migration_program: Dict[str, Any] | None = None


class UploadResponse(BaseModel):
    filename: str
    size: int


class HistoryEntry(BaseModel):
    id: str
    timestamp: str
    filename: str
    summary: str
    original_length: int
    converted_length: int
    similarity_ratio: float
    diff_count: int
    original_preview: str
    converted_preview: str
