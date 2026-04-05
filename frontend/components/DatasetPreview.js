export default function DatasetPreview({
  connection,
  datasets,
  selectedDatasetName,
  preview,
  loadingDatasets,
  loadingPreview,
  onSelectDataset,
}) {
  if (!connection) {
    return null;
  }

  return (
    <section className="mt-8 rounded-lg border border-surface-hover bg-white p-6 shadow-md">
      <div className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-primary">Dataset Explorer</h3>
          <p className="text-sm text-accent">
            Preview datasets exposed by {connection.name} in a Dataiku-style tabular workflow.
          </p>
        </div>
        <div className="rounded-lg bg-background px-3 py-2 text-sm text-accent">
          Connection type: <span className="font-semibold text-primary">{connection.type}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-lg border border-surface-hover bg-background p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent/70">Datasets</h4>
          {loadingDatasets ? (
            <div className="text-sm text-accent">Loading datasets...</div>
          ) : datasets.length === 0 ? (
            <div className="text-sm text-accent">No datasets available for this connection yet.</div>
          ) : (
            <div className="space-y-2">
              {datasets.map((dataset) => {
                const isActive = dataset.name === selectedDatasetName;
                return (
                  <button
                    key={dataset.name}
                    type="button"
                    onClick={() => onSelectDataset(dataset.name)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-surface-hover bg-white hover:bg-surface'
                    }`}
                  >
                    <div className="font-medium text-primary">{dataset.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-accent/60">{dataset.kind}</div>
                    <div className="mt-2 text-sm text-accent">{dataset.description}</div>
                    <div className="mt-2 text-xs text-accent/70">
                      {dataset.column_count} columns • {dataset.row_count_estimate.toLocaleString()} estimated rows
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-surface-hover bg-background p-4">
          {loadingPreview ? (
            <div className="flex h-full min-h-[320px] items-center justify-center text-accent">
              Loading dataset preview...
            </div>
          ) : !preview ? (
            <div className="flex h-full min-h-[320px] items-center justify-center text-accent">
              Select a dataset to load a preview.
            </div>
          ) : (
            <div>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-primary">{preview.dataset_name}</h4>
                  <p className="text-sm text-accent">{preview.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-accent/80">
                  <span className="rounded-full bg-white px-3 py-2 border border-surface-hover">
                    {preview.sample_size} sampled rows
                  </span>
                  <span className="rounded-full bg-white px-3 py-2 border border-surface-hover">
                    {preview.row_count_estimate.toLocaleString()} estimated rows
                  </span>
                  <span className="rounded-full bg-white px-3 py-2 border border-surface-hover uppercase">
                    {preview.kind}
                  </span>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {preview.columns.map((column) => (
                  <div key={column.name} className="rounded-lg border border-surface-hover bg-white px-3 py-3">
                    <div className="text-sm font-semibold text-primary">{column.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-accent/60">{column.type}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-surface-hover bg-white">
                <table className="min-w-full divide-y divide-surface-hover text-sm">
                  <thead className="bg-surface">
                    <tr>
                      {preview.columns.map((column) => (
                        <th
                          key={column.name}
                          className="px-4 py-3 text-left font-semibold text-primary"
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-hover">
                    {preview.rows.map((row, index) => (
                      <tr key={`${preview.dataset_name}-${index}`}>
                        {preview.columns.map((column) => (
                          <td key={column.name} className="px-4 py-3 text-accent">
                            {row[column.name] === null || row[column.name] === undefined
                              ? '—'
                              : String(row[column.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}