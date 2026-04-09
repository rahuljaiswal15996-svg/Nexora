param(
    [string]$Namespace = "nexora-staging",
    [string]$ReleaseName = "nexora-staging",
    [string]$FullnameOverride = "nexora-staging",
    [string]$KubeconfigPath = "",
    [string]$IngressHost = "",
    [ValidateSet("https", "http")]
    [string]$IngressScheme = "https",
    [switch]$UsePortForward,
    [int]$FrontendLocalPort = 3000,
    [int]$BackendLocalPort = 8000,
    [int]$RolloutTimeoutSeconds = 300,
    [int]$HttpTimeoutSeconds = 60,
    [string]$TenantId = "default",
    [string]$UserId = "staging-validator@nexora.local",
    [ValidateSet("viewer", "editor", "admin")]
    [string]$UserRole = "admin",
    [switch]$SkipTlsVerify
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-KubeconfigFilePath {
    param(
        [string]$OverridePath
    )

    if (-not [string]::IsNullOrWhiteSpace($OverridePath)) {
        return [System.IO.Path]::GetFullPath($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OverridePath))
    }

    if (-not [string]::IsNullOrWhiteSpace($env:KUBECONFIG)) {
        $firstEntry = ($env:KUBECONFIG -split [System.IO.Path]::PathSeparator)[0]
        return [System.IO.Path]::GetFullPath($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($firstEntry))
    }

    return [System.IO.Path]::GetFullPath((Join-Path $HOME ".kube\config"))
}

function Assert-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandName
    )

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "$CommandName was not found in PATH."
    }
}

function Invoke-Kubectl {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & kubectl --kubeconfig $script:ResolvedKubeconfigPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Invoke-KubectlJson {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & kubectl --kubeconfig $script:ResolvedKubeconfigPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
    return $output | ConvertFrom-Json
}

function Get-QueueDepth {
    param(
        [Parameter(Mandatory = $true)]
        [object]$QueueDepths,

        [Parameter(Mandatory = $true)]
        [string]$QueueKind
    )

    $property = $QueueDepths.PSObject.Properties[$QueueKind]
    if ($null -eq $property) {
        throw "DLQ response is missing queue depth for $QueueKind."
    }
    return [int]$property.Value
}

function Assert-StatusPayload {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Payload,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ($Payload.status -ne "ok") {
        throw "$Label did not return status=ok."
    }
}

function Assert-HasItemsCollection {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Payload,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ($null -eq $Payload.PSObject.Properties["items"]) {
        throw "$Label response did not include an items property."
    }
}

function Start-PortForwardProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName,

        [Parameter(Mandatory = $true)]
        [int]$LocalPort,

        [Parameter(Mandatory = $true)]
        [int]$RemotePort
    )

    $sanitizedServiceName = ($ServiceName -replace "[^a-zA-Z0-9-]", "_")
    $logFile = Join-Path $env:TEMP "nexora-portforward-$sanitizedServiceName-$LocalPort.log"
    $arguments = @(
        "--kubeconfig",
        $script:ResolvedKubeconfigPath,
        "-n",
        $Namespace,
        "port-forward",
        "svc/$ServiceName",
        "${LocalPort}:${RemotePort}"
    )

    $process = Start-Process -FilePath "kubectl" -ArgumentList $arguments -RedirectStandardOutput $logFile -RedirectStandardError $logFile -PassThru -WindowStyle Hidden
    return [PSCustomObject]@{
        Process     = $process
        LogFile     = $logFile
        ServiceName = $ServiceName
        LocalPort   = $LocalPort
    }
}

function Stop-PortForwardProcess {
    param(
        [Parameter(Mandatory = $true)]
        [object]$PortForward
    )

    if ($PortForward.Process -and -not $PortForward.Process.HasExited) {
        Stop-Process -Id $PortForward.Process.Id -Force -ErrorAction SilentlyContinue
    }
}

function Wait-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [hashtable]$Headers,
        [int]$TimeoutSeconds = 60,
        [switch]$ExpectJson
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            if ($ExpectJson) {
                return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Get -TimeoutSec 8
            }
            return Invoke-WebRequest -Uri $Uri -Headers $Headers -Method Get -UseBasicParsing -TimeoutSec 8
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Timed out waiting for $Uri"
}

function Get-PodSummary {
    param(
        [Parameter(Mandatory = $true)]
        [object]$PodsPayload
    )

    $items = @($PodsPayload.items)
    return @(
        foreach ($item in $items) {
            $containerStatuses = @($item.status.containerStatuses)
            $readyCount = @($containerStatuses | Where-Object { $_.ready }).Count
            [PSCustomObject]@{
                name  = $item.metadata.name
                phase = $item.status.phase
                ready = if ($containerStatuses.Count -eq 0) { "0/0" } else { "$readyCount/$($containerStatuses.Count)" }
                node  = $item.spec.nodeName
            }
        }
    )
}

