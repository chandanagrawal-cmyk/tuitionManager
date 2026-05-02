import React from 'react'

export default function Pagination({ 
  currentPage, 
  totalPages, 
  pageSize, 
  setPageSize, 
  nextPage, 
  prevPage, 
  goToPage, 
  totalRecords 
}) {
  const pageSizes = [10, 25, 50, 100]

  return (
    <div className="pagination-container" style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      padding: '1rem',
      width: '100%',
      background: 'var(--glass)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--glass-border)',
      borderBottomLeftRadius: 'var(--radius)',
      borderBottomRightRadius: 'var(--radius)',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifySelf: 'start' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6b7280' }}>
          Show
        </span>
        <select 
          value={pageSize} 
          onChange={(e) => {
            setPageSize(Number(e.target.value))
            goToPage(1)
          }}
          className="filter-bar select"
          style={{ 
            padding: '0.3rem 0.6rem', 
            borderRadius: '8px',
            margin: 0,
            fontSize: '0.85rem'
          }}
        >
          {pageSizes.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6b7280' }}>
          entries of {totalRecords}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifySelf: 'end' }}>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={prevPage} 
          disabled={currentPage === 1}
          style={{ opacity: currentPage === 1 ? 0.5 : 1, justifyContent: 'center' }}
        >
          Previous
        </button>
        
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[...Array(totalPages)].map((_, i) => {
            const page = i + 1
            // Simple logic to show only few page numbers
            if (
              totalPages <= 7 || 
              page === 1 || 
              page === totalPages || 
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              return (
                <button
                  key={page}
                  className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => goToPage(page)}
                  style={{ minWidth: '2rem', padding: '0.3rem', justifyContent: 'center' }}
                >
                  {page}
                </button>
              )
            } else if (
              (page === 2 && currentPage > 3) || 
              (page === totalPages - 1 && currentPage < totalPages - 2)
            ) {
              return <span key={page} style={{ alignSelf: 'center', color: '#9ca3af' }}>...</span>
            }
            return null
          })}
        </div>

        <button 
          className="btn btn-secondary btn-sm" 
          onClick={nextPage} 
          disabled={currentPage === totalPages}
          style={{ opacity: currentPage === totalPages ? 0.5 : 1, justifyContent: 'center' }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
