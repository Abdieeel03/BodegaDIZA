FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV ML_MODEL_DIR=/app/data/models PYTHONUNBUFFERED=1
RUN mkdir -p /app/data/models && useradd -r -u 10001 diza && chown -R diza:diza /app/data
USER diza
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
