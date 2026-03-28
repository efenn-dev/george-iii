/**
 * Shorts Bot Dashboard - Main JavaScript
 * Handles UI interactions, API polling, and real-time updates
 */

const API_BASE = '';
const REFRESH_INTERVAL = 10000; // 10 seconds

// DOM Elements
const sections = {
    status: document.getElementById('status-section'),
    jobs: document.getElementById('jobs-section'),
    submit: document.getElementById('submit-section'),
    activity: document.getElementById('activity-section')
};

const navLinks = document.querySelectorAll('.nav-link');
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');
const lastUpdateTime = document.getElementById('last-update-time');
const jobsBadge = document.getElementById('jobs-badge');

// State
let currentStatus = {};
let jobs = [];
let activities = [];

// Initialize
function init() {
    setupNavigation();
    setupForm();
    setupClearButton();
    
    // Initial load
    refreshData();
    loadJobs();
    loadActivity();
    
    // Start polling
    setInterval(refreshData, REFRESH_INTERVAL);
    setInterval(loadJobs, REFRESH_INTERVAL);
    setInterval(loadActivity, REFRESH_INTERVAL);
}

// Navigation
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            switchSection(section);
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function switchSection(sectionName) {
    Object.values(sections).forEach(section => {
        section.classList.remove('active');
    });
    
    if (sections[sectionName]) {
        sections[sectionName].classList.add('active');
    }
}

// API Functions
async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        if (!response.ok) throw new Error('Failed to fetch status');
        return await response.json();
    } catch (error) {
        console.error('Error fetching status:', error);
        return null;
    }
}

async function fetchJobs() {
    try {
        const response = await fetch(`${API_BASE}/api/jobs`);
        if (!response.ok) throw new Error('Failed to fetch jobs');
        return await response.json();
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return null;
    }
}

async function fetchActivity() {
    try {
        const response = await fetch(`${API_BASE}/api/activity`);
        if (!response.ok) throw new Error('Failed to fetch activity');
        return await response.json();
    } catch (error) {
        console.error('Error fetching activity:', error);
        return null;
    }
}

