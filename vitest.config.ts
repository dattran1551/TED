import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Sau khi chạy `npm run build`, thư mục .next chứa một bản sao của toàn bộ
    // src (kể cả các file test). Không loại nó ra thì mọi test sẽ chạy hai
    // lần: một lần bản thật, một lần bản sao cũ nằm trong output build.
    //
    // superpowers/ và emilkowalski-skills/ là thư viện skill vendored (đi kèm
    // bộ test riêng của chúng, cần dependency không có trong app này) — không
    // liên quan gì tới TED, phải loại ra.
    exclude: [...configDefaults.exclude, '.next/**', 'superpowers/**', 'emilkowalski-skills/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
