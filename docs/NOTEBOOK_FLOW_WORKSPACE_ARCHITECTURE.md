# Notebook Workspace Architecture

## Architectural stance

Nexora Notebook Workspace is not a second scheduler, graph model, or runtime. It is a notebook-first projection of the same authoring, validation, and execution system already used by Flow Builder.

- Notebook documents remain persisted assets.
- Notebook nodes remain first-class nodes in the unified DAG.
- Notebook executions compile into pipeline execution units and run through the same pipeline runner.
- Flow Builder remains the orchestration system of record.
- Notebook Workspace becomes the primary development and interactive execution surface for notebook-backed pipeline work.

Notebook execution now flows through compiled requests to `POST /notebooks/{notebook_id}/executions`, returning standard `run_id`, node telemetry, and log cursors from the shared pipeline execution engine.

## Single source of truth model

| Concern | Source of truth | Reused by |
| --- | --- | --- |
| Notebook document | Notebook service document store | Notebook Workspace editor, Flow notebook node config, promotion flows |
| Notebook step in DAG | `pipeline_authoring` notebook node definition | Flow Builder authoring, notebook flow binding, pipeline validation |
| Graph validation | `POST /pipelines/validate` | Flow save, notebook attach-to-flow, notebook execution planning |
| Execution | `pipeline_runner` | Flow runs, notebook cell runs, notebook run-all, promotion jobs |
| Telemetry | `pipeline_runs`, `pipeline_run_nodes`, `pipeline_run_logs` | Flow overlays, notebook output rail, runtime operations |
| Data context | Catalog and connection-backed dataset APIs | Dataset browser, drag-to-cell, linked notebook datasets |

## Domain model

| Object | Purpose | Key fields |
| --- | --- | --- |
| `NotebookAsset` | Persisted notebook document | `id`, `title`, `cells`, `metadata`, `dataset_links`, `flow_binding` |
| `NotebookFlowBinding` | Connects a notebook asset to the unified DAG | `pipeline_id`, `node_id`, `entrypoint_cell`, `runtime_profile`, `execution_binding` |
| `NotebookSession` | Active interactive execution context | `session_id`, `notebook_id`, `runtime_target`, `run_id`, `status`, `resource_usage` |
| `NotebookExecutionUnit` | Internal compiled execution unit for a runnable cell | `unit_id`, `cell_id`, `language`, `executor`, `upstream_unit_ids`, `dataset_refs` |
| `NotebookOutputArtifact` | Structured cell output emitted by the engine | `cell_id`, `output_type`, `mime_type`, `data`, `artifact_ref` |

## Entry points

| Entry point | UX action | Backend effect |
| --- | --- | --- |
| Dataset detail | Open in Notebook | Open an existing notebook tab or create a notebook seeded with dataset binding, browser context, and optional query starter cells |
| Flow node | Edit in Notebook | Resolve the notebook attached to the selected node and load linked pipeline and node context into the workspace |
| New notebook | Attach to flow | Create notebook asset, bind it to a new or existing notebook node, validate via `POST /pipelines/validate`, and persist through `PUT /pipelines/{pipeline_id}` |

## React component architecture

| Component | Responsibility |
| --- | --- |
| `NotebookWorkspacePage` | Orchestrates workspace hydration, notebook tabs, flow binding, runtime polling, and promotion actions |
| `NotebookWorkspaceShell` | Owns panel layout, resize behavior, and cross-panel state handoff |
| `NotebookTabStrip` | Supports multi-tab notebooks, dirty badges, close/reopen behavior, and context-aware entry points from dataset or flow |
| `NotebookPrimaryToolbar` | Exposes save, run cell, run selection, run all, attach-to-flow, and deploy actions |
| `NotebookEditorSurface` | Renders ordered cells, cell selection, drag targets, and notebook-level keyboard interactions |
| `NotebookCellEditor` | Monaco-backed editor surface for Python, SQL, and PySpark cells |
| `NotebookCellToolbar` | Owns per-cell language, run, duplicate, delete, and convert-to-markdown actions |
| `NotebookOutputStack` | Renders tables, logs, charts, errors, and artifact links for the selected cell or selection run |
| `NotebookDataBrowserPanel` | Shows datasets, previews, schemas, drag payloads, and query insertion helpers |
| `NotebookRuntimeSelector` | Selects local or cluster runtime and shows live resource posture |
| `NotebookFlowBindingPanel` | Shows linked pipeline and node details, entrypoint cell, parameters, validation posture, and promotion controls |
| `NotebookExecutionRail` | Shows run history, live cell states, run logs, and retry entry points using the same telemetry model as Flow |

