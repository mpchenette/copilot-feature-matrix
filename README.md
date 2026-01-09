# GitHub Copilot Feature Matrix

A brutally minimal website showing GitHub Copilot feature availability across different IDEs.

**Live site:** [copilot-feature-matrix.com](https://copilot-feature-matrix.com)

## Features

- **11.7KB main page** - Loads in first TCP packet for instant rendering
- **Zero external dependencies** - Everything inlined (CSS, JS, data)
- **System fonts only** - No web font downloads
- **Dark/light mode** - Preference saved in localStorage
- **Fully responsive** - Works on all screen sizes

## Project Structure

```
/static
  ├── index.html        # Main page (11.7KB, everything inlined)
  ├── research.html     # References page (4.3KB)
  ├── research.js       # Research page logic (9.7KB)
  └── research.md       # Markdown reference content (12.9KB)
```

**Total site size:** ~39KB

## Local Development

Serve the static files with any HTTP server:

```bash
# Python
cd static && python3 -m http.server 8080

# Node.js
cd static && npx http-server -p 8080

# PHP
cd static && php -S localhost:8080
```

Then open `http://localhost:8080`

## Deployment

### Option 1: Azure Static Web Apps (Recommended - FREE!)

**Why:** Global CDN, auto-deploy from GitHub, free SSL, zero maintenance.

#### Using Azure Portal:
1. Go to [Azure Portal](https://portal.azure.com)
2. Create Resource → Static Web Apps
3. Connect to your GitHub repository
4. Configure build:
   - **App location:** `/static`
   - **Api location:** (leave empty)
   - **Output location:** (leave empty)
5. Click Create

Azure will automatically deploy on every push to main branch.

#### Using Azure CLI:
```bash
# Login
az login

# Create resource group (if needed)
az group create --name copilot-matrix-rg --location eastus2

# Create static web app
az staticwebapp create \
  --name copilot-matrix \
  --resource-group copilot-matrix-rg \
  --source https://github.com/YOUR_USERNAME/copilot-feature-matrix \
  --location eastus2 \
  --branch main \
  --app-location "/static" \
  --api-location "" \
  --output-location ""
```

#### Custom Domain:
1. In Azure Portal, go to your Static Web App
2. Click "Custom domains"
3. Add your domain and follow DNS instructions

### Option 2: Azure Blob Storage + CDN

**Cost:** ~$0.50/month for storage + bandwidth

```bash
# Create storage account
az storage account create \
  --name copilotmatrix \
  --resource-group copilot-matrix-rg \
  --location eastus2 \
  --sku Standard_LRS

# Enable static website hosting
az storage blob service-properties update \
  --account-name copilotmatrix \
  --static-website \
  --index-document index.html

# Upload files
az storage blob upload-batch \
  --account-name copilotmatrix \
  --destination '$web' \
  --source ./static

# Get website URL
az storage account show \
  --name copilotmatrix \
  --query "primaryEndpoints.web" \
  --output tsv
```

### Option 3: Other Static Hosts

This site works with any static hosting provider:

- **Cloudflare Pages:** Connect GitHub → Deploy
- **Netlify:** Drag & drop `/static` folder
- **Vercel:** Connect GitHub → Deploy
- **GitHub Pages:** Push to `gh-pages` branch
- **AWS S3:** Upload to S3 bucket with static hosting enabled

All are free for small sites like this.

## Updating Content

### Adding a New Feature

Edit `index.html` and find the `rawData` object in the `<script>` tag:

```javascript
const rawData = {
  "VS Code": {
    "1.108.0": {
      "New Feature Name": { "releaseType": "ga" }  // Add this line
    }
  }
}
```

Commit and push - done! No build step needed.

### Adding a New IDE

Add a new IDE object to `rawData`:

```javascript
const rawData = {
  "New IDE": {
    "1.0.0": {
      "Code completion": { "releaseType": "ga" }
    }
  }
}
```

The table will automatically include the new IDE.

### Release Types

- `"ga"` - Generally Available (green dot)
- `"preview"` - Preview/Beta (yellow dot)

## Performance

- **Main page:** 11.7KB (loads in first TCP packet)
- **First paint:** <100ms even on slow connections
- **External requests:** 0 (everything inlined)
- **HTTP requests:** 1 (just the HTML)

See [CLAUDE.md](CLAUDE.md) for detailed performance notes and design decisions.

## Design Philosophy

**Brutal Minimalism:**
- One table, one view
- No tabs, filters, or complex navigation
- System fonts (no downloads)
- Everything visible at a glance
- Non-technical users can understand instantly

See [CLAUDE.md](CLAUDE.md) for the complete design philosophy and technical decisions.

## License

MIT
