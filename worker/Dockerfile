FROM python:3.12-slim

RUN useradd -m -u 1000 runner
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY runner ./runner

# NOTE: actual tool binaries (subfinder, amass, httpx, naabu, nmap, nuclei, ffuf)
# get installed here in a later pass, once the tool registry scope is defined.

USER runner
CMD ["python", "-m", "runner.main"]
