// common.js - Shared Configuration and Utilities

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

// --- SHARED UTILITIES ---

/**
 * Sanitizes a string to prevent XSS.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'info' or 'error'.
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        // Create if missing (Self-healing)
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;

    // Apply styling based on type
    // Note: The main styling is in style.css (.toast)
    // We just override colors for error if needed, although style.css might handle it better if we added a class.
    if (type === 'error') {
        toast.style.background = '#ffadad';
        // toast.style.border = '1px solid #d15656'; // Border removed in new UI style
        toast.classList.add('error');
    }

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

/**
 * Debounce function to limit rate of execution.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Copy text to clipboard and show toast.
 */
function copyToClipboard(text) {
    if (!navigator.clipboard) {
        // Fallback or error
        showToast('Clipboard API not supported', 'error');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied: ' + text, 'success');
    }).catch(err => {
        console.error('Copy failed', err);
        showToast('Failed to copy', 'error');
    });
}
