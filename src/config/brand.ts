/**
 * 品牌信息单一数据源 (Single source of truth for brand info)
 *
 * 改名 / 换品牌时只需修改此文件。UI (AboutSettings)、SEO (seo.ts) 等都从这里读取，
 * 避免品牌字符串散落在多处导致遗漏。
 *
 * Rename/rebrand by editing this file only. UI (AboutSettings) and SEO (seo.ts)
 * both read from here, so brand strings never drift out of sync across the app.
 */

/** 产品显示名 (Display name shown in UI, SEO title, structured data). */
export const BRAND_NAME = "Baotuo Chat" as const;

/**
 * 结构化数据里的别名 (Alternate names for schema.org structured data).
 * 用于 SEO 的 alternateName 字段。
 */
export const BRAND_ALTERNATE_NAMES = ["Baotuo", "Baotuo Chat AI"] as const;

/** 当前版本号。与 package.json 的 version 保持一致。 */
export const BRAND_VERSION = "2.1.0" as const;

/** 版权起始年份，用于生成版权声明。 */
export const BRAND_COPYRIGHT_YEAR = "2026" as const;

/**
 * 上游原始项目署名。二开项目按 MIT 协议需保留原作者版权声明。
 * Upstream original project attribution. MIT requires keeping the original
 * copyright notice in forks.
 */
export const UPSTREAM_PROJECT_NAME = "Neo Chat" as const;

/** GitHub 仓库标识 (owner/repo)。 */
export const BRAND_REPO_SLUG = "baotuo88/BaotuoAi-Chat" as const;

/** 官网 / 仓库主页 URL。当前无独立官网，指向仓库。 */
export const BRAND_SITE_URL =
  `https://github.com/${BRAND_REPO_SLUG}` as const;

/** GitHub 仓库 URL。 */
export const BRAND_REPO_URL = `https://github.com/${BRAND_REPO_SLUG}` as const;

/** LICENSE 文件 URL。 */
export const BRAND_LICENSE_URL =
  `https://github.com/${BRAND_REPO_SLUG}/blob/main/LICENSE` as const;

/** 使用的开源协议名。 */
export const BRAND_LICENSE_NAME = "MIT License" as const;

/**
 * 版权声明文本。保留上游原作者署名以符合 MIT 协议，并追加本项目署名。
 * Copyright line. Keeps upstream attribution for MIT compliance and appends
 * this fork's contributors.
 */
export const BRAND_COPYRIGHT_TEXT =
  `Copyright (c) ${BRAND_COPYRIGHT_YEAR} ${UPSTREAM_PROJECT_NAME} contributors; ${BRAND_NAME} contributors` as const;