## State management

The notebook workspace should follow the same reducer-driven model used by Flow Builder so notebook authoring, execution, and telemetry remain explicit and debuggable.

| Slice | Fields | Purpose |
| --- | --- | --- |
| `workspace` | `notebooks`, `datasets`, `pipelines`, `runtimeProfiles`, `nodeCatalog` | Hydrates the workspace with notebook inventory, data context, runtime options, and the same node catalog used by Flow Builder |
| `editor` | `openTabs`, `activeNotebookId`, `draftCellsByNotebookId`, `dirtyNotebookIds`, `selectedCellId`, `selectionRange` | Keeps document state, multi-tab behavior, cell selection, and save posture coherent |
| `binding` | `flowBindingsByNotebookId`, `pipelineId`, `nodeId`, `entrypointCellId`, `validation` | Keeps notebook-to-flow linkage explicit and reuses pipeline validation state |
| `execution` | `activeSessionId`, `activeRunId`, `executionMode`, `runtimeTarget`, `cellStatusById`, `resourceUsage`, `busyKey` | Tracks interactive execution, runtime selection, cell-level status, and cluster or local posture |
| `outputs` | `outputsByCellId`, `logsByCellId`, `tablesByCellId`, `chartsByCellId` | Stores structured results mapped from pipeline telemetry back to notebook cells |
| `browser` | `selectedDatasetId`, `datasetPreviewById`, `dragPayload`, `queryDraft` | Drives the dataset browser and drag-to-cell workflow |
| `presentation` | `leftPanelMode`, `rightPanelTab`, `bottomRailTab`, `feedback`, `events` | Controls visible panels, output focus, and workspace event stream |

Recommended reducer split:

- `notebookWorkspaceReducer` for tabs, document edits, flow bindings, and dataset browser state.
- `notebookExecutionReducer` for session, run, output, and telemetry updates.

## Layout blueprint

| Zone | Purpose |
| --- | --- |
| Top command bar | Notebook tabs, save, run controls, runtime picker, attach-to-flow, and deploy actions |
| Left rail | Dataset browser, notebook inventory, schemas, and drag sources |
| Center workbench | Cell stack with Python, SQL, and PySpark editors, plus inline run affordances |
| Right inspector | Runtime selector, linked flow node config, parameters, validation, and deployment posture |
| Bottom rail | Output, tables, charts, logs, run history, and resource usage |

## Backend API mapping

| Need | Route | Reuse |
| --- | --- | --- |
| Notebook inventory and document CRUD | `POST /notebooks`, `GET /notebooks`, `GET /notebooks/{id}`, `PUT /notebooks/{id}` | Keeps notebook assets persisted without introducing a new scheduler |
| Open from dataset or flow node | `POST /notebooks/open` | Resolves notebook asset, dataset context, and flow binding in one request |
| Bind notebook to flow | `POST /notebooks/{id}/flow-binding` plus `PUT /pipelines/{pipeline_id}` | Reuses the notebook node kind and pipeline authoring contract |
| Validate notebook as a flow step | `POST /pipelines/validate` | Keeps notebook validation under the same graph rules as Flow Builder |
| Execute cell, selection, or notebook | `POST /notebooks/{id}/executions` | Compiles notebook cells into execution units and delegates run creation to `pipeline_runner` |
| Poll execution and logs | `GET /pipelines/runs/{run_id}`, `GET /pipelines/runs/{run_id}/nodes`, `GET /pipelines/runs/{run_id}/logs` | Reuses existing run, node, and log telemetry without a separate notebook execution feed |
| Read live session posture | `GET /notebooks/{id}/sessions/{session_id}` | Resolves notebook-specific session metadata such as selected runtime, active cells, and resource usage |
| Promote notebook to deployable unit | `PUT /pipelines/{pipeline_id}` followed by deployment routes | Notebook remains a pipeline step and deployable unit through the existing flow-to-deploy path |

