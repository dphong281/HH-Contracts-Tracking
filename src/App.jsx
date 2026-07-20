import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import KhachHang from './pages/KhachHang'
import KhachHangDetail from './pages/Khachhangdetail'
import NhanVien from './pages/NhanVien'
import HopDong from './pages/HopDong'
import HopDongDetail from './pages/HopDongDetail'
import CongNo from './pages/CongNo'
import NhatKy from './pages/NhatKy'
import CaiDat from './pages/CaiDat'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-text-muted)]">
        Đang tải...
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/hop-dong" element={<HopDong />} />
        <Route path="/hop-dong/:id" element={<HopDongDetail />} />
        <Route path="/khach-hang" element={<KhachHang />} />
        <Route path="/khach-hang/:id" element={<Khachhangdetail />} />
        <Route path="/cong-no" element={<CongNo />} />
        <Route path="/nhan-vien" element={<NhanVien />} />
        <Route path="/nhat-ky" element={<NhatKy />} />
        <Route path="/cai-dat" element={<CaiDat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}