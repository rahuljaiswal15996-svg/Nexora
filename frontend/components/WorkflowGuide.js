import Link from 'next/link';

import { buildWorkspaceHref } from '../lib/projectWorkspace';

const STEP_META = [
  {
    key: 'projects',
    label: 'Project',
    description: 'Create the project and workspace boundary.',
  },
  {
    key: 'catalog',
    label: 'Catalog',
    description: 'Register datasets and inspect lineage context.',
  },
  {
    key: 'notebooks',
    label: 'Notebook',
    description: 'Author notebook logic against selected data.',
  },
  {
    key: 'flow',
    label: 'Flow',
    description: 'Bind assets into a validated executable graph.',
  },
  {
    key: 'runtime',
    label: 'Runtime',
    description: 'Run, observe, retry, and inspect execution state.',
  },
];

function isStepReady(stepKey, context, counts) {
  if (stepKey === 'projects') {
    return Boolean((context?.projectId || counts.projects > 0) && (context?.workspaceId || counts.workspaces > 0));
  }
  if (stepKey === 'catalog') {
    return (counts.datasets || 0) > 0;
  }
  if (stepKey === 'notebooks') {
    return (counts.notebooks || 0) > 0;
  }
  if (stepKey === 'flow') {
    return (counts.pipelines || 0) > 0;
  }
  if (stepKey === 'runtime') {
    return (counts.runs || 0) > 0;
  }
  return false;
}

function summarizeStepValue(stepKey, counts) {
  if (stepKey === 'projects') {
    return `${counts.projects || 0} projects / ${counts.workspaces || 0} workspaces`;
  }
  if (stepKey === 'catalog') {
    return `${counts.datasets || 0} datasets`;
  }
  if (stepKey === 'notebooks') {
    return `${counts.notebooks || 0} notebooks`;
  }
  if (stepKey === 'flow') {
    return `${counts.pipelines || 0} flows`;
  }
  if (stepKey === 'runtime') {
    return `${counts.runs || 0} runtime records`;
  }
  return '';
}

function stateTone(state) {
  if (state === 'current') {
    return {
      card: 'border-sky-200 bg-sky-50 shadow-[0_16px_32px_rgba(125,211,252,0.18)]',
      eyebrow: 'text-sky-700',
      badge: 'border-sky-200 bg-white text-sky-700',
    };
  }
  if (state === 'complete') {
    return {
      card: 'border-emerald-200 bg-emerald-50/70 shadow-[0_14px_30px_rgba(16,185,129,0.12)]',
      eyebrow: 'text-emerald-700',
      badge: 'border-emerald-200 bg-white text-emerald-700',
    };
  }
  if (state === 'next') {
    return {
      card: 'border-amber-200 bg-amber-50/80 shadow-[0_14px_30px_rgba(245,158,11,0.12)]',
      eyebrow: 'text-amber-700',
      badge: 'border-amber-200 bg-white text-amber-700',
    };
  }
  return {
    card: 'border-stone-200 bg-white shadow-[0_12px_26px_rgba(148,163,184,0.08)]',
    eyebrow: 'text-stone-500',
    badge: 'border-stone-200 bg-stone-50 text-stone-500',
  };
}

function stateLabel(state) {
  if (state === 'current') {
    return 'Current';
  }
  if (state === 'complete') {
    return 'Ready';
  }
  if (state === 'next') {
    return 'Next';
  }
  return 'Later';
}

function buildStepHref(stepKey, context, selection) {
  if (stepKey === 'projects') {
    return '/projects';
  }
  if (stepKey === 'catalog') {
    return buildWorkspaceHref('/catalog', context);
  }
  if (stepKey === 'notebooks') {
    return buildWorkspaceHref('/notebooks', context, {
      dataset: selection.selectedDatasetId || undefined,
    });
  }
  if (stepKey === 'flow') {
    return buildWorkspaceHref('/flow', context, {
      notebook: selection.selectedNotebookId || undefined,
      pipeline: selection.pipelineId || undefined,
    });
  }
  if (stepKey === 'runtime') {
    return buildWorkspaceHref('/runtime', context);
  }
  return '/projects';
}

function WorkflowAction({ action }) {
  if (!action) {
    return null;
  }

  const tone = action.tone === 'secondary'
    ? 'border-stone-200 bg-white text-slate-700 hover:bg-stone-50'
    : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100';

  if (!action.href) {
    return (
      <span className={`inline-flex rounded-2xl border px-4 py-3 text-sm font-semibold opacity-60 ${tone}`}>
        {action.label}
      </span>
    );
  }

  return (
    <Link href={action.href} className={`inline-flex rounded-2xl border px-4 py-3 text-sm font-semibold transition ${tone}`}>
      {action.label}
    </Link>
  );
}

export default function WorkflowGuide({
  currentStep,
  context = {},
  counts = {},
  steps = null,
  selectedDatasetId = '',
  selectedNotebookId = '',
  pipelineId = '',
  primaryAction = null,
  secondaryAction = null,
  title = 'Project workflow',
  description = 'Keep the user on one explicit path from project setup through runtime validation.',
}) {
  const resolvedSteps = steps || STEP_META.map((step) => ({
    ...step,
    href: buildStepHref(step.key, context, { selectedDatasetId, selectedNotebookId, pipelineId }),
  }));
  const readyByStep = steps
    ? {}
    : STEP_META.reduce(
        (result, step) => ({
          ...result,
          [step.key]: isStepReady(step.key, context, counts),
        }),
        {},
      );

  const nextStepKey = steps
    ? steps.find((step) => step.state === 'next')?.key
    : STEP_META.find((step, index) => {
        if (readyByStep[step.key]) {
          return false;
        }
        return STEP_META.slice(0, index).every((previousStep) => readyByStep[previousStep.key]);
      })?.key;

  return (
    <div className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.9))] p-6 shadow-[0_20px_55px_rgba(148,163,184,0.14)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Workflow hardening</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</div>
          {nextStepKey ? (
            <div className="mt-3 text-xs uppercase tracking-[0.24em] text-amber-700">Next unblock: {resolvedSteps.find((step) => step.key === nextStepKey)?.label}</div>
          ) : (
            <div className="mt-3 text-xs uppercase tracking-[0.24em] text-emerald-700">Workflow path is populated end to end</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WorkflowAction action={primaryAction} />
          <WorkflowAction action={secondaryAction} />
        </div>
      </div>

      <div className={`mt-6 grid gap-3 ${resolvedSteps.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-5'}`}>
        {resolvedSteps.map((step, index) => {
          const state = step.state || (currentStep === step.key ? 'current' : readyByStep[step.key] ? 'complete' : nextStepKey === step.key ? 'next' : 'upcoming');
          const tone = stateTone(state);
          const href = step.href || buildStepHref(step.key, context, { selectedDatasetId, selectedNotebookId, pipelineId });
          const value = step.value || summarizeStepValue(step.key, counts);

          return (
            <Link key={step.key} href={href} className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${tone.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div className={`text-[10px] uppercase tracking-[0.28em] ${tone.eyebrow}`}>0{index + 1}</div>
                <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}>
                  {stateLabel(state)}
                </div>
              </div>
              <div className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{step.label}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{step.description}</div>
              {value ? <div className="mt-4 text-xs uppercase tracking-[0.22em] text-stone-500">{value}</div> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}