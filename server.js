require('dotenv').config({ override: true });

const cors = require('cors');
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const connectDatabase = require('./config/database');

const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resume');
const communityRoutes = require('./routes/community');

const app = express();
const port = process.env.PORT || 8000;

// 🔹 Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 🔹 Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Multer setup
const upload = multer({ storage: multer.memoryStorage() });

// 🔹 Health check
app.get('/', (_req, res) => {
  res.json({ status: 'Resumetric Backend Engine: Active' });
});

// 🔹 Upload route (NEW FEATURE)
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'resumetric',
      resource_type: 'auto',
    });

    res.json({
      message: 'File uploaded successfully',
      url: result.secure_url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      original_filename: req.file.originalname,
      bytes: req.file.size,
      resource_type: result.resource_type,
    });
  } catch (err) {
    console.error('[upload] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Existing routes
app.use('/', authRoutes);
app.use('/', resumeRoutes);
app.use('/', communityRoutes);

// 🔹 Error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// 🔹 DB + Server start
connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`[server] Resumetric backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('[database] Connection failed:', error.message);
    process.exit(1);
  });
