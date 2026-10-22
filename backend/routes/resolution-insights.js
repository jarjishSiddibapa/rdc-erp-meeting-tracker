const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  GROUP_DIMENSIONS, buildExplore, buildOverview, buildRecords, parseFilters,
} = require('../services/resolution-insights');
const { buildPendingOverview, parseFilters: parsePendingFilters } = require('../services/pending-insights');

const router = express.Router();
router.use(authenticate);
// How long each technician takes is performance data - admins only, like the other management panels.
router.use(requireRole('admin'));

// Headline figures, per-technician leaderboard, monthly trend, TAT distribution and per-type split.
router.get('/overview', async (req, res, next) => {
  try {
    res.json(await buildOverview(parseFilters(req.query)));
  } catch (e) { next(e); }
});

// Free-form pivot: group by one dimension, optionally cross-tabbed by a second.
router.get('/explore', async (req, res, next) => {
  try {
    const groupBy = req.query.groupBy || 'technician';
    const thenBy = req.query.thenBy || null;
    if (!GROUP_DIMENSIONS.includes(groupBy)) return res.status(400).json({ message: 'Invalid groupBy' });
    if (thenBy && !GROUP_DIMENSIONS.includes(thenBy)) return res.status(400).json({ message: 'Invalid thenBy' });
    if (thenBy === groupBy) return res.status(400).json({ message: 'groupBy and thenBy must differ' });
    res.json(await buildExplore(parseFilters(req.query), groupBy, thenBy));
  } catch (e) { next(e); }
});

// The individual SRs behind every figure, with their computed turnaround / age.
router.get('/records', async (req, res, next) => {
  try {
    res.json(await buildRecords(parseFilters(req.query)));
  } catch (e) { next(e); }
});

// Pending With Insights: how long each person has had SRs sitting with them (from the SR change log).
router.get('/pending', async (req, res, next) => {
  try {
    res.json(await buildPendingOverview(parsePendingFilters(req.query)));
  } catch (e) { next(e); }
});

module.exports = router;
