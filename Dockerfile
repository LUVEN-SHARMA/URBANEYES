FROM python:3.11-slim

# Set environment defaults
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    HOST=0.0.0.0

# Install system dependencies required for OpenCV, PIL, and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user (UID 1000 is required by Hugging Face Spaces)
RUN useradd -m -u 1000 user
WORKDIR /app

# Upgrade pip and install Python dependencies
COPY requirements.txt requirements-ai.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-ai.txt

# Copy project files
COPY . .

# Ensure necessary runtime directories exist and grant permissions to user 1000
RUN mkdir -p /app/data /app/uploads /app/models && \
    chown -R 1000:1000 /app

# Switch to non-root user
USER 1000

# Expose port 7860 (Hugging Face Spaces default, also compatible with Render/Cloud Run)
EXPOSE 7860

# Run FastAPI app with dynamic PORT support
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