function Get-ServiceSummary {
    param(
        [Parameter(Mandatory = $true)]
        [object]$ServicesPayload
    )

    $items = @($ServicesPayload.items)
    return @(
        foreach ($item in $items) {
            [PSCustomObject]@{
                name      = $item.metadata.name
                type      = $item.spec.type
                clusterIP = $item.spec.clusterIP
                ports     = (@($item.spec.ports) | ForEach-Object { "$($_.port)/$($_.protocol)" }) -join ","
            }
        }
    )
}

function Get-IngressSummary {
    param(
        [Parameter(Mandatory = $true)]
        [object]$IngressPayload
    )

    $items = @($IngressPayload.items)
    return @(
        foreach ($item in $items) {
            [PSCustomObject]@{
                name  = $item.metadata.name
                hosts = (@($item.spec.rules) | ForEach-Object { $_.host }) -join ","
            }
        }
    )
}

$script:ResolvedKubeconfigPath = Resolve-KubeconfigFilePath -OverridePath $KubeconfigPath
Assert-CommandExists -CommandName "kubectl"

if (-not (Test-Path -Path $script:ResolvedKubeconfigPath -PathType Leaf)) {
    throw "Kubeconfig not found: $script:ResolvedKubeconfigPath"
}

$releaseFullname = if ([string]::IsNullOrWhiteSpace($FullnameOverride)) { $ReleaseName } else { $FullnameOverride }
$backendDeployment = "$releaseFullname-backend"
$frontendDeployment = "$releaseFullname-frontend"
$agentDeployment = "$releaseFullname-agent"
$redisDeployment = "$releaseFullname-redis"
$backendService = "$releaseFullname-backend"
$frontendService = "$releaseFullname-frontend"
$requiredDeployments = @($backendDeployment, $frontendDeployment)
$optionalDeployments = @($agentDeployment, $redisDeployment)
$commonHeaders = @{
    "X-Tenant-ID" = $TenantId
    "X-User-ID"   = $UserId
    "X-User-Role" = $UserRole
}

$previousTlsCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
if ($SkipTlsVerify -and $IngressScheme -eq "https") {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
}

$portForwards = @()

