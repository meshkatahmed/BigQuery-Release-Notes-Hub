/**
 * BigQuery Release Notes Hub - Frontend Engine
 * Handles State management, API synchronization, Local Storage caching, Dynamic rendering,
 * Real-time search/filtering, Bookmarking, and SVG-based Analytical Charts.
 */

// STATE MANAGEMENT
const state = {
    notes: [],            // List of parsed release notes
    cachedAt: null,       // Sync timestamp
    bookmarks: [],        // Saved note IDs
    currentTab: 'all',    // 'all' | 'bookmarks' | 'stats'
    filters: {
        search: '',
        types: new Set(),
        years: new Set()
    },
    theme: 'dark'
};

// CATEGORY CONFIG (Colors and Labels)
const CATEGORY_CONFIG = {
    'Feature': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', class: 'feature' },
    'Change': { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)', class: 'change' },
    'Announcement': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', class: 'announcement' },
    'Issue': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', class: 'issue' },
    'Breaking': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', class: 'breaking' },
    'General': { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', class: 'general' }
};

// DOM ELEMENT SELECTORS
const DOM = {
    sidebar: document.getElementById('app-sidebar'),
    mobileToggleBtn: document.getElementById('mobile-toggle-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    
    // Nav tabs
    navAllBtn: document.getElementById('nav-all-btn'),
    navBookmarksBtn: document.getElementById('nav-bookmarks-btn'),
    navStatsBtn: document.getElementById('nav-stats-btn'),
    bookmarkBadgeCount: document.getElementById('bookmark-badge-count'),
    
    // Filters
    typeFiltersContainer: document.getElementById('type-filters-container'),
    yearFiltersContainer: document.getElementById('year-filters-container'),
    clearAllFiltersBtn: document.getElementById('clear-all-filters-btn'),
    
    // Main area headers
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    cacheInfoPill: document.getElementById('cache-info-pill'),
    cacheTimeText: document.getElementById('cache-time-text'),
    forceRefreshBtn: document.getElementById('force-refresh-btn'),
    syncIndicator: document.getElementById('sync-indicator'),
    syncText: document.getElementById('sync-text'),
    resultsMetaBar: document.getElementById('results-meta-bar'),
    resultsCountText: document.getElementById('results-count-text'),
    resetSearchFiltersBtn: document.getElementById('reset-search-filters-btn'),
    
    // View sections
    feedSection: document.getElementById('feed-section'),
    bookmarksSection: document.getElementById('bookmarks-section'), // Note: Shares same stream list
    statsSection: document.getElementById('stats-section'),
    loadingSkeletons: document.getElementById('loading-skeletons'),
    releaseTimeline: document.getElementById('release-notes-timeline'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptyMessage: document.getElementById('empty-message'),
    emptyResetBtn: document.getElementById('empty-reset-btn'),
    scrollableContent: document.getElementById('scrollable-content'),
    
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message'),
    
    // Stats elements
    statsTotalItems: document.getElementById('stats-total-items'),
    statsTotalFeatures: document.getElementById('stats-total-features'),
    statsFeaturePct: document.getElementById('stats-feature-pct'),
    statsTotalIssues: document.getElementById('stats-total-issues'),
    statsIssuesPct: document.getElementById('stats-issues-pct'),
    statsLatestDate: document.getElementById('stats-latest-date'),
    statsDaysAgo: document.getElementById('stats-days-ago'),
    chartDistributionSvg: document.getElementById('chart-distribution-svg'),
    chartDistributionLegend: document.getElementById('chart-distribution-legend'),
    chartTrendsSvg: document.getElementById('chart-trends-svg'),
    insightsBullets: document.getElementById('insights-bullets')
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    loadLocalSettings();
    registerEventHandlers();
    fetchReleaseNotes();
});

// LOAD PREFERENCES
function loadLocalSettings() {
    // Theme
    const savedTheme = localStorage.getItem('bq_theme');
    if (savedTheme === 'light') {
        state.theme = 'light';
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
    } else {
        state.theme = 'dark';
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
    }

    // Bookmarks
    const savedBookmarks = localStorage.getItem('bq_bookmarks');
    if (savedBookmarks) {
        try {
            state.bookmarks = JSON.parse(savedBookmarks);
            updateBookmarkBadgeCount();
        } catch (e) {
            state.bookmarks = [];
        }
    }
}

// EVENT REGISTRATION
function registerEventHandlers() {
    // Theme Toggle
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);

    // Mobile Sidebar Drawer
    DOM.mobileToggleBtn.addEventListener('click', () => {
        DOM.sidebar.classList.toggle('mobile-open');
    });

    // Close mobile sidebar if clicked outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 1024 && 
            !DOM.sidebar.contains(e.target) && 
            !DOM.mobileToggleBtn.contains(e.target) && 
            DOM.sidebar.classList.contains('mobile-open')) {
            DOM.sidebar.classList.remove('mobile-open');
        }
    });

    // Navigation Tabs
    DOM.navAllBtn.addEventListener('click', () => switchTab('all'));
    DOM.navBookmarksBtn.addEventListener('click', () => switchTab('bookmarks'));
    DOM.navStatsBtn.addEventListener('click', () => switchTab('stats'));

    // Search input
    DOM.searchInput.addEventListener('input', handleSearchInput);
    DOM.clearSearchBtn.addEventListener('click', clearSearch);

    // Filters reset
    DOM.clearAllFiltersBtn.addEventListener('click', resetAllFilters);
    DOM.resetSearchFiltersBtn.addEventListener('click', resetAllFilters);
    DOM.emptyResetBtn.addEventListener('click', resetAllFilters);

    // Refresh feed
    DOM.forceRefreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });
}

