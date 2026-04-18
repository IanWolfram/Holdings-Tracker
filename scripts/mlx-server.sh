#!/bin/bash
# Pulse — MLX Native Server Launcher
# Uses the .mlx_venv virtual environment to start an OpenAI-compatible API server.

CWD=$(pwd)
VENV_PATH="$CWD/.mlx_venv"

if [ ! -d "$VENV_PATH" ]; then
    echo "Error: .mlx_venv not found. Run the installation steps first."
    exit 1
fi

# Load model from .env.local
MODEL=$(grep MLX_MODEL .env.local | cut -d '=' -f2)
if [ -z "$MODEL" ]; then
    MODEL="mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit"
fi

echo "Starting MLX Server for model: $MODEL"
echo "API will be available at http://localhost:8080/v1"

source "$VENV_PATH/bin/activate"
python -m mlx_lm.server --model "$MODEL" --port 8080
