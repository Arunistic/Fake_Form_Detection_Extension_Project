// blacklist.js
// Blacklist/Whitelist management system using Chrome storage

/**
 * Blacklist/Whitelist Manager
 */
class DomainListManager {
  constructor() {
    this.storageKey = 'ffd_domain_lists';
    this.init();
  }

  async init() {
    // Initialize with default lists if not exists
    const data = await this.getLists();
    if (!data.blacklist) {
      await this.setLists({
        blacklist: [],
        whitelist: [],
        lastUpdated: Date.now()
      });
    }
  }

  async getLists() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([this.storageKey], (result) => {
          resolve(result[this.storageKey] || { blacklist: [], whitelist: [] });
        });
      } else {
        // Fallback for testing
        const stored = localStorage.getItem(this.storageKey);
        resolve(stored ? JSON.parse(stored) : { blacklist: [], whitelist: [] });
      }
    });
  }

  async setLists(lists) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [this.storageKey]: lists }, () => resolve());
      } else {
        // Fallback for testing
        localStorage.setItem(this.storageKey, JSON.stringify(lists));
        resolve();
      }
    });
  }

  async addToBlacklist(domain) {
    const lists = await this.getLists();
    if (!lists.blacklist.includes(domain)) {
      lists.blacklist.push(domain);
      lists.lastUpdated = Date.now();
      await this.setLists(lists);
    }
    return lists;
  }

  async addToWhitelist(domain) {
    const lists = await this.getLists();
    if (!lists.whitelist.includes(domain)) {
      lists.whitelist.push(domain);
      lists.lastUpdated = Date.now();
      await this.setLists(lists);
    }
    return lists;
  }

  async removeFromBlacklist(domain) {
    const lists = await this.getLists();
    lists.blacklist = lists.blacklist.filter(d => d !== domain);
    lists.lastUpdated = Date.now();
    await this.setLists(lists);
    return lists;
  }

  async removeFromWhitelist(domain) {
    const lists = await this.getLists();
    lists.whitelist = lists.whitelist.filter(d => d !== domain);
    lists.lastUpdated = Date.now();
    await this.setLists(lists);
    return lists;
  }

  async isBlacklisted(domain) {
    const lists = await this.getLists();
    return lists.blacklist.includes(domain);
  }

  async isWhitelisted(domain) {
    const lists = await this.getLists();
    return lists.whitelist.includes(domain);
  }

  async syncWithBackend(backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/domain-lists`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        await this.setLists({
          blacklist: data.blacklist || [],
          whitelist: data.whitelist || [],
          lastUpdated: Date.now()
        });
        return true;
      }
    } catch (error) {
      console.warn('Backend sync failed:', error);
    }
    return false;
  }
}

// Export singleton instance
const domainListManager = new DomainListManager();

// Export for use in other files
if (typeof window !== 'undefined') {
  window.__ffd_domainList = domainListManager;
}

// For service worker context
if (typeof self !== 'undefined') {
  self.__ffd_domainList = domainListManager;
}