// THEME SYSTEM
function toggleTheme() {
    if (state.theme === 'dark') {
        state.theme = 'light';
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
    } else {
        state.theme = 'dark';
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
    }
    localStorage.setItem('bq_theme', state.theme);
    showToast(`Switched to ${state.theme} mode`);
    
    // Redraw charts if we are on stats page, because axis text colors change
    if (state.currentTab === 'stats') {
        renderInsightsDashboard();
    }
}

// TOAST NOTIFICATIONS
let toastTimeout;
function showToast(message) {
    clearTimeout(toastTimeout);
    DOM.toastMessage.textContent = message;
    DOM.toast.classList.add('show');
    toastTimeout = setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 2500);
}

// STATE TAB ROUTING
function switchTab(tabName) {
    if (state.currentTab === tabName) return;
    
    state.currentTab = tabName;
    
    // Update active nav button
    DOM.navAllBtn.classList.toggle('active', tabName === 'all');
    DOM.navBookmarksBtn.classList.toggle('active', tabName === 'bookmarks');
    DOM.navStatsBtn.classList.toggle('active', tabName === 'stats');

    // Update section visibility
    DOM.feedSection.classList.toggle('active-content', tabName === 'all' || tabName === 'bookmarks');
    DOM.statsSection.classList.toggle('active-content', tabName === 'stats');

    // Reset scroll position
    DOM.scrollableContent.scrollTop = 0;

    // Close mobile sidebar
    DOM.sidebar.classList.remove('mobile-open');

    // Render corresponding view
    if (tabName === 'all') {
        DOM.viewTitle.textContent = 'All Release Notes';
        DOM.viewSubtitle.textContent = 'Showing all available updates from the BigQuery documentation feed.';
        applyFilteringAndRender();
    } else if (tabName === 'bookmarks') {
        DOM.viewTitle.textContent = 'Bookmarked Notes';
        DOM.viewSubtitle.textContent = 'Saved release notes for quick offline reference.';
        applyFilteringAndRender();
    } else if (tabName === 'stats') {
        DOM.viewTitle.textContent = 'Insights Dashboard';
        DOM.viewSubtitle.textContent = 'Analytical trends and category distribution of BigQuery updates.';
        renderInsightsDashboard();
    }
}

