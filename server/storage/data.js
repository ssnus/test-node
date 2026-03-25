const INITIAL_COUNT = 1000000;

let leftItemsSet = new Set();
let rightItems = [];
let nextId = INITIAL_COUNT + 1;

for (let i = 1; i <= INITIAL_COUNT; i++) {
  leftItemsSet.add(i);
}

const addQueue = new Set();
const removeQueue = new Set();
let reorderQueue = null;

let addBatchTimer = null;
let changeBatchTimer = null;

const BATCH_ADD_DELAY = 10000;
const BATCH_CHANGE_DELAY = 1000;

function processAddBatch() {
  if (addQueue.size === 0) return;

  const idsToAdd = Array.from(addQueue);
  for (const id of idsToAdd) {
    if (leftItemsSet.has(id)) {
      leftItemsSet.delete(id);
      rightItems.push({ id, order: Date.now() });
    }
  }
  addQueue.clear();
  console.log(`Batch added ${idsToAdd.length} items to right`);
}

function processChangeBatch() {
  if (removeQueue.size > 0) {
    const idsToRemove = Array.from(removeQueue);
    for (const id of idsToRemove) {
      const index = rightItems.findIndex(item => item.id === id);
      if (index !== -1) {
        rightItems.splice(index, 1);
        leftItemsSet.add(id);
      }
    }
    removeQueue.clear();
    console.log(`Batch removed ${idsToRemove.length} items from right`);
  }

  if (reorderQueue) {
    rightItems = reorderQueue.map((id, index) => ({ id, order: index }));
    reorderQueue = null;
    console.log('Batch reordered items');
  }
}

function scheduleAddBatch() {
  if (addBatchTimer) return;
  addBatchTimer = setTimeout(() => {
    processAddBatch();
    addBatchTimer = null;
  }, BATCH_ADD_DELAY);
}

function scheduleChangeBatch() {
  if (changeBatchTimer) return;
  changeBatchTimer = setTimeout(() => {
    processChangeBatch();
    changeBatchTimer = null;
  }, BATCH_CHANGE_DELAY);
}

function addImmediately(id) {
  if (leftItemsSet.has(id)) {
    leftItemsSet.delete(id);
    rightItems.push({ id, order: Date.now() });
    console.log(`Immediately added ${id} to right`);
  }
}

module.exports = {
  getLeftItems: () => Array.from(leftItemsSet),
  getRightItems: () => rightItems,
  queueAdd: (id) => {
    if (!addQueue.has(id)) {
      addQueue.add(id);
      scheduleAddBatch();
    }
  },
  getAddQueue: () => Array.from(addQueue),
  queueRemove: (id) => {
    if (!removeQueue.has(id)) {
      removeQueue.add(id);
      scheduleChangeBatch();
    }
  },
  queueReorder: (items) => {
    reorderQueue = items.map(item => item.id);
    scheduleChangeBatch();
  },
  addNew: (id) => {
    if (!leftItemsSet.has(id) && !rightItems.some(item => item.id === id)) {
      leftItemsSet.add(id);
      if (id >= nextId) {
        nextId = id + 1;
      }
      return true;
    }
    return false;
  },
  getNextId: () => nextId
};
