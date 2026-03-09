// api/src/index.js
require('dotenv').config();
require('express-async-errors');

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');

const app = express();

// ── MIDDLEWARE ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── API ROUTES ──
app.use('/api/resources',   require('./routes/resources'));
app.use('/api/skills',      require('./routes/skills'));
app.use('/api/currencies',  require('./routes/currencies'));
app.use('/api/config',      require('./routes/config'));
app.use('/api/projects',    require('./routes/projects'));
app.use('/api/pipeline',    require('./routes/pipeline'));
app.use('/api/deployments', require('./routes/deployments'));
app.use('/api/actuals',     require('./routes/actuals'));
app.use('/api/dashboard',   require('./routes/dashboard'));

// ── SERVE REACT CLIENT IN PRODUCTION ──
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── ERROR HANDLER ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 DCC API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
});
