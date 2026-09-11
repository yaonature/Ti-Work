import { beforeEach, describe, expect, it } from 'vitest'

import type { LedgerToolEvent } from '@/components/run-ledger/run-ledger-store'
import {
  classifyTool,
  deriveRunTitle,
  extractFilePath,
  extractSubject,
  useRunLedgerStore,
} from '@/components/run-ledger/run-ledger-store'

// 执行账本数据层（Run Ledger Store）回归测试 —— B1 首期 + B2 产物直通。
// grounding：store 为纯前端运行视图模型，消费 send-stream 链路的 tool 事件按
// sessionKey 收账最近一次 Run；本测试直接驱动 store 动作，断言开合/节点收敛/
// 终态/语义翻译与迟到事件隔离等账本核心不变量。
// B2 增量：artifact 归类 write、extractFilePath 路径提取、节点三态收敛保留 filePath。

beforeEach(() => {
  useRunLedgerStore.setState({ runs: {} })
})

function tool(
  phase: string,
  name: string,
  extra?: Partial<LedgerToolEvent>,
): LedgerToolEvent {
  return { phase, name, ...extra }
}

describe('deriveRunTitle 任务标题语义', () => {
  it('取首行并剥离 markdown 前缀/强调符号', () => {
    expect(deriveRunTitle('# 把发票整理成表格')).toBe('把发票整理成表格')
    expect(deriveRunTitle('**生成季度报表**\n第二行内容')).toBe('生成季度报表')
  })

  it('空内容回退为「任务执行」，超长标题截断到 48 字', () => {
    expect(deriveRunTitle('  ')).toBe('任务执行')
    expect(deriveRunTitle('好'.repeat(100))).toHaveLength(48)
  })
})

describe('classifyTool 业务归类', () => {
  it('识别检索 / 读取 / 写入 / 修改 / 浏览器 / 命令 / 记忆类工具', () => {
    expect(classifyTool('web_search')).toBe('search')
    expect(classifyTool('read_file')).toBe('read')
    expect(classifyTool('search_files')).toBe('read')
    expect(classifyTool('write_file')).toBe('write')
    expect(classifyTool('apply_patch')).toBe('edit')
    expect(classifyTool('browser_navigate')).toBe('browser')
    expect(classifyTool('run_command')).toBe('command')
    expect(classifyTool('save_memory')).toBe('memory')
  })

  it('未知工具归类为 other', () => {
    expect(classifyTool('custom_something')).toBe('other')
  })

  it('产物（artifact）事件按「生成文件」语义归类为 write（B2）', () => {
    expect(classifyTool('artifact')).toBe('write')
    expect(classifyTool('artifact_created')).toBe('write')
  })
})

describe('extractFilePath 产物路径提取（B2）', () => {
  it('read/write/edit 类动作提取含分隔符或扩展名的真实完整路径', () => {
    expect(
      extractFilePath({ path: 'D:\\docs\\报价单.xlsx' }, 'write'),
    ).toBe('D:\\docs\\报价单.xlsx')
    expect(extractFilePath({ file_path: '/tmp/合同.docx' }, 'read')).toBe(
      '/tmp/合同.docx',
    )
    expect(extractFilePath({ filename: 'report.md' }, 'write')).toBe(
      'report.md',
    )
  })

  it('非文件类动作、无路径字段或纯描述文本均返回 undefined', () => {
    expect(extractFilePath({ query: '行业报告' }, 'search')).toBeUndefined()
    expect(
      extractFilePath({ path: '这只是一段描述，不该被当作文件' }, 'write'),
    ).toBeUndefined()
    expect(extractFilePath({}, 'read')).toBeUndefined()
    expect(extractFilePath('not-object', 'write')).toBeUndefined()
  })
})

describe('extractSubject 业务主体提取', () => {
  it('文件类取文件名（不含长路径）', () => {
    expect(
      extractSubject(
        { path: 'D:\\docs\\报价单.xlsx' },
        'write',
      ),
    ).toBe('报价单.xlsx')
    expect(extractSubject({ file_path: '/tmp/合同.docx' }, 'read')).toBe(
      '合同.docx',
    )
  })

  it('检索类取检索词，并截断超长主体', () => {
    expect(extractSubject({ query: '  2026 行业趋势  ' }, 'search')).toBe(
      '2026 行业趋势',
    )
    expect(extractSubject({ query: 'x'.repeat(80) }, 'search')).toHaveLength(48)
  })
})

describe('openRun / attachRunId 开合语义', () => {
  it('发送受理即开启 active Run，标题落账', () => {
    useRunLedgerStore.getState().openRun('sess-1', { title: '整理发票' })
    const run = useRunLedgerStore.getState().runs['sess-1']
    expect(run?.status).toBe('active')
    expect(run?.title).toBe('整理发票')
    expect(run?.nodes).toEqual([])
  })

  it('同会话再次发送：新 Run 顶替旧 Run，节点清空', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务一' })
    store.appendTool('sess-1', tool('start', 'web_search'))
    store.openRun('sess-1', { title: '任务二' })
    const run = useRunLedgerStore.getState().runs['sess-1']
    expect(run?.title).toBe('任务二')
    expect(run?.nodes).toHaveLength(0)
  })

  it('attachRunId 补挂 runId，且对非 active Run 不生效', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.attachRunId('sess-1', 'run-abc')
    expect(useRunLedgerStore.getState().runs['sess-1']?.runId).toBe('run-abc')

    store.completeRun('sess-1')
    store.attachRunId('sess-1', 'run-xyz')
    expect(useRunLedgerStore.getState().runs['sess-1']?.runId).toBe('run-abc')
  })
})

