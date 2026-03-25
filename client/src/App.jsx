import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

const API_URL = 'http://localhost:3001/api';
const PAGE_LIMIT = 20;

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function LeftItem({ id, onMove }) {
  return (
    <div className="left-item">
      <span>ID: {id.toLocaleString()}</span>
      <button onClick={() => onMove(id)} className="btn-move">→</button>
    </div>
  );
}

function SortableItem({ id, onRemove, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <div ref={setNodeRef} style={style} className="right-item" {...attributes} {...listeners}>
      <span>ID: {id.toLocaleString()}</span>
      <button onClick={(e) => { e.stopPropagation(); onRemove(id); }} className="btn-remove">×</button>
    </div>
  );
}

function useItemsApi(endpoint) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const pageRef = useRef(1);
  const searchRef = useRef('');
  const containerRef = useRef(null);
  const initializedRef = useRef(false);

  const loadPage = useCallback(async (page, searchValue = '', append = false) => {
    if (loading) return null;

    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}${endpoint}`, {
        params: { page, limit: PAGE_LIMIT, search: searchValue }
      });

      if (append) {
        setItems(prev => {
          const existingIds = new Set(prev);
          const newItems = data.items.filter(id => !existingIds.has(id));
          return [...prev, ...newItems];
        });
      } else {
        setItems(data.items);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);
      pageRef.current = page;

      return data;
    } catch (error) {
      console.error(`Error loading ${endpoint}:`, error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loading, endpoint]);

  const reload = useCallback(() => {
    pageRef.current = 1;
    searchRef.current = '';
    setSearch('');
    return loadPage(1, '', false);
  }, [loadPage]);

  const applySearch = useCallback((searchValue) => {
    pageRef.current = 1;
    searchRef.current = searchValue;
    setSearch(searchValue);
    return loadPage(1, searchValue, false);
  }, [loadPage]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      reload();
    }
  }, [reload]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loading) {
        const nextPage = pageRef.current + 1;
        loadPage(nextPage, searchRef.current, true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, loadPage]);

  return {
    items,
    total,
    hasMore,
    loading,
    search,
    searchRef,
    containerRef,
    loadPage,
    reload,
    applySearch,
    setItems,
    setTotal,
  };
}

function App() {
  const left = useItemsApi('/items/left');
  const right = useItemsApi('/items/right');

  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const [leftSearchInput, setLeftSearchInput] = useState('');
  const [rightSearchInput, setRightSearchInput] = useState('');
  const leftSearchDebounced = useDebounce(leftSearchInput, 500);
  const rightSearchDebounced = useDebounce(rightSearchInput, 500);

  const [newId, setNewId] = useState('');

  useEffect(() => {
    if (leftSearchDebounced !== left.searchRef.current) {
      left.applySearch(leftSearchDebounced);
    }
  }, [leftSearchDebounced, left]);

  useEffect(() => {
    if (rightSearchDebounced !== right.searchRef.current) {
      right.applySearch(rightSearchDebounced);
    }
  }, [rightSearchDebounced, right]);

  const moveToRight = async (id) => {
    try {
      await axios.post(`${API_URL}/items/move-to-right`, { id });
      left.setItems(prev => prev.filter(item => item !== id));
      left.setTotal(prev => prev - 1);
      right.setItems(prev => [id, ...prev]);
      right.setTotal(prev => prev + 1);
    } catch (error) {
      console.error('Error moving to right:', error);
    }
  };

  const moveToLeft = async (id) => {
    try {
      await axios.post(`${API_URL}/items/move-to-left`, { id });
      right.setItems(prev => prev.filter(item => item !== id));
      right.setTotal(prev => prev - 1);
      left.setItems(prev => [id, ...prev]);
      left.setTotal(prev => prev + 1);
    } catch (error) {
      console.error('Error moving to left:', error);
    }
  };

  const handleAddNew = async () => {
    const id = parseInt(newId);
    if (!id || isNaN(id)) {
      alert('Введите корректный ID');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/items/add-new`, { id });
      setNewId('');
      left.setItems(prev => [id, ...prev]);
      left.setTotal(prev => prev + 1);
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка добавления');
    }
  };

  const handleLeftSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      left.applySearch(leftSearchInput);
    }
  };

  const handleRightSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      right.applySearch(rightSearchInput);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      const oldIndex = right.items.indexOf(active.id);
      const newIndex = right.items.indexOf(over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = [...right.items];
        newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, active.id);
        right.setItems(newItems);
        
        const reorderData = newItems.map((id, index) => ({ id, newIndex: index }));
        try {
          await axios.post(`${API_URL}/items/reorder`, { items: reorderData });
        } catch (error) {
          console.error('Error reordering:', error);
        }
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="app">
        <div className="container left">
          <h2>Левое окно (не выбрано: {left.total.toLocaleString()})</h2>
          
          <div className="controls">
            <div className="search-row">
              <input
                type="text"
                placeholder="Поиск по ID..."
                value={leftSearchInput}
                onChange={(e) => setLeftSearchInput(e.target.value)}
                onKeyDown={handleLeftSearchKeyDown}
                className="search-input"
              />
              <button onClick={() => left.applySearch(leftSearchInput)} className="btn-search">🔍</button>
              {left.loading && <span className="loading-indicator">⏳</span>}
            </div>
            
            <div className="add-new">
              <input
                type="number"
                placeholder="Новый ID"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="new-id-input"
              />
              <button onClick={handleAddNew} className="btn-add">Добавить</button>
            </div>
          </div>
          
          <div className="items-container" ref={left.containerRef}>
            {left.items.map(id => (
              <LeftItem key={`left-${id}`} id={id} onMove={moveToRight} />
            ))}
            {left.loading && <div className="loading">Загрузка...</div>}
            {!left.hasMore && left.items.length > 0 && (
              <div className="end-message">Конец списка</div>
            )}
          </div>
        </div>
        
        <div className="container right">
          <h2>Правое окно (выбрано: {right.total.toLocaleString()})</h2>
          
          <div className="controls">
            <div className="search-row">
              <input
                type="text"
                placeholder="Поиск по ID..."
                value={rightSearchInput}
                onChange={(e) => setRightSearchInput(e.target.value)}
                onKeyDown={handleRightSearchKeyDown}
                className="search-input"
              />
              <button onClick={() => right.applySearch(rightSearchInput)} className="btn-search">🔍</button>
              {right.loading && <span className="loading-indicator">⏳</span>}
            </div>
          </div>
          
          <div className="items-container" ref={right.containerRef}>
            <SortableContext items={right.items} strategy={verticalListSortingStrategy}>
              {right.items.map(id => (
                <SortableItem key={`right-${id}`} id={id} onRemove={moveToLeft} isDragging={id === activeId} />
              ))}
            </SortableContext>
            {right.loading && <div className="loading">Загрузка...</div>}
            {!right.hasMore && right.items.length > 0 && (
              <div className="end-message">Конец списка</div>
            )}
          </div>
        </div>
      </div>
      
      <DragOverlay>
        {activeId ? (
          <div className="right-item dragging">ID: {activeId.toLocaleString()}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
