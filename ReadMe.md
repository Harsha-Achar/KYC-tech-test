# Backend end run commands

cd .venv
cd Scripts
activate 

cd Backend

uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Frontend run commands
cd frontend
npm install (First time only)
npm run dev

Req:
npm install -D @tailwindcss/typography