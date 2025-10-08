import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'

interface OrderWithDetails {
  id: string
  table_id: string | null
  status: string
  total_amount: number
  customer_name: string | null
  staff_notes: string | null
  created_at: string
  updated_at: string
  order_items: Array<{
    id: string
    quantity: number
    unit_price: number
    special_instructions: string | null
    menu_items: {
      name: string
    }
  }>
  payments: Array<{
    id: string
    amount: number
    method: string
    status: string
    created_at: string
  }>
  tables?: {
    number: string
  }
}

export const OrdersPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getRecentOrders()
  })

  // Filter orders based on current filter and search query
  const filteredOrders = orders.filter((order: OrderWithDetails) => {
    // First apply the status filter
    let matchesFilter = false
    switch (filter) {
      case 'active':
        matchesFilter = order.status === 'active'
        break
      case 'completed':
        matchesFilter = order.status === 'completed'
        break
      case 'cancelled':
        matchesFilter = order.status === 'cancelled'
        break
      default:
        matchesFilter = true
    }

    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        order.id.toLowerCase().includes(query) ||
        (order.tables?.number && order.tables.number.toLowerCase().includes(query)) ||
        order.order_items.some(item => item.menu_items.name.toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    }

    return matchesFilter
  })

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await (api.supabase as any)
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      alert('Order status updated successfully')
    }
  })

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatusMutation.mutateAsync({ orderId, status: newStatus })
    } catch (error) {
      alert('Error updating order status')
    }
  }

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusActions = (order: OrderWithDetails) => {
    switch (order.status) {
      case 'active':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleStatusUpdate(order.id, 'completed')}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
            >
              Complete
            </button>
            <button
              onClick={() => handleStatusUpdate(order.id, 'cancelled')}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
            >
              Cancel
            </button>
          </div>
        )
      case 'completed':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleStatusUpdate(order.id, 'active')}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Reopen
            </button>
          </div>
        )
      case 'cancelled':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleStatusUpdate(order.id, 'active')}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Reactivate
            </button>
          </div>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all restaurant orders
          </p>
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
            placeholder="Search orders by ID, table number, or item name..."
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
            Showing {filteredOrders.length} result{filteredOrders.length !== 1 ? 's' : ''} for "{searchQuery}"
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All ({orders.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Active ({orders.filter((order: OrderWithDetails) => order.status === 'active').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Completed ({orders.filter((order: OrderWithDetails) => order.status === 'completed').length})
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'cancelled'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Cancelled ({orders.filter((order: OrderWithDetails) => order.status === 'cancelled').length})
        </button>
      </div>

      {/* Orders List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {filter === 'all' && `All Orders (${orders.length})`}
            {filter === 'active' && `Active Orders (${filteredOrders.length})`}
            {filter === 'completed' && `Completed Orders (${filteredOrders.length})`}
            {filter === 'cancelled' && `Cancelled Orders (${filteredOrders.length})`}
          </h3>
        </div>
        
        <div className="overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <p className="text-gray-500 text-lg">
                {searchQuery ? 'No orders found matching your search' : 'No orders yet'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? 'Try adjusting your search terms or filters' : 'Orders will appear here when customers place them'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order: OrderWithDetails) => (
                <div key={order.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Order #{order.id.slice(-8)}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                        {order.table_id && (
                          <span className="text-sm text-gray-600">
                            Table {order.tables?.number || order.table_id}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(order.total_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Customer</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {order.customer_name || 'Walk-in Customer'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Created</p>
                          <p className="text-sm text-gray-900">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Items ({order.order_items.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {order.order_items.slice(0, 3).map((item, index) => (
                            <span
                              key={index}
                              className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                            >
                              {item.quantity}x {item.menu_items.name}
                            </span>
                          ))}
                          {order.order_items.length > 3 && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                              +{order.order_items.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Payment Status */}
                      {order.payments.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600">Payment</p>
                          <div className="flex space-x-4">
                            {order.payments.map((payment, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                <span className="text-gray-600 ml-1">({payment.method})</span>
                                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                  payment.status === 'completed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {payment.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Staff Notes */}
                      {order.staff_notes && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600">Staff Notes</p>
                          <p className="text-sm text-gray-900 bg-yellow-50 p-2 rounded">
                            {order.staff_notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="bg-blue-100 text-blue-700 py-2 px-4 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        View Details
                      </button>
                      {getStatusActions(order)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Order #{selectedOrder.id.slice(-8)} Details
                </h2>
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Table</p>
                  <p className="text-sm text-gray-900">
                    {selectedOrder.table_id ? `Table ${selectedOrder.tables?.number || selectedOrder.table_id}` : 'No table assigned'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="text-sm text-gray-900">{selectedOrder.customer_name || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.order_items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-gray-900">{item.menu_items.name}</p>
                        {item.special_instructions && (
                          <p className="text-sm text-gray-600">Note: {item.special_instructions}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-green-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedOrder.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payments */}
              {selectedOrder.payments.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Payments</h3>
                  <div className="space-y-2">
                    {selectedOrder.payments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-gray-900">{payment.method}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(payment.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </p>
                          <span className={`px-2 py-1 text-xs rounded ${
                            payment.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Staff Notes */}
              {selectedOrder.staff_notes && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Staff Notes</h3>
                  <div className="p-3 bg-yellow-50 rounded">
                    <p className="text-gray-900">{selectedOrder.staff_notes}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
                {getStatusActions(selectedOrder)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}