import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

const BACKEND = 'http://localhost:5000';

export default function MenuPage() {
  const { state, dispatch, notify } = useApp();
  const { restaurant } = state;
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeCategory = state.activeCategory || null;
  const setActiveCategory = (cat) => dispatch({ type: 'SET_ACTIVE_CATEGORY', payload: cat });

  // CRUD Modal State
  const [showCrudModal, setShowCrudModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '', category: 'Starters', price: 0, costPrice: 0, description: '', imageUrl: '', modifiers: [], isAvailable: true
  });
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Category CRUD State
  const [categoriesList, setCategoriesList] = useState([]);
  const [showCategoryCrudModal, setShowCategoryCrudModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [editingCategory, setEditingCategory] = useState(null);

  const fetchMenu = async () => {
    try {
      const { data } = await api.get('/menu');
      setMenuItems(data.items || []);
    } catch (err) {
      console.error('Error fetching menu', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategoriesList(data.categories || []);
      const cats = (data.categories || []).map(c => c.name);
      dispatch({ type: 'SET_MENU_CATEGORIES', payload: cats });
      // Auto-select first category if none selected
      if (cats.length > 0 && !state.activeCategory) {
        dispatch({ type: 'SET_ACTIVE_CATEGORY', payload: cats[0] });
      }
    } catch (err) {
      console.error('Error fetching categories', err);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchCategories();
  }, []);

  // ---- Category CRUD ----
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      notify('Category name is required', 'error');
      return;
    }
    try {
      if (editingCategory) {
        await api.patch(`/categories/${editingCategory._id}`, categoryForm);
        notify('Category updated!');
      } else {
        await api.post('/categories', categoryForm);
        notify('Category created!');
      }
      setCategoryForm({ name: '', description: '', sortOrder: 0 });
      setEditingCategory(null);
      fetchCategories();
      fetchMenu();
    } catch (err) {
      notify(err.response?.data?.message || 'Error saving category', 'error');
    }
  };

  const handleEditCategoryClick = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || '', sortOrder: cat.sortOrder || 0 });
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category? Any menu items using this category will be set to Uncategorized.')) return;
    try {
      await api.delete(`/categories/${catId}`);
      notify('Category deleted');
      fetchCategories();
      fetchMenu();
    } catch (err) {
      notify(err.response?.data?.message || 'Error deleting category', 'error');
    }
  };

  // ---- Image Upload ----
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);

    // Upload to backend
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setItemForm(p => ({ ...p, imageUrl: data.url }));
      notify('Image uploaded!');
    } catch {
      notify('Image upload failed', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // ---- Availability Toggle ----
  const handleToggleAvailable = async (item, e) => {
    e.stopPropagation();
    try {
      const { data } = await api.patch(`/menu/${item._id}/toggle-availability`);
      setMenuItems(prev => prev.map(m => m._id === item._id ? data.item : m));
      notify(`${item.name} is now ${data.item.isAvailable ? 'available' : 'unavailable'}`);
    } catch {
      notify('Failed to update availability', 'error');
    }
  };

  // ---- Edit / Create ----
  const handleEditClick = (item, e) => {
    e.stopPropagation();
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      price: item.price,
      costPrice: item.costPrice || 0,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      modifiers: item.modifiers ? [...item.modifiers] : [],
      isAvailable: item.isAvailable
    });
    setImagePreview(item.imageUrl || '');
    setShowCrudModal(true);
  };

  const handleCreateClick = () => {
    setEditingItem(null);
    setItemForm({ name: '', category: categoriesList[0]?.name || 'Starters', price: 0, costPrice: 0, description: '', imageUrl: '', modifiers: [], isAvailable: true });
    setImagePreview('');
    setShowCrudModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.category || itemForm.price < 0) {
      notify('Please fill out all required fields', 'error');
      return;
    }
    try {
      if (editingItem) {
        const { data } = await api.patch(`/menu/${editingItem._id}`, itemForm);
        setMenuItems(prev => prev.map(m => m._id === editingItem._id ? data.item : m));
        notify('Menu item updated!');
      } else {
        const { data } = await api.post('/menu', itemForm);
        setMenuItems(prev => [...prev, data.item]);
        notify('Menu item created!');
      }
      setShowCrudModal(false);
    } catch (err) {
      notify(err.response?.data?.message || 'Error saving menu item', 'error');
    }
  };

  const handleDeleteItem = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this menu item?')) return;
    try {
      await api.delete(`/menu/${id}`);
      setMenuItems(prev => prev.filter(m => m._id !== id));
      notify('Menu item deleted');
      setShowCrudModal(false);
    } catch {
      notify('Error deleting item', 'error');
    }
  };

  // ---- Modifiers ----
  const handleAddModifierField = () => {
    setItemForm(prev => ({ ...prev, modifiers: [...prev.modifiers, { name: '', price: 0 }] }));
  };

  const handleModifierFieldChange = (idx, field, value) => {
    const updated = [...itemForm.modifiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setItemForm(prev => ({ ...prev, modifiers: updated }));
  };

  const handleRemoveModifierField = (idx) => {
    setItemForm(prev => ({ ...prev, modifiers: prev.modifiers.filter((_, i) => i !== idx) }));
  };

  const sym = restaurant?.currencySymbol || '$';
  const categoryNames = categoriesList.length > 0
    ? categoriesList.map(c => c.name)
    : [...new Set(menuItems.map(m => m.category))];
  const categories = ['All', ...categoryNames];
  const effectiveCategory = activeCategory || (categoryNames[0] || 'All');
  const filtered = effectiveCategory === 'All' ? menuItems : menuItems.filter(m => m.category === effectiveCategory);

  const resolveImageSrc = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${BACKEND}${url}`;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Menu Management</h1>
          <p>Add, edit, and manage your restaurant menu items</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline" onClick={() => setShowCategoryCrudModal(true)}>📁 Manage Categories</button>
          <button className="btn btn-primary" onClick={handleCreateClick}>+ Add Menu Item</button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`btn btn-sm ${effectiveCategory === cat ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
            {cat !== 'All' && (
              <span style={{
                marginLeft: 5,
                background: effectiveCategory === cat ? 'rgba(255,255,255,0.25)' : 'var(--gray-200)',
                borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700,
                color: effectiveCategory === cat ? 'white' : 'var(--gray-600)'
              }}>
                {menuItems.filter(m => m.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🍽️</div>
          <p>No menu items found</p>
          <small>Create new items using the button above</small>
        </div>
      ) : (
        <div className="menu-grid">
          {filtered.map(item => (
            <div
              key={item._id}
              className={`menu-item-card ${item.isAvailable ? '' : 'unavailable'}`}
            >
              {/* Thumbnail */}
              {item.imageUrl ? (
                <div className="menu-item-card__thumb">
                  <img src={resolveImageSrc(item.imageUrl)} alt={item.name} />
                </div>
              ) : (
                <div className="menu-item-card__thumb menu-item-card__thumb--empty">🍴</div>
              )}

              <div className="menu-item-card__body">
                <span className="menu-item-card__category">{item.category}</span>
                <h3 className="menu-item-card__name">{item.name}</h3>
                <p className="menu-item-card__desc">{item.description || 'No description provided'}</p>
                {item.modifiers?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {item.modifiers.map((m, i) => (
                      <span key={i} className="badge badge-gray" style={{ marginRight: 4, fontSize: 9 }}>
                        +{m.name} (+{sym}{m.price.toFixed(2)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="menu-item-card__footer">
                <span className="menu-item-card__price">{sym}{item.price.toFixed(2)}</span>
                <div className="menu-item-card__actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={(e) => handleEditClick(item, e)}
                  >
                    Edit
                  </button>
                  <label className="toggle" style={{ margin: '0 4px' }}>
                    <input
                      type="checkbox"
                      checked={item.isAvailable}
                      onChange={(e) => handleToggleAvailable(item, e)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRUD MODAL */}
      {showCrudModal && (
        <div className="modal-overlay" onClick={() => setShowCrudModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>

            {/* Image Upload */}
            <div className="form-group">
              <label className="form-label">Item Photo</label>
              <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="image-upload-preview" />
                ) : (
                  <div className="image-upload-placeholder">
                    <span>📷</span>
                    <span>{uploadingImage ? 'Uploading…' : 'Click to upload image'}</span>
                    <small>JPEG or PNG, max 2 MB</small>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={handleImageFileChange}
              />
              {imagePreview && (
                <button
                  className="btn btn-sm btn-outline"
                  style={{ marginTop: 6 }}
                  onClick={() => { setImagePreview(''); setItemForm(p => ({ ...p, imageUrl: '' })); }}
                >
                  Remove Image
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input
                className="form-input"
                placeholder="e.g. Chicken Caesar Wrap"
                value={itemForm.name}
                onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="flex gap-12">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={itemForm.category}
                  onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))}
                >
                  {(categoriesList.length > 0 ? categoriesList.map(c => c.name) : ['Starters', 'Pizza', 'Salads', 'Mains', 'Beverages', 'Desserts']).map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Price ({sym})</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemForm.price}
                  onChange={e => setItemForm(p => ({ ...p, price: +e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Cost Price ({sym})</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemForm.costPrice}
                  onChange={e => setItemForm(p => ({ ...p, costPrice: +e.target.value }))}
                  placeholder="Ingredient cost"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                placeholder="Brief description of the item"
                value={itemForm.description}
                onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
                style={{ height: 60 }}
              />
            </div>

            {/* Modifiers Config */}
            <div className="form-group">
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Modifiers / Extra Add-ons</label>
                <button className="btn btn-sm btn-outline" onClick={handleAddModifierField}>+ Add Modifier</button>
              </div>

              {itemForm.modifiers.map((mod, idx) => (
                <div key={idx} className="flex gap-8 mb-8" style={{ alignItems: 'center' }}>
                  <input
                    className="form-input"
                    placeholder="Modifier name (e.g. Extra Cheese)"
                    value={mod.name}
                    onChange={e => handleModifierFieldChange(idx, 'name', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={mod.price}
                    onChange={e => handleModifierFieldChange(idx, 'price', +e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-sm btn-danger" onClick={() => handleRemoveModifierField(idx)}>✕</button>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              {editingItem && (
                <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={(e) => handleDeleteItem(editingItem._id, e)}>
                  Delete Item
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowCrudModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveItem} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORIES CRUD MODAL */}
      {showCategoryCrudModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryCrudModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Manage Categories</h2>
              <button className="btn btn-sm btn-outline" onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', sortOrder: 0 }); }}>Clear Form</button>
            </div>

            <div className="card mb-16" style={{ background: 'var(--gray-50)', padding: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{editingCategory ? '✏️ Edit Category' : '➕ Create Category'}</h3>
              <div className="flex gap-12" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                  <label className="form-label">Category Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Pasta"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: '2 1 240px', marginBottom: 0 }}>
                  <label className="form-label">Description (optional)</label>
                  <input
                    className="form-input"
                    placeholder="Short notes"
                    value={categoryForm.description}
                    onChange={e => setCategoryForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: '0 0 80px', marginBottom: 0 }}>
                  <label className="form-label">Sort Order</label>
                  <input
                    className="form-input"
                    type="number"
                    value={categoryForm.sortOrder}
                    onChange={e => setCategoryForm(p => ({ ...p, sortOrder: +e.target.value }))}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleSaveCategory} style={{ height: 42 }}>
                  {editingCategory ? 'Update' : 'Add'}
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'center' }}>Sort</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesList.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted" style={{ padding: 12 }}>No custom categories configured yet.</td>
                    </tr>
                  ) : (
                    categoriesList.map(cat => (
                      <tr key={cat._id}>
                        <td style={{ fontWeight: 600 }}>{cat.name}</td>
                        <td className="text-muted text-sm">{cat.description || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{cat.sortOrder}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-sm btn-outline" onClick={() => handleEditCategoryClick(cat)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCategory(cat._id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setShowCategoryCrudModal(false)}>Close Categories Manager</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
