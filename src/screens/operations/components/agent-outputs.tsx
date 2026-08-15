import type { OperationAgent, OperationAgentStatus } from '@/types/operation'
import type { Status } from '@/components/ds/status-badge'
import { Card } from '@/components/ds/card'
import { StatusBadge } from '@/components/ds/status-badge'
import { EmojiIcon } from '@/components/emoji-icon'

function agentStatusToStatus(s: OperationAgentStatus): Status {
  switch (s) {
    case 'online':  return 'running'
    case 'offline': return 'idle'
    case 'error':   return 'error'
    case 'unknown': return 'pending'
  }
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

interface AgentOutputsProps {
  agents: Array<OperationAgent>
}

export function AgentOutputs({ agents }: AgentOutputsProps) {
  if (agents.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed py-20 text-center"
        style={{
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-muted)',
        }}
      >
        <p className="text-sm max-w-xs">
          没有运行中的智能体。发起一个多智能体或 Conductor 任务后即可在此查看智能体输出。
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {agents.map((agent) => {
        const contextLabel =
          agent.source === 'crew' && agent.crewName
            ? `多智能体：${agent.crewName}`
            : agent.missionGoal
              ? `任务：${agent.missionGoal.slice(0, 80)}${agent.missionGoal.length > 80 ? '…' : ''}`
              : agent.source === 'conductor'
                ? 'Conductor'
                : '独立'

        const header = (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="leading-none text-lg">
                <EmojiIcon emoji={agent.emoji} size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                  {agent.name}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--theme-muted)' }}>
                  {contextLabel}
                </div>
              </div>
            </div>
            <StatusBadge status={agentStatusToStatus(agent.status)} />
          </div>
        )

        return (
          <Card key={agent.id} header={header}>
            {agent.lastActivity ? (
              <div className="flex flex-col gap-2">
                <div
                  className="rounded p-3 text-xs font-mono whitespace-pre-wrap break-all"
                  style={{
                    background: 'var(--theme-input)',
                    color: 'var(--theme-text)',
                    border: '1px solid var(--theme-border)',
                    minHeight: '3rem',
                  }}
                >
                  最近活动：{timeAgo(agent.lastActivity)}
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--theme-muted)' }}>
                  {agent.model && (
                    <span
                      className="rounded px-1.5 py-0.5 font-mono"
                      style={{
                        background: 'var(--theme-accent-subtle)',
                        color: 'var(--theme-accent)',
                        border: '1px solid var(--theme-accent-border)',
                      }}
                    >
                      {agent.model}
                    </span>
                  )}
                  <span>{agent.totalTokens.toLocaleString()} token</span>
                  <span>{agent.taskCount} 个任务</span>
                  {agent.totalCostUsd > 0 && (
                    <span>${agent.totalCostUsd.toFixed(4)}</span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="rounded p-3 text-xs"
                style={{
                  background: 'var(--theme-input)',
                  color: 'var(--theme-muted)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                暂无活动记录。
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
