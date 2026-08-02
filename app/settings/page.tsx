'use client'

import { useEffect, useRef, useState } from 'react'
import {
  buildBackup,
  validateBackup,
  extractBackupData,
  applyMerge,
  applyOverwrite,
  countConflicts,
  BackupData,
} from '@/lib/backup'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import BottomNav from '@/components/BottomNav'
import { Download, Upload, Database } from 'lucide-react'

interface PendingImport {
  data: BackupData
  exportedAt: string
  currentCount: number
  importCount: number
  conflictCount: number
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false)
  const [currentCount, setCurrentCount] = useState(0)
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
    refreshCount()
  }, [])

  // 弹窗打开时默认聚焦"取消"，避免回车误触危险操作
  useEffect(() => {
    if (pendingImport) {
      setTimeout(() => cancelRef.current?.focus(), 50)
    }
  }, [pendingImport])

  function refreshCount() {
    try {
      const tasks = JSON.parse(localStorage.getItem('nextup_tasks') || '[]')
      setCurrentCount(Array.isArray(tasks) ? tasks.length : 0)
    } catch {
      setCurrentCount(0)
    }
  }

  function showToast(text: string, isError = false) {
    setToast({ text, isError })
    setTimeout(() => setToast(null), 4000)
  }

  // ─── 导出 ──────────────────────────────────
  function handleExport() {
    try {
      const backup = buildBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      a.href = url
      a.download = `nextup-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`已导出 ${backup.data.tasks.length} 项任务`)
    } catch {
      showToast('导出失败，请重试', true)
    }
  }

  // ─── 导入：读文件 + 校验 ────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一文件
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!validateBackup(parsed)) {
          showToast('文件格式不正确，请选择由 NextUp 导出的备份文件', true)
          return
        }
        const data = extractBackupData(parsed)
        setPendingImport({
          data,
          exportedAt: parsed.exportedAt,
          currentCount,
          importCount: data.tasks.length,
          conflictCount: countConflicts(data.tasks),
        })
      } catch {
        showToast('文件读取失败，请选择有效的 JSON 备份文件', true)
      }
    }
    reader.onerror = () => showToast('文件读取失败，请重试', true)
    reader.readAsText(file)
  }

  // ─── 合并导入 ──────────────────────────────
  function handleMerge() {
    if (!pendingImport) return
    try {
      const result = applyMerge(pendingImport.data)
      setPendingImport(null)
      showToast(`已合并导入，新增 ${result.added} 项，更新 ${result.updated} 项`)
      setTimeout(() => window.location.reload(), 800)
    } catch {
      showToast('导入失败，数据未发生变化', true)
    }
  }

  // ─── 覆盖导入 ──────────────────────────────
  function handleOverwrite() {
    if (!pendingImport) return
    try {
      applyOverwrite(pendingImport.data)
      const count = pendingImport.importCount
      setPendingImport(null)
      showToast(`已覆盖导入 ${count} 项任务`)
      setTimeout(() => window.location.reload(), 800)
    } catch {
      showToast('导入失败，数据未发生变化', true)
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-lg py-8 px-4">
          <div className="h-8 w-32 rounded bg-slate-200 animate-pulse" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-lg py-8 px-4 pb-28">

        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-6">设置</h1>

        {/* 轻提示 */}
        {toast && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium border ${
              toast.isError
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* 数据备份 */}
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">数据备份</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            当前设备共 {currentCount} 项任务。数据仅保存在本浏览器，建议定期导出备份。
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              className="flex-1 bg-slate-900 hover:bg-slate-700"
            >
              <Download size={15} className="mr-1.5" /> 导出数据
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload size={15} className="mr-1.5" /> 导入数据
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* 导入方式选择弹窗 */}
      <Dialog open={pendingImport !== null} onOpenChange={(v) => !v && setPendingImport(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">导入备份</DialogTitle>
          </DialogHeader>

          {pendingImport && (
            <div className="space-y-4 py-1">
              {/* 对比信息 */}
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 space-y-1 text-xs text-slate-600">
                <p>当前设备：<span className="font-semibold">{pendingImport.currentCount}</span> 项任务</p>
                <p>
                  导入文件：<span className="font-semibold">{pendingImport.importCount}</span> 项任务
                  {pendingImport.exportedAt && (
                    <span className="text-slate-400">
                      （导出时间：{new Date(pendingImport.exportedAt).toLocaleString('zh-CN')}）
                    </span>
                  )}
                </p>
                <p>
                  其中 <span className="font-semibold">{pendingImport.conflictCount}</span> 项与现有任务重复（按 id 判断）
                </p>
              </div>

              {/* 方式一：合并 */}
              <button
                type="button"
                onClick={handleMerge}
                className="w-full text-left rounded-lg border-2 border-slate-200 hover:border-slate-400 px-3 py-2.5 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800">合并导入（推荐）</p>
                <p className="text-xs text-slate-500 mt-0.5">保留现有任务，加入备份中的新任务</p>
                <p className="text-xs text-slate-400">重复任务将保留最近更新的版本</p>
              </button>

              {/* 方式二：覆盖 */}
              <button
                type="button"
                onClick={handleOverwrite}
                className="w-full text-left rounded-lg border-2 border-red-200 hover:border-red-400 bg-red-50/50 px-3 py-2.5 transition-colors"
              >
                <p className="text-sm font-semibold text-red-600">覆盖导入</p>
                <p className="text-xs text-red-500 mt-0.5">清除当前所有数据，完全恢复为备份内容</p>
                <p className="text-xs text-red-400">
                  当前 {pendingImport.currentCount} 项任务将被删除，此操作不可撤销
                </p>
              </button>

              {/* 快捷导出 + 取消 */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleExport}
                  className="text-xs text-slate-400 underline hover:text-slate-600"
                >
                  先导出当前数据
                </button>
                <Button ref={cancelRef} variant="outline" onClick={() => setPendingImport(null)}>
                  取消
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  )
}
