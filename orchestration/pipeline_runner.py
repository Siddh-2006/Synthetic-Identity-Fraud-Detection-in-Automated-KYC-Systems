from shared.session_context import KycSessionContext
from shared.logging import get_logger

logger = get_logger("Orchestrator")

class PipelineRunner:
    def __init__(self, services: list):
        self.services = services

    def run(self, context: KycSessionContext) -> KycSessionContext:
        logger.info(f"Starting pipeline for session: {context.session_id}")
        
        for service in self.services:
            try:
                logger.info(f"Executing layer: {service.service_name}")
                service.log_start(context)
                context = service.execute(context)
                service.log_success(context)
            except Exception as e:
                logger.error(f"Error in layer {service.service_name}: {str(e)}")
                service.log_failure(context, str(e))
                # Depending on logic, we might break or continue
                # For this pipeline, we continue as decisions rely on multi-layer signals
                continue
        
        context.finalize()
        logger.info(f"Pipeline finished for session: {context.session_id}")
        return context