describe('appendTool 节点收敛', () => {
  it('start 生成 running 节点，语义文案为「正在…」', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool('sess-1', tool('start', 'web_search', { args: { query: '行业报告' } }))
    const node = useRunLedgerStore.getState().runs['sess-1']?.nodes[0]
    expect(node?.status).toBe('running')
    expect(node?.label).toBe('正在检索资料')
    expect(node?.subject).toBe('行业报告')
  })

  it('同一 toolCallId 的 complete 收敛为同一条 success，不产生重复', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool(
      'sess-1',
      tool('start', 'write_file', {
        toolCallId: 'tc-1',
        args: { path: '/tmp/报价单.xlsx' },
      }),
    )
    store.appendTool(
      'sess-1',
      tool('complete', 'write_file', {
        toolCallId: 'tc-1',
        result: '文件已写入',
      }),
    )
    const run = useRunLedgerStore.getState().runs['sess-1']
    expect(run?.nodes).toHaveLength(1)
    expect(run?.nodes[0].status).toBe('success')
    expect(run?.nodes[0].label).toBe('文件已生成')
    expect(run?.nodes[0].summary).toBe('文件已写入')
  })

  it('error 相位将节点标记为失败', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool(
      'sess-1',
      tool('error', 'read_file', { toolCallId: 'tc-2', result: '找不到文件' }),
    )
    const node = useRunLedgerStore.getState().runs['sess-1']?.nodes[0]
    expect(node?.status).toBe('error')
    expect(node?.label).toBe('读取文件失败')
  })

  it('旧 Run 的迟到事件（runId 不一致）被丢弃', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.attachRunId('sess-1', 'run-new')
    store.appendTool(
      'sess-1',
      tool('complete', 'write_file', { runId: 'run-old', toolCallId: 'tc-x' }),
    )
    expect(useRunLedgerStore.getState().runs['sess-1']?.nodes).toHaveLength(0)
  })

  it('无进行中 Run 时的事件被忽略（事件晚于终态 / 会话已切走）', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.completeRun('sess-1')
    store.appendTool('sess-1', tool('start', 'web_search'))
    expect(useRunLedgerStore.getState().runs['sess-1']?.nodes).toHaveLength(0)
  })

  it('summary 截断到 240 字', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool(
      'sess-1',
      tool('complete', 'web_search', { result: 'y'.repeat(500) }),
    )
    const node = useRunLedgerStore.getState().runs['sess-1']?.nodes[0]
    expect(node?.summary?.length).toBeLessThanOrEqual(240)
  })

  it('文件类节点保留 filePath，三态收敛不丢失，供「打开预览」直通（B2）', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool(
      'sess-1',
      tool('start', 'write_file', {
        toolCallId: 'tc-file',
        args: { path: '/workspace/报价单.xlsx' },
      }),
    )
    // complete 事件不带 args（无路径）也不会冲掉已保留的 filePath
    store.appendTool(
      'sess-1',
      tool('complete', 'write_file', {
        toolCallId: 'tc-file',
        result: '文件已写入',
      }),
    )
    const node = useRunLedgerStore.getState().runs['sess-1']?.nodes[0]
    expect(node?.filePath).toBe('/workspace/报价单.xlsx')
    expect(node?.subject).toBe('报价单.xlsx')
    expect(node?.status).toBe('success')
  })

  it('artifact 产物事件收账为文件语义节点并携带路径（B2）', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool(
      'sess-1',
      tool('complete', 'artifact', {
        toolCallId: 'tc-art',
        args: { path: '/workspace/report.md' },
        result: '报告已生成',
      }),
    )
    const node = useRunLedgerStore.getState().runs['sess-1']?.nodes[0]
    expect(node?.kind).toBe('write')
    expect(node?.label).toBe('文件已生成')
    expect(node?.filePath).toBe('/workspace/report.md')
    expect(node?.subject).toBe('report.md')
  })
})

describe('终态转换', () => {
  it('completeRun：状态落定为 complete 并写入 completedAt，运行中节点统一收敛成功', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.appendTool('sess-1', tool('start', 'web_search'))
    const before = useRunLedgerStore.getState().runs['sess-1']?.nodes[0]
    expect(before?.status).toBe('running')

    store.completeRun('sess-1')
    const run = useRunLedgerStore.getState().runs['sess-1']
    expect(run?.status).toBe('complete')
    expect(run?.completedAt).toBeTypeOf('number')
    expect(run?.nodes[0].status).toBe('success')
  })

  it('failRun：记录失败原因；二次失败/完成信号不覆盖已落定的终态', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务' })
    store.failRun('sess-1', '网关超时')
    let run = useRunLedgerStore.getState().runs['sess-1']
    expect(run?.status).toBe('error')
    expect(run?.errorMessage).toBe('网关超时')

    // 迟到/重复的终态信号幂等，不会改动已完成 Run
    store.failRun('sess-1', '第二次失败')
    store.completeRun('sess-1')
    run = useRunLedgerStore.getState().runs['sess-1']
    expect(run?.status).toBe('error')
    expect(run?.errorMessage).toBe('网关超时')
  })

  it('不同会话互不影响（按 sessionKey 隔离收账）', () => {
    const store = useRunLedgerStore.getState()
    store.openRun('sess-1', { title: '任务一' })
    store.openRun('sess-2', { title: '任务二' })
    store.completeRun('sess-1')
    expect(useRunLedgerStore.getState().runs['sess-1']?.status).toBe('complete')
    expect(useRunLedgerStore.getState().runs['sess-2']?.status).toBe('active')
  })
})
