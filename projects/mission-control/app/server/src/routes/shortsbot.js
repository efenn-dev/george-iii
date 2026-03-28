import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';
import multer from 'multer';

const router = Router();
const SHORTS_BOT_DIR = join('C:\\\\Users\\\\efenn\\\\.openclaw\\\\workspace\\\\shorts-bot');
const QUEUE_FILE = join(SHORTS_BOT_DIR, 'output', 'queue.json');
const CLIPS_DIR = join(SHORTS_BOT_DIR, 'clips');

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CLIPS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const sanitized = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
    cb(null, `${timestamp}_${sanitized}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = extname(file.originalname).toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format. Allowed: ${VIDEO_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
  }
});

function readQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to write queue:', err);
    return false;
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

router.get('/status', (req, res) => {
  const queue = readQueue();
  const pending = queue.filter(v => v.status === 'pending_approval').length;
  const processing = queue.filter(v => v.status === 'processing').length;
  const done = queue.filter(v => v.status === 'uploaded').length;
  const failed = queue.filter(v => v.status === 'failed').length;

  let ffmpegAvailable = false;
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); ffmpegAvailable = true; } catch {}

  const envExists = existsSync(join(SHORTS_BOT_DIR, '.env'));

  res.json({
    ready: ffmpegAvailable && envExists,
    ffmpegAvailable,
    envConfigured: envExists,
    queue: { pending, processing, done, failed, total: queue.length },
  });
});

router.get('/queue', (req, res) => {
  res.json(readQueue());
});

router.get('/clips', (req, res) => {
  try {
    if (!existsSync(CLIPS_DIR)) {
      return res.json([]);
    }
    
    const files = readdirSync(CLIPS_DIR)
      .filter(f => VIDEO_EXTENSIONS.includes(extname(f).toLowerCase()))
      .map(f => {
        const fullPath = join(CLIPS_DIR, f);
        const stats = statSync(fullPath);
        return {
          name: f,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json(files);
  } catch (err) {
    console.error('Error reading clips:', err);
    res.status(500).json({ error: 'Failed to read clips directory' });
  }
});

router.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const queue = readQueue();
  
  const entry = {
    id: generateId(),
    title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    status: 'pending_approval',
    platforms: req.body.platforms ? req.body.platforms.split(',').map(p => p.trim()) : ['youtube'],
    createdAt: new Date().toISOString(),
    clipPath: join('clips', req.file.filename),
  };

  queue.push(entry);
  
  if (!writeQueue(queue)) {
    return res.status(500).json({ error: 'Failed to update queue' });
  }

  res.status(201).json({
    success: true,
    message: 'Video uploaded successfully',
    entry,
  });
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 2GB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

export default router;