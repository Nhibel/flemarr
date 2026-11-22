# Migrating an install from rom-curator

The app was called rom-curator until 2026-11-21. The compose service, container and volume are now named `flemarr`, and Docker cannot rename a volume, so an existing install moves its data once. The app itself renames `rom-curator.db` to `flemarr.db` on its first start.

A fresh install has nothing to migrate: skip this page.

1. Note the old volume's name, nothing else to do yet: `docker volume ls | grep rom-curator` (Portainer names it `<stack>_rom-curator-data`, so `rom-curator_rom-curator-data` for a stack called rom-curator). Steps 4 and 6 use it as `<old-volume>`.
2. Stop the old stack (Portainer → Stacks → the old stack → Stop). This frees its port.
3. Deploy a new stack named `flemarr` from this repository (see the [README](../README.md#deploying-on-a-homelab-server)), then **stop it right away**. This creates the empty `flemarr-data` volume.
4. Copy the data across, replacing what the new stack just created:

   ```sh
   docker run --rm -v <old-volume>:/from -v flemarr-data:/to alpine \
     sh -c 'rm -rf /to/* && cp -a /from/. /to/'
   ```

5. Start the `flemarr` stack. Its log shows `migrated: /data/rom-curator.db -> /data/flemarr.db`; check your systems and settings are there.
6. Delete the old stack, then the old volume: `docker volume rm <old-volume>`.

The pre-rename `ROM_CURATOR_DATA_DIR` environment variable is still read, with a warning; rename it to `FLEMARR_DATA_DIR`.
