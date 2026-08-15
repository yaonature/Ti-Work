// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/ds/status-badge'

describe('StatusBadge', () => {
  it('shows default label for running', () => {
    render(<StatusBadge status="running" />)
    expect(screen.getByText('运行中')).toBeTruthy()
  })

  it('shows default label for success', () => {
    render(<StatusBadge status="success" />)
    expect(screen.getByText('成功')).toBeTruthy()
  })

  it('shows default label for error', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText('异常')).toBeTruthy()
  })

  it('shows default label for warning', () => {
    render(<StatusBadge status="warning" />)
    expect(screen.getByText('警告')).toBeTruthy()
  })

  it('shows default label for idle', () => {
    render(<StatusBadge status="idle" />)
    expect(screen.getByText('空闲')).toBeTruthy()
  })

  it('shows default label for pending', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('等待中')).toBeTruthy()
  })

  it('uses custom label when provided', () => {
    render(<StatusBadge status="success" label="Done" />)
    expect(screen.getByText('Done')).toBeTruthy()
    expect(screen.queryByText('成功')).toBeFalsy()
  })
})
