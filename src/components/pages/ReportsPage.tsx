import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export const ReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Get date range for queries
  const getDateRange = () => {
    const now = new Date()
    switch (dateRange) {
      case 'today':
        const today = now.toISOString().split('T')[0]
        return { startDate: today, endDate: today }
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return { startDate: weekAgo.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] }
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return { startDate: monthAgo.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] }
      case 'custom':
        return { startDate: customStartDate, endDate: customEndDate }
      default:
        return { startDate: now.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] }
    }
  }

  const { startDate, endDate } = getDateRange()

  // Fetch revenue data
  const { isLoading: revenueLoading } = useQuery({
    queryKey: ['revenueStats', startDate, endDate],
    queryFn: () => api.getRevenueStats(startDate, endDate)
  })

  // Fetch all orders for detailed analytics
  const { data: allOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getRecentOrders(100)
  })

  // Filter orders by date range
  const filteredOrders = allOrders.filter((order: any) => {
    const orderDate = new Date(order.created_at).toISOString().split('T')[0]
    return orderDate >= startDate && orderDate <= endDate
  })

  // Calculate analytics
  const totalRevenue = filteredOrders
    .filter((order: any) => order.status !== 'cancelled')
    .reduce((sum: number, order: any) => sum + order.total_amount, 0)

  const totalOrders = filteredOrders.length
  const completedOrders = filteredOrders.filter((order: any) => order.status === 'completed').length
  const cancelledOrders = filteredOrders.filter((order: any) => order.status === 'cancelled').length
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Top selling items
  const itemSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {}
  filteredOrders.forEach((order: any) => {
    if (order.status !== 'cancelled') {
      order.order_items?.forEach((item: any) => {
        const itemName = item.menu_items?.name || 'Unknown Item'
        if (!itemSales[itemName]) {
          itemSales[itemName] = { name: itemName, quantity: 0, revenue: 0 }
        }
        itemSales[itemName].quantity += item.quantity
        itemSales[itemName].revenue += item.unit_price * item.quantity
      })
    }
  })

  const topSellingItems = Object.values(itemSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  // Revenue by hour (for today only)
  const hourlyRevenue: { [key: number]: number } = {}
  if (dateRange === 'today') {
    filteredOrders.forEach((order: any) => {
      if (order.status !== 'cancelled') {
        const hour = new Date(order.created_at).getHours()
        hourlyRevenue[hour] = (hourlyRevenue[hour] || 0) + order.total_amount
      }
    })
  }

  // Revenue over time (grouped by date)
  const revenueOverTime = useMemo(() => {
    const revenueByDate: { [key: string]: number } = {}
    filteredOrders.forEach((order: any) => {
      if (order.status !== 'cancelled') {
        const date = new Date(order.created_at).toISOString().split('T')[0]
        revenueByDate[date] = (revenueByDate[date] || 0) + order.total_amount
      }
    })
    
    // Sort dates and format for chart
    return Object.entries(revenueByDate)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: parseFloat(revenue.toFixed(2))
      }))
  }, [filteredOrders])

  // Prepare hourly revenue data for chart
  const hourlyRevenueData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      revenue: parseFloat((hourlyRevenue[hour] || 0).toFixed(2))
    }))
  }, [hourlyRevenue])

  // Prepare order status data for pie chart
  const orderStatusData = [
    { name: 'Completed', value: completedOrders, color: '#10b981' },
    { name: 'Active', value: totalOrders - completedOrders - cancelledOrders, color: '#eab308' },
    { name: 'Cancelled', value: cancelledOrders, color: '#ef4444' }
  ].filter(item => item.value > 0)

  // Prepare top selling items data for bar chart
  const topSellingItemsChartData = topSellingItems.map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    quantity: item.quantity,
    revenue: parseFloat(item.revenue.toFixed(2))
  }))

  // Customer analytics
  const customerOrders: { [key: string]: number } = {}
  filteredOrders.forEach((order: any) => {
    if (order.status !== 'cancelled' && order.customer_name) {
      customerOrders[order.customer_name] = (customerOrders[order.customer_name] || 0) + 1
    }
  })

  const topCustomers = Object.entries(customerOrders)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  if (revenueLoading || ordersLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading reports...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sales reports and business insights
          </p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setDateRange('today')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                dateRange === 'today'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                dateRange === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                dateRange === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateRange('custom')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                dateRange === 'custom'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Custom Range
            </button>
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Start Date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="End Date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Orders</p>
              <p className="text-2xl font-semibold text-gray-900">{totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Average Order Value</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(averageOrderValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Over Time Chart */}
      {revenueOverTime.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Revenue Over Time</h3>
            <p className="mt-1 text-sm text-gray-500">Daily revenue trend for the selected period</p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#00674F" 
                  strokeWidth={2}
                  dot={{ fill: '#00674F', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Top Selling Items</h3>
            <p className="mt-1 text-sm text-gray-500">Most popular menu items by quantity sold</p>
          </div>
          <div className="p-6">
            {topSellingItemsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSellingItemsChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value} units`}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '8px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#00674F" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-4">No sales data available</p>
            )}
          </div>
        </div>

        {/* Order Status Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Order Status</h3>
            <p className="mt-1 text-sm text-gray-500">Breakdown of order statuses</p>
          </div>
          <div className="p-6">
            {orderStatusData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => 
                        `${entry.name}: ${entry.value} (${(entry.percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${value} orders`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2 w-full">
                  {orderStatusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No order data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Revenue Chart (Today only) */}
      {dateRange === 'today' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Hourly Revenue</h3>
            <p className="mt-1 text-sm text-gray-500">Revenue breakdown by hour for today</p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={hourlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '8px'
                  }}
                />
                <Bar dataKey="revenue" fill="#00674F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Top Customers</h3>
            <p className="mt-1 text-sm text-gray-500">Most frequent customers</p>
        </div>
        <div className="p-6">
            <div className="space-y-4">
              {topCustomers.map(([customerName, orderCount], index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-sm font-medium text-primary-600">
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{orderCount} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Orders</h3>
          <p className="mt-1 text-sm text-gray-500">Latest orders for the selected period</p>
        </div>
        <div className="overflow-hidden">
          {filteredOrders.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredOrders.slice(0, 10).map((order: any) => (
                <div key={order.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Order #{order.id.slice(-8)}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Customer</p>
                          <p className="text-sm font-medium text-gray-900">
                            {order.customer_name || 'Walk-in Customer'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(order.total_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Created</p>
                          <p className="text-sm text-gray-900">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <p className="text-gray-500 text-lg">No orders found for the selected period</p>
              <p className="text-gray-400 text-sm mt-1">Try selecting a different date range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}