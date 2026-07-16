# MAIA — TimesFM Forecast Service
# El checkpoint (~2GB, google/timesfm-2.0-500m-pytorch) se descarga de
# Hugging Face en el primer arranque y se cachea en /root/.cache/huggingface
# (montar un volumen ahí para no re-descargarlo en cada deploy).

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8900

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8900/health')"

CMD ["python", "main.py"]
