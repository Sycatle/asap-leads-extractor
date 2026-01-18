'use client';

import { useState } from 'react';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';

interface LeadNotesCardProps {
  notes: string | null;
  onAddNote: (note: string) => Promise<void>;
  loading?: boolean;
}

export function LeadNotesCard({ notes, onAddNote, loading }: LeadNotesCardProps) {
  const [newNote, setNewNote] = useState('');

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    await onAddNote(newNote);
    setNewNote('');
  };

  return (
    <Card>
      <CardHeader title="Notes" />

      <div className="flex gap-2 mb-4">
        <Input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Ajouter une note..."
        />
        <Button
          onClick={handleAdd}
          disabled={!newNote.trim() || loading}
          loading={loading}
        >
          Ajouter
        </Button>
      </div>

      {notes ? (
        <pre className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          {notes}
        </pre>
      ) : (
        <p className="text-sm text-zinc-400 italic">Aucune note</p>
      )}
    </Card>
  );
}
