//  @ts-check

import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import-x'
import { tanstackConfig } from '@tanstack/eslint-config'
import { tiWorkRules } from './eslint/ti-work-rules.mjs'

export default [
  ...tanstackConfig,
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'vite.config.ts',
      // 规则定义自身：元描述含被检测关键词（TODO/占位符/密钥示例），不参与自检
      'eslint/ti-work-rules.mjs',
      // 非 TS 运行时文件：service worker / 构建脚本 / 生产入口，不属于静态门禁范围
      'public/sw.js',
      'scripts/generate-pwa-icons.js',
      'server-entry.js',
      // 本地浏览器二进制目录（eslint 不读 .gitignore）
      '.playwright-browsers/**',
      // 构建产物 / 打包缓存 / 打包输出：由构建链生成，不参与静态门禁
      'dist/**',
      '.electron-stage/**',
      '.electron-cache/**',
      '.electron-builder-cache/**',
      'release/**',
      'dist-electron/**',
    ],
  },
  {
    plugins: {
      'ti-work': { rules: tiWorkRules },
    },
    rules: {
      // 红线 1：TODO/FIXME/HACK/XXX 零容忍（ESLint 10 已移除核心 no-warn-comments，由自有插件规则承接）
      'ti-work/no-todo-comments': 'error',
      // 红线 2：占位符/示例内容零容忍（测试夹具由 ti-work/no-placeholder-code 白名单豁免）
      'ti-work/no-placeholder-code': 'error',
      // 红线 3：业务代码零 mock/stub 测试替身（测试文件豁免）
      'ti-work/no-mock-business-code': 'error',
      // 红线 4：硬编码密钥零容忍（测试文件豁免）
      'ti-work/no-hardcoded-secrets': 'error',
    },
  },
  // 存量风格债务降级：原仓库从未配置 lint gate，以下规则存在 300+ 处历史命中，
  // 需语义判断逐一收敛（no-unnecessary-condition 为类型推断级防御代码）。
  // 保持 warn 提示，G1-G6 各工作流改造相关模块时同步恢复 error。
  {
    files: ['**/*.{js,ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      'no-shadow': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      // 声明级排序交由 import/order（value import 在 type import 之前），
      // sort-imports（core）只负责成员级排序，避免两规则对 type 声明位置要求冲突。
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
      'no-useless-escape': 'warn',
      '@typescript-eslint/naming-convention': 'warn',
      'import/no-duplicates': 'warn',
      'no-constant-condition': 'warn',
    },
  },
  // 业务后端层（唯一调度/存储通道）额外执行 no-explicit-any：后端逻辑零 any
  {
    files: ['src/server/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]
