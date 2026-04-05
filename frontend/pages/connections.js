import CloudConnectionsManager from '../components/CloudConnectionsManager';

export default function ConnectionsPage() {
  return (
    <div className="bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Cloud Connections</h1>
          <p className="text-accent">Connect to cloud storage and data warehouses for seamless data integration.</p>
        </div>

        <CloudConnectionsManager />
      </div>
    </div>
  );
}