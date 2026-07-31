from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Nyaya AI", description="Legal Prediction and Dispute AI Service")

@app.get("/health")
def health():
    return {"status": "healthy", "service": "nyaya-ai"}

@app.post("/predict")
def predict_outcome(case_data: dict):
    # Mock response for the demo
    return {
        "confidence": 0.85,
        "predicted_outcome": "Favorable",
        "reasoning": "Based on similar past precedents in the Supreme Court, the likelihood of a favorable ruling is high.",
        "similar_cases": ["SC/2021/045", "SC/2019/112"]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8012)
