#!/bin/bash
cd /home/kavia/workspace/code-generation/tradecraft-studio-98176-76920387/quantico_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

