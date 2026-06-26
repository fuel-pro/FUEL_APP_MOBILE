"""
FuelPro AI Financial Assistant - RAG API
Uses LangChain + ChromaDB + Groq for intelligent financial analysis
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import datetime

# LangChain imports
from langchain_community.document_loaders import TextLoader, CSVLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.chains import ConversationalRetrievalChain
from langchain_community.llms import OpenAI

# Groq import (free, fast LLM)
from groq import Groq

# Initialize FastAPI
app = FastAPI(title="FuelPro AI Assistant", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

# System prompt for The Publican Energy fuel station context
SYSTEM_PROMPT = """You are a helpful AI financial assistant for The Publican Energy fuel station in Lodwar, Turkana County, Kenya.

You help analyze:
- Fuel sales (Super, Diesel, Kerosene)
- Other services: Desert Fitness Club, Desert Trims (salon/spa), Lodwar Lodge
- Expenses: salaries, utilities, maintenance, supplies
- M-PESA payment confirmations

Key context:
- Location: Lodwar, Turkana County, Kenya
- Business: Fuel station with ancillary services
- Currency: Kenyan Shilling (KES)
- Payment: Cash and M-PESA mobile money

Always be helpful, accurate, and context-aware. If you don't have specific data, say so."""

# Data models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    station_id: Optional[str] = None

class DataIngestRequest(BaseModel):
    data_type: str  # 'sales', 'expenses', 'inventory', 'employees'
    records: List[dict]

class QueryRequest(BaseModel):
    query: str
    data_type: Optional[str] = None

# In-memory storage (use ChromaDB for production)
chat_history = []
stored_data = {
    "sales": [],
    "expenses": [],
    "inventory": [],
    "employees": []
}

# Groq chat completion
def chat_with_groq(messages: List[dict]) -> str:
    try:
        response = groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",  # Free, fast model
            messages=messages,
            temperature=0.7,
            max_tokens=1024
        )
        return response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API error: {str(e)}")

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "FuelPro AI Assistant",
        "version": "1.0.0",
        "model": "Groq Mixtral-8x7B"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "groq_configured": bool(os.getenv("GROQ_API_KEY"))
    }

@app.post("/chat")
async def chat(request: ChatRequest):
    """Main chat endpoint for financial queries"""
    
    # Build conversation context
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    
    # Add relevant data context
    if request.station_id:
        context = f"\n\nRelevant station data:\n"
        for data_type, records in stored_data.items():
            if records:
                context += f"\n{data_type.upper()}: {len(records)} records"
                if len(records) <= 5:
                    context += f"\n{records}"
        messages.append({"role": "system", "content": context})
    
    # Add chat history
    for msg in chat_history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Add current message
    messages.append({"role": "user", "content": request.message})
    
    # Get response
    response = chat_with_groq(messages)
    
    # Save to history
    chat_history.append({"role": "user", "content": request.message})
    chat_history.append({"role": "assistant", "content": response})
    
    return {
        "response": response,
        "history": chat_history[-10:]
    }

@app.post("/ingest")
async def ingest_data(request: DataIngestRequest):
    """Ingest financial data for context-aware responses"""
    
    if request.data_type not in stored_data:
        raise HTTPException(status_code=400, detail="Invalid data_type")
    
    stored_data[request.data_type].extend(request.records)
    
    return {
        "status": "success",
        "data_type": request.data_type,
        "total_records": len(stored_data[request.data_type]),
        "message": f"Added {len(request.records)} {request.data_type} records"
    }

@app.post("/query")
async def query_data(request: QueryRequest):
    """Query stored data using natural language"""
    
    data_context = ""
    if request.data_type and request.data_type in stored_data:
        data_context = f"\n\nData type: {request.data_type}\n"
        data_context += str(stored_data[request.data_type])
    else:
        data_context = "\n\nAll available data:\n"
        for dtype, records in stored_data.items():
            data_context += f"\n{dtype.upper()}: {len(records)} records"
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Use this data to answer:\n{data_context}"},
        {"role": "user", "content": request.query}
    ]
    
    response = chat_with_groq(messages)
    
    return {"response": response}

@app.get("/data/{data_type}")
async def get_data(data_type: str):
    """Get all records for a specific data type"""
    
    if data_type not in stored_data:
        raise HTTPException(status_code=404, detail="Data type not found")
    
    return {
        "data_type": data_type,
        "count": len(stored_data[data_type]),
        "records": stored_data[data_type]
    }

@app.delete("/data/{data_type}")
async def clear_data(data_type: str):
    """Clear all records for a specific data type"""
    
    if data_type not in stored_data:
        raise HTTPException(status_code=404, detail="Data type not found")
    
    count = len(stored_data[data_type])
    stored_data[data_type] = []
    
    return {
        "status": "success",
        "data_type": data_type,
        "cleared": count,
        "message": f"Cleared {count} {data_type} records"
    }

@app.get("/stats")
async def get_stats():
    """Get summary statistics of stored data"""
    
    stats = {}
    for dtype, records in stored_data.items():
        stats[dtype] = {
            "count": len(records),
            "last_updated": datetime.now().isoformat()
        }
        
        # Calculate totals for financial data
        if dtype == "sales" and records:
            total = sum(r.get("amount", 0) for r in records)
            stats[dtype]["total_amount"] = total
            
        if dtype == "expenses" and records:
            total = sum(r.get("amount", 0) for r in records)
            stats[dtype]["total_amount"] = total
    
    return {
        "stats": stats,
        "chat_history_length": len(chat_history)
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
