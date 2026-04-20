from fastapi import FastAPI
#from app.database import engine

app = FastAPI(
    title="KAYY Drive - IA Service",
    description="Microservice d'Intelligence Artificielle pour KAYY Drive",
    version="1.0.0"
)

@app.get("/")
def root():
    return {"message": "IA Service opérationnel", "status": "ok"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}