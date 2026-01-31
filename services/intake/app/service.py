from shared.base_service import BaseService
from shared.session_context import KycSessionContext
from services.intake.domain.upload_handler import IntakeHandler

class IntakeService(BaseService):
    def __init__(self):
        super().__init__("IntakeService")
        self.handler = IntakeHandler()

    def execute(self, context: KycSessionContext) -> KycSessionContext:
        """
        Implementation of the Intake layer.
        """
        # In a real microservice, this would handle a request payload.
        # For the scaffold, we assume context already has initial raw fields if any.
        return self.handler.process_submission(context, {
            "documents": context.raw_inputs["documents"],
            "fields": context.raw_inputs["fields"]
        })
