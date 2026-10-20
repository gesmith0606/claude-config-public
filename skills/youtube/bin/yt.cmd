@echo off
set PYTHONIOENCODING=utf-8
set "PY=%USERPROFILE%\.claude\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=py -3"
%PY% "%~dp0yt.py" %*
