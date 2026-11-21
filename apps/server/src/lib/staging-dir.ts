/**
 * The folder a server-target download stages its files in, inside the
 * system's own library folder (so the final move is a same-filesystem
 * rename). Shared by the downloader, which creates and removes it, and the
 * scanner, which must never read the partial files it holds.
 */
export const LIBRARY_STAGING_DIR_NAME = '.flemarr-tmp';