// FETCH DATA FROM SERVER
async function fetchReleaseNotes(force = false) {
    setLoadingState(true);
    
    let url = '/api/release-notes';
    if (force) {
        url += '?refresh=true';
        DOM.forceRefreshBtn.classList.add('spin-anim');
        DOM.syncIndicator.className = 'status-indicator syncing';
        DOM.syncText.textContent = 'Syncing feed...';
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API server returned an error');
        
        const res = await response.json();
        if (res.status === 'success') {
            state.notes = res.data;
            state.cachedAt = res.last_updated;
            
            // Render cached time pill
            DOM.cacheTimeText.textContent = `Synced: ${res.last_updated.split(' ')[1] || res.last_updated}`;
            DOM.cacheInfoPill.style.display = 'flex';
            
            DOM.syncIndicator.className = 'status-indicator online';
            DOM.syncText.textContent = 'Feed Connected';
            
            // Build dynamic filters based on data
            buildFilterOptions();
            
            // Render current view
            if (state.currentTab === 'stats') {
                renderInsightsDashboard();
            } else {
                applyFilteringAndRender();
            }
            
            if (force) {
                showToast('Release notes feed updated!');
            }
        } else {
            throw new Error('Unsuccessful API status');
        }
    } catch (e) {
        console.error('Error fetching release notes:', e);
        DOM.syncIndicator.className = 'status-indicator offline';
        DOM.syncText.textContent = 'Connection Error';
        showToast('Failed to fetch release notes from server.');
        
        // Show empty timeline state if no notes
        if (state.notes.length === 0) {
            setLoadingState(false);
            DOM.releaseTimeline.style.display = 'none';
            DOM.emptyState.style.display = 'flex';
            DOM.emptyTitle.textContent = 'Service Temporarily Unavailable';
            DOM.emptyMessage.textContent = 'Could not establish connection to the feed server. Please check your network and refresh.';
        }
    } finally {
        setLoadingState(false);
        DOM.forceRefreshBtn.classList.remove('spin-anim');
    }
}

function setLoadingState(isLoading) {
    if (isLoading) {
        DOM.loadingSkeletons.style.display = 'flex';
        DOM.releaseTimeline.style.display = 'none';
        DOM.emptyState.style.display = 'none';
        DOM.resultsMetaBar.style.display = 'none';
    } else {
        DOM.loadingSkeletons.style.display = 'none';
    }
}

// BUILD FILTER LISTS FROM DATA
function buildFilterOptions() {
    const types = {};
    const years = {};

    state.notes.forEach(note => {
        // Accumulate types
        types[note.type] = (types[note.type] || 0) + 1;
        // Accumulate years
        years[note.year] = (years[note.year] || 0) + 1;
    });

    // Render Update Types Filters
    DOM.typeFiltersContainer.innerHTML = '';
    const sortedTypes = Object.keys(types).sort();
    
    // Keep standard types order if possible
    const standardOrder = ['Feature', 'Change', 'Announcement', 'Issue', 'Breaking'];
    const otherTypes = sortedTypes.filter(t => !standardOrder.includes(t));
    const finalTypesList = [...standardOrder.filter(t => sortedTypes.includes(t)), ...otherTypes];

    finalTypesList.forEach(type => {
        const checked = state.filters.types.has(type) ? 'checked' : '';
        const activeClass = state.filters.types.has(type) ? 'active' : '';
        const config = CATEGORY_CONFIG[type] || CATEGORY_CONFIG['General'];
        
        const label = document.createElement('label');
        label.className = `filter-checkbox-label ${activeClass}`;
        label.id = `filter-type-${type.toLowerCase()}`;
        label.innerHTML = `
            <input type="checkbox" value="${type}" ${checked}>
            <div class="checkbox-left">
                <span class="custom-checkbox">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <span>${type}</span>
            </div>
            <span class="pill-badge type-badge" style="--badge-bg-color: ${config.bg}; --badge-color: ${config.color}">${types[type]}</span>
        `;
        
        // Add event listener
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                state.filters.types.add(type);
                label.classList.add('active');
            } else {
                state.filters.types.delete(type);
                label.classList.remove('active');
            }
            applyFilteringAndRender();
        });
        
        DOM.typeFiltersContainer.appendChild(label);
    });

    // Render Year Filters
    DOM.yearFiltersContainer.innerHTML = '';
    const sortedYears = Object.keys(years).sort((a, b) => b - a); // Reverse chronological
    
    sortedYears.forEach(year => {
        const checked = state.filters.years.has(year) ? 'checked' : '';
        const activeClass = state.filters.years.has(year) ? 'active' : '';
        
        const label = document.createElement('label');
        label.className = `filter-checkbox-label ${activeClass}`;
        label.id = `filter-year-${year}`;
        label.innerHTML = `
            <input type="checkbox" value="${year}" ${checked}>
            <div class="checkbox-left">
                <span class="custom-checkbox">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <span>${year}</span>
            </div>
            <span class="pill-badge type-badge" style="--badge-bg-color: var(--color-general-bg); --badge-color: var(--text-secondary)">${years[year]}</span>
        `;
        
        // Add event listener
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                state.filters.years.add(year);
                label.classList.add('active');
            } else {
                state.filters.years.delete(year);
                label.classList.remove('active');
            }
            applyFilteringAndRender();
        });
        
        DOM.yearFiltersContainer.appendChild(label);
    });

    // Show/Hide filter reset button
    updateFilterResetButtons();
}

