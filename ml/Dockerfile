FROM python:3.11-slim

WORKDIR /app

# Set production environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    ML_PORT=8000 \
    ML_HOST=0.0.0.0 \
    PYTHONPATH=/app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy ML application code and authentic artifacts
COPY . /app/ml

# Expose microservice port
EXPOSE 8000

# Start FastAPI application with production entry point
CMD ["python", "-m", "uvicorn", "ml.src.api:app", "--host", "0.0.0.0", "--port", "8000"]
