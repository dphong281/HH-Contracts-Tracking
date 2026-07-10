import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getHopDongList, getCongNoList } from '../lib/queries'
import { useRealtimeRefresh } from '../lib/useRealtime'
import { PHAN_LOAI_LABELS, formatCurrency, formatDate, daysUntil } from '../lib/format'
import { Card, StatCard, Badge, LoadingState, ErrorState, EmptyState } from '../components/ui'

const PHAN_LOAI_CHART_COLORS = {
  DL: '#E8973A', MB: '#2F7A5E', TNPP: '#0F2A3D', TTTT: '#6B7680',
}

export default function Dashboard() {
  const [hopDongs, setHopDongs] = useState([])
  const [congNo, setCongNo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [hd, cn] = await Promise.all([getHopDongList(), getCongNoList()])
    if (hd.error) setError(hd.error.message)
    else setHopDongs(hd.data || [])
    setCongNo(cn.data || [])
    setLoading(false)
  }

  useRealtimeRefresh(['hop_dong_dau_ra', 'thanh_toan', 'khach_hang'], load)

  const stats = useMemo(() => {
    const dangHieuLuc = hopDongs.filter((h) => h.trang_thai === 'dang_hieu_luc')
    const tongGiaTri = hopDongs.reduce((s, h) => s + Number(h.gia_tri_hop_dong || 0), 0)
    const tongCongNo = congNo.reduce((s, r) => s + Math.max(Number(r.cong_no_con_lai || 0), 0), 0)
    const sapHetHan = dangHieuLuc.filter((h) => {
      const d = daysUntil(h.ngay_ket_thuc)
      return d !== null && d <= 30
    })
    return { dangHieuLuc: dangHieuLuc.length, tongGiaTri, tongCongNo, sapHetHan }
  }, [hopDongs, congNo])

  const chartByLoai = useMemo(() => {
    const map = {}
    hopDongs.forEach((h) => {
      const loai = h.khach_hang?.phan_loai || 'Khác'
      map[loai] = (map[loai] || 0) + Number(h.gia_tri_hop_dong || 0)
    })
    return Object.entries(map).map(([loai, value]) => ({
      loai, label: PHAN_LOAI_LABELS[loai] || loai, value,
    }))
  }, [hopDongs])

  const chartByMonth = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`, value: 0 })
    }
    hopDongs.forEach((h) => {
      if (!h.ngay_bat_dau) return
      const d = new Date(h.ngay_bat_dau)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const m = months.find((mm) => mm.key === key)
      if (m) m.value += Number(h.gia_tri_hop_dong || 0)
    })
    return months
  }, [hopDongs])

  const topCongNo = [...congNo].filter((r) => Number(r.cong_no_con_lai) > 0).slice(0, 5)

  const topKhachHang = useMemo(() => {
    const map = {}
    hopDongs.forEach((h) => {
      const ten = h.khach_hang?.ten_khach_hang
      if (!ten) return
      map[ten] = (map[ten] || 0) + Number(h.gia_tri_hop_dong || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [hopDongs])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Tổng quan</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Tình hình hợp đồng đầu ra và công nợ</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Hợp đồng đang hiệu lực" value={stats.dangHieuLuc} />
        <StatCard label="Tổng giá trị hợp đồng" value={formatCurrency(stats.tongGiaTri)} />
        <StatCard label="Tổng công nợ còn lại" value={formatCurrency(stats.tongCongNo)} accent />
        <StatCard label="Sắp hết hạn (≤30 ngày)" value={stats.sapHetHan.length} accent={stats.sapHetHan.length > 0} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-[var(--color-ink)] mb-4">Giá trị hợp đồng theo phân loại KH</h3>
          {chartByLoai.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartByLoai}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7680' }} axisLine={{ stroke: '#E4E0D6' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7680' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v)} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E4E0D6', fontSize: 13 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartByLoai.map((entry, i) => (
                    <Cell key={i} fill={PHAN_LOAI_CHART_COLORS[entry.loai] || '#6B7680'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-[var(--color-ink)] mb-4">Doanh số theo tháng (12 tháng gần nhất)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7680' }} axisLine={{ stroke: '#E4E0D6' }} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7680' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v)} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E4E0D6', fontSize: 13 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#E8973A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Sắp hết hạn</h3>
          </div>
          {stats.sapHetHan.length === 0 ? (
            <EmptyState title="Không có HĐ nào sắp hết hạn" />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {stats.sapHetHan.map((h) => {
                const d = daysUntil(h.ngay_ket_thuc)
                return (
                  <li key={h.id} className="px-5 py-3">
                    <Link to={`/hop-dong/${h.id}`} className="font-medium text-sm text-[var(--color-ink)] hover:underline">{h.so_hop_dong}</Link>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{h.khach_hang?.ten_khach_hang}</div>
                    <div className={`text-xs mt-1 ${d < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-amber-dark)]'}`}>
                      {d < 0 ? `Quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày`}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Công nợ cao nhất</h3>
          </div>
          {topCongNo.length === 0 ? (
            <EmptyState title="Không có công nợ" />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {topCongNo.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <Link to={`/hop-dong/${r.id}`} className="font-medium text-sm text-[var(--color-ink)] hover:underline">{r.so_hop_dong}</Link>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.ten_khach_hang}</div>
                  <Badge className="bg-[#C0432E]/10 text-[#C0432E] mt-1">{formatCurrency(r.cong_no_con_lai)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Top khách hàng</h3>
          </div>
          {topKhachHang.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu" />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {topKhachHang.map(([ten, value]) => (
                <li key={ten} className="px-5 py-3 flex items-center justify-between gap-3">
                  <span className="font-medium text-sm text-[var(--color-ink)]">{ten}</span>
                  <span className="text-sm text-[var(--color-text-muted)] shrink-0">{formatCurrency(value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
