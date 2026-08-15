import { EmojiIcon } from '@/components/emoji-icon'

export function DocsScreen() {
  const sectionStyle = { borderBottom: '1px solid var(--theme-border-subtle)', paddingBottom: '2rem', marginBottom: '2rem' }
  const h2Style = { color: 'var(--theme-text)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem', marginTop: '0.5rem' }
  const h3Style = { color: 'var(--theme-text)', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', marginTop: '1.5rem' }
  const h4Style = { color: 'var(--theme-text)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1.25rem' }
  const pStyle = { color: 'var(--theme-muted)', lineHeight: 1.7, marginBottom: '0.75rem' }
  const ulStyle = { color: 'var(--theme-muted)', lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '1rem' }
  const olStyle = { color: 'var(--theme-muted)', lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '1rem' }
  const codeStyle = {
    background: 'var(--theme-card2)',
    border: '1px solid var(--theme-border)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.85rem',
    color: 'var(--theme-accent)',
  }
  const preStyle = {
    background: 'var(--theme-card)',
    border: '1px solid var(--theme-border)',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.8rem',
    color: 'var(--theme-muted)',
    overflowX: 'auto' as const,
    marginBottom: '1rem',
    lineHeight: 1.6,
  }
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '1.5rem',
  }
  const thStyle = {
    textAlign: 'left' as const,
    padding: '0.5rem 0.75rem',
    borderBottom: '2px solid var(--theme-border)',
    color: 'var(--theme-text)',
    fontWeight: 600,
    fontSize: '0.85rem',
  }
  const tdStyle = {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--theme-border-subtle)',
    color: 'var(--theme-muted)',
    fontSize: '0.85rem',
    verticalAlign: 'top' as const,
  }
  const tdCodeStyle = {
    ...tdStyle,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.8rem',
    color: 'var(--theme-accent)',
  }
  const tocLinkStyle = {
    color: 'var(--theme-accent)',
    textDecoration: 'none',
    lineHeight: 2,
  }
  const noteStyle = {
    background: 'var(--theme-card)',
    border: '1px solid var(--theme-border)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    color: 'var(--theme-muted)',
    fontSize: '0.9rem',
  }
  const warningStyle = {
    background: 'var(--theme-accent-subtle)',
    border: '1px solid var(--theme-accent-border)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    color: 'var(--theme-accent)',
    fontSize: '0.9rem',
  }
  const dlStyle = { marginBottom: '1rem' }
  const dtStyle = { color: 'var(--theme-text)', fontWeight: 600, marginTop: '0.75rem', fontSize: '0.9rem' }
  const ddStyle = { color: 'var(--theme-muted)', marginLeft: '1.5rem', marginBottom: '0.25rem', fontSize: '0.85rem', lineHeight: 1.6 }

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: 'var(--theme-bg)' }}>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 style={{ color: 'var(--theme-text)', fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Ti Work 系统文档
        </h1>
        <p style={{ color: 'var(--theme-muted)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
          版本 1.20.0 — 涵盖架构、API、配置与高级用法的完整技术参考。
        </p>

        
        <nav style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)', borderRadius: '12px', padding: '1.5rem 2rem', marginBottom: '3rem' }}>
          <h2 style={{ color: 'var(--theme-text)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>目录</h2>
          <ol style={{ ...olStyle, columns: 2, columnGap: '2rem' }}>
            <li><a href="#overview" style={tocLinkStyle}>概述</a></li>
            <li><a href="#screens-reference" style={tocLinkStyle}>界面参考</a></li>
            <li><a href="#chat-system" style={tocLinkStyle}>会话系统</a></li>
            <li><a href="#multi-agent" style={tocLinkStyle}>多智能体编排</a></li>
            <li><a href="#task-management" style={tocLinkStyle}>任务管理</a></li>
            <li><a href="#cron-jobs" style={tocLinkStyle}>定时任务管理</a></li>
            <li><a href="#knowledge-system" style={tocLinkStyle}>知识系统</a></li>
            <li><a href="#skills-ecosystem" style={tocLinkStyle}>技能生态</a></li>
            <li><a href="#agent-library" style={tocLinkStyle}>智能体库</a></li>
            <li><a href="#files-terminal" style={tocLinkStyle}>文件管理与终端</a></li>
            <li><a href="#analytics-observability" style={tocLinkStyle}>数据分析与可观测性</a></li>
            <li><a href="#api-reference" style={tocLinkStyle}>API 参考</a></li>
            <li><a href="#configuration" style={tocLinkStyle}>配置参考</a></li>
            <li><a href="#design-system" style={tocLinkStyle}>设计系统</a></li>
            <li><a href="#gateway-integration" style={tocLinkStyle}>网关集成</a></li>
            <li><a href="#security" style={tocLinkStyle}>安全</a></li>
            <li><a href="#keyboard-shortcuts" style={tocLinkStyle}>键盘快捷键</a></li>
          </ol>
        </nav>

        
        <section id="overview" style={sectionStyle}>
          <h2 style={h2Style}>1. 概述</h2>

          <h3 style={h3Style}>什么是 Ti Work</h3>
          <p style={pStyle}>
            Ti Work 是一个功能完备的 Web 控制台，用于管理、监控和编排运行在 Hermes 网关上的 AI 智能体。它提供了丰富的图形界面，涵盖会话、多智能体协同、任务跟踪、记忆管理、技能安装、定时任务调度和系统可观测性。该应用被设计为单页渐进式 Web 应用，通过 HTTP 与 Server-Sent Events (SSE) 连接到一个或多个 Hermes 网关实例。
          </p>

          <h3 style={h3Style}>架构</h3>
          <p style={pStyle}>
            Ti Work 构建在现代全栈 TypeScript 架构之上：
          </p>
          <ul style={ulStyle}>
            <li><strong>前端：</strong>React 19 + TypeScript，以 SPA 方式在客户端渲染。</li>
            <li><strong>路由：</strong>TanStack Router（基于文件的路由生成），带类型安全的路径参数和查询参数。</li>
            <li><strong>数据获取：</strong>TanStack Query 用于服务端状态管理，支持自动缓存、重新获取和乐观更新。</li>
            <li><strong>构建系统：</strong>Vite 配合 TanStack Start，支持 SSR 打包、HMR 和生产构建。</li>
            <li><strong>服务端层：</strong>TanStack Start 服务端函数处理 API 路由。服务进程作为 Node.js HTTP 服务器运行，代理请求至 Hermes 网关。</li>
            <li><strong>状态管理：</strong>Zustand 配合 persist 中间件管理客户端设置。React 状态与 TanStack Query 管理临时/服务端状态。</li>
            <li><strong>样式：</strong>Tailwind CSS 4 配合自定义 CSS 变量主题层。所有颜色均通过 <code style={codeStyle}>var(--theme-*)</code> 令牌感知主题。</li>
          </ul>

          <h3 style={h3Style}>网关连接模型</h3>
          <p style={pStyle}>
            Ti Work 不直接与 LLM 服务提供方通信。相反，它连接到一个 Hermes 网关服务器，由该网关管理智能体会话、工具执行、记忆和服务提供方路由。连接模型如下：
          </p>
          <ol style={olStyle}>
            <li>启动时，Studio 服务器探测配置的网关 URL 以检测可用能力。</li>
            <li>能力被归类为<strong>核心</strong>（健康检查、会话补全、模型、流式）或<strong>增强</strong>（会话、技能、记忆、配置、定时任务）。</li>
            <li>如果检测到增强能力，Studio 以完整功能模式运行，包含会话管理、工具和审批工作流。</li>
            <li>如果仅具备核心能力，Studio 将优雅降级为基本会话界面。</li>
            <li>能力探测结果缓存 120 秒并自动刷新。</li>
          </ol>

          <h3 style={h3Style}>功能矩阵</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>功能</th>
                <th style={thStyle}>核心模式</th>
                <th style={thStyle}>增强模式</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>流式会话</td><td style={tdStyle}>是</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>会话管理</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>工具执行与审批</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>多智能体团队</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>Conductor 编排</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>定时任务</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>记忆与知识</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>技能安装</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>文件浏览器</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>终端</td><td style={tdStyle}>否</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>数据分析</td><td style={tdStyle}>部分</td><td style={tdStyle}>是</td></tr>
              <tr><td style={tdStyle}>模型选择</td><td style={tdStyle}>是</td><td style={tdStyle}>是</td></tr>
            </tbody>
          </table>
        </section>

        
        <section id="screens-reference" style={sectionStyle}>
          <h2 style={h2Style}>2. 界面参考</h2>
          <p style={pStyle}>
            Ti Work 包含 18 个独立界面，均可通过侧边栏导航或键盘快捷键访问。以下是每个界面的参考说明。
          </p>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>界面</th>
                <th style={thStyle}>路由</th>
                <th style={thStyle}>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><strong>仪表盘</strong></td>
                <td style={tdCodeStyle}>/dashboard</td>
                <td style={tdStyle}>系统总览，包含活动会话数、Token 用量迷你趋势图、网关连接状态、最近活动流以及常用操作的快速启动卡片。实时展示过去 24 小时的上下文使用面积图。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>会话</strong></td>
                <td style={tdCodeStyle}>/chat/:sessionKey</td>
                <td style={tdStyle}>主要会话界面。包含会话侧边栏、流式消息展示、审批卡片、附件处理、检查器面板、上下文计量器以及多模型选择。同时支持增强型 Hermes 会话和便携式会话补全。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>文件</strong></td>
                <td style={tdCodeStyle}>/files</td>
                <td style={tdStyle}>基于配置档案作用域的文件浏览器，提供树形导航、集成 Monaco 编辑器（支持语法高亮查看与编辑）、搜索，以及可配置的字体大小、自动换行和小地图设置。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>终端</strong></td>
                <td style={tdCodeStyle}>/terminal</td>
                <td style={tdStyle}>基于 Xterm.js 的集成 PTY 终端。支持持久化终端会话、窗口尺寸调整事件、ANSI 颜色渲染和剪贴板集成。会话在页面刷新后仍然保留。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>定时任务</strong></td>
                <td style={tdCodeStyle}>/jobs</td>
                <td style={tdStyle}>定时任务管理，包含创建向导、调度预设、投递渠道配置、通过 SSE 的实时运行流、运行历史以及任务生命周期控制（暂停、恢复、删除、立即运行）。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>多智能体团队</strong></td>
                <td style={tdCodeStyle}>/crews</td>
                <td style={tdStyle}>多智能体团队管理。可从模板或空白创建团队，为成员配置人设和模型，构建 DAG 工作流，派发任务，跟踪 Token 成本，并克隆团队（附带全新会话）。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>团队详情</strong></td>
                <td style={tdCodeStyle}>/crews/:crewId</td>
                <td style={tdStyle}>单个团队的管理界面，包含成员名册、工作流 DAG 编辑器、派发对话框、按成员统计 Token 消耗的成本面板以及团队设置。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>调度台</strong></td>
                <td style={tdCodeStyle}>/conductor</td>
                <td style={tdStyle}>任务编排系统。输入高层目标，观察自动任务分解，在办公视图（网格、圆桌或战情室布局）中监控工作智能体，跟踪成本，并查看已完成任务输出。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>运维总览</strong></td>
                <td style={tdCodeStyle}>/operations</td>
                <td style={tdStyle}>实时运维总览，以网格布局展示所有活动的智能体会话，包含状态指示器、最近活动时间戳和输出预览。适用于监控多智能体工作负载。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>任务</strong></td>
                <td style={tdCodeStyle}>/tasks</td>
                <td style={tdStyle}>看板式任务面板，包含五列（积压、待办、进行中、评审、完成）。支持拖放、优先级级别、标签、经办人关联和来源 URL 引用。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>智能体</strong></td>
                <td style={tdCodeStyle}>/agents</td>
                <td style={tdStyle}>智能体人设库，包含内置和自定义智能体。可创建带表情头像、强调色、系统提示词、模型覆盖和专业标签的智能体。智能体可与团队和调度台集成。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>模式与纠正</strong></td>
                <td style={tdCodeStyle}>/patterns</td>
                <td style={tdStyle}>模式与纠正系统，用于管理可复用的提示词模式、行为纠正和跨会话持续的智能体准则。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>数据分析</strong></td>
                <td style={tdCodeStyle}>/analytics</td>
                <td style={tdStyle}>事件分析，提供 14 天堆叠柱状图，展示工具使用频率、消息量和会话活动。包含服务提供方用量细分和上下文窗口利用率图表。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>会话历史</strong></td>
                <td style={tdCodeStyle}>/session-history</td>
                <td style={tdStyle}>双栏归档界面，用于浏览过去的会话。左栏展示带元数据的会话列表；右栏按需加载完整消息线程，支持搜索和过滤。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>审计日志</strong></td>
                <td style={tdCodeStyle}>/audit</td>
                <td style={tdStyle}>按事件类型、会话和日期范围过滤的时序事件日志。记录所有重要系统事件，包括审批、工具执行、会话生命周期变更和配置修改。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>日志</strong></td>
                <td style={tdCodeStyle}>/logs</td>
                <td style={tdStyle}>网关日志查看器，展示最近 500 行系统日志，按严重级别（调试、信息、警告、错误）着色。支持自动滚动和手动暂停。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>记忆</strong></td>
                <td style={tdCodeStyle}>/memory</td>
                <td style={tdStyle}>记忆浏览器，用于查看和编辑身份文件（SOUL.md、persona.md、CLAUDE.md），以及带力导向布局和 wikilink 检测的知识图谱可视化。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>技能</strong></td>
                <td style={tdCodeStyle}>/skills</td>
                <td style={tdStyle}>技能注册表浏览器，提供来自 skillsmp.com 的 2000+ 技能。可安装、卸载、启用/禁用技能，查看文档，并在技能中心搜索新能力。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>配置档案</strong></td>
                <td style={tdCodeStyle}>/profiles</td>
                <td style={tdStyle}>用于在不同网关配置之间切换的配置档案管理。可创建、重命名、激活和删除档案。每个档案维护独立的设置、记忆文件和技能安装。</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>设置</strong></td>
                <td style={tdCodeStyle}>/settings</td>
                <td style={tdStyle}>应用配置，包括网关连接、外观（主题、强调色）、编辑器偏好（字体大小、自动换行、小地图）、通知设置、模型偏好和 MCP 服务器配置。</td>
              </tr>
            </tbody>
          </table>
        </section>

        
        <section id="chat-system" style={sectionStyle}>
          <h2 style={h2Style}>3. 会话系统</h2>

          <h3 style={h3Style}>会话管理</h3>
          <p style={pStyle}>
            Ti Work 中的每段对话都存在于一个会话中。会话是服务器管理的实体，在 Hermes 网关上创建。每个会话维护自己的上下文窗口、消息历史、工具权限和记忆状态。
          </p>
          <ul style={ulStyle}>
            <li><strong>创建：</strong>会话通过 <code style={codeStyle}>POST /api/sessions</code> 创建，由网关代理执行。每个会话获得一个唯一键（UUID 格式）。</li>
            <li><strong>切换：</strong>会话侧边栏显示所有活动会话。点击会话会触发路由切换到 <code style={codeStyle}>/chat/:sessionKey</code> 并加载消息历史。</li>
            <li><strong>删除：</strong>会话可以从侧边栏上下文菜单中删除。这会从网关移除该会话并清除关联的消息历史。</li>
            <li><strong>重命名：</strong>会话可以重命名以便于识别。名称作为元数据存储在网关会话对象上。</li>
            <li><strong>状态轮询：</strong>会话界面轮询 <code style={codeStyle}>GET /api/sessions/:sessionKey/status</code> 以检测智能体状态变化（空闲、活跃、等待输入）。</li>
          </ul>

          <h3 style={h3Style}>SSE 流式架构</h3>
          <p style={pStyle}>
            消息流式传输使用 Server-Sent Events (SSE) 实时投递智能体响应。架构如下：
          </p>
          <ol style={olStyle}>
            <li>用户通过 <code style={codeStyle}>POST /api/sessions/send</code> 发送消息，请求分派到网关。</li>
            <li>客户端以会话键作为查询参数，打开到 <code style={codeStyle}>GET /api/chat-events</code> 的 SSE 连接。</li>
            <li>服务器代理来自 Hermes 网关的 SSE 事件，逐 Token 转发流式数据。</li>
            <li>事件包括：<code style={codeStyle}>message_start</code>、<code style={codeStyle}>content_delta</code>、<code style={codeStyle}>content_end</code>、<code style={codeStyle}>tool_use</code>、<code style={codeStyle}>tool_result</code>、<code style={codeStyle}>approval_required</code>、<code style={codeStyle}>error</code>。</li>
            <li>客户端将增量累积为完整消息，逐步更新 React 状态以实现流畅渲染。</li>
            <li>流结束后（自然结束或通过中止），客户端与网关的完整消息历史进行对账。</li>
          </ol>

          <h3 style={h3Style}>消息持久化</h3>
          <p style={pStyle}>
            消息由 Hermes 网关使用分层存储策略持久化：
          </p>
          <ul style={ulStyle}>
            <li><strong>主存储（Redis）：</strong>配置 <code style={codeStyle}>REDIS_URL</code> 后，消息存储在以会话为键的 Redis 有序集合中。这提供了快速检索并支持基于 TTL 的过期。</li>
            <li><strong>回退（文件）：</strong>当 Redis 不可用时，消息回退到基于文件的存储，以每个会话一个 JSON 文件的形式存放在 <code style={codeStyle}>.runtime/</code> 目录中。</li>
            <li><strong>会话令牌：</strong>认证令牌持久化在 Redis SET（<code style={codeStyle}>hermes:studio:tokens</code>）中，TTL 为 30 天，回退到内存存储。</li>
          </ul>

          <h3 style={h3Style}>审批工作流</h3>
          <p style={pStyle}>
            当智能体尝试特权操作（文件写入、命令执行、网络访问）时，网关发出 <code style={codeStyle}>approval_required</code> 事件。Studio 界面渲染审批卡片，提供三种解决选项：
          </p>
          <ul style={ulStyle}>
            <li><strong>批准（单次）：</strong>允许特定操作实例。作用域：仅限此单次调用。</li>
            <li><strong>拒绝：</strong>拒绝该操作。智能体会收到拒绝信号，并可能提出替代方案。</li>
            <li><strong>始终允许：</strong>为此操作模式授予永久权限。有三种作用域可选：
              <ul style={ulStyle}>
                <li><strong>单次</strong> — 允许此确切操作一次。</li>
                <li><strong>会话</strong> — 在当前会话的剩余时间内允许此操作类型。</li>
                <li><strong>始终</strong> — 跨所有会话永久允许此操作类型。</li>
              </ul>
            </li>
          </ul>
          <p style={pStyle}>
            审批通过 <code style={codeStyle}>POST /api/approvals/:approvalId/approve</code> 或 <code style={codeStyle}>POST /api/approvals/:approvalId/deny</code> 解决。审批卡片显示操作名称、智能体身份以及可展开的上下文（显示完整参数）。
          </p>

          <h3 style={h3Style}>检查器面板</h3>
          <p style={pStyle}>
            会话检查器面板提供当前会话状态的诊断可见性。它显示活动工具调用、待处理审批、Token 用量细分（输入/输出/缓存）、以百分比计量器呈现的上下文窗口利用率，以及用于调试的原始事件流。上下文条以颜色阈值实时展示消耗情况（低于 60% 绿色，60-85% 琥珀色，高于 85% 红色）。
          </p>

          <h3 style={h3Style}>附件处理</h3>
          <p style={pStyle}>
            会话输入框支持文件附件。文件会上传并转换为适合 LLM 的格式（图片成为 base64 编码的视觉输入，文本文件成为内联内容块）。研究卡片组件以可折叠区块和来源引用的形式展示结构化研究输出。
          </p>
        </section>

        
        <section id="multi-agent" style={sectionStyle}>
          <h2 style={h2Style}>4. 多智能体编排</h2>

          <h3 style={h3Style}>4a. 多智能体团队</h3>

          <h4 style={h4Style}>团队生命周期</h4>
          <p style={pStyle}>
            多智能体团队遵循从创建到执行的定义生命周期：
          </p>
          <ol style={olStyle}>
            <li><strong>创建：</strong>通过创建对话框或从模板库中选择模板来定义团队。设置名称、描述和初始成员名册。</li>
            <li><strong>配置：</strong>为每位成员分配人设、模型和系统提示词。可选构建定义执行顺序和依赖关系的工作流 DAG。</li>
            <li><strong>派发：</strong>通过派发对话框让团队执行任务。提供目标提示词，选择执行策略（并行、串行或 DAG 排序），然后确认。</li>
            <li><strong>监控：</strong>实时跟踪进度。每位成员的会话状态、输出和 Token 用量实时更新。成本面板显示每位成员和总花费。</li>
          </ol>

          <h4 style={h4Style}>成员管理</h4>
          <p style={pStyle}>
            每位团队成员代表一个带特定配置的智能体会话：
          </p>
          <ul style={ulStyle}>
            <li><strong>人设：</strong>从智能体库中选择（内置或自定义）。决定系统提示词、头像和专业标签。</li>
            <li><strong>模型：</strong>按成员覆盖默认模型。适用于将更便宜的模型分配给简单任务，将高级模型分配给复杂推理。</li>
            <li><strong>会话：</strong>每位成员获得一个专用网关会话，跨派发持续存在。会话可以重置或重新铸造。</li>
          </ul>

          <h4 style={h4Style}>模板系统</h4>
          <p style={pStyle}>
            Ti Work 包含 7 个内置团队模板，并支持用户创建的自定义模板。模板按类别划分：
          </p>
          <ul style={ulStyle}>
            <li><strong>研究：</strong>用于调查、分析和报告生成的模板。</li>
            <li><strong>工程：</strong>用于代码审查、架构和实现任务的模板。</li>
            <li><strong>创意：</strong>用于内容创作、头脑风暴和设计的模板。</li>
            <li><strong>运维：</strong>用于部署、监控和维护工作流的模板。</li>
            <li><strong>调度台：</strong>为调度台编排模式优化的模板。</li>
          </ul>
          <p style={pStyle}>
            自定义模板可以从任何现有团队配置创建，并通过 <code style={codeStyle}>POST /api/crews/templates</code> 持久化。用户模板可以删除；内置模板为只读。
          </p>

          <h4 style={h4Style}>工作流构建器</h4>
          <p style={pStyle}>
            工作流构建器是一个可视化 DAG（有向无环图）编辑器，用于定义团队成员之间的执行依赖关系。关键特性：
          </p>
          <ul style={ulStyle}>
            <li>拖放节点放置，自动布局。</li>
            <li>通过点击源节点和目标节点创建边。</li>
            <li>循环检测 — 编辑器阻止创建会形成环的边，确保有效的拓扑顺序。</li>
            <li>并行执行 — 无依赖的节点并发运行。</li>
            <li>工作流状态通过 <code style={codeStyle}>PUT /api/crews/:crewId/workflow</code> 按团队持久化。</li>
          </ul>

          <h4 style={h4Style}>Token 用量跟踪</h4>
          <p style={pStyle}>
            成本面板（<code style={codeStyle}>GET /api/crews/:crewId/usage</code>）提供每位成员的 Token 细分，显示输入 Token、输出 Token、缓存读/写 Token 和估算成本。成本使用约每百万 Token 5 美元的混合费率。
          </p>

          <h4 style={h4Style}>克隆与会话铸造</h4>
          <p style={pStyle}>
            团队可以通过 <code style={codeStyle}>POST /api/crews/:crewId/clone</code> 克隆。克隆会为所有成员创建带全新会话的重复团队，保留工作流 DAG 和配置，但重置所有对话状态。这对于重新运行实验或创建变体很有用。
          </p>

          <h3 style={h3Style}>4b. Conductor V2</h3>

          <h4 style={h4Style}>网关原生架构</h4>
          <p style={pStyle}>
            Conductor V2 系统采用网关原生方法，编排由专用的 Hermes 智能体会话执行，而非客户端逻辑。编排智能体接收任务目标和派发技能，然后自主分解工作并派生工作会话。
          </p>

          <h4 style={h4Style}>任务阶段</h4>
          <p style={pStyle}>
            一次调度台任务按四个阶段推进：
          </p>
          <ol style={olStyle}>
            <li><strong>idle：</strong>没有活动任务。界面显示任务输入表单和历史记录。</li>
            <li><strong>decomposing：</strong>编排智能体正在分析目标并规划任务分配。界面显示思考指示器。</li>
            <li><strong>running：</strong>工作智能体已派生并正在执行任务。办公视图实时显示进度。</li>
            <li><strong>complete：</strong>所有工作智能体已完成。界面显示包含输出、成本和任务时长的摘要。</li>
          </ol>

          <h4 style={h4Style}>派生流程</h4>
          <p style={pStyle}>
            派生序列为：
          </p>
          <ol style={olStyle}>
            <li>客户端发送 <code style={codeStyle}>POST /api/conductor-spawn</code>，包含目标、编排模型、工作模型、项目目录、最大并行数和监督标志。</li>
            <li>服务器从磁盘加载 workspace-dispatch 技能（搜索多个候选路径）。</li>
            <li>构建编排提示词，将目标与派发技能指令结合。</li>
            <li>在网关上创建 Hermes 定时任务，将编排器作为一次性任务运行。</li>
            <li>编排智能体分解目标，并通过派发技能派生工作会话。</li>
            <li>客户端每 3 秒轮询工作会话状态以跟踪进度。</li>
          </ol>

          <h4 style={h4Style}>实时监控</h4>
          <p style={pStyle}>
            在运行阶段，客户端通过以下方式监控工作智能体：
          </p>
          <ul style={ulStyle}>
            <li><strong>3 秒轮询：</strong>以 3 秒间隔获取所有活动工作智能体的会话状态。</li>
            <li><strong>陈旧检测：</strong>在阈值内未报告活动的工作智能体被标记为可能陈旧。</li>
            <li><strong>完成检测：</strong>当所有工作智能体报告空闲/完成状态时，任务转换到完成阶段。</li>
            <li><strong>办公视图：</strong>所有工作智能体的实时可视化，包含状态指示器、当前任务标签和输出预览。</li>
          </ul>

          <h4 style={h4Style}>Conductor 设置</h4>
          <p style={pStyle}>
            设置抽屉提供以下配置：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>编排模型</dt>
            <dd style={ddStyle}>用于任务分解和协调的 LLM 模型。默认为 auto（网关默认）。复杂任务建议使用高级模型（Claude Opus、GPT-4）。</dd>
            <dt style={dtStyle}>工作模型</dt>
            <dd style={ddStyle}>分配给派生工作智能体的 LLM 模型。可以使用更便宜的模型（Claude Sonnet、GPT-4o-mini）以节约成本。</dd>
            <dt style={dtStyle}>项目目录</dt>
            <dd style={ddStyle}>工作智能体输出写入的基础目录。默认为 <code style={codeStyle}>/tmp</code>。设置为您的工作区根目录可获得持久输出。</dd>
            <dt style={dtStyle}>最大并行数 (1-5)</dt>
            <dd style={ddStyle}>可以并发运行的工作智能体最大数量。更高的值提高吞吐量，但消耗更多资源和 API 配额。</dd>
            <dt style={dtStyle}>监督模式</dt>
            <dd style={ddStyle}>启用后，工作智能体使用工具需要审批。禁用后，工作智能体自主运行。</dd>
          </dl>

          <h4 style={h4Style}>办公视图布局</h4>
          <p style={pStyle}>
            办公视图提供三种可视化布局用于监控工作智能体：
          </p>
          <ul style={ulStyle}>
            <li><strong>网格 (4x3)：</strong>传统网格排列，最多显示 12 张智能体卡片。每张卡片显示智能体头像、名称、状态光晕、当前任务和最后输出行。</li>
            <li><strong>圆桌（环形）：</strong>智能体围绕中央任务摘要环形排列。强调平等参与和跨智能体意识。</li>
            <li><strong>战情室（面对面行）：</strong>两排智能体面对面，模拟协作工作空间。状态条和对话气泡显示实时活动。</li>
          </ul>
          <p style={pStyle}>
            布局偏好持久化在 localStorage 的 <code style={codeStyle}>hermes-studio:office-layout</code> 键下。
          </p>

          <h4 style={h4Style}>智能体头像系统</h4>
          <p style={pStyle}>
            每位调度台工作智能体都被分配一个独特的像素艺术 SVG 机器人头像。系统提供：
          </p>
          <ul style={ulStyle}>
            <li><strong>10 个头像变体：</strong>不同的机器人身体形状，具有不同的头部、身体、手臂和腿部几何形状，以 SVG 像素艺术渲染。</li>
            <li><strong>10 种强调色：</strong>橙色、蓝色、紫色、翠绿、玫瑰、琥珀、青色、品红、青柠、天蓝。每种颜色提供条、边框、头像、文本、光环和十六进制值。</li>
            <li>头像基于智能体索引确定性分配，确保跨会话的视觉身份一致。</li>
          </ul>

          <h4 style={h4Style}>任务历史</h4>
          <p style={pStyle}>
            已完成任务存储在 localStorage 中，最多 50 条。每条历史记录包含目标、开始/结束时间戳、工作智能体数量、总成本和完成状态。主页上的历史面板允许查看过去的任务并重新启动类似目标。
          </p>

          <h4 style={h4Style}>成本跟踪</h4>
          <p style={pStyle}>
            Conductor 使用约每百万 Token 5 美元的混合费率跟踪估算成本。成本跟踪组件在任务执行期间实时显示累积，悬停可查看每位工作智能体的细分。最终成本记录在任务历史条目中。
          </p>
        </section>

        
        <section id="task-management" style={sectionStyle}>
          <h2 style={h2Style}>5. 任务管理</h2>

          <h3 style={h3Style}>看板</h3>
          <p style={pStyle}>
            任务界面实现了五列看板，用于跟踪工作项。任务按以下列从左到右流动：
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>列</th>
                <th style={thStyle}>用途</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}><strong>积压</strong></td><td style={tdStyle}>已记录但尚未排定优先级的想法和未来工作。</td></tr>
              <tr><td style={tdStyle}><strong>待办</strong></td><td style={tdStyle}>已排定优先级、可在下一个周期开始的工作。</td></tr>
              <tr><td style={tdStyle}><strong>进行中</strong></td><td style={tdStyle}>正在由人或智能体处理中。</td></tr>
              <tr><td style={tdStyle}><strong>评审</strong></td><td style={tdStyle}>已完成，等待评审或验证。</td></tr>
              <tr><td style={tdStyle}><strong>完成</strong></td><td style={tdStyle}>已完成并接受的工作。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>任务属性</h3>
          <p style={pStyle}>
            每个任务支持以下属性：
          </p>
          <ul style={ulStyle}>
            <li><strong>标题：</strong>任务的简短描述性名称。</li>
            <li><strong>描述：</strong>所需工作的详细说明（支持 Markdown）。</li>
            <li><strong>优先级：</strong>低、中、高或紧急之一。以彩色徽章显示。</li>
            <li><strong>标签：</strong>用于分类和过滤的任意字符串标签。</li>
            <li><strong>经办人：</strong>关联到智能体人设或人工标识符。</li>
            <li><strong>来源链接：</strong>引用外部资源的 URL（GitHub issue、文档等）。</li>
            <li><strong>列：</strong>当前所在看板列（决定看板位置）。</li>
          </ul>

          <h3 style={h3Style}>HTML5 拖放</h3>
          <p style={pStyle}>
            任务可以使用原生 HTML5 拖放在不同列之间移动。当卡片被拖到新列时，会发出 <code style={codeStyle}>PATCH /api/tasks/:taskId/move</code> 请求更新服务器状态。看板使用乐观更新以获得即时视觉反馈，失败时回滚。卡片也可以在列内重新排序以设置优先级顺序。
          </p>

          <h3 style={h3Style}>跨系统关联</h3>
          <p style={pStyle}>
            任务与其他 Ti Work 系统集成：
          </p>
          <ul style={ulStyle}>
            <li>任务可以从 Conductor 任务输出创建，将任务关联到原始任务。</li>
            <li>团队派发结果可以自动生成评审任务。</li>
            <li>任务经办人可以引用智能体库中的智能体人设。</li>
          </ul>
        </section>

        
        <section id="cron-jobs" style={sectionStyle}>
          <h2 style={h2Style}>6. 定时任务管理</h2>

          <h3 style={h3Style}>任务生命周期</h3>
          <p style={pStyle}>
            Ti Work 中的定时任务遵循以下生命周期：
          </p>
          <ol style={olStyle}>
            <li><strong>创建：</strong>定义任务，包含名称、提示词/指令、调度和投递配置。</li>
            <li><strong>调度：</strong>网关以 cron 表达式注册任务并开始调度。</li>
            <li><strong>运行：</strong>在每个调度时间，网关派生一个执行任务提示词的一次性智能体会话。</li>
            <li><strong>监控：</strong>运行进度通过 SSE 流式传输。输出被捕获并存储在运行历史中。</li>
          </ol>

          <h3 style={h3Style}>调度预设与 Cron 表达式</h3>
          <p style={pStyle}>
            任务创建对话框提供常用调度预设：
          </p>
          <ul style={ulStyle}>
            <li>每 5 分钟、每 15 分钟、每小时</li>
            <li>每 6 小时、每 12 小时、每日午夜</li>
            <li>每周（周一上午 9 点）、每月（1 号午夜）</li>
          </ul>
          <p style={pStyle}>
            高级用户可以输入使用标准 5 段格式的任意 cron 表达式：<code style={codeStyle}>分钟 小时 日 月 星期</code>。界面验证表达式并显示人类可读的解释。
          </p>

          <h3 style={h3Style}>投递渠道</h3>
          <p style={pStyle}>
            任务输出可以通过多个渠道投递：
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>渠道</th>
                <th style={thStyle}>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}><strong>本地</strong></td><td style={tdStyle}>输出存储在运行历史中，可在 Studio 界面查看。</td></tr>
              <tr><td style={tdStyle}><strong>Telegram</strong></td><td style={tdStyle}>将输出作为 Telegram 消息发送到配置的机器人/会话。</td></tr>
              <tr><td style={tdStyle}><strong>Discord</strong></td><td style={tdStyle}>通过 Webhook 将输出发布到 Discord 频道。</td></tr>
              <tr><td style={tdStyle}><strong>Slack</strong></td><td style={tdStyle}>通过入站 Webhook 将输出发送到 Slack 频道。</td></tr>
              <tr><td style={tdStyle}><strong>Signal</strong></td><td style={tdStyle}>通过 Signal 通讯集成投递输出。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>实时运行流</h3>
          <p style={pStyle}>
            任务运行时（无论定时还是手动触发），输出通过 <code style={codeStyle}>GET /api/hermes-runs/:runId/events</code> 的 SSE 实时流式传输。Studio 界面以与会话相同的消息格式渲染流式输出，包括工具使用指示器和 Markdown 渲染。
          </p>

          <h3 style={h3Style}>运行历史</h3>
          <p style={pStyle}>
            每个任务通过 <code style={codeStyle}>GET /api/hermes-runs</code> 维护过去的运行历史。运行条目包括开始时间、持续时间、退出状态（成功/失败/超时）、Token 用量和完整输出文本。任务界面以时间线视图展示最近的运行，带可展开的输出面板。
          </p>
        </section>

        
        <section id="knowledge-system" style={sectionStyle}>
          <h2 style={h2Style}>7. 知识系统</h2>

          <h3 style={h3Style}>记忆浏览器</h3>
          <p style={pStyle}>
            记忆浏览器提供对智能体身份和知识文件的访问。这些 Markdown 文件定义智能体的个性、能力和上下文信息：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>SOUL.md</dt>
            <dd style={ddStyle}>核心身份文件，定义智能体的基本个性、价值观、沟通风格和行为准则。始终加载到上下文中。</dd>
            <dt style={dtStyle}>persona.md</dt>
            <dd style={ddStyle}>当前活动人设配置，包括名称、角色、专业和交互偏好。可以切换以改变智能体行为。</dd>
            <dt style={dtStyle}>CLAUDE.md</dt>
            <dd style={ddStyle}>项目特定指令和上下文。通常包含代码库约定、架构说明和项目特定规则。</dd>
          </dl>
          <p style={pStyle}>
            文件通过 <code style={codeStyle}>GET /api/memory/read</code> 读取，通过 <code style={codeStyle}>POST /api/memory/write</code> 写入。浏览器包含带 Markdown 预览的内联编辑 Monaco 编辑器。
          </p>

          <h3 style={h3Style}>知识图谱</h3>
          <p style={pStyle}>
            知识图谱提供知识条目之间关系的力导向可视化。基于 D3 风格物理模拟构建：
          </p>
          <ul style={ulStyle}>
            <li><strong>节点：</strong>每个知识文件或记忆条目成为一个节点。大小反映内容长度；颜色指示文件类型。</li>
            <li><strong>边：</strong>连接通过文档中的 wikilink 语法（<code style={codeStyle}>[[target]]</code>）检测。边表示知识条目之间的交叉引用。</li>
            <li><strong>物理模拟：</strong>带电荷排斥、链接吸引和中心重力的力导向布局。节点可以拖动和固定。</li>
            <li><strong>搜索：</strong>通过 <code style={codeStyle}>GET /api/knowledge/search</code> 进行全文搜索，高亮匹配节点并过滤图谱显示。</li>
          </ul>
          <p style={pStyle}>
            图谱数据从 <code style={codeStyle}>GET /api/knowledge/graph</code> 获取，该端点以 JSON 返回节点和边。知识列表端点（<code style={codeStyle}>GET /api/knowledge/list</code>）提供扁平文件列表。
          </p>

          <h3 style={h3Style}>Wikilink 检测</h3>
          <p style={pStyle}>
            知识系统自动检测记忆文件中的 <code style={codeStyle}>[[wikilink]]</code> 语法。找到 wikilink 时，系统尝试针对现有知识条目解析。已解析的链接成为图谱中的可导航连接和编辑器中的可点击引用。未解析的链接被高亮为损坏引用。
          </p>

          <h3 style={h3Style}>模式与纠正</h3>
          <p style={pStyle}>
            模式界面（<code style={codeStyle}>/patterns</code>）管理可复用的行为模式与纠正：
          </p>
          <ul style={ulStyle}>
            <li><strong>模式：</strong>可应用于会话的可复用提示词模板。定义常用指令、格式规则或行为准则。</li>
            <li><strong>纠正：</strong>覆盖默认智能体行为的特定行为修复。纠正处于活动状态时，会被注入智能体的系统提示词中，以防止重复犯错。</li>
          </ul>
        </section>

        
        <section id="skills-ecosystem" style={sectionStyle}>
          <h2 style={h2Style}>8. 技能生态</h2>

          <h3 style={h3Style}>技能注册表</h3>
          <p style={pStyle}>
            Ti Work 提供对来自 skillsmp.com（Hermes 技能市场）的 2000+ 技能注册表的访问。技能通过提供结构化指令、工具定义和工作流模式来扩展智能体能力。技能界面显示已安装技能及其状态（启用/禁用）以及来自技能中心的可获取技能。
          </p>

          <h3 style={h3Style}>安装流程</h3>
          <p style={pStyle}>
            技能安装采用两级策略：
          </p>
          <ol style={olStyle}>
            <li><strong>网关安装：</strong>主要路径通过 <code style={codeStyle}>POST /api/skills/install</code> 向 Hermes 网关发送安装请求。网关从注册表下载技能并将其放置在技能目录中。</li>
            <li><strong>ClawHub 回退：</strong>如果网关安装失败（网关版本过旧、网络问题），系统回退到 ClawHub API 获取技能。</li>
          </ol>
          <p style={pStyle}>
            卸载通过 <code style={codeStyle}>POST /api/skills/uninstall</code> 执行，从网关的技能目录中移除技能文件。
          </p>

          <h3 style={h3Style}>启用/禁用开关</h3>
          <p style={pStyle}>
            已安装的技能可以启用或禁用而无需卸载。禁用的技能保留在磁盘上，但被排除在智能体的活动技能集之外。这允许快速实验而无需重新安装的开销。技能设置通过 <code style={codeStyle}>POST /api/skills/settings</code> 管理。
          </p>

          <h3 style={h3Style}>技能文档</h3>
          <p style={pStyle}>
            每个技能包含一个描述其能力、使用模式和配置选项的 SKILL.md 文档文件。选择技能时，技能界面内联渲染该文档。技能中心搜索（<code style={codeStyle}>GET /api/skills/hub-search</code>）返回技能元数据，包括名称、描述、类别和安装数量。
          </p>
        </section>

        
        <section id="agent-library" style={sectionStyle}>
          <h2 style={h2Style}>9. 智能体库</h2>

          <h3 style={h3Style}>内置人设</h3>
          <p style={pStyle}>
            Ti Work 附带 8 个内置智能体人设，每个专注于不同的任务类型：
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>名称</th>
                <th style={thStyle}>角色</th>
                <th style={thStyle}>表情</th>
                <th style={thStyle}>专长</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>Roger</td><td style={tdStyle}>前端开发工程师</td><td style={tdStyle}><EmojiIcon emoji="💻" size={16} /></td><td style={tdStyle}>React, CSS, Tailwind, UI/UX, components, layout, design</td></tr>
              <tr><td style={tdStyle}>Sally</td><td style={tdStyle}>后端架构师</td><td style={tdStyle}><EmojiIcon emoji="🗄️" size={16} /></td><td style={tdStyle}>API, server, database, Node, Express, routes, schemas</td></tr>
              <tr><td style={tdStyle}>Bill</td><td style={tdStyle}>营销专家</td><td style={tdStyle}><EmojiIcon emoji="📣" size={16} /></td><td style={tdStyle}>Marketing, SEO, content, copy, brand, social, campaigns</td></tr>
              <tr><td style={tdStyle}>Ada</td><td style={tdStyle}>QA 工程师</td><td style={tdStyle}><EmojiIcon emoji="🧪" size={16} /></td><td style={tdStyle}>Testing, QA, bugs, debugging, linting, TypeScript, validation</td></tr>
              <tr><td style={tdStyle}>Max</td><td style={tdStyle}>DevOps 专家</td><td style={tdStyle}><EmojiIcon emoji="🚀" size={16} /></td><td style={tdStyle}>Deploy, Docker, CI/CD, build, infrastructure, monitoring</td></tr>
              <tr><td style={tdStyle}>Luna</td><td style={tdStyle}>研究分析师</td><td style={tdStyle}><EmojiIcon emoji="🔬" size={16} /></td><td style={tdStyle}>Research, analysis, comparison, reports, data, strategy</td></tr>
              <tr><td style={tdStyle}>Kai</td><td style={tdStyle}>全栈工程师</td><td style={tdStyle}><EmojiIcon emoji="🖥️" size={16} /></td><td style={tdStyle}>Full-stack, features, implementation, scaffolding, refactoring</td></tr>
              <tr><td style={tdStyle}>Nova</td><td style={tdStyle}>安全专家</td><td style={tdStyle}><EmojiIcon emoji="🛡️" size={16} /></td><td style={tdStyle}>Security, auth, permissions, encryption, vulnerability scanning</td></tr>
            </tbody>
          </table>
          <p style={pStyle}>
            人设以轮询方式分配给团队成员，或通过将任务关键词与专长标签匹配来分配。
          </p>

          <h3 style={h3Style}>创建自定义智能体</h3>
          <p style={pStyle}>
            智能体编辑器对话框允许创建具有以下属性的自定义智能体：
          </p>
          <ul style={ulStyle}>
            <li><strong>名称：</strong>智能体的显示名称。</li>
            <li><strong>表情：</strong>在界面元素中显示的视觉头像表情。</li>
            <li><strong>颜色：</strong>智能体视觉身份的强调色。</li>
            <li><strong>系统提示词：</strong>定义智能体行为、知识和沟通风格的自定义系统指令。</li>
            <li><strong>模型覆盖：</strong>可选择将此智能体锁定到特定的 LLM 模型，不受全局设置影响。</li>
            <li><strong>标签：</strong>用于团队和调度台中自动人设匹配的专长标签。</li>
          </ul>
          <p style={pStyle}>
            自定义智能体通过 <code style={codeStyle}>POST /api/agents</code>（创建）、<code style={codeStyle}>PUT /api/agents/:agentId</code>（更新）和 <code style={codeStyle}>DELETE /api/agents/:agentId</code>（删除）管理。它们存储在一个基于文件的定义存储中。
          </p>

          <h3 style={h3Style}>与团队和模板的集成</h3>
          <p style={pStyle}>
            内置和自定义智能体都出现在团队成员选择界面中。从模板创建团队时，模板按名称或专长匹配指定智能体分配。自定义智能体可以在模板中使用，并在派发时解析。
          </p>
        </section>

        
        <section id="files-terminal" style={sectionStyle}>
          <h2 style={h2Style}>10. 文件管理与终端</h2>

          <h3 style={h3Style}>按配置档案作用域的文件浏览器</h3>
          <p style={pStyle}>
            文件浏览器在活动配置档案的工作区范围内运行。它提供：
          </p>
          <ul style={ulStyle}>
            <li>树形目录导航，支持可展开文件夹。</li>
            <li>文件元数据显示（大小、修改时间、类型）。</li>
            <li>文件和目录的创建、重命名和删除操作。</li>
            <li>文件内容通过 <code style={codeStyle}>GET /api/files?path=...</code> 提供，通过 <code style={codeStyle}>POST /api/files</code> 保存。</li>
          </ul>

          <h3 style={h3Style}>Monaco 编辑器集成</h3>
          <p style={pStyle}>
            文件编辑使用 Monaco 编辑器（与 VS Code 相同的编辑器）。配置选项：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>语法高亮</dt>
            <dd style={ddStyle}>基于文件扩展名自动检测语言。支持 TypeScript、JavaScript、Python、Rust、Go、Markdown、JSON、YAML、HTML、CSS 以及 50+ 其他语言。</dd>
            <dt style={dtStyle}>字体大小</dt>
            <dd style={ddStyle}>可通过设置配置（默认：13px）。存储在 <code style={codeStyle}>editorFontSize</code> 设置中。</dd>
            <dt style={dtStyle}>自动换行</dt>
            <dd style={ddStyle}>为长行切换自动换行。存储在 <code style={codeStyle}>editorWordWrap</code> 设置中。</dd>
            <dt style={dtStyle}>小地图</dt>
            <dd style={ddStyle}>右侧边栏中的可选代码小地图。存储在 <code style={codeStyle}>editorMinimap</code> 设置中。</dd>
          </dl>

          <h3 style={h3Style}>PTY 终端</h3>
          <p style={pStyle}>
            终端界面提供由 Xterm.js 驱动的完整 PTY（伪终端）：
          </p>
          <ul style={ulStyle}>
            <li><strong>持久会话：</strong>终端会话在页面刷新后仍然存在。PTY 进程在服务器上持续运行。</li>
            <li><strong>流式传输：</strong>终端 I/O 通过 <code style={codeStyle}>GET /api/terminal-stream</code>（SSE 输出）和 <code style={codeStyle}>POST /api/terminal-input</code>（按键输入）流式传输。</li>
            <li><strong>尺寸调整：</strong>当浏览器窗口或面板改变大小时，终端尺寸通过 <code style={codeStyle}>POST /api/terminal-resize</code> 同步。</li>
            <li><strong>关闭：</strong>通过 <code style={codeStyle}>POST /api/terminal-close</code> 显式关闭终端会话。</li>
            <li><strong>ANSI 支持：</strong>完整的 256 色和真彩色 ANSI 渲染，支持粗体、斜体、下划线和光标定位。</li>
          </ul>
        </section>

        
        <section id="analytics-observability" style={sectionStyle}>
          <h2 style={h2Style}>11. 数据分析与可观测性</h2>

          <h3 style={h3Style}>事件分析</h3>
          <p style={pStyle}>
            数据分析界面（<code style={codeStyle}>/analytics</code>）提供智能体活动的可视化洞察：
          </p>
          <ul style={ulStyle}>
            <li><strong>14 天堆叠柱状图：</strong>按类型（消息、工具调用、审批、错误）显示每日事件计数。数据来源于 <code style={codeStyle}>GET /api/state-analytics</code>。</li>
            <li><strong>工具频率：</strong>最常用工具的排名列表，包含调用次数和成功率。</li>
            <li><strong>上下文使用：</strong>通过 <code style={codeStyle}>GET /api/context-usage</code> 展示上下文窗口利用率随时间变化的时间序列图。</li>
            <li><strong>服务提供方使用：</strong>通过 <code style={codeStyle}>GET /api/provider-usage</code> 按 LLM 服务提供方细分 Token 消耗。</li>
          </ul>

          <h3 style={h3Style}>会话历史</h3>
          <p style={pStyle}>
            会话历史界面（<code style={codeStyle}>/session-history</code>）提供双栏归档界面：
          </p>
          <ul style={ulStyle}>
            <li><strong>左栏：</strong>可滚动的会话列表，显示会话名称、创建日期、消息数量和最后活动。按最近活动排序。</li>
            <li><strong>右栏：</strong>所选会话的按需加载消息线程。消息以完整格式渲染，包括代码块、工具结果和审批回执。</li>
            <li><strong>数据来源：</strong><code style={codeStyle}>GET /api/history</code> 返回归档的会话元数据。选择会话时加载单个会话消息。</li>
          </ul>

          <h3 style={h3Style}>审计日志</h3>
          <p style={pStyle}>
            审计日志（<code style={codeStyle}>/audit</code>）维护所有重要系统事件的时序日志：
          </p>
          <ul style={ulStyle}>
            <li><strong>事件类型：</strong>会话创建/删除、消息发送、工具执行、审批授予/拒绝、配置更改、技能安装/移除、任务创建/运行。</li>
            <li><strong>过滤：</strong>按事件类型、会话键、日期范围或自由文本搜索过滤。</li>
            <li><strong>数据来源：</strong><code style={codeStyle}>GET /api/audit</code>，带分页和过滤的查询参数。</li>
            <li><strong>保留：</strong>审计条目持久化在网关上，除非手动清除，否则无限期保留。</li>
          </ul>

          <h3 style={h3Style}>日志查看器</h3>
          <p style={pStyle}>
            日志界面（<code style={codeStyle}>/logs</code>）显示最近 500 行网关系统日志：
          </p>
          <ul style={ulStyle}>
            <li><strong>颜色编码：</strong>日志级别按颜色编码 — 调试（灰色）、信息（蓝色）、警告（琥珀色）、错误（红色）。</li>
            <li><strong>自动滚动：</strong>新日志行自动将视图滚动到底部。暂停按钮停止自动滚动以便手动检查。</li>
            <li><strong>时间戳：</strong>每行以本地时间格式显示时间戳。</li>
            <li><strong>来源：</strong>日志从网关获取，以等宽终端风格容器显示。</li>
          </ul>
        </section>

        
        <section id="api-reference" style={sectionStyle}>
          <h2 style={h2Style}>12. API 参考</h2>
          <p style={pStyle}>
            所有 API 端点均由 Hermes Studio 服务器进程提供，并在适当时代理到 Hermes 网关。基础路径：<code style={codeStyle}>/api</code>。所有变更端点均要求 <code style={codeStyle}>Content-Type: application/json</code>。认证通过会话 Cookie 或 Bearer Token 完成。
          </p>

          <h3 style={h3Style}>认证</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/auth-check</td><td style={tdStyle}>检查当前会话是否已认证。已认证返回 200 及用户信息，否则返回 401。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/auth</td><td style={tdStyle}>使用密码认证。成功时返回会话 Token。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/oauth/device-code</td><td style={tdStyle}>发起 OAuth 设备码流程。返回设备码和用户验证 URL。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/oauth/poll-token</td><td style={tdStyle}>设备码授权完成后轮询 OAuth Token 完成状态。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>会话</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/sessions</td><td style={tdStyle}>列出所有活动会话及元数据（名称、状态、创建时间戳）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/sessions</td><td style={tdStyle}>创建新会话。请求体：可选的名称、模型、系统提示词。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/sessions/:sessionKey/status</td><td style={tdStyle}>获取当前会话状态（idle、active、waiting_for_input）。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/sessions/:sessionKey/active-run</td><td style={tdStyle}>获取会话当前正在进行的运行（如有）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/sessions/send</td><td style={tdStyle}>向会话发送消息。请求体：sessionKey、message、attachments。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/session-status</td><td style={tdStyle}>多个会话的批量状态检查。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/chat-events</td><td style={tdStyle}>会话会话事件的 SSE 流。查询参数：sessionKey。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/events</td><td style={tdStyle}>全局系统事件的 SSE 流。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/events/replay</td><td style={tdStyle}>从给定时间戳重放会话的历史事件。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/send</td><td style={tdStyle}>便携式会话补全模式的备用发送端点。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/send-stream</td><td style={tdStyle}>便携式会话补全模式的 SSE 流。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/history</td><td style={tdStyle}>获取归档会话历史（含消息计数的过往会话）。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>多智能体团队</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/crews</td><td style={tdStyle}>列出所有团队及成员数和状态。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/crews</td><td style={tdStyle}>创建新团队。请求体：name、description、members 数组。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/crews/:crewId</td><td style={tdStyle}>获取团队详情，包括成员、工作流和派发历史。</td></tr>
              <tr><td style={tdCodeStyle}>PUT</td><td style={tdCodeStyle}>/api/crews/:crewId</td><td style={tdStyle}>更新团队配置（名称、描述、成员）。</td></tr>
              <tr><td style={tdCodeStyle}>DELETE</td><td style={tdCodeStyle}>/api/crews/:crewId</td><td style={tdStyle}>删除团队，并可选择删除其关联会话。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/crews/:crewId/dispatch</td><td style={tdStyle}>向团队派发任务。请求体：goal、strategy。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/crews/:crewId/clone</td><td style={tdStyle}>克隆团队，为所有成员创建全新会话。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/crews/:crewId/workflow</td><td style={tdStyle}>获取团队的工作流 DAG 定义。</td></tr>
              <tr><td style={tdCodeStyle}>PUT</td><td style={tdCodeStyle}>/api/crews/:crewId/workflow</td><td style={tdStyle}>更新团队的工作流 DAG（节点和边）。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/crews/:crewId/usage</td><td style={tdStyle}>获取每位团队成员的 Token 用量细分。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/crews/templates</td><td style={tdStyle}>列出所有可用团队模板（内置 + 自定义）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/crews/templates</td><td style={tdStyle}>创建自定义团队模板。</td></tr>
              <tr><td style={tdCodeStyle}>DELETE</td><td style={tdCodeStyle}>/api/crews/templates/:id</td><td style={tdStyle}>删除用户创建的模板（内置模板不可删除）。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>调度台</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/conductor-spawn</td><td style={tdStyle}>派生一个调度台任务。请求体：goal、orchestratorModel、workerModel、projectsDir、maxParallel、supervised。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/conductor-stop</td><td style={tdStyle}>停止正在运行的调度台任务。终止所有工作会话。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>任务</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/tasks</td><td style={tdStyle}>列出所有列中的全部任务。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/tasks</td><td style={tdStyle}>创建新任务。请求体：title、description、priority、tags、column、assignee、sourceLinks。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/tasks/:taskId</td><td style={tdStyle}>按 ID 获取单个任务。</td></tr>
              <tr><td style={tdCodeStyle}>PUT</td><td style={tdCodeStyle}>/api/tasks/:taskId</td><td style={tdStyle}>更新任务属性。</td></tr>
              <tr><td style={tdCodeStyle}>DELETE</td><td style={tdCodeStyle}>/api/tasks/:taskId</td><td style={tdStyle}>删除任务。</td></tr>
              <tr><td style={tdCodeStyle}>PATCH</td><td style={tdCodeStyle}>/api/tasks/:taskId/move</td><td style={tdStyle}>将任务移动到不同列。请求体：column、position。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>智能体</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/agents</td><td style={tdStyle}>列出所有自定义智能体定义。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/agents</td><td style={tdStyle}>创建新智能体。请求体：name、emoji、color、systemPrompt、model、tags。</td></tr>
              <tr><td style={tdCodeStyle}>PUT</td><td style={tdCodeStyle}>/api/agents/:agentId</td><td style={tdStyle}>更新现有智能体定义。</td></tr>
              <tr><td style={tdCodeStyle}>DELETE</td><td style={tdCodeStyle}>/api/agents/:agentId</td><td style={tdStyle}>删除自定义智能体。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>定时任务（Cron）</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/hermes-jobs</td><td style={tdStyle}>列出所有已注册的定时任务及状态和调度信息。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/hermes-jobs</td><td style={tdStyle}>创建新定时任务。请求体：name、prompt、schedule、delivery 配置。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/hermes-jobs/:jobId</td><td style={tdStyle}>获取特定任务的详情。</td></tr>
              <tr><td style={tdCodeStyle}>PUT</td><td style={tdCodeStyle}>/api/hermes-jobs/:jobId</td><td style={tdStyle}>更新任务配置（调度、提示词、投递）。</td></tr>
              <tr><td style={tdCodeStyle}>DELETE</td><td style={tdCodeStyle}>/api/hermes-jobs/:jobId</td><td style={tdStyle}>删除定时任务。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/hermes-runs</td><td style={tdStyle}>列出最近的任务运行及状态和时间信息。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/hermes-runs/:runId/events</td><td style={tdStyle}>特定任务运行的 SSE 事件流。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>记忆与知识</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/memory</td><td style={tdStyle}>获取记忆总览（带元数据的文件列表）。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/memory/list</td><td style={tdStyle}>列出所有记忆文件及路径和大小。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/memory/read</td><td style={tdStyle}>读取特定记忆文件。查询参数：path。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/memory/write</td><td style={tdStyle}>向记忆文件写入内容。请求体：path、content。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/memory/search</td><td style={tdStyle}>跨记忆文件全文搜索。查询参数：q。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/knowledge/list</td><td style={tdStyle}>列出所有知识条目。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/knowledge/read</td><td style={tdStyle}>读取知识条目。查询参数：path。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/knowledge/search</td><td style={tdStyle}>搜索知识库。查询参数：q。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/knowledge/graph</td><td style={tdStyle}>获取知识图谱（用于可视化的节点和边 JSON）。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>技能</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/skills</td><td style={tdStyle}>列出已安装技能及启用/禁用状态。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/skills/install</td><td style={tdStyle}>从注册表安装技能。请求体：skillId。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/skills/uninstall</td><td style={tdStyle}>卸载技能。请求体：skillId。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/skills/settings</td><td style={tdStyle}>更新技能设置（启用/禁用）。请求体：skillId、enabled。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/skills/hub-search</td><td style={tdStyle}>搜索技能市场。查询参数：q、category。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>文件</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/files</td><td style={tdStyle}>列出文件或读取文件内容。查询参数：path、action（list/read）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/files</td><td style={tdStyle}>创建或更新文件。请求体：path、content。</td></tr>
              <tr><td style={tdCodeStyle}>DELETE</td><td style={tdCodeStyle}>/api/files</td><td style={tdStyle}>删除文件。请求体：path。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/paths</td><td style={tdStyle}>获取活动配置档案的工作区路径信息。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>配置档案</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/profiles/list</td><td style={tdStyle}>列出所有可用配置档案及活动指示。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/profiles/create</td><td style={tdStyle}>创建新配置档案。请求体：name。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/profiles/activate</td><td style={tdStyle}>切换活动配置档案。请求体：name。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/profiles/rename</td><td style={tdStyle}>重命名配置档案。请求体：oldName、newName。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/profiles/delete</td><td style={tdStyle}>删除配置档案。请求体：name。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/profiles/read</td><td style={tdStyle}>读取配置档案特定的配置。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>配置</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/hermes-config</td><td style={tdStyle}>获取当前网关配置。</td></tr>
              <tr><td style={tdCodeStyle}>PATCH</td><td style={tdCodeStyle}>/api/hermes-config</td><td style={tdStyle}>更新网关配置。请求体：部分配置对象。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/mcp/servers</td><td style={tdStyle}>列出已配置的 MCP 服务器。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/mcp/servers</td><td style={tdStyle}>添加或更新 MCP 服务器配置。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/mcp/reload</td><td style={tdStyle}>重新加载 MCP 服务器连接。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>数据分析</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/state-analytics</td><td style={tdStyle}>获取事件分析数据（按事件类型的 14 天细分）。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/context-usage</td><td style={tdStyle}>获取上下文窗口使用的时间序列数据。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/provider-usage</td><td style={tdStyle}>获取按 LLM 服务提供方细分的 Token 用量。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>系统</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/ping</td><td style={tdStyle}>健康检查。返回 200 及时间戳。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/system-health</td><td style={tdStyle}>详细的系统健康状态，包括网关连通性、Redis 状态和运行时间。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/systemd-status</td><td style={tdStyle}>获取 Hermes 网关进程的 systemd 服务状态。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/systemd-control</td><td style={tdStyle}>控制 Hermes 网关 systemd 服务（启动、停止、重启）。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/models</td><td style={tdStyle}>列出网关提供的可用 LLM 模型。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/workspace</td><td style={tdStyle}>获取工作区信息（路径、配置档案、网关版本）。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/gateway-status</td><td style={tdStyle}>获取网关连接状态和检测到的能力。</td></tr>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/connection-status</td><td style={tdStyle}>轻量级连接检查（比完整健康检查更快）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/start-hermes</td><td style={tdStyle}>启动 Hermes 网关进程（如未运行）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/start-agent</td><td style={tdStyle}>使用特定配置启动智能体会话。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>运维</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/operations</td><td style={tdStyle}>获取所有活动智能体会话的运维总览，含状态和指标。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>审批</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/approvals/:approvalId/approve</td><td style={tdStyle}>批准待处理操作。请求体：scope（once、session、always）。</td></tr>
              <tr><td style={tdCodeStyle}>POST</td><td style={tdCodeStyle}>/api/approvals/:approvalId/deny</td><td style={tdStyle}>拒绝待处理操作。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>审计</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>GET</td><td style={tdCodeStyle}>/api/audit</td><td style={tdStyle}>获取审计日志条目。查询参数：type、session、from、to、limit、offset。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>网关代理</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>方法</th><th style={thStyle}>路径</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>ANY</td><td style={tdCodeStyle}>/api/hermes-proxy/*</td><td style={tdStyle}>对 Hermes 网关的透明代理。转发任何请求路径和方法。用于自定义集成对网关的直接访问。</td></tr>
            </tbody>
          </table>
        </section>

        
        <section id="configuration" style={sectionStyle}>
          <h2 style={h2Style}>13. 配置参考</h2>

          <h3 style={h3Style}>localStorage 设置（Zustand Store）</h3>
          <p style={pStyle}>
            客户端设置由带 localStorage 持久化的 Zustand store 管理。Store 键为 <code style={codeStyle}>hermes-studio-settings</code>。
          </p>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>键</th><th style={thStyle}>类型</th><th style={thStyle}>默认值</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>hermesUrl</td><td style={tdStyle}>string</td><td style={tdCodeStyle}>""</td><td style={tdStyle}>网关服务器 URL（例如 http://localhost:8642）</td></tr>
              <tr><td style={tdCodeStyle}>hermesToken</td><td style={tdStyle}>string</td><td style={tdCodeStyle}>""</td><td style={tdStyle}>网关认证的 Bearer Token</td></tr>
              <tr><td style={tdCodeStyle}>hermesApiKey</td><td style={tdStyle}>string</td><td style={tdCodeStyle}>""</td><td style={tdStyle}>用于非回环地址 Hermes 实例的 API 服务器密钥</td></tr>
              <tr><td style={tdCodeStyle}>theme</td><td style={tdStyle}>"system" | "dark"</td><td style={tdCodeStyle}>"system"</td><td style={tdStyle}>配色方案偏好</td></tr>
              <tr><td style={tdCodeStyle}>accentColor</td><td style={tdStyle}>"orange" | "purple" | "blue" | "green"</td><td style={tdCodeStyle}>"blue"</td><td style={tdStyle}>UI 强调色</td></tr>
              <tr><td style={tdCodeStyle}>editorFontSize</td><td style={tdStyle}>number</td><td style={tdCodeStyle}>13</td><td style={tdStyle}>Monaco 编辑器字体大小（像素）</td></tr>
              <tr><td style={tdCodeStyle}>editorWordWrap</td><td style={tdStyle}>boolean</td><td style={tdCodeStyle}>true</td><td style={tdStyle}>在编辑器中启用自动换行</td></tr>
              <tr><td style={tdCodeStyle}>editorMinimap</td><td style={tdStyle}>boolean</td><td style={tdCodeStyle}>false</td><td style={tdStyle}>在编辑器边栏显示代码小地图</td></tr>
              <tr><td style={tdCodeStyle}>notificationsEnabled</td><td style={tdStyle}>boolean</td><td style={tdCodeStyle}>true</td><td style={tdStyle}>启用浏览器通知</td></tr>
              <tr><td style={tdCodeStyle}>usageThreshold</td><td style={tdStyle}>number</td><td style={tdCodeStyle}>80</td><td style={tdStyle}>上下文使用警告阈值（%）</td></tr>
              <tr><td style={tdCodeStyle}>smartSuggestionsEnabled</td><td style={tdStyle}>boolean</td><td style={tdCodeStyle}>false</td><td style={tdStyle}>根据任务复杂度启用智能模型建议</td></tr>
              <tr><td style={tdCodeStyle}>preferredBudgetModel</td><td style={tdStyle}>string</td><td style={tdCodeStyle}>""</td><td style={tdStyle}>成本敏感型任务的首选模型</td></tr>
              <tr><td style={tdCodeStyle}>preferredPremiumModel</td><td style={tdStyle}>string</td><td style={tdCodeStyle}>""</td><td style={tdStyle}>复杂/高端任务的首选模型</td></tr>
              <tr><td style={tdCodeStyle}>onlySuggestCheaper</td><td style={tdStyle}>boolean</td><td style={tdCodeStyle}>false</td><td style={tdStyle}>仅建议更便宜的模型替代方案</td></tr>
              <tr><td style={tdCodeStyle}>showSystemMetricsFooter</td><td style={tdStyle}>boolean</td><td style={tdCodeStyle}>false</td><td style={tdStyle}>在页脚栏显示系统指标</td></tr>
              <tr><td style={tdCodeStyle}>mobileChatNavMode</td><td style={tdStyle}>"dock" | "integrated" | "scroll-hide"</td><td style={tdCodeStyle}>"dock"</td><td style={tdStyle}>会话界面的移动端导航模式</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>其他 localStorage 键</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>键</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>hermes-theme</td><td style={tdStyle}>活动视觉主题 ID（hermes-os、hermes-official、hermes-classic、hermes-slate、hermes-mono）</td></tr>
              <tr><td style={tdCodeStyle}>hermes-studio:office-layout</td><td style={tdStyle}>调度台办公视图布局偏好（grid、roundtable、warroom）</td></tr>
              <tr><td style={tdCodeStyle}>hermes-studio:conductor-settings</td><td style={tdStyle}>调度台配置（编排模型、工作模型、项目目录、最大并行数、监督模式）</td></tr>
              <tr><td style={tdCodeStyle}>hermes-studio:mission-history</td><td style={tdStyle}>已完成调度台任务数组（最多 50 条）</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>网关配置</h3>
          <p style={pStyle}>
            Hermes 网关通过 <code style={codeStyle}>~/.hermes/config.yaml</code> 配置。Studio 通过 <code style={codeStyle}>/api/hermes-config</code> 端点读取和写入此配置。关键配置部分：
          </p>
          <pre style={preStyle}>{`# ~/.hermes/config.yaml
server:
  host: 0.0.0.0
  port: 8642
  cors_origins: ["*"]

auth:
  token: "your-bearer-token"
  password: "your-login-password"

providers:
  anthropic:
    api_key: "sk-ant-..."
    default_model: "claude-sonnet-4-20250514"
  openai:
    api_key: "sk-..."
    default_model: "gpt-4o"

sessions:
  persistence: redis  # or "file"
  redis_url: "redis://localhost:6379"
  max_sessions: 50

skills:
  directory: "~/.hermes/skills"
  auto_enable: true

memory:
  directory: "~/.hermes/memory"

jobs:
  directory: "~/.hermes/jobs"
  max_concurrent: 3`}</pre>

          <h3 style={h3Style}>调度台设置</h3>
          <p style={pStyle}>
            调度台设置存储在 localStorage 中并传递给派生端点：
          </p>
          <pre style={preStyle}>{`{
  "orchestratorModel": "",       // Empty = gateway default
  "workerModel": "",             // Empty = gateway default
  "projectsDir": "/tmp",         // Output directory for workers
  "maxParallel": 3,              // 1-5 concurrent workers
  "supervised": false            // Require approvals for workers
}`}</pre>

          <h3 style={h3Style}>基于文件的数据存储</h3>
          <p style={pStyle}>
            多个数据存储使用 Hermes Studio 安装目录内的 <code style={codeStyle}>.runtime/</code> 目录：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>.runtime/crews.json</dt>
            <dd style={ddStyle}>团队定义和成员配置。</dd>
            <dt style={dtStyle}>.runtime/tasks.json</dt>
            <dd style={ddStyle}>任务看板状态（所有列中的所有任务）。</dd>
            <dt style={dtStyle}>.runtime/agents.json</dt>
            <dd style={ddStyle}>通过智能体编辑器创建的自定义智能体定义。</dd>
            <dt style={dtStyle}>.runtime/templates/</dt>
            <dd style={ddStyle}>用户创建的团队模板（每个模板一个 JSON 文件）。</dd>
          </dl>

          <h3 style={h3Style}>环境变量</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>变量</th><th style={thStyle}>默认值</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>HERMES_API_URL</td><td style={tdCodeStyle}>http://127.0.0.1:8642</td><td style={tdStyle}>Hermes 网关服务器的 URL。Studio 服务器在此连接以执行所有网关操作。</td></tr>
              <tr><td style={tdCodeStyle}>HERMES_API_TOKEN</td><td style={tdStyle}>(none)</td><td style={tdStyle}>与网关认证的 Bearer Token。在所有代理请求中以 Authorization 头发送。</td></tr>
              <tr><td style={tdCodeStyle}>HERMES_PASSWORD</td><td style={tdStyle}>(none)</td><td style={tdStyle}>登录 Hermes Studio 所需的密码。设置后，首次访问将显示登录界面。</td></tr>
              <tr><td style={tdCodeStyle}>REDIS_URL</td><td style={tdStyle}>(none)</td><td style={tdStyle}>会话 Token 持久化的 Redis 连接 URL。示例：redis://localhost:6379。未设置时，Token 仅存储在内存中。</td></tr>
              <tr><td style={tdCodeStyle}>NODE_ENV</td><td style={tdCodeStyle}>development</td><td style={tdStyle}>环境模式。在生产环境中，错误消息被脱敏且调试日志被抑制。</td></tr>
              <tr><td style={tdCodeStyle}>PORT</td><td style={tdCodeStyle}>3000</td><td style={tdStyle}>Hermes Studio 服务器的端口号。</td></tr>
            </tbody>
          </table>
        </section>

        
        <section id="design-system" style={sectionStyle}>
          <h2 style={h2Style}>14. 设计系统</h2>

          <h3 style={h3Style}>主题系统</h3>
          <p style={pStyle}>
            Hermes Studio 使用带 5 个可用主题的 CSS 自定义属性主题系统。主题通过在文档根元素上设置 <code style={codeStyle}>data-theme</code> 属性来应用。所有主题仅以深色模式运行。
          </p>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>主题 ID</th><th style={thStyle}>标签</th><th style={thStyle}>说明</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>hermes-os</td><td style={tdStyle}>Hermes OS</td><td style={tdStyle}>电光蓝的影院级智能体操作系统主题。默认主题。</td></tr>
              <tr><td style={tdCodeStyle}>hermes-official</td><td style={tdStyle}>Hermes Official</td><td style={tdStyle}>海军蓝和靛蓝的旗舰主题，具有专业美学。</td></tr>
              <tr><td style={tdCodeStyle}>hermes-classic</td><td style={tdStyle}>Hermes Classic</td><td style={tdStyle}>深炭色上的青铜点缀，呈现温暖、精致的观感。</td></tr>
              <tr><td style={tdCodeStyle}>hermes-slate</td><td style={tdStyle}>Slate</td><td style={tdStyle}>带微妙渐变的冷色调蓝色开发者主题。</td></tr>
              <tr><td style={tdCodeStyle}>hermes-mono</td><td style={tdStyle}>Mono</td><td style={tdStyle}>干净的纯灰度单色主题，减少干扰。</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>CSS 变量令牌</h3>
          <p style={pStyle}>
            每个主题都提供以下 CSS 自定义属性。所有 UI 组件必须使用这些变量而非硬编码颜色：
          </p>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>变量</th><th style={thStyle}>用途</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>--theme-bg</td><td style={tdStyle}>页面和界面的主要背景色</td></tr>
              <tr><td style={tdCodeStyle}>--theme-sidebar</td><td style={tdStyle}>侧边栏导航背景</td></tr>
              <tr><td style={tdCodeStyle}>--theme-panel</td><td style={tdStyle}>面板/抽屉背景（略微抬高）</td></tr>
              <tr><td style={tdCodeStyle}>--theme-card</td><td style={tdStyle}>卡片组件背景（第一层级）</td></tr>
              <tr><td style={tdCodeStyle}>--theme-card2</td><td style={tdStyle}>卡片组件背景（第二层级，嵌套）</td></tr>
              <tr><td style={tdCodeStyle}>--theme-border</td><td style={tdStyle}>卡片、输入框、分隔线的主要边框色</td></tr>
              <tr><td style={tdCodeStyle}>--theme-border-subtle</td><td style={tdStyle}>低强调分隔线的柔和边框</td></tr>
              <tr><td style={tdCodeStyle}>--theme-text</td><td style={tdStyle}>主要文字颜色（标题、标签、正文）</td></tr>
              <tr><td style={tdCodeStyle}>--theme-muted</td><td style={tdStyle}>次要文字颜色（说明、元数据）</td></tr>
              <tr><td style={tdCodeStyle}>--theme-accent</td><td style={tdStyle}>交互元素、链接、徽章的强调色</td></tr>
              <tr><td style={tdCodeStyle}>--theme-accent-subtle</td><td style={tdStyle}>高亮区域的浅强调背景</td></tr>
              <tr><td style={tdCodeStyle}>--theme-accent-border</td><td style={tdStyle}>强调高亮容器的边框色</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>强调色</h3>
          <p style={pStyle}>
            UI 强调色可与主题分开配置。有四种强调色选项：橙色、紫色、蓝色和绿色。强调色影响整个应用中的交互元素、链接、选中状态、徽章和焦点环。
          </p>

          <h3 style={h3Style}>组件库</h3>
          <p style={pStyle}>
            Hermes Studio 使用设计系统组件库以实现一致的 UI 模式：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>Card</dt>
            <dd style={ddStyle}>带主题背景、边框和圆角的容器组件。支持标题插槽、内边距变体和悬停状态。</dd>
            <dt style={dtStyle}>SettingsRow</dt>
            <dd style={ddStyle}>设置的横向布局，标签在左侧，控件在右侧。在整个设置界面中使用。</dd>
            <dt style={dtStyle}>SectionHeader</dt>
            <dd style={ddStyle}>章节标题组件，可带副标题和操作按钮插槽。提供一致的间距和排版。</dd>
            <dt style={dtStyle}>StatusBadge</dt>
            <dd style={ddStyle}>用于显示状态（active、idle、error、complete）的小药丸形徽章。按状态类型着色。</dd>
            <dt style={dtStyle}>ListItem</dt>
            <dd style={ddStyle}>可点击的列表行，可带图标、标题、说明和尾随元素。用于侧边栏和选择列表。</dd>
            <dt style={dtStyle}>EmptyState</dt>
            <dd style={ddStyle}>当列表或视图没有内容时显示的占位组件。包含图标、标题、说明和可选操作按钮。</dd>
          </dl>

          <h3 style={h3Style}>图标库</h3>
          <p style={pStyle}>
            Hermes Studio 使用 <strong>HugeIcons</strong>（<code style={codeStyle}>@hugeicons/react</code> 配合 <code style={codeStyle}>@hugeicons/core-free-icons</code>）作为主要图标库。图标按名称单独导入，并通过 <code style={codeStyle}>HugeiconsIcon</code> 组件渲染。图标集提供一致的 24px 描边图标，带可调的大小和颜色属性。
          </p>

          <h3 style={h3Style}>排版与间距</h3>
          <p style={pStyle}>
            应用加载四种字体系列：
          </p>
          <ul style={ulStyle}>
            <li><strong>Inter</strong> (400-700)：所有界面文字的主要 UI 字体。</li>
            <li><strong>Space Grotesk</strong> (400-700)：用于标题和展示文字。</li>
            <li><strong>JetBrains Mono</strong> (400-500)：代码、终端和技术内容的等宽字体。</li>
            <li><strong>EB Garamond</strong> (400-800)：用于编辑/创意内容场景的衬线字体。</li>
          </ul>
          <p style={pStyle}>
            间距遵循 Tailwind CSS 约定（4px 基本单位）。常用间距值：p-2 (8px)、p-3 (12px)、p-4 (16px)、p-6 (24px)、gap-2 (8px)、gap-4 (16px)。圆角使用 rounded-lg (8px)（卡片）和 rounded-xl (12px)（较大容器）。
          </p>
        </section>

        
        <section id="gateway-integration" style={sectionStyle}>
          <h2 style={h2Style}>15. 网关集成</h2>

          <h3 style={h3Style}>能力探测</h3>
          <p style={pStyle}>
            在服务器启动时以及此后每 120 秒，Hermes Studio 都会探测配置的网关以确定可用的 API 分组。探测过程：
          </p>
          <ol style={olStyle}>
            <li>向网关健康端点发送 GET 请求，超时 3 秒。</li>
            <li>如果健康检查响应，则探测核心能力：会话补全、模型、流式支持。</li>
            <li>如果核心能力确认，则探测增强能力：会话、技能、记忆、配置、定时任务。</li>
            <li>缓存结果，TTL 为 120 秒。后续请求使用缓存的能力，无需重新探测。</li>
            <li>如果探测失败（超时、网络错误），所有能力均标记为不可用。</li>
          </ol>

          <h3 style={h3Style}>增强模式与基础模式</h3>
          <p style={pStyle}>
            根据探测结果，Studio 以三种会话模式之一运行：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>enhanced-hermes</dt>
            <dd style={ddStyle}>完整的 Hermes 网关，包含会话管理、工具、审批、记忆和技能。所有功能均可用。</dd>
            <dt style={dtStyle}>portable</dt>
            <dd style={ddStyle}>基础 OpenAI 兼容会话补全。仅提供流式会话。无会话、工具或审批。</dd>
            <dt style={dtStyle}>disconnected</dt>
            <dd style={ddStyle}>无网关连接。界面显示带重试选项的连接错误状态。</dd>
          </dl>

          <h3 style={h3Style}>回退行为</h3>
          <p style={pStyle}>
            当增强能力不可用时，Studio 优雅降级：
          </p>
          <ul style={ulStyle}>
            <li>会话回退到便携模式，通过 <code style={codeStyle}>/api/send</code> 和 <code style={codeStyle}>/api/send-stream</code> 进行直接补全。</li>
            <li>多智能体团队、调度台、定时任务、技能、记忆和文件界面显示需要连接的空状态。</li>
            <li>侧边栏徽章指示哪些功能需要增强连接。</li>
            <li>无论连接状态如何，设置均保持完全可用（本地存储）。</li>
          </ul>

          <h3 style={h3Style}>会话持久化后端</h3>
          <p style={pStyle}>
            Hermes 网关为会话数据支持两种持久化后端：
          </p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>Redis</dt>
            <dd style={ddStyle}>推荐用于生产环境。消息存储在有序集合中，会话元数据存储在哈希中。支持 TTL 过期、原子操作和多进程访问。需要 <code style={codeStyle}>REDIS_URL</code> 环境变量。</dd>
            <dt style={dtStyle}>File</dt>
            <dd style={ddStyle}>开发环境或单用户设置的备用方案。会话数据以 JSON 文件形式存储在 <code style={codeStyle}>.runtime/sessions/</code> 中。部署更简单，但缺少 TTL 管理和并发访问安全性。</dd>
          </dl>

          <h3 style={h3Style}>Bearer Token 认证</h3>
          <p style={pStyle}>
            Studio 服务器使用 Bearer Token 与网关认证。Token 通过以下方式配置：
          </p>
          <ol style={olStyle}>
            <li><strong>环境变量：</strong><code style={codeStyle}>HERMES_API_TOKEN</code>（最高优先级）</li>
            <li><strong>客户端设置：</strong>Zustand 设置 store 中的 <code style={codeStyle}>hermesToken</code></li>
            <li><strong>网关配置：</strong><code style={codeStyle}>~/.hermes/config.yaml</code> 中的 <code style={codeStyle}>auth.token</code> 字段</li>
          </ol>
          <p style={pStyle}>
            Token 在从 Studio 服务器到网关的所有请求中以 <code style={codeStyle}>Authorization: Bearer &lt;token&gt;</code> 形式发送。如果未配置 Token，请求将无认证发送（适用于仅本机部署）。
          </p>
        </section>

        
        <section id="security" style={sectionStyle}>
          <h2 style={h2Style}>16. 安全</h2>

          <h3 style={h3Style}>认证策略</h3>
          <p style={pStyle}>
            Hermes Studio 支持多种认证方法：
          </p>
          <ul style={ulStyle}>
            <li><strong>密码认证：</strong>设置 <code style={codeStyle}>HERMES_PASSWORD</code> 后，用户必须通过登录表单认证。成功后，生成并存储一个 32 字节的加密随机会话 Token。</li>
            <li><strong>OAuth 设备码流程：</strong>用于与外部身份提供方集成。通过 <code style={codeStyle}>/api/oauth/device-code</code> 发起，并通过 <code style={codeStyle}>/api/oauth/poll-token</code> 轮询完成。</li>
            <li><strong>API 密钥认证：</strong><code style={codeStyle}>hermesApiKey</code> 设置支持需要 API 服务器密钥访问的非回环部署。</li>
            <li><strong>无认证：</strong>未配置密码或 Token 时，Studio 允许无认证访问。仅适用于本机开发。</li>
          </ul>

          <h3 style={h3Style}>会话 Token 管理</h3>
          <p style={pStyle}>
            会话 Token 是由 <code style={codeStyle}>crypto.randomBytes</code> 的 32 字节生成的 64 字符十六进制字符串。Token 使用时间安全比较进行验证，以防止时序攻击。Token 存储：
          </p>
          <ul style={ulStyle}>
            <li>内存 Set 用于快速验证（运行进程的事实来源）。</li>
            <li>Redis SET（<code style={codeStyle}>hermes:studio:tokens</code>）用于跨重启持久化，TTL 为 30 天。</li>
            <li>启动时，持久化 Token 从 Redis 加载到内存 Set 中。</li>
          </ul>

          <h3 style={h3Style}>CSRF 防护</h3>
          <p style={pStyle}>
            所有变更端点（POST、PUT、PATCH、DELETE）均受 <code style={codeStyle}>requireJsonContentType</code> 中间件保护。该函数拒绝所有未包含 <code style={codeStyle}>Content-Type: application/json</code> 的请求。由于浏览器无法在简单的表单提交或导航请求中设置此请求头，其存在性证明请求源自 JavaScript（fetch/XHR），从而无需 Token 即可有效防止 CSRF 攻击。
          </p>
          <p style={pStyle}>
            未通过此检查的请求会收到 <code style={codeStyle}>415 Unsupported Media Type</code> 响应，并附带消息 "Content-Type must be application/json"。
          </p>

          <h3 style={h3Style}>路径遍历防护</h3>
          <p style={pStyle}>
            文件访问端点（<code style={codeStyle}>/api/files</code>、<code style={codeStyle}>/api/memory/read</code>、<code style={codeStyle}>/api/memory/write</code>）会验证并清理所有路径参数，以防止目录遍历攻击。路径相对于工作区根目录解析，如果尝试通过 <code style={codeStyle}>..</code> 序列或超出作用域的绝对路径逃逸允许的目录树，将被拒绝。
          </p>

          <h3 style={h3Style}>速率限制</h3>
          <p style={pStyle}>
            滑动窗口内存速率限制器保护敏感端点：
          </p>
          <ul style={ulStyle}>
            <li>按客户端 IP 应用速率限制（从 <code style={codeStyle}>X-Forwarded-For</code> 请求头提取，默认回退到 "local"）。</li>
            <li>滑动窗口跟踪请求时间戳，并移除窗口周期之外的条目。</li>
            <li>当客户端超过限制时，返回 <code style={codeStyle}>429 Too Many Requests</code> 响应。</li>
            <li>旧条目每 5 分钟进行垃圾回收以防止内存泄漏。</li>
            <li>认证端点使用更严格的限制以防止暴力破解攻击。</li>
          </ul>

          <h3 style={h3Style}>内容安全策略</h3>
          <p style={pStyle}>
            应用设置适当的 Content-Security-Policy 请求头以限制资源加载：
          </p>
          <ul style={ulStyle}>
            <li>脚本限制为同源，允许构建系统的内联脚本。</li>
            <li>样式允许同源以及 Google Fonts CDN 用于字体加载。</li>
            <li>连接限制为同源和配置的网关 URL。</li>
            <li>图片允许同源以及用于 base64 编码内容的 data: URI。</li>
          </ul>
        </section>

        
        <section id="keyboard-shortcuts" style={sectionStyle}>
          <h2 style={h2Style}>17. 键盘快捷键</h2>
          <p style={pStyle}>
            Hermes Studio 提供键盘快捷键，用于快速导航和常用操作。修饰键：Windows/Linux 上为 Ctrl，macOS 上为 Cmd。
          </p>

          <h3 style={h3Style}>全局导航</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>快捷键</th><th style={thStyle}>操作</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>Ctrl + K</td><td style={tdStyle}>打开命令面板 / 快速导航</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + ,</td><td style={tdStyle}>打开设置</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 1</td><td style={tdStyle}>跳转到仪表盘</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 2</td><td style={tdStyle}>跳转到会话</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 3</td><td style={tdStyle}>跳转到多智能体团队</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 4</td><td style={tdStyle}>跳转到调度台</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 5</td><td style={tdStyle}>跳转到任务</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 6</td><td style={tdStyle}>跳转到定时任务</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 7</td><td style={tdStyle}>跳转到记忆</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 8</td><td style={tdStyle}>跳转到技能</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + 9</td><td style={tdStyle}>跳转到智能体</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + B</td><td style={tdStyle}>切换侧边栏可见性</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>会话界面</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>快捷键</th><th style={thStyle}>操作</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>Enter</td><td style={tdStyle}>发送消息</td></tr>
              <tr><td style={tdCodeStyle}>Shift + Enter</td><td style={tdStyle}>在消息中换行（不发送）</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + N</td><td style={tdStyle}>创建新会话</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + A</td><td style={tdStyle}>批准待处理操作</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + D</td><td style={tdStyle}>拒绝待处理操作</td></tr>
              <tr><td style={tdCodeStyle}>Escape</td><td style={tdStyle}>取消当前流式响应 / 关闭浮层</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + /</td><td style={tdStyle}>切换检查器面板</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + L</td><td style={tdStyle}>清空会话显示（不删除历史记录）</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>文件编辑器</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>快捷键</th><th style={thStyle}>操作</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>Ctrl + S</td><td style={tdStyle}>保存当前文件</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + P</td><td style={tdStyle}>快速打开文件（模糊搜索）</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + F</td><td style={tdStyle}>跨文件搜索</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Z</td><td style={tdStyle}>撤销</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + Z</td><td style={tdStyle}>重做</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + G</td><td style={tdStyle}>跳转到行号</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>任务看板</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>快捷键</th><th style={thStyle}>操作</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + N</td><td style={tdStyle}>创建新任务</td></tr>
              <tr><td style={tdCodeStyle}>Escape</td><td style={tdStyle}>关闭任务对话框</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Enter</td><td style={tdStyle}>保存任务（对话框打开时）</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>调度台</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>快捷键</th><th style={thStyle}>操作</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>Ctrl + Enter</td><td style={tdStyle}>提交任务目标</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + S</td><td style={tdStyle}>打开调度台设置</td></tr>
              <tr><td style={tdCodeStyle}>Escape</td><td style={tdStyle}>关闭设置抽屉</td></tr>
            </tbody>
          </table>

          <h3 style={h3Style}>终端</h3>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>快捷键</th><th style={thStyle}>操作</th></tr>
            </thead>
            <tbody>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + C</td><td style={tdStyle}>复制终端中的选中文本</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + V</td><td style={tdStyle}>粘贴到终端</td></tr>
              <tr><td style={tdCodeStyle}>Ctrl + Shift + T</td><td style={tdStyle}>打开新终端标签页</td></tr>
            </tbody>
          </table>
        </section>

        {/* 页脚 */}
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--theme-muted)', fontSize: '0.85rem' }}>
          <p>Hermes Studio Documentation v1.20.0</p>
          <p style={{ marginTop: '0.25rem' }}>基于 React 19、TanStack Router、TanStack Query 与 Vite 构建。</p>
        </div>
      </div>
    </div>
  )
}
