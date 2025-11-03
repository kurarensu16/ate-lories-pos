import React from 'react'
import { usePosStore } from '../../stores/usePosStore'

const mockTables = [
  { id: '1', number: '1', status: 'available' as const, capacity: 4 },
  { id: '2', number: '2', status: 'occupied' as const, capacity: 4 },
  { id: '3', number: '3', status: 'available' as const, capacity: 6 },
  { id: '4', number: '4', status: 'available' as const, capacity: 2 },
  { id: '5', number: '5', status: 'occupied' as const, capacity: 8 },
  { id: '6', number: '6', status: 'available' as const, capacity: 4 },
]

export const TableGrid: React.FC = () => {
  const { currentTable, setTable } = usePosStore()

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Tables</h2>
      <div className="grid grid-cols-3 gap-4">
        {mockTables.map(table => (
          <button
            key={table.id}
            onClick={() => setTable(table)}
            className={`
              p-6 rounded-lg border-2 text-center font-medium transition-colors
              ${currentTable?.id === table.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}
              ${table.status === 'occupied' 
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' 
                : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
              }
            `}
          >
            Table {table.number}
            <div className="text-sm mt-1">
              {table.status === 'occupied' ? 'Occupied' : 'Available'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {table.capacity} seats
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}