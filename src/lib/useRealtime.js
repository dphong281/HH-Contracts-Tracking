import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Tự động gọi lại `callback` (thường là load()) khi có ai đó (kể cả người khác)
// thêm/sửa/xoá dữ liệu trong các bảng được liệt kê — nhờ Supabase Realtime.
// Có debounce để tránh gọi lại liên tục khi nhiều thay đổi xảy ra gần nhau.
export function useRealtimeRefresh(tables, callback, delay = 400) {
  const timerRef = useRef(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const tableKey = tables.join(',')

  useEffect(() => {
    const channelName = `realtime-${tableKey}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)

    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          callbackRef.current()
        }, delay)
      })
    })

    channel.subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey])
}
