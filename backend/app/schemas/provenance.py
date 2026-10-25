from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class SourceAssetDeclaration(BaseModel):
    asset_id: str
    asset_name: Optional[str] = None
    clearance_type: str = "original_composition"  # 'original_composition', 'cc0_public_domain', 'commercially_licensed', 'non_commercial', 'unspecified'
    rights_holder_name: Optional[str] = None
    attestation_statement: str
    commercial_cleared: bool = True

class RightsDeclarationRequest(BaseModel):
    asset_id: str
    clearance_type: str  # 'original_composition', 'cc0_public_domain', 'commercially_licensed', 'non_commercial'
    rights_holder_name: str
    attestation_statement: str
    commercial_allowed: bool = True

class EditHistoryItem(BaseModel):
    operation: str
    timestamp: datetime
    parameters: Optional[Dict[str, Any]] = None
    output_sha256: Optional[str] = None

class VerifiedRightsProvenanceRecord(BaseModel):
    id: str
    track_id: str
    creator_id: str
    model_provider: str
    model_version: str
    model_checkpoint_hash: Optional[str] = None
    generation_seed: int
    generation_timestamp: datetime
    input_prompt_hash: str
    output_audio_sha256: str
    c2pa_manifest: Dict[str, Any]
    c2pa_manifest_hash: Optional[str] = None
    license_type: str
    license_version: str
    commercial_use_eligibility: str  # 'eligible', 'ineligible', 'restricted'
    commercial_eligibility_reasons: List[str] = []
    user_supplied_assets: Optional[List[Dict[str, Any]]] = None
    source_asset_rights_declarations: Optional[Dict[str, Any]] = None
    prompt_reference: Optional[Dict[str, Any]] = None
    edit_history: Optional[List[Dict[str, Any]]] = None
    legal_disclaimer: str
    verified_at: datetime

    class Config:
        from_attributes = True

class ProvenanceCertificateResponse(BaseModel):
    certificate_id: str
    track_id: str
    issued_at: datetime
    registry_record: VerifiedRightsProvenanceRecord
    sha256_digest: str
    verification_url: str
    statutory_disclaimer: str
