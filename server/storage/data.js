const INITIAL_COUNT = 1000000;

let leftItemsSet = new Set();
let rightItems = [];
let nextId = INITIAL_COUNT + 1;

for (let i = 1; i <= INITIAL_COUNT; i++) {
  leftItemsSet.add(i);
}

const addQueue = new Set();
const removeQueue = new Set();
let reorderQueue = null; // Array<{id:number,newIndex:number}>

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
      // Даже если ID еще не успел появиться в rightItems, он должен гарантированно
      // оказаться в leftItemsSet (иначе возможно "исчезновение" между батчами).
      if (index !== -1) {
        rightItems.splice(index, 1);
      }
      leftItemsSet.add(id);
    }
    removeQueue.clear();
    console.log(`Batch removed ${idsToRemove.length} items from right`);
  }

  if (reorderQueue) {
    const reorderItems = reorderQueue;
    reorderQueue = null;

    // Важно: reorder приходит для текущего отфильтрованного/загруженного подмножества.
    // Мы не должны "перезаписывать" весь rightItems, иначе элементы вне подмножества
    // могут пропасть навсегда. Вместо этого переставляем только те позиции,
    // где эти id уже присутствуют в текущем rightItems.
    const rightIdsSet = new Set(rightItems.map(item => item.id));
    const filtered = reorderItems.filter(item => rightIdsSet.has(item.id));
    filtered.sort((a, b) => a.newIndex - b.newIndex);

    const filteredIdsSet = new Set(filtered.map(item => item.id));
    const indices = [];
    for (let i = 0; i < rightItems.length; i++) {
      if (filteredIdsSet.has(rightItems[i].id)) {
        indices.push(i);
      }
    }

    const len = Math.min(indices.length, filtered.length);
    for (let k = 0; k < len; k++) {
      const id = filtered[k].id;
      const index = indices[k];
      rightItems[index] = { id, order: index };
    }

    // Приведем order к индексам массива (на бэкенде фактически важен порядок массива).
    for (let i = 0; i < rightItems.length; i++) {
      rightItems[i].order = i;
    }

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
    // Если параллельно запрошено возвращение в левое окно — отменяем ожидающее удаление.
    removeQueue.delete(id);
    if (!addQueue.has(id)) {
      addQueue.add(id);
      scheduleAddBatch();
    }
  },
  getAddQueue: () => Array.from(addQueue),
  queueRemove: (id) => {
    if (!removeQueue.has(id)) {
      removeQueue.add(id);
      // Отменяем ожидающее добавление в right, чтобы элемент не "вернулся" позже.
      addQueue.delete(id);
      scheduleChangeBatch();
    }
  },
  queueReorder: (items) => {
    reorderQueue = items;
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
