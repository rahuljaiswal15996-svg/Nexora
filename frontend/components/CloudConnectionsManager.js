import { useState, useEffect } from 'react';
import DatasetPreview from './DatasetPreview';
import {
  listConnections,
  createConnection,
  testConnection,
  deleteConnection,
  listConnectionDatasets,
  previewConnectionDataset,
} from '../services/api';

export default function CloudConnectionsManager() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'aws_s3',
    config: {
      region: '',
      access_key_id: '',
      secret_access_key: '',
      bucket_name: ''
    }
  });
  const [testingConnection, setTestingConnection] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetName, setSelectedDatasetName] = useState('');
  const [datasetPreview, setDatasetPreview] = useState(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await listConnections();
      setConnections(data);
    } catch (err) {
      setError('Failed to load connections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async (e) => {
    e.preventDefault();
    try {
      await createConnection(newConnection);
      setNewConnection({
        name: '',
        type: 'aws_s3',
        config: {
          region: '',
          access_key_id: '',
          secret_access_key: '',
          bucket_name: ''
        }
      });
      setShowCreateForm(false);
      loadConnections();
    } catch (err) {
      setError('Failed to create connection');
      console.error(err);
    }
  };

  const handleTestConnection = async (connectionId) => {
    setTestingConnection(connectionId);
    try {
      const result = await testConnection(connectionId);
      // Update connection status in the list
      setConnections(prev => prev.map(conn =>
        conn.id === connectionId
          ? { ...conn, last_test_result: result, last_tested: new Date().toISOString() }
          : conn
      ));
    } catch (err) {
      console.error('Failed to test connection:', err);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      await deleteConnection(connectionId);
      if (selectedConnection?.id === connectionId) {
        setSelectedConnection(null);
        setDatasets([]);
        setSelectedDatasetName('');
        setDatasetPreview(null);
      }
      loadConnections();
    } catch (err) {
      setError('Failed to delete connection');
      console.error(err);
    }
  };

  const handleSelectDataset = async (datasetName, connectionId = selectedConnection?.id) => {
    if (!connectionId) return;

    try {
      setLoadingPreview(true);
      setSelectedDatasetName(datasetName);
      const preview = await previewConnectionDataset(connectionId, datasetName, 20);
      setDatasetPreview(preview);
    } catch (err) {
      setError('Failed to preview dataset');
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleBrowseData = async (connection) => {
    try {
      setError('');
      setSelectedConnection(connection);
      setLoadingDatasets(true);
      setDatasets([]);
      setDatasetPreview(null);
      setSelectedDatasetName('');

      const response = await listConnectionDatasets(connection.id);
      const nextDatasets = response.datasets || [];
      setDatasets(nextDatasets);

      if (nextDatasets.length > 0) {
        await handleSelectDataset(nextDatasets[0].name, connection.id);
      }
    } catch (err) {
      setError('Failed to load datasets for this connection');
      console.error(err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const connectionTypes = [
    { value: 'aws_s3', label: 'AWS S3', icon: '☁️' },
    { value: 'gcp_gcs', label: 'Google Cloud Storage', icon: '☁️' },
    { value: 'azure_blob', label: 'Azure Blob Storage', icon: '☁️' },
    { value: 'snowflake', label: 'Snowflake', icon: '❄️' },
    { value: 'bigquery', label: 'BigQuery', icon: '📊' },
    { value: 'redshift', label: 'Redshift', icon: '🗄️' }
  ];

  return (
    <div className="cloud-connections bg-white shadow-md rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-primary">Cloud Connections</h2>
          <p className="text-accent">Manage connections to cloud storage and data warehouses</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Connection</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Create Connection Form */}
      {showCreateForm && (
        <div className="bg-surface border border-surface-hover rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Create New Connection</h3>
          <form onSubmit={handleCreateConnection}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-accent mb-2">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={newConnection.name}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-accent mb-2">
                  Connection Type
                </label>
                <select
                  value={newConnection.type}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {connectionTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* AWS S3 Configuration */}
            {newConnection.type === 'aws_s3' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-accent mb-2">Region</label>
                  <input
                    type="text"
                    value={newConnection.config.region}
                    onChange={(e) => setNewConnection(prev => ({
                      ...prev,
                      config: { ...prev.config, region: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="us-east-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent mb-2">Bucket Name</label>
                  <input
                    type="text"
                    value={newConnection.config.bucket_name}
                    onChange={(e) => setNewConnection(prev => ({
                      ...prev,
                      config: { ...prev.config, bucket_name: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent mb-2">Access Key ID</label>
                  <input
                    type="password"
                    value={newConnection.config.access_key_id}
                    onChange={(e) => setNewConnection(prev => ({
                      ...prev,
                      config: { ...prev.config, access_key_id: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent mb-2">Secret Access Key</label>
                  <input
                    type="password"
                    value={newConnection.config.secret_access_key}
                    onChange={(e) => setNewConnection(prev => ({
                      ...prev,
                      config: { ...prev.config, secret_access_key: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
              >
                Create Connection
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connections List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 text-accent">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-primary mb-2">No connections yet</h3>
          <p className="text-accent mb-4">Create your first cloud connection to start integrating with external data sources.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
          >
            Add Connection
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="bg-surface border border-surface-hover rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-lg">
                      {connectionTypes.find(t => t.value === connection.type)?.icon || '🔗'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-primary">{connection.name}</h3>
                    <p className="text-sm text-accent capitalize">{connection.type.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {connection.last_tested && (
                    <div className="flex items-center space-x-1 text-sm">
                      {connection.last_test_result?.success ? (
                        <span className="text-green-600">✓ Connected</span>
                      ) : (
                        <span className="text-red-600">✗ Failed</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => handleTestConnection(connection.id)}
                    disabled={testingConnection === connection.id}
                    className="px-3 py-1 bg-secondary text-accent rounded text-sm hover:bg-gray-200 disabled:opacity-50"
                  >
                    {testingConnection === connection.id ? 'Testing...' : 'Test'}
                  </button>

                  <button
                    onClick={() => handleBrowseData(connection)}
                    className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-blue-700"
                  >
                    Browse Data
                  </button>

                  <button
                    onClick={() => handleDeleteConnection(connection.id)}
                    className="p-1 text-accent hover:text-red-600 rounded"
                    title="Delete connection"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Features Overview */}
      <div className="mt-8 bg-surface border border-surface-hover rounded-lg p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Supported Cloud Providers</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {connectionTypes.map(type => (
            <div key={type.value} className="flex items-center space-x-2 p-3 bg-background rounded-lg">
              <span className="text-xl">{type.icon}</span>
              <span className="text-sm font-medium text-primary">{type.label}</span>
            </div>
          ))}
        </div>
      </div>

      <DatasetPreview
        connection={selectedConnection}
        datasets={datasets}
        selectedDatasetName={selectedDatasetName}
        preview={datasetPreview}
        loadingDatasets={loadingDatasets}
        loadingPreview={loadingPreview}
        onSelectDataset={handleSelectDataset}
      />
    </div>
  );
}