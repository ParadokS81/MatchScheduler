REM ===== Push-To-GitHub.bat =====
@echo off
rem Change to the MatchScheduler project directory
cd /d "%~dp0\MatchScheduler"
echo Staging all changes for commit...
git add .
echo Committing with timestamp...
set "commit_datetime=%date% %time%"
git commit -m "Dev update on %commit_datetime%"
echo Pushing to GitHub dev branch...
git push origin dev
echo --- PUSH TO GITHUB COMPLETE ---
pause