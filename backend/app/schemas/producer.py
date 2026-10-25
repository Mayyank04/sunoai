from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class PlannedOperation(BaseModel):
    op_id: str
    operation_type: str = Field(description="'addTrack', 'moveClip', 'changeGain', 'addEffect', 'generateStem', 'replaceSection', 'splitClip', 'duplicateClip', 'deleteClip', 'deleteTrack'")
    parameters: Dict[str, Any]
    description: str
    is_destructive: bool = False
    requires_confirmation: bool = False
    undo_available: bool = True

class AiProducerChatRequest(BaseModel):
    message: str = Field(min_length=1, description="Natural language producer prompt")
    project_state: Dict[str, Any] = Field(description="Active multitrack session state")
    persona_id: Optional[str] = None
    chat_history: Optional[List[Dict[str, str]]] = None

class AiProducerChatResponse(BaseModel):
    assistant_message: str
    musical_reasoning: str
    planned_operations: List[PlannedOperation] = Field(default_factory=list)
    persona_used: Optional[str] = None
    confidence_score: float = 0.95
