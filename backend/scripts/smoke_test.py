import sys
import time
from pathlib import Path

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
    dag = {"nodes": [{"id": "n1", "type": "task", "simulate_seconds": 0.1}, {"id": "n2", "type": "task", "simulate_seconds": 0.1}]}
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
        print("Run status:", s.get("status"))
        if s.get("status") in ("success", "failed"):
            break
        time.sleep(0.5)

    print("Final run status:", get_run_status(run_id))


if __name__ == "__main__":
    main()
