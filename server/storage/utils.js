/**
 * Фильтрует элементы по поисковому запросу
 * @param {Array} items - Массив элементов (числа или объекты с id)
 * @param {string} search - Поисковый запрос
 * @returns {Array} - Отфильтрованный массив
 */
function filterBySearch(items, search) {
  if (!search) return items;
  
  const searchStr = search.toString();
  return items.filter(item => {
    const id = typeof item === 'object' && item.id !== undefined ? item.id : item;
    return id.toString().includes(searchStr);
  });
}

/**
 * Пагинирует массив
 * @param {Array} items - Массив элементов
 * @param {number} page - Номер страницы (1-based)
 * @param {number} limit - Размер страницы
 * @returns {Object} - { items, total, hasMore }
 */
function paginate(items, page, limit) {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    items: items.slice(startIndex, endIndex),
    total: items.length,
    hasMore: endIndex < items.length
  };
}

module.exports = {
  filterBySearch,
  paginate
};