## Execution flow design

1. The user opens Notebook Workspace from a dataset, a flow node, or a new notebook action.
2. The frontend hydrates the notebook document, linked datasets, flow binding, runtime options, and the notebook node definition from the same backend catalog used by Flow Builder.
3. Saving the document updates notebook content through `PUT /notebooks/{id}`. Attaching or reattaching to Flow updates the bound notebook node through `POST /notebooks/{id}/flow-binding` and `PUT /pipelines/{pipeline_id}`.
4. Running a cell, a selection, or the whole notebook sends a single execution request that includes the selected cell ids, runtime target, parameters, linked datasets, and optional flow context.
5. The notebook compiler converts executable cells into ordered `NotebookExecutionUnit` items. Markdown cells do not become execution units. Python, SQL, and PySpark cells map to language-specific executors while preserving the notebook node envelope for lineage and orchestration.
6. The compiler emits a transient execution plan that conforms to the existing pipeline execution model. The pipeline runner creates a standard `run_id`, initializes run nodes, and emits logs and status changes through the same telemetry tables already used by Flow Builder.
7. The frontend polls standard run telemetry and maps node execution units back to cell ids. Outputs are rendered as tables, logs, charts, or errors inside the notebook workspace without inventing a separate result channel.
8. When the notebook is promoted, the bound notebook node remains a normal node in the main DAG, which means deployment, retries, validation, and operator drill-down stay aligned with the rest of the platform.

## Cell-to-execution mapping

| Cell type | Execution behavior | Engine mapping |
| --- | --- | --- |
| Markdown | No execution unit | Persisted as notebook document metadata only |
| Python | Compiled into one notebook execution unit | `executor = notebook.cell.python` on the shared pipeline runner |
| SQL | Compiled into one notebook execution unit | `executor = notebook.cell.sql` with dataset-aware query context |
| PySpark | Compiled into one notebook execution unit | `executor = notebook.cell.pyspark` with local or cluster runtime selection |

Run modes:

- `Run cell` compiles one executable cell and mounts current notebook session state.
- `Run selection` compiles a contiguous selected range and preserves ordering between selected cells.
- `Run all` compiles all executable cells in notebook order.

## Runtime model

| Runtime target | Purpose | Resource signals |
| --- | --- | --- |
| `local` | Fast feedback loop for authoring, debugging, and lightweight dataset inspection | `wall_time_ms`, `cpu_ms`, `memory_mb_peak` |
| `cluster` | Future-ready scaled execution for PySpark, larger SQL workloads, and deployable notebook jobs | `cluster_id`, `spark_app_id`, `driver_memory_mb`, `executor_memory_mb`, `task_count` |

The runtime selector belongs in the notebook workspace itself, but its value must propagate into the notebook node `execution_binding.runtime_profile` so Flow runs and notebook runs stay consistent.

## Output model

| Output type | Rendering surface |
| --- | --- |
| Table | Grid view with pagination, schema badge, and dataset promotion actions |
| Log stream | Chronological log panel reusing pipeline log cursor semantics |
| Chart | Structured chart payload rendered inline and pinned in the output rail |
| Error | Inline failure summary with expandable stack or trace detail |

## Flow integration rules

- Notebook authoring never bypasses `pipeline_authoring` validation.
- Notebook execution never bypasses `pipeline_runner`.
- Notebook telemetry never bypasses pipeline run, node, and log tables.
- Notebook promotion never creates a second deployable abstraction; it updates the same pipeline DAG.
- Notebook nodes stay `kind = notebook` in the persisted DAG even if the execution engine expands them into cell-level internal execution units.

## Implementation guidance

1. Replace the legacy per-cell execute route with a notebook execution compiler that delegates to `pipeline_runner`.
2. Introduce notebook session and flow-binding endpoints before adding cluster-specific adapters.
3. Keep the notebook UI reducer-driven and telemetry-polling first, matching the current Flow Builder implementation.
4. Add hierarchical telemetry support later if the product needs a top-level notebook node with expandable child cell execution units in Flow overlays.