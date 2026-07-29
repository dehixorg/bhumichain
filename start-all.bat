@echo off
echo Starting BhumiChain Backend API...
start "API Gateway" cmd /k "cd backend\api-gateway && npm run dev"

echo Starting BhumiChain Frontend...
start "Frontend Web Portal" cmd /k "cd frontend\web-portal && npm run dev"

echo Starting Record Scan AI Service...
start "Record Scan AI" cmd /k "cd backend\ai-services\record-scan && python app.py"

echo All services have been launched in separate windows! You can minimize them to keep them running in the background.
