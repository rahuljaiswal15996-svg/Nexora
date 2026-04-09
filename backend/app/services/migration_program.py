import json
import uuid
from typing import Any, Dict, List, Optional

from app.services.catalog import CatalogService
from app.services.deployer import DeployerService
from app.services.governance import GovernanceService
from app.services.notebook import NotebookService
from app.services.pipeline_runner import update_pipeline
from app.services.project_service import ProjectService


def _slug(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    return "-".join(part for part in cleaned.split("-") if part) or "asset"


def _artifact_label(artifact_name: str | None) -> str:
    if not artifact_name:
        return "Uploaded Code"
    stem = artifact_name.rsplit(".", 1)[0]
    cleaned = stem.replace("_", " ").replace("-", " ").strip()
    return cleaned.title() or "Uploaded Code"


def _runtime_profile(target_language: str) -> Dict[str, Any]:
    normalized = (target_language or "python").lower()
    if normalized == "pyspark":
        return {
            "runtime": "spark-cluster",
            "target_platform": "databricks",
            "execution_mode": "remote",
            "schedule": {"mode": "scheduled", "cron": "0 */6 * * *", "timezone": "UTC"},
            "retries": {"max_attempts": 3, "backoff_seconds": [60, 300, 900]},
            "parameters": [
                {"name": "snapshot_date", "type": "string", "required": False, "default": "latest"},
                {"name": "cluster_policy", "type": "string", "required": False, "default": "standard"},
            ],
        }
    if normalized == "dbt":
        return {
            "runtime": "dbt-job",
            "target_platform": "warehouse",
            "execution_mode": "remote",
            "schedule": {"mode": "scheduled", "cron": "0 2 * * *", "timezone": "UTC"},
            "retries": {"max_attempts": 2, "backoff_seconds": [120, 600]},
            "parameters": [
                {"name": "target_schema", "type": "string", "required": False, "default": "analytics"},
                {"name": "full_refresh", "type": "boolean", "required": False, "default": False},
            ],
        }
    if normalized == "sql":
        return {
            "runtime": "warehouse-sql",
            "target_platform": "warehouse",
            "execution_mode": "local",
            "schedule": {"mode": "scheduled", "cron": "30 1 * * *", "timezone": "UTC"},
            "retries": {"max_attempts": 2, "backoff_seconds": [60, 300]},
            "parameters": [
                {"name": "target_database", "type": "string", "required": False, "default": "analytics"},
            ],
        }
    return {
        "runtime": "python-batch",
        "target_platform": "container",
        "execution_mode": "local",
        "schedule": {"mode": "scheduled", "cron": "0 3 * * *", "timezone": "UTC"},
        "retries": {"max_attempts": 2, "backoff_seconds": [30, 180]},
        "parameters": [
            {"name": "input_snapshot", "type": "string", "required": False, "default": "latest"},
            {"name": "target_environment", "type": "string", "required": False, "default": "dev"},
        ],
    }


def _markdown_cell(content: str) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": "markdown",
        "content": content,
        "execution_count": None,
        "outputs": [],
        "metadata": {},
    }


def _code_cell(content: str, language: str = "python") -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": "code",
        "content": content,
        "execution_count": None,
        "outputs": [],
        "metadata": {"language": language},
    }


