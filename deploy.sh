#!/bin/bash
set -e

echo "🚀 Déploiement LeadFlow"
echo "========================"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Aller à la racine du projet
cd "$(dirname "$0")"

echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
pnpm install

echo -e "${YELLOW}🔨 Build de l'application web...${NC}"
cd web
pnpm build
cd ..

echo -e "${YELLOW}🗄️ Migration de la base de données...${NC}"
pnpm migrate

echo -e "${YELLOW}🔄 Redémarrage des services PM2...${NC}"
pm2 reload ecosystem.config.cjs --env production

echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
echo "📊 Statut des services :"
pm2 status
