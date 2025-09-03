/**
 * Optimized Portfolio System - Combined modules for better performance
 */

// Analytics System
class Analytics {
    constructor() {
        this.events = [];
        this.sessionStart = Date.now();
        this.popularProjects = new Map();
        this.loadStoredData();
    }

    track(eventType, data = {}) {
        const event = {
            type: eventType,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStart,
            isMobile: window.innerWidth <= 768,
            ...data
        };
        
        this.events.push(event);
        this.processEvent(event);
        this.saveToStorage();
    }

    processEvent(event) {
        if (event.type === 'project_view') {
            const count = this.popularProjects.get(event.projectId) || 0;
            this.popularProjects.set(event.projectId, count + 1);
        }
    }

    getInsights() {
        const totalViews = this.events.filter(e => e.type === 'project_view').length;
        const mobileViews = this.events.filter(e => e.type === 'project_view' && e.isMobile).length;
        const searchQueries = this.events.filter(e => e.type === 'search_query').length;
        
        return {
            totalViews,
            mobileViews,
            searchQueries,
            sessionTime: Date.now() - this.sessionStart,
            popularProjects: Array.from(this.popularProjects.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
            totalSessions: this.getTotalSessions(),
            mobileUsageRatio: totalViews > 0 ? (mobileViews / totalViews) * 100 : 0
        };
    }

    loadStoredData() {
        try {
            const stored = localStorage.getItem('portfolio_analytics');
            if (stored) {
                const data = JSON.parse(stored);
                this.popularProjects = new Map(data.popularProjects || []);
            }
        } catch (e) {
            console.warn('Could not load analytics data:', e);
        }
    }

    saveToStorage() {
        try {
            const data = {
                popularProjects: Array.from(this.popularProjects.entries()),
                lastUpdate: Date.now()
            };
            localStorage.setItem('portfolio_analytics', JSON.stringify(data));
        } catch (e) {
            console.warn('Could not save analytics data:', e);
        }
    }

    getTotalSessions() {
        try {
            const sessions = localStorage.getItem('portfolio_sessions') || '0';
            const count = parseInt(sessions) + 1;
            localStorage.setItem('portfolio_sessions', count.toString());
            return count;
        } catch (e) {
            return 1;
        }
    }
}

// Portfolio Loader
class PortfolioLoader {
    async loadProjectsWithProgress() {
        try {
            const response = await fetch('/projects.json');
            const projects = await response.json();
            return Array.isArray(projects) ? projects : [];
        } catch (error) {
            console.error('Failed to load projects:', error);
            return [];
        }
    }
}

// Search System  
class SmartSearch {
    constructor(projects) {
        this.projects = projects;
        this.searchIndex = this.buildSearchIndex(projects);
    }

    buildSearchIndex(projects) {
        return projects.map(project => ({
            ...project,
            searchText: `${project.title} ${project.description} ${project.type} ${(project.tags || []).join(' ')}`.toLowerCase()
        }));
    }

    search(query) {
        if (!query.trim()) return this.projects;
        
        const terms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        return this.searchIndex.filter(project => 
            terms.every(term => project.searchText.includes(term))
        );
    }

    createSearchInterface() {
        const searchWindow = document.createElement('div');
        searchWindow.className = 'window';
        searchWindow.id = 'search-window';
        searchWindow.style.cssText = 'width: 500px; display: none; z-index: 1000;';
        
        searchWindow.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">🔍 Search Projects</div>
                <div class="title-bar-controls">
                    <button class="minimize-btn" aria-label="Minimize"></button>
                    <button class="close-btn" aria-label="Close"></button>
                </div>
            </div>
            <div class="window-body">
                <div class="field-row">
                    <label for="search-input">Search:</label>
                    <input type="text" id="search-input" placeholder="Type to search projects..." style="width: 100%;">
                </div>
                <div class="sunken-panel" id="search-results" style="height: 300px; overflow-y: auto; margin-top: 10px; padding: 5px;">
                    <p style="color: #666; text-align: center;">Start typing to search projects...</p>
                </div>
            </div>
        `;
        
        this.setupSearchEvents(searchWindow);
        return searchWindow;
    }

    setupSearchEvents(searchWindow) {
        const searchInput = searchWindow.querySelector('#search-input');
        const resultsDiv = searchWindow.querySelector('#search-results');
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const results = this.search(e.target.value);
                this.displayResults(results, resultsDiv);
            }, 300);
        });
    }

    displayResults(results, container) {
        if (results.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">No projects found.</p>';
            return;
        }

        container.innerHTML = results.map(project => `
            <div class="search-result-item" style="border-bottom: 1px solid #ddd; padding: 8px; cursor: pointer;" 
                 onclick="window.showProjectDetail && showProjectDetail(${JSON.stringify(project).replace(/"/g, '&quot;')})">
                <div style="font-weight: bold; font-size: 12px;">${project.title}</div>
                <div style="font-size: 10px; color: #666; margin: 2px 0;">${project.type} • ${project.date}</div>
                <div style="font-size: 10px;">${project.description.substring(0, 100)}${project.description.length > 100 ? '...' : ''}</div>
            </div>
        `).join('');
    }
}

// Main Portfolio System
class PortfolioSystem {
    constructor() {
        this.loader = new PortfolioLoader();
        this.analytics = new Analytics();
        this.projects = [];
        this.search = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.projects = await this.loader.loadProjectsWithProgress();
            this.search = new SmartSearch(this.projects);
            
            const searchWindow = this.search.createSearchInterface();
            document.body.appendChild(searchWindow);
            
            this.setupGlobalHotkeys(searchWindow);
            this.setupProjectRecommendations();
            
            this.analytics.track('portfolio_loaded', {
                projectCount: this.projects.length,
                isMobile: window.innerWidth <= 768,
                loadTime: Date.now() - this.analytics.sessionStart
            });
            
            this.isInitialized = true;
            console.log('🚀 Portfolio system loaded');
            
        } catch (error) {
            console.error('Failed to initialize portfolio:', error);
            this.analytics.track('load_error', { error: error.message });
        }
    }

    setupGlobalHotkeys(searchWindow) {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.openSearch(searchWindow);
            }
            
            if (e.key === 'Escape' && searchWindow.style.display !== 'none') {
                searchWindow.style.display = 'none';
            }
        });
    }

    openSearch(searchWindow) {
        searchWindow.style.display = 'block';
        const searchInput = searchWindow.querySelector('#search-input');
        if (searchInput) searchInput.focus();
        this.analytics.track('search_opened');
    }

    setupProjectRecommendations() {
        const originalShowProjectDetail = window.showProjectDetail;
        
        window.showProjectDetail = (project) => {
            this.analytics.track('project_view', { 
                projectId: project.id,
                projectType: project.type,
                isMobile: window.innerWidth <= 768
            });
            
            if (originalShowProjectDetail) {
                originalShowProjectDetail(project);
            }
        };
    }

    getAnalytics() {
        return this.analytics.getInsights();
    }

    getProjects() {
        return this.projects;
    }

    searchProjects(query) {
        return this.search ? this.search.search(query) : this.projects;
    }
}

// Initialize system
const portfolioSystem = new PortfolioSystem();
document.addEventListener('DOMContentLoaded', () => portfolioSystem.initialize());

// Global exports
window.portfolioSystem = portfolioSystem;
window.enhancedPortfolio = portfolioSystem;