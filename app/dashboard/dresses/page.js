'use client';

import { useState, useEffect } from 'react';
import { HDate } from '@hebcal/core';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import HebrewDatePicker from '../../../components/HebrewDatePicker';
import { Info, ExternalLink, RefreshCw, Trash2, Printer, CheckCircle, XCircle, List, ArrowUp, ArrowDown, ArrowUpDown, X, Save, Search, Filter, Wrench } from 'lucide-react';
import { useLabels } from '@/app/components/LabelsContext';

export default function DressesManagement() {
  const { getLabel } = useLabels();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDress, setEditingDress] = useState(null);
  const [isNewModel, setIsNewModel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active'); // 'active', 'inactive', 'deleted', 'all'
  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true' });
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState(['חנות', 'רזרבה', 'מחסן']);
  const [viewMode, setViewMode] = useState('rows'); // 'rows' | 'cubes'
  const [itemHistory, setItemHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // For the new item row
  const defaultNewItem = { sizeText: '', serialNumber: '', dressBarcode: '', location: '', entryDateToRepo: new Date().toISOString().split('T')[0] };
  const [newItem, setNewItem] = useState(defaultNewItem);
  
  // For items search and sort in modal
  const [itemsSearch, setItemsSearch] = useState('');
  const [itemsSort, setItemsSort] = useState({ key: 'sizeText', direction: 'asc' });
  const [itemsFilterStatus, setItemsFilterStatus] = useState('all'); // 'all', 'normal', 'deleted', 'inRepair', 'notInUse'
  const [itemsColumnFilters, setItemsColumnFilters] = useState({ sizeText: '', serialNumber: '', dressBarcode: '', location: '' });
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState({ key: 'entryDateToRepo', direction: 'desc' });
  const [advancedFilters, setAdvancedFilters] = useState({
    name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Server-side pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDresses, setTotalDresses] = useState(0);

  const fetchDresses = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page,
        limit,
        filterStatus,
        search: catalogSearch,
        sortKey: catalogSort.key,
        sortDir: catalogSort.direction,
        advName: advancedFilters.name,
        advSize: advancedFilters.size,
        advSerial: advancedFilters.serialNumber,
        advRentalsCountMin: advancedFilters.rentalsCountMin,
        advNotInUse: advancedFilters.notInUse,
        advInRepair: advancedFilters.inRepair,
        advItemDeleted: advancedFilters.itemDeleted
      });

      const res = await fetch(`/api/dresses?${queryParams.toString()}`);
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        setDresses(data.data);
        setTotalPages(data.totalPages || 1);
        setTotalDresses(data.total || 0);
      } else if (Array.isArray(data)) {
        // Fallback if API wasn't updated
        setDresses(data);
        setTotalPages(1);
        setTotalDresses(data.length);
      } else {
        console.error('API returned non-array:', data);
        setDresses([]);
      }
    } catch (e) {
      console.error('Failed to fetch dresses:', e);
      setDresses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setSettings(data);
    if (data.item_locations) {
      setLocations(data.item_locations.split(',').map(l => l.trim()));
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/pricelists/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error('Failed to fetch categories', e);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchDresses();
    }, 400); // Debounce API calls
    return () => clearTimeout(handler);
  }, [page, limit, filterStatus, catalogSearch, catalogSort, advancedFilters]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, catalogSearch, catalogSort, advancedFilters]);

  const handleEditClick = (dress) => {
    setEditingDress({ ...dress });
    setIsNewModel(false);
    setNewItem(defaultNewItem);
    setItemsSearch('');
  };

  const handleNewModelClick = async () => {
    setEditingDress({
      name: '',
      barcodePrefix: '',
      priceCategory: '',
      notes: '',
      inInspection: false,
      imageUrl: '',
      entryDateToRepo: new Date().toISOString()
    });
    setIsNewModel(true);
    setNewItem(defaultNewItem);

    // Fetch the next code automatically
    try {
      const res = await fetch('/api/dresses/next-code');
      if (res.ok) {
        const data = await res.json();
        setEditingDress(prev => ({ ...prev, barcodePrefix: data.nextCode }));
      }
    } catch (e) {
      console.error('Failed to auto-fetch code', e);
    }
  };

  const handleAutoCode = async () => {
    try {
      const res = await fetch('/api/dresses/next-code');
      const data = await res.json();
      if (res.ok) {
        setEditingDress({ ...editingDress, barcodePrefix: data.nextCode });
      } else {
        alert(data.error || 'שגיאה במציאת קוד אוטומטי');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בתקשורת');
    }
  };

  const handleSaveModel = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (editingDress.exitDateFromRepo && editingDress.entryDateToRepo) {
      if (new Date(editingDress.exitDateFromRepo) < new Date(editingDress.entryDateToRepo)) {
        alert('תאריך הוצאה לא יכול להיות קודם לתאריך הכנסה');
        return;
      }
    }
    if (isSaving) return;
    setIsSaving(true);
    
    const useModelNames = settings.useModelNames !== 'false';
    const payload = { ...editingDress };
    if (!useModelNames && !payload.name) {
      payload.name = `דגם ${payload.barcodePrefix || 'ללא קוד'}`;
    }

    try {
      const method = isNewModel ? 'POST' : 'PUT';
      const url = isNewModel ? '/api/dresses' : `/api/dresses/${editingDress.id}`;
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert(isNewModel ? 'דגם חדש נוצר בהצלחה!' : 'פרטי הדגם נשמרו בהצלחה');
        if (isNewModel) {
          setEditingDress(data);
          setIsNewModel(false);
        }
        fetchDresses();
      } else {
        alert(data.error || 'שגיאה בשמירת הנתונים');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת עם השרת');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setEditingDress({ ...editingDress, imageUrl: data.imageUrl });
      } else {
        alert('שגיאה בהעלאת התמונה');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת עם השרת בהעלאה');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteModel = async (id) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך למחוק דגם זה? לא ניתן למחוק אם יש פריטים מקושרים.')) return;
    
    try {
      const res = await fetch(`/api/dresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchDresses();
        setEditingDress(prev => prev && prev.id === id ? { ...prev, isDeleted: true } : prev);
      } else {
        alert(data.error || 'שגיאה במחיקת הדגם');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת');
    }
  };

  const handleRestoreModel = async (dress) => {
    if (!await window.customConfirm(`האם אתה בטוח שברצונך לשחזר את הדגם ${dress.barcodePrefix || dress.name}?`)) return;
    try {
      const res = await fetch(`/api/dresses/${dress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      if (res.ok) {
        alert('הדגם שוחזר בהצלחה');
        fetchDresses();
        setEditingDress(prev => prev && prev.id === dress.id ? { ...prev, isDeleted: false } : prev);
      } else {
        const err = await res.json();
        alert(err.error || 'שגיאה בשחזור הדגם');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת');
    }
  };

  const handleReturnToActivity = async (dress) => {
    if (!await window.customConfirm(`האם אתה בטוח שברצונך להחזיר לפעילות את הדגם ${dress.barcodePrefix || dress.name}?`)) return;
    
    // Check if the reason it's inactive is because of items
    const hasActiveItems = dress.items && dress.items.length > 0 && dress.items.some(i => !i.notInUse && !i.isDeleted);
    if (!hasActiveItems) {
        alert('שימו לב: לדגם זה אין פריטים פעילים במלאי. כדי שהדגם יהיה פעיל לחלוטין, יש להיכנס לכרטיס השמלה ולהוסיף פריטים או להחזירם לשימוש.');
    }

    try {
      const res = await fetch(`/api/dresses/${dress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitDateFromRepo: null })
      });
      if (res.ok) {
        alert('הדגם חזר לפעילות בהצלחה');
        fetchDresses();
        setEditingDress(prev => prev && prev.id === dress.id ? { ...prev, exitDateFromRepo: null } : prev);
      } else {
        const err = await res.json();
        alert(err.error || 'שגיאה בהחזרת הדגם לפעילות');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת');
    }
  };

  const syncBarcodeFields = (updatedItem, prefix) => {
    if (updatedItem.sizeText && updatedItem.serialNumber) {
      const sizeFormatted = updatedItem.sizeText.toString().padStart(2, '0');
      const serialFormatted = updatedItem.serialNumber.toString().padStart(2, '0');
      updatedItem.dressBarcode = `${prefix}${sizeFormatted}${serialFormatted}`;
    }
  };

  const syncFromBarcode = (updatedItem, prefix) => {
    const val = (updatedItem.dressBarcode || '').toString();
    const expectedLength = (prefix.toString().length) + 4;
    if (val.length === expectedLength && val.startsWith(prefix.toString())) {
      const remaining = val.slice(prefix.toString().length);
      const parsedSize = parseInt(remaining.slice(0, 2));
      const parsedSerial = parseInt(remaining.slice(2, 4));
      if (!isNaN(parsedSize)) updatedItem.sizeText = parsedSize.toString();
      if (!isNaN(parsedSerial)) updatedItem.serialNumber = parsedSerial.toString();
    }
  };

  const handleNewItemChange = (field, value) => {
    let finalValue = value;
    if (field === 'serialNumber' && value !== '') {
      let num = parseInt(value, 10);
      if (isNaN(num)) {
        finalValue = '';
      } else {
        if (num < 0) num = 0;
        if (num > 99) num = 99;
        finalValue = num.toString();
      }
    }
    const updated = { ...newItem, [field]: finalValue };
    const prefix = editingDress?.barcodePrefix || '';
    if (field === 'sizeText' || field === 'serialNumber') {
      syncBarcodeFields(updated, prefix);
    } else if (field === 'dressBarcode') {
      syncFromBarcode(updated, prefix);
    }
    setNewItem(updated);
  };

  const handleItemFieldChange = (item, field, value) => {
    const updatedItem = { ...item, [field]: value };
    const prefix = editingDress?.barcodePrefix || '';
    if (field === 'sizeText' || field === 'serialNumber') {
      syncBarcodeFields(updatedItem, prefix);
    } else if (field === 'dressBarcode') {
      syncFromBarcode(updatedItem, prefix);
    }
    setEditingDress(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === item.id ? updatedItem : i)
    }));
  };

  const handleItemFieldBlur = async (item) => {
    if (item.sizeText !== undefined) {
      const sizeNum = Number(item.sizeText);
      if (!isNaN(sizeNum)) {
        if (sizeNum < 0 || sizeNum > 99 || !Number.isInteger(sizeNum)) {
          alert("מידה חייבת להיות מספר שלם בין 0 ל-99");
          fetchDresses();
          return;
        }
      }
    }
    try {
      const res = await fetch(`/api/dresses/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sizeText: item.sizeText,
          serialNumber: item.serialNumber,
          dressBarcode: item.dressBarcode,
          location: item.location
        })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'שגיאה בשמירת פריט');
        fetchDresses(); // sync back in case of error
      }
    } catch (e) {
      console.error('Error saving item on blur', e);
    }
  };

  const handleAddItem = async () => {
    if (isSaving) return;
    if (!newItem.sizeText) {
      alert("חובה להזין מידה");
      return;
    }
    const sizeNum = Number(newItem.sizeText);
    if (!isNaN(sizeNum)) {
      if (sizeNum < 0 || sizeNum > 99 || !Number.isInteger(sizeNum)) {
        alert("מידה חייבת להיות מספר שלם בין 0 ל-99");
        return;
      }
    }
    if (isNewModel) {
      alert("יש לשמור את הדגם תחילה לפני הוספת פריטים.");
      return;
    }

    let finalNewItem = { ...newItem };
    
    // Auto-generate serialNumber if missing
    if (!finalNewItem.serialNumber) {
      const sameSizeItems = (editingDress.items || []).filter(i => i.sizeText === finalNewItem.sizeText && i.serialNumber !== null && i.serialNumber !== undefined && i.serialNumber !== '');
      let maxSerial = 0;
      if (sameSizeItems.length > 0) {
        maxSerial = Math.max(...sameSizeItems.map(i => parseInt(i.serialNumber, 10)));
      }
      finalNewItem.serialNumber = (maxSerial + 1).toString();
    }
    
    // Auto-generate barcode if missing
    if (!finalNewItem.dressBarcode) {
      const prefix = editingDress?.barcodePrefix || '';
      const sizeFormatted = finalNewItem.sizeText.toString().padStart(2, '0');
      const serialFormatted = finalNewItem.serialNumber.toString().padStart(2, '0');
      finalNewItem.dressBarcode = `${prefix}${sizeFormatted}${serialFormatted}`;
    }
    
    // Default location if missing
    if (!finalNewItem.location && locations && locations.length > 0) {
      finalNewItem.location = locations[0];
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/dresses/${editingDress.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalNewItem)
      });
      if (res.ok) {
        const created = await res.json();
        setEditingDress({
          ...editingDress,
          items: [...(editingDress.items || []), created]
        });
        setNewItem(defaultNewItem);
      } else {
        const errData = await res.json();
        alert(errData.error || "שגיאה בהוספת הפריט");
      }
    } catch (error) {
      console.error(error);
      alert("שגיאה בתקשורת");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך למחוק פריט זה?')) return;
    try {
      const res = await fetch(`/api/dresses/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        setEditingDress({
          ...editingDress,
          items: editingDress.items.map(i => i.id === itemId ? { ...i, isDeleted: true } : i)
        });
        fetchDresses(); // sync main state
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRestoreItem = async (itemId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך לשחזר פריט זה?')) return;
    try {
      const res = await fetch(`/api/dresses/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      if (res.ok) {
        setEditingDress({
          ...editingDress,
          items: editingDress.items.map(i => i.id === itemId ? { ...i, isDeleted: false } : i)
        });
        fetchDresses(); // sync main state
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה בשחזור פריט');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const toggleItemStatus = async (item, field) => {
    try {
      const updatedValue = !item[field];
      const res = await fetch(`/api/dresses/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: updatedValue, notInUseSince: field === 'notInUse' && updatedValue ? new Date().toISOString() : null })
      });
      if (res.ok) {
        const updated = await res.json();
        setEditingDress({
          ...editingDress,
          items: editingDress.items.map(i => i.id === item.id ? updated : i)
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenHistory = async (item) => {
    setHistoryLoading(true);
    setItemHistory({ ...item, rentals: [] });
    try {
      const res = await fetch(`/api/dresses/items/${item.id}/history`);
      const data = await res.json();
      if (res.ok) {
        setItemHistory({ ...item, ...data });
      } else {
        alert('שגיאה בטעינת היסטוריה');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatHebrewDate = (isoString) => {
    if (!isoString) return '-';
    try {
      return getHebrewDateString(isoString);
    } catch (e) {
      return new Date(isoString).toLocaleDateString('he-IL');
    }
  };

  const getImageSource = (dress) => {
    if (dress.imageUrl) return dress.imageUrl;
    if (settings.useFileNamesForImages === 'true' && dress.barcodePrefix) {
      return `/images/dresses/${dress.barcodePrefix}.jpg`;
    }
    return null;
  };

  const filteredDresses = dresses;

  const handleCatalogSort = (key) => {
    let direction = 'asc';
    if (catalogSort.key === key && catalogSort.direction === 'asc') direction = 'desc';
    setCatalogSort({ key, direction });
  };

  const formatSerialRanges = (serials) => {
    if (!serials || serials.length === 0) return '';
    const nums = serials.map(s => parseInt(s, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length === 0) return '';
    const ranges = [];
    let start = nums[0];
    let prev = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      if (nums[i] === prev + 1) {
        prev = nums[i];
      } else {
        if (start === prev) ranges.push(`${start}`);
        else ranges.push(`${start}-${prev}`);
        if (i < nums.length) {
          start = nums[i];
          prev = nums[i];
        }
      }
    }
    return ranges.join(', ');
  };

  const useModelNames = settings.useModelNames !== 'false';

  const filteredAndSortedItems = editingDress?.items
    ? [...editingDress.items]
        .filter(item => {
          if (!itemsSearch) return true;
          const term = itemsSearch.toLowerCase();
          return (
            (item.sizeText && item.sizeText.toLowerCase().includes(term)) ||
            (item.serialNumber && item.serialNumber.toString().includes(term)) ||
            (item.dressBarcode && item.dressBarcode.toLowerCase().includes(term)) ||
            (item.location && item.location.toLowerCase().includes(term))
          );
        })
        .filter(item => {
          if (itemsFilterStatus === 'deleted') return item.isDeleted;
          if (itemsFilterStatus === 'notInUse') return item.notInUse && !item.isDeleted;
          if (itemsFilterStatus === 'inRepair') return item.inRepair && !item.isDeleted;
          if (itemsFilterStatus === 'normal') return !item.isDeleted && !item.inRepair && !item.notInUse;
          return true; // 'all'
        })
        .filter(item => {
          if (itemsColumnFilters.sizeText && (!item.sizeText || !item.sizeText.includes(itemsColumnFilters.sizeText))) return false;
          if (itemsColumnFilters.serialNumber && (!item.serialNumber || !item.serialNumber.toString().includes(itemsColumnFilters.serialNumber))) return false;
          if (itemsColumnFilters.dressBarcode && (!item.dressBarcode || !item.dressBarcode.toLowerCase().includes(itemsColumnFilters.dressBarcode.toLowerCase()))) return false;
          if (itemsColumnFilters.location && (!item.location || !item.location.toLowerCase().includes(itemsColumnFilters.location.toLowerCase()))) return false;
          return true;
        })
        .sort((a, b) => {
          if (!itemsSort.key) return 0;
          const aVal = a[itemsSort.key] || '';
          const bVal = b[itemsSort.key] || '';
          if (aVal < bVal) return itemsSort.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return itemsSort.direction === 'asc' ? 1 : -1;
          return 0;
        })
    : [];

  const handleItemsSort = (key) => {
    let direction = 'asc';
    if (itemsSort.key === key && itemsSort.direction === 'asc') direction = 'desc';
    setItemsSort({ key, direction });
  };

  // Group items for Cubes View
  const itemsBySize = {};
  if (viewMode === 'cubes') {
    filteredAndSortedItems.forEach(item => {
      let size = item.sizeText ? item.sizeText.trim() : 'ללא מידה';
      if (!isNaN(size) && size !== '') {
        size = parseInt(size, 10).toString();
      }
      if (!itemsBySize[size]) itemsBySize[size] = [];
      itemsBySize[size].push(item);
    });
  }

  let headerBgColor = 'var(--primary-color)';
  if (editingDress && !isNewModel) {
    const hasActiveItems = editingDress.items && editingDress.items.length > 0 && editingDress.items.some(i => !i.notInUse && !i.isDeleted);
    const isInactive = editingDress.exitDateFromRepo || (editingDress.items && editingDress.items.length > 0 && !hasActiveItems);
    
    if (editingDress.isDeleted) {
      headerBgColor = '#e53935';
    } else if (isInactive) {
      headerBgColor = '#f57c00';
    }
  }

  return (
    <>
      <main className="container animate-fade-in" style={{ paddingTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>מאגר שמלות - קטלוג ראשי</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="חיפוש טקסט חופשי..."
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="filter-select"
                  style={{ minWidth: '200px', padding: '0.5rem', paddingLeft: '2rem', borderRadius: '8px' }}
                />
                {catalogSearch && (
                  <button
                    onClick={() => setCatalogSearch('')}
                    style={{
                      position: 'absolute',
                      left: '0.5rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: 'var(--text-muted)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="נקה חיפוש"
                  >
                    ×
                  </button>
                )}
              </div>
              <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="btn btn-outline" 
                style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: showAdvancedFilters ? '#e3f2fd' : 'var(--card-bg)', borderColor: showAdvancedFilters ? '#1976d2' : 'var(--element-border)' }}
                title="סינון מתקדם"
              >
                סינון מתקדם {showAdvancedFilters ? '▲' : '▼'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px' }}>
              <button onClick={() => setFilterStatus('active')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'active' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'active' ? '#2e7d32' : 'var(--text-main)' }} title="דגמים פעילים"><CheckCircle size={20} /></button>
              <button onClick={() => setFilterStatus('inactive')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'inactive' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'inactive' ? '#f57c00' : 'var(--text-main)' }} title="לא פעילים"><XCircle size={20} /></button>
              <button onClick={() => setFilterStatus('deleted')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'deleted' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'deleted' ? '#e53935' : 'var(--text-main)' }} title="מחוקים"><Trash2 size={20} /></button>
              <button onClick={() => setFilterStatus('all')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'all' ? '#1976d2' : 'var(--text-main)' }} title="הצג הכל"><List size={20} /></button>
            </div>
            <button onClick={handleNewModelClick} className="btn btn-primary" style={{ background: '#2e7d32', borderColor: '#2e7d32' }}>
              + הוסף דגם חדש
            </button>
          </div>
        </div>
        
        {showAdvancedFilters && (
          <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', border: '1px solid var(--element-border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold', color: '#1976d2', width: '100%' }}>סינון מתקדם:</div>
            
            <input type="text" placeholder="שם דגם / קידומת" value={advancedFilters.name} onChange={e => setAdvancedFilters({...advancedFilters, name: e.target.value})} className="filter-select" style={{ minWidth: '150px' }} />
            <input type="text" placeholder="מידה" value={advancedFilters.size} onChange={e => setAdvancedFilters({...advancedFilters, size: e.target.value})} className="filter-select" style={{ width: '80px' }} />
            <input type="number" placeholder="מס' סידורי" value={advancedFilters.serialNumber} onChange={e => setAdvancedFilters({...advancedFilters, serialNumber: e.target.value})} className="filter-select" style={{ width: '100px' }} />
            <input type="number" placeholder="השכרות מינימום" value={advancedFilters.rentalsCountMin} onChange={e => setAdvancedFilters({...advancedFilters, rentalsCountMin: e.target.value})} className="filter-select" style={{ width: '140px' }} />
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid #ddd' }}>
              <input type="checkbox" checked={advancedFilters.notInUse} onChange={e => setAdvancedFilters({...advancedFilters, notInUse: e.target.checked})} />
              לא בשימוש (פריט)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid #ddd' }}>
              <input type="checkbox" checked={advancedFilters.inRepair} onChange={e => setAdvancedFilters({...advancedFilters, inRepair: e.target.checked})} />
              בתיקון
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid #ddd' }}>
              <input type="checkbox" checked={advancedFilters.itemDeleted} onChange={e => setAdvancedFilters({...advancedFilters, itemDeleted: e.target.checked})} />
              פריט מחוק
            </label>
            
            <button onClick={() => setAdvancedFilters({name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false})} className="btn" style={{ background: 'var(--element-bg)', color: 'var(--text-main)', border: 'none', padding: '0.4rem 1rem' }}>
              נקה סינונים
            </button>
          </div>
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>טוען נתונים...</div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', background: '#f8f9fa' }}>
                  <th style={{ padding: '1rem' }}>תמונה</th>
                  <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('barcodePrefix')}>{getLabel('item_barcode', 'קוד')} {catalogSort.key === 'barcodePrefix' ? (catalogSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</th>
                  {useModelNames && <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('name')}>{getLabel('item_modelName', 'שם דגם')} {catalogSort.key === 'name' ? (catalogSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</th>}
                  <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('entryDateToRepo')}>תאריך כניסה {catalogSort.key === 'entryDateToRepo' ? (catalogSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</th>
                  <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('itemsCount')}>כמות פריטים {catalogSort.key === 'itemsCount' ? (catalogSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredDresses.map(dress => (
                  <tr key={dress.id} style={{ borderBottom: '1px solid #eee', background: dress.isDeleted ? '#ffebee' : ((!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo ? '#fff5f5' : 'transparent') }}>
                    <td style={{ padding: '1rem' }}>
                      {getImageSource(dress) ? (
                        <img src={getImageSource(dress)} alt={dress.name} onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : null}
                      <div style={{ display: getImageSource(dress) ? 'none' : 'flex', width: '50px', height: '50px', background: '#eee', borderRadius: '4px', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>אין</div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1976d2' }}>{dress.barcodePrefix || '-'}</td>
                    {useModelNames && <td style={{ padding: '1rem', fontWeight: 'bold' }}>{dress.name}</td>}
                    <td style={{ padding: '1rem' }}>{formatHebrewDate(dress.entryDateToRepo)}</td>
                    <td style={{ padding: '1rem' }}>{dress.items?.filter(i => !i.isDeleted).length || 0}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button onClick={() => handleEditClick(dress)} className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem', marginLeft: '0.5rem' }}>כרטיס שמלה</button>
                      {dress.isDeleted ? (
                        <button onClick={() => handleRestoreModel(dress)} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', borderColor: '#4caf50', color: '#4caf50' }} title="שחזר"><RefreshCw size={18} /></button>
                      ) : ((!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo) ? (
                        <button onClick={() => handleReturnToActivity(dress)} className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem', borderColor: '#ff9800', color: '#ff9800' }}>החזר לפעילות</button>
                      ) : (
                        <button onClick={() => handleDeleteModel(dress.id)} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', borderColor: '#e53935', color: '#e53935' }} title="מחק"><Trash2 size={18} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--card-bg)', borderTop: '1px solid #e0e0e0', borderRadius: '0 0 12px 12px' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 1rem' }}
                >
                  הקודם
                </button>
                <span style={{ fontWeight: 'bold' }}>עמוד {page} מתוך {totalPages} (סה"כ {totalDresses} תוצאות)</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 1rem' }}
                >
                  הבא
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {editingDress && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { handleSaveModel().then(() => { fetchDresses(); setEditingDress(null); }); }}>
          <div style={{ background: '#f5f7fa', padding: '0', borderRadius: '12px', width: '95%', maxWidth: '1000px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ background: headerBgColor, color: 'white', padding: '1.5rem', borderRadius: '12px 12px 0 0', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <h2 style={{ margin: 0 }}>{isNewModel ? 'הוספת דגם חדש' : `כרטיס שמלה: ${useModelNames ? editingDress.name + ' (קוד: ' + (editingDress.barcodePrefix || 'אין') + ')' : editingDress.barcodePrefix}`}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <button type="button" onClick={(e) => handleSaveModel(e)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <Save size={18} /> שמור
                </button>
                {!isNewModel && editingDress && (
                  <>
                    <button type="button" onClick={() => window.open(`/dashboard/dresses/${editingDress.id}/print`, '_blank')} title="הדפס כרטיס שמלה" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                      <Printer size={18} /> הדפס
                    </button>
                    {!editingDress.isDeleted && (
                      <button type="button" onClick={() => handleDeleteModel(editingDress.id)} title="מחק דגם" style={{ background: 'rgba(229, 57, 53, 0.8)', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <Trash2 size={18} /> מחק
                      </button>
                    )}
                  </>
                )}
                <button type="button" onClick={() => { handleSaveModel().then(() => { fetchDresses(); setEditingDress(null); }); }} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }} title="סגור ושמור">
                   סגור
                </button>
                <button type="button" onClick={() => { fetchDresses(); setEditingDress(null); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="ביטול ללא שמירה">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>פרטי הדגם</h3>
                <form onSubmit={handleSaveModel} style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                  
                  <div style={{ flex: '1 1 300px' }}>
                    {getImageSource(editingDress) ? (
                      <img src={getImageSource(editingDress)} alt="Preview" onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} style={{ width: '100%', height: '250px', objectFit: 'contain', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', marginBottom: '1rem' }} />
                    ) : null}
                    <div style={{ display: getImageSource(editingDress) ? 'none' : 'flex', width: '100%', height: '250px', background: '#f9f9f9', borderRadius: '8px', border: '1px dashed var(--element-border)', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>אין תמונה</div>
                    
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                    {uploading && <small style={{ color: 'var(--primary-color)', display: 'block', marginTop: '0.5rem' }}>מעלה תמונה...</small>}
                  </div>

                  <div style={{ flex: '2 1 400px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignContent: 'start' }}>
                    <div style={{ gridColumn: useModelNames ? '1 / -1' : '1' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>קוד</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" value={editingDress.barcodePrefix || ''} onChange={e => setEditingDress({...editingDress, barcodePrefix: e.target.value})} className="filter-select" style={{ flex: 1 }} required={!useModelNames} disabled={!isNewModel} />
                        {isNewModel && (
                           <button type="button" onClick={handleAutoCode} className="btn btn-outline" style={{ whiteSpace: 'nowrap', padding: '0.5rem', fontSize: '0.9rem' }}>בחר קוד אוטומטי</button>
                        )}
                      </div>
                    </div>
                    {useModelNames && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם דגם</label>
                        <input type="text" value={editingDress.name || ''} onChange={e => setEditingDress({...editingDress, name: e.target.value})} className="filter-select" style={{ width: '100%' }} required />
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>קטגוריית מחיר</label>
                      <select value={editingDress.priceCategory || ''} onChange={e => setEditingDress({...editingDress, priceCategory: e.target.value})} className="filter-select" style={{ width: '100%' }}>
                        <option value="">-- בחר קטגוריית מחיר --</option>
                        {categories.map((cat, idx) => (
                          <option key={idx} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תאריך כניסה</label>
                      <HebrewDatePicker 
                        value={editingDress.entryDateToRepo} 
                        onChange={(date) => setEditingDress({...editingDress, entryDateToRepo: date})} 
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontWeight: 'bold', margin: 0 }}>תאריך יציאה מהמערכת</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <input 
                            type="checkbox" 
                            id="markInactive"
                            checked={!!editingDress.exitDateFromRepo}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingDress({...editingDress, exitDateFromRepo: new Date().toISOString()});
                              } else {
                                setEditingDress({...editingDress, exitDateFromRepo: null});
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="markInactive" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>סמן כלא פעיל</label>
                        </div>
                      </div>
                      <HebrewDatePicker 
                        value={editingDress.exitDateFromRepo} 
                        onChange={(date) => setEditingDress({...editingDress, exitDateFromRepo: date})} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                      <input type="checkbox" id="inInspection" checked={editingDress.inInspection || false} onChange={e => setEditingDress({...editingDress, inInspection: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                      <label htmlFor="inInspection" style={{ fontWeight: 'bold' }}>הצג בבדיקה (התראה)</label>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>הערות לדגם</label>
                      <textarea value={editingDress.notes || ''} onChange={e => setEditingDress({...editingDress, notes: e.target.value})} className="filter-select" style={{ width: '100%', minHeight: '60px' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                      {!isNewModel && (
                        editingDress.isDeleted ? (
                          <button type="button" onClick={() => handleRestoreModel(editingDress)} className="btn btn-outline" style={{ padding: '0.7rem 2rem', borderColor: '#4caf50', color: '#4caf50' }}>
                            שחזר דגם מחוק
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleDeleteModel(editingDress.id)} className="btn btn-outline" style={{ padding: '0.7rem 2rem', borderColor: '#e53935', color: '#e53935' }}>
                            מחק דגם
                          </button>
                        )
                      )}
                      {isNewModel && <div></div>}
                      <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ padding: '0.7rem 2rem' }}>
                        {isSaving ? 'שומר...' : (isNewModel ? 'שמור וצור דגם' : 'שמור פרטי דגם')}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {!isNewModel && (
                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>פירוט שמלות (מלאי ומידות)</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px' }}>
                        <button type="button" onClick={() => setItemsFilterStatus('all')} style={{ padding: '0.3rem 0.5rem', border: 'none', background: itemsFilterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: itemsFilterStatus === 'all' ? '#1976d2' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="הכל"><List size={16} /> הכל</button>
                        <button type="button" onClick={() => setItemsFilterStatus('normal')} style={{ padding: '0.3rem 0.5rem', border: 'none', background: itemsFilterStatus === 'normal' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: itemsFilterStatus === 'normal' ? '#2e7d32' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="רגיל"><CheckCircle size={16} /> רגיל</button>
                        <button type="button" onClick={() => setItemsFilterStatus('notInUse')} style={{ padding: '0.3rem 0.5rem', border: 'none', background: itemsFilterStatus === 'notInUse' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: itemsFilterStatus === 'notInUse' ? '#f57c00' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="לא בשימוש"><XCircle size={16} /> לא בשימוש</button>
                        <button type="button" onClick={() => setItemsFilterStatus('inRepair')} style={{ padding: '0.3rem 0.5rem', border: 'none', background: itemsFilterStatus === 'inRepair' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: itemsFilterStatus === 'inRepair' ? '#1976d2' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="בתיקון"><Wrench size={16} /> בתיקון</button>
                        <button type="button" onClick={() => setItemsFilterStatus('deleted')} style={{ padding: '0.3rem 0.5rem', border: 'none', background: itemsFilterStatus === 'deleted' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: itemsFilterStatus === 'deleted' ? '#e53935' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="מחוק"><Trash2 size={16} /> מחוק</button>
                      </div>
                      <button type="button" onClick={() => setViewMode(viewMode === 'rows' ? 'cubes' : 'rows')} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>
                        {viewMode === 'rows' ? 'הצג כקוביות' : 'הצג כשורות'}
                      </button>
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="חיפוש בפריטים (מידה, מספר סידורי, ברקוד...)" 
                          value={itemsSearch} 
                          onChange={e => setItemsSearch(e.target.value)} 
                          className="filter-select"
                          style={{ width: '300px', padding: '0.4rem 0.8rem', paddingLeft: '2rem', borderRadius: '20px' }}
                        />
                        {itemsSearch && (
                          <button
                            onClick={() => setItemsSearch('')}
                            style={{
                              position: 'absolute',
                              left: '0.8rem',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              color: 'var(--text-muted)',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="נקה חיפוש"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {viewMode === 'rows' ? (
                    <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                      <thead>
                        <tr style={{ background: '#e3f2fd', borderBottom: '2px solid #90caf9' }}>
                          <td style={{ padding: '0.8rem' }}>
                            <input type="text" placeholder="הזן מידה..." value={newItem.sizeText} onChange={e => handleNewItemChange('sizeText', e.target.value)} className="filter-select" style={{ width: '100%', padding: '0.4rem' }} />
                          </td>
                          <td style={{ padding: '0.8rem' }}>
                            <input type="number" min="0" max="99" placeholder="מס סידורי" value={newItem.serialNumber} onChange={e => handleNewItemChange('serialNumber', e.target.value)} className="filter-select" style={{ width: '100%', padding: '0.4rem' }} />
                          </td>
                          <td style={{ padding: '0.8rem' }}>
                            <input type="text" placeholder="ברקוד פריט" value={newItem.dressBarcode} onChange={e => handleNewItemChange('dressBarcode', e.target.value)} className="filter-select" style={{ width: '100%', padding: '0.4rem' }} />
                          </td>
                          <td style={{ padding: '0.8rem' }}>
                            <select value={newItem.location} onChange={e => handleNewItemChange('location', e.target.value)} className="filter-select" style={{ width: '100%', padding: '0.4rem' }}>
                              <option value="">-- בחר מיקום --</option>
                              {locations.map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                            </select>
                          </td>
                          <td colSpan="3" style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.9rem', color: '#1976d2' }}>
                            הוספה מהירה (נוצר ב: {formatHebrewDate(newItem.entryDateToRepo)})
                          </td>
                          <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                            <button type="button" onClick={handleAddItem} disabled={isSaving} className="btn btn-primary" style={{ padding: '0.4rem 1rem', background: '#1976d2' }}>
                              {isSaving ? 'מוסיף...' : 'הוסף פריט'}
                            </button>
                          </td>
                        </tr>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ cursor: 'pointer' }} onClick={() => handleItemsSort('sizeText')}>{getLabel('item_size', 'מידה')} {itemsSort.key === 'sizeText' ? (itemsSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</span>
                              <Filter size={14} color={itemsColumnFilters.sizeText ? '#1976d2' : '#ccc'} style={{ cursor: 'pointer', marginLeft: '0.5rem' }} onClick={() => setShowColumnFilters(!showColumnFilters)} title="סנן עמודה זו" />
                            </div>
                            {showColumnFilters && <input type="text" placeholder="סנן מידה..." value={itemsColumnFilters.sizeText} onChange={e => setItemsColumnFilters({...itemsColumnFilters, sizeText: e.target.value})} style={{ width: '100%', padding: '0.2rem', marginTop: '0.4rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }} />}
                          </th>
                          <th style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ cursor: 'pointer' }} onClick={() => handleItemsSort('serialNumber')}>{getLabel('item_serialNumber', "מס' סידורי")} {itemsSort.key === 'serialNumber' ? (itemsSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</span>
                              <Filter size={14} color={itemsColumnFilters.serialNumber ? '#1976d2' : '#ccc'} style={{ cursor: 'pointer', marginLeft: '0.5rem' }} onClick={() => setShowColumnFilters(!showColumnFilters)} title="סנן עמודה זו" />
                            </div>
                            {showColumnFilters && <input type="text" placeholder="סנן מס'..." value={itemsColumnFilters.serialNumber} onChange={e => setItemsColumnFilters({...itemsColumnFilters, serialNumber: e.target.value})} style={{ width: '100%', padding: '0.2rem', marginTop: '0.4rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }} />}
                          </th>
                          <th style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ cursor: 'pointer' }} onClick={() => handleItemsSort('dressBarcode')}>{getLabel('item_barcode', 'ברקוד פריט')} {itemsSort.key === 'dressBarcode' ? (itemsSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</span>
                              <Filter size={14} color={itemsColumnFilters.dressBarcode ? '#1976d2' : '#ccc'} style={{ cursor: 'pointer', marginLeft: '0.5rem' }} onClick={() => setShowColumnFilters(!showColumnFilters)} title="סנן עמודה זו" />
                            </div>
                            {showColumnFilters && <input type="text" placeholder="סנן ברקוד..." value={itemsColumnFilters.dressBarcode} onChange={e => setItemsColumnFilters({...itemsColumnFilters, dressBarcode: e.target.value})} style={{ width: '100%', padding: '0.2rem', marginTop: '0.4rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }} />}
                          </th>
                          <th style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ cursor: 'pointer' }} onClick={() => handleItemsSort('location')}>מיקום {itemsSort.key === 'location' ? (itemsSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</span>
                              <Filter size={14} color={itemsColumnFilters.location ? '#1976d2' : '#ccc'} style={{ cursor: 'pointer', marginLeft: '0.5rem' }} onClick={() => setShowColumnFilters(!showColumnFilters)} title="סנן עמודה זו" />
                            </div>
                            {showColumnFilters && <input type="text" placeholder="סנן מיקום..." value={itemsColumnFilters.location} onChange={e => setItemsColumnFilters({...itemsColumnFilters, location: e.target.value})} style={{ width: '100%', padding: '0.2rem', marginTop: '0.4rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }} />}
                          </th>
                          <th style={{ padding: '0.8rem', textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap', verticalAlign: 'top' }} onClick={() => handleItemsSort('inRepair')}>
                            <div style={{ display: 'inline-block' }}>בתיקון? {itemsSort.key === 'inRepair' ? (itemsSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</div>
                          </th>
                          <th style={{ padding: '0.8rem', textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap', verticalAlign: 'top' }} onClick={() => handleItemsSort('notInUse')}>
                            <div style={{ display: 'inline-block' }}>לא בשימוש? {itemsSort.key === 'notInUse' ? (itemsSort.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} color="#ccc" />}</div>
                          </th>
                          <th style={{ padding: '0.8rem', textAlign: 'center', verticalAlign: 'top' }}>מידע</th>
                          <th style={{ padding: '0.8rem', textAlign: 'center', verticalAlign: 'top' }}>פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedItems.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #eee', background: item.isDeleted ? '#ffebee' : (item.notInUse ? '#fff0f0' : (item.inRepair ? '#fff8e1' : 'transparent')) }}>
                            <td style={{ padding: '0.8rem' }}>
                              <input type="text" value={item.sizeText || ''} className="filter-select" style={{ width: '80px', padding: '0.3rem', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'not-allowed' }} disabled title="לא ניתן לשנות מידה לפריט קיים" />
                            </td>
                            <td style={{ padding: '0.8rem' }}>
                              <input type="number" value={item.serialNumber || ''} className="filter-select" style={{ width: '80px', padding: '0.3rem', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'not-allowed' }} disabled title="לא ניתן לשנות מס' סידורי לפריט קיים" />
                            </td>
                            <td style={{ padding: '0.8rem' }}>
                              <input type="text" value={item.dressBarcode || ''} onChange={e => handleItemFieldChange(item, 'dressBarcode', e.target.value)} onBlur={() => handleItemFieldBlur(item)} className="filter-select" style={{ width: '120px', padding: '0.3rem', background: 'transparent', border: '1px solid transparent' }} onFocus={e => e.target.style.background = 'var(--input-bg)'} />
                            </td>
                            <td style={{ padding: '0.8rem' }}>
                              <select value={item.location || ''} onChange={e => { handleItemFieldChange(item, 'location', e.target.value); handleItemFieldBlur({...item, location: e.target.value}); }} className="filter-select" style={{ width: '100px', padding: '0.3rem', background: 'transparent', border: '1px solid transparent' }}>
                                <option value="">--</option>
                                {locations.map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                              <input type="checkbox" checked={item.inRepair || false} onChange={() => toggleItemStatus(item, 'inRepair')} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                            </td>
                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                              <input type="checkbox" checked={item.notInUse || false} onChange={() => toggleItemStatus(item, 'notInUse')} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                            </td>
                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                              <button onClick={() => handleOpenHistory(item)} className="btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="פרטים נוספים">
                                <Info size={20} color="#1976d2" />
                              </button>
                            </td>
                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                              {item.isDeleted ? (
                                <button onClick={() => handleRestoreItem(item.id)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderColor: '#4caf50', color: '#4caf50' }}>שחזר</button>
                              ) : (
                                <button onClick={() => handleDeleteItem(item.id)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderColor: '#e53935', color: '#e53935' }}>מחק</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredAndSortedItems.length === 0 && (
                          <tr>
                            <td colSpan="8" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-main)' }}>אין פריטים להצגה במלאי זה.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ background: '#e3f2fd', border: '2px dashed #90caf9', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, textAlign: 'center', color: '#1976d2' }}>הוסף פריט חדש (נוצר ב: {formatHebrewDate(newItem.entryDateToRepo)})</h4>
                        <input type="text" placeholder="מידה" value={newItem.sizeText} onChange={e => handleNewItemChange('sizeText', e.target.value)} className="filter-select" />
                        <input type="number" min="0" max="99" placeholder="מס סידורי" value={newItem.serialNumber} onChange={e => handleNewItemChange('serialNumber', e.target.value)} className="filter-select" />
                        <input type="text" placeholder="ברקוד" value={newItem.dressBarcode} onChange={e => handleNewItemChange('dressBarcode', e.target.value)} className="filter-select" />
                        <select value={newItem.location} onChange={e => handleNewItemChange('location', e.target.value)} className="filter-select">
                          <option value="">-- בחר מיקום --</option>
                          {locations.map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                        </select>
                        <button type="button" onClick={handleAddItem} disabled={isSaving} className="btn btn-primary" style={{ marginTop: '0.5rem', background: '#1976d2' }}>
                          {isSaving ? 'מוסיף...' : 'הוסף פריט'}
                        </button>
                      </div>
                      
                      {Object.keys(itemsBySize).map(size => {
                        const sizeItems = itemsBySize[size];
                        const deletedCount = sizeItems.filter(i => i.isDeleted).length;
                        const notInUseCount = sizeItems.filter(i => i.notInUse && !i.isDeleted).length;
                        const inRepairCount = sizeItems.filter(i => i.inRepair && !i.isDeleted).length;
                        const normalItems = sizeItems.filter(i => !i.isDeleted && !i.notInUse && !i.inRepair);
                        const serialRanges = formatSerialRanges(normalItems.map(i => i.serialNumber));

                        return (
                          <div key={size} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <h4 style={{ margin: '0', borderBottom: '2px solid #1976d2', paddingBottom: '0.5rem', color: '#1976d2', fontSize: '1.2rem' }}>מידה: {size}</h4>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {deletedCount > 0 && <span style={{ background: '#ffebee', color: '#c62828', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>מחוק: {deletedCount}</span>}
                              {notInUseCount > 0 && <span style={{ background: '#fff0f0', color: '#d84315', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>לא בשימוש: {notInUseCount}</span>}
                              {inRepairCount > 0 && <span style={{ background: '#fff8e1', color: '#f9a825', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>בתיקון: {inRepairCount}</span>}
                              {deletedCount === 0 && notInUseCount === 0 && inRepairCount === 0 && normalItems.length > 0 && (
                                <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>כל הפריטים תקינים</span>
                              )}
                            </div>

                            <div style={{ background: 'var(--card-bg)', padding: '0.8rem', borderRadius: '6px', border: '1px solid #eee', marginTop: '0.5rem' }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>מספרים סידוריים (רגיל):</div>
                              <div style={{ color: '#1976d2', fontSize: '1.1rem', wordBreak: 'break-word', lineHeight: '1.4' }}>
                                {serialRanges || <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>אין פריטים רגילים</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      
      {itemHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setItemHistory(null)}>
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>פרטי פריט נוספים (מס' ס: {itemHistory.serialNumber}, ברקוד: {itemHistory.dressBarcode})</h2>
              <button onClick={() => setItemHistory(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>טוען נתונים...</div>
            ) : (
              <div>
                <div style={{ marginBottom: '1.5rem', background: '#f5f7fa', padding: '1rem', borderRadius: '8px' }}>
                  <strong>תאריך כניסה למאגר: </strong>
                  <span>{formatHebrewDate(itemHistory.entryDateToRepo)} ({new Date(itemHistory.entryDateToRepo).toLocaleDateString('he-IL')})</span>
                </div>
                
                <h3 style={{ marginBottom: '1rem' }}>היסטוריית השכרות</h3>
                {itemHistory.rentals && itemHistory.rentals.length > 0 ? (
                  <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '0.8rem' }}>{getLabel('order_id', "מס' הזמנה")}</th>
                        <th style={{ padding: '0.8rem' }}>{getLabel('order_customerName', 'לקוח')}</th>
                        <th style={{ padding: '0.8rem' }}>{getLabel('order_eventDate', 'תאריך אירוע')}</th>
                        <th style={{ padding: '0.8rem' }}>הוחזר?</th>
                        <th style={{ padding: '0.8rem', textAlign: 'center' }}>כרטיס הזמנה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemHistory.rentals.map((rental, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.8rem' }}>{rental.orderId}</td>
                          <td style={{ padding: '0.8rem' }}>{rental.customerName}</td>
                          <td style={{ padding: '0.8rem' }}>{rental.eventDateHebrew || formatHebrewDate(rental.eventDate)}</td>
                          <td style={{ padding: '0.8rem' }}>{rental.isReturned ? '✅' : '❌'}</td>
                          <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                            <a href={`/orders/${rental.orderId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#1976d2' }} title="צפה בהזמנה">
                              <ExternalLink size={18} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>אין היסטוריית השכרות לפריט זה.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