// SHOW/HIDE SIDEBAR CLEAR FILTER BUTTONS
function updateFilterResetButtons() {
    const hasActiveFilters = state.filters.search !== '' || state.filters.types.size > 0 || state.filters.years.size > 0;
    DOM.clearAllFiltersBtn.style.display = hasActiveFilters ? 'block' : 'none';
}

// SEARCH FILTERS LOGIC
function handleSearchInput(e) {
    state.filters.search = e.target.value.trim().toLowerCase();
    DOM.clearSearchBtn.style.display = state.filters.search ? 'block' : 'none';
    
    // Apply filtering (Debouncing search is not necessary as local array filtering is sub-millisecond)
    applyFilteringAndRender();
}

function clearSearch() {
    DOM.searchInput.value = '';
    state.filters.search = '';
    DOM.clearSearchBtn.style.display = 'none';
    applyFilteringAndRender();
}

function resetAllFilters() {
    state.filters.search = '';
    DOM.searchInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    
    state.filters.types.clear();
    state.filters.years.clear();
    
    // Uncheck boxes in UI
    document.querySelectorAll('.filter-checkbox-label input').forEach(input => {
        input.checked = false;
        input.closest('label').classList.remove('active');
    });

    applyFilteringAndRender();
    showToast('Filters reset successfully');
}

// FILTER IMPLEMENTATION AND DRAW TIMELINE
function applyFilteringAndRender() {
    if (state.currentTab === 'stats') {
        renderInsightsDashboard();
        return;
    }

    setLoadingState(false);
    
    // Filter the notes array based on state
    let filtered = state.notes;

    // Tab filter: Bookmarks
    if (state.currentTab === 'bookmarks') {
        filtered = filtered.filter(note => state.bookmarks.includes(note.id));
    }

    // Type filter
    if (state.filters.types.size > 0) {
        filtered = filtered.filter(note => state.filters.types.has(note.type));
    }

    // Year filter
    if (state.filters.years.size > 0) {
        filtered = filtered.filter(note => state.filters.years.has(note.year));
    }

    // Search query filter
    if (state.filters.search !== '') {
        const query = state.filters.search;
        filtered = filtered.filter(note => {
            const inTitle = note.date.toLowerCase().includes(query);
            const inSummary = note.summary.toLowerCase().includes(query);
            const inType = note.type.toLowerCase().includes(query);
            return inTitle || inSummary || inType;
        });
    }

    // Render results
    renderTimelineCards(filtered);
    renderResultsMetaBar(filtered.length);
    updateFilterResetButtons();
}

