const express = require('express');
const router = express.Router();
const data = require('../storage/data');
const { filterBySearch, paginate } = require('../storage/utils');

const PAGE_LIMIT = 20;
const MAX_ID = 1000000000;

function validateId(id) {
  const num = Number(id);
  return !isNaN(num) && Number.isInteger(num) && num > 0 && num <= MAX_ID;
}

router.get('/items/left', (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search || '';
    if (page < 1) return res.status(400).json({ error: 'Page must be positive' });
    const result = data.getLeftItems(page, PAGE_LIMIT, search);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/items/right', (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search || '';
    if (page < 1) return res.status(400).json({ error: 'Page must be positive' });
    const result = data.getRightItems(page, PAGE_LIMIT, search);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/move-to-right', (req, res) => {
  try {
    const id = Number(req.body.id);
    
    if (!validateId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    data.queueAdd(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /items/move-to-right:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/move-to-left', (req, res) => {
  try {
    const id = Number(req.body.id);
    
    if (!validateId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    data.queueRemove(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /items/move-to-left:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/reorder', (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be array' });
    }

    for (const item of items) {
      if (!item || isNaN(Number(item.id)) || typeof item.newIndex !== 'number') {
        return res.status(400).json({ error: 'Invalid item format' });
      }
      item.id = Number(item.id);
    }

    data.queueReorder(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /items/reorder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/add-new', (req, res) => {
  try {
    const id = Number(req.body.id);
    
    if (!validateId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const added = data.addNew(id);
    if (!added) {
      return res.status(400).json({ error: 'ID already exists' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in /items/add-new:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/items/queue-status', (req, res) => {
  try {
    const addQueue = data.getAddQueue();
    res.json({ addQueue });
  } catch (error) {
    console.error('Error in /items/queue-status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
