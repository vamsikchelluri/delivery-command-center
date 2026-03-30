// api/src/index.js
require('dotenv').config();
require('express-async-errors');

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');

const { authenticate, requireAccess } = require('./middleware/auth');
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── PUBLIC ──
app.use('/api/auth',       require('./routes/auth'));

// ── PROTECTED ──
app.use('/api/resources',   authenticate, requireAccess('resources'),  require('./routes/resources'));
app.use('/api/skills',      authenticate, require('./routes/skills'));
app.use('/api/currencies',  authenticate, require('./routes/currencies'));
app.use('/api/config',      authenticate, require('./routes/config'));
app.use('/api/projects',    authenticate, requireAccess('projects'),   require('./routes/projects'));
app.use('/api/pipeline',    authenticate, requireAccess('pipeline'),   require('./routes/pipeline'));
app.use('/api/team',        authenticate, requireAccess('team'),       require('./routes/team'));
app.use('/api/deployments', authenticate, require('./routes/deployments'));
app.use('/api/actuals',     authenticate, require('./routes/actuals'));
app.use('/api/financials',  authenticate, require('./routes/financials'));
app.use('/api/dashboard',   authenticate, requireAccess('dashboard'),  require('./routes/dashboard'));
app.use('/api/users',       authenticate, require('./routes/users'));
app.use('/api/roles',       authenticate, require('./routes/roles'));
app.use('/api/audit',       authenticate, require('./routes/audit'));

// ── SERVE CLIENT ──
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ── ERROR HANDLER ──
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`DCC API running on :${PORT}`));