// RENDER TIMELINE CARDS
function renderTimelineCards(notes) {
    DOM.releaseTimeline.innerHTML = '';
    
    if (notes.length === 0) {
        DOM.releaseTimeline.style.display = 'none';
        DOM.emptyState.style.display = 'flex';
        
        if (state.currentTab === 'bookmarks') {
            DOM.emptyTitle.textContent = 'No Bookmarked Notes';
            DOM.emptyMessage.textContent = 'Save release notes that are important to you by clicking the bookmark star icon on any update card.';
            DOM.emptyResetBtn.style.display = 'none';
        } else {
            DOM.emptyTitle.textContent = 'No results match your filters';
            DOM.emptyMessage.textContent = 'We couldn\'t find any release notes matching your search or filters. Click below to reset filters.';
            DOM.emptyResetBtn.style.display = 'inline-block';
        }
        return;
    }

    DOM.emptyState.style.display = 'none';
    DOM.releaseTimeline.style.display = 'flex';

    notes.forEach((note, index) => {
        const isStarred = state.bookmarks.includes(note.id);
        const starClass = isStarred ? 'active-star' : '';
        const config = CATEGORY_CONFIG[note.type] || CATEGORY_CONFIG['General'];
        
        // Highlight search keywords in html content
        let highlightedContent = note.content;
        if (state.filters.search) {
            highlightedContent = highlightText(note.content, state.filters.search);
        }

        const card = document.createElement('article');
        card.className = 'release-card';
        card.id = `card-${note.id}`;
        card.style.animationDelay = `${Math.min(index * 0.05, 0.8)}s`;
        card.style.setProperty('--badge-color', config.color);
        
        card.innerHTML = `
            <div class="release-card-indicator"></div>
            <div class="card-header">
                <div class="card-meta-left">
                    <span class="type-pill" style="--badge-bg-color: ${config.bg}; --badge-color: ${config.color}">
                        ${note.type}
                    </span>
                    <time class="date-text" datetime="${note.raw_date}">${note.date}</time>
                </div>
                <div class="card-actions-right">
                    <button class="card-action-btn bookmark-btn ${starClass}" title="Bookmark this release note" aria-label="Bookmark note">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                    <button class="card-action-btn copy-btn" title="Copy link to this release note" aria-label="Copy note link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    </button>
                    <button class="card-action-btn tweet-btn" title="Tweet about this release note" aria-label="Tweet note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </button>
                    ${note.link ? `
                    <a href="${note.link}" target="_blank" rel="noopener noreferrer" class="card-action-btn" title="Open official documentation link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                    ` : ''}
                </div>
            </div>
            <div class="card-body">
                ${highlightedContent}
            </div>
        `;

        // Star toggle click handler
        card.querySelector('.bookmark-btn').addEventListener('click', () => toggleBookmark(note.id));
        
        // Copy link click handler
        card.querySelector('.copy-btn').addEventListener('click', () => copyNoteLink(note));

        // Tweet click handler
        card.querySelector('.tweet-btn').addEventListener('click', () => shareOnTwitter(note));

        DOM.releaseTimeline.appendChild(card);
    });
}

// RENDERS TOP RESULTS SUMMARY BANNER
function renderResultsMetaBar(resultsCount) {
    const isSearchingOrFiltering = state.filters.search !== '' || state.filters.types.size > 0 || state.filters.years.size > 0;
    
    if (isSearchingOrFiltering && state.currentTab !== 'stats') {
        DOM.resultsCountText.textContent = `Found ${resultsCount} matching update item${resultsCount === 1 ? '' : 's'}`;
        DOM.resultsMetaBar.style.display = 'flex';
    } else {
        DOM.resultsMetaBar.style.display = 'none';
    }
}

// HIGHLIGHT SEARCH TERMS IN TEXT
function highlightText(html, search) {
    if (!search) return html;
    
    // We want to replace text node elements, not touch the tags.
    // A simplified safe approach splits the HTML into tag chunks and text chunks.
    const parts = html.split(/(<[^>]+>)/g);
    
    const highlightedParts = parts.map(part => {
        // If it starts with < it's a tag, return untouched
        if (part.startsWith('<')) return part;
        
        // It's a text chunk. Do case insensitive keyword replacement.
        // Avoid nested replacement by using a regex match on word boundaries or simple matching.
        try {
            // Escape search term for regex
            const escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            return part.replace(regex, '<mark style="background-color: rgba(79, 70, 229, 0.3); color: #fff; padding: 0 2px; border-radius: 2px;">$1</mark>');
        } catch (e) {
            return part;
        }
    });
    
    return highlightedParts.join('');
}

// BOOKMARK CONTROLLER
function toggleBookmark(noteId) {
    const btn = document.querySelector(`#card-${noteId} .bookmark-btn`);
    const index = state.bookmarks.indexOf(noteId);
    
    if (index === -1) {
        // Star it
        state.bookmarks.push(noteId);
        showToast('Release note added to bookmarks!');
        if (btn) {
            btn.classList.add('active-star');
            btn.querySelector('svg').setAttribute('fill', 'currentColor');
        }
    } else {
        // Unstar it
        state.bookmarks.splice(index, 1);
        showToast('Release note removed from bookmarks.');
        if (btn) {
            btn.classList.remove('active-star');
            btn.querySelector('svg').setAttribute('fill', 'none');
        }
        
        // If on Bookmarks Tab, fade out card immediately and re-render
        if (state.currentTab === 'bookmarks') {
            const card = document.getElementById(`card-${noteId}`);
            if (card) {
                card.style.transform = 'scale(0.95)';
                card.style.opacity = '0';
                card.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    applyFilteringAndRender();
                }, 280);
            }
        }
    }
    
    // Save to LocalStorage
    localStorage.setItem('bq_bookmarks', JSON.stringify(state.bookmarks));
    
    // Update notifications and badge
    updateBookmarkBadgeCount();
}

