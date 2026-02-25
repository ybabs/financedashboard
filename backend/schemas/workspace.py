from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceListCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkspaceListItemCreateRequest(BaseModel):
    company_number: str = Field(min_length=1, max_length=20)


class WorkspaceListResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime


class WorkspaceListItemResponse(BaseModel):
    list_id: int
    company_number: str
    added_at: datetime


class WorkspaceListCollectionResponse(BaseModel):
    items: list[WorkspaceListResponse] = Field(default_factory=list)


class WorkspaceListItemCollectionResponse(BaseModel):
    items: list[WorkspaceListItemResponse] = Field(default_factory=list)

