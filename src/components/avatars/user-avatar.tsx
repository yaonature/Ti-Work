import { memo } from 'react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  size?: number
  className?: string
  src?: string | null
  alt?: string
}

/**
 * User avatar — same brand family as assistant (扶桑树 · 日轮).
 * Dark charcoal base + brand-blue person silhouette + golden sun halo,
 * keeping the "current user" semantics distinct from the assistant logo.
 */
function UserAvatarComponent({
  size = 28,
  className,
  src,
  alt = '用户头像',
}: AvatarProps) {
  if (src && src.trim().length > 0) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn('shrink-0 object-cover', className)}
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(6, Math.round(size * 0.2)),
        }}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <defs>
        {/* 深炭底 —— 与 ti-work-logo 品牌底色一致 */}
        <linearGradient id="uav-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26262B" />
          <stop offset="1" stopColor="#151518" />
        </linearGradient>
        {/* 品牌蓝人像 —— 对应扶桑树 fs-tree */}
        <linearGradient id="uav-person" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0E5BD1" />
          <stop offset="1" stopColor="#5CADFF" />
        </linearGradient>
        {/* 日轮金 —— 对应金乌之日 fs-sun */}
        <linearGradient id="uav-sun" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FF9F1C" />
          <stop offset="1" stopColor="#FFE38F" />
        </linearGradient>
        {/* 日轮辉光 */}
        <radialGradient id="uav-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFC964" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFC964" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 深炭底 */}
      <rect x="5" y="5" width="90" height="90" rx="20" fill="url(#uav-bg)" />

      {/* 日轮辉光（环绕人物头顶） */}
      <circle cx="50" cy="22" r="20" fill="url(#uav-glow)" />

      {/* 金乌之日 —— 悬于人物头顶，呼应「日出扶桑」 */}
      <circle cx="50" cy="22" r="10" fill="url(#uav-sun)" />
      <circle
        cx="50"
        cy="22"
        r="8"
        stroke="#FFD97A"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />

      {/* 头部 */}
      <circle cx="50" cy="48" r="15" fill="url(#uav-person)" />

      {/* 肩部 / 身躯 */}
      <path
        d="M 26 90 C 26 66 38 58 50 58 C 62 58 74 66 74 90 Z"
        fill="url(#uav-person)"
      />
    </svg>
  )
}

export const UserAvatar = memo(UserAvatarComponent)
