# Setup Instructions

## 1. Backend Setup (FastAPI & ML)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*The backend will be running at http://localhost:8000*

## 2. Frontend Setup (Next.js)
```bash
cd frontend
npm install
npm run dev
```
*The frontend will be running at http://localhost:3000*
