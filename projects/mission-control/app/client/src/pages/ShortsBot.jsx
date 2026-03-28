import React, { useEffect, useState, useRef } from 'react';

const STATUS_BADGE = {
  pending_approval: { label: 'Pending Approval', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  processing:       { label: 'Processing',       color: 'var(--info)',    bg: 'rgba(59,130,246,0.15)' },
  uploaded:         { label: 'Uploaded',          color: 'var(--success)', bg: 'rgba(52,211,153,0.15)' },
  failed:           { label: 'Failed',            color: '#f87171',       bg: 'rgba(248,113,113,0.15)' },
};

const VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'];

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
      background: ok ? '#34d399' : '#f87171',
      boxShadow: ok ? '0 0 6px #34d399' : 'none',
      marginRight: 8, flexShrink: 0,
    }} />
  );
}

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return dt;
  }
}

export default function ShortsBot() {
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  
  // Form state for video processing
  const [title, setTitle] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['youtube']);
  const [blur, setBlur] = useState(false);
  const [duration, setDuration] = useState(60); // seconds
  const [skipApproval, setSkipApproval] = useState(false);

  const fetchData = async () => {
    try {
      const [s, q] = await Promise.all([
        fetch('/api/shortsbot/status').then(r => r.ok ? r.json() : null),
        fetch('/api/shortsbot/queue').then(r => r.ok ? r.json() : []),
      ]);
      setStatus(s);
      setQueue(Array.isArray(q) ? q : []);
    } catch {
      setStatus(null);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (file) => {
    setUploadError(null);
    setUploadSuccess(null);
    
    if (!file) {
      setSelectedFile(null);
      setTitle('');
      return;
    }
    
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!VIDEO_FORMATS.includes(ext)) {
      setUploadError(`Unsupported format. Allowed: ${VIDEO_FORMATS.join(', ')}`);
      setSelectedFile(null);
      setTitle('');
      return;
    }
    
    setSelectedFile(file);
    // Auto-generate title from filename if not set
    const autoTitle = file.name.replace(/\.[^/.]+$/, '');
    if (!title) {
      setTitle(autoTitle);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFileSelect(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    handleFileSelect(file);
  };

  const handlePlatformToggle = (platformId) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    if (selectedPlatforms.length === 0) {
      setUploadError('Please select at least one platform');
      return;
    }
    
    if (!title.trim()) {
      setUploadError('Please enter a title');
      return;
    }
    
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    
    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title.trim());
    formData.append('platforms', JSON.stringify(selectedPlatforms));
    formData.append('blur', blur);
    formData.append('duration', duration);
    formData.append('skip_approval', skipApproval);
    
    try {
      const response = await fetch('/api/shortsbot/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUploadSuccess(`"${data.entry.title}" uploaded successfully!`);
        setSelectedFile(null);
        setTitle('');
        setSelectedPlatforms(['youtube']);
        setBlur(false);
        setDuration(60);
        setSkipApproval(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchData();
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err) {
      setUploadError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const q = status?.queue ?? { pending: 0, processing: 0, done: 0, failed: 0 };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">🎬 Shorts Bot</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Auto-uploads highlight clips to social platforms
        </span>
      </div>

      <div className="card" style={styles.section}>
        <h2 style={styles.cardTitle}>⚙️ Setup Status</h2>
        {loading ? (
          <div style={styles.muted}>Checking...</div>
        ) : (
          <div style={styles.statusGrid}>
            <div style={styles.statusItem}>
              <StatusDot ok={status?.ffmpegAvailable} />
              <div>
                <div style={styles.statusLabel}>FFmpeg</div>
                <div style={styles.statusValue}>{status?.ffmpegAvailable ? 'Installed' : 'Not found'}</div>
              </div>
            </div>
            <div style={styles.statusItem}>
              <StatusDot ok={status?.envConfigured} />
              <div>
                <div style={styles.statusLabel}>.env File</div>
                <div style={styles.statusValue}>{status?.envConfigured ? 'Configured' : 'Missing'}</div>
              </div>
            </div>
            <div style={styles.statusItem}>
              <StatusDot ok={status?.envConfigured} />
              <div>
                <div style={styles.statusLabel}>Discord Bot</div>
                <div style={styles.statusValue}>{status?.envConfigured ? 'Configured via .env' : 'Not configured'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.statsGrid}>
        <div className="card" style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{q.pending}</div>
          <div style={styles.statLabel}>Pending Approval</div>
        </div>
        <div className="card" style={styles.statCard}>
          <div style={{ ...styles.statValue, color: 'var(--info)' }}>{q.processing}</div>
          <div style={styles.statLabel}>Processing</div>
        </div>
        <div className="card" style={styles.statCard}>
          <div style={{ ...styles.statValue, color: 'var(--success)' }}>{q.done}</div>
          <div style={styles.statLabel}>Uploaded</div>
        </div>
        <div className="card" style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#f87171' }}>{q.failed}</div>
          <div style={styles.statLabel}>Failed</div>
        </div>
      </div>

      <div className="card" style={styles.section}>
        <h2 style={styles.cardTitle}>📖 How to Use</h2>
        <ol style={styles.stepList}>
          <li style={styles.step}>
            <span style={styles.stepNum}>1</span>
            <span>Use the <strong>Upload &amp; Process</strong> section below to drag in your highlight clip</span>
          </li>
          <li style={styles.step}>
            <span style={styles.stepNum}>2</span>
            <span>Fill in a title, pick your target platforms, and configure any processing options</span>
          </li>
          <li style={styles.step}>
            <span style={styles.stepNum}>3</span>
            <span>Hit <strong>Process &amp; Queue</strong> — the clip is converted to 1080x1920 Shorts format automatically</span>
          </li>
          <li style={styles.step}>
            <span style={styles.stepNum}>4</span>
            <span>The bot posts the processed video to Discord — react ✅ to approve or ❌ to reject</span>
          </li>
          <li style={styles.step}>
            <span style={styles.stepNum}>5</span>
            <span>On approval, the video uploads to your selected platforms automatically</span>
          </li>
        </ol>
      </div>

      <div className="card" style={styles.section}>
        <h2 style={styles.cardTitle}>📤 Upload Video</h2>
        
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...styles.dropZone,
            borderColor: dragActive ? 'var(--accent)' : 'var(--border)',
            background: dragActive ? 'rgba(108,99,255,0.05)' : 'var(--surface2)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={VIDEO_FORMATS.join(',')}
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          
          <div style={styles.uploadIcon}>📁</div>
          
          {selectedFile ? (
            <div style={styles.fileInfo}>
              <div style={styles.fileName}>{selectedFile.name}</div>
              <div style={styles.fileSize}>{formatFileSize(selectedFile.size)}</div>
            </div>
          ) : (
            <div style={styles.dropText}>
              <div style={styles.dropMain}>Drop a video here or click to browse</div>
              <div style={styles.dropSub}>Supports: {VIDEO_FORMATS.join(', ')}</div>
            </div>
          )}
        </div>
        
        {selectedFile && (
          <div style={styles.formSection}>
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title..."
                maxLength={100}
              />
            </div>
            
            <div className="form-group">
              <label>Platforms *</label>
              <div style={styles.platformGrid}>
                {PLATFORMS.map(platform => (
                  <label
                    key={platform.id}
                    className={`platform-checkbox ${selectedPlatforms.includes(platform.id) ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform.id)}
                      onChange={() => handlePlatformToggle(platform.id)}
                    />
                    <span>{platform.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Max Duration (seconds)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                  min={15}
                  max={300}
                />
              </div>
              
              <div className="form-group">
                <label>Processing Options</label>
                <div style={styles.checkboxGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={blur}
                      onChange={(e) => setBlur(e.target.checked)}
                    />
                    Blur edges (vertical video)
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={skipApproval}
                      onChange={(e) => setSkipApproval(e.target.checked)}
                    />
                    Skip Discord approval
                  </label>
                </div>
              </div>
            </div>
            
            <div style={styles.uploadActions}>
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  ...styles.uploadButton,
                  opacity: uploading ? 0.6 : 1,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? (
                  <span style={styles.buttonContent}>
                    <span style={styles.spinner}></span>
                    Uploading...
                  </span>
                ) : (
                  'Process & Queue'
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setTitle('');
                  setSelectedPlatforms(['youtube']);
                  setBlur(false);
                  setDuration(60);
                  setSkipApproval(false);
                  setUploadError(null);
                  setUploadSuccess(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={uploading}
                style={{
                  ...styles.cancelButton,
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {uploadError && (
          <div style={styles.errorMessage}>
            ❌ {uploadError}
          </div>
        )}
        
        {uploadSuccess && (
          <div style={styles.successMessage}>
            ✅ {uploadSuccess}
          </div>
        )}
      </div>

      <div className="card" style={{ ...styles.section, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>📋 Queue</h2>
        </div>
        {queue.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🎬</div>
            <div style={styles.emptyText}>No clips queued yet — upload a video to get started</div>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th>Title</th>
                <th>Status</th>
                <th>Platforms</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item, i) => {
                const badge = STATUS_BADGE[item.status] || { label: item.status, color: 'var(--text-muted)', bg: 'var(--surface2)' };
                const platforms = Array.isArray(item.platforms) ? item.platforms.join(', ') : (item.platforms || '—');
                return (
                  <tr key={item.id || i} style={styles.tr}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{item.title || '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: badge.color,
                        background: badge.bg,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{platforms}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(item.created_at || item.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  section: { marginBottom: 20 },
  cardTitle: { fontSize: 14, fontWeight: 700, marginBottom: 16, marginTop: 0 },
  muted: { color: 'var(--text-muted)', fontSize: 13 },

  statusGrid: { display: 'flex', gap: 32, flexWrap: 'wrap' },
  statusItem: { display: 'flex', alignItems: 'center', gap: 8 },
  statusLabel: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statusValue: { fontSize: 13, fontWeight: 600, marginTop: 2 },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 },
  statCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 20 },
  statValue: { fontSize: 32, fontWeight: 700 },
  statLabel: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' },

  stepList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  step: { display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, lineHeight: 1.6 },
  stepNum: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, borderRadius: '50%',
    background: 'rgba(108,99,255,0.15)', color: 'var(--accent)',
    fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1,
  },

  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: 10,
    padding: '32px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: 16,
  },
  uploadIcon: { fontSize: 36, marginBottom: 12 },
  fileInfo: { display: 'flex', flexDirection: 'column', gap: 4 },
  fileName: { fontSize: 15, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' },
  fileSize: { fontSize: 12, color: 'var(--text-muted)' },
  dropText: { display: 'flex', flexDirection: 'column', gap: 6 },
  dropMain: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  dropSub: { fontSize: 12, color: 'var(--text-muted)' },
  
  formSection: { marginTop: 16 },
  platformGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  checkboxGroup: { display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' },
  
  uploadActions: { display: 'flex', gap: 10, marginTop: 20 },
  uploadButton: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  cancelButton: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  buttonContent: { display: 'flex', alignItems: 'center', gap: 8 },
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorMessage: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 6,
    color: '#f87171',
    fontSize: 13,
  },
  successMessage: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(52,211,153,0.1)',
    border: '1px solid rgba(52,211,153,0.3)',
    borderRadius: 6,
    color: 'var(--success)',
    fontSize: 13,
  },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px' },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: 'var(--text-muted)', fontSize: 13 },

  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: 'var(--surface2)' },
  tr: { borderBottom: '1px solid var(--border)' },
};
