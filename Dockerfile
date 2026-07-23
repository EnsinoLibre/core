# EnsinoLibre core — self-host image.
#
# Builds the teacher platform (Vite) and serves it together with the zero-build
# public site (generator + student aula + docs) from nginx. The backend is your
# own Supabase project — pass its URL and publishable (anon) key at build time:
#
#   docker build -t ensinolibre \
#     --build-arg SUPABASE_URL=https://YOURPROJECT.supabase.co \
#     --build-arg SUPABASE_KEY=sb_publishable_... .
#   docker run -p 8080:80 ensinolibre     # → http://localhost:8080
#
# Or use docker-compose.yml. Unset args fall back to the public demo project.
# See SELF-HOSTING.md for the backend setup (supabase db push).

# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

ARG SUPABASE_URL=https://edgdxuvzyhwqidjjbidq.supabase.co
ARG SUPABASE_KEY=sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063
# Vite (platform) reads these at build time; gen-config bakes the zero-build site.
ENV VITE_SUPABASE_URL=$SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY

COPY . .
RUN npm --prefix platform ci \
 && npm --prefix platform run build \
 && node scripts/sync-app.mjs \
 && SUPABASE_URL="$SUPABASE_URL" SUPABASE_KEY="$SUPABASE_KEY" node scripts/gen-config.mjs

# ---- serve stage -----------------------------------------------------------
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Publish the repo root layout (matches netlify.toml publish="."): /site, /docs,
# /schema live at the web root so site/docs.html can fetch ../docs/*.md.
COPY --from=build /app/site   /usr/share/nginx/html/site
COPY --from=build /app/docs   /usr/share/nginx/html/docs
COPY --from=build /app/schema /usr/share/nginx/html/schema
EXPOSE 80