try {
    Invoke-Kubectl -Arguments @("get", "namespace", $Namespace)

    $deploymentsPayload = Invoke-KubectlJson -Arguments @("get", "deployments", "-n", $Namespace, "-o", "json")
    $deploymentNames = @($deploymentsPayload.items | ForEach-Object { $_.metadata.name })

    foreach ($name in $requiredDeployments) {
        if ($deploymentNames -notcontains $name) {
            throw "Required deployment not found: $name"
        }
    }

    $deploymentsToCheck = @($requiredDeployments)
    foreach ($name in $optionalDeployments) {
        if ($deploymentNames -contains $name) {
            $deploymentsToCheck += $name
        }
    }

    $rolloutResults = @()
    foreach ($deploymentName in $deploymentsToCheck) {
        Write-Host "Waiting for rollout: $deploymentName"
        Invoke-Kubectl -Arguments @("rollout", "status", "deployment/$deploymentName", "-n", $Namespace, "--timeout=${RolloutTimeoutSeconds}s")
        $rolloutResults += [PSCustomObject]@{
            deployment = $deploymentName
            status     = "ready"
        }
    }

    $podsPayload = Invoke-KubectlJson -Arguments @("get", "pods", "-n", $Namespace, "-o", "json")
    $servicesPayload = Invoke-KubectlJson -Arguments @("get", "svc", "-n", $Namespace, "-o", "json")
    $ingressPayload = Invoke-KubectlJson -Arguments @("get", "ingress", "-n", $Namespace, "-o", "json")

    $podSummary = Get-PodSummary -PodsPayload $podsPayload
    $serviceSummary = Get-ServiceSummary -ServicesPayload $servicesPayload
    $ingressSummary = Get-IngressSummary -IngressPayload $ingressPayload

    $shouldUsePortForward = $UsePortForward.IsPresent -or [string]::IsNullOrWhiteSpace($IngressHost)
    if (-not $shouldUsePortForward) {
        $matchingIngress = @($ingressSummary | Where-Object { ($_.hosts -split ",") -contains $IngressHost })
        if (-not $matchingIngress.Count) {
            throw "Ingress host $IngressHost was not found in namespace $Namespace."
        }
    }

    $frontendRootResponse = $null
    $frontendStatusPayload = $null
    $backendStatusPayload = $null
    $jobsPayload = $null
    $agentFleetPayload = $null
    $pipelineRunDlqPayload = $null
    $platformJobDlqPayload = $null
    $frontendBaseUrl = $null
    $backendBaseUrl = $null

    if ($shouldUsePortForward) {
        $portForwards += Start-PortForwardProcess -ServiceName $frontendService -LocalPort $FrontendLocalPort -RemotePort 3000
        $portForwards += Start-PortForwardProcess -ServiceName $backendService -LocalPort $BackendLocalPort -RemotePort 8000

        $frontendBaseUrl = "http://127.0.0.1:$FrontendLocalPort"
        $backendBaseUrl = "http://127.0.0.1:$BackendLocalPort"

        $frontendRootResponse = Wait-HttpEndpoint -Uri "$frontendBaseUrl/" -TimeoutSeconds $HttpTimeoutSeconds
        $frontendStatusPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/status" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $backendStatusPayload = Wait-HttpEndpoint -Uri "$backendBaseUrl/status" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $jobsPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/jobs" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $pipelineRunDlqPayload = Wait-HttpEndpoint -Uri "$backendBaseUrl/status/broker/dlq?queue_kind=pipeline-runs" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $platformJobDlqPayload = Wait-HttpEndpoint -Uri "$backendBaseUrl/status/broker/dlq?queue_kind=platform-jobs" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        if ($deploymentNames -contains $agentDeployment) {
            $agentFleetPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/agent/fleet" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        }
    }
    else {
        $frontendBaseUrl = "${IngressScheme}://$IngressHost"

        $frontendRootResponse = Wait-HttpEndpoint -Uri "$frontendBaseUrl/" -TimeoutSeconds $HttpTimeoutSeconds
        $frontendStatusPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/status" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $jobsPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/jobs" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $pipelineRunDlqPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/status/broker/dlq?queue_kind=pipeline-runs" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        $platformJobDlqPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/status/broker/dlq?queue_kind=platform-jobs" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        if ($deploymentNames -contains $agentDeployment) {
            $agentFleetPayload = Wait-HttpEndpoint -Uri "$frontendBaseUrl/api/agent/fleet" -Headers $commonHeaders -TimeoutSeconds $HttpTimeoutSeconds -ExpectJson
        }
    }

    if ($frontendRootResponse.StatusCode -lt 200 -or $frontendRootResponse.StatusCode -ge 400) {
        throw "Frontend root check did not return a successful HTTP status."
    }
    if ($frontendRootResponse.Content -notmatch "<html|<!DOCTYPE html") {
        throw "Frontend root check did not return an HTML document."
    }

    Assert-StatusPayload -Payload $frontendStatusPayload -Label "Frontend /api/status"
    if ($null -ne $backendStatusPayload) {
        Assert-StatusPayload -Payload $backendStatusPayload -Label "Backend /status"
    }
    Assert-HasItemsCollection -Payload $jobsPayload -Label "Jobs"
    Assert-HasItemsCollection -Payload $pipelineRunDlqPayload -Label "Pipeline run DLQ"
    Assert-HasItemsCollection -Payload $platformJobDlqPayload -Label "Platform job DLQ"
    if ($null -ne $agentFleetPayload) {
        Assert-HasItemsCollection -Payload $agentFleetPayload -Label "Agent fleet"
    }

    $pipelineRunDlqDepth = Get-QueueDepth -QueueDepths $pipelineRunDlqPayload.queue_depths -QueueKind "pipeline-runs"
    $platformJobDlqDepth = Get-QueueDepth -QueueDepths $platformJobDlqPayload.queue_depths -QueueKind "platform-jobs"

    $result = [PSCustomObject]@{
        validated_at     = (Get-Date).ToUniversalTime().ToString("o")
        namespace        = $Namespace
        release_fullname = $releaseFullname
        mode             = if ($shouldUsePortForward) { "port-forward" } else { "ingress" }
        frontend_url     = $frontendBaseUrl
        backend_url      = $backendBaseUrl
        rollout          = $rolloutResults
        pods             = $podSummary
        services         = $serviceSummary
        ingresses        = $ingressSummary
        http             = [PSCustomObject]@{
            frontend_root_status      = $frontendRootResponse.StatusCode
            frontend_api_status       = $frontendStatusPayload.status
            backend_status            = if ($null -ne $backendStatusPayload) { $backendStatusPayload.status } else { "skipped" }
            broker_backend            = $frontendStatusPayload.broker.backend
            broker_db_fallback_enabled = $frontendStatusPayload.broker.db_fallback_enabled
            jobs_count                = @($jobsPayload.items).Count
            agent_fleet_count         = if ($null -ne $agentFleetPayload) { @($agentFleetPayload.items).Count } else { $null }
            pipeline_run_dlq_depth    = $pipelineRunDlqDepth
            platform_job_dlq_depth    = $platformJobDlqDepth
        }
    }

    $result | ConvertTo-Json -Depth 8
}
finally {
    foreach ($portForward in $portForwards) {
        Stop-PortForwardProcess -PortForward $portForward
    }
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $previousTlsCallback
}