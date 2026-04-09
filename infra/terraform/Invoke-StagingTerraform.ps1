param(
    [ValidateSet("plan", "apply")]
    [string]$Action = "plan",

    [ValidateSet("auto", "native", "docker")]
    [string]$Runner = "auto",

    [string]$TfvarsFile = "staging.tfvars",
    [string]$SecretsFile = "staging.secrets.tfvars",
    [string]$PlanFile = "staging.tfplan",
    [string]$KubeconfigPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$terraformImage = "hashicorp/terraform:1.8.5"
$scriptDir = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$moduleDir = $scriptDir
$repoRoot = (Resolve-Path (Join-Path $moduleDir "..\..")).Path
$containerWorkspace = "/workspace"
$containerModuleDir = "$containerWorkspace/infra/terraform"

function Resolve-ModuleFilePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $moduleDir $PathValue))
}

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

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (-not (Test-Path -Path $PathValue -PathType Leaf)) {
        throw "$Label not found: $PathValue"
    }
}

function Assert-NoPlaceholderValues {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Files
    )

    foreach ($file in $Files) {
        $content = Get-Content -Path $file -Raw
        if ($content -match "replace-with") {
            throw "Placeholder value detected in $file. Replace all placeholder values before running staging Terraform."
        }
    }
}

function Resolve-TerraformRunner {
    $nativeTerraform = Get-Command terraform -ErrorAction SilentlyContinue
    $dockerCli = Get-Command docker -ErrorAction SilentlyContinue

    switch ($Runner) {
        "native" {
            if (-not $nativeTerraform) {
                throw "terraform was not found in PATH and -Runner native was requested."
            }
            return "native"
        }
        "docker" {
            if (-not $dockerCli) {
                throw "docker was not found in PATH and -Runner docker was requested."
            }
            return "docker"
        }
        default {
            if ($nativeTerraform) {
                return "native"
            }
            if ($dockerCli) {
                return "docker"
            }
            throw "Neither terraform nor docker was found in PATH. Install one of them or adjust -Runner."
        }
    }
}

function Convert-RepoPathToContainerPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostPath
    )

    $relativePath = [System.IO.Path]::GetRelativePath($repoRoot, $HostPath)
    return "$containerWorkspace/$($relativePath -replace '\\', '/')"
}

function Invoke-TerraformNative {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & terraform @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "terraform $($Arguments[1]) failed with exit code $LASTEXITCODE."
    }
}

function Invoke-TerraformDocker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$TerraformArguments,

        [Parameter(Mandatory = $true)]
        [string]$ResolvedKubeconfigPath
    )

    $kubeconfigDirectory = Split-Path -Parent $ResolvedKubeconfigPath
    $kubeconfigFileName = Split-Path -Leaf $ResolvedKubeconfigPath
    $dockerArguments = @(
        "run",
        "--rm",
        "-v",
        "${repoRoot}:${containerWorkspace}",
        "-v",
        "${kubeconfigDirectory}:/kube",
        "-w",
        $containerWorkspace,
        $terraformImage
    )

    & docker @dockerArguments @TerraformArguments
    if ($LASTEXITCODE -ne 0) {
        throw "dockerized terraform failed with exit code $LASTEXITCODE."
    }
}

$resolvedTfvarsFile = Resolve-ModuleFilePath -PathValue $TfvarsFile
$resolvedSecretsFile = Resolve-ModuleFilePath -PathValue $SecretsFile
$resolvedPlanFile = Resolve-ModuleFilePath -PathValue $PlanFile
$resolvedKubeconfigPath = Resolve-KubeconfigFilePath -OverridePath $KubeconfigPath
$resolvedRunner = Resolve-TerraformRunner

Assert-FileExists -PathValue $resolvedKubeconfigPath -Label "Kubeconfig"

if ($Action -eq "plan") {
    Assert-FileExists -PathValue $resolvedTfvarsFile -Label "Terraform var file"
    Assert-FileExists -PathValue $resolvedSecretsFile -Label "Terraform secrets file"
    Assert-NoPlaceholderValues -Files @($resolvedSecretsFile)
}
else {
    Assert-FileExists -PathValue $resolvedPlanFile -Label "Terraform plan file"
}

Write-Host "Using Terraform runner: $resolvedRunner"

if ($resolvedRunner -eq "native") {
    Invoke-TerraformNative -Arguments @("-chdir=$moduleDir", "init")

    if ($Action -eq "plan") {
        Invoke-TerraformNative -Arguments @(
            "-chdir=$moduleDir",
            "plan",
            "-input=false",
            "-lock-timeout=5m",
            "-var-file=$resolvedTfvarsFile",
            "-var-file=$resolvedSecretsFile",
            "-out=$resolvedPlanFile"
        )
        Write-Host "Saved plan to $resolvedPlanFile"
    }
    else {
        Invoke-TerraformNative -Arguments @(
            "-chdir=$moduleDir",
            "apply",
            "-input=false",
            $resolvedPlanFile
        )
    }

    exit 0
}

$containerTfvarsFile = Convert-RepoPathToContainerPath -HostPath $resolvedTfvarsFile
$containerSecretsFile = Convert-RepoPathToContainerPath -HostPath $resolvedSecretsFile
$containerPlanFile = Convert-RepoPathToContainerPath -HostPath $resolvedPlanFile
$containerKubeconfigPath = "/kube/$((Split-Path -Leaf $resolvedKubeconfigPath))"

Invoke-TerraformDocker -ResolvedKubeconfigPath $resolvedKubeconfigPath -TerraformArguments @(
    "terraform",
    "-chdir=$containerModuleDir",
    "init"
)

if ($Action -eq "plan") {
    Invoke-TerraformDocker -ResolvedKubeconfigPath $resolvedKubeconfigPath -TerraformArguments @(
        "terraform",
        "-chdir=$containerModuleDir",
        "plan",
        "-input=false",
        "-lock-timeout=5m",
        "-var-file=$containerTfvarsFile",
        "-var-file=$containerSecretsFile",
        "-var=kubeconfig_path=$containerKubeconfigPath",
        "-out=$containerPlanFile"
    )
    Write-Host "Saved plan to $resolvedPlanFile"
    Write-Host "Use the same runner for apply so the kubeconfig mount path stays consistent."
}
else {
    Invoke-TerraformDocker -ResolvedKubeconfigPath $resolvedKubeconfigPath -TerraformArguments @(
        "terraform",
        "-chdir=$containerModuleDir",
        "apply",
        "-input=false",
        $containerPlanFile
    )
}