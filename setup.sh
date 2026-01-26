#!/bin/bash
set -e

echo "🔧 Configuration initiale LeadFlow"
echo "===================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifications
echo -e "${YELLOW}Vérification des prérequis...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de pnpm...${NC}"
    npm install -g pnpm
fi

if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de PM2...${NC}"
    npm install -g pm2
fi

echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
echo -e "${GREEN}✅ pnpm $(pnpm -v)${NC}"
echo -e "${GREEN}✅ PM2 $(pm2 -v)${NC}"

# Aller à la racine du projet
cd "$(dirname "$0")"

# Vérifier .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env manquant !${NC}"
    echo "Copie .env.example vers .env et configure les variables"
    exit 1
fi

# Vérifier ALLOWED_USERS
if ! grep -q "ALLOWED_USERS=." .env; then
    echo -e "${RED}❌ ALLOWED_USERS non configuré dans .env !${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
pnpm install

echo -e "${YELLOW}🔨 Build de l'application web...${NC}"
cd web
pnpm install
pnpm build
cd ..

echo -e "${YELLOW}🗄️ Migration de la base de données...${NC}"
pnpm migrate

echo -e "${YELLOW}🚀 Démarrage des services PM2...${NC}"
pm2 start ecosystem.config.cjs --env production

echo -e "${YELLOW}💾 Sauvegarde config PM2 (auto-restart au reboot)...${NC}"
pm2 save
pm2 startup | tail -1 | bash || true

echo ""
echo -e "${GREEN}✅ Installation terminée !${NC}"
echo ""
echo "📊 Statut des services :"
pm2 status
echo ""
echo -e "${YELLOW}Prochaines étapes :${NC}"
echo "1. Configure ton reverse proxy (Nginx/Caddy) vers localhost:3000"
echo "2. Ajoute ton certificat SSL (Let's Encrypt)"
echo "3. Pointe leads.visibee.fr vers ton VPS"
