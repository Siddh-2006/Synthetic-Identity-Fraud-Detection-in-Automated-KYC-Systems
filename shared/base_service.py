from abc import ABC, abstractmethod
from shared.session_context import KycSessionContext

class BaseService(ABC):
    def __init__(self, service_name: str):
        self.service_name = service_name

    @abstractmethod
    def execute(self, context: KycSessionContext) -> KycSessionContext:
        """
        Executes the service logic on the provided context.
        Each service must implement this method.
        """
        pass

    def log_start(self, context: KycSessionContext):
        context.update_layer_status(self.service_name, "IN_PROGRESS")

    def log_success(self, context: KycSessionContext):
        context.update_layer_status(self.service_name, "COMPLETED")

    def log_failure(self, context: KycSessionContext, error: str):
        context.update_layer_status(self.service_name, "FAILED", error=error)
