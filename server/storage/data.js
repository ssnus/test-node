const INITIAL_COUNT = 1000000;
let MAX_ID_BOUND = INITIAL_COUNT;

let selectedIds = new Set();
let rightItems = [];
let extraIds = new Set();
let nextId = INITIAL_COUNT + 1;

const addQueue = new Set();
const removeQueue = new Set();
let reorderQueue = null;

let addBatchTimer = null;
let changeBatchTimer = null;

const BATCH_ADD_DELAY = 10000;
const BATCH_CHANGE_DELAY = 1000;

function applyReorder(items, reorder) {
  if (!reorder) return items;
  const filteredReorder = reorder.map(r => ({ ...r, id: Number(r.id) }));
  const currentIds = new Set(items.map(item => Number(item.id)));
  const filtered = filteredReorder.filter(r => currentIds.has(r.id));
  filtered.sort((a, b) => a.newIndex - b.newIndex);

  const filteredIdsSet = new Set(filtered.map(r => r.id));
  const indices = [];
  for (let i = 0; i < items.length; i++) {
    if (filteredIdsSet.has(Number(items[i].id))) {
      indices.push(i);
    }
  }

  const result = [...items];
  const len = Math.min(indices.length, filtered.length);
  for (let k = 0; k < len; k++) {
    const id = filtered[k].id;
    const index = indices[k];
    result[index] = { id, order: index };
  }
  return result;
}

function processAddBatch() {
  if (addQueue.size === 0) return;
  const ids = Array.from(addQueue).map(Number);
  for (const id of ids) {
    if ((id <= MAX_ID_BOUND || extraIds.has(id)) && !selectedIds.has(id)) {
      selectedIds.add(id);
      rightItems.push({ id, order: rightItems.length });
    }
  }
  addQueue.clear();
}

function processChangeBatch() {
  if (removeQueue.size > 0) {
    const ids = Array.from(removeQueue).map(Number);
    for (const id of ids) {
      const idx = rightItems.findIndex(item => Number(item.id) === id);
      if (idx !== -1) rightItems.splice(idx, 1);
      selectedIds.delete(id);
    }
    removeQueue.clear();
  }
  if (reorderQueue) {
    rightItems = applyReorder(rightItems, reorderQueue);
    for (let i = 0; i < rightItems.length; i++) rightItems[i].order = i;
    reorderQueue = null;
  }
}

function scheduleBatch(timer, fn, delay) {
  if (timer) return timer;
  return setTimeout(() => {
    fn();
  }, delay);
}

module.exports = {
  getLeftItems: (page, limit, search) => {
    const searchStr = search ? search.toString() : '';
    const skip = (page - 1) * limit;
    const items = [];
    let total = 0;
    
    const virtualSelected = new Set(selectedIds);
    for (const id of addQueue) virtualSelected.add(Number(id));
    for (const id of removeQueue) virtualSelected.delete(Number(id));

    const checkAndAdd = (id) => {
      if (!virtualSelected.has(id)) {
        if (!searchStr || id.toString().includes(searchStr)) {
          if (total >= skip && items.length < limit) items.push(id);
          total++;
        }
      }
    };

    for (let i = 1; i <= MAX_ID_BOUND; i++) checkAndAdd(i);
    const sortedExtras = Array.from(extraIds).sort((a,b) => a-b);
    for (const id of sortedExtras) {
      if (id > MAX_ID_BOUND) checkAndAdd(id);
    }

    return { items, total, hasMore: (page * limit) < total };
  },

  getRightItems: (page, limit, search) => {
    let current = [...rightItems];
    const virtualRemove = new Set(removeQueue);
    if (virtualRemove.size > 0) {
      current = current.filter(item => !virtualRemove.has(Number(item.id)));
    }
    if (addQueue.size > 0) {
      const idsInRight = new Set(current.map(item => item.id));
      const pending = Array.from(addQueue).map(Number).filter(id => !idsInRight.has(id));
      current = [...current, ...pending.map(id => ({ id, order: Infinity }))];
    }
    if (reorderQueue) current = applyReorder(current, reorderQueue);

    const searchStr = search ? search.toString() : '';
    const filtered = searchStr 
      ? current.filter(item => item.id.toString().includes(searchStr)) 
      : current;
    
    const skip = (page - 1) * limit;
    const items = filtered.slice(skip, skip + limit).map(item => item.id);
    return { items, total: filtered.length, hasMore: (skip + limit) < filtered.length };
  },

  queueAdd: (id) => {
    const numId = Number(id);
    removeQueue.delete(numId);
    if (!selectedIds.has(numId) && !addQueue.has(numId)) {
      addQueue.add(numId);
      if (!addBatchTimer) addBatchTimer = setTimeout(() => { processAddBatch(); addBatchTimer = null; }, BATCH_ADD_DELAY);
    }
  },

  getAddQueue: () => Array.from(addQueue),

  queueRemove: (id) => {
    const numId = Number(id);
    if (selectedIds.has(numId) || addQueue.has(numId)) {
      removeQueue.add(numId);
      addQueue.delete(numId);
      if (!changeBatchTimer) changeBatchTimer = setTimeout(() => { processChangeBatch(); changeBatchTimer = null; }, BATCH_CHANGE_DELAY);
    }
  },

  queueReorder: (items) => {
    reorderQueue = items;
    if (!changeBatchTimer) changeBatchTimer = setTimeout(() => { processChangeBatch(); changeBatchTimer = null; }, BATCH_CHANGE_DELAY);
  },

  addNew: (id) => {
    const numId = Number(id);
    if (numId > 0 && !extraIds.has(numId) && numId > MAX_ID_BOUND) {
      extraIds.add(numId);
      if (numId >= nextId) nextId = numId + 1;
      return true;
    }
    return numId > 0 && numId <= MAX_ID_BOUND;
  },

  getNextId: () => nextId
};
