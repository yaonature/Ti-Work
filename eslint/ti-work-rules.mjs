/**
 * ti-work-rules — Ti Work 商业化工程红线 ESLint 规则组。
 *
 * 将二开方案的"禁止 TODO / 懒编码 / 硬编码 / mock / 占位符"转成可自动
 * 执行的静态门禁。任何一条命中即 CI 拒绝合入。
 *
 * 规则清单：
 *  - ti-work/no-todo-comments           遗留标记注释（TODO/FIXME/HACK/XXX）
 *  - ti-work/no-placeholder-code        占位符/示例内容（__PLACEHOLDER__、lorem ipsum、待实现 等）
 *  - ti-work/no-mock-business-code      业务代码中的 mock/stub 测试替身调用（测试文件豁免）
 *  - ti-work/no-hardcoded-secrets       硬编码密钥形态字面量（sk-、AKIA、ghp_、xox 等）
 *
 * 说明：
 *  - 测试文件（*.test.ts(x) / *.spec.ts(x) / src/test/** / e2e / playwright）豁免 mock 与密钥规则，
 *    测试夹具允许包含伪造密钥，但业务代码绝不允许。
 *  - TODO/FIXME/HACK/XXX 为全局零容忍红线（含测试文件），由 ti-work/no-todo-comments 强制执行。
 *  - 硬编码色值属主题迁移范畴（G1 工作流），不在本静态门禁内，避免对既有 599 处
 *    历史色值产生破坏性基线。
 */

const TEST_FILE_PATTERN = /(\.test|\.spec)\.[cm]?[jt]sx?$|\/(src\/test|e2e|playwright)\//i

function isTestFile(filename) {
  return TEST_FILE_PATTERN.test(filename)
}

const PLACEHOLDER_PATTERNS = [
  /__PLACEHOLDER__/i,
  /lorem\s+ipsum/i,
  /(?:待实现|待完成|待补充|占位符|示例数据|示例代码|示例内容)/,
  /\bTBD\b/i,
]

const TODO_COMMENT_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/i

const MOCK_CALL_PATTERNS = [
  // vi.mock / jest.mock module factory
  /^(vi|jest)\.mock$/,
  // 测试替身 API
  /^(mock|mockReturnValue|mockResolvedValue|mockRejectedValue|mockImplementation|mockImplementationOnce|mockResolvedValueOnce|mockRejectedValueOnce|mockReturnValueOnce|createMock|setupMockServer|mockFn)$/,
]

const SECRET_LITERAL_PATTERNS = [
  /\bsk-[A-Za-z0-9]{16,}\b/, // OpenAI
  /\bsk-ant-[A-Za-z0-9-]{20,}\b/, // Anthropic
  /\bAKIA[0-9A-Z]{16}\b/, // AWS
  /\bghp_[A-Za-z0-9]{20,}\b/, // GitHub
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack
  /\bAIza[0-9A-Za-z_-]{30,}\b/, // Google
]

