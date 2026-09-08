# Docker builds

[Blacksmith Docker build docs](https://docs.blacksmith.sh/blacksmith-caching/docker-builds), checked 2026-09-07.

Add caching after the runner swap proves green, as the parent skill requires.

## Configure the builder

| Existing step | Replacement |
|---|---|
| `docker/setup-buildx-action` | `useblacksmith/setup-docker-builder@v2`, with required `cache-key` |
| `docker/build-push-action` | `useblacksmith/build-push-action@v2` |

For Docker CLI or Bake, run the setup action before building. The build-push action alone provides no Blacksmith layer cache.

- Default `cache-key` to the Dockerfile path. Reuse it across workflows for the same workload; separate unrelated images. Related images behind one builder share a key.
- Remove `cache-from`/`cache-to` exports when their only purpose is this build's cache. Builder disks persist layers and `RUN --mount=type=cache` contents.
- Preserve existing publishing conditions. For registry publishing, prefer `push: true`; keep local loading when later steps need the image.

## Verify persistence

Compare a cold run with a subsequent run using the same key: inspect cached steps and timings. Cache commits require a successful, uncanceled job; concurrent writers use last-write-wins.

Docker cache disks incur sticky-disk charges. Apply the parent skill's dashboard checks.

## Multiple architectures

Use native architecture runners in a matrix, then merge the images into a manifest. The docs mark automatic native multi-platform building as forthcoming; recheck before adopting it.
