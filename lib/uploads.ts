import "server-only";
import path from "path";
import { UPLOADS_PATH } from "./const";

export const TEMPLATES_PATH = path.join(UPLOADS_PATH, "certificates", "templates");
export const CERTIFICATES_PATH = path.join(UPLOADS_PATH, "certificates");
export const BADGES_PATH = path.join(UPLOADS_PATH, "badges");
export const IPFS_BACKUP_PATH = path.join(UPLOADS_PATH, "ipfs-backup");
