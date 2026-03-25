const express = require('express');
const router = express.Router();
const data = require('../storage/data');

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
    let filtered = allItems;

    if (search) {
      const searchStr = search.toString();
      filtered = allItems.filter(id => id.toString().includes(searchStr));
    }

    const startIndex = (page - 1) * PAGE_LIMIT;
    const endIndex = startIndex + PAGE_LIMIT;
    const items = filtered.slice(startIndex, endIndex);

    res.json({
      items,
      total: filtered.length,
      hasMore: endIndex < filtered.length
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
    let filtered = allItems;

    if (search) {
      const searchStr = search.toString();
      filtered = allItems.filter(item => item.id.toString().includes(searchStr));
    }

    const startIndex = (page - 1) * PAGE_LIMIT;
    const endIndex = startIndex + PAGE_LIMIT;
    const items = filtered.slice(startIndex, endIndex).map(item => item.id);

    res.json({
      items,
      total: filtered.length,
      hasMore: endIndex < filtered.length
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
