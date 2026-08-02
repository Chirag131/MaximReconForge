FROM python:3.12-slim

# Install system dependencies & Go compiler
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    ca-certificates \
    curl \
    git \
    golang-go \
    && rm -rf /var/lib/apt/lists/*

# Install Go-based security binaries
ENV GOPATH=/go
ENV PATH="${GOPATH}/bin:${PATH}"

RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest \
 && go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest \
 && go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu/main-executable@latest \
 && go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest \
 && go install -v github.com/ffuf/ffuf/v2@latest

RUN useradd -m -u 1000 runner
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY runner ./runner

# Ensure runner user has access to app and wordlists
RUN mkdir -p /app/wordlists && chown -R runner:runner /app /go

USER runner
CMD ["python", "-m", "runner.main"]
