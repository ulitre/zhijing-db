FROM node:22.22.0-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/course-data/package.json packages/course-data/package.json
COPY packages/agents/package.json packages/agents/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @zhijing/api... build

ENV NODE_ENV=production

EXPOSE 8787

CMD ["pnpm", "--filter", "@zhijing/api", "start"]
