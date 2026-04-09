import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RuntimePage from '../pages/runtime';
import {
  cancelJob,
  getAgentFleet,
  getDeployment,
  getPipeline,
  getSystemStatus,
  listDeployments,
  listJobs,
  listPipelineRuns,
  listRunLogs,
  listRunNodes,
  retryJob,
  rollbackDeployment,
} from '../services/api';

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/runtime' }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: function MockLink({ href, children }) {
    return <a href={href}>{children}</a>;
  },
}));

jest.mock('../components/DAGEditor', () => function MockDAGEditor() {
  return <div data-testid="dag-editor">Mock DAG</div>;
});

jest.mock('../services/api', () => ({
  cancelJob: jest.fn(),
  getAgentFleet: jest.fn(),
  getDeployment: jest.fn(),
  getPipeline: jest.fn(),
  getSystemStatus: jest.fn(),
  listDeployments: jest.fn(),
  listJobs: jest.fn(),
  listPipelineRuns: jest.fn(),
  listRunLogs: jest.fn(),
  listRunNodes: jest.fn(),
  retryJob: jest.fn(),
  rollbackDeployment: jest.fn(),
}));

const JOBS_PAYLOAD = {
  items: [
    {
      id: 'job-1',
      job_type: 'deployment',
      resource_type: 'deployment',
      resource_id: 'dep-1',
      status: 'failed',
      execution_mode: 'remote',
      attempt_count: 1,
      max_attempts: 3,
      claimed_by: null,
      finished_at: '2026-04-06T19:00:00Z',
      payload: { pipeline_id: 'pipe-1' },
      result: { deployment_id: 'dep-1' },
    },
  ],
};

const AGENTS_PAYLOAD = {
  items: [
    {
      agent_id: 'agent-1',
      status: 'active',
      last_heartbeat_at: '2026-04-06T19:00:00Z',
      observed_capacity: 2,
      version: '1.0.0',
      active_jobs: 1,
      active_runs: 0,
      workloads: [{ id: 'job-1', type: 'deployment', status: 'running' }],
    },
  ],
};

const RUNS_PAYLOAD = {
  items: [
    {
      id: 'run-1',
      pipeline_id: 'pipe-1',
      status: 'failed',
      execution_mode: 'local',
      started_at: '2026-04-06T19:00:00Z',
      updated_at: '2026-04-06T19:01:00Z',
      node_summary: {
        queued: 0,
        running: 0,
        success: 2,
        failed: 1,
      },
    },
  ],
};

const DEPLOYMENTS_PAYLOAD = {
  items: [
    {
      id: 'dep-1',
      pipeline_id: 'pipe-1',
      status: 'deployed',
      target_platform: 'container',
      target_id: 'target-1',
      created_at: '2026-04-06T19:00:00Z',
    },
  ],
};

const SYSTEM_PAYLOAD = {
  status: 'ok',
  detail: 'FastAPI backend is running',
};

const PIPELINE_PAYLOAD = {
  id: 'pipe-1',
  dag_json: {
    nodes: [
      { id: 'source', label: 'Source Orders', kind: 'dataset' },
      { id: 'transform', label: 'Transform Orders', kind: 'recipe' },
    ],
    edges: [{ id: 'e1', source: 'source', target: 'transform' }],
  },
};

const RUN_NODES_PAYLOAD = {
  items: [
    {
      node_id: 'transform',
      node_label: 'Transform Orders',
      node_kind: 'recipe',
      stage_index: 1,
      status: 'failed',
      attempt_count: 1,
      max_attempts: 1,
      error_text: 'Forced failure on node transform',
    },
  ],
};

const RUN_LOGS_PAYLOAD = {
  items: [
    {
      id: 1,
      level: 'error',
      message: 'Forced failure on node transform',
      created_at: '2026-04-06T19:01:00Z',
    },
  ],
  cursor: 1,
};

const DEPLOYMENT_DETAIL_PAYLOAD = {
  id: 'dep-1',
  pipeline_id: 'pipe-1',
  status: 'deployed',
  target_platform: 'container',
  target_id: 'target-1',
  runs: [
    {
      id: 'dep-run-1',
      status: 'success',
      started_at: '2026-04-06T19:00:00Z',
      status_details: { runtime: 'container' },
    },
  ],
};

describe('RuntimePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    listJobs.mockResolvedValue(JOBS_PAYLOAD);
    getAgentFleet.mockResolvedValue(AGENTS_PAYLOAD);
    listPipelineRuns.mockResolvedValue(RUNS_PAYLOAD);
    listDeployments.mockResolvedValue(DEPLOYMENTS_PAYLOAD);
    getSystemStatus.mockResolvedValue(SYSTEM_PAYLOAD);
    retryJob.mockResolvedValue({ status: 'ok', job: { id: 'job-2' } });
    cancelJob.mockResolvedValue({ status: 'ok', job: { ...JOBS_PAYLOAD.items[0], status: 'cancelled' } });
    getPipeline.mockResolvedValue(PIPELINE_PAYLOAD);
    listRunNodes.mockResolvedValue(RUN_NODES_PAYLOAD);
    listRunLogs.mockResolvedValue(RUN_LOGS_PAYLOAD);
    getDeployment.mockResolvedValue(DEPLOYMENT_DETAIL_PAYLOAD);
    rollbackDeployment.mockResolvedValue({ status: 'queued', job: { id: 'job-rollback-1' } });
  });

  async function renderRuntimePage() {
    await act(async () => {
      render(<RuntimePage />);
    });
    return screen.findByRole('button', { name: 'Retry job' });
  }

  it('renders the runtime snapshot and lets the operator retry a failed job', async () => {
    const user = userEvent.setup();

    expect(await renderRuntimePage()).toBeInTheDocument();

    expect(await screen.findByText('FastAPI backend is running')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Retry job' }));
    });

    await waitFor(() => {
      expect(retryJob).toHaveBeenCalledWith('job-1');
    });

    expect(await screen.findByText('Retried job job-1.')).toBeInTheDocument();
  });

  it('loads pipeline detail and node logs when the operator switches to pipeline runs', async () => {
    const user = userEvent.setup();

    expect(await renderRuntimePage()).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Pipeline Runs' }));
    });

    await waitFor(() => {
      expect(getPipeline).toHaveBeenCalledWith('pipe-1');
      expect(listRunNodes).toHaveBeenCalledWith('run-1');
    });

    await waitFor(() => {
      expect(listRunLogs).toHaveBeenCalledWith('run-1', {
        nodeId: 'transform',
        afterId: 0,
        limit: 200,
      });
    });

    expect(await screen.findByTestId('dag-editor')).toBeInTheDocument();
  });

  it('loads deployment detail and queues rollback from the deployments tab', async () => {
    const user = userEvent.setup();

    expect(await renderRuntimePage()).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Deployments' }));
    });

    await waitFor(() => {
      expect(getDeployment).toHaveBeenCalledWith('dep-1');
    });

    await act(async () => {
      await user.click(await screen.findByRole('button', { name: 'Rollback' }));
    });

    await waitFor(() => {
      expect(rollbackDeployment).toHaveBeenCalledWith('dep-1', { run_mode: 'local' });
    });

    expect(await screen.findByText('Queued rollback for deployment dep-1.')).toBeInTheDocument();
  });
});