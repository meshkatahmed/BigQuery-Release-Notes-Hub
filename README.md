# BigQuery Release Notes Hub ⚡

A premium interactive dashboard web application built with Python Flask and plain vanilla HTML, CSS, and JavaScript. It aggregates, parses, caches, and visualizes Google Cloud BigQuery Release Notes.

## 🚀 Key Features

* **Granular Feed Parsing**: Splits daily aggregated Google feed entries by their header categories (`Feature`, `Change`, `Issue`, `Breaking`, `Announcement`), converting bulk updates into clean, single-purpose cards.
* **Intelligent Caching**: Implements a local file cache (`feed_cache.json`) with a 10-minute expiry window to ensure fast response times and prevent rate-limiting from the source feed.
* **Resiliency Fallback**: If the Google Cloud RSS server is down or the local network connection drops, the Flask backend transparently serves the local cache as a fallback.
* **Instant Dynamic Filters**: Filter release notes in real-time by category types and publication years.
* **Real-time Keyword Highlighting**: Interactive search index that highlights matching terms within release card titles and descriptions.
* **Insights Dashboard**: Renders interactive SVG charts (Donut Chart for category distributions and Bar Chart for publication frequency over time) alongside key textual analytics summaries without loading bulky external libraries.
* **Custom Bookmarking**: Star release notes to save them to `localStorage` for quick offline reference.
* **Deep Links & Social Sharing**: Copy direct documentation anchor links to your clipboard, or share updates directly to Twitter/X with pre-formatted hashtags.
* **Double-theme Support**: Glassmorphic UI featuring toggleable Dark Mode (default) and Light Mode.

---

## 📁 Project Structure

```
├── app.py                  # Flask backend server & XML parser
├── requirements.txt        # Python dependency manager
├── .gitignore              # Git ignore rules for venv, cache, and IDEs
├── templates/
│   └── index.html          # Main HTML structure & layout landmarks
└── static/
    ├── css/
    │   └── style.css       # Design tokens, themes, layout, and animations
    └── js/
        └── app.js          # State engine, dynamic rendering, and SVG charts
```

---

## 🛠️ How to Run Locally

### Prerequisites
Make sure you have Python (version 3.8 or higher) installed on your system.

### 1. Set Up the Environment
Create and activate a virtual environment, then install Flask:

**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**On macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Start the Server
Run the Flask application:
```bash
python app.py
```
By default, the server runs in debug mode on **`http://127.0.0.1:5000`**.

### 3. Open in Browser
Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.

---

## 📊 API Endpoint

The application exposes a single API endpoint:

### `GET /api/release-notes`
Returns parsed release notes as JSON.

* **Optional Parameters**:
  * `refresh=true` (forces the server to bypass cache and query Google directly).
* **Sample Response**:
  ```json
  {
    "status": "success",
    "last_updated": "2026-06-17 21:25:20",
    "last_updated_timestamp": 1781805920.0,
    "count": 124,
    "data": [
      {
        "id": "June_15__2026_Feature_0",
        "date": "June 15, 2026",
        "raw_date": "2026-06-15T00:00:00-07:00",
        "year": "2026",
        "type": "Feature",
        "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026",
        "content": "<p>Use Gemini Cloud Assist to analyze your SQL queries...</p>",
        "summary": "Use Gemini Cloud Assist to analyze your SQL queries..."
      }
    ]
  }
  ```

---

## 🎨 Theme & Customization

The layout uses **CSS Variables** defined in `static/css/style.css` for easy theme styling. You can toggle between Dark Mode and Light Mode using the sun/moon icon button in the header. The charts are drawn dynamically using SVG vector nodes (`<circle>`, `<rect>`), responding automatically to theme changes and scaling to fit any screen resolution.
