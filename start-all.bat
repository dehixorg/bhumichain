@echo off
echo Starting BhumiChain Backend API...
start "API Gateway" cmd /k "cd backend\api-gateway && npm run dev"

echo Starting BhumiChain Frontend...
start "Frontend Web Portal" cmd /k "cd frontend\web-portal && npm run dev"

echo Starting Record Scan AI Service (Port 8010)...
start "Record Scan AI" cmd /k "cd backend\ai-services\record-scan && python main.py"

echo Starting AI Document Analyzer (Port 8014)...
start "AI Document Analyzer" cmd /k "cd backend\ai-document-analyzer && npm run server"

echo Starting BhumiBot AI Service (Port 8015)...
start "BhumiBot AI" cmd /k "cd backend\ai-services\bhumibot && python main.py"

echo All services have been launched in separate windows! You can minimize them to keep them running in the background.
