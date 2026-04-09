import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import CodeEditor from '../components/CodeEditor';
import DiffViewer from '../components/DiffViewer';
import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import { toErrorMessage } from '../lib/platform';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';
import { convertFile, convertText, createShadowRun } from '../services/api';
import { clearHistory, clearLocalHistory, fetchHistory, loadLocalHistory, saveLocalHistory } from '../services/history';

const INITIAL_SAMPLE = `PROC SQL
SELECT * FROM users;`;
const SHADOW_REVIEW_THRESHOLD = 1.01;

const SOURCE_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'sas', label: 'SAS / PROC SQL' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'r', label: 'R' },
  { value: 'spark_sql', label: 'Spark SQL' },
  { value: 'scala', label: 'Scala' },
  { value: 'shell', label: 'Shell' },
];

const TARGET_LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'pyspark', label: 'PySpark' },
  { value: 'dbt', label: 'dbt Model SQL' },
];

function normalizeLocalEntry(entry) {
  return {
    ...entry,
    source: 'local',
    loadable: Boolean(entry?.data),
    timestamp: entry?.timestamp || new Date().toISOString(),
    filename: entry?.filename || 'pasted-code',
  };
}

function normalizeRemoteEntry(entry) {
  return {
    ...entry,
    source: 'backend',
    loadable: false,
    data: null,
    originalPreview: entry?.original_preview || '',
    convertedPreview: entry?.converted_preview || '',
    timestamp: entry?.timestamp || new Date().toISOString(),
    filename: entry?.filename || 'conversion',
  };
}

