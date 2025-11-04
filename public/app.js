/**
 * Main App - Tab Navigation
 */

class App {
  constructor() {
    this.currentTab = 'csv';
    this.init();
  }

  init() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Set initial tab
    this.switchTab(this.currentTab);
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update editor containers
    document.querySelectorAll('.editor-container').forEach(container => {
      if (container.id === `${tabId}-editor`) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
  });
} else {
  window.app = new App();
}
