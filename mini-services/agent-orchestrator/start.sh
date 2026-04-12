#!/bin/bash
cd /home/z/my-project/mini-services/agent-orchestrator
PYTHONPATH=/home/z/my-project/mini-services/agent-orchestrator python3 -m uvicorn app.main:app --host 0.0.0.0 --port 3100 --log-level info "$@"