async function submitJob(jobData) {
    try {
        const response = await fetch(`${API_BASE}/api/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error submitting job:', error);
        return { error: error.message };
    }
}

async function clearCompletedJobs() {
    try {
        const response = await fetch(`${API_BASE}/api/jobs/clear`, {
            method: 'POST'
        });
        return await response.json();
    } catch (error) {
        console.error('Error clearing jobs:', error);
        return { error: error.message };
    }
}

// Update Functions
function refreshData() {
    fetchStatus().then(status => {
        if (status) {
            currentStatus = status;
            updateStatusUI(status);
            updateConnectionStatus(true);
        } else {
            updateConnectionStatus(false);
        }
    });
}

function loadJobs() {
    fetchJobs().then(data => {
        if (data && data.jobs) {
            jobs = data.jobs;
            updateJobsUI(jobs);
            updateJobsBadge(jobs);
        }
    });
}

function loadActivity() {
    fetchActivity().then(data => {
        if (data && data.activities) {
            activities = data.activities;
            updateActivityUI(activities);
        }
    });
}

// UI Updates
function updateConnectionStatus(connected) {
    if (connected) {
        connectionDot.classList.remove('offline');
        connectionDot.classList.add('online');
        connectionText.textContent = 'Connected';
    } else {
        connectionDot.classList.remove('online');
        connectionDot.classList.add('offline');
        connectionText.textContent = 'Disconnected';
    }
    
    lastUpdateTime.textContent = new Date().toLocaleTimeString();
}

function updateStatusUI(status) {
    // Bot Status
    const botStatusEl = document.getElementById('bot-status');
    const botDot = botStatusEl.querySelector('.status-dot');
    const botText = botStatusEl.querySelector('.status-text');
    
    if (status.bot_status === 'online') {
        botDot.className = 'status-dot online';
        botText.textContent = 'Online';
    } else if (status.bot_status === 'running') {
        botDot.className = 'status-dot warning';
        botText.textContent = 'Running...';
    } else {
        botDot.className = 'status-dot offline';
        botText.textContent = 'Offline';
    }
    
    // FFmpeg Status
    const ffmpegStatusEl = document.getElementById('ffmpeg-status');
    const ffmpegDot = ffmpegStatusEl.querySelector('.status-dot');
    const ffmpegText = ffmpegStatusEl.querySelector('.status-text');
    
    if (status.ffmpeg_available) {
        ffmpegDot.className = 'status-dot online';
        ffmpegText.textContent = 'Available';
    } else {
        ffmpegDot.className = 'status-dot offline';
        ffmpegText.textContent = 'Not Found';
    }
    
    // Config Status
    const configStatusEl = document.getElementById('config-status');
    const configDot = configStatusEl.querySelector('.status-dot');
    const configText = configStatusEl.querySelector('.status-text');
    
    if (status.config_loaded) {
        configDot.className = 'status-dot online';
        configText.textContent = 'Loaded';
    } else {
        configDot.className = 'status-dot offline';
        configText.textContent = 'Not Found';
    }
    
    // Job Stats
    if (status.job_counts) {
        document.getElementById('stat-queued').textContent = status.job_counts.queued || 0;
        document.getElementById('stat-processing').textContent = status.job_counts.processing || 0;
        document.getElementById('stat-completed').textContent = status.job_counts.completed || 0;
        document.getElementById('stat-failed').textContent = status.job_counts.failed || 0;
        document.getElementById('stat-total').textContent = status.job_counts.total || 0;
    }
    
    // Cron Jobs
    updateCronJobsUI(status.cron_jobs || []);
}

function updateCronJobsUI(cronJobs) {
    const container = document.getElementById('cron-jobs-container');
    
    if (cronJobs.length === 0) {
        container.innerHTML = '<p class="empty-state">No scheduled uploads</p>';
        return;
    }
    
    container.innerHTML = cronJobs.map(job => `
        <div class="cron-job-item">
            <div class="cron-job-info">
                <h4>${escapeHtml(job.title)}</h4>
                <div class="cron-job-meta">
                    Scheduled: ${formatDate(job.scheduled_for)} | 
                    Platforms: ${job.platforms.join(', ')}
                </div>
            </div>
            <span class="job-status scheduled">Scheduled</span>
        </div>
    `).join('');
}

function updateJobsUI(jobs) {
    const tbody = document.getElementById('jobs-tbody');
    const emptyMsg = document.getElementById('jobs-empty');
    
    if (jobs.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    
    emptyMsg.style.display = 'none';
    
    tbody.innerHTML = jobs.slice(0, 50).map(job => `
        <tr>
            <td><code>${job.id.substring(0, 8)}...</code></td>
            <td>${escapeHtml(job.title)}</td>
            <td>
                <div class="platform-tags">
                    ${job.platforms.map(p => `<span class="platform-tag">${p}</span>`).join('')}
                </div>
            </td>
            <td><span class="job-status ${job.status}">${capitalize(job.status)}</span></td>
            <td>${formatDate(job.created_at)}</td>
            <td>${formatDate(job.updated_at)}</td>
        </tr>
    `).join('');
}

function updateActivityUI(activities) {
    const container = document.getElementById('activity-container');
    
    if (activities.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }
    
    const iconMap = {
        success: '✓',
        error: '✗',
        info: 'ℹ',
        warning: '⚠'
    };
    
    container.innerHTML = activities.slice(0, 50).map(activity => `
        <div class="activity-item ${activity.type || 'info'}">
            <span class="activity-icon">${iconMap[activity.type] || 'ℹ'}</span>
            <div class="activity-content">
                <div class="activity-message">${escapeHtml(activity.message)}</div>
                <div class="activity-time">${formatDate(activity.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

function updateJobsBadge(jobs) {
    const activeCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing').length;
    jobsBadge.textContent = activeCount;
    jobsBadge.style.display = activeCount > 0 ? 'block' : 'none';
}

// Form Handling
function setupForm() {
    const form = document.getElementById('submit-form');
    const resultDiv = document.getElementById('submit-result');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const platforms = [];
        form.querySelectorAll('input[name="platforms"]:checked').forEach(cb => {
            platforms.push(cb.value);
        });
        
        const jobData = {
            input_path: formData.get('input_path'),
            title: formData.get('title'),
            description: formData.get('description') || '',
            platforms: platforms.length > 0 ? platforms : ['youtube'],
            blur_bg: document.getElementById('blur-bg').checked,
            max_duration: parseInt(formData.get('max_duration')) || 60,
            skip_approval: document.getElementById('skip-approval').checked
        };
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Submitting...';
        submitBtn.disabled = true;
        
        const result = await submitJob(jobData);
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Show result
        resultDiv.classList.remove('hidden', 'success', 'error');
        if (result.success) {
            resultDiv.classList.add('success');
            resultDiv.textContent = `Job submitted successfully! ID: ${result.job.id}`;
            form.reset();
            
            // Refresh data
            setTimeout(() => {
                refreshData();
                loadJobs();
                loadActivity();
            }, 500);
        } else {
            resultDiv.classList.add('error');
            resultDiv.textContent = `Error: ${result.error || 'Unknown error'}`;
        }
    });
}

function setupClearButton() {
    const btn = document.getElementById('clear-completed-btn');
    if (btn) {
        btn.addEventListener('click', async () => {
            if (confirm('Clear all completed and failed jobs?')) {
                const result = await clearCompletedJobs();
                if (result.success) {
                    loadJobs();
                    refreshData();
                }
            }
        });
    }
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString();
    } catch (e) {
        return dateStr;
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
