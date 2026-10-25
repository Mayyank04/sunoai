from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel, Field

T = TypeVar("T")

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number, 1-indexed")
    page_size: int = Field(20, ge=1, le=100, description="Items per page (max 100)")
    sort_by: Optional[str] = Field("created_at", description="Field to sort results by")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$", description="Sort direction")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int = Field(..., description="Total count of matching records")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Current items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether a next page exists")
    has_prev: bool = Field(..., description="Whether a previous page exists")

class ErrorDetail(BaseModel):
    code: str
    message: str
    field: Optional[str] = None

class StandardResponse(BaseModel):
    success: bool = True
    message: str = "Operation completed successfully"
