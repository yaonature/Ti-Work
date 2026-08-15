# Ti Work 打包常用命令

> 状态：工程操作文档（2026-08-14）
> 目的：说明 Ti Work 桌面端常用打包命令，以及 Windows exe / macOS dmg / Linux 包分别应在哪类环境生成。

---

## 1. 基本原则

Ti Work 使用 Electron + electron-builder 打包。

不同平台的安装包不要混在同一台机器上强行生成：

| 目标产物 | 推荐生成环境 | 说明 |
|---|---|---|
| Windows `.exe` / `win-unpacked` | Windows x64 | 最稳；可生成 NSIS 安装包和免安装目录 |
| macOS `.dmg` | macOS | 必须在 macOS 上生成；涉及 macOS 签名、公证、dmg 制作 |
| Linux `.AppImage` / `.deb` / `.rpm` | Linux | 最稳；也可在 CI Linux 环境生成 |

原则：

- Windows 产物在 Windows 生成
- macOS 产物在 macOS 生成
- Linux 产物在 Linux 生成
- 不建议在 Windows 上生成 macOS `.dmg`
- 不建议在 macOS 上生成 Windows 安装包作为正式交付物

---

## 2. Windows 常用命令

### 2.1 安装依赖

```powershell
pnpm install
```

### 2.2 构建 Web / Server 产物

```powershell
pnpm build
```

该命令会生成：

- `dist/client`
- `dist/server`

### 2.3 编译 Electron 主进程

```powershell
pnpm electron:compile
```

生成：

- `dist-electron/main.cjs`
- `dist-electron/preload.cjs`

### 2.4 暂存后端依赖

```powershell
node scripts/stage-server-deps.mjs
```

生成：

- `.electron-stage/node_modules`

主要用于把 `better-sqlite3` 等运行期原生依赖带进安装包。

### 2.5 暂存 Hermes 首装资源

```powershell
node scripts/stage-hermes-bootstrap.mjs
```

生成：

- `.bootstrap-stage/install.ps1`
- `.bootstrap-stage/hermes-agent-source`

注意：

- `hermes-agent-source` 是固定版本源码快照
- 生产首装必须使用该内置源码
- 不允许回退到 Git / repository 云端拉取

### 2.6 生成 Windows 免安装目录

```powershell
node scripts/electron-package.mjs --dir
```

生成：

- `release/win-unpacked/Ti Work.exe`

用途：

- 本地快速验证
- P0 首装链路调试
- 不生成安装器

### 2.7 生成 Windows 安装包

```powershell
node scripts/electron-package.mjs --win
```

或按 package 脚本执行：

```powershell
pnpm electron:pack
```

生成位置：

- `release/`

常见产物：

- `Ti Work Setup <version>.exe`
- `win-unpacked/`

---

## 3. 推荐 Windows 完整打包流程

开发验证 `win-unpacked`：

```powershell
pnpm build
pnpm electron:compile
node scripts/stage-server-deps.mjs
node scripts/stage-hermes-bootstrap.mjs
node scripts/electron-package.mjs --dir
```

正式生成安装包：

```powershell
pnpm build
pnpm electron:compile
node scripts/stage-server-deps.mjs
node scripts/stage-hermes-bootstrap.mjs
node scripts/electron-package.mjs --win
```

如果前一次包目录被进程锁住，先停止 Ti Work：

```powershell
Get-Process "Ti Work" -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## 4. macOS dmg 打包

macOS `.dmg` 必须在 macOS 环境生成。

### 4.1 推荐环境

- macOS 13+
- Apple Silicon 或 Intel 均可，但要明确目标架构
- Node.js 与 pnpm 版本与 Windows 开发环境保持一致
- 如需正式分发，需要 Apple Developer 证书

### 4.2 常用命令

```bash
pnpm install
pnpm build
pnpm electron:compile
node scripts/stage-server-deps.mjs
node scripts/stage-hermes-bootstrap.mjs
node scripts/electron-package.mjs --mac
```

常见产物：

- `.dmg`
- `.zip`
- `.app`

### 4.3 签名与公证

正式对外分发 macOS 包，通常还需要：

- Developer ID Application 证书
- Apple notarization 公证
- hardened runtime 配置

没有签名 / 公证时，用户打开可能看到 macOS 安全拦截。

---

## 5. Linux 打包

Linux 包建议在 Linux 环境生成。

### 5.1 常用命令

```bash
pnpm install
pnpm build
pnpm electron:compile
node scripts/stage-server-deps.mjs
node scripts/stage-hermes-bootstrap.mjs
node scripts/electron-package.mjs --linux
```

常见产物：

- `.AppImage`
- `.deb`
- `.rpm`

具体产物取决于 `electron-builder.yml` 配置。

---

## 6. P0 Hermes 首装验证命令

Windows 上验证免安装包：

```powershell
Get-Process "Ti Work" -ErrorAction SilentlyContinue | Stop-Process -Force
node scripts/electron-package.mjs --dir
& "D:\projects\Hermes-Studio\release\win-unpacked\Ti Work.exe"
```

查看 bootstrap 调试日志：

```powershell
Get-Content "$env:TEMP\tiwork-bootstrap-debug.log" -Tail 120
```

当前 P0 目标：

- 不写 `D:\hermes`
- 不依赖 Git
- 不依赖 GitHub / 云端源码
- 使用安装包内置 `hermes-agent-source`
- `HERMES_HOME` 由 Electron 主进程透传为 `userData\Hermes`
- 首装阶段能从 `installing` 进入 `ready`

---

## 7. 常见问题

### 7.1 为什么不能在 Windows 上打 macOS dmg？

`.dmg` 制作、`.app` 签名、公证都依赖 macOS 工具链。Windows 上即使能拼出部分文件，也不能作为正式可交付包。

### 7.2 为什么打包前要先停止 Ti Work？

Windows 会锁住正在运行的 exe、asar、dll、node_modules 文件。Ti Work 未停止时，`release/win-unpacked` 可能无法覆盖，导致包里混入旧主进程或旧资源。

### 7.3 为什么首装不能回退到 Git？

Ti Work 安装包必须携带固定版本 Hermes 源码，保证企业交付可控、可复现、可审计。回退到 Git / 云端开源仓库会带来版本漂移、网络依赖和合规风险。

---

## 8. 建议 CI 策略

后续建议拆成三个平台任务：

| CI Job | Runner | 产物 |
|---|---|---|
| build-windows | Windows x64 | `.exe` / `win-unpacked` |
| build-macos | macOS | `.dmg` / `.app` |
| build-linux | Ubuntu | `.AppImage` / `.deb` |

每个平台只生成本平台正式产物。跨平台包只用于临时测试，不作为交付标准。
