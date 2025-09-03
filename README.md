# Hi I'm ULUÇ KAYMAK
A person who loves learning and creating new things.

I am a multidisciplinary artist who combines conceptual art with the figurative aspects of the culture I was born and raised, in auditory and/or visual, interactive, and algorithmic forms. My projects often revolve around themes such as human perception, experience, and psychology.

I love retro-futurism and cats.
And this is my alternative portfolio for now.

---

## 🚀 Portfolio System - Technical Overview

This portfolio has been refactored into a modern, modular architecture while maintaining its retro Windows 2000 aesthetic.

### 🏗️ Modular Architecture

**Core Modules (`/scripts/core/`)**
- `portfolio-loader.js` - Enhanced project loading with progress indicators
- `portfolio-system.js` - Central orchestrator coordinating all modules

**Feature Modules (`/scripts/features/`)**
- `search-system.js` - Smart search with mobile optimization
- `enhanced-about.js` - Interactive terminal-style about section

**Mobile Enhancements (`/scripts/mobile/`)**
- `mobile-enhancements.js` - Touch interactions, pull-to-refresh, keyboard handling

**Utilities (`/scripts/utils/`)**
- `analytics.js` - Privacy-friendly usage analytics

### 📱 Mobile Experience Improvements

- **Full-screen windows** with proper viewport handling
- **Touch-optimized interactions** with haptic feedback
- **Responsive layouts** for all screen sizes
- **Pull-to-refresh** functionality
- **Virtual keyboard** handling
- **Safe area insets** for modern devices

### 🎯 Key Features

**Desktop:**
- Authentic Windows 2000 UI with draggable windows
- Featured projects carousel with auto-rotation
- Advanced search (Ctrl+F)
- Project recommendations

**Mobile:**
- Single-tap interactions
- Full-screen modal windows
- Touch-friendly project galleries
- Mobile-optimized search

**Universal:**
- Smart project search with relevance scoring
- Privacy-friendly analytics
- Keyboard navigation support
- Accessibility enhancements

### 🔧 Usage

```javascript
// Access the portfolio system
const portfolio = window.portfolioSystem;

// Get insights
const insights = portfolio.getAnalytics();

// Search projects  
const results = portfolio.searchProjects('interactive art');
```

The system initializes automatically - no manual setup required!