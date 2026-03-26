import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { queuedPost } from './utils/requestQueue';
import './App.css';
import { API_URL } from './config'; 

const PAGE_LIMIT = 20;

function useDebounce(value, delay) {
  const [val, setVal] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setVal(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return val;
}

function ItemCard({ id, onAction, actionLabel, className = '', isSortable = false, isDragging = false, dragProps = {} }) {
  const { attributes, listeners, setNodeRef, transform, transition } = isSortable 
    ? useSortable({ id }) 
    : { attributes: {}, listeners: {}, setNodeRef: null, transform: null, transition: null };
  
  const style = isSortable ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } : {};

  return (
    <article 
      ref={setNodeRef} 
      style={style} 
      className={`item-card ${className}`} 
      {...attributes} 
      {...listeners} 
      {...dragProps}
      aria-label={`Элемент с ID ${id}`}
    >
      <span>ID: {id.toLocaleString()}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); onAction(id); }} 
        className="btn-action"
        aria-label={actionLabel === '→' ? 'Перенести вправо' : 'Удалить из выбранного'}
      >
        {actionLabel}
      </button>
    </article>
  );
}

function useItemsApi(endpoint) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const searchRef = useRef('');
  const containerRef = useRef(null);

  const loadPage = useCallback(async (page, searchValue = '', append = false) => {
    if (loading) return null;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API_URL}${endpoint}`, {
        params: { page, limit: PAGE_LIMIT, search: searchValue }
      });
      setItems(prev => {
        if (!append) return data.items;
        const ids = new Set(prev);
        return [...prev, ...data.items.filter(id => !ids.has(id))];
      });
      setTotal(data.total);
      setHasMore(data.hasMore);
      pageRef.current = page;
      return data;
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ошибка загрузки');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loading, endpoint]);

  const reload = useCallback(() => {
    pageRef.current = 1;
    setSearch('');
    searchRef.current = '';
    return loadPage(1, '', false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) return loadPage(pageRef.current + 1, searchRef.current, true);
  }, [hasMore, loading, loadPage]);

  const applySearch = useCallback((val) => {
    pageRef.current = 1;
    searchRef.current = val;
    setSearch(val);
    return loadPage(1, val, false);
  }, [loadPage]);

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) loadMore();
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  return { items, total, hasMore, loading, search, searchRef, containerRef, reload, loadMore, applySearch, setItems, setTotal, error };
}

function App() {
  const left = useItemsApi('/items/left');
  const right = useItemsApi('/items/right');
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));
  const [leftIn, setLeftIn] = useState('');
  const [rightIn, setRightIn] = useState('');
  const debouncedLeft = useDebounce(leftIn, 500);
  const debouncedRight = useDebounce(rightIn, 500);
  const [newIdIn, setNewIdIn] = useState('');
  const [pendingAdd, setPendingAdd] = useState(new Set());

  useEffect(() => {
    if (pendingAdd.size === 0) return;
    const t = setInterval(async () => {
      if (activeIdRef.current) return;
      try {
        const { data } = await axios.get(`${API_URL}/items/queue-status`);
        const q = new Set(data.addQueue);
        if ([...pendingAdd].every(id => !q.has(id))) {
          setPendingAdd(new Set());
          await Promise.all([right.reload(), left.reload()]);
        }
      } catch (e) {}
    }, 1000);
    return () => clearInterval(t);
  }, [pendingAdd, left, right]);

  useEffect(() => { if (debouncedLeft !== left.searchRef.current) left.applySearch(debouncedLeft); }, [debouncedLeft]);
  useEffect(() => { if (debouncedRight !== right.searchRef.current) right.applySearch(debouncedRight); }, [debouncedRight]);

  const moveRight = async (id) => {
    await queuedPost('/items/move-to-right', { id }, `move-to-right:${id}`);
    setPendingAdd(p => new Set([...p, id]));
    left.setItems(prev => {
      const f = prev.filter(x => x !== id);
      if (f.length < PAGE_LIMIT) setTimeout(() => left.loadMore(), 0);
      return f;
    });
    left.setTotal(t => t - 1);
  };

  const moveLeft = async (id) => {
    if (pendingAdd.has(id)) {
      setPendingAdd(p => { const n = new Set(p); n.delete(id); return n; });
    } else {
      right.setItems(p => p.filter(x => x !== id));
      right.setTotal(t => t - 1);
    }
    left.setItems(p => [...p, id].sort((a,b) => a-b));
    left.setTotal(t => t + 1);
    await queuedPost('/items/move-to-left', { id }, `move-to-left:${id}`);
  };

  const onAdd = async () => {
    const id = parseInt(newIdIn);
    if (!id || isNaN(id)) return alert('Введите корректный числовой ID');
    try {
      await queuedPost('/items/add-new', { id }, `add-new:${id}`);
      setNewIdIn('');
      await left.reload();
    } catch (e) { alert(e.response?.data?.error || 'Ошибка'); }
  };

  const onDragEnd = async (e) => {
    const { active, over } = e;
    setActiveId(null); activeIdRef.current = null;
    if (over && active.id !== over.id && !pendingAdd.has(active.id)) {
      const oldIdx = right.items.indexOf(active.id);
      const newIdx = right.items.indexOf(over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const next = [...right.items];
        next.splice(oldIdx, 1); next.splice(newIdx, 0, active.id);
        right.setItems(next);
        const dto = next.map((v, i) => ({ id: v, newIndex: i }));
        await queuedPost('/items/reorder', { items: dto }, `reorder:${right.items.join(',')}`);
        if (!activeIdRef.current) await right.reload();
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={(e) => { setActiveId(e.active.id); activeIdRef.current = e.active.id; }} 
      onDragEnd={onDragEnd}
    >
      <main className="app">
        <section className="container left" aria-labelledby="left-title">
          <header>
            <h2 id="left-title">Все элементы ({left.total.toLocaleString()})</h2>
          </header>
          <div className="controls">
            <div className="search-row">
              <input 
                type="text" 
                placeholder="Поиск ID..." 
                value={leftIn} 
                onChange={e => setLeftIn(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && left.applySearch(leftIn)} 
                className="search-input"
                aria-label="Поиск в левой колонке"
              />
              <button 
                onClick={() => left.applySearch(leftIn)} 
                className="btn-search" 
                aria-label="Найти"
              >
                🔍
              </button>
              {left.loading && <span className="loading-indicator" aria-hidden="true">⏳</span>}
            </div>
            <div className="add-new">
              <input 
                type="number" 
                placeholder="Новый ID" 
                value={newIdIn} 
                onChange={e => setNewIdIn(e.target.value)} 
                className="new-id-input"
                aria-label="ID нового элемента"
              />
              <button onClick={onAdd} className="btn-add">Создать</button>
            </div>
          </div>
          <div className="items-container" ref={left.containerRef} role="list">
            {left.items.map(id => (
              <ItemCard key={`l-${id}`} id={id} onAction={moveRight} actionLabel="→" className="left-item-card" />
            ))}
            {left.loading && <div className="loading" role="status">Загрузка...</div>}
          </div>
        </section>

        <section className="container right" aria-labelledby="right-title">
          <header>
            <h2 id="right-title">Выбранные ({right.total.toLocaleString()})</h2>
          </header>
          <div className="controls">
            <div className="search-row">
              <input 
                type="text" 
                placeholder="Поиск ID..." 
                value={rightIn} 
                onChange={e => setRightIn(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && right.applySearch(rightIn)} 
                className="search-input"
                aria-label="Поиск в правой колонке"
              />
              <button 
                onClick={() => right.applySearch(rightIn)} 
                className="btn-search"
                aria-label="Найти"
              >
                🔍
              </button>
              {right.loading && <span className="loading-indicator" aria-hidden="true">⏳</span>}
            </div>
          </div>
          <div className="items-container" ref={right.containerRef} role="list">
            {[...pendingAdd].map(id => (
              <ItemCard key={`p-${id}`} id={id} onAction={moveLeft} actionLabel="⏳" className="right-item-card pending" />
            ))}
            <SortableContext items={right.items} strategy={verticalListSortingStrategy}>
              {right.items.map(id => (
                <ItemCard 
                  key={`r-${id}`} 
                  id={id} 
                  onAction={moveLeft} 
                  actionLabel="×" 
                  className="right-item-card" 
                  isSortable={true} 
                  isDragging={id === activeId} 
                />
              ))}
            </SortableContext>
            {right.loading && <div className="loading" role="status">Загрузка...</div>}
          </div>
        </section>
      </main>
      
      <DragOverlay>
        {activeId && (
          <div className="item-card dragging" aria-hidden="true">
            <span>ID: {activeId.toLocaleString()}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
