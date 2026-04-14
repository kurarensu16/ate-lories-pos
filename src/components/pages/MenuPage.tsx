import React, { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { type MenuItem } from '../../types'
import { MenuModal } from './MenuModal'
import { useToast } from '../ui/ToastProvider'
import { useAuthStore } from '../../stores/useAuthStore'

export const MenuPage: React.FC = () => {
  const toast = useToast()
  const { user } = useAuthStore()
  const canEditMenu = user?.role === 'admin' || user?.role === 'staff'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable' | 'today'>('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()
  const itemsPerPage = 12

  const parseCsvLine = (line: string) => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)
    return values.map((value) => value.trim())
  }

  const parseCsvRows = (csvText: string) => {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length < 2) return []
    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase())

    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line)
      return headers.reduce((row, header, index) => {
        row[header] = values[index] ?? ''
        return row
      }, {} as Record<string, string>)
    })
  }

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menuItems'],
    queryFn: api.getMenuItems
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  })

  // Filter menu items based on current filter and search query
  const filteredItems = menuItems.filter(item => {
    // First apply the category filter
    let matchesFilter = false
    switch (filter) {
      case 'available':
        matchesFilter = item.is_available
        break
      case 'unavailable':
        matchesFilter = !item.is_available
        break
      case 'today':
        matchesFilter = item.is_today_menu
        break
      default:
        matchesFilter = true
    }

    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    }

    if (!matchesFilter) return false
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false
    return true
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, selectedCategory, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const pageStart = (currentPageSafe - 1) * itemsPerPage
  const pageEnd = pageStart + itemsPerPage
  const paginatedItems = filteredItems.slice(pageStart, pageEnd)
  const activeItem = menuItems.find((item) => item.id === activeItemId) ?? null

  const deleteMutation = useMutation({
    mutationFn: api.deleteMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      toast.success('Menu item deleted successfully')
    }
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      await api.updateMenuItemAvailability(id, is_available)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      toast.success('Menu item availability updated successfully')
    }
  })

  const handleEdit = (item: MenuItem) => {
    if (!canEditMenu) {
      toast.error('You do not have permission to edit menu items')
      return
    }
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!canEditMenu) {
      toast.error('You do not have permission to delete menu items')
      return
    }
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        toast.error('Error deleting menu item')
      }
    }
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    if (!canEditMenu) {
      toast.error('You do not have permission to update menu availability')
      return
    }
    try {
      await toggleAvailabilityMutation.mutateAsync({
        id: item.id,
        is_available: !item.is_available
      })
    } catch (error) {
      toast.error('Error updating menu item')
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
  }

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAllCurrentPage = () => {
    if (paginatedItems.length > 0 && paginatedItems.every((item) => selectedItems.has(item.id))) {
      const newSelected = new Set(selectedItems)
      paginatedItems.forEach((item) => newSelected.delete(item.id))
      setSelectedItems(newSelected)
    } else {
      const newSelected = new Set(selectedItems)
      paginatedItems.forEach((item) => newSelected.add(item.id))
      setSelectedItems(newSelected)
    }
  }

  const handleToggleSelectionMode = () => {
    if (!canEditMenu) {
      toast.error('You do not have permission for bulk menu actions')
      return
    }
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedItems(new Set())
      } else {
        setActiveItemId(null)
      }
      return !prev
    })
  }

  const handleCardClick = (item: MenuItem) => {
    if (isSelectionMode) {
      handleSelectItem(item.id)
      return
    }
    setActiveItemId(item.id)
  }

  const handleFilterChange = (newFilter: 'all' | 'available' | 'unavailable' | 'today') => {
    setFilter(newFilter)
    // Clear search when switching filters for better UX
    setSearchQuery('')
  }

  const handleBulkEnable = async () => {
    try {
      const promises = Array.from(selectedItems).map(id => 
        toggleAvailabilityMutation.mutateAsync({ id, is_available: true })
      )
      await Promise.all(promises)
      setSelectedItems(new Set())
      toast.success('Selected items have been enabled')
    } catch (error) {
      toast.error('Error enabling items')
    }
  }

  const handleBulkDisable = async () => {
    try {
      const promises = Array.from(selectedItems).map(id => 
        toggleAvailabilityMutation.mutateAsync({ id, is_available: false })
      )
      await Promise.all(promises)
      setSelectedItems(new Set())
      toast.success('Selected items have been disabled')
    } catch (error) {
      toast.error('Error disabling items')
    }
  }

  const toggleTodayMenuMutation = useMutation({
    mutationFn: ({ id, isTodayMenu }: { id: string; isTodayMenu: boolean }) => 
      api.toggleTodayMenu(id, isTodayMenu),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
    }
  })

  const handleToggleTodayMenu = async (item: MenuItem) => {
    if (!canEditMenu) {
      toast.error('You do not have permission to update today menu')
      return
    }
    try {
      await toggleTodayMenuMutation.mutateAsync({
        id: item.id,
        isTodayMenu: !item.is_today_menu
      })
    } catch (error) {
      toast.error('Error updating today\'s menu')
    }
  }

  const handleBulkAddToToday = async () => {
    try {
      const promises = Array.from(selectedItems).map(id => 
        api.toggleTodayMenu(id, true)
      )
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      setSelectedItems(new Set())
      toast.success('Selected items added to today\'s menu')
    } catch (error) {
      toast.error('Error adding items to today\'s menu')
    }
  }

  const handleBulkRemoveFromToday = async () => {
    try {
      const promises = Array.from(selectedItems).map(id => 
        api.toggleTodayMenu(id, false)
      )
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      setSelectedItems(new Set())
      toast.success('Selected items removed from today\'s menu')
    } catch (error) {
      toast.error('Error removing items from today\'s menu')
    }
  }

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditMenu) {
      toast.error('You do not have permission to import menu items')
      if (event.target) event.target.value = ''
      return
    }
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const rows = parseCsvRows(content)

      if (rows.length === 0) {
        toast.error('CSV is empty or invalid. Use headers: name, description, price, category, is_available, is_today_menu')
        return
      }

      const result = await api.importMenuCsv(rows)
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })

      const failedPreview = result.failedRows
        .slice(0, 5)
        .map((row) => `Row ${row.row}: ${row.reason}`)
        .join('\n')

      const summary = [
        `Import complete.`,
        `Inserted: ${result.insertedCount}`,
        `Skipped duplicates: ${result.skippedDuplicates}`,
        `New categories created: ${result.createdCategories}`,
        `Failed rows: ${result.failedRows.length}`,
        failedPreview ? `\nDetails:\n${failedPreview}` : ''
      ].join('\n')

      toast.info(summary)
    } catch (error) {
      console.error('CSV import failed:', error)
      toast.error('Failed to import CSV. Please check your file format and try again.')
    } finally {
      if (event.target) event.target.value = ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading menu...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your restaurant menu items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canEditMenu}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import CSV
          </button>
          <button
            onClick={handleToggleSelectionMode}
            disabled={!canEditMenu}
            className={`${isSelectionMode ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSelectionMode ? 'Done' : 'Select'}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canEditMenu}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add New Item
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search menu items by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for "{searchQuery}"
          </div>
        )}
      </div>

      {!isSelectionMode && activeItem && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-700 mb-3">
            Actions for <span className="font-semibold">{activeItem.name}</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => handleEdit(activeItem)}
              disabled={!canEditMenu}
              className="bg-primary-100 text-primary-700 py-2 px-3 rounded text-sm font-medium hover:bg-primary-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => handleToggleAvailability(activeItem)}
              disabled={!canEditMenu || toggleAvailabilityMutation.isPending}
              className={`py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activeItem.is_available
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {toggleAvailabilityMutation.isPending ? 'Updating...' : (activeItem.is_available ? 'Disable' : 'Enable')}
            </button>
            <button
              onClick={() => handleToggleTodayMenu(activeItem)}
              disabled={!canEditMenu || toggleTodayMenuMutation.isPending}
              className={`py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activeItem.is_today_menu
                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              {toggleTodayMenuMutation.isPending ? 'Updating...' : (activeItem.is_today_menu ? 'Remove from Today' : 'Add to Today')}
            </button>
            <button
              onClick={() => handleDelete(activeItem.id)}
              disabled={!canEditMenu || deleteMutation.isPending}
              className="bg-red-100 text-red-700 py-2 px-3 rounded text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => handleFilterChange('today')}
            className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              filter === 'today'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="hidden sm:inline">Today's Menu</span>
            <span className="sm:hidden">Today</span> ({menuItems.filter(item => item.is_today_menu).length})
          </button>
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({menuItems.length})
          </button>
          <button
            onClick={() => handleFilterChange('available')}
            className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              filter === 'available'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available ({menuItems.filter(item => item.is_available).length})
          </button>
          <button
            onClick={() => handleFilterChange('unavailable')}
            className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              filter === 'unavailable'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unavailable ({menuItems.filter(item => !item.is_available).length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="categoryFilter" className="text-sm text-gray-600">
            Category:
          </label>
          <select
            id="categoryFilter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {isSelectionMode && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedItems.size} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSelectAllCurrentPage}
                className="bg-gray-700 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-gray-800"
              >
                {paginatedItems.length > 0 && paginatedItems.every((item) => selectedItems.has(item.id))
                  ? 'Deselect Page'
                  : 'Select Page'}
              </button>
              {filter !== 'today' && (
                <>
                  <button
                    onClick={handleBulkEnable}
                    className="bg-green-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-green-700"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={handleBulkDisable}
                    className="bg-red-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-red-700"
                  >
                    Disable All
                  </button>
                </>
              )}
              {filter === 'today' && (
                <>
                  <button
                    onClick={handleBulkRemoveFromToday}
                    className="bg-red-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-red-700"
                  >
                    Remove from Today
                  </button>
                </>
              )}
              {filter !== 'today' && (
                <button
                  onClick={handleBulkAddToToday}
                  className="bg-primary-500 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-primary-600"
                >
                  Add to Today
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedItems(new Set())
                }}
                className="bg-gray-500 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu Items Grid */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {filter === 'all' && `Menu Items (${menuItems.length})`}
            {filter === 'available' && `Available Items (${filteredItems.length})`}
            {filter === 'unavailable' && `Unavailable Items (${filteredItems.length})`}
            {filter === 'today' && `Today's Menu (${filteredItems.length})`}
          </h3>
          {isSelectionMode && (
            <span className="text-sm text-gray-600">Tap cards to select menu items</span>
          )}
        </div>
        
        <div className="overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">
                {filter === 'unavailable' ? '🚫' : '🍽️'}
              </div>
              <p className="text-gray-500 text-lg">
                {searchQuery ? 'No items found matching your search' : (
                  <>
                    {filter === 'all' && 'No menu items yet'}
                    {filter === 'available' && 'No available items'}
                    {filter === 'unavailable' && 'No unavailable items'}
                    {filter === 'today' && 'No items selected for today'}
                  </>
                )}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? 'Try adjusting your search terms or filters' : (
                  <>
                    {filter === 'all' && 'Add your first menu item to get started'}
                    {filter === 'available' && 'All items are currently unavailable'}
                    {filter === 'unavailable' && 'All items are currently available'}
                    {filter === 'today' && 'Select items from available menu to create today\'s menu'}
                  </>
                )}
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={!canEditMenu}
                  className="mt-4 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Menu Item
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 sm:p-6">
              {paginatedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item)}
                  className={`border rounded-lg p-3 sm:p-4 transition-all cursor-pointer ${
                    selectedItems.has(item.id)
                      ? 'ring-2 ring-primary-500 border-primary-500'
                      : ''
                  } ${
                    !isSelectionMode && activeItemId === item.id
                      ? 'ring-2 ring-blue-400 border-blue-300'
                      : ''
                  } ${
                    item.is_available 
                      ? 'border-gray-200 bg-white hover:shadow-md' 
                      : 'border-red-200 bg-red-50 opacity-75'
                  }`}
                >
                  {/* Header and status */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-semibold text-base sm:text-lg truncate ${
                        item.is_available ? 'text-gray-900' : 'text-gray-500 line-through'
                      }`}>
                        {item.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                      {!item.is_available && (
                        <div className="bg-red-500 text-white text-xs px-1 sm:px-2 py-1 rounded-full font-medium">
                          DISABLED
                        </div>
                      )}
                      <span className={`px-1 sm:px-2 py-1 text-xs rounded-full ${
                        item.is_available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>

                  {item.description && (
                    <p className={`text-sm mb-3 line-clamp-2 ${
                      item.is_available ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {item.description}
                    </p>
                  )}

                  <div className="flex justify-between items-center mb-4">
                    <span className={`font-bold text-base sm:text-lg ${
                      item.is_available ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {formatCurrency(item.price)}
                    </span>
                    <span className={`text-xs px-1 sm:px-2 py-1 rounded truncate max-w-[120px] sm:max-w-none ${
                      item.is_available 
                        ? 'text-gray-500 bg-gray-100' 
                        : 'text-gray-400 bg-gray-200'
                    }`}>
                      {categories.find(cat => cat.id === item.category_id)?.name || 'Uncategorized'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {filteredItems.length > itemsPerPage && (
          <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {pageStart + 1}-{Math.min(pageEnd, filteredItems.length)} of {filteredItems.length} items
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPageSafe === 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPageSafe} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPageSafe === totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <MenuModal
          item={editingItem}
          categories={categories}
          onClose={handleCloseModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['menuItems'] })
            handleCloseModal()
          }}
        />
      )}
    </div>
  )
}