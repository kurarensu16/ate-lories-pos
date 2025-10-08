import React, { useState } from 'react'
import { usePosStore } from '../../stores/usePosStore'
import { formatCurrency } from '../../lib/utils'
import { api } from '../../lib/api'
import { offlineStore, isOnline } from '../../lib/offlineStore'

interface NotificationProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
}

const Notification: React.FC<NotificationProps> = ({ type, message, onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full ${getBackgroundColor()} border rounded-lg shadow-lg`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={onClose}
              className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const OrderPanel: React.FC = () => {
  const { 
    cart, 
    customerName, 
    updateQuantity, 
    removeFromCart, 
    setCustomerName,
    getCartTotal,
    clearCart 
  } = usePosStore()

  const [isProcessing, setIsProcessing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const paymentMethods = [
    { id: 'cash', name: 'Cash', icon: '💵' },
    { id: 'card', name: 'Credit/Debit Card', icon: '💳' },
    { id: 'digital', name: 'Digital Wallet', icon: '📱' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦' },
    { id: 'other', name: 'Other', icon: '💰' }
  ]

  const total = getCartTotal()

  const handleProcessPayment = () => {
    if (cart.length === 0) return
    setShowPaymentModal(true)
  }

  const handleConfirmPayment = async () => {
    setIsProcessing(true)
    setShowPaymentModal(false)
    
    try {
      let order: any = null
      
      if (isOnline()) {
        // Online: Create order in database
        order = await api.createOrder({
          customer_name: customerName,
          total_amount: total,
          status: 'active'
        }, cart.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        })))

        // Complete the order with payment
        await api.completeOrder(order.id, {
          amount: total,
          method: paymentMethod,
          status: 'completed'
        })
      } else {
        // Offline: Store order locally
        const offlineOrder = {
          id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          items: cart,
          customerName,
          total,
          paymentMethod,
          timestamp: Date.now(),
          synced: false
        }
        
        await offlineStore.saveOrder(offlineOrder)
        order = offlineOrder
        
        setNotification({
          type: 'info',
          message: 'Order saved offline. Will sync when connection is restored.'
        })
      }

      // Generate receipt data
      const selectedMethod = paymentMethods.find(m => m.id === paymentMethod)
      const orderId = order.id
      const receiptInfo = {
        orderId: orderId,
        orderNumber: orderId.slice(-6),
        customerName: customerName || 'Walk-in Customer',
        items: cart,
        subtotal: total,
        tax: 0, // You can add tax calculation here
        total: total,
        paymentMethod: selectedMethod?.name || 'Cash',
        paymentMethodId: paymentMethod,
        timestamp: new Date().toLocaleString(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      }
      
      setReceiptData(receiptInfo)
      setShowReceipt(true)
      
      // Show success notification
      if (isOnline()) {
        setNotification({
          type: 'success',
          message: `Order #${order.id.slice(-6)} processed successfully! Total: ${formatCurrency(total)} (${selectedMethod?.name})`
        })
      } else {
        setNotification({
          type: 'success',
          message: `Order saved offline! Total: ${formatCurrency(total)} (${selectedMethod?.name})`
        })
      }
      
      // Clear cart and reset payment method
      clearCart()
      setPaymentMethod('cash')
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotification(null)
      }, 5000)
      
    } catch (error) {
      console.error('Payment processing error:', error)
      setNotification({
        type: 'error',
        message: 'Error processing payment. Please try again.'
      })
      
      // Auto-hide error notification after 5 seconds
      setTimeout(() => {
        setNotification(null)
      }, 5000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelPayment = () => {
    setShowPaymentModal(false)
    setPaymentMethod('cash')
  }

  const handleCloseReceipt = () => {
    setShowReceipt(false)
    setReceiptData(null)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const closeNotification = () => {
    setNotification(null)
  }

  return (
    <>
      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={closeNotification}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Select Payment Method</h2>
                <button
                  onClick={handleCancelPayment}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Order Total</span>
                    <span className="text-lg font-semibold text-gray-900">{formatCurrency(total)}</span>
                  </div>
                  {customerName && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-600">Customer</span>
                      <span className="text-sm font-medium text-gray-900">{customerName}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Choose Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center justify-center p-4 rounded-lg border-2 transition-all ${
                          paymentMethod === method.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="mr-2 text-xl">{method.icon}</span>
                        <span className="text-sm font-medium">{method.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCancelPayment}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Receipt</h2>
                <button
                  onClick={handleCloseReceipt}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Receipt Content */}
              <div className="space-y-4 text-sm">
                {/* Restaurant Header */}
                <div className="text-center border-b pb-4">
                  <h3 className="text-lg font-bold text-gray-900">Ate Lorie's Restaurant</h3>
                  <p className="text-gray-600">123 Main Street, City, State 12345</p>
                  <p className="text-gray-600">(555) 123-4567</p>
                </div>

                {/* Order Info */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order #:</span>
                    <span className="font-medium">{receiptData.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{receiptData.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium">{receiptData.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{receiptData.customerName}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Items Ordered:</h4>
                  <div className="space-y-2">
                    {receiptData.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-gray-600 text-xs">
                            {formatCurrency(item.unit_price)} × {item.quantity}
                          </div>
                        </div>
                        <div className="font-medium">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(receiptData.subtotal)}</span>
                  </div>
                  {receiptData.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium">{formatCurrency(receiptData.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(receiptData.total)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium">{receiptData.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium text-green-600">Paid</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t pt-4 text-center text-gray-600">
                  <p className="text-xs">Thank you for your purchase!</p>
                  <p className="text-xs">Please come again</p>
                </div>
              </div>

              {/* Receipt Actions */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleCloseReceipt}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handlePrintReceipt}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">Current Order</h2>
        <div className="mt-3">
          <label className="block text-sm text-gray-600 mb-1">Customer Name (Optional)</label>
          <input
            type="text"
            placeholder="Enter customer name..."
            value={customerName || ''}
            onChange={(e) => setCustomerName(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="text-center mt-8">
            <div className="text-gray-400 text-6xl mb-4">🛒</div>
            <p className="text-gray-500 text-lg">No items added</p>
            <p className="text-gray-400 text-sm mt-1">Select items from the menu to start an order</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.menu_item_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-600">{formatCurrency(item.unit_price)} each</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <span className="text-gray-600">-</span>
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <span className="text-gray-600">+</span>
                  </button>
                  <button
                    onClick={() => removeFromCart(item.menu_item_id)}
                    className="ml-2 text-red-500 hover:text-red-700 p-1"
                    title="Remove item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <div className="space-y-4">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-gray-800">Total:</span>
            <span className="font-bold text-green-600">{formatCurrency(total)}</span>
          </div>
          
          <div className="space-y-2">
            <button 
              onClick={handleProcessPayment}
              disabled={cart.length === 0 || isProcessing}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Process Payment'}
            </button>
            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear Order
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}