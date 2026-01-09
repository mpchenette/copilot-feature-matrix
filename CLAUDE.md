# GitHub Copilot Feature Matrix

## Project Overview

A brutally minimal website that displays GitHub Copilot feature availability across different IDEs. The site prioritizes clarity, speed, and simplicity above all else.

## Design Philosophy

### Brutal Minimalism
- Strip away everything except the essential data
- No decorative elements, no complex navigation, no unnecessary UI
- Generous whitespace
- Typography and spacing do all the heavy lifting
- One table, one view - that's it

### Non-Technical Accessibility
The site should be immediately understandable to non-technical users:
- **Row** = Feature you want to know about
- **Column** = IDE you care about
- **Colored dot** = Status (green = ready, yellow = preview, gray = not available)
- **Version number** = When it became available

Everything visible at a glance - no clicking through tabs or filters.

### Accessibility Priority
Accessibility is a core design principle:
- **Color scheme**: Warm, neutral tones that reduce eye strain
  - Cream background (#f8f7f4) instead of harsh white
  - Dark gray text (#2a2a2a) instead of pure black
  - Maintains WCAG AA contrast ratios for readability
- **Text sizing**: Larger fonts for comfortable reading
  - Body text: 18px (optimal for accessibility)
  - Table headers: 15px (increased for readability)
  - Version numbers: 16px
  - Emphasizes readability over density
- **Universal comfort**: Designed to work for users sensitive to both bright and dark themes

## Technical Goals

### Performance: Sub-14KB First Packet
The entire site fits in the first TCP packet (14KB limit) for instant rendering:
- **Current size: 11.7KB** ✅
- Single HTML file contains everything
- Zero external requests (no CSS files, no JS files, no external data)
- System fonts only (no web font downloads)
- Minified CSS and JavaScript inlined

### Speed Optimizations
1. **Inlined everything** - CSS, JavaScript, and data all in one HTML file
2. **System fonts** - `-apple-system, BlinkMacSystemFont, 'Segoe UI'` (no downloads)
3. **Minified** - All code compressed to minimal size
4. **No external dependencies** - Eliminates DNS lookups, CDN failures, race conditions

### Result
- **0 DNS lookups**
- **1 HTTP request** (just the HTML)
- **1 round trip** (fits in first TCP packet)
- **Sub-100ms first paint** even on slow connections
- **Bulletproof loading** - no FOUC, no janky partial loads

## Architecture

### Single File Design
- `index.html` - Contains HTML structure, CSS styles, JavaScript code, and data
- `research.html` - Optional references page (separate, not performance-critical)
- No `style.css`, `script.js`, or `data.json` files needed

### Data Structure
Data is inlined as a JavaScript constant in this format:
```javascript
const rawData = {
  "IDE Name": {
    "version": {
      "Feature Name": { "releaseType": "ga" | "preview" },
      "_date": "YYYY-MM-DD" // optional
    }
  }
}
```

## Design Decisions

### Why No Tabs/Filters?
Initially had multiple views (Features × IDEs, IDEs × Features) with filters. **Removed because:**
- Same data, just transposed - no new information
- Adds complexity without adding value
- Violates "brutal minimalism" principle
- One view is enough - users can scan the table

### Why System Fonts?
Initially used Mona Sans (GitHub's font). **Switched to system fonts because:**
- Eliminates 50KB+ font download
- Eliminates DNS lookup to GitHub CDN
- Eliminates potential failure point
- System fonts look great and load instantly
- Saves ~3KB in CSS for @font-face declaration

### Why Inline Everything?
Initially had separate CSS/JS/JSON files. **Inlined because:**
- Eliminates 3+ HTTP requests → 1 request
- Eliminates race conditions (CSS loading after HTML)
- Eliminates FOUC (Flash of Unstyled Content)
- Fits in first TCP packet for instant render
- More reliable - no CDN caching issues

### Why Minify?
Compressed CSS and JavaScript to minimal size because:
- Reduces file size by ~40%
- Gets us under the 14KB first packet limit
- Makes no difference to maintainability (we have readable source)
- Browsers parse minified code just as fast

## Visual Design

### Color System
Accessible, neutral palette designed to reduce eye strain:
- **Background**: #f8f7f4 (warm cream, paper-like)
- **Text**: #2a2a2a (dark gray, softer than pure black)
- **Secondary text**: #6b6b6b (medium gray for labels/versions)
- **Borders**: #d4d2ca and #e8e7e2 (soft, warm grays)
- **Status colors**:
  - Green (#2d8659) = Generally Available
  - Orange-yellow (#c27200) = Preview
  - Gray (25% opacity) = Not Available

### Typography
- **Font**: System font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI')
- **Title**: 32px, medium weight
- **Table headers**: 15px (optimal for accessibility)
- **Table content**: 18px (optimal for accessibility)
- **Version numbers**: 16px, gray

### Layout
- **Max width**: 1600px (centered)
- **Padding**: Generous (60px top)
- **Table**: Full width, sticky headers, hover states
- **Border**: Single 1px line under header (full viewport width)

## Maintenance

### Adding New Features
1. Edit the inlined `rawData` object in `index.html`
2. Add feature to appropriate IDE version
3. No build step needed - just edit and deploy

### Adding New IDEs
1. Add new IDE object to `rawData`
2. Table automatically picks it up
3. No code changes needed

### Updating Versions
1. Add new version number to IDE
2. Include features introduced in that version
3. Version inheritance automatically handled

## Future Considerations

### If File Size Grows Beyond 14KB
Options to stay under the limit:
1. Further minification (variable name shortening)
2. Gzip compression (most servers do this automatically)
3. Remove least-important features or IDEs
4. Split into separate pages by IDE

### If More Views Are Needed
Only add new views if they provide genuinely new information, not just the same data reorganized.

## Development Notes

### No Build Process
The site intentionally has no build process:
- No npm, no webpack, no bundlers
- Edit HTML directly
- Deploy HTML directly
- Simplicity over tooling

### Browser Support
Works in all modern browsers:
- System fonts work everywhere
- CSS Grid/Flexbox for layout
- localStorage for theme preference
- No polyfills needed

## Performance Metrics

Target metrics (all met):
- ✅ File size < 14KB (actual: 11.7KB)
- ✅ First paint < 100ms
- ✅ Zero external requests
- ✅ Works offline after first load
- ✅ No FOUC
- ✅ No layout shift
