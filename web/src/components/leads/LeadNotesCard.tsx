'use client';

import { useState } from 'react';
import { Loader2, FileText, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Notes
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input form */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Ajouter une note..."
            className="flex-1 h-10"
          />
          <Button
            onClick={handleAdd}
            disabled={!newNote.trim() || loading}
            size="sm"
            className="shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="ml-2">Ajouter</span>
          </Button>
        </div>

        {/* Notes display */}
        {notes ? (
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {notes}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune note</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
