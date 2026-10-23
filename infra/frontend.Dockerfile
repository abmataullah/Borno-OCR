FROM node:20-alpine AS builder

# Replicate the workspace structure so postinstall scripts resolve correctly
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY frontend/ ./frontend/

# Install at workspace root (hoists node_modules to /workspace/node_modules)
RUN npm install --no-audit --no-fund --workspaces --include-workspace-root --ignore-scripts

# Run the vendor assets copy script (expects /workspace/node_modules)
RUN cd /workspace/frontend && node scripts/copy-vendor-assets.cjs || true

# Build the frontend
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
