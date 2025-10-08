import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/useAuthStore'
import { formatCurrency } from '../../lib/utils'
import { api } from '../../lib/api'

interface RecentOrder {
  id: string
  created_at: string
  total_amount: number
  status: 'active' | 'completed' | 'cancelled'
  customer_name: string | null
  order_items: Array<{
    quantity: number
    unit_price: number
    menu_items: {
      name: string
    }
  }>
  payments: Array<{
    amount: number
    method: string
    status: string
  }>
}

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore()

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['recentOrders'],
    queryFn: () => api.getRecentOrders(5)
  })

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: api.getMenuItems
  })

  // Calculate dashboard stats from real data
  const today = new Date().toDateString()
  const todayOrders = (recentOrders as RecentOrder[]).filter(order => 
    new Date(order.created_at).toDateString() === today
  )

  // Calculate revenue excluding cancelled orders
  const totalRevenue = todayOrders
    .filter(order => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.total_amount, 0)

  // Calculate successful orders (excluding cancelled)
  const successfulOrders = todayOrders.filter(order => order.status !== 'cancelled')

  const stats = [
    { 
      name: 'Today Orders', 
      value: successfulOrders.length.toString(), 
      change: '+0', 
      changeType: 'neutral' as const
    },
    { 
      name: 'Revenue Today', 
      value: formatCurrency(totalRevenue), 
      change: '+0%', 
      changeType: 'neutral' as const
    },
    { 
      name: 'Menu Items', 
      value: menuItems.length.toString(), 
      change: 'Active', 
      changeType: 'positive' as const
    },
    { 
      name: 'Recent Activity', 
      value: recentOrders.length > 0 ? `#${(recentOrders[0] as RecentOrder).id.slice(-6)}` : 'No orders', 
      change: 'Latest', 
      changeType: 'neutral' as const
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Good morning, {user?.name}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening in your restaurant today.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                {stat.name}
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {stat.value}
              </dd>
              <div className={`text-sm ${
                stat.changeType === 'positive' ? 'text-green-600' : 'text-gray-500'
              }`}>
                {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Orders
          </h3>
        </div>
        <div className="overflow-hidden">
          {(recentOrders as RecentOrder[]).length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(recentOrders as RecentOrder[]).map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.id.slice(-6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}