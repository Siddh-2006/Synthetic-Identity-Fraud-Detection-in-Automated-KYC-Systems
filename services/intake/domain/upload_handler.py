from shared.session_context import KycSessionContext
from shared.validators import validate_id_format

class IntakeHandler:
    def process_submission(self, context: KycSessionContext, payload: dict):
        """
        Handles the raw submission data.
        """
        # Scaffolding: Validate minimum requirements
        if not payload.get("documents"):
            raise ValueError("No documents provided")
            
        context.raw_inputs["documents"] = payload["documents"]
        context.raw_inputs["fields"] = payload.get("fields", {})
        context.intake_metadata["timestamps"]["submission"] = context.processing_timestamps["start"]
        
        return context