function mergeHistoryEntries(remoteEntries, localEntries) {
  const seen = new Set();
  const merged = [];

  [...localEntries, ...remoteEntries].forEach((entry) => {
    const key = `${entry.id || entry.timestamp || entry.summary}-${entry.source}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(entry);
  });

  return merged.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

function buildHistoryEntry(data, file) {
  return {
    id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    filename: file?.name || 'pasted-code',
    summary: data?.comparison?.changed ? 'Changed' : 'No change',
    originalPreview: (data?.original || '').slice(0, 160),
    convertedPreview: (data?.converted || '').slice(0, 160),
    data,
  };
}

export default function ComparePage() {
  const router = useRouter();
  const {
    activeProject,
    activeProjectId,
    activeWorkspaceId,
    context: projectNavigationContext,
    error: projectWorkspaceError,
    loading: projectWorkspaceLoading,
    projects: projectOptions,
    setActiveProject,
    setActiveWorkspace,
  } = useProjectWorkspace();
  const [file, setFile] = useState(null);
  const [code, setCode] = useState(INITIAL_SAMPLE);
  const [sourceLanguage, setSourceLanguage] = useState('sas');
  const [targetLanguage, setTargetLanguage] = useState('python');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyMode, setHistoryMode] = useState('loading');
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shadowCandidate, setShadowCandidate] = useState(null);

  const migrationProjectContext = useMemo(
    () => ({
      projectId: result?.migration_program?.project?.id || activeProjectId || '',
      workspaceId:
        result?.migration_program?.project_context?.active_workspace_id ||
        activeWorkspaceId ||
        result?.migration_program?.workspaces?.[0]?.id ||
        '',
    }),
    [activeProjectId, activeWorkspaceId, result],
  );

  const migrationSummary = result?.meta?.migration_summary || null;
  const targetDatasetCount = migrationSummary?.target_dataset_ids?.length || 0;

  async function loadHistoryData() {
    const localEntries = loadLocalHistory().map(normalizeLocalEntry);

    try {
      const remoteEntries = (await fetchHistory()).map(normalizeRemoteEntry);
      setHistory(mergeHistoryEntries(remoteEntries, localEntries));
      setHistoryMode('synced');
    } catch {
      setHistory(localEntries);
      setHistoryMode(localEntries.length ? 'local' : 'empty');
    }
  }

  useEffect(() => {
    void loadHistoryData();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFeedback('');
    setResult(null);
    setShadowCandidate(null);

    if (!file && !code.trim()) {
      setError('Please upload a file or paste code to convert.');
      return;
    }

    setLoading(true);

    try {
      const data = file
        ? await convertFile(file, { sourceLanguage, targetLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId })
        : await convertText(code, { sourceLanguage, targetLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId });

      setResult(data);
      saveLocalHistory(buildHistoryEntry(data, file));
      await loadHistoryData();
      setFeedback('Conversion completed. Continue into Flow or Notebook workspaces, or create a shadow-review checkpoint.');
    } catch (requestError) {
      setError(toErrorMessage(requestError) || 'Conversion failed');
    } finally {
      setLoading(false);
    }
  }

  function handleHistoryLoad(entry) {
    if (!entry.loadable || !entry.data) {
      setError('Only local history entries can be reopened in this compare workspace.');
      return;
    }

    setError('');
    setFeedback('Loaded a local conversion result from history.');
    setResult(entry.data);
    setShadowCandidate(null);
  }

  async function handleClearHistory() {
    setError('');
    setFeedback('');

    const clearResults = await Promise.allSettled([clearHistory(), Promise.resolve(clearLocalHistory())]);
    const remoteFailure = clearResults[0].status === 'rejected' ? clearResults[0].reason : null;

    await loadHistoryData();
    if (remoteFailure) {
      setFeedback('Local compare history was cleared. Backend history could not be cleared from this workspace.');
      return;
    }

    setFeedback('Conversion history cleared.');
  }

  async function handleSendToReview() {
    const reviewInput = result?.original || code;
    if (!reviewInput.trim()) {
      setError('There is no source input available to send into shadow review.');
      return;
    }

    try {
      setReviewing(true);
      setError('');
      const created = await createShadowRun(reviewInput, 'code', SHADOW_REVIEW_THRESHOLD);
      setShadowCandidate(created);
      setFeedback('Created a shadow review candidate and opened the review queue.');
      await router.push({
        pathname: '/review',
        query: { shadow: created.shadow_id },
      });
    } catch (requestError) {
      setError(toErrorMessage(requestError) || 'Failed to create a shadow review candidate.');
    } finally {
      setReviewing(false);
    }
  }

  const compareGuideSteps = [
    {
      key: 'migration',
      label: 'Migration',
      description: 'Convert source logic into the active project context and inspect the resulting diff.',
      state: 'current',
      value: result ? `${targetDatasetCount} catalog assets linked` : 'Awaiting conversion',
      href: buildWorkspaceHref('/compare', projectNavigationContext),
    },
    {
      key: 'shadow-review',
      label: 'Shadow Review',
      description: 'Create a human-review candidate when the conversion needs explicit approval.',
      state: shadowCandidate ? 'complete' : result ? 'next' : 'upcoming',
      value: shadowCandidate?.shadow_id ? shadowCandidate.shadow_id.slice(0, 8).toUpperCase() : 'Create review candidate',
      href: shadowCandidate?.shadow_id ? { pathname: '/review', query: { shadow: shadowCandidate.shadow_id } } : '/review',
    },
    {
      key: 'governance',
      label: 'Governance',
      description: 'Escalate policy-sensitive or release-sensitive work into governed resolution.',
      state: shadowCandidate ? 'next' : 'upcoming',
      value: 'Open governance review desk',
      href: '/governance/reviews',
    },
    {
      key: 'runtime',
      label: 'Runtime',
      description: 'Return approved assets into Flow Builder and Runtime Ops for execution validation.',
      state: result ? 'next' : 'upcoming',
      value: 'Resume execution path',
      href: buildWorkspaceHref('/runtime', migrationProjectContext),
    },
  ];

  return (
    <PlatformShell
      eyebrow="Compare Workspace"
      title="Convert legacy code inside the active project context and route high-risk output into explicit review."
      description="Compare now behaves like a real product workspace instead of a detached utility page. Conversion stays scoped to the selected project and exposes direct handoff into Flow, Notebook, and shadow-review checkpoints."
      focus="project"
      navigationContext={projectNavigationContext}
      aside={
        <ProjectWorkspaceContext
          projects={projectOptions}
          activeProject={activeProject}
          activeWorkspaceId={activeWorkspaceId}
          loading={projectWorkspaceLoading}
          error={projectWorkspaceError}
          onProjectChange={setActiveProject}
          onWorkspaceChange={setActiveWorkspace}
        />
      }
      actions={
        error || feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white/80 text-slate-600'}`}>
            {error || feedback}
          </div>
        ) : null
      }
    >
      <WorkflowGuide
        currentStep="migration"
        steps={compareGuideSteps}
        primaryAction={result ? { label: 'Open Flow Builder', href: buildWorkspaceHref('/flow', migrationProjectContext) } : { label: 'Open Migration Studio', href: buildWorkspaceHref('/migration-studio', projectNavigationContext) }}
        secondaryAction={{ label: 'Open Governance Reviews', href: '/governance/reviews', tone: 'secondary' }}
        title="Use compare as the migration-to-review checkpoint"
        description="This workspace should tell the user exactly what happens after conversion: continue inside project workspaces, or force a shadow-review candidate into the approval queue when the output needs human sign-off."
      />

      <PlatformPanel title="Compare snapshot" description="See project scope, conversion history posture, and downstream handoff readiness before drilling into the code diff.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Project" value={activeProject?.name || 'Unscoped'} detail="Conversions will attach to this active project and workspace when available." />
          <MetricTile label="History Entries" value={history.length} detail={historyMode === 'synced' ? 'Backend summaries merged with local reopenable entries.' : historyMode === 'local' ? 'Showing local reopenable history only.' : 'No saved history yet.'} />
          <MetricTile label="Catalog Assets" value={targetDatasetCount} detail="Datasets linked from the most recent conversion result." />
          <MetricTile label="Shadow Review" value={shadowCandidate?.shadow_id ? shadowCandidate.shadow_id.slice(0, 8).toUpperCase() : 'none'} detail="The most recent review candidate created from this workspace." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Conversion workspace" description="Submit source code, compare the output, and decide whether to continue into project workspaces or force a reviewer checkpoint.">
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6 rounded-[28px] border border-stone-200/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Source language</label>
                  <select
                    value={sourceLanguage}
                    onChange={(event) => setSourceLanguage(event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                  >
                    {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Target language</label>
                  <select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                  >
                    {TARGET_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Upload code file</label>
                <input
                  type="file"
                  accept=".sql,.sas,.py,.r,.scala,.sh,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-2xl file:border-0 file:bg-primary file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  If a file is selected it takes precedence over the pasted source. The conversion request carries the active project and workspace context.
                </p>
              </div>

              <CodeEditor value={code} onChange={setCode} label="Paste source code" />

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
                >
                  {loading ? 'Converting...' : 'Convert and compare'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleClearHistory()}
                  className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                >
                  Clear compare history
                </button>
              </div>
            </form>

            <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Recent history</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">Local entries can be reopened with full results. Backend entries remain available as summaries.</div>
                </div>
                <StatusPill status={historyMode === 'synced' ? 'active' : historyMode === 'local' ? 'draft' : 'pending'} />
              </div>

              <div className="mt-4 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                {history.length ? (
                  history.map((entry) => (
                    <button
                      type="button"
                      key={`${entry.id || entry.timestamp}-${entry.source}`}
                      onClick={() => handleHistoryLoad(entry)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${entry.loadable ? 'border-stone-200 bg-white hover:bg-stone-50' : 'border-stone-200 bg-stone-100/80 opacity-85 hover:bg-stone-100'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{entry.filename}</div>
                        <div className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-stone-500">{entry.source}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{entry.summary}</div>
                      <div className="mt-2 text-xs text-stone-500">{new Date(entry.timestamp).toLocaleString()}</div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                        <div>Original preview: {entry.originalPreview || entry.original_preview || 'n/a'}</div>
                        <div>Converted preview: {entry.convertedPreview || entry.converted_preview || 'n/a'}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No compare history yet"
                    message="Run a conversion to capture a local reopenable result and a backend summary entry."
                    detail="The local history entry preserves the full compare result so this workspace can reopen it later."
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            {result ? (
              <div className="space-y-6">
                <div className="rounded-[28px] border border-stone-200/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Conversion result</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Migration candidate ready for workspace or review handoff</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        Use the scoped action buttons below to continue inside Flow Builder and Notebook Workspace, or create a forced shadow-review candidate when this output requires human approval.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700">Source: {result.source_language || sourceLanguage}</span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Target: {result.target_language || targetLanguage}</span>
                      {shadowCandidate ? <StatusPill status={shadowCandidate.review_status || 'manual_review'} /> : null}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void router.push(buildWorkspaceHref('/flow', migrationProjectContext))}
                      className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                    >
                      Open Flow Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => void router.push(buildWorkspaceHref('/notebooks', migrationProjectContext, result?.migration_program?.notebook?.id ? { notebook: result.migration_program.notebook.id } : {}))}
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                    >
                      Open Notebook Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendToReview()}
                      disabled={reviewing}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                    >
                      {reviewing ? 'Creating review candidate...' : 'Send to shadow review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void router.push('/governance/reviews')}
                      className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Open governance reviews
                    </button>
                  </div>

                  {migrationSummary ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <MetricTile label="Source Steps" value={migrationSummary.source_operations || 0} detail="Operations detected in the original source asset." />
                      <MetricTile label="Converted Steps" value={migrationSummary.converted_operations || 0} detail="Operations generated for the target flow." />
                      <MetricTile label="Shared Inputs" value={(migrationSummary.shared_inputs || []).length} detail={(migrationSummary.shared_inputs || []).length ? (migrationSummary.shared_inputs || []).join(', ') : 'No explicit shared inputs detected.'} />
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[28px] border border-stone-200/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
                    <div className="text-lg font-semibold text-slate-900">Compare metrics</div>
                    <ul className="mt-4 space-y-3 text-sm text-slate-600">
                      <li>Changed: {result.comparison?.changed ? 'Yes' : 'No'}</li>
                      <li>Original length: {result.comparison?.original_length || 0}</li>
                      <li>Converted length: {result.comparison?.converted_length || 0}</li>
                      <li>Original lines: {result.comparison?.original_line_count || 0}</li>
                      <li>Converted lines: {result.comparison?.converted_line_count || 0}</li>
                      <li>Similarity ratio: {result.comparison?.similarity_ratio || 0}</li>
                      <li>Diff tokens: {result.comparison?.diff_count || 0}</li>
                    </ul>

                    {shadowCandidate ? (
                      <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-700">
                        <div className="font-semibold">Shadow review candidate</div>
                        <div className="mt-2">{shadowCandidate.shadow_id}</div>
                        <div className="mt-2">Confidence {Number(shadowCandidate.confidence || 0).toFixed(3)}</div>
                      </div>
                    ) : (
                      <EmptyState
                        title="No review candidate yet"
                        message="This conversion result has not been sent into the shadow review queue."
                        detail="Use the amber action above when the diff needs explicit reviewer sign-off before promotion."
                      />
                    )}
                  </div>

                  <div className="rounded-[28px] border border-stone-200/80 bg-white/86 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <CodeEditor value={result.original} label="Original" readOnly />
                      <CodeEditor value={result.converted} label="Converted" readOnly />
                    </div>

                    <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <div className="text-lg font-semibold text-slate-900">Diff viewer</div>
                      <div className="mt-4">
                        <DiffViewer original={result.original} converted={result.converted} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Ready to compare"
                message="Upload a file or paste source code to generate a scoped migration candidate."
                detail="Once the result is available, this workspace can either continue into Flow Builder and Notebook Workspace or create a shadow-review checkpoint for human approval."
                actions={
                  <button
                    type="button"
                    onClick={() => void router.push(buildWorkspaceHref('/migration-studio', projectNavigationContext))}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Open Migration Studio
                  </button>
                }
              />
            )}
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}
