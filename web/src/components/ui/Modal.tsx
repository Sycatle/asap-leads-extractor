'use client';

import { useState } from 'react';
import { Button } from './Button';
import { Input, Label } from './Form';

interface FollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (datetime: string) => void;
  loading?: boolean;
  title?: string;
}

export function FollowupModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  title = 'Planifier une relance',
}: FollowupModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!date) return;
    const datetime = `${date} ${time}:00`;
    onConfirm(datetime);
  };

  const handleClose = () => {
    setDate('');
    setTime('10:00');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          {title}
        </h3>

        <div className="space-y-4">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <Label>Heure</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!date}
            loading={loading}
          >
            Planifier
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== CONFIRM MODAL =====

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'warning' | 'default';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  loading,
  variant = 'default',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>
        <p className="text-zinc-500 mb-6">{message}</p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={buttonVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
