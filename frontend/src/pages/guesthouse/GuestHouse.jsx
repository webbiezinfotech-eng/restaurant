import { useEffect, useMemo, useState } from 'react'
import { guestHouseAPI } from '../../services/api'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import toast from 'react-hot-toast'

function toLocalInputValue(d) {
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return date.toISOString().slice(0, 16)
}

function defaultDateRange() {
  const from = new Date()
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)
  return { from: toLocalInputValue(from), to: toLocalInputValue(to) }
}

function Stat({ label, value, color }) {
  const cls = {
    total: 'bg-blue-50 text-blue-700 border-blue-100',
    available: 'bg-green-50 text-green-700 border-green-100',
    booked: 'bg-amber-50 text-amber-700 border-amber-100',
    active: 'bg-purple-50 text-purple-700 border-purple-100',
  }
  return (
    <div className={`card p-4 border ${cls[color] || ''}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-display font-bold mt-1">{value}</p>
    </div>
  )
}

export default function GuestHouse() {
  const initialRange = defaultDateRange()
  const localNow = initialRange.from
  const localNext = initialRange.to

  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [categories, setCategories] = useState([])
  const [bookings, setBookings] = useState([])
  const [availableRooms, setAvailableRooms] = useState([])
  const [bookingAvailableRooms, setBookingAvailableRooms] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [recentGuestPage, setRecentGuestPage] = useState(1)
  const [bookingPage, setBookingPage] = useState(1)
  const [recentGuestSearch, setRecentGuestSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const perPage = 8
  const [form, setForm] = useState({
    guest_name: '',
    phone: '',
    category_id: '',
    room_no: '',
    address: '',
    id_proof: '',
    from_date: localNow,
    to_date: localNext,
    expected_checkout_at: localNext,
    total_amount: '',
    advance_amount: '',
    paid_amount: '',
    payment_mode: 'cash',
    booking_id: '',
    adults_count: 1,
    children_count: 0,
    companions: '',
    companions_id_details: '',
  })
  const [bookingForm, setBookingForm] = useState({
    guest_name: '',
    phone: '',
    category_id: '',
    room_no: '',
    address: '',
    id_proof: '',
    from_date: localNow,
    to_date: localNext,
    total_amount: '',
    advance_amount: '',
    payment_mode: 'cash',
    adults_count: 1,
    children_count: 0,
    companions: '',
    companions_id_details: '',
  })
  const [editForm, setEditForm] = useState(null)
  const [editAvailableRooms, setEditAvailableRooms] = useState([])
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_mode: 'cash' })
  const [roomForm, setRoomForm] = useState({ room_no: '', floor_no: '', category_id: '', room_type: '' })
  const [categoryForm, setCategoryForm] = useState({ name: '' })

  const load = () => {
    Promise.all([guestHouseAPI.dashboard(), guestHouseAPI.roomCategories(), guestHouseAPI.bookings()])
      .then(([dash, cats, bk]) => {
        setDashboard(dash.data.data)
        setCategories(cats.data.data || [])
        setBookings(bk.data.data || [])
        const due = dash.data.data?.due_checkouts || []
        if (due.length) {
          const roomNos = due.map(d => d.room_no).join(', ')
          toast.error(`Checkout time reached for room(s): ${roomNos}`)
        }
      })
      .catch(() => toast.error('Failed to load guest house dashboard.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!form.category_id || !form.from_date || !form.to_date) {
      setAvailableRooms([])
      return
    }
    guestHouseAPI.availableRooms({
      category_id: form.category_id,
      from_date: form.from_date,
      to_date: form.to_date,
    })
      .then(res => setAvailableRooms((res.data.data || []).map(r => r.room_no)))
      .catch(() => setAvailableRooms([]))
  }, [form.category_id, form.from_date, form.to_date])

  useEffect(() => {
    if (!bookingForm.category_id || !bookingForm.from_date || !bookingForm.to_date) {
      setBookingAvailableRooms([])
      return
    }
    guestHouseAPI.availableRooms({
      category_id: bookingForm.category_id,
      from_date: bookingForm.from_date,
      to_date: bookingForm.to_date,
    })
      .then(res => {
        const rooms = (res.data.data || []).map(r => r.room_no)
        setBookingAvailableRooms(rooms)
        if (bookingForm.room_no && !rooms.includes(bookingForm.room_no)) {
          setBookingForm(p => ({ ...p, room_no: '' }))
        }
      })
      .catch(() => setBookingAvailableRooms([]))
  }, [bookingForm.category_id, bookingForm.from_date, bookingForm.to_date, bookingForm.room_no])

  useEffect(() => {
    if (!editForm?.category_id || !editForm?.from_date || !editForm?.to_date) {
      setEditAvailableRooms([])
      return
    }
    guestHouseAPI.availableRooms({
      category_id: editForm.category_id,
      from_date: editForm.from_date,
      to_date: editForm.to_date,
      exclude_guest_id: editForm.id,
    })
      .then(res => setEditAvailableRooms((res.data.data || []).map(r => r.room_no)))
      .catch(() => setEditAvailableRooms([]))
  }, [editForm?.category_id, editForm?.from_date, editForm?.to_date, editForm?.id])
  useEffect(() => { setRecentGuestPage(1) }, [dashboard?.recent_guests?.length])
  useEffect(() => { setBookingPage(1) }, [bookings.length])

  const roomOptions = useMemo(() => availableRooms, [availableRooms])
  const recentGuests = (dashboard?.recent_guests || []).filter(g => {
    const q = recentGuestSearch.trim().toLowerCase()
    if (!q) return true
    return String(g.guest_name || '').toLowerCase().includes(q)
      || String(g.phone || '').toLowerCase().includes(q)
      || String(g.room_no || '').toLowerCase().includes(q)
  })
  const recentGuestPages = Math.max(1, Math.ceil(recentGuests.length / perPage))
  const pagedRecentGuests = recentGuests.slice((recentGuestPage - 1) * perPage, recentGuestPage * perPage)
  const filteredBookings = bookings.filter(b => {
    const q = bookingSearch.trim().toLowerCase()
    if (!q) return true
    return String(b.guest_name || '').toLowerCase().includes(q)
      || String(b.phone || '').toLowerCase().includes(q)
      || String(b.room_no || '').toLowerCase().includes(q)
      || String(b.status || '').toLowerCase().includes(q)
  })
  const bookingPages = Math.max(1, Math.ceil(filteredBookings.length / perPage))
  const pagedBookings = filteredBookings.slice((bookingPage - 1) * perPage, bookingPage * perPage)

  const onCheckIn = async e => {
    e.preventDefault()
    if (!form.guest_name || !form.phone || !form.category_id || !form.room_no || !form.address) {
      toast.error('Please fill all required fields.')
      return
    }
    setSubmitting(true)
    try {
      await guestHouseAPI.createGuest(form)
      toast.success('Guest checked in.')
      const resetRange = defaultDateRange()
      setForm({
        guest_name: '',
        phone: '',
        category_id: '',
        room_no: '',
        address: '',
        id_proof: '',
        from_date: resetRange.from,
        to_date: resetRange.to,
        expected_checkout_at: resetRange.to,
        total_amount: '',
        advance_amount: '',
        paid_amount: '',
        payment_mode: 'cash',
        booking_id: '',
        adults_count: 1,
        children_count: 0,
        companions: '',
        companions_id_details: '',
      })
      setShowGuestModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save guest.')
    } finally {
      setSubmitting(false)
    }
  }

  const onCreateCategory = async e => {
    e.preventDefault()
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required.')
      return
    }
    try {
      await guestHouseAPI.createRoomCategory({ name: categoryForm.name.trim() })
      toast.success('Room category created.')
      setCategoryForm({ name: '' })
      setShowCategoryModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category.')
    }
  }

  const onCreateRoom = async e => {
    e.preventDefault()
    if (!roomForm.room_no || !roomForm.floor_no || !roomForm.category_id) {
      toast.error('Room no, floor and category are required.')
      return
    }
    try {
      await guestHouseAPI.createRoom({
        room_no: roomForm.room_no,
        floor_no: roomForm.floor_no,
        category_id: Number(roomForm.category_id),
        room_type: roomForm.room_type,
      })
      toast.success('Room added successfully.')
      setRoomForm({ room_no: '', floor_no: '', category_id: '', room_type: '' })
      setShowRoomModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add room.')
    }
  }

  const onCreateBooking = async e => {
    e.preventDefault()
    if (!bookingForm.guest_name || !bookingForm.phone || !bookingForm.category_id || !bookingForm.room_no || !bookingForm.from_date || !bookingForm.to_date || !bookingForm.address) {
      toast.error('Please fill all required fields for booking.')
      return
    }
    setSubmitting(true)
    try {
      await guestHouseAPI.createBooking(bookingForm)
      toast.success('Advance booking created.')
      const resetRange = defaultDateRange()
      setBookingForm({
        guest_name: '',
        phone: '',
        category_id: '',
        room_no: '',
        address: '',
        id_proof: '',
        from_date: resetRange.from,
        to_date: resetRange.to,
        total_amount: '',
        advance_amount: '',
        payment_mode: 'cash',
        adults_count: 1,
        children_count: 0,
        companions: '',
        companions_id_details: '',
      })
      setShowBookingModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking.')
    } finally {
      setSubmitting(false)
    }
  }

  const onAddPayment = async e => {
    e.preventDefault()
    if (!selectedGuest?.id) return
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Enter valid payment amount.')
      return
    }
    setSubmitting(true)
    try {
      await guestHouseAPI.addPayment(selectedGuest.id, paymentForm)
      toast.success('Payment updated.')
      setShowPaymentModal(false)
      setSelectedGuest(null)
      setPaymentForm({ amount: '', payment_mode: 'cash' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add payment.')
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = row => {
    const from = (row.booking_from || row.check_in_at || '').slice(0, 16)
    const to = (row.booking_to || row.expected_checkout_at || '').slice(0, 16)
    setEditForm({
      id: row.id,
      guest_name: row.guest_name || '',
      phone: row.phone || '',
      category_id: String(row.category_id || ''),
      room_no: row.room_no || '',
      address: row.address || '',
      id_proof: row.id_proof || '',
      from_date: from,
      to_date: to,
      expected_checkout_at: (row.expected_checkout_at || row.booking_to || '').slice(0, 16),
      total_amount: row.total_amount ?? '',
      advance_amount: row.advance_amount ?? '',
      paid_amount: row.paid_amount ?? '',
      payment_mode: row.payment_mode || 'cash',
      adults_count: row.adults_count ?? 1,
      children_count: row.children_count ?? 0,
      companions: row.companions || '',
      companions_id_details: row.companions_id_details || '',
      status: row.status || 'checked_in',
    })
    setShowEditModal(true)
  }

  const onEditGuest = async e => {
    e.preventDefault()
    if (!editForm?.id) return
    setSubmitting(true)
    try {
      await guestHouseAPI.updateGuest(editForm.id, editForm)
      toast.success('Guest/booking updated.')
      setShowEditModal(false)
      setEditForm(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update record.')
    } finally {
      setSubmitting(false)
    }
  }

  const onCheckout = async guestId => {
    if (!confirm('Checkout this guest and free the room?')) return
    try {
      await guestHouseAPI.checkout(guestId)
      toast.success('Guest checked out.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to checkout.')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!dashboard) return <div className="text-surface-500 text-center py-20">Could not load guest house.</div>

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Krishna Guest House</h1>
          <p className="page-sub">Rooms, check-ins, and guest records in one place.</p>
        </div>
        <button className="btn-secondary btn" onClick={load}>↻ Refresh</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Total Rooms" value={dashboard.summary.total_rooms} color="total" />
        <Stat label="Available Rooms" value={dashboard.summary.available_rooms} color="available" />
        <Stat label="Booked Rooms" value={dashboard.summary.booked_rooms} color="booked" />
        <Stat label="Active Guests" value={dashboard.summary.active_guests} color="active" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">
        <div className="card overflow-hidden xl:col-span-1">
          <div className="px-5 py-4 border-b border-surface-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-surface-900">Room Status</h2>
              <div className="flex gap-2">
                <button className="btn-secondary btn btn-sm" onClick={() => {
                  const next = defaultDateRange()
                  setBookingForm(p => ({ ...p, from_date: next.from, to_date: next.to }))
                  setShowBookingModal(true)
                }}>+ Advance Booking</button>
                <button className="btn-secondary btn btn-sm" onClick={() => setShowCategoryModal(true)}>+ Add Category</button>
                <button className="btn-primary btn btn-sm" onClick={() => setShowRoomModal(true)}>+ Add Room</button>
              </div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dashboard.rooms.map(room => (
              <div key={room.id} className={`rounded-lg border p-3 ${room.status === 'available' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} ${(room.expected_checkout_at && new Date(room.expected_checkout_at) <= new Date() && room.status !== 'available') ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-surface-900">Room {room.room_no}</p>
                  <span className={`badge ${room.status === 'available' ? 'badge-green' : 'badge-amber'}`}>{room.status}</span>
                </div>
                <p className="text-xs text-surface-500">{room.category_name || room.room_type || 'Standard'} {room.floor_no ? `· Floor ${room.floor_no}` : ''}</p>
                {room.guest_id && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-surface-800">{room.guest_name}</p>
                    <p className="text-xs text-surface-500">{room.phone}</p>
                    <p className="text-xs text-surface-500">Balance: {Number(room.balance_amount || 0).toFixed(2)}</p>
                    <p className="text-xs text-surface-500">Checkout: {room.expected_checkout_at || '-'}</p>
                    <button className="btn-secondary btn btn-sm mt-1" onClick={() => onCheckout(room.guest_id)}>Checkout</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-surface-900">Recent Guest Records</h2>
            <div className="flex gap-2">
              <input
                className="input w-60"
                placeholder="Search guest/phone/room..."
                value={recentGuestSearch}
                onChange={e => { setRecentGuestSearch(e.target.value); setRecentGuestPage(1) }}
              />
              <button className="btn-primary btn btn-sm" onClick={() => {
                const next = defaultDateRange()
                setForm(p => ({ ...p, from_date: next.from, to_date: next.to, expected_checkout_at: next.to }))
                setShowGuestModal(true)
              }}>+ New Guest</button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto">
            <thead>
              <tr>
                <th className="th">Guest</th>
                <th className="th">Phone</th>
                <th className="th">Room</th>
                <th className="th">From - To</th>
                <th className="th">Payment</th>
                <th className="th">Balance</th>
                <th className="th">Checkout Time</th>
                <th className="th">ID Proof</th>
                <th className="th">Address</th>
                <th className="th">Status</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecentGuests.map(g => (
                <tr key={g.id}>
                  <td className="td">{g.guest_name}</td>
                  <td className="td">{g.phone}</td>
                  <td className="td">{g.room_no}</td>
                  <td className="td">{g.booking_from || g.check_in_at || '-'} - {g.booking_to || g.check_out_at || g.expected_checkout_at || '-'}</td>
                  <td className="td">{Number(g.paid_amount || 0).toFixed(2)} / {Number(g.total_amount || 0).toFixed(2)} ({g.payment_mode || '-'})</td>
                  <td className="td">{Number(g.balance_amount || 0).toFixed(2)}</td>
                  <td className="td">{g.expected_checkout_at || '-'}</td>
                  <td className="td">{g.id_proof}</td>
                  <td className="td">{g.address}</td>
                  <td className="td"><span className={`badge ${g.status === 'checked_in' ? 'badge-blue' : 'badge-gray'}`}>{g.status}</span></td>
                  <td className="td">
                    {g.status === 'checked_in' && (
                      <button className="btn-secondary btn btn-sm" onClick={() => { setSelectedGuest(g); setShowPaymentModal(true) }}>Add Payment</button>
                    )}
                    <button className="btn-secondary btn btn-sm ml-2" onClick={() => openEdit(g)}>Edit</button>
                  </td>
                </tr>
              ))}
              {recentGuests.length === 0 && (
                <tr><td colSpan={11} className="td text-center text-surface-500">No guest records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={recentGuestPage} pages={recentGuestPages} onPage={setRecentGuestPage} />

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-surface-900">Upcoming / Active Bookings</h2>
            <input
              className="input w-60"
              placeholder="Search booking..."
              value={bookingSearch}
              onChange={e => { setBookingSearch(e.target.value); setBookingPage(1) }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto">
            <thead>
              <tr>
                <th className="th">Guest</th>
                <th className="th">Room</th>
                <th className="th">Date Range</th>
                <th className="th">Payment</th>
                <th className="th">Balance</th>
                <th className="th">Status</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedBookings.map(b => (
                <tr key={b.id}>
                  <td className="td">{b.guest_name} ({b.phone})</td>
                  <td className="td">{b.room_no}</td>
                  <td className="td">{b.booking_from} - {b.booking_to}</td>
                  <td className="td">{Number(b.advance_amount || 0).toFixed(2)} / {Number(b.total_amount || 0).toFixed(2)} ({b.payment_mode || '-'})</td>
                  <td className="td">{Number(b.balance_amount || 0).toFixed(2)}</td>
                  <td className="td"><span className={`badge ${b.status === 'reserved' ? 'badge-amber' : 'badge-blue'}`}>{b.status}</span></td>
                  <td className="td"><button className="btn-secondary btn btn-sm" onClick={() => openEdit(b)}>Edit</button></td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-surface-500">No booking records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={bookingPage} pages={bookingPages} onPage={setBookingPage} />

      <Modal open={showGuestModal} onClose={() => setShowGuestModal(false)} title="New Guest Check-in" size="md">
        <form className="space-y-3" onSubmit={onCheckIn}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Guest Name *</label>
              <input className="input" value={form.guest_name} onChange={e => setForm(p => ({ ...p, guest_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Phone Number *</label>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Room Category *</label>
              <select className="select" value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value, room_no: '' }))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">From Date *</label>
              <input type="datetime-local" className="input" value={form.from_date} onChange={e => {
                const from = e.target.value
                const toCandidate = form.to_date && new Date(form.to_date) > new Date(from)
                  ? form.to_date
                  : toLocalInputValue(new Date(new Date(from).getTime() + 24 * 60 * 60 * 1000))
                setForm(p => ({ ...p, from_date: from, to_date: toCandidate, expected_checkout_at: toCandidate, room_no: '' }))
              }} />
            </div>
            <div className="form-group">
              <label className="label">To Date *</label>
              <input type="datetime-local" className="input" value={form.to_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value, room_no: '' }))} />
            </div>
            <div className="form-group">
              <label className="label">Room Number *</label>
              <select className="select" value={form.room_no} onChange={e => setForm(p => ({ ...p, room_no: e.target.value }))}>
                <option value="">Select room</option>
                {roomOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Expected Checkout *</label>
              <input type="datetime-local" className="input" value={form.expected_checkout_at} onChange={e => setForm(p => ({ ...p, expected_checkout_at: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Total Amount</label>
              <input type="number" step="0.01" className="input" value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Advance / Paid</label>
              <input type="number" step="0.01" className="input" value={form.advance_amount} onChange={e => setForm(p => ({ ...p, advance_amount: e.target.value, paid_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Payment Mode</label>
              <select className="select" value={form.payment_mode} onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">ID Proof (Optional)</label>
              <input className="input" value={form.id_proof} onChange={e => setForm(p => ({ ...p, id_proof: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Adults</label>
              <input type="number" min="1" className="input" value={form.adults_count} onChange={e => setForm(p => ({ ...p, adults_count: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Children</label>
              <input type="number" min="0" className="input" value={form.children_count} onChange={e => setForm(p => ({ ...p, children_count: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label">Companion Names (Optional)</label>
              <textarea rows={2} className="textarea" value={form.companions} onChange={e => setForm(p => ({ ...p, companions: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label">Companion ID Details (Optional)</label>
              <textarea rows={2} className="textarea" value={form.companions_id_details} onChange={e => setForm(p => ({ ...p, companions_id_details: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label">Address *</label>
              <textarea rows={3} className="textarea" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary btn" onClick={() => setShowGuestModal(false)}>Cancel</button>
            <button className="btn-primary btn" disabled={submitting}>{submitting ? 'Saving...' : 'Save Check-in'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showBookingModal} onClose={() => setShowBookingModal(false)} title="Advance Room Booking" size="md">
        <form className="space-y-3" onSubmit={onCreateBooking}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Guest Name *</label>
              <input className="input" value={bookingForm.guest_name} onChange={e => setBookingForm(p => ({ ...p, guest_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Phone Number *</label>
              <input className="input" value={bookingForm.phone} onChange={e => setBookingForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Room Category *</label>
              <select className="select" value={bookingForm.category_id} onChange={e => setBookingForm(p => ({ ...p, category_id: e.target.value, room_no: '' }))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Room Number *</label>
              <select className="select" value={bookingForm.room_no} onChange={e => setBookingForm(p => ({ ...p, room_no: e.target.value }))}>
                <option value="">Select room</option>
                {bookingAvailableRooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">From Date *</label>
              <input type="datetime-local" className="input" value={bookingForm.from_date} onChange={e => {
                const from = e.target.value
                const toCandidate = bookingForm.to_date && new Date(bookingForm.to_date) > new Date(from)
                  ? bookingForm.to_date
                  : toLocalInputValue(new Date(new Date(from).getTime() + 24 * 60 * 60 * 1000))
                setBookingForm(p => ({ ...p, from_date: from, to_date: toCandidate, room_no: '' }))
              }} />
            </div>
            <div className="form-group">
              <label className="label">To Date *</label>
              <input type="datetime-local" className="input" value={bookingForm.to_date} onChange={e => setBookingForm(p => ({ ...p, to_date: e.target.value, room_no: '' }))} />
            </div>
            <div className="form-group">
              <label className="label">Total Amount</label>
              <input type="number" step="0.01" className="input" value={bookingForm.total_amount} onChange={e => setBookingForm(p => ({ ...p, total_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Advance Amount</label>
              <input type="number" step="0.01" className="input" value={bookingForm.advance_amount} onChange={e => setBookingForm(p => ({ ...p, advance_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Payment Mode</label>
              <select className="select" value={bookingForm.payment_mode} onChange={e => setBookingForm(p => ({ ...p, payment_mode: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">ID Proof (Optional)</label>
              <input className="input" value={bookingForm.id_proof} onChange={e => setBookingForm(p => ({ ...p, id_proof: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Adults</label>
              <input type="number" min="1" className="input" value={bookingForm.adults_count} onChange={e => setBookingForm(p => ({ ...p, adults_count: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Children</label>
              <input type="number" min="0" className="input" value={bookingForm.children_count} onChange={e => setBookingForm(p => ({ ...p, children_count: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label">Companion Names (Optional)</label>
              <textarea rows={2} className="textarea" value={bookingForm.companions} onChange={e => setBookingForm(p => ({ ...p, companions: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label">Companion ID Details (Optional)</label>
              <textarea rows={2} className="textarea" value={bookingForm.companions_id_details} onChange={e => setBookingForm(p => ({ ...p, companions_id_details: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label">Address *</label>
              <textarea rows={3} className="textarea" value={bookingForm.address} onChange={e => setBookingForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary btn" onClick={() => setShowBookingModal(false)}>Cancel</button>
            <button className="btn-primary btn" disabled={submitting}>{submitting ? 'Saving...' : 'Save Booking'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Add Room Category" size="sm">
        <form className="space-y-3" onSubmit={onCreateCategory}>
          <div className="form-group">
            <label className="label">Category Name *</label>
            <input className="input" value={categoryForm.name} onChange={e => setCategoryForm({ name: e.target.value })} placeholder="e.g. Deluxe" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary btn" onClick={() => setShowCategoryModal(false)}>Cancel</button>
            <button className="btn-primary btn">Save Category</button>
          </div>
        </form>
      </Modal>

      <Modal open={showRoomModal} onClose={() => setShowRoomModal(false)} title="Add Room" size="sm">
        <form className="space-y-3" onSubmit={onCreateRoom}>
          <div className="form-group">
            <label className="label">Room Category *</label>
            <div className="flex gap-2">
              <select className="select flex-1" value={roomForm.category_id} onChange={e => setRoomForm(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="btn-secondary btn btn-sm" onClick={() => { setShowRoomModal(false); setShowCategoryModal(true) }}>+ Add</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="form-group">
              <label className="label">Room No *</label>
              <input className="input" value={roomForm.room_no} onChange={e => setRoomForm(p => ({ ...p, room_no: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Floor *</label>
              <input className="input" value={roomForm.floor_no} onChange={e => setRoomForm(p => ({ ...p, floor_no: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Display Type (Optional)</label>
            <input className="input" value={roomForm.room_type} onChange={e => setRoomForm(p => ({ ...p, room_type: e.target.value }))} placeholder="Optional label" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary btn" onClick={() => setShowRoomModal(false)}>Cancel</button>
            <button className="btn-primary btn">Save Room</button>
          </div>
        </form>
      </Modal>

      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Add Guest Payment" size="sm">
        <form className="space-y-3" onSubmit={onAddPayment}>
          <div className="text-sm text-surface-600">
            {selectedGuest ? `${selectedGuest.guest_name} · Room ${selectedGuest.room_no}` : ''}
          </div>
          <div className="form-group">
            <label className="label">Amount *</label>
            <input type="number" step="0.01" className="input" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Payment Mode</label>
            <select className="select" value={paymentForm.payment_mode} onChange={e => setPaymentForm(p => ({ ...p, payment_mode: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
              <option value="bank">Bank</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary btn" onClick={() => setShowPaymentModal(false)}>Cancel</button>
            <button className="btn-primary btn" disabled={submitting}>{submitting ? 'Saving...' : 'Save Payment'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Guest / Booking" size="md">
        {editForm && (
          <form className="space-y-3" onSubmit={onEditGuest}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="form-group"><label className="label">Guest Name</label><input className="input" value={editForm.guest_name} onChange={e => setEditForm(p => ({ ...p, guest_name: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Phone</label><input className="input" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Category</label><select className="select" value={editForm.category_id} onChange={e => setEditForm(p => ({ ...p, category_id: e.target.value }))}><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="form-group"><label className="label">Room</label><select className="select" value={editForm.room_no} onChange={e => setEditForm(p => ({ ...p, room_no: e.target.value }))}><option value="">Select room</option>{editAvailableRooms.includes(editForm.room_no) ? null : <option value={editForm.room_no}>{editForm.room_no}</option>}{editAvailableRooms.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              <div className="form-group"><label className="label">From Date</label><input type="datetime-local" className="input" value={editForm.from_date} onChange={e => setEditForm(p => ({ ...p, from_date: e.target.value }))} /></div>
              <div className="form-group"><label className="label">To Date</label><input type="datetime-local" className="input" value={editForm.to_date} onChange={e => setEditForm(p => ({ ...p, to_date: e.target.value, expected_checkout_at: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Expected Checkout</label><input type="datetime-local" className="input" value={editForm.expected_checkout_at} onChange={e => setEditForm(p => ({ ...p, expected_checkout_at: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Status</label><select className="select" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}><option value="reserved">Reserved</option><option value="checked_in">Checked In</option><option value="checked_out">Checked Out</option><option value="cancelled">Cancelled</option></select></div>
              <div className="form-group"><label className="label">Total</label><input type="number" step="0.01" className="input" value={editForm.total_amount} onChange={e => setEditForm(p => ({ ...p, total_amount: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Advance</label><input type="number" step="0.01" className="input" value={editForm.advance_amount} onChange={e => setEditForm(p => ({ ...p, advance_amount: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Paid</label><input type="number" step="0.01" className="input" value={editForm.paid_amount} onChange={e => setEditForm(p => ({ ...p, paid_amount: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Payment Mode</label><select className="select" value={editForm.payment_mode} onChange={e => setEditForm(p => ({ ...p, payment_mode: e.target.value }))}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="credit">Credit</option><option value="bank">Bank</option></select></div>
              <div className="form-group"><label className="label">Adults</label><input type="number" min="1" className="input" value={editForm.adults_count} onChange={e => setEditForm(p => ({ ...p, adults_count: e.target.value }))} /></div>
              <div className="form-group"><label className="label">Children</label><input type="number" min="0" className="input" value={editForm.children_count} onChange={e => setEditForm(p => ({ ...p, children_count: e.target.value }))} /></div>
              <div className="form-group md:col-span-2"><label className="label">Companion Names (Optional)</label><textarea rows={2} className="textarea" value={editForm.companions} onChange={e => setEditForm(p => ({ ...p, companions: e.target.value }))} /></div>
              <div className="form-group md:col-span-2"><label className="label">Companion ID Details (Optional)</label><textarea rows={2} className="textarea" value={editForm.companions_id_details} onChange={e => setEditForm(p => ({ ...p, companions_id_details: e.target.value }))} /></div>
              <div className="form-group md:col-span-2"><label className="label">Address</label><textarea rows={3} className="textarea" value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary btn" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn-primary btn" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
