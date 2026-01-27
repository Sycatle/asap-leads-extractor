#!/bin/bash
#
# backup.sh - Script de backup automatique de la base de données SQLite
#
# Usage:
#   ./backup.sh              # Backup standard
#   ./backup.sh --rotate 7   # Backup avec rotation (garder les 7 derniers)
#
# Ce script crée une copie de la base de données dans data/backups/
# avec un horodatage. Le mode WAL de SQLite est géré correctement.
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
DB_PATH="${DATA_DIR}/leads.db"
BACKUP_DIR="${DATA_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="leads_${DATE}.db"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Parse arguments
ROTATE=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --rotate)
      ROTATE="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--rotate N]"
      exit 1
      ;;
  esac
done

# Vérifier que la base existe
if [ ! -f "$DB_PATH" ]; then
  echo "❌ Base de données non trouvée: $DB_PATH"
  exit 1
fi

# Créer le dossier de backup si nécessaire
mkdir -p "$BACKUP_DIR"

echo "📦 Backup de la base de données..."
echo "   Source: $DB_PATH"
echo "   Destination: $BACKUP_PATH"

# Méthode 1: Utiliser sqlite3 .backup (recommandé pour WAL mode)
if command -v sqlite3 &> /dev/null; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'"
  echo "✅ Backup créé avec sqlite3 .backup"
else
  # Méthode 2: Copie simple (moins sûr avec WAL)
  # Attendre que le WAL soit vide
  cp "$DB_PATH" "$BACKUP_PATH"
  if [ -f "${DB_PATH}-wal" ]; then
    cp "${DB_PATH}-wal" "${BACKUP_PATH}-wal" 2>/dev/null || true
  fi
  if [ -f "${DB_PATH}-shm" ]; then
    cp "${DB_PATH}-shm" "${BACKUP_PATH}-shm" 2>/dev/null || true
  fi
  echo "✅ Backup créé avec copie fichier (sqlite3 non disponible)"
fi

# Afficher la taille du backup
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "   Taille: $BACKUP_SIZE"

# Rotation des backups (supprimer les anciens)
if [ "$ROTATE" -gt 0 ]; then
  echo "🔄 Rotation: garder les $ROTATE derniers backups..."
  
  # Compter les backups existants
  BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/leads_*.db 2>/dev/null | wc -l)
  
  if [ "$BACKUP_COUNT" -gt "$ROTATE" ]; then
    # Supprimer les plus anciens
    TO_DELETE=$((BACKUP_COUNT - ROTATE))
    ls -1t "$BACKUP_DIR"/leads_*.db | tail -n "$TO_DELETE" | while read -r old_backup; do
      echo "   🗑️  Suppression: $(basename "$old_backup")"
      rm -f "$old_backup"
      rm -f "${old_backup}-wal" 2>/dev/null || true
      rm -f "${old_backup}-shm" 2>/dev/null || true
    done
  fi
fi

# Lister les backups existants
echo ""
echo "📋 Backups disponibles:"
ls -lh "$BACKUP_DIR"/leads_*.db 2>/dev/null | awk '{print "   " $NF " (" $5 ")"}' | tail -10

echo ""
echo "✨ Backup terminé!"
