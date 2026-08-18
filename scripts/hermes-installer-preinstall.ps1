<#
.SYNOPSIS
    Ti Work 安装期 Hermes 执行引擎预装脚本（NSIS customInstall 调用）。

.DESCRIPTION
    在应用安装阶段完成 Hermes 网关运行环境准备：
      1. 资源落地：将安装包内置源码快照（hermes-agent-source）复制到
         $HermesHome\hermes-agent（原生 robocopy，规避 Electron 运行时 fs 复制的
         EIO/EPERM 问题）
      2. 写入 .env 骨架（API_SERVER_KEY，8642 OpenAI 兼容 API 的前置条件）
      3. 逐阶段执行官方 install.ps1（跳过 repository：源码已内置固定版本）
      4. 可启动性检查 + 写入 .tiwork-bootstrap.json 状态
    全程幂等：已装好（venv 内存在 hermes.exe）直接跳过；任一步失败记录
    failureCategory=install-failed 并返回非零退出码，应用安装不受影响，
    首次启动会自动重试。

    退出码约定：
      0  = 成功（或已存在）
      1  = 失败（失败详情已写入状态文件与日志）

    用法：
      powershell -NoProfile -ExecutionPolicy Bypass -File install-hermes.ps1
          -HermesHome "$env:LOCALAPPDATA\Ti Work\Hermes"
          -SourceSnapshot "$INSTDIR\resources\hermes-bootstrap\hermes-agent-source"
          -InstallerPath "$INSTDIR\resources\hermes-bootstrap\install.ps1"
