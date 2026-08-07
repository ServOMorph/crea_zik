#!/bin/bash

# =============================================================================
# Script pour exécuter les tests e2e en local avec les serveurs existants
# Usage:
#   ./scripts/test-local.sh              # Exécute tous les tests e2e
#   ./scripts/test-local.sh transport    # Exécute uniquement le test du transport
# =============================================================================

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que les serveurs sont démarrés
check_server() {
  local url=$1
  local name=$2
  if curl -s --head --request GET "$url" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name est démarré ($url)"
    return 0
  else
    echo -e "${RED}✗${NC} $name N'EST PAS démarré ($url)"
    return 1
  fi
}

# Vérifier les dépendances
echo -e "${YELLOW}=== Vérification des serveurs ===${NC}"
BACKEND_OK=$(check_server "http://127.0.0.1:8001/api/health" "Backend")
FRONTEND_OK=$(check_server "http://127.0.0.1:5180" "Frontend")

if [ "$BACKEND_OK" -ne 0 ] || [ "$FRONTEND_OK" -ne 0 ]; then
  echo -e "${RED}Erreur : Les serveurs doivent être démarrés manuellement.${NC}"
  echo "Démarrez-les avec :"
  echo "  Backend: cd backend && uv run uvicorn crea_zik.api:app --host 127.0.0.1 --port 8001"
  echo "  Frontend: cd frontend && npm run dev -- --host 127.0.0.1 --port 5180"
  exit 1
fi

# Déterminer le filtre de test
TEST_FILTER="$1"
if [ -z "$TEST_FILTER" ]; then
  TEST_FILTER="--grep-invert @visual"  # Tous les tests e2e (sauf @visual)
else
  case "$TEST_FILTER" in
    "transport")
      TEST_FILTER="--grep 'the editor transport plays'" ;;
    "piano")
      TEST_FILTER="--grep 'the piano roll'" ;;
    *)
      TEST_FILTER="--grep '$TEST_FILTER'" ;;
  esac
fi

echo -e "${YELLOW}\n=== Exécution des tests ===${NC}"
echo "Filtre: $TEST_FILTER"
echo "Timeout: 90s (global), 60s (préécoute), 10s (playhead)"

# Exécuter Playwright avec la config locale
npx playwright test \
  --config playwright.test.config.ts \
  $TEST_FILTER \
  --timeout=90000 \
  --retries=1

# Afficher le résultat
if [ $? -eq 0 ]; then
  echo -e "${GREEN}\n✓ Tests passés !${NC}"
else
  echo -e "${RED}\n✗ Tests échoués${NC}"
  echo "Pour déboguer :"
  echo "  - Ajoutez --headed pour voir le navigateur"
  echo "  - Ajoutez --debug pour plus de logs"
  echo "  - Consultez test-results/ pour les traces"
fi
