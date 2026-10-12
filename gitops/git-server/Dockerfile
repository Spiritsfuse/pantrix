# Minimal git daemon for the local GitOps rehearsal (see gitops/local-git-server.yaml).
FROM alpine:3.22
RUN apk add --no-cache git git-daemon \
 && addgroup -g 1000 git && adduser -D -u 1000 -G git git
USER 1000:1000
EXPOSE 9418
