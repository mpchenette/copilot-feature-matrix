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

### Option 1: Firebase Hosting (Recommended - FREE!)

**Why:** Global CDN (125+ edge locations), auto-deploy, free SSL, incredibly fast.

**Free tier:** 10GB storage, 360MB/day bandwidth (plenty for this site)

#### Setup:
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your repo
cd /path/to/copilot-feature-matrix
firebase init hosting

# When prompted:
# - Use an existing project or create new one
# - Public directory: static
# - Configure as single-page app: No
# - Set up automatic builds with GitHub: Yes (optional)

# Deploy
firebase deploy
```

Your site will be live at `https://YOUR-PROJECT.web.app`

#### Custom Domain:
```bash
# Add custom domain
firebase hosting:channel:deploy live --only hosting
```

Then in Firebase Console → Hosting → Add custom domain

#### Auto-deploy from GitHub:
Firebase will create a GitHub Action workflow automatically if you choose that option during `firebase init`. Every push to main will auto-deploy.

### Option 2: Google Cloud Storage

**Cost:** ~$0.50/month for storage + bandwidth

```bash
# Create bucket (name must be globally unique)
gsutil mb -c standard -l us-east1 gs://copilot-matrix

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://copilot-matrix

# Configure as website
gsutil web set -m index.html gs://copilot-matrix

# Upload files
gsutil -m cp -r static/* gs://copilot-matrix

# Your site is live at:
# https://storage.googleapis.com/copilot-matrix/index.html
```

For custom domain, set up Cloud CDN and Cloud Load Balancer.

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
