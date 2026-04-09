import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.db import init_db
from app.services.parser import parse_to_uir
from app.services.uir_service import save_uir
from app.services.conversion_engine import convert_code
from app.services.prompt_store import create_prompt
from app.services.pipeline_runner import create_pipeline, start_pipeline_run, get_run_status


def main():
    print("Initializing DB...")
    init_db()

    sample = """PROC SQL;\nSELECT id, name FROM users;\nquit;"""
    print("Parsing sample code to UIR...")
    uir = parse_to_uir(sample, language="sql")
    saved = save_uir("default", uir)
    print("Saved UIR id:", saved)

    # create a simple named prompt to exercise prompt_store integration
    create_prompt("default", "convert-to-sql", "Convert to SQL:\n\n{code}", version="v1", metadata={"source":"smoke"})

    print("Converting sample code using prompt_name... (rule-based may still apply)")
    result = convert_code(sample, language="sql", tenant_id="default", request_id=None, prompt_name="convert-to-sql")
    print("Conversion similarity:", result.get("comparison", {}).get("similarity_ratio"))

    print("Creating pipeline...")
    dag: dict[str, list[dict[str, Any]]] = {
        "nodes": [
            {
                "id": "seed_orders",
                "kind": "recipe",
                "label": "Seed Orders",
                "config": {
                    "language": "python",
                    "runtime_profile": "python-batch",
                    "expression": "[{\"order_id\": \"A1\", \"amount\": 10}, {\"order_id\": \"A2\", \"amount\": 15}]",
                    "output_dataset_name": "orders_seed",
                },
            },
            {
                "id": "normalize_orders",
                "kind": "recipe",
                "label": "Normalize Orders",
                "config": {
                    "language": "sql",
                    "runtime_profile": "warehouse-sql",
                    "expression": "SELECT order_id, amount FROM input_dataset ORDER BY order_id",
                    "output_dataset_name": "orders_normalized",
                },
            },
            {
                "id": "summarize_orders",
                "kind": "recipe",
                "label": "Summarize Orders",
                "config": {
                    "language": "python",
                    "runtime_profile": "python-batch",
                    "expression": "rows = upstream_results['normalize_orders']['output_artifacts'][0]['rows']\n{'row_count': len(rows), 'total_amount': sum(int(row['amount']) for row in rows)}",
                    "output_dataset_name": "orders_summary",
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "seed_orders", "target": "normalize_orders"},
            {"id": "e2", "source": "normalize_orders", "target": "summarize_orders"},
        ],
    }
    p = create_pipeline("default", "smoke-pipeline", dag)
    pipeline_id = p["id"]
    print("Pipeline created:", pipeline_id)

    print("Starting pipeline run...")
    run = start_pipeline_run(pipeline_id, "default", run_config={})
    run_id = run["run_id"]
    print("Run queued:", run_id)

    # Poll for run completion
    for _ in range(60):
        s = get_run_status(run_id)
        status = s.get("status") if s else None
        print("Run status:", status)
        if status in ("success", "failed"):
            break
        time.sleep(0.5)

    print("Final run status:", get_run_status(run_id))


if __name__ == "__main__":
    main()
