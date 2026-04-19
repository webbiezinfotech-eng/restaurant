export default function StatusBadge({ status }) {
  const map = {
    available:       'badge-green',
    occupied:        'badge-yellow',
    billing_pending: 'badge-red',
    running:         'badge-yellow',
    billed:          'badge-green',
    cancelled:       'badge-red',
    paid:            'badge-green',
    unpaid:          'badge-red',
    dine_in:         'badge-blue',
    guest_house:     'badge-gray',
  }
  const labels = {
    available: 'Available', occupied: 'Occupied', billing_pending: 'Billing Pending',
    running: 'Running', billed: 'Billed', cancelled: 'Cancelled',
    paid: 'Paid', unpaid: 'Due', dine_in: 'Dine In', guest_house: 'Guest House',
  }
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{labels[status] || status}</span>
}
