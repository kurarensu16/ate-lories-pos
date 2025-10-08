import React from 'react'
import { MenuGrid } from './MenuGrid'
import { OrderPanel } from './OrderPanel'
import { NetworkStatus } from '../NetworkStatus'

export const PosPage: React.FC = () => {
  return (
    <>
      <div className="flex h-full bg-gray-50">
        {/* Left Side - Menu */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm border h-full">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Menu</h2>
              <p className="text-sm text-gray-600 mt-1">Select items to add to order</p>
            </div>
            <div className="p-4 h-[calc(100%-80px)] overflow-y-auto">
              <MenuGrid />
            </div>
          </div>
        </div>
        
        {/* Right Side - Current Order */}
        <div className="w-96 border-l bg-white">
          <OrderPanel />
        </div>
      </div>
      
      {/* Network Status Indicator */}
      <NetworkStatus />
    </>
  )
}