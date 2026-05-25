@echo off
cd vibe_backend
echo Using Python at C:\pythons\Python313\python.exe
echo Running Migrations...
"C:\pythons\Python313\python.exe" manage.py migrate
echo Starting Server...
"C:\pythons\Python313\python.exe" manage.py runserver
pause
