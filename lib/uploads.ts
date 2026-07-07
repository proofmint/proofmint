import "server-only";
import path from "path";
import { UPLOADS_PATH } from "./const";

export const TEMPLATES_PATH = path.join(UPLOADS_PATH, "templates");
export const IMAGES_PATH = path.join(UPLOADS_PATH, "images");
export const METADATA_PATH = path.join(UPLOADS_PATH, "metadata");
export const CARS_PATH = path.join(UPLOADS_PATH, "cars");