class MigrationProgramService:
    def __init__(self):
        self.project_service = ProjectService()
        self.catalog_service = CatalogService()
        self.notebook_service = NotebookService()
        self.deployer_service = DeployerService()
        self.governance_service = GovernanceService()

    def _resolve_project_context(
        self,
        tenant_id: str,
        user_id: str,
        artifact_label: str,
        source_language: str,
        target_language: str,
        source_pipeline: Dict[str, Any],
        converted_pipeline: Dict[str, Any],
        requested_project_id: Optional[str] = None,
        requested_workspace_id: Optional[str] = None,
    ) -> tuple[Dict[str, Any], List[Dict[str, Any]], str, Optional[str]]:
        workspace_specs = [
            ("Conversion Studio", "Review generated source and target flows"),
            ("Catalog and Lineage", "Inspect datasets, lineage, and quality gates"),
            ("Runtime Handoff", "Operate schedules, retries, and deployment planning"),
        ]

        if requested_project_id:
            project = self.project_service.get_project(requested_project_id, tenant_id)
            if not project:
                raise ValueError("Project not found")

            for workspace_name, description in workspace_specs:
                self.project_service.ensure_workspace(project["id"], tenant_id, workspace_name, description)

            project = self.project_service.get_project(project["id"], tenant_id) or project
            workspaces = list(project.get("workspaces") or [])
            active_workspace_id = None

            if requested_workspace_id:
                requested_workspace = next(
                    (workspace for workspace in workspaces if str(workspace.get("id") or "") == requested_workspace_id),
                    None,
                )
                if not requested_workspace:
                    raise ValueError("Workspace not found for project")
                active_workspace_id = requested_workspace_id
                workspaces = [requested_workspace, *[workspace for workspace in workspaces if workspace is not requested_workspace]]
            else:
                active_workspace_id = str(workspaces[0].get("id") or "") if workspaces else None

            return project, workspaces, "reused", active_workspace_id

        project = self.project_service.create_project(
            tenant_id=tenant_id,
            name=f"{artifact_label} Migration Program",
            owner_id=user_id,
            description=f"Auto-generated migration project for {artifact_label}",
            metadata={
                "artifact": artifact_label,
                "source_language": source_language,
                "target_language": target_language,
                "source_pipeline_id": source_pipeline.get("pipeline_id"),
                "converted_pipeline_id": converted_pipeline.get("pipeline_id"),
            },
        )
        self.governance_service.log_action(tenant_id, user_id, "create", "project", project["id"], None, project)

        for workspace_name, description in workspace_specs:
            workspace = self.project_service.ensure_workspace(project["id"], tenant_id, workspace_name, description)
            if all(str(existing.get("id") or "") != str(workspace.get("id") or "") for existing in project.get("workspaces") or []):
                self.governance_service.log_action(tenant_id, user_id, "create", "workspace", workspace["id"], None, workspace)

        project = self.project_service.get_project(project["id"], tenant_id) or project
        workspaces = list(project.get("workspaces") or [])
        active_workspace_id = str(workspaces[0].get("id") or "") if workspaces else None
        return project, workspaces, "bootstrapped", active_workspace_id

    def _register_source_datasets(
        self,
        tenant_id: str,
        project_id: str,
        artifact_label: str,
        source_language: str,
        source_pipeline: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        inputs = list(source_pipeline.get("summary", {}).get("inputs") or [])
        if not inputs:
            inputs = [f"{artifact_label} source"]

        datasets: List[Dict[str, Any]] = []
        for input_name in inputs:
            dataset = self.catalog_service.register_dataset(
                tenant_id=tenant_id,
                name=input_name,
                source_path=f"legacy://{_slug(artifact_label)}/{_slug(input_name)}",
                project_id=project_id,
                metadata={
                    "stage": "source",
                    "language": source_language,
                    "artifact": artifact_label,
                    "pipeline_id": source_pipeline.get("pipeline_id"),
                },
                tags=["migration-source", source_language],
            )
            datasets.append(dataset)
        return datasets

    def _register_target_datasets(
        self,
        tenant_id: str,
        project_id: str,
        artifact_label: str,
        target_language: str,
        converted_pipeline: Dict[str, Any],
        execution_plan: Dict[str, Any],
        quality_score: float,
    ) -> List[Dict[str, Any]]:
        outputs = list(converted_pipeline.get("summary", {}).get("outputs") or [])
        datasets: List[Dict[str, Any]] = []
        for output_name in outputs:
            dataset = self.catalog_service.register_dataset(
                tenant_id=tenant_id,
                name=output_name,
                source_path=f"nexora://{_slug(artifact_label)}/converted/{_slug(output_name)}",
                project_id=project_id,
                metadata={
                    "stage": "converted",
                    "language": target_language,
                    "artifact": artifact_label,
                    "pipeline_id": converted_pipeline.get("pipeline_id"),
                    "runtime": execution_plan.get("runtime"),
                    "target_platform": execution_plan.get("target_platform"),
                },
                tags=["migration-target", target_language, execution_plan.get("target_platform", "platform")],
                quality_score=quality_score,
            )
            datasets.append(dataset)
        return datasets

    def _create_notebook(
        self,
        tenant_id: str,
        user_id: str,
        artifact_label: str,
        original_code: str,
        converted_code: str,
        source_pipeline: Dict[str, Any],
        converted_pipeline: Dict[str, Any],
        execution_plan: Dict[str, Any],
        project: Dict[str, Any],
        workspaces: List[Dict[str, Any]],
        active_workspace_id: Optional[str],
    ) -> Dict[str, Any]:
        notebook = self.notebook_service.create_notebook(f"{artifact_label} Migration Notebook", tenant_id, user_id)
        notebook_metadata = dict(notebook.get("metadata") or {})
        notebook_metadata["project_id"] = project.get("id")
        notebook_metadata["workspace_id"] = active_workspace_id
        notebook_metadata["migration_context"] = {
            "project_id": project.get("id"),
            "workspace_id": active_workspace_id,
            "source_pipeline_id": source_pipeline.get("pipeline_id"),
            "converted_pipeline_id": converted_pipeline.get("pipeline_id"),
            "workspace_ids": [workspace.get("id") for workspace in workspaces],
        }
        cells = [
            _markdown_cell(
                f"# {artifact_label} Migration Program\n\n"
                f"- Project: {project.get('name')}\n"
                f"- Source pipeline: {source_pipeline.get('pipeline_id')}\n"
                f"- Converted pipeline: {converted_pipeline.get('pipeline_id')}\n"
                f"- Runtime: {execution_plan.get('runtime')} on {execution_plan.get('target_platform')}"
            ),
            _markdown_cell(
                "## Execution Plan\n\n"
                f"- Schedule: {execution_plan.get('schedule', {}).get('cron')} ({execution_plan.get('schedule', {}).get('timezone')})\n"
                f"- Retries: {execution_plan.get('retries', {}).get('max_attempts')} attempts\n"
                f"- Workspaces: {', '.join(workspace.get('name', '') for workspace in workspaces)}"
            ),
            _code_cell(f"legacy_code = '''\n{original_code}\n'''\nlegacy_code"),
            _code_cell(f"converted_code = '''\n{converted_code}\n'''\nconverted_code"),
            _code_cell(
                "migration_plan = " + json.dumps(
                    {
                        "source_flow": source_pipeline.get("summary", {}),
                        "converted_flow": converted_pipeline.get("summary", {}),
                        "execution_plan": execution_plan,
                    },
                    indent=2,
                )
            ),
        ]
        updated = self.notebook_service.update_notebook(
            notebook["id"],
            {"cells": cells, "metadata": notebook_metadata},
            tenant_id,
        )
        return updated or notebook

    def _deployment_handoff(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        converted_pipeline: Dict[str, Any],
        execution_plan: Dict[str, Any],
        project: Dict[str, Any],
        target_datasets: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        target_config = {
            "runtime": execution_plan.get("runtime"),
            "schedule": execution_plan.get("schedule"),
            "retries": execution_plan.get("retries"),
            "parameters": execution_plan.get("parameters"),
            "project_id": project.get("id"),
            "target_dataset_ids": [dataset.get("id") for dataset in target_datasets],
        }
        if user_role != "admin":
            return {
                "mode": "draft",
                "recommended_target": execution_plan.get("target_platform"),
                "target_config": target_config,
            }

        deployment = self.deployer_service.deploy_pipeline(
            tenant_id=tenant_id,
            pipeline_id=str(converted_pipeline.get("pipeline_id") or ""),
            target_platform=str(execution_plan.get("target_platform") or "container"),
            deployed_by=user_id,
            target_config=target_config,
        )
        return {
            "mode": "queued",
            "recommended_target": execution_plan.get("target_platform"),
            "deployment": deployment,
            "target_config": target_config,
        }

    def bootstrap_program(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        artifact_name: str | None,
        original_code: str,
        converted_code: str,
        source_language: str,
        target_language: str,
        comparison: Dict[str, Any],
        source_pipeline: Dict[str, Any],
        converted_pipeline: Dict[str, Any],
        project_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        artifact_label = _artifact_label(artifact_name)
        execution_plan = _runtime_profile(target_language)
        execution_plan.update(
            {
                "source_pipeline_id": source_pipeline.get("pipeline_id"),
                "converted_pipeline_id": converted_pipeline.get("pipeline_id"),
                "monitoring": {
                    "diff_count": comparison.get("diff_count"),
                    "similarity_ratio": comparison.get("similarity_ratio"),
                    "success_signal": "target dataset materialized and quality check passed",
                },
            }
        )
        project, workspaces, context_mode, active_workspace_id = self._resolve_project_context(
            tenant_id,
            user_id,
            artifact_label,
            source_language,
            target_language,
            source_pipeline,
            converted_pipeline,
            requested_project_id=project_id,
            requested_workspace_id=workspace_id,
        )

        source_datasets = self._register_source_datasets(tenant_id, project["id"], artifact_label, source_language, source_pipeline)
        for dataset in source_datasets:
            self.governance_service.log_action(tenant_id, user_id, "register", "dataset", dataset["id"], None, dataset)

        quality_score = float(comparison.get("similarity_ratio") or 0.0)
        target_datasets = self._register_target_datasets(
            tenant_id,
            project["id"],
            artifact_label,
            target_language,
            converted_pipeline,
            execution_plan,
            quality_score,
        )
        for dataset in target_datasets:
            self.governance_service.log_action(tenant_id, user_id, "register", "dataset", dataset["id"], None, dataset)

        lineage_records: List[Dict[str, Any]] = []
        for source_dataset in source_datasets:
            for target_dataset in target_datasets:
                lineage = self.catalog_service.add_lineage(
                    tenant_id,
                    str(source_dataset.get("id") or ""),
                    str(target_dataset.get("id") or ""),
                    str(converted_pipeline.get("pipeline_id") or ""),
                )
                lineage_records.append(lineage)
                self.governance_service.log_action(tenant_id, user_id, "link", "dataset_lineage", lineage["id"], None, lineage)

        quality_check = None
        if target_datasets:
            quality_check = self.catalog_service.add_quality_check(
                tenant_id=tenant_id,
                dataset_id=str(target_datasets[0].get("id") or ""),
                check_name="conversion_similarity_gate",
                status="passed" if quality_score >= 0.5 else "needs_review",
                metrics={
                    "similarity_ratio": quality_score,
                    "diff_count": comparison.get("diff_count"),
                    "source_pipeline_id": source_pipeline.get("pipeline_id"),
                    "converted_pipeline_id": converted_pipeline.get("pipeline_id"),
                },
                frequency="on_conversion",
            )
            self.governance_service.log_action(tenant_id, user_id, "check", "dataset_quality", quality_check["id"], None, quality_check)

        notebook = self._create_notebook(
            tenant_id,
            user_id,
            artifact_label,
            original_code,
            converted_code,
            source_pipeline,
            converted_pipeline,
            execution_plan,
            project,
            workspaces,
            active_workspace_id,
        )
        self.governance_service.log_action(tenant_id, user_id, "create", "notebook", notebook["id"], None, notebook)

        deployment_handoff = self._deployment_handoff(
            tenant_id,
            user_id,
            user_role,
            converted_pipeline,
            execution_plan,
            project,
            target_datasets,
        )
        deployment = deployment_handoff.get("deployment")
        if deployment:
            self.governance_service.log_action(tenant_id, user_id, "create", "deployment", deployment["id"], None, deployment)

        active_workspace = next(
            (workspace for workspace in workspaces if str(workspace.get("id") or "") == str(active_workspace_id or "")),
            None,
        )
        workspace_metadata = (
            {
                "id": active_workspace_id,
                "name": active_workspace.get("name") if active_workspace else None,
            }
            if active_workspace_id
            else None
        )

        source_dag = dict(source_pipeline.get("dag") or {})
        source_dag["metadata"] = {
            **dict(source_dag.get("metadata") or {}),
            "project_id": project.get("id"),
            "project": {"id": project.get("id"), "name": project.get("name")},
            **({"workspace_id": active_workspace_id} if active_workspace_id else {}),
            **({"workspace": workspace_metadata} if workspace_metadata else {}),
            "catalog": {"source_dataset_ids": [dataset.get("id") for dataset in source_datasets]},
        }
        update_pipeline(str(source_pipeline.get("pipeline_id") or ""), tenant_id, source_dag, str(source_pipeline.get("name") or "Source Flow"))

        converted_dag = dict(converted_pipeline.get("dag") or {})
        converted_dag["metadata"] = {
            **dict(converted_dag.get("metadata") or {}),
            "project_id": project.get("id"),
            "project": {"id": project.get("id"), "name": project.get("name")},
            **({"workspace_id": active_workspace_id} if active_workspace_id else {}),
            **({"workspace": workspace_metadata} if workspace_metadata else {}),
            "catalog": {
                "source_dataset_ids": [dataset.get("id") for dataset in source_datasets],
                "target_dataset_ids": [dataset.get("id") for dataset in target_datasets],
                "lineage_ids": [record.get("id") for record in lineage_records],
                "quality_check_id": quality_check.get("id") if quality_check else None,
            },
            "execution_plan": execution_plan,
            "notebook_id": notebook.get("id"),
            "deployment_handoff": deployment_handoff,
        }
        update_pipeline(str(converted_pipeline.get("pipeline_id") or ""), tenant_id, converted_dag, str(converted_pipeline.get("name") or "Converted Flow"))

        source_pipeline["dag"] = source_dag
        converted_pipeline["dag"] = converted_dag

        return {
            "project": project,
            "workspaces": workspaces,
            "project_context": {
                "mode": context_mode,
                "active_workspace_id": active_workspace_id,
            },
            "catalog": {
                "source_datasets": source_datasets,
                "target_datasets": target_datasets,
                "lineage": lineage_records,
                "quality_check": quality_check,
            },
            "notebook": {
                "id": notebook.get("id"),
                "title": notebook.get("title"),
                "updated_at": notebook.get("updated_at"),
            },
            "execution_plan": execution_plan,
            "deployment_handoff": deployment_handoff,
        }