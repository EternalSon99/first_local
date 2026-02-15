from datetime import datetime

from pydantic import BaseModel

from app.models.document import FileType


class DocumentResponse(BaseModel):
    id: str
    course_id: str
    file_name: str
    file_type: FileType
    uploaded_at: datetime
    chunk_count: int = 0

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    id: str
    file_name: str
    file_type: FileType
    chunks_created: int
    message: str
