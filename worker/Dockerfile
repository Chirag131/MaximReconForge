FROM python:3.12-slim

# Install system dependencies, Go compiler, and apt-packaged scanners.
# sqlmap ships from Debian; amass is installed from source below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    sqlmap \
    ca-certificates \
    curl \
    git \
    golang-go \
    && rm -rf /var/lib/apt/lists/*

# Pinned versions for reproducible builds. Bump these deliberately, never @latest.
ARG SUBFINDER_VERSION=v2.6.6
ARG HTTPX_VERSION=v1.6.9
ARG NAABU_VERSION=v2.3.3
ARG NUCLEI_VERSION=v3.3.7
ARG FFUF_VERSION=v2.1.0
ARG AMASS_VERSION=v4.2.0

# Install Go-based security binaries (pinned)
ENV GOPATH=/go
ENV PATH="${GOPATH}/bin:${PATH}"

RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@${SUBFINDER_VERSION} \
 && go install -v github.com/projectdiscovery/httpx/cmd/httpx@${HTTPX_VERSION} \
 && go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@${NAABU_VERSION} \
 && go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@${NUCLEI_VERSION} \
 && go install -v github.com/ffuf/ffuf/v2@${FFUF_VERSION} \
 && go install -v github.com/owasp-amass/amass/v4/...@${AMASS_VERSION}

RUN useradd -m -u 1000 runner
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY runner ./runner

# Ensure runner user has access to app and wordlists
RUN mkdir -p /app/wordlists && chown -R runner:runner /app /go

USER runner
CMD ["python", "-m", "runner.main"]