#>
param(
    [string]$HermesHome = "",
    [string]$SourceSnapshot = "",
    [string]$InstallerPath = "",
    [string]$LogFile = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ---------------------------------------------------------------------------
# 常量与路径解析
# ---------------------------------------------------------------------------
if (-not $HermesHome) { $HermesHome = Join-Path $env:LOCALAPPDATA "Ti Work\Hermes" }
if (-not $LogFile) { $LogFile = Join-Path $HermesHome ".preinstall.log" }

$InstallDir = Join-Path $HermesHome "hermes-agent"
$EnvPath = Join-Path $HermesHome ".env"
$StatePath = Join-Path $HermesHome ".tiwork-bootstrap.json"

# 与 src/server/hermes-bootstrap.ts resolveManagedWritableDir 保持一致的
# 状态文件落盘目录（优先已存在的 AppData / bin，其次根目录）。
function Get-StateDir {
    if (Test-Path (Join-Path $HermesHome "AppData")) { return Join-Path $HermesHome "AppData" }
    if (Test-Path (Join-Path $HermesHome "bin")) { return Join-Path $HermesHome "bin" }
    return $HermesHome
}

# 官方 install.ps1 阶段（不含 repository：源码已内置）。与 bootstrap 首启
# 过滤逻辑保持一致（needsUserInput=false 且非 repository）。
$InstallStages = @(
    @{ Name = "uv";               Title = "安装 uv 包管理器" }
    @{ Name = "python";           Title = "准备 Python 运行时" }
    @{ Name = "git";              Title = "准备 Git" }
    @{ Name = "node";             Title = "检测 Node.js" }
    @{ Name = "system-packages";  Title = "安装 ripgrep 与 ffmpeg" }
    @{ Name = "venv";             Title = "创建 Python 虚拟环境" }
    @{ Name = "dependencies";     Title = "安装 Python 依赖" }
    @{ Name = "node-deps";        Title = "安装 Node 依赖" }
    @{ Name = "path";             Title = "配置命令路径" }
    @{ Name = "config-templates"; Title = "写入配置模板" }
    @{ Name = "platform-sdks";    Title = "安装消息平台 SDK" }
    @{ Name = "bootstrap-marker"; Title = "标记安装完成" }
)

# ---------------------------------------------------------------------------
# 输出 / 日志
# ---------------------------------------------------------------------------
function Write-Step([string]$Message) {
    $line = "[hermes-preinstall] $Message"
    Write-Host $line
    try {
        $dir = Split-Path $LogFile -Parent
        if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    } catch { }
}

# ---------------------------------------------------------------------------
# 状态文件写入（镜像服务端 BootstrapState 结构）
# ---------------------------------------------------------------------------
function Write-State {
    param(
        [string]$Phase,
        [string]$Message,
        [string]$ErrorText = $null,
        [string]$FailureCategory = $null,
        [int]$StageIndex = 0,
        [string]$HermesBin = ""
    )
    $state = [ordered]@{
        phase           = $Phase
        hermesHome      = $HermesHome
        stages          = @($InstallStages | ForEach-Object { @{ name = $_.Name; title = $_.Title; category = "install"; needsUserInput = $false } })
        stageIndex      = $StageIndex
        message         = $Message
        error           = $ErrorText
        hermesBin       = $HermesBin
        attempt         = 0
        startedAt       = $null
        finishedAt      = $null
        preparedBy      = "installer"
        failureCategory = $FailureCategory
    }
    $stateDir = Get-StateDir
    try {
        New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
        $state | ConvertTo-Json -Depth 6 | Out-File -FilePath (Join-Path $stateDir ".tiwork-bootstrap.json") -Encoding UTF8
        # 根目录也保留一份，兼容尚未创建 AppData/bin 的早期阶段读取
        $state | ConvertTo-Json -Depth 6 | Out-File -FilePath $StatePath -Encoding UTF8
    } catch {
        Write-Step ("WARN 状态文件写入失败: " + $_.Exception.Message)
    }
}

# ---------------------------------------------------------------------------
# 带超时的子进程执行（避免安装器无限挂起）
# ---------------------------------------------------------------------------
function Invoke-StageProcess {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [hashtable]$ExtraEnv,
        [int]$TimeoutSec = 1200
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    # 注意：ArgumentList / Environment 是 .NET Core 2.1+ 的 API，Windows
    # PowerShell 5.1（.NET Framework）没有，必须用 Arguments 字符串 + 引号
    # 转义，以及 EnvironmentVariables（StringDictionary）。
    $quotedArgs = @(
        foreach ($arg in $Arguments) {
            if ($arg -match '[\s"'']') { '"' + ($arg -replace '"', '""') + '"' }
            else { $arg }
        }
    )
    $psi.Arguments = $quotedArgs -join ' '
    if ($ExtraEnv) {
        foreach ($key in $ExtraEnv.Keys) {
            $psi.EnvironmentVariables[$key] = [string]$ExtraEnv[$key]
        }
    }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    if (-not $proc.Start()) { return @{ Code = -1; Stdout = ""; Stderr = "进程启动失败" } }

    $stdout = $proc.StandardOutput.ReadToEndAsync()
    $stderr = $proc.StandardError.ReadToEndAsync()

    if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
        try { $proc.Kill() } catch { }
        $proc.WaitForExit()
        return @{ Code = -1; Stdout = $stdout.Result; Stderr = "阶段超时（${TimeoutSec}s），已终止" }
    }
    return @{ Code = $proc.ExitCode; Stdout = $stdout.Result; Stderr = $stderr.Result }
}

# ---------------------------------------------------------------------------
# 宿主工具预检（信息性：仅输出日志，不改变安装行为）
#
# 官方 install.ps1 各阶段内部已做复用检测：
#   - uv     : Hermes 自管（$HermesHome\bin\uv.exe），已有则跳过
#   - python : 优先 uv 固定版本 3.11；宿主 3.10+ 兜底（跳过 Store stub）
#   - node   : 宿主 >=26 直接复用，否则装受管便携版
#   - git    : 宿主检测到即复用
# 这里把检测结果打到安装详情，便于用户判断哪些是复用宿主、哪些需要安装。
# ---------------------------------------------------------------------------
function Get-HostToolStatus {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) { return "未检测到（将安装受管版本）" }
    $src = $cmd.Source
    if ($src -and $src -like "*\WindowsApps\*") {
        try {
            $item = Get-Item $src -ErrorAction SilentlyContinue
            if ($item -and $item.Length -eq 0) {
                return "仅 Microsoft Store 占位，不可用（将安装受管版本）"
            }
        } catch { }
    }
    return "已检测到（$src）"
}

