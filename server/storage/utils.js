function filterBySearch(items, search) {
  if (!search) return items;

  const searchStr = search.toString();
  return items.filter(item => {
    const id = typeof item === 'object' && item.id !== undefined ? item.id : item;
    return id.toString().includes(searchStr);
  });
}

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
