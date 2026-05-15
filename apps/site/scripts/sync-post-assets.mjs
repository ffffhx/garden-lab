#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const cwd = process.cwd();
const sourceImagesRoot = path.join(cwd, "source", "images");
const postsRoot = path.join(cwd, "source", "_posts");
const publicRoot = path.join(cwd, "public");
const publicImagesRoot = path.join(publicRoot, "images");
const publicPostAssetsRoot = path.join(publicRoot, "post-assets");
const optimizableImageExtensions = new Set([".jpg", ".jpeg", ".png"]);
const optimizedImageMaxWidth = 1280;
const optimizedImageQuality = 82;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

async function createOptimizedImage(sourcePath, targetPath) {
  const extension = path.extname(sourcePath).toLowerCase();

  if (!optimizableImageExtensions.has(extension)) {
    return;
  }

  const optimizedPath = targetPath.replace(/\.[^.]+$/, ".webp");

  await sharp(sourcePath)
    .rotate()
    .resize({ width: optimizedImageMaxWidth, withoutEnlargement: true })
    .webp({ quality: optimizedImageQuality, effort: 4 })
    .toFile(optimizedPath);
}

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, visitor);
      continue;
    }

    visitor(fullPath);
  }
}

fs.rmSync(publicImagesRoot, { recursive: true, force: true });
fs.rmSync(publicPostAssetsRoot, { recursive: true, force: true });
ensureDir(publicImagesRoot);
ensureDir(publicPostAssetsRoot);

const optimizations = [];

walk(sourceImagesRoot, (filePath) => {
  const relative = path.relative(sourceImagesRoot, filePath);
  const targetPath = path.join(publicImagesRoot, relative);
  copyFile(filePath, targetPath);
  optimizations.push(createOptimizedImage(filePath, targetPath));
});

walk(postsRoot, (filePath) => {
  if (filePath.endsWith(".md")) {
    return;
  }

  const relative = path.relative(postsRoot, filePath);
  const targetPath = path.join(publicPostAssetsRoot, relative);
  copyFile(filePath, targetPath);
  optimizations.push(createOptimizedImage(filePath, targetPath));
});

await Promise.all(optimizations);
