import os
import re
import xml.etree.ElementTree as ET
import urllib.request
from datetime import datetime
import time
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "feed_cache.json"
CACHE_DURATION = 600  # 10 minutes in seconds

def parse_xml_feed(xml_data):
    """Parses Atom feed XML data and returns structured JSON list of release notes."""
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as e:
        print(f"XML Parsing Error: {e}")
        return []

    namespace = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = []
    
    # Iterate through entries
    for entry in root.findall('atom:entry', namespace):
        title = entry.find('atom:title', namespace).text
        updated = entry.find('atom:updated', namespace).text
        
        link_elem = entry.find('atom:link[@rel="alternate"]', namespace)
        link = link_elem.attrib['href'] if link_elem is not None else ""
        
        content_elem = entry.find('atom:content', namespace)
        content = content_elem.text if content_elem is not None else ""
        
        # Format the updated date nicely
        # Input format e.g.: "2026-06-16T00:00:00-07:00" or similar ISO 8601
        formatted_date = ""
        year = ""
        try:
            # Parse ISO 8601 timestamp (using fromisoformat)
            # Strip timezone info if needed or parse with timezone
            dt = datetime.fromisoformat(updated)
            formatted_date = dt.strftime("%B %d, %Y")
            year = dt.strftime("%Y")
        except Exception:
            formatted_date = title
            # Try to extract year from title or date string
            year_match = re.search(r'\b(20\d{2})\b', title)
            if year_match:
                year = year_match.group(1)
            else:
                year = datetime.now().strftime("%Y")

        # Split content by <h3> headings to separate different updates in the same day
        parts = re.split(r'(<h3>.*?</h3>)', content, flags=re.DOTALL)
        items = []
        
        # If there are no <h3> tags but content is not empty
        if len(parts) == 1 and content.strip():
            items.append({
                "type": "General",
                "content": content.strip()
            })
        else:
            i = 1
            while i < len(parts):
                h3_tag = parts[i]
                html_content = parts[i+1] if i+1 < len(parts) else ""
                
                # Extract type name from <h3>Type</h3>
                type_match = re.search(r'<h3>(.*?)</h3>', h3_tag)
                type_name = type_match.group(1).strip() if type_match else "General"
                
                # Clean up html content (remove leading/trailing spaces/newlines)
                clean_html = html_content.strip()
                
                # Extract text summary for search indexing
                text_summary = re.sub('<[^<]+?>', '', clean_html).strip()
                # Remove redundant spaces
                text_summary = re.sub(r'\s+', ' ', text_summary)
                
                items.append({
                    "type": type_name,
                    "content": clean_html,
                    "summary": text_summary
                })
                i += 2

        # Add items list to entries
        for idx, item in enumerate(items):
            # Generate a unique stable ID for anchor linking
            clean_title = re.sub(r'[^a-zA-Z0-9]', '_', title)
            clean_type = re.sub(r'[^a-zA-Z0-9]', '_', item['type'])
            item_id = f"{clean_title}_{clean_type}_{idx}"
            
            entries.append({
                "id": item_id,
                "date": formatted_date,
                "raw_date": updated,
                "year": year,
                "link": f"{link}#{title.replace(' ', '_')}" if link else "",
                "type": item["type"],
                "content": item["content"],
                "summary": item["summary"]
            })
            
    return entries

def get_release_notes(force_refresh=False):
    """Fetches release notes feed, utilizing caching to avoid frequent external API calls."""
    now = time.time()
    
    # Check if cache exists and is fresh (skip if force_refresh is True)
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            mtime = os.path.getmtime(CACHE_FILE)
            if now - mtime < CACHE_DURATION:
                import json
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                    # Check if structure is correct and not empty
                    if cache_data and isinstance(cache_data, list):
                        print("Serving release notes from cache...")
                        return cache_data, mtime
        except Exception as e:
            print(f"Error reading cache: {e}")

    # Fetch from web
    print("Fetching release notes from Google Cloud Feed...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravityFeedReader/1.0'}
        req = urllib.request.Request(FEED_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            parsed_entries = parse_xml_feed(xml_data)
            
            if parsed_entries:
                # Save to cache file
                import json
                with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(parsed_entries, f, ensure_ascii=False, indent=2)
                return parsed_entries, now
            
    except Exception as e:
        print(f"Error fetching feed: {e}")
        
    # If fetch fails, try to return stale cache as fallback
    if os.path.exists(CACHE_FILE):
        try:
            import json
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                mtime = os.path.getmtime(CACHE_FILE)
                print("Serving stale cache due to fetch error...")
                return cache_data, mtime
        except Exception:
            pass
            
    return [], 0

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def api_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    data, timestamp = get_release_notes(force_refresh=force_refresh)
    
    # Format last updated time for headers
    last_updated_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S") if timestamp else "Never"
    
    return jsonify({
        "status": "success",
        "last_updated": last_updated_str,
        "last_updated_timestamp": timestamp,
        "count": len(data),
        "data": data
    })

if __name__ == '__main__':
    # Using port 5000 by default
    app.run(host='127.0.0.1', port=5000, debug=True)
