from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from app.services.db import get_connection


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _duration_seconds(started_at: Any, finished_at: Any) -> float | None:
    started = _parse_iso(started_at)
    finished = _parse_iso(finished_at)
    if not started or not finished:
        return None
    return max(0.0, (finished - started).total_seconds())

class PipelineOptimizerService:
    """Service for pipeline performance optimization and cost analysis."""

    def __init__(self):
        pass

    def get_metrics(self, pipeline_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Get performance metrics for a pipeline."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        with get_connection() as conn:
            rows = conn.execute(
                """
                SELECT
                    status,
                    started_at,
                    finished_at
                FROM pipeline_runs
                WHERE pipeline_id = ? AND tenant_id = ?
                AND finished_at IS NOT NULL
                AND started_at >= ?
                """,
                (pipeline_id, tenant_id, cutoff),
            ).fetchall()

        total_runs = len(rows)
        durations = [duration for duration in (_duration_seconds(row[1], row[2]) for row in rows) if duration is not None]
        avg_execution_time = sum(durations) / len(durations) if durations else 0.0
        successful_runs = sum(1 for row in rows if str(row[0] or "").lower() in {"success", "completed"})
        success_rate = (successful_runs * 100.0 / total_runs) if total_runs else 0.0
        estimated_cost = avg_execution_time * total_runs * 0.10

        metrics: Dict[str, Any] = {
            "pipeline_id": pipeline_id,
            "total_runs": total_runs,
            "avg_execution_time": f"{avg_execution_time:.1f}s" if total_runs else "N/A",
            "success_rate": f"{success_rate:.1f}" if total_runs else "N/A",
            "estimated_cost": f"{estimated_cost:.2f}",
            "last_updated": _now_iso(),
        }

        return metrics

    def optimize_pipeline(self, pipeline_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Analyze pipeline and provide optimization recommendations."""
        metrics = self.get_metrics(pipeline_id, tenant_id)

        recommendations: list[Dict[str, Any]] = []
        actions: list[Dict[str, Any]] = []

        # Analyze success rate
        success_rate = float(metrics["success_rate"]) if metrics["success_rate"] != "N/A" else 0
        if success_rate < 95:
            recommendations.append({
                "title": "Improve Pipeline Reliability",
                "description": "Your pipeline success rate is below 95%. Consider adding error handling and retries.",
                "severity": "high",
                "potential_savings": "Reduce failed runs by 50%"
            })
            actions.append({
                "name": "Add Error Handling",
                "description": "Implement retry logic and error recovery mechanisms",
                "type": "configuration"
            })

        # Analyze execution time
        if metrics["avg_execution_time"] != "N/A":
            exec_time = float(metrics["avg_execution_time"].replace("s", ""))
            if exec_time > 300:  # 5 minutes
                recommendations.append({
                    "title": "Optimize Execution Time",
                    "description": "Pipeline execution is taking longer than expected. Consider parallelization or resource optimization.",
                    "severity": "medium",
                    "potential_savings": "Reduce execution time by 30%"
                })
                actions.append({
                    "name": "Enable Parallel Execution",
                    "description": "Configure parallel task execution where possible",
                    "type": "performance"
                })

        # Cost optimization
        cost = float(metrics["estimated_cost"]) if metrics["estimated_cost"] != "0.00" else 0
        if cost > 100:  # $100/month
            recommendations.append({
                "title": "Reduce Infrastructure Costs",
                "description": "High monthly costs detected. Consider spot instances or reserved capacity.",
                "severity": "medium",
                "potential_savings": "Save up to 40% on infrastructure costs"
            })
            actions.append({
                "name": "Switch to Spot Instances",
                "description": "Use spot instances for non-critical workloads",
                "type": "cost_optimization"
            })

        # Default recommendations if no issues found
        if not recommendations:
            recommendations.append({
                "title": "Pipeline is Well-Optimized",
                "description": "Your pipeline is performing well. Continue monitoring for any changes.",
                "severity": "low",
                "potential_savings": "N/A"
            })

        return {
            "pipeline_id": pipeline_id,
            "analysis_date": _now_iso(),
            "current_metrics": metrics,
            "recommendations": recommendations,
            "actions": actions,
            "optimization_score": self._calculate_optimization_score(metrics)
        }

    def get_cost_analysis(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Get cost analysis across all pipelines."""
        with get_connection() as conn:
            rows = conn.execute(
                """
                SELECT
                    p.id,
                    p.name,
                    pr.started_at,
                    pr.finished_at
                FROM pipelines p
                LEFT JOIN pipeline_runs pr ON p.id = pr.pipeline_id
                WHERE p.tenant_id = ?
                ORDER BY p.created_at DESC
                """,
                (tenant_id,),
            ).fetchall()

        pipeline_metrics: dict[str, dict[str, Any]] = {}
        for row in rows:
            pipeline_id, name, started_at, finished_at = row
            metrics = pipeline_metrics.setdefault(
                str(pipeline_id),
                {
                    "id": pipeline_id,
                    "name": name,
                    "run_count": 0,
                    "durations": [],
                },
            )
            duration = _duration_seconds(started_at, finished_at)
            if duration is not None:
                metrics["run_count"] += 1
                metrics["durations"].append(duration)

        pipelines: list[Dict[str, Any]] = []
        total_cost = 0.0
        for metrics in pipeline_metrics.values():
            run_count_value = int(metrics["run_count"] or 0)
            durations = metrics["durations"]
            avg_time_value = sum(durations) / len(durations) if durations else 0.0
            cost = avg_time_value * run_count_value * 0.10
            total_cost += cost

            pipelines.append(
                {
                    "id": metrics["id"],
                    "name": metrics["name"],
                    "run_count": run_count_value,
                    "avg_execution_time": f"{avg_time_value:.1f}s" if avg_time_value else "N/A",
                    "estimated_cost": f"{cost:.2f}",
                }
            )

        return {
            "tenant_id": tenant_id,
            "total_monthly_cost": f"{total_cost:.2f}",
            "pipelines": pipelines,
            "analysis_period": "30 days",
            "generated_at": _now_iso(),
        }

    def auto_scale(self, pipeline_id: str, target_metrics: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Automatically scale pipeline resources based on target metrics."""
        # This is a simplified implementation
        # In a real system, this would integrate with cloud provider APIs

        current_metrics = self.get_metrics(pipeline_id, tenant_id)

        scaling_decisions: list[Dict[str, Any]] = []

        # Check if we need to scale based on execution time
        target_exec_time = target_metrics.get("max_execution_time", 300)  # 5 minutes default
        current_exec_time = float(current_metrics["avg_execution_time"].replace("s", "")) if current_metrics["avg_execution_time"] != "N/A" else 0

        if current_exec_time > target_exec_time:
            scaling_decisions.append({
                "type": "scale_up",
                "resource": "cpu",
                "current": "2 vCPUs",
                "recommended": "4 vCPUs",
                "reason": f"Execution time ({current_exec_time:.1f}s) exceeds target ({target_exec_time}s)"
            })

        # Check memory scaling
        if target_metrics.get("min_memory_gb", 4) > 4:
            scaling_decisions.append({
                "type": "scale_up",
                "resource": "memory",
                "current": "4 GB",
                "recommended": f"{target_metrics['min_memory_gb']} GB",
                "reason": "Memory requirements increased"
            })

        return {
            "pipeline_id": pipeline_id,
            "scaling_decisions": scaling_decisions,
            "applied": len(scaling_decisions) > 0,
            "estimated_cost_impact": f"+${len(scaling_decisions) * 50:.2f}/month",
            "timestamp": _now_iso()
        }

    def _calculate_optimization_score(self, metrics: Dict[str, Any]) -> float:
        """Calculate an optimization score from 0-100."""
        score = 100

        # Deduct points for poor success rate
        success_rate = float(metrics["success_rate"]) if metrics["success_rate"] != "N/A" else 100
        if success_rate < 95:
            score -= (100 - success_rate) * 0.5

        # Deduct points for long execution times
        if metrics["avg_execution_time"] != "N/A":
            exec_time = float(metrics["avg_execution_time"].replace("s", ""))
            if exec_time > 300:
                score -= min(20, (exec_time - 300) / 30)

        # Deduct points for high costs
        cost = float(metrics["estimated_cost"]) if metrics["estimated_cost"] != "0.00" else 0
        if cost > 200:
            score -= min(30, (cost - 200) / 50)

        return max(0, min(100, score))