function updateBookmarkBadgeCount() {
    const count = state.bookmarks.length;
    if (count > 0) {
        DOM.bookmarkBadgeCount.textContent = count;
        DOM.bookmarkBadgeCount.style.display = 'inline-block';
    } else {
        DOM.bookmarkBadgeCount.style.display = 'none';
    }
}

// COPY DEEP LINK TO CLIPBOARD
function copyNoteLink(note) {
    // Construct local link or direct URL
    const url = note.link || `${window.location.origin}/#card-${note.id}`;
    
    navigator.clipboard.writeText(url).then(() => {
        showToast('Documentation link copied to clipboard!');
    }).catch(err => {
        console.error('Could not copy link:', err);
        showToast('Failed to copy link.');
    });
}

// SHARE ON TWITTER / X
function shareOnTwitter(note) {
    // Trim summary text to fit in a tweet
    let text = note.summary;
    if (text.length > 150) {
        text = text.substring(0, 147) + '...';
    }
    
    // Format the tweet content
    const link = note.link || `${window.location.origin}/#card-${note.id}`;
    const tweetText = `BigQuery Release Update [${note.type}] (${note.date}):\n\n"${text}"\n\nRead more details here:\n${link}\n\n#BigQuery #GoogleCloud #GCP`;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    showToast('Opening Twitter/X compose window...');
}


// STATS DASHBOARD RENDERER
function renderInsightsDashboard() {
    const total = state.notes.length;
    if (total === 0) return;

    // Calculate distributions
    let featureCount = 0;
    let issuesCount = 0;
    const typeDistribution = {};
    const monthlyDistribution = {};

    state.notes.forEach(note => {
        // Categorize for cards
        if (note.type === 'Feature') featureCount++;
        if (note.type === 'Issue' || note.type === 'Breaking') issuesCount++;

        // Detailed count for chart
        typeDistribution[note.type] = (typeDistribution[note.type] || 0) + 1;

        // Group by month: parse dates like "June 16, 2026" or "2026-06-16..."
        // A simple parse of format: "June 16, 2026" -> get "June 2026" or similar
        let monthYearStr = "Unknown";
        try {
            // Get date object or split string
            const dateParts = note.date.split(', ');
            if (dateParts.length === 2) {
                const monthDay = dateParts[0].split(' ');
                const year = dateParts[1];
                if (monthDay.length === 2) {
                    const month = monthDay[0];
                    monthYearStr = `${month.substring(0, 3)} ${year}`;
                }
            }
        } catch (e) {
            monthYearStr = "Unknown";
        }
        
        monthlyDistribution[monthYearStr] = (monthlyDistribution[monthYearStr] || 0) + 1;
    });

    // Populate Top Cards
    DOM.statsTotalItems.textContent = total;
    DOM.statsTotalFeatures.textContent = featureCount;
    DOM.statsFeaturePct.textContent = `${Math.round((featureCount / total) * 100)}% of total updates`;
    DOM.statsTotalIssues.textContent = issuesCount;
    DOM.statsIssuesPct.textContent = `${Math.round((issuesCount / total) * 100)}% of total updates`;

    if (state.notes.length > 0) {
        const latestNote = state.notes[0];
        DOM.statsLatestDate.textContent = latestNote.date;
        
        // Calculate days ago
        try {
            const rawDateStr = latestNote.raw_date.substring(0, 10); // "YYYY-MM-DD"
            const updatedDate = new Date(rawDateStr);
            const today = new Date();
            // Clear hour variables
            today.setHours(0,0,0,0);
            updatedDate.setHours(0,0,0,0);
            
            const diffTime = Math.abs(today - updatedDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                DOM.statsDaysAgo.textContent = 'Published today';
            } else if (diffDays === 1) {
                DOM.statsDaysAgo.textContent = 'Published yesterday';
            } else {
                DOM.statsDaysAgo.textContent = `${diffDays} days ago`;
            }
        } catch (e) {
            DOM.statsDaysAgo.textContent = 'Recent release';
        }
    }

    // DRAW SVG DONUT CHART (Distribution)
    drawDonutChart(typeDistribution);

    // DRAW SVG BAR CHART (Trends over time)
    drawBarChart(monthlyDistribution);

    // GENERATE TEXT INSIGHTS
    generateTextInsights(typeDistribution, monthlyDistribution, featureCount, issuesCount);
}

