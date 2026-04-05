import { useState, useEffect } from 'react';
import { getPipelineMetrics, optimizePipeline } from '../services/api';

export default function PipelineOptimizer({ pipelineId }) {
  const [metrics, setMetrics] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pipelineId) {
      loadMetrics();
    }
  }, [pipelineId]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await getPipelineMetrics(pipelineId);
      setMetrics(data);
    } catch (err) {
      setError('Failed to load metrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runOptimization = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await optimizePipeline(pipelineId);
      setOptimization(result);
    } catch (err) {
      setError('Failed to optimize pipeline');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pipeline-optimizer bg-white shadow-md rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-primary">Pipeline Optimization</h2>
        <button
          onClick={runOptimization}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent"></div>
          )}
          <span>Optimize Pipeline</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Current Metrics */}
      {metrics && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-primary mb-4">Current Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface p-4 rounded-lg">
              <div className="text-2xl font-bold text-primary">{metrics.avgExecutionTime || 'N/A'}</div>
              <div className="text-sm text-accent">Avg Execution Time</div>
            </div>
            <div className="bg-surface p-4 rounded-lg">
              <div className="text-2xl font-bold text-primary">{metrics.successRate || 'N/A'}%</div>
              <div className="text-sm text-accent">Success Rate</div>
            </div>
            <div className="bg-surface p-4 rounded-lg">
              <div className="text-2xl font-bold text-primary">${metrics.estimatedCost || 'N/A'}</div>
              <div className="text-sm text-accent">Monthly Cost</div>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Recommendations */}
      {optimization && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-primary mb-4">Optimization Recommendations</h3>
          <div className="space-y-4">
            {optimization.recommendations?.map((rec, index) => (
              <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">{rec.title}</h4>
                    <p className="text-sm text-blue-700 mt-1">{rec.description}</p>
                    {rec.potentialSavings && (
                      <p className="text-sm text-blue-600 mt-2">
                        Potential savings: {rec.potentialSavings}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Actions */}
      {optimization?.actions && (
        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Suggested Actions</h3>
          <div className="space-y-3">
            {optimization.actions.map((action, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                <div>
                  <h4 className="font-medium text-primary">{action.name}</h4>
                  <p className="text-sm text-accent">{action.description}</p>
                </div>
                <button className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-blue-700">
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!metrics && !loading && (
        <div className="text-center py-8">
          <p className="text-accent">No metrics available. Run the pipeline to collect performance data.</p>
        </div>
      )}
    </div>
  );
}