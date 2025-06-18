@echo off
rem Change to the MatchScheduler project directory
cd /d "%~dp0\MatchScheduler"
echo Pushing local changes to Google Apps Script...
clasp push
echo Done.
pause