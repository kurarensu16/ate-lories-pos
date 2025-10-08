import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePosStore } from '../../stores/usePosStore'
import { formatCurrency } from '../../lib/utils'
import { api } from '../../lib/api'

export const MenuGrid: React.FC = () => {
  const { addToCart } = usePosStore()

  const { data: menuItems = [], isLoading, error } = useQuery({
    queryKey: ['todayMenuItems'],
    queryFn: api.getTodayMenuItems
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading menu...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">Error loading menu</div>
      </div>
    )
  }

  // Group menu items by category
  const menuItemsByCategory = menuItems.reduce((acc, item) => {
    if (!acc[item.category_id]) {
      acc[item.category_id] = []
    }
    acc[item.category_id].push(item)
    return acc
  }, {} as Record<string, typeof menuItems>)

  // Create category map for names
  const categoryMap = categories.reduce((acc, category) => {
    acc[category.id] = category.name
    return acc
  }, {} as Record<string, string>)

  return (
    <div className="space-y-8">
      {Object.entries(menuItemsByCategory).map(([categoryId, items]) => (
        <div key={categoryId} className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
            {categoryMap[categoryId] || 'Uncategorized'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                disabled={!item.is_available}
                className="p-4 bg-white rounded-lg border border-gray-200 text-left hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
              >
                <div className="font-medium text-gray-900 mb-1">{item.name}</div>
                {item.description && (
                  <div className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</div>
                )}
                <div className="flex justify-between items-center">
                  <div className="text-green-600 font-semibold text-lg">{formatCurrency(item.price)}</div>
                  {!item.is_available && (
                    <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Out of stock</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {menuItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🍽️</div>
          <p className="text-gray-500 text-lg">No items selected for today's menu</p>
          <p className="text-gray-400 text-sm mt-1">Select items for today's menu in the admin panel</p>
        </div>
      )}
    </div>
  )
}