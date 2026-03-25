const express = require('express');
const router = express.Router();
const data = require('../storage/data');
const { filterBySearch, paginate } = require('../storage/utils');

const PAGE_LIMIT = 20;
const MAX_ID = 1000000000;

function validateId(id) {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || id > MAX_ID) {
    return false;
  }
  return true;
}

router.get('/items/left', (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search || '';

    if (page < 1) {
      return res.status(400).json({ error: 'Page must be positive' });
    }

    const allItems = data.getLeftItems();
    const filtered = filterBySearch(allItems, search);
    const result = paginate(filtered, page, PAGE_LIMIT);

    res.json({
      items: result.items,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('Error in /items/left:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/items/right', (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search || '';

    if (page < 1) {
      return res.status(400).json({ error: 'Page must be positive' });
    }

    const allItems = data.getRightItems();
    const filtered = filterBySearch(allItems, search);
    const paginated = paginate(filtered, page, PAGE_LIMIT);
    const items = paginated.items.map(item => item.id);

    res.json({
      items,
      total: paginated.total,
      hasMore: paginated.hasMore
    });
  } catch (error) {
    console.error('Error in /items/right:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/move-to-right', (req, res) => {
  try {
    const { id } = req.body;
    
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
    const { id } = req.body;
    
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
      if (!item || typeof item.id !== 'number' || typeof item.newIndex !== 'number') {
        return res.status(400).json({ error: 'Invalid item format' });
      }
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
    const { id } = req.body;
    
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

module.exports = router;
