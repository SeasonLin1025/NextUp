// ─────────────────────────────────────────────
// DeepSeek 服务端统一配置
// 仅服务端使用，不要 import 到客户端组件（'use client' 文件）
// ─────────────────────────────────────────────

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/**
 * 模型名：可通过环境变量 DEEPSEEK_MODEL 覆盖，
 * 未配置时默认 deepseek-v4-flash（对应官方 DeepSeek-V4-Flash-0731）。
 * 注意：API 请求中的模型名始终是 deepseek-v4-flash，
 * 不是 DeepSeek-V4-Flash-0731 / deepseek-v4-flash-0731。
 */
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
