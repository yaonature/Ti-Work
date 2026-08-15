export function HelpScreen() {
  const sectionStyle = { borderBottom: '1px solid var(--theme-border-subtle)', paddingBottom: '2rem', marginBottom: '2rem' }
  const h2Style = { color: 'var(--theme-text)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem', marginTop: '0.5rem' }
  const h3Style = { color: 'var(--theme-text)', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', marginTop: '1.5rem' }
  const pStyle = { color: 'var(--theme-muted)', lineHeight: 1.7, marginBottom: '0.75rem' }
  const ulStyle = { color: 'var(--theme-muted)', lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '1rem' }
  const olStyle = { color: 'var(--theme-muted)', lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '1rem' }
  const tipStyle = {
    background: 'var(--theme-accent-subtle)',
    border: '1px solid var(--theme-accent-border)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    color: 'var(--theme-accent)',
    fontSize: '0.9rem',
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
  const kbdStyle = {
    background: 'var(--theme-card2)',
    border: '1px solid var(--theme-border)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: 'var(--theme-text)',
  }
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '1rem',
  }
  const thStyle = {
    textAlign: 'left' as const,
    padding: '0.5rem 1rem',
    borderBottom: '2px solid var(--theme-border)',
    color: 'var(--theme-text)',
    fontWeight: 600,
  }
  const tdStyle = {
    padding: '0.5rem 1rem',
    borderBottom: '1px solid var(--theme-border-subtle)',
    color: 'var(--theme-muted)',
  }
  const tocLinkStyle = {
    color: 'var(--theme-accent)',
    textDecoration: 'none',
    lineHeight: 2,
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: 'var(--theme-bg)' }}>
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 style={{ color: 'var(--theme-text)', fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Ti Work 帮助
        </h1>
        <p style={{ color: 'var(--theme-muted)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
          Ti Work 完整用户指南。使用下方的目录跳转到任意章节。
        </p>

        {/* Table of Contents */}
        <nav style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)', borderRadius: '12px', padding: '1.5rem 2rem', marginBottom: '3rem' }}>
          <h2 style={{ color: 'var(--theme-text)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>目录</h2>
          <ol style={{ ...olStyle, columns: 2, columnGap: '2rem' }}>
            <li><a href="#getting-started" style={tocLinkStyle}>快速上手</a></li>
            <li><a href="#chat" style={tocLinkStyle}>会话</a></li>
            <li><a href="#crews" style={tocLinkStyle}>多智能体团队</a></li>
            <li><a href="#conductor" style={tocLinkStyle}>任务编排</a></li>
            <li><a href="#tasks" style={tocLinkStyle}>任务（看板）</a></li>
            <li><a href="#jobs" style={tocLinkStyle}>定时任务（Cron 调度器）</a></li>
            <li><a href="#memory" style={tocLinkStyle}>记忆与知识图谱</a></li>
            <li><a href="#skills" style={tocLinkStyle}>技能</a></li>
            <li><a href="#agents" style={tocLinkStyle}>智能体（自定义人设）</a></li>
            <li><a href="#files-terminal" style={tocLinkStyle}>文件与终端</a></li>
            <li><a href="#analytics" style={tocLinkStyle}>数据分析与审计</a></li>
            <li><a href="#settings" style={tocLinkStyle}>设置与配置</a></li>
            <li><a href="#keyboard-shortcuts" style={tocLinkStyle}>键盘快捷键</a></li>
            <li><a href="#troubleshooting" style={tocLinkStyle}>故障排查</a></li>
          </ol>
        </nav>

        {/* Section 1: Getting Started */}
        <section id="getting-started" style={sectionStyle}>
          <h2 style={h2Style}>1. 快速上手</h2>

          <h3 style={h3Style}>连接 Hermes 执行引擎（网关）</h3>
          <p style={pStyle}>
            Ti Work 通过 Hermes 执行引擎（网关）服务器与您的 AI 智能体通信。在使用任何功能之前，您需要先建立连接。
          </p>
          <ol style={olStyle}>
            <li>点击侧边栏中的齿轮图标打开<strong>设置</strong>页面，或按 <kbd style={kbdStyle}>Ctrl+,</kbd>。</li>
            <li>在<strong>连接</strong>部分，输入您的网关地址（例如 <code>http://localhost:3001</code> 或您的远程服务器地址）。</li>
            <li>如果您的网关需要 API 密钥，请在<strong>API 密钥</strong>字段中填写。</li>
            <li>点击<strong>测试连接</strong>以验证连通性。</li>
            <li>顶部状态栏中的绿色指示灯表示连接成功。</li>
          </ol>
          <div style={tipStyle}>
            <strong>提示：</strong>如果您在本地运行 Hermes 执行引擎（网关），默认地址通常为 <code>http://localhost:3001</code>。顶部导航栏中的连接状态指示灯在已连接时显示绿色，断开时显示红色。
          </div>

          <h3 style={h3Style}>首次设置</h3>
          <p style={pStyle}>
            首次启动 Ti Work 时，可能会出现设置向导引导您完成初始配置。如果向导未出现，请按照以下步骤操作：
          </p>
          <ol style={olStyle}>
            <li>配置您的网关连接（参见上文）。</li>
            <li>进入<strong>设置</strong>，在<strong>外观</strong>下选择您偏好的主题和强调色。</li>
            <li>可选：在<strong>身份</strong>部分设置您的身份文件（SOUL.md 和 persona.md），以个性化您的 AI 交互。</li>
            <li>浏览技能注册表，安装您的工作流所需的技能。</li>
          </ol>

          <h3 style={h3Style}>导航概览</h3>
          <p style={pStyle}>
            左侧边栏是您的主要导航区域。每个图标代表一个主要功能区域：
          </p>
          <ul style={ulStyle}>
            <li><strong>会话</strong> - 直接与您的 AI 智能体对话</li>
            <li><strong>多智能体团队</strong> - 多智能体团队管理</li>
            <li><strong>任务编排</strong> - 任务调度与监控</li>
            <li><strong>任务</strong> - 看板式任务面板</li>
            <li><strong>定时任务</strong> - Cron 定时任务管理</li>
            <li><strong>记忆</strong> - 知识图谱与记忆文件</li>
            <li><strong>技能</strong> - 技能注册表与管理</li>
            <li><strong>智能体</strong> - 自定义智能体人设</li>
            <li><strong>文件</strong> - 文件浏览器与编辑器</li>
            <li><strong>终端</strong> - 集成终端</li>
            <li><strong>数据分析</strong> - 使用分析与审计日志</li>
            <li><strong>设置</strong> - 应用程序配置</li>
          </ul>
          <p style={pStyle}>
            您可以点击顶部的汉堡菜单图标收起侧边栏。在较小屏幕上，侧边栏会自动收起。
          </p>
        </section>

        {/* Section 2: Chat */}
        <section id="chat" style={sectionStyle}>
          <h2 style={h2Style}>2. 会话</h2>

          <h3 style={h3Style}>开始对话</h3>
          <p style={pStyle}>
            会话页面是与 AI 智能体交互的主要界面。要开始新的对话：
          </p>
          <ol style={olStyle}>
            <li>点击侧边栏中的<strong>会话</strong>图标打开会话页面。</li>
            <li>在页面底部的输入框中输入您的消息。</li>
            <li>按 <kbd style={kbdStyle}>Enter</kbd> 发送消息，或按 <kbd style={kbdStyle}>Shift+Enter</kbd> 插入换行而不发送。</li>
            <li>AI 将实时开始流式输出回复。</li>
          </ol>

          <h3 style={h3Style}>管理会话</h3>
          <p style={pStyle}>
            每段对话都存在于一个会话中。您可以使用会话面板管理会话：
          </p>
          <ul style={ulStyle}>
            <li>点击会话侧边栏中的<strong>+</strong>按钮创建新会话。</li>
            <li>点击列表中的任意现有会话即可切换。</li>
            <li>右键点击会话可重命名或删除。</li>
            <li>会话在应用重启后仍然保留，因此您可以稍后继续对话。</li>
          </ul>

          <h3 style={h3Style}>审批（批准 / 拒绝 / 始终允许）</h3>
          <p style={pStyle}>
            当 AI 想要执行需要权限的操作（例如运行命令、写入文件或访问资源）时，会出现审批提示：
          </p>
          <ul style={ulStyle}>
            <li><strong>批准</strong> - 仅允许这一次具体操作。</li>
            <li><strong>拒绝</strong> - 拒绝该操作。AI 将收到通知，并可能提出替代方案。</li>
            <li><strong>始终允许</strong> - 在当前会话中永久批准此类操作。该权限会被记住，因此系统不会再就相同的工具或模式询问您。</li>
          </ul>
          <div style={noteStyle}>
            <strong>注意：</strong>您可以在<strong>设置</strong>中的<strong>权限与安全</strong>下查看和管理始终允许的权限。
          </div>

          <h3 style={h3Style}>文件附件</h3>
          <p style={pStyle}>
            您可以在消息中附加文件供 AI 分析或处理：
          </p>
          <ol style={olStyle}>
            <li>点击消息输入框旁边的回形针图标。</li>
            <li>在文件选择对话框中选中一个或多个文件。</li>
            <li>附加的文件会以标签形式显示在输入框上方。点击标签上的 X 可将其移除。</li>
            <li>照常发送消息 - AI 将能够访问文件内容。</li>
          </ol>

          <h3 style={h3Style}>流式输出</h3>
          <p style={pStyle}>
            回复会逐字流式输出，带来实时体验。在回复流式输出期间：
          </p>
          <ul style={ulStyle}>
            <li>您可以随时点击<strong>停止</strong>按钮终止生成。</li>
            <li>工具调用及其结果以可折叠的内联块形式显示。</li>
            <li>代码块带有语法高亮，并包含复制按钮。</li>
            <li>富文本格式（标题、列表、表格、链接）会自动渲染。</li>
          </ul>
        </section>

        {/* Section 3: Crews */}
        <section id="crews" style={sectionStyle}>
          <h2 style={h2Style}>3. 多智能体团队</h2>

          <h3 style={h3Style}>创建团队</h3>
          <p style={pStyle}>
            团队让您可以将多个 AI 智能体组织成一个团队，共同处理复杂任务。要创建新团队：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>多智能体团队</strong>页面。</li>
            <li>点击右上角的<strong>+ 新建团队</strong>按钮。</li>
            <li>为团队输入名称和可选描述。</li>
            <li>选择从头开始创建还是使用模板。</li>
            <li>点击<strong>创建</strong>完成。</li>
          </ol>

          <h3 style={h3Style}>添加成员</h3>
          <p style={pStyle}>
            创建团队后，您需要添加将参与协作的智能体成员：
          </p>
          <ol style={olStyle}>
            <li>在团队列表中点击您的团队以打开。</li>
            <li>在成员面板中点击<strong>添加成员</strong>。</li>
            <li>选择可用的智能体之一，或就地创建新智能体。</li>
            <li>为成员分配角色（例如研究员、开发者、审查者）。</li>
            <li>可选：设置特定指令，以在该团队上下文中覆盖智能体的默认提示词。</li>
          </ol>

          <h3 style={h3Style}>使用模板</h3>
          <p style={pStyle}>
            模板为常见工作流提供预配置的团队设置：
          </p>
          <ul style={ulStyle}>
            <li><strong>研究团队</strong> - 专为深度研究配置的团队，包含专职研究员和总结智能体。</li>
            <li><strong>开发团队</strong> - 包含架构师、开发者和代码审查智能体。</li>
            <li><strong>内容团队</strong> - 用于内容创作的写作、编辑和事实核查智能体。</li>
          </ul>
          <p style={pStyle}>
            创建团队时选择模板，可自动填充合适的成员和设置。
          </p>

          <h3 style={h3Style}>派发任务</h3>
          <p style={pStyle}>
            团队设置完成后，您可以向其派发任务：
          </p>
          <ol style={olStyle}>
            <li>打开团队详情视图。</li>
            <li>点击<strong>派发任务</strong>，或使用底部的输入框。</li>
            <li>描述您希望团队完成的目标。</li>
            <li>任务将根据成员的角色和工作流配置分发给团队成员。</li>
          </ol>

          <h3 style={h3Style}>克隆团队</h3>
          <p style={pStyle}>
            要复制现有团队及其全部配置：
          </p>
          <ol style={olStyle}>
            <li>右键点击列表中的团队，或点击团队卡片上的三点菜单。</li>
            <li>选择<strong>克隆团队</strong>。</li>
            <li>系统会创建具有相同成员、角色和设置的新团队。您可以根据需要重命名和修改它。</li>
          </ol>

          <h3 style={h3Style}>工作流构建器（DAG 编辑器）</h3>
          <p style={pStyle}>
            工作流构建器让您可以使用可视化有向无环图（DAG）定义任务在团队成员之间的流转方式：
          </p>
          <ol style={olStyle}>
            <li>打开团队并切换到<strong>工作流</strong>标签页。</li>
            <li>每个团队成员以画布上的节点形式显示。</li>
            <li>在节点之间拖拽连线以定义任务流转（谁将工作交接给谁）。</li>
            <li>点击连线可配置条件或转换。</li>
            <li>使用工具栏添加决策节点、并行分支或汇合点。</li>
            <li>使用<strong>保存</strong>按钮或按 <kbd style={kbdStyle}>Ctrl+S</kbd> 保存您的工作流。</li>
          </ol>
          <div style={tipStyle}>
            <strong>提示：</strong>您可以使用滚轮缩放画布并拖拽平移。双击节点可编辑其属性。
          </div>

          <h3 style={h3Style}>监控团队运行</h3>
          <p style={pStyle}>
            团队工作时，您可以监控其进度：
          </p>
          <ul style={ulStyle}>
            <li>团队卡片显示实时状态指示（空闲、工作中、已完成、错误）。</li>
            <li>点击进入团队可查看每个成员的当前活动。</li>
            <li>时间线视图显示成员之间的操作序列和交接过程。</li>
            <li>每个成员的输出显示在各自的面板中。</li>
          </ul>
        </section>

        {/* Section 4: Conductor */}
        <section id="conductor" style={sectionStyle}>
          <h2 style={h2Style}>4. 任务编排</h2>

          <h3 style={h3Style}>启动任务</h3>
          <p style={pStyle}>
            任务编排是您编排复杂多步骤任务的指挥中心。要启动新任务：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>任务编排</strong>页面。</li>
            <li>在主输入框中输入您的任务目标。请尽可能具体地描述您希望达成的结果。</li>
            <li>点击<strong>启动任务</strong>或按 <kbd style={kbdStyle}>Ctrl+Enter</kbd>。</li>
            <li>任务编排将分析您的目标、制定计划并开始派发执行器。</li>
          </ol>

          <h3 style={h3Style}>快捷操作（研究 / 构建 / 审查 / 部署）</h3>
          <p style={pStyle}>
            对于常见任务类型，可使用输入框下方的快捷操作按钮：
          </p>
          <ul style={ulStyle}>
            <li><strong>研究</strong> - 使用专注于信息收集与综合的智能体启动研究类任务。</li>
            <li><strong>构建</strong> - 创建包含代码编写执行器和自动化测试的开发任务。</li>
            <li><strong>审查</strong> - 启动代码审查任务，检查您的代码库中的问题、改进点和最佳实践。</li>
            <li><strong>部署</strong> - 启动包含部署前检查和发布步骤的部署流水线任务。</li>
          </ul>
          <p style={pStyle}>
            每个快捷操作都会为该任务类型预配置合适的模型、执行器数量和监督设置。
          </p>

          <h3 style={h3Style}>设置（模型、并行执行器、监督模式）</h3>
          <p style={pStyle}>
            启动任务前，点击输入框旁边的齿轮图标配置其参数：
          </p>
          <ul style={ulStyle}>
            <li><strong>模型</strong> - 选择驱动任务的 AI 模型（例如 Claude Opus、Claude Sonnet）。更强大的模型能更好地处理复杂推理，但成本更高。</li>
            <li><strong>并行执行器</strong> - 设置同时工作的智能体数量（1-8）。执行器越多执行越快，但成本也越高。</li>
            <li><strong>监督模式</strong> - 启用后，任务编排会在每次重大操作前暂停并请求您的批准。关闭后则完全自主运行。</li>
          </ul>

          <h3 style={h3Style}>办公室视图（3 种布局）</h3>
          <p style={pStyle}>
            办公室视图是活动任务的动态可视化界面。它将会话中的执行器显示为坐在办公桌前处理各自子任务的动画角色。您可以在三种布局之间切换：
          </p>
          <ul style={ulStyle}>
            <li><strong>网格布局</strong> - 执行器以网格排列。适合同时查看多个执行器。每个执行器占据一个单元格，显示其头像、当前任务摘要和状态指示。</li>
            <li><strong>行布局</strong> - 执行器以水平行显示，每个执行器显示更多细节。展示展开的任务描述和最近的输出片段。</li>
            <li><strong>聚焦布局</strong> - 在大型中央视图中突出显示一个执行器，显示完整流式输出。其他执行器以缩略图形式显示在侧边。点击缩略图可聚焦到其他执行器。</li>
          </ul>
          <p style={pStyle}>
            使用办公室视图右上角的布局切换按钮。执行器带有动画：积极生成时显示打字动画，处理中显示思考动画，等待输入时显示空闲状态。
          </p>

          <h3 style={h3Style}>监控执行器</h3>
          <p style={pStyle}>
            办公室视图中的每个执行器都显示：
          </p>
          <ul style={ulStyle}>
            <li>彩色状态环：蓝色（工作中）、绿色（子任务完成）、黄色（等待批准）、红色（错误）。</li>
            <li>当前正在处理的子任务，以标题形式显示在执行器上方。</li>
            <li>显示其子任务完成进度的进度指示器。</li>
            <li>点击任意执行器可展开其详情面板并查看完整流式输出。</li>
          </ul>

          <h3 style={h3Style}>暂停 / 恢复 / 中止</h3>
          <p style={pStyle}>
            使用顶部工具栏中的传输控制按钮控制正在运行的任务：
          </p>
          <ul style={ulStyle}>
            <li><strong>暂停</strong> - 暂时停止所有执行器。它们会完成当前的令牌生成，但不会开始新的子任务。点击<strong>恢复</strong>继续。</li>
            <li><strong>恢复</strong> - 从暂停位置继续任务。</li>
            <li><strong>中止</strong> - 永久停止任务。所有执行器将被终止。此操作无法撤销，但您可以启动一个具有相同目标的新任务。</li>
          </ul>

          <h3 style={h3Style}>任务历史与成本跟踪</h3>
          <p style={pStyle}>
            所有已完成和中止的任务都会保存到您的任务历史中：
          </p>
          <ul style={ulStyle}>
            <li>点击<strong>历史</strong>标签页查看过往任务。</li>
            <li>每条记录显示目标、状态、时长和总成本。</li>
            <li>成本按执行器的模型使用量（输入令牌、输出令牌）细分。</li>
            <li>点击历史任务可查看其完整输出和时间线。</li>
          </ul>
        </section>

        {/* Section 5: Tasks */}
        <section id="tasks" style={sectionStyle}>
          <h2 style={h2Style}>5. 任务（看板）</h2>

          <h3 style={h3Style}>创建任务</h3>
          <p style={pStyle}>
            任务页面提供用于组织工作项的看板。要创建新任务：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>任务</strong>页面。</li>
            <li>点击任意列顶部的<strong>+</strong>按钮（待办、进行中、审查、已完成）。</li>
            <li>输入任务标题。</li>
            <li>可选：添加描述、设置优先级、添加标签，并将其分配给智能体或团队。</li>
            <li>点击<strong>创建</strong>或按 <kbd style={kbdStyle}>Enter</kbd> 将任务添加到该列。</li>
          </ol>

          <h3 style={h3Style}>跨列拖放</h3>
          <p style={pStyle}>
            通过点击和拖拽在列之间移动任务：
          </p>
          <ol style={olStyle}>
            <li>点击并按住任务卡片。</li>
            <li>将其拖到目标列。</li>
            <li>松开即可放下。任务状态会自动更新。</li>
            <li>您还可以通过上下拖拽在列内重新排列任务。</li>
          </ol>

          <h3 style={h3Style}>优先级、标签与负责人</h3>
          <p style={pStyle}>
            每个任务都可以附加元数据：
          </p>
          <ul style={ulStyle}>
            <li><strong>优先级</strong> - 点击旗帜图标循环切换优先级：无、低、中、高、紧急。高和紧急任务会获得视觉强调。</li>
            <li><strong>标签</strong> - 添加彩色标签以分类任务（例如“bug”、“feature”、“docs”）。点击标签图标添加或创建标签。</li>
            <li><strong>负责人</strong> - 将任务分配给特定智能体或团队。点击头像图标并从可用智能体中选择。</li>
          </ul>

          <h3 style={h3Style}>关联团队 / 任务编排</h3>
          <p style={pStyle}>
            任务可以关联到团队运行或编排运行：
          </p>
          <ul style={ulStyle}>
            <li>当任务编排创建子任务时，它们会自动出现在看板上，并带有指向该次运行的链接。</li>
            <li>您可以在任务详情视图中点击<strong>关联团队</strong>手动将任务关联到团队。</li>
            <li>已关联的任务会显示来自所关联团队或运行的实时状态更新。</li>
          </ul>
        </section>

        {/* Section 6: Jobs */}
        <section id="jobs" style={sectionStyle}>
          <h2 style={h2Style}>6. 定时任务（Cron 调度器）</h2>

          <h3 style={h3Style}>创建定时任务</h3>
          <p style={pStyle}>
            定时任务让您可以在 Cron 计划上调度周期性 AI 任务。要创建新的定时任务：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>定时任务</strong>页面。</li>
            <li>点击右上角的<strong>+ 新建定时任务</strong>。</li>
            <li>输入任务的名称和描述。</li>
            <li>定义 AI 每次运行时应执行的提示词或任务。</li>
            <li>设置计划（见下文）。</li>
            <li>配置输出的投递渠道。</li>
            <li>点击<strong>创建定时任务</strong>保存。</li>
          </ol>

          <h3 style={h3Style}>计划预设与自定义 Cron</h3>
          <p style={pStyle}>
            从常见预设中选择，或编写自定义 Cron 表达式：
          </p>
          <ul style={ulStyle}>
            <li><strong>每小时</strong> - 每个整点运行。</li>
            <li><strong>每天早上 9 点</strong> - 每天早晨运行。</li>
            <li><strong>每周一</strong> - 每周一零点运行。</li>
            <li><strong>自定义</strong> - 输入任意有效的 Cron 表达式（例如 <code>*/15 * * * *</code> 表示每 15 分钟运行一次）。</li>
          </ul>
          <p style={pStyle}>
            输入框下方的计划预览会显示接下来 5 次计划运行时间，方便您确认计划是否正确。
          </p>

          <h3 style={h3Style}>投递渠道</h3>
          <p style={pStyle}>
            配置每次运行后任务输出的去向：
          </p>
          <ul style={ulStyle}>
            <li><strong>应用内</strong> - 结果显示在定时任务页面的运行历史中（始终启用）。</li>
            <li><strong>Telegram</strong> - 将结果发送到 Telegram 聊天或群组。</li>
            <li><strong>Discord</strong> - 通过 webhook 将结果发布到 Discord 频道。</li>
            <li><strong>Slack</strong> - 将结果发送到 Slack 频道。</li>
            <li><strong>电子邮件</strong> - 将结果发送到指定邮箱地址。</li>
          </ul>

          <h3 style={h3Style}>手动运行任务</h3>
          <p style={pStyle}>
            您不必等到计划时间才能测试任务：
          </p>
          <ol style={olStyle}>
            <li>在任务列表中找到该任务。</li>
            <li>点击任务卡片上的<strong>立即运行</strong>按钮（播放图标）。</li>
            <li>任务会立即执行，结果将出现在运行历史中。</li>
          </ol>

          <h3 style={h3Style}>监控运行历史</h3>
          <p style={pStyle}>
            每个任务都会保留其执行记录：
          </p>
          <ul style={ulStyle}>
            <li>点击任务可查看包含完整运行历史的详情视图。</li>
            <li>每次运行显示：时间戳、时长、状态（成功/失败）和输出。</li>
            <li>失败的运行会显示错误详情，方便您诊断问题。</li>
            <li>如果列表过长，可使用<strong>清除历史</strong>按钮移除旧记录。</li>
          </ul>
        </section>

        {/* Section 7: Memory */}
        <section id="memory" style={sectionStyle}>
          <h2 style={h2Style}>7. 记忆与知识图谱</h2>

          <h3 style={h3Style}>浏览记忆文件</h3>
          <p style={pStyle}>
            记忆页面让您可以访问 AI 的持久记忆，它以结构化文件的形式存储：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>记忆</strong>页面。</li>
            <li>左侧的文件树按类别显示所有记忆文件。</li>
            <li>点击任意文件可在主面板中查看其内容。</li>
            <li>记忆文件通常是包含事实、偏好和学习到的上下文的结构化文档。</li>
          </ol>

          <h3 style={h3Style}>知识图谱可视化</h3>
          <p style={pStyle}>
            切换到<strong>图谱</strong>标签页，查看记忆条目之间关系的交互式可视化：
          </p>
          <ul style={ulStyle}>
            <li>节点代表单个记忆条目或概念。</li>
            <li>边显示条目之间的关系（引用、依赖、类别）。</li>
            <li>悬停在节点上可预览其内容。</li>
            <li>点击节点可在详情面板中打开完整条目。</li>
            <li>使用滚轮缩放，拖拽平移图谱。</li>
            <li>图谱使用力导向算法自动布局，但您可以拖拽节点重新定位。</li>
          </ul>

          <h3 style={h3Style}>搜索条目</h3>
          <p style={pStyle}>
            使用记忆页面顶部的搜索栏查找特定条目：
          </p>
          <ul style={ulStyle}>
            <li>输入关键字可过滤文件列表并高亮匹配条目。</li>
            <li>搜索覆盖文件名、内容和标签。</li>
            <li>结果随输入实时更新。</li>
          </ul>

          <h3 style={h3Style}>编辑记忆</h3>
          <p style={pStyle}>
            您可以手动编辑记忆条目，以纠正或补充 AI 的知识：
          </p>
          <ol style={olStyle}>
            <li>在树中点击记忆文件将其打开。</li>
            <li>点击<strong>编辑</strong>按钮（铅笔图标）进入编辑模式。</li>
            <li>根据需要修改文档内容。</li>
            <li>点击<strong>保存</strong>或按 <kbd style={kbdStyle}>Ctrl+S</kbd> 持久化您的更改。</li>
          </ol>
          <div style={tipStyle}>
            <strong>提示：</strong>对记忆文件的更改会立即生效。AI 将在后续对话中使用更新后的信息。
          </div>
        </section>

        {/* Section 8: Skills */}
        <section id="skills" style={sectionStyle}>
          <h2 style={h2Style}>8. 技能</h2>

          <h3 style={h3Style}>浏览技能注册表</h3>
          <p style={pStyle}>
            技能是扩展 AI 能力的模块化功能。要浏览可用技能：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>技能</strong>页面。</li>
            <li>注册表以卡片形式显示所有可用技能，包含名称、描述和状态。</li>
            <li>使用搜索栏按名称或类别过滤技能。</li>
            <li>点击技能卡片可查看完整详情，包括文档和配置选项。</li>
          </ol>

          <h3 style={h3Style}>安装技能</h3>
          <p style={pStyle}>
            要向您的环境添加新技能：
          </p>
          <ol style={olStyle}>
            <li>在注册表中找到您想要的技能。</li>
            <li>点击技能卡片上的<strong>安装</strong>按钮。</li>
            <li>如果技能需要配置（API 密钥、参数），会出现配置表单。填写必填字段。</li>
            <li>点击<strong>确认</strong>完成安装。</li>
            <li>该技能现在可用于会话、团队和任务中。</li>
          </ol>

          <h3 style={h3Style}>启用 / 禁用技能</h3>
          <p style={pStyle}>
            您可以在不卸载的情况下暂时禁用技能：
          </p>
          <ul style={ulStyle}>
            <li>切换任意已安装技能卡片上的开关以启用或禁用。</li>
            <li>禁用的技能会保留其配置，但不会提供给 AI 使用。</li>
            <li>这对于故障排查或临时限制 AI 能力非常有用。</li>
          </ul>
        </section>

        {/* Section 9: Agents */}
        <section id="agents" style={sectionStyle}>
          <h2 style={h2Style}>9. 智能体（自定义人设）</h2>

          <h3 style={h3Style}>创建自定义智能体</h3>
          <p style={pStyle}>
            智能体是具有特定行为和专长的自定义 AI 人设。要创建一个：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>智能体</strong>页面。</li>
            <li>点击右上角的<strong>+ 新建智能体</strong>。</li>
            <li>为智能体输入名称（例如“代码审查员”、“技术文档撰写者”）。</li>
            <li>编写定义智能体个性、专长和行为规则的系统提示词。</li>
            <li>自定义外观（Emoji 头像和强调色）。</li>
            <li>点击<strong>创建</strong>保存智能体。</li>
          </ol>

          <h3 style={h3Style}>Emoji 与颜色自定义</h3>
          <p style={pStyle}>
            让您的智能体在外观上与众不同：
          </p>
          <ul style={ulStyle}>
            <li>点击 Emoji 选择器，选择代表智能体角色的头像 Emoji。</li>
            <li>从调色板中选择强调色。该颜色用于智能体的会话气泡、团队成员指示器和编排执行器光晕。</li>
            <li>Emoji 和颜色会出现在应用中引用该智能体的所有位置。</li>
          </ul>

          <h3 style={h3Style}>系统提示词</h3>
          <p style={pStyle}>
            系统提示词是智能体身份的核心。编写它来定义：
          </p>
          <ul style={ulStyle}>
            <li><strong>角色</strong> - 智能体是什么（例如“您是一名专注于分布式系统的高级后端工程师”）。</li>
            <li><strong>行为</strong> - 智能体应如何响应（例如“始终为代码更改建议测试”）。</li>
            <li><strong>约束</strong> - 智能体应避免什么（例如“切勿修改生产配置文件”）。</li>
            <li><strong>语气</strong> - 沟通风格（例如“简洁直接，使用项目符号”）。</li>
          </ul>

          <h3 style={h3Style}>在团队中使用智能体</h3>
          <p style={pStyle}>
            创建完成后，智能体可以分配到团队中：
          </p>
          <ul style={ulStyle}>
            <li>向团队添加成员时，您的自定义智能体会出现在智能体选择下拉列表中。</li>
            <li>每个智能体都会将其系统提示词和个性带入团队上下文。</li>
            <li>您可以在不更改智能体基础配置的情况下，按团队覆盖特定指令。</li>
          </ul>
        </section>

        {/* Section 10: Files & Terminal */}
        <section id="files-terminal" style={sectionStyle}>
          <h2 style={h2Style}>10. 文件与终端</h2>

          <h3 style={h3Style}>文件浏览器导航</h3>
          <p style={pStyle}>
            文件页面提供用于浏览您项目的完整文件浏览器：
          </p>
          <ul style={ulStyle}>
            <li>左侧面板显示文件树。点击文件夹可展开/收起。</li>
            <li>点击文件可在右侧的编辑器面板中打开。</li>
            <li>右键点击文件或文件夹会显示上下文菜单，包含以下选项：重命名、删除、复制路径、新建文件、新建文件夹。</li>
            <li>使用顶部的面包屑路径在目录树中向上导航。</li>
          </ul>

          <h3 style={h3Style}>编辑文件（内置代码编辑器）</h3>
          <p style={pStyle}>
            文件在内置代码编辑器中打开，提供现代化的编辑体验：
          </p>
          <ul style={ulStyle}>
            <li>支持所有主流语言的完整语法高亮。</li>
            <li>在语言服务器可用时提供 IntelliSense 式自动补全。</li>
            <li>使用 <kbd style={kbdStyle}>Ctrl+F</kbd> 和 <kbd style={kbdStyle}>Ctrl+H</kbd> 查找和替换。</li>
            <li>使用 <kbd style={kbdStyle}>Ctrl+S</kbd> 保存文件。未保存的更改会以文件标签页上的圆点标示。</li>
            <li>可以在标签页中同时打开多个文件。</li>
          </ul>

          <h3 style={h3Style}>使用终端</h3>
          <p style={pStyle}>
            集成终端为您提供 Ti Work 内部的 shell 环境：
          </p>
          <ol style={olStyle}>
            <li>从侧边栏进入<strong>终端</strong>页面，或按 <kbd style={kbdStyle}>Ctrl+`</kbd> 将其作为底部面板切换显示。</li>
            <li>终端会在您项目的工作目录中打开。</li>
            <li>像在普通终端中一样运行任意 shell 命令。</li>
            <li>支持多个终端标签页 - 点击<strong>+</strong>创建新标签页。</li>
          </ol>
          <div style={noteStyle}>
            <strong>注意：</strong>终端连接到运行 Hermes 执行引擎（网关）的同一系统。命令会在该机器上执行。
          </div>
        </section>

        {/* Section 11: Analytics & Audit */}
        <section id="analytics" style={sectionStyle}>
          <h2 style={h2Style}>11. 数据分析与审计</h2>

          <h3 style={h3Style}>事件分析仪表盘</h3>
          <p style={pStyle}>
            数据分析页面提供对您 AI 使用模式的洞察：
          </p>
          <ul style={ulStyle}>
            <li>查看显示消息数量、令牌使用量和成本随时间变化的图表。</li>
            <li>使用顶栏中的日期选择器按日期范围过滤。</li>
            <li>按智能体、模型或会话细分使用量。</li>
            <li>将数据导出为电子表格文件以进行进一步分析。</li>
          </ul>

          <h3 style={h3Style}>会话历史</h3>
          <p style={pStyle}>
            查看您所有的过往会话：
          </p>
          <ul style={ulStyle}>
            <li>每个会话显示其开始时间、消息数量和令牌使用量。</li>
            <li>点击会话可查看完整对话记录。</li>
            <li>使用搜索按内容或日期查找会话。</li>
          </ul>

          <h3 style={h3Style}>审计追踪</h3>
          <p style={pStyle}>
            审计追踪记录 AI 执行的每一项重要操作：
          </p>
          <ul style={ulStyle}>
            <li>文件修改、命令执行和 API 调用都会被记录。</li>
            <li>每条记录包含时间戳、操作类型、详情以及执行该操作的智能体。</li>
            <li>按操作类型或严重级别过滤。</li>
            <li>这对于受监督环境中的责任追溯至关重要。</li>
          </ul>

          <h3 style={h3Style}>日志查看器</h3>
          <p style={pStyle}>
            访问原始系统日志以进行调试和监控：
          </p>
          <ul style={ulStyle}>
            <li>点击数据分析中的<strong>日志</strong>标签页。</li>
            <li>日志实时流式输出，并带有按严重级别着色的标记（信息、警告、错误）。</li>
            <li>使用过滤栏搜索特定日志条目。</li>
            <li>点击<strong>暂停</strong>冻结日志流，便于阅读。</li>
          </ul>
        </section>

        {/* Section 12: Settings */}
        <section id="settings" style={sectionStyle}>
          <h2 style={h2Style}>12. 设置与配置</h2>

          <h3 style={h3Style}>连接设置</h3>
          <p style={pStyle}>
            配置 Ti Work 如何连接到您的网关：
          </p>
          <ul style={ulStyle}>
            <li><strong>网关地址</strong> - 您的 Hermes 执行引擎（网关）服务器的 HTTP 地址。</li>
            <li><strong>API 密钥</strong> - 受保护网关的认证密钥。</li>
            <li><strong>重连间隔</strong> - 连接断开时的重试频率（默认：5 秒）。</li>
            <li><strong>实时连接</strong> - 启用/禁用用于实时流式输出的实时连接通道（建议：启用）。</li>
          </ul>

          <h3 style={h3Style}>外观（主题、强调色）</h3>
          <p style={pStyle}>
            自定义 Ti Work 的视觉效果：
          </p>
          <ul style={ulStyle}>
            <li><strong>主题</strong> - 从可用的深色主题中选择。应用设计为仅深色模式，以在长时间会话中获得最佳可读性。</li>
            <li><strong>强调色</strong> - 选择用于高亮交互元素、按钮和界面中激活状态的主强调色。</li>
            <li><strong>字体大小</strong> - 调整基础字体大小以获得更好的可读性。</li>
            <li>更改无需重启即可立即生效。</li>
          </ul>

          <h3 style={h3Style}>集成（消息平台等）</h3>
          <p style={pStyle}>
            连接外部服务以接收通知和投递：
          </p>
          <ol style={olStyle}>
            <li>进入<strong>设置</strong>并打开<strong>集成</strong>标签页。</li>
            <li>点击<strong>添加集成</strong>并选择服务。</li>
            <li>按照特定于服务的设置进行操作（例如为 Telegram 粘贴机器人令牌、为 Discord 提供 webhook 地址）。</li>
            <li>使用<strong>发送测试</strong>按钮测试集成。</li>
            <li>配置完成后，这些集成可用作定时任务的投递渠道和通知。</li>
          </ol>

          <h3 style={h3Style}>MCP 服务</h3>
          <p style={pStyle}>
            管理模型上下文协议（MCP）服务器连接：
          </p>
          <ul style={ulStyle}>
            <li>MCP 服务器为 AI 提供额外的工具和能力。</li>
            <li>点击<strong>添加 MCP 服务器</strong>按地址注册新服务器。</li>
            <li>每个服务器显示其可用工具和连接状态。</li>
            <li>切换服务器的开关以控制哪些工具可用。</li>
          </ul>

          <h3 style={h3Style}>权限与安全</h3>
          <p style={pStyle}>
            控制 AI 被允许执行的操作：
          </p>
          <ul style={ulStyle}>
            <li><strong>自动批准的路径</strong> - AI 无需询问即可读写这些文件路径。</li>
            <li><strong>阻止的命令</strong> - AI 永远不允许运行的 shell 命令。</li>
            <li><strong>始终允许规则</strong> - 查看和撤销会话期间授予的始终允许权限。</li>
            <li><strong>默认监督模式</strong> - 设置新任务是否默认以监督模式启动。</li>
          </ul>

          <h3 style={h3Style}>身份文件（SOUL.md、persona.md）</h3>
          <p style={pStyle}>
            身份文件塑造 AI 在所有交互中的核心个性：
          </p>
          <ul style={ulStyle}>
            <li><strong>SOUL.md</strong> - 定义 AI 的基本价值观、沟通风格和行为准则。这是最深层的个性层。</li>
            <li><strong>persona.md</strong> - 更表层的身份文件，定义语气、偏好和交互模式。</li>
            <li>可以在设置的<strong>身份</strong>部分编辑这些文件，或直接通过文件页面编辑。</li>
            <li>更改在新会话中生效；现有会话保留其原始上下文。</li>
          </ul>

          <h3 style={h3Style}>Systemd 自启动</h3>
          <p style={pStyle}>
            配置 Hermes 执行引擎（网关）随系统自动启动：
          </p>
          <ol style={olStyle}>
            <li>在<strong>设置</strong>中找到<strong>系统</strong>部分。</li>
            <li>点击<strong>安装 Systemd 服务</strong>。</li>
            <li>应用会生成系统服务单元文件并为您安装。</li>
            <li>使用<strong>启用</strong>开关控制是否随开机启动。</li>
            <li><strong>状态</strong>指示器显示服务当前是否处于活动状态。</li>
          </ol>
        </section>

        {/* Section 13: Keyboard Shortcuts */}
        <section id="keyboard-shortcuts" style={sectionStyle}>
          <h2 style={h2Style}>13. 键盘快捷键</h2>
          <p style={pStyle}>
            Ti Work 支持用于快速导航和常见操作的键盘快捷键。以下是完整参考：
          </p>

          <h3 style={h3Style}>全局导航</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>快捷键</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>1</kbd></td>
                <td style={tdStyle}>前往会话</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>2</kbd></td>
                <td style={tdStyle}>前往多智能体团队</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>3</kbd></td>
                <td style={tdStyle}>前往任务编排</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>4</kbd></td>
                <td style={tdStyle}>前往任务</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>5</kbd></td>
                <td style={tdStyle}>前往定时任务</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>6</kbd></td>
                <td style={tdStyle}>前往记忆</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>7</kbd></td>
                <td style={tdStyle}>前往文件</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>,</kbd></td>
                <td style={tdStyle}>打开设置</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>K</kbd></td>
                <td style={tdStyle}>打开命令面板</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>B</kbd></td>
                <td style={tdStyle}>切换侧边栏</td>
              </tr>
            </tbody>
          </table>

          <h3 style={h3Style}>会话</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>快捷键</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Enter</kbd></td>
                <td style={tdStyle}>发送消息</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Shift</kbd> + <kbd style={kbdStyle}>Enter</kbd></td>
                <td style={tdStyle}>在消息中插入换行</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>N</kbd></td>
                <td style={tdStyle}>新建会话</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Escape</kbd></td>
                <td style={tdStyle}>停止流式输出</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>L</kbd></td>
                <td style={tdStyle}>清空会话显示</td>
              </tr>
            </tbody>
          </table>

          <h3 style={h3Style}>编辑器</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>快捷键</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>S</kbd></td>
                <td style={tdStyle}>保存文件</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>F</kbd></td>
                <td style={tdStyle}>在文件中查找</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>H</kbd></td>
                <td style={tdStyle}>查找并替换</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Z</kbd></td>
                <td style={tdStyle}>撤销</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Shift</kbd> + <kbd style={kbdStyle}>Z</kbd></td>
                <td style={tdStyle}>重做</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>W</kbd></td>
                <td style={tdStyle}>关闭当前标签页</td>
              </tr>
            </tbody>
          </table>

          <h3 style={h3Style}>任务编排</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>快捷键</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Enter</kbd></td>
                <td style={tdStyle}>启动任务</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Space</kbd></td>
                <td style={tdStyle}>暂停 / 恢复任务</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>.</kbd></td>
                <td style={tdStyle}>中止任务</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>1</kbd> / <kbd style={kbdStyle}>2</kbd> / <kbd style={kbdStyle}>3</kbd></td>
                <td style={tdStyle}>切换办公室视图布局（网格 / 行 / 聚焦）</td>
              </tr>
            </tbody>
          </table>

          <h3 style={h3Style}>终端</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>快捷键</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>`</kbd></td>
                <td style={tdStyle}>切换终端面板</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Shift</kbd> + <kbd style={kbdStyle}>T</kbd></td>
                <td style={tdStyle}>新建终端标签页</td>
              </tr>
              <tr>
                <td style={tdStyle}><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>C</kbd></td>
                <td style={tdStyle}>中断正在运行的命令</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 14: Troubleshooting */}
        <section id="troubleshooting" style={{ paddingBottom: '2rem', marginBottom: '2rem' }}>
          <h2 style={h2Style}>14. 故障排查</h2>

          <h3 style={h3Style}>连接问题</h3>
          <p style={pStyle}>
            如果连接指示灯为红色，或您看到“已断开”消息：
          </p>
          <ol style={olStyle}>
            <li>在<strong>设置</strong>中检查您的网关地址（确认没有拼写错误且端口号正确）。</li>
            <li>确保 Hermes 执行引擎（网关）服务器正在运行。如果您将其安装为系统服务，请使用 <code>systemctl --user status hermes-gateway</code> 检查。</li>
            <li>检查防火墙是否阻止了连接端口。</li>
            <li>如果您使用远程服务器，请确保您的网络可以访问它（尝试 ping 该主机）。</li>
            <li>尝试<strong>设置</strong>中的<strong>测试连接</strong>按钮 - 它会提供具体的错误消息。</li>
          </ol>

          <h3 style={h3Style}>网关无响应</h3>
          <p style={pStyle}>
            如果网关可以访问但不对请求做出响应：
          </p>
          <ul style={ulStyle}>
            <li>检查网关自身的日志以查找错误（通常在其运行的终端中，或通过 <code>journalctl --user -u hermes-gateway</code>）。</li>
            <li>确认您的 API 密钥正确且未过期。</li>
            <li>重启网关服务并重试。</li>
            <li>确保网关中配置的 AI 服务提供方（例如 Anthropic）的 API 密钥有效。</li>
          </ul>

          <h3 style={h3Style}>功能显示为不可用</h3>
          <p style={pStyle}>
            如果某些功能显示为灰色或显示“不可用”：
          </p>
          <ul style={ulStyle}>
            <li>某些功能需要特定的网关能力。请将您的 Hermes 执行引擎（网关）更新到最新版本。</li>
            <li>检查<strong>技能</strong>页面中所需技能是否已安装并启用。</li>
            <li>确认网关的配置包含必要的模块（例如用于任务的编排模块）。</li>
            <li>确保您的连接具有相应的权限。某些网关会按 API 密钥划分功能范围。</li>
          </ul>

          <h3 style={h3Style}>速率限制</h3>
          <p style={pStyle}>
            如果您遇到速率限制错误：
          </p>
          <ul style={ulStyle}>
            <li>速率限制来自底层 AI 服务提供方（例如 Anthropic 的 API 限制）。</li>
            <li>减少任务编排中的并行执行器数量。</li>
            <li>降低连续会话消息的频率。</li>
            <li>考虑为不太关键的任务使用低层级模型，以将配额保留给重要工作。</li>
            <li>在您的 AI 服务提供方控制台中查看当前使用量和限制。</li>
            <li>如果您经常触达限制，请联系您的 AI 服务提供方以升级层级。</li>
          </ul>
          <div style={tipStyle}>
            <strong>提示：</strong>数据分析页面会显示您的令牌使用量随时间的变化，这可以帮助您识别使用模式并相应地进行规划。
          </div>
        </section>

        <footer style={{ textAlign: 'center', padding: '2rem 0', borderTop: '1px solid var(--theme-border-subtle)', color: 'var(--theme-muted)', fontSize: '0.85rem' }}>
          <p>Ti Work 帮助 - 最后更新于 2026 年 4 月</p>
        </footer>
      </div>
    </div>
  )
}