function Write-Preflight {
    Write-Step "---- 宿主工具预检 ----"
    $py = Get-HostToolStatus "python"
    if ($py -like "已检测到*") {
        try {
            $ver = (& python --version 2>&1 | Select-Object -First 1).ToString()
            if ($ver) { $py += "（$ver）" }
        } catch { }
    }
    Write-Step "python : $py"
    $node = Get-HostToolStatus "node"
    if ($node -like "已检测到*") {
        try {
            $ver = (& node --version 2>&1 | Select-Object -First 1).ToString()
            if ($ver) { $node += "（$ver）" }
        } catch { }
    }
    Write-Step "node   : $node"
    Write-Step "git    : $(Get-HostToolStatus 'git')"
    Write-Step "uv     : Hermes 自管（$HermesHome\bin\uv.exe），不探测宿主"
    Write-Step "---- 预检结束，开始阶段安装 ----"
}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
$exitCode = 0
try {
    Write-Step "===== 开始 Hermes 执行引擎预装 ====="
    Write-Step "HermesHome=$HermesHome"
    Write-Step "InstallDir=$InstallDir"

    # 1. 参数校验
    if (-not $InstallerPath) { $InstallerPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "install.ps1" }
    if (-not $SourceSnapshot) { $SourceSnapshot = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "hermes-agent-source" }
    if (-not (Test-Path $InstallerPath)) { throw "未找到安装器 install.ps1：$InstallerPath" }
    if (-not (Test-Path $SourceSnapshot)) { throw "未找到内置源码快照：$SourceSnapshot" }

    $hermesExe = Join-Path $InstallDir "venv\Scripts\hermes.exe"

    # 2. 幂等：已装好则直接标记就绪（应用升级 / 重复安装场景）
    if (Test-Path $hermesExe) {
        Write-Step "检测到已安装的 Hermes（$hermesExe），跳过安装阶段"
        Write-State -Phase "idle" -Message "执行引擎已就绪（安装期预装）" -StageIndex $InstallStages.Count -HermesBin $hermesExe
        Write-Step "===== 预装完成（跳过）====="
        exit 0
    }

    # 3. 宿主工具预检（信息性：复用宿主 / 安装受管版本一目了然）
    Write-Preflight

    # 4. 环境隔离（与 bootstrap buildBootstrapEnv 一致，防止 git config --global
    #    写用户目录失败、以及阶段子进程读到脏环境）
    New-Item -ItemType Directory -Force -Path $HermesHome | Out-Null
    $writableDir = if (Test-Path (Join-Path $HermesHome "AppData")) { Join-Path $HermesHome "AppData" } else { $HermesHome }
    $stageEnv = @{
        "HERMES_HOME"      = $HermesHome
        "HOME"             = $HermesHome
        "USERPROFILE"      = $HermesHome
        "XDG_CONFIG_HOME"  = $writableDir
        "GIT_CONFIG_GLOBAL" = Join-Path $writableDir ".gitconfig"
    }
    foreach ($key in $stageEnv.Keys) { [Environment]::SetEnvironmentVariable($key, $stageEnv[$key], "Process") }

    # 5. 资源落地：robocopy 源码快照 → $HermesHome\hermes-agent
    Write-Step "资源落地：复制源码快照 → $InstallDir"
    if (Test-Path $InstallDir) {
        # 半截安装残留：清理后重新落地（避免沿用坏目录）
        Remove-Item -Recurse -Force -LiteralPath $InstallDir -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir -Parent) | Out-Null
    $robocopy = Invoke-StageProcess -FilePath "robocopy.exe" -Arguments @($SourceSnapshot, $InstallDir, "/MIR", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP") -TimeoutSec 900
    # robocopy 退出码 0-7 均为成功
    if ($robocopy.Code -lt 0 -or $robocopy.Code -gt 7) {
        throw "源码快照复制失败（robocopy exit $($robocopy.Code)）：$($robocopy.Stderr)"
    }
    Write-Step "资源落地完成"

    # 6. 写入 .env 骨架（API_SERVER_KEY，16 位以上）
    $apiKey = ""
    if (Test-Path $EnvPath) {
        $existing = Get-Content $EnvPath | Where-Object { $_ -match "^API_SERVER_KEY=(.{16,})$" }
        if ($existing) { $apiKey = ($existing | Select-Object -First 1) -replace "^API_SERVER_KEY=", "" }
    }
    if (-not $apiKey) {
        $bytes = New-Object byte[] 24
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $apiKey = -join ($bytes | ForEach-Object { $_.ToString("x2") })
        $sep = if ((Test-Path $EnvPath) -and -not ((Get-Content $EnvPath -Raw).EndsWith("`n"))) { "`n" } else { "" }
        Add-Content -Path $EnvPath -Value "$sep`API_SERVER_KEY=$apiKey" -Encoding ASCII
        Write-Step "已写入 API_SERVER_KEY（24 字节随机 hex）"
    } else {
        Write-Step "API_SERVER_KEY 已存在，跳过"
    }

    # 7. 逐阶段安装（venv 阶段失败时最多重试 2 次，与首启 bootstrap 一致）
    $stateIndex = 0
    foreach ($stage in $InstallStages) {
        Write-Step ("[阶段 {0}/{1}] {2} ..." -f ($stateIndex + 1), $InstallStages.Count, $stage.Title)
        $argsList = @(
            "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", $InstallerPath,
            "-Stage", $stage.Name,
            "-NonInteractive",
            "-HermesHome", $HermesHome,
            "-InstallDir", $InstallDir
        )
        $attempt = 0
        $result = $null
        do {
            $attempt++
            $result = Invoke-StageProcess -FilePath "powershell.exe" -Arguments $argsList -TimeoutSec 1500
            if ($result.Code -eq 0) { break }
            if ($stage.Name -eq "venv" -and $attempt -le 3) {
                Write-Step ("  venv 阶段失败（exit {0}），第 {1} 次重试..." -f $result.Code, $attempt)
                Start-Sleep -Seconds (3 * $attempt)
                continue
            }
            break
        } while ($true)

        if ($result.Code -ne 0) {
            $detail = ($result.Stderr.Trim() -replace "\s+", " ")
            if ($detail.Length -gt 500) { $detail = $detail.Substring(0, 500) + "..." }
            $errText = "安装阶段「$($stage.Title)」失败（exit $($result.Code)）$detail"
            Write-Step ("ERROR " + $errText)
            Write-State -Phase "failed" -Message "执行引擎预装失败" -ErrorText $errText -FailureCategory "install-failed" -StageIndex $stateIndex
            Write-Step "===== 预装失败 ====="
            exit 1
        }
        $stateIndex++
        Write-Step ("[阶段 {0}/{1}] {2} 完成" -f $stateIndex, $InstallStages.Count, $stage.Title)
    }

    # 8. 可启动性检查
    if (-not (Test-Path $hermesExe)) {
        $errText = "引擎已安装但未找到 hermes 命令：$hermesExe"
        Write-Step ("ERROR " + $errText)
        Write-State -Phase "failed" -Message "执行引擎预装失败" -ErrorText $errText -FailureCategory "install-failed" -StageIndex $stateIndex
        Write-Step "===== 预装失败 ====="
        exit 1
    }

    # 9. 写入状态：phase=idle + hermesBin，首启只做检测与网关启动（秒级）
    Write-State -Phase "idle" -Message "执行引擎已就绪（安装期预装）" -StageIndex $InstallStages.Count -HermesBin $hermesExe
    Write-Step "===== 预装完成 ====="
    Write-Step ("状态文件: " + (Join-Path (Get-StateDir) ".tiwork-bootstrap.json"))
    exit 0
}
catch {
    $errText = $_.Exception.Message
    Write-Step ("ERROR " + $errText)
    try {
        Write-State -Phase "failed" -Message "执行引擎预装失败" -ErrorText $errText -FailureCategory "install-failed"
    } catch { }
    Write-Step "===== 预装失败 ====="
    exit 1
}