// DRAWS A BEAUTIFUL DONUT CHART WITH SVG
function drawDonutChart(distribution) {
    const keys = Object.keys(distribution).sort((a,b) => distribution[b] - distribution[a]);
    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    
    let chartHtml = '';
    let accumAngle = 0;
    
    // Draw SVG circle segments
    // Radius = 60, Center = (100, 100), Circumference = 2 * PI * 60 ≈ 376.99
    const radius = 60;
    const cx = 100;
    const cy = 100;
    const circum = 2 * Math.PI * radius;

    // Default label colors for the SVG chart
    const labelColorText = state.theme === 'dark' ? '#f8fafc' : '#0f172a';
    const subColorText = state.theme === 'dark' ? '#94a3b8' : '#475569';

    keys.forEach((key, index) => {
        const count = distribution[key];
        const pct = count / total;
        const strokeDashOffset = circum - (pct * circum);
        const rotation = accumAngle * 360;
        const config = CATEGORY_CONFIG[key] || CATEGORY_CONFIG['General'];

        chartHtml += `
            <circle class="chart-donut-segment"
                cx="${cx}" cy="${cy}" r="${radius}"
                fill="transparent"
                stroke="${config.color}"
                stroke-width="12"
                stroke-dasharray="${circum}"
                stroke-dashoffset="${strokeDashOffset}"
                transform="rotate(${(rotation - 90)} ${cx} ${cy})"
                data-type="${key}"
                data-pct="${Math.round(pct * 100)}">
                <title>${key}: ${count} (${Math.round(pct * 100)}%)</title>
            </circle>
        `;
        accumAngle += pct;
    });

    // Add center text
    chartHtml += `
        <circle cx="${cx}" cy="${cy}" r="${radius - 12}" fill="var(--bg-card)" />
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-weight="700" font-family="var(--font-heading)" font-size="18" fill="${labelColorText}">
            ${total}
        </text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="var(--font-primary)" font-size="9" fill="${subColorText}" font-weight="500">
            UPDATES
        </text>
    `;

    DOM.chartDistributionSvg.innerHTML = chartHtml;

    // Draw Legend Table
    DOM.chartDistributionLegend.innerHTML = '';
    keys.forEach(key => {
        const count = distribution[key];
        const pct = Math.round((count / total) * 100);
        const config = CATEGORY_CONFIG[key] || CATEGORY_CONFIG['General'];

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <span class="legend-color" style="background-color: ${config.color}"></span>
            <span class="legend-text" style="font-weight: 500">${key}: <strong>${count}</strong> (${pct}%)</span>
        `;
        DOM.chartDistributionLegend.appendChild(item);
    });
}

// DRAWS A BEAUTIFUL TREND BAR CHART WITH SVG
function drawBarChart(monthlyData) {
    // Sort month entries chronologically
    // In Google Cloud Release feed it's 30 items, representing about 4-6 months
    const sortedMonths = Object.keys(monthlyData).sort((a,b) => {
        // simple date parse comparator e.g., "Jun 2026"
        const parseMonthYear = (str) => {
            const parts = str.split(' ');
            if (parts.length !== 2) return new Date();
            const monthMap = { 'Jan':0,'Feb':1,'Mar':2,'Apr':3,'May':4,'Jun':5,'Jul':6,'Aug':7,'Sep':8,'Oct':9,'Nov':10,'Dec':11 };
            return new Date(parts[1], monthMap[parts[0]] || 0);
        };
        return parseMonthYear(a) - parseMonthYear(b);
    });

    // Filter out unknown dates if any
    const months = sortedMonths.filter(m => m !== 'Unknown');
    const counts = months.map(m => monthlyData[m]);
    const maxVal = Math.max(...counts, 4); // Clamp minimum height scale to 4

    const svgWidth = 500;
    const svgHeight = 220;
    const paddingLeft = 36;
    const paddingRight = 16;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;
    const axisColor = state.theme === 'dark' ? '#222f4d' : '#e2e8f0';
    const gridColor = state.theme === 'dark' ? 'rgba(34, 47, 77, 0.4)' : 'rgba(226, 232, 240, 0.4)';
    const textColor = state.theme === 'dark' ? '#94a3b8' : '#475569';

    let chartHtml = '';

    // Draw horizontal Gridlines (4 lines)
    const gridLinesCount = 4;
    for (let i = 0; i <= gridLinesCount; i++) {
        const y = paddingTop + (chartHeight * i / gridLinesCount);
        const labelVal = Math.round(maxVal - (maxVal * i / gridLinesCount));
        
        chartHtml += `
            <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="${gridColor}" stroke-dasharray="3,3" />
            <text x="${paddingLeft - 8}" y="${y + 3}" text-anchor="end" class="chart-text" fill="${textColor}">${labelVal}</text>
        `;
    }

    // Draw bars
    const barCount = months.length;
    if (barCount > 0) {
        const spacing = 16;
        const totalSpacing = spacing * (barCount - 1);
        const barWidth = (chartWidth - totalSpacing) / barCount;

        months.forEach((month, index) => {
            const val = monthlyData[month];
            const pct = val / maxVal;
            const barHeight = chartHeight * pct;
            
            const x = paddingLeft + index * (barWidth + spacing);
            const y = svgHeight - paddingBottom - barHeight;

            // Gradient fill ID
            const fillGradient = `linear-gradient-${index}`;

            chartHtml += `
                <defs>
                    <linearGradient id="${fillGradient}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--accent-secondary)"/>
                        <stop offset="100%" stop-color="var(--accent-primary)"/>
                    </linearGradient>
                </defs>
                <!-- Rounded top bar -->
                <rect class="chart-bar"
                    x="${x}" y="${y}" 
                    width="${barWidth}" height="${barHeight}" 
                    rx="4" ry="4"
                    fill="url(#${fillGradient})">
                    <title>${month}: ${val} updates</title>
                </rect>
                <!-- X-Axis label -->
                <text x="${x + barWidth / 2}" y="${svgHeight - 12}" text-anchor="middle" class="chart-text" fill="${textColor}">
                    ${month}
                </text>
            `;
        });
    }

    // Draw base axis line
    chartHtml += `
        <line x1="${paddingLeft}" y1="${svgHeight - paddingBottom}" x2="${svgWidth - paddingRight}" y2="${svgHeight - paddingBottom}" stroke="${axisColor}" stroke-width="1.5" />
    `;

    DOM.chartTrendsSvg.innerHTML = chartHtml;
}

// INSIGHTS CONTENT GENERATOR
function generateTextInsights(typeDist, monthlyDist, features, issues) {
    const list = DOM.insightsBullets;
    list.innerHTML = '';

    const insights = [];

    // Most common update type
    const sortedTypes = Object.keys(typeDist).sort((a,b) => typeDist[b] - typeDist[a]);
    if (sortedTypes.length > 0) {
        const topType = sortedTypes[0];
        insights.push(`<strong>${topType}s</strong> are the most frequent type of updates, comprising <strong>${Math.round((typeDist[topType] / state.notes.length) * 100)}%</strong> of the parsed feed.`);
    }

    // Release Velocity Insight
    const activeMonths = Object.keys(monthlyDist).sort((a,b) => monthlyDist[b] - monthlyDist[a]);
    if (activeMonths.length > 0) {
        const topMonth = activeMonths[0];
        insights.push(`Release activity peaked in <strong>${topMonth}</strong> with a total of <strong>${monthlyDist[topMonth]}</strong> parsed update items.`);
    }

    // Features vs issues ratio
    if (features > 0) {
        if (issues > 0) {
            const ratio = (features / issues).toFixed(1);
            insights.push(`Product development maintains a constructive <strong>${ratio}:1</strong> ratio of user features relative to bugs and breaking issues.`);
        } else {
            insights.push(`Excellent stability index: There are zero reported open issues/breaking changes in the active feed window, focusing purely on features and change improvements.`);
        }
    }

    // Parse items to find if there are any "Breaking" changes
    const breakingCount = typeDist['Breaking'] || 0;
    if (breakingCount > 0) {
        insights.push(`Caution: There are <strong>${breakingCount} breaking updates</strong> in this feed window. Review these changes to ensure backend integrations are not impacted.`);
    } else {
        insights.push(`Integration check: No critical breaking updates have been reported in this feed's current timeline. upgrades should be safe to run.`);
    }

    // Populate UI
    insights.forEach(insight => {
        const li = document.createElement('li');
        li.innerHTML = insight;
        list.appendChild(li);
    });
}
