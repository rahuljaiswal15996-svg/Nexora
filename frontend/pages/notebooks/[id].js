import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import NotebookEditorComponent from '../../components/NotebookEditorComponent';

export default function NotebookPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-background text-accent p-4">Loading...</div>;
  }

  const isNew = id === 'new';

  return (
    <div className="min-h-screen bg-background text-accent">
      <NotebookEditorComponent notebookId={isNew ? null : id} isNew={isNew} />
    </div>
  );
}
