'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './form-extensions';

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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Sélectionnez une date et une heure pour la relance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Heure</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!date || loading}
          >
            {loading ? 'Planification...' : 'Planifier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const buttonVariant = variant === 'danger' ? 'destructive' : 'default';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={buttonVariant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Chargement...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
