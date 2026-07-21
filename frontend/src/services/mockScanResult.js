const mockScanResult = {
  summary: {
    subdomains: 128,
    liveHosts: 52,
    urls: 231,
    openPorts: 7,
  },

  subdomains: [
    {
      name: "api.example.com",
      status: "Live",
      source: "subfinder",
    },
    {
      name: "admin.example.com",
      status: "Live",
      source: "assetfinder",
    },
    {
      name: "cdn.example.com",
      status: "Live",
      source: "subfinder",
    },
    {
      name: "mail.example.com",
      status: "Offline",
      source: "assetfinder",
    },
  ],

  hosts: [
    {
      url: "https://api.example.com",
      status: 200,
      title: "Example API",
      technology: "Cloudflare",
    },
    {
      url: "https://admin.example.com",
      status: 302,
      title: "Admin Login",
      technology: "Nginx",
    },
    {
      url: "https://staging.example.com",
      status: 401,
      title: "Restricted",
      technology: "Express",
    },
  ],

  endpoints: [
    {
      method: "GET",
      path: "/api/v1/users",
      host: "api.example.com",
      status: 200,
    },
    {
      method: "GET",
      path: "/admin",
      host: "admin.example.com",
      status: 302,
    },
    {
      method: "POST",
      path: "/api/v1/auth/login",
      host: "api.example.com",
      status: 401,
    },
    {
      method: "GET",
      path: "/graphql",
      host: "api.example.com",
      status: 200,
    },
  ],

  ports: [
    {
      host: "104.21.12.84",
      port: 80,
      service: "HTTP",
      version: "Cloudflare proxy",
    },
    {
      host: "104.21.12.84",
      port: 443,
      service: "HTTPS",
      version: "Cloudflare TLS",
    },
    {
      host: "172.67.18.42",
      port: 22,
      service: "SSH",
      version: "OpenSSH 8.9",
    },
    {
      host: "172.67.18.42",
      port: 3000,
      service: "HTTP",
      version: "Node.js Express",
    },
  ],

  findings: [
    {
      title: "Administrative panel discovered",
      description:
        "A responsive administrative login page was found.",
      level: "Review",
    },
    {
      title: "Development port exposed",
      description:
        "Port 3000 appears to expose a Node.js service.",
      level: "Medium",
    },
    {
      title: "GraphQL endpoint detected",
      description:
        "A responsive GraphQL endpoint was discovered.",
      level: "Info",
    },
  ],
};

export default mockScanResult;