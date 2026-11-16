/**
 * Optimized Portfolio System - Search and indexing for SidePortfolio
 */

import {
    escapeHtml,
    formatDate,
    extractMiniDescription,
    showProjectDetail
} from './projects.js';
import {
    bringToFront,
    closeWindow,
    minimizeWindow,
    setupDragging
} from './windows.js';

// Portfolio Loader
class PortfolioLoader {
    async loadProjectsWithProgress() {
        try {
            const response = await fetch('projects.json');
            const projects = await response.json();
            return Array.isArray(projects) ? projects.filter(p => p.enabled) : [];
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
        this.miniDescMap = new Map();
        this.searchIndex = this.buildSearchIndex(projects);
        this.hydrateDescriptions(projects);
    }

    buildSearchIndex(projects) {
        return projects.map(project => {
            const desc = this.miniDescMap.get(project.id) || project.description || '';
            return {
                ...project,
                miniDescription: desc,
                searchText: `${project.title || ''} ${desc} ${project.type || ''} ${project.role || ''} ${(project.tags || []).join(' ')}`.toLowerCase()
            };
        });
    }

    async hydrateDescriptions(projects) {
        await Promise.all(projects.map(async (project) => {
            if (project.description) {
                this.miniDescMap.set(project.id, project.description);
                return;
            }
            if (!project.contentPath) return;
            try {
                const path = (!project.contentPath.startsWith('http') && !project.contentPath.startsWith('/'))
                    ? 'projects/' + project.contentPath
                    : project.contentPath;
                const res = await fetch(encodeURI(path));
                if (!res.ok) return;
                const text = await res.text();
                const mini = extractMiniDescription(text);
                if (mini) {
                    this.miniDescMap.set(project.id, mini);
                }
            } catch (e) {
                // Ignore individual fetch errors
            }
        }));
        this.searchIndex = this.buildSearchIndex(this.projects);
    }

    search(query) {
        if (!query.trim()) return this.searchIndex;

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
                <div class="title-bar-text">Search Projects</div>
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
        const closeBtn = searchWindow.querySelector('.close-btn');
        const minimizeBtn = searchWindow.querySelector('.minimize-btn');

        if (closeBtn) closeBtn.addEventListener('click', () => closeWindow(searchWindow));
        if (minimizeBtn) minimizeBtn.addEventListener('click', () => minimizeWindow(searchWindow));
        searchWindow.addEventListener('mousedown', () => bringToFront(searchWindow));

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const results = this.search(e.target.value);
                this.displayResults(results, resultsDiv);
            }, 200);
        });

        resultsDiv.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (!item) return;
            const projId = item.getAttribute('data-project-id');
            const project = this.projects.find(p => p.id === projId);
            if (project) {
                showProjectDetail(project);
            }
        });
    }

    displayResults(results, container) {
        if (results.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">No projects found.</p>';
            return;
        }

        container.innerHTML = results.map(project => {
            const desc = project.miniDescription || project.description || project.role || '';
            const snippet = desc.length > 120 ? desc.substring(0, 120) + '...' : desc;
            return `
                <div class="search-result-item" data-project-id="${escapeHtml(project.id)}" style="border-bottom: 1px solid #ddd; padding: 8px; cursor: pointer;">
                    <div style="font-weight: bold; font-size: 12px;">${escapeHtml(project.title)}</div>
                    <div style="font-size: 10px; color: #666; margin: 2px 0;">${escapeHtml(project.type)} | ${escapeHtml(formatDate(project.date))}</div>
                    ${snippet ? `<div style="font-size: 10px;">${escapeHtml(snippet)}</div>` : ''}
                </div>
            `;
        }).join('');
    }
}

// Main Portfolio System
class PortfolioSystem {
    constructor() {
        this.loader = new PortfolioLoader();
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
            setupDragging(searchWindow);

            this.setupGlobalHotkeys(searchWindow);

            this.isInitialized = true;
            console.log('Portfolio system loaded');
        } catch (error) {
            console.error('Failed to initialize portfolio:', error);
        }
    }

    setupGlobalHotkeys(searchWindow) {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.openSearch(searchWindow);
            }

            if (e.key === 'Escape' && searchWindow.style.display !== 'none') {
                closeWindow(searchWindow);
            }
        });
    }

    openSearch(searchWindow) {
        searchWindow.style.display = 'block';
        bringToFront(searchWindow);
        const searchInput = searchWindow.querySelector('#search-input');
        if (searchInput) searchInput.focus();
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
