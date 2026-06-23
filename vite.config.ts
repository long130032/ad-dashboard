import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 纯静态:无后端,不需要 /api 代理。数据在浏览器里解析与计算。
// base 指向 GitHub Pages 的项目子路径 long130032.github.io/ad-dashboard/
export default defineConfig({
  base: '/ad-dashboard/',
  plugins: [react(), tailwindcss()],
})