const SECRET_ASSIGN_PATTERN =
  /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"](?![^'"]*\.\.\.)(?!your-|example|sample)[^'"]{6,}['"]/i

function toRule(meta, create) {
  return { meta, create }
}

export const tiWorkRules = {
  'no-todo-comments': toRule(
    {
      type: 'suggestion',
      docs: {
        description:
          '禁止 TODO/FIXME/HACK/XXX 等遗留标记注释——工作要么完成、要么不留痕迹，禁止遗留标记',
      },
      messages: {
        todo: '禁止遗留标记注释 "{{value}}"：任务必须完成，不允许遗留 TODO/FIXME/HACK/XXX',
      },
      schema: [],
    },
    (context) => {
      const sourceCode = context.sourceCode
      const reportComment = (comment) => {
        const match = TODO_COMMENT_PATTERN.exec(comment.value)
        if (!match) return
        context.report({
          node: comment,
          messageId: 'todo',
          data: { value: match[1].toUpperCase() },
        })
      }
      return {
        'Program:exit'() {
          for (const comment of sourceCode.getAllComments()) {
            reportComment(comment)
          }
        },
      }
    },
  ),

  'no-placeholder-code': toRule(
    {
      type: 'problem',
      docs: {
        description:
          '禁止占位符/示例内容（__PLACEHOLDER__、lorem ipsum、待实现、占位符 等）出现在业务代码中',
      },
      messages: {
        placeholder: '占位符/示例内容 "{{value}}" 禁止出现在业务代码中，请实现完整业务逻辑',
      },
      schema: [],
    },
    (context) => {
      const sourceCode = context.sourceCode
      const check = (node, value) => {
        if (typeof value !== 'string') return
        for (const pattern of PLACEHOLDER_PATTERNS) {
          if (pattern.test(value)) {
            context.report({
              node,
              messageId: 'placeholder',
              data: { value: value.slice(0, 80) },
            })
            return
          }
        }
      }
      return {
        Literal(node) {
          if (typeof node.value === 'string') check(node, node.value)
        },
        TemplateElement(node) {
          check(node, node.value.raw)
        },
        'Program:exit'() {
          for (const comment of sourceCode.getAllComments()) {
            check(comment, comment.value)
          }
        },
      }
    },
  ),

  'no-mock-business-code': toRule(
    {
      type: 'problem',
      docs: {
        description:
          '业务代码禁止使用 mock/stub 测试替身（vi.mock、mockReturnValue 等），测试文件豁免',
      },
      messages: {
        mock: '业务代码禁止使用 mock/stub 测试替身调用 "{{name}}"，请以完整实现替代',
      },
      schema: [],
    },
    (context) => {
      if (isTestFile(context.filename)) return {}
      const reportCall = (node) => {
        const callee = node.callee
        let name = ''
        if (callee.type === 'MemberExpression') {
          const obj = callee.object
          const prop = callee.property
          if (
            prop.type === 'Identifier' &&
            /^(mock|mockReturnValue|mockResolvedValue|mockRejectedValue|mockImplementation|mockImplementationOnce|mockResolvedValueOnce|mockRejectedValueOnce|mockReturnValueOnce)$/.test(
              prop.name,
            )
          ) {
            name = `${obj.type === 'MemberExpression' ? obj.property.name : obj.name}.${prop.name}`
          }
        } else if (callee.type === 'Identifier' && callee.name) {
          name = callee.name
        }
        if (!name) return
        if (name.startsWith('vi.mock') || name.startsWith('jest.mock')) {
          context.report({ node, messageId: 'mock', data: { name } })
          return
        }
        if (/^(mock|createMock|setupMockServer|mockFn)$/.test(name)) {
          context.report({ node, messageId: 'mock', data: { name } })
        }
      }
      return {
        CallExpression: reportCall,
      }
    },
  ),

  'no-hardcoded-secrets': toRule(
    {
      type: 'problem',
      docs: {
        description:
          '禁止在业务代码中硬编码密钥形态字面量（OpenAI/AWS/GitHub/Slack/Google 密钥等），测试文件豁免',
      },
      messages: {
        secret: '疑似硬编码密钥 "{{value}}"，密钥必须来自环境变量或配置，禁止写入源码',
      },
      schema: [],
    },
    (context) => {
      if (isTestFile(context.filename)) return {}
      const check = (node, value) => {
        if (typeof value !== 'string' || value.length < 8) return
        for (const pattern of SECRET_LITERAL_PATTERNS) {
          if (pattern.test(value)) {
            context.report({
              node,
              messageId: 'secret',
              data: { value: value.slice(0, 24) },
            })
            return
          }
        }
        if (SECRET_ASSIGN_PATTERN.test(value)) {
          context.report({
            node,
            messageId: 'secret',
            data: { value: value.slice(0, 40) },
          })
        }
      }
      return {
        Literal(node) {
          if (typeof node.value === 'string') check(node, node.value)
        },
        TemplateElement(node) {
          check(node, node.value.raw)
        },
      }
    },
  ),
}
