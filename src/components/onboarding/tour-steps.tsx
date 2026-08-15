import type { Step } from 'react-joyride'

export const tourSteps: Array<Step> = [
  // Step 1: Welcome
  {
    target: 'body',
    placement: 'center',
    title: '欢迎使用 Ti Work',
    content: (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <img
          src="/ti-work-logo.svg"
          alt="Ti Work"
          style={{ width: 48, height: 48, borderRadius: 12 }}
        />
        <p style={{ textAlign: 'center', margin: 0 }}>
          这里是你的 AI 工作中枢，用来统一管理智能体、会话、文件与协作流程。我们先快速看一圈。
        </p>
      </div>
    ),
    disableBeacon: true,
  },
  // Step 2: Sidebar
  {
    target: '[data-tour="sidebar-container"]',
    placement: 'right',
    title: '侧栏导航',
    content:
      '你可以在这里切换所有主要功能区，也可以折叠或展开分组，按自己的工作方式组织空间。',
  },
  // Step 3: New Session
  {
    target: '[data-tour="new-session"]',
    placement: 'right',
    title: '发起新会话',
    content:
      '点击这里即可创建新的 AI 会话。每段对话都会自动保存，方便后续继续跟进。',
  },
  // Step 4: Dashboard
  {
    target: '[data-tour="dashboard"]',
    placement: 'right',
    title: '工作总览',
    content:
      '这里会展示会话、用量和近期活动，帮助你快速掌握整体工作状态。',
  },
  // Step 5: Agent Hub
  {
    target: '[data-tour="agent-hub"]',
    placement: 'right',
    title: '智能体中心',
    content:
      '在这里管理智能体及其配置，也可以创建具备专门职责和行为的自定义智能体。',
  },
  // Step 7: Skills
  {
    target: '[data-tour="skills"]',
    placement: 'right',
    title: '技能库',
    content:
      '浏览并安装技能来扩展智能体能力，为你的工作流补充更多工具和动作。',
  },
  // Step 8: Terminal
  {
    target: '[data-tour="terminal"]',
    placement: 'right',
    title: '内置终端',
    content:
      '你可以直接在应用内执行命令，无需离开 Ti Work 就能完成终端操作。',
  },
  // Step 9: Usage Meter (in header)
  {
    target: '[data-tour="usage-meter"]',
    placement: 'bottom',
    title: '用量监控',
    content:
      '实时查看模型调用与资源消耗，及时掌握成本和 API 使用情况。',
  },
  // Step 10: Settings
  {
    target: '[data-tour="settings"]',
    placement: 'right',
    title: '设置与个性化',
    content:
      '在这里配置模型提供方、主题、强调色等内容，把 Ti Work 调整成你习惯的样子。',
  },
  // Step 11: Finish
  {
    target: 'body',
    placement: 'center',
    title: '准备就绪',
    content:
      '现在你已经可以开始对话、探索各项工具，并按自己的流程进一步定制 Ti Work。需要帮助时，按 `?` 可查看快捷键说明。',
  },
]
