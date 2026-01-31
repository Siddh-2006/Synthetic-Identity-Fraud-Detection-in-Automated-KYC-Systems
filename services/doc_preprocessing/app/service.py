import requests
import os
from shared.base_service import BaseService
from shared.session_context import KycSessionContext

class PreprocessService(BaseService):
    def __init__(self, endpoint="http://localhost:8001/preprocess"):
        super().__init__("PreprocessService")
        self.endpoint = endpoint

    def execute(self, context: KycSessionContext) -> KycSessionContext:
        """
        Calls the Document Preprocessing microservice for each raw document.
        """
        cleaned_docs = []
        scores = []
        
        for doc_path in context.raw_inputs.get("documents", []):
            if not os.path.exists(doc_path):
                print(f"[PreprocessService] Warning: File {doc_path} not found.")
                continue
                
            try:
                with open(doc_path, 'rb') as f:
                    files = {'file': f}
                    response = requests.post(self.endpoint, files=files)
                    
                if response.status_code == 200:
                    # Save the cleaned image to a temporary path or artifact store
                    # For scaffolding, we'll save it next to the original with a prefix
                    base, ext = os.path.splitext(doc_path)
                    cleaned_path = f"{base}_cleaned.png"
                    
                    with open(cleaned_path, 'wb') as out:
                        out.write(response.content)
                        
                    cleaned_docs.append(cleaned_path)
                    status = response.headers.get("X-Processing-Status", "UNKNOWN")
                    scores.append(1.0 if status == "SUCCESS" else 0.5)
                    print(f"[PreprocessService] Processed {doc_path} -> {cleaned_path} ({status})")
                else:
                    print(f"[PreprocessService] Error: Service returned {response.status_code}")
                    
            except Exception as e:
                print(f"[PreprocessService] Exception during processing: {str(e)}")
        
        context.processed_artifacts["cleaned_documents"] = cleaned_docs
        context.processed_artifacts["preprocessing_scores"] = scores
        
        return context
