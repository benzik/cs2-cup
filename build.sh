#!/bin/sh
# Run this ONCE on the server to build the Docker image.
# After this, upload portainer-stack.yml to Portainer → Stacks → Add Stack → Upload.
set -e

cd "$(dirname "$0")"
echo "Building cs2-cup-dashboard:latest ..."
docker build -t cs2-cup-dashboard:latest .
echo ""
echo "Done! Now upload portainer-stack.yml to Portainer."
echo "Set these env vars in Portainer's stack environment:"
echo "  EDIT_PASSWORD=<your_password>"
echo "  HOST_PORT=5747  (or any free port on your server)"
