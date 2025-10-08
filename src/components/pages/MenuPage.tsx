import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { type MenuItem } from '../../types'
import { MenuModal } from './MenuModal'

export const MenuPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable' | 'today'>('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

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

    return matchesFilter
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      alert('Menu item deleted successfully')
    }
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await (api.supabase as any)
        .from('menu_items')
        .update({ is_available })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] })
      alert('Menu item availability updated successfully')
    }
  })

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        alert('Error deleting menu item')
      }
    }
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await toggleAvailabilityMutation.mutateAsync({
        id: item.id,
        is_available: !item.is_available
      })
    } catch (error) {
      alert('Error updating menu item')
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
    setShowBulkActions(newSelected.size > 0)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)))
      setShowBulkActions(true)
    }
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
      setShowBulkActions(false)
      alert('Selected items have been enabled')
    } catch (error) {
      alert('Error enabling items')
    }
  }

  const handleBulkDisable = async () => {
    try {
      const promises = Array.from(selectedItems).map(id => 
        toggleAvailabilityMutation.mutateAsync({ id, is_available: false })
      )
      await Promise.all(promises)
      setSelectedItems(new Set())
      setShowBulkActions(false)
      alert('Selected items have been disabled')
    } catch (error) {
      alert('Error disabling items')
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
    try {
      await toggleTodayMenuMutation.mutateAsync({
        id: item.id,
        isTodayMenu: !item.is_today_menu
      })
    } catch (error) {
      alert('Error updating today\'s menu')
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
      setShowBulkActions(false)
      alert('Selected items added to today\'s menu')
    } catch (error) {
      alert('Error adding items to today\'s menu')
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
      setShowBulkActions(false)
      alert('Selected items removed from today\'s menu')
    } catch (error) {
      alert('Error removing items from today\'s menu')
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          Add New Item
        </button>
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
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Filter Tabs */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => handleFilterChange('today')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'today'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today's Menu ({menuItems.filter(item => item.is_today_menu).length})
          </button>
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({menuItems.length})
          </button>
          <button
            onClick={() => handleFilterChange('available')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'available'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available ({menuItems.filter(item => item.is_available).length})
          </button>
          <button
            onClick={() => handleFilterChange('unavailable')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'unavailable'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unavailable ({menuItems.filter(item => !item.is_available).length})
          </button>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedItems.size} selected
            </span>
            {filter !== 'today' && (
              <>
                <button
                  onClick={handleBulkEnable}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Enable All
                </button>
                <button
                  onClick={handleBulkDisable}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  Disable All
                </button>
              </>
            )}
            {filter === 'today' && (
              <>
                <button
                  onClick={handleBulkRemoveFromToday}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  Remove from Today
                </button>
              </>
            )}
            {filter !== 'today' && (
              <button
                onClick={handleBulkAddToToday}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Add to Today
              </button>
            )}
            <button
              onClick={() => {
                setSelectedItems(new Set())
                setShowBulkActions(false)
              }}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
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
          {filteredItems.length > 0 && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItems.size === filteredItems.length}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </label>
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
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Add Menu Item
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 transition-all ${
                    item.is_available 
                      ? 'border-gray-200 bg-white hover:shadow-md' 
                      : 'border-red-200 bg-red-50 opacity-75'
                  }`}
                >
                  {/* Header with checkbox and status */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <h4 className={`font-semibold text-lg ${
                        item.is_available ? 'text-gray-900' : 'text-gray-500 line-through'
                      }`}>
                        {item.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!item.is_available && (
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          DISABLED
                        </div>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full ${
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
                    <span className={`font-bold text-lg ${
                      item.is_available ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {formatCurrency(item.price)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.is_available 
                        ? 'text-gray-500 bg-gray-100' 
                        : 'text-gray-400 bg-gray-200'
                    }`}>
                      {categories.find(cat => cat.id === item.category_id)?.name || 'Uncategorized'}
                    </span>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      disabled={toggleAvailabilityMutation.isPending}
                      className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        item.is_available
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {toggleAvailabilityMutation.isPending 
                        ? 'Updating...' 
                        : (item.is_available ? 'Disable' : 'Enable')
                      }
                    </button>
                    <button
                      onClick={() => handleToggleTodayMenu(item)}
                      disabled={toggleTodayMenuMutation.isPending}
                      className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        item.is_today_menu
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }`}
                    >
                      {toggleTodayMenuMutation.isPending 
                        ? 'Updating...' 
                        : (item.is_today_menu ? 'Remove from Today' : 'Add to Today')
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteMutation.isPending}
                      className="flex-1 bg-red-100 text-red-700 py-2 px-3 rounded text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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