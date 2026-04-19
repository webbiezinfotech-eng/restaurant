import axios from "axios"

// local apis flow
// const API_BASE_URL = "/api"
// const API_BASE_URL = (typeof window !== "undefined" && window.location.hostname === "localhost")
//   ? "http://localhost:8000/backend/index.php"
//   : "/api"

// server flow
const API_BASE_URL = "/backend"

const api = axios.create({ baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" }, timeout: 15000 })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem("auth_token")
  if (token) cfg.headers.Authorization = "Bearer " + token
  return cfg
})
api.interceptors.response.use(res => res, err => {
  const status = err.response?.status
  const path = err.config?.url || ""
  const isAuthFailureOk = path.includes("/auth/login") || path.includes("/auth/change-password")
  if (status === 401 && !isAuthFailureOk) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("admin_user")
    window.location.href = "/login"
  }
  return Promise.reject(err)
})

export const authAPI      = { login: d => api.post("/auth/login",d), logout: () => api.post("/auth/logout"), me: () => api.get("/auth/me") }
export const dashboardAPI = { get: () => api.get("/dashboard") }
export const tableAPI     = { list: () => api.get("/tables"), show: id => api.get(`/tables/${id}`), update: (id,d) => api.put(`/tables/${id}`,d), reset: id => api.post(`/tables/${id}/reset`) }
export const categoryAPI  = { list: p => api.get("/categories",{params:p}), create: d => api.post("/categories",d), update: (id,d) => api.put(`/categories/${id}`,d), delete: id => api.delete(`/categories/${id}`) }
export const menuAPI      = { list: p => api.get("/menu-items",{params:p}), create: d => api.post("/menu-items",d), update: (id,d) => api.put(`/menu-items/${id}`,d), delete: id => api.delete(`/menu-items/${id}`) }
export const orderAPI     = { list: p => api.get("/orders",{params:p}), show: id => api.get(`/orders/${id}`), createDineIn: d => api.post("/orders/dine-in",d), createGuestHouse: d => api.post("/orders/guest-house",d), addItem: (id,d) => api.post(`/orders/${id}/items`,d), updateItem: (id,iid,d) => api.put(`/orders/${id}/items/${iid}`,d), removeItem: (id,iid) => api.delete(`/orders/${id}/items/${iid}`), updateCommission: (id,d) => api.put(`/orders/${id}/commission`, d), cancel: id => api.post(`/orders/${id}/cancel`) }
export const billingAPI   = { generateBill: (id,d) => api.post(`/orders/${id}/bill`,d), list: p => api.get("/bills",{params:p}), show: num => api.get(`/bills/${num}`), markPaid: (num,d) => api.post(`/bills/${num}/mark-paid`, d), updatePaymentStatus: (num,d) => api.post(`/bills/${num}/payment-status`, d) }
export const reportAPI    = { sales: p => api.get("/reports/sales",{params:p}), itemWise: p => api.get("/reports/item-wise",{params:p}), tableWise: p => api.get("/reports/table-wise",{params:p}), commission: p => api.get("/reports/commission",{params:p}), paymentMode: p => api.get("/reports/payment-mode",{params:p}) }
export const settingsAPI  = { list: () => api.get("/settings"), update: d => api.put("/settings",d) }
export const guestHouseAPI = {
  dashboard: () => api.get("/guest-house/dashboard"),
  rooms: () => api.get("/guest-house/rooms"),
  createRoom: d => api.post("/guest-house/rooms", d),
  roomCategories: () => api.get("/guest-house/room-categories"),
  createRoomCategory: d => api.post("/guest-house/room-categories", d),
  profiles: p => api.get("/guest-house/profiles", { params: p }),
  createProfile: d => api.post("/guest-house/profiles", d),
  createGuest: d => api.post("/guest-house/guests", d),
  updateGuest: (id, d) => api.put(`/guest-house/guests/${id}`, d),
  availableRooms: p => api.get("/guest-house/available-rooms", { params: p }),
  bookings: () => api.get("/guest-house/bookings"),
  createBooking: d => api.post("/guest-house/bookings", d),
  addPayment: (id, d) => api.post(`/guest-house/guests/${id}/payment`, d),
  checkout: id => api.post(`/guest-house/guests/${id}/checkout`),
}
export default api
