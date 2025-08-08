# Procfile for Heroku
web: node src/vapi-mcp-server.js

---

# Updated .gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory
coverage/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# macOS
.DS_Store

# Windows
Thumbs.db
ehthumbs.db

# Heroku
.heroku/

# Testing
test-results/
coverage/

---

# app.json for Heroku
{
  "name": "Vapi-Compatible Local Time MCP Server",
  "description": "MCP server with SSE support for Vapi voice agents - provides accurate local time for dental practices",
  "keywords": ["mcp", "vapi", "voice-agent", "timezone", "dental", "sse", "heroku"],
  "website": "https://github.com/yourusername/local-time-mcp-server",
  "repository": "https://github.com/yourusername/local-time-mcp-server",
  "env": {
    "NODE_ENV": {
      "description": "Node environment",
      "value": "production"
    },
    "PORT": {
      "description": "Port for the server",
      "value": "3000"
    }
  },
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ],
  "formation": {
    "web": {
      "quantity": 1,
      "size": "basic"
    }
  },
  "stack": "heroku-22"
}