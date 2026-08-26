# Cross-PC Asset Vault

## Recommended split

Use three layers:

```text
GitHub repo       code, scripts, docs, public/project-safe assets
Epic/Fab          account entitlement and the official install path
Baidu private vault  backup and transport for licensed marketplace assets
```

GitHub remains the source of truth for the project. Do not put Epic/Fab
Marketplace content in this public repository.

## What Baidu Netdisk can solve

Baidu Netdisk is suitable for keeping a private backup of large binary assets
and moving them between the user's own PCs. Its sync feature is designed to
mirror changes between a local sync folder and the cloud, and supports
selective sync. See the [official help page](https://yun.baidu.com/disk/help).

Use a private, versioned asset archive rather than syncing the live Unreal
project folder. A suggested layout is:

```text
NeonCleaner-PrivateAssets/
  marketplace/
    ParagonPhase/
      ParagonPhase-UE5.8-<date>.zip
      SHA256SUMS.txt
  source-cache/
  generated-video/
```

The archive should be created from a closed UE project and should contain only
the restored marketplace content, for example:

```text
ue/NeonCleanerUE/Content/ParagonPhase/
```

Do not sync these volatile folders through Baidu:

```text
ue/**/Binaries/
ue/**/Intermediate/
ue/**/Saved/
ue/**/DerivedDataCache/
```

## Restore procedure on another PC

1. Install the same UE version and sign in to the same Epic account.
2. Prefer Fab/Epic Games Launcher to install `Paragon: Phase` into the target
   project.
3. If using the private vault, download one complete archive to a local disk,
   verify its SHA-256 checksum, and extract it into the target project's
   `Content/ParagonPhase/` directory while UE is closed.
4. Run the project's validation script before opening the playable map.
5. Never commit the restored directory; it is intentionally ignored by Git.

## Safety rules

- Treat the Baidu folder as a private backup, not a public download mirror.
- Only one PC should write to an archive at a time; do not edit `.uasset` or
  `.umap` files concurrently on multiple PCs.
- Keep archives immutable and create a new dated archive after an asset update.
- Keep GitHub for versioned code and docs; do not use Baidu as a Git remote or
  as a Git LFS endpoint.
- Do not sync passwords, Epic tokens, Codex data, `.git`, or `.codex` folders.

Fab's Standard License allows sharing an asset privately with collaborators
working on the project, but prohibits standalone redistribution. Keep the
vault private and check the specific asset's license before sharing it.
See the [Fab Standard License](https://www.fab.com/eula) and the
[Paragon: Phase listing](https://www.fab.com/listings/b2c95d5c-a805-460b-a01b-db6da3a778f0).
