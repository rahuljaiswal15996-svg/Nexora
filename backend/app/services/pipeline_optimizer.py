import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.services.db import get_connection

class PipelineOptimizerService:
    """Service for pipeline performance optimization and cost analysis."""

    def __init__(self):
        pass

    def get_metrics(self, pipeline_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Get performance metrics for a pipeline."""
        conn = get_connection()
        cursor = conn.cursor()

        try:
            # Get pipeline run statistics
            cursor.execute("""
                SELECT
                    COUNT(*) as total_runs,
                    AVG(JULIANDAY(finished_at) - JULIANDAY(started_at)) * 24 * 60 * 60 as avg_execution_time,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
                FROM pipeline_runs
                WHERE pipeline_id = ? AND tenant_id = ?
                AND finished_at IS NOT NULL
                AND started_at > datetime('now', '-30 days')
            """, (pipeline_id, tenant_id))

            result = cursor.fetchone()

            # Calculate estimated monthly cost (simplified)
            # In a real implementation, this would integrate with cloud provider APIs
            estimated_cost = 0
            if result and result[0]:  # total_runs
                # Rough estimate: $0.10 per minute of execution
                estimated_cost = (result[1] or 0) * (result[0] or 0) * 0.10

            metrics = {
                "pipeline_id": pipeline_id,
                "total_runs": result[0] if result else 0,
                "avg_execution_time": f"{result[1]:.1f}s" if result and result[1] else "N/A",
                "success_rate": f"{result[2]:.1f}" if result and result[2] else "N/A",
                "estimated_cost": f"{estimated_cost:.2f}",
                "last_updated": datetime.utcnow().isoformat()
            }

            return metrics

        finally:
            conn.close()

    def optimize_pipeline(self, pipeline_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Analyze pipeline and provide optimization recommendations."""
        metrics = self.get_metrics(pipeline_id, tenant_id)

        recommendations = []
        actions = []

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
            "analysis_date": datetime.utcnow().isoformat(),
            "current_metrics": metrics,
            "recommendations": recommendations,
            "actions": actions,
            "optimization_score": self._calculate_optimization_score(metrics)
        }

    def get_cost_analysis(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Get cost analysis across all pipelines."""
        conn = get_connection()
        cursor = conn.cursor()

        try:
            # Get cost breakdown by pipeline
            cursor.execute("""
                SELECT
                    p.id,
                    p.name,
                    COUNT(pr.id) as run_count,
                    AVG(JULIANDAY(pr.finished_at) - JULIANDAY(pr.started_at)) * 24 * 60 * 60 as avg_time
                FROM pipelines p
                LEFT JOIN pipeline_runs pr ON p.id = pr.pipeline_id
                WHERE p.tenant_id = ?
                GROUP BY p.id, p.name
            """, (tenant_id,))

            pipelines = []
            total_cost = 0

            for row in cursor.fetchall():
                pipeline_id, name, run_count, avg_time = row
                cost = (avg_time or 0) * (run_count or 0) * 0.10  # $0.10 per minute
                total_cost += cost

                pipelines.append({
                    "id": pipeline_id,
                    "name": name,
                    "run_count": run_count,
                    "avg_execution_time": f"{avg_time:.1f}s" if avg_time else "N/A",
                    "estimated_cost": f"{cost:.2f}"
                })

            return {
                "tenant_id": tenant_id,
                "total_monthly_cost": f"{total_cost:.2f}",
                "pipelines": pipelines,
                "analysis_period": "30 days",
                "generated_at": datetime.utcnow().isoformat()
            }

        finally:
            conn.close()

    def auto_scale(self, pipeline_id: str, target_metrics: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Automatically scale pipeline resources based on target metrics."""
        # This is a simplified implementation
        # In a real system, this would integrate with cloud provider APIs

        current_metrics = self.get_metrics(pipeline_id, tenant_id)

        scaling_decisions = []

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
            "timestamp": datetime.utcnow().isoformat()
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