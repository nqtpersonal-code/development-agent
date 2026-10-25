import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

const DIRS = ['projects', 'work', 'patterns', 'review-rules', 'runtime'];

const DEFAULT_CONFIG = `---
# Ngôn ngữ trao đổi với bạn: vi (tiếng Việt) hoặc en (tiếng Anh).
language: vi
# Thư mục quy tắc review CÁ NHÂN (đọc mọi file .md bên trong). Để trống = mặc định <thư mục dữ liệu>/review-rules
reviewRules:
  personal:
# Thư mục mã nguồn plugin (để /nqt:retro đề xuất sửa agent/workflow vào đúng chỗ).
pluginSourceDir: C:\\Users\\nqtpe\\nqt-plugin
# Biệt danh cho agent và bước (chỉ dùng khi nói chuyện với bạn). Bỏ trống = tên mặc định.
nicknames:
  agents:
    # ba: Mai
    # qa: Tùng
  steps:
    # analysis: Soi ticket
---

# Cấu hình nqt

Sửa các giá trị ở phần đầu file (giữa hai dòng ---). Quy tắc review của team đặt trong
projects/<tên-dự-án>/review-rules/.
`;

export function getDataDir() {
  return process.env.NQT_DATA_DIR || join(homedir(), '.claude', 'nqt');
}

export function ensureDataDir(dataDir, pluginRoot) {
  const created = [];
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  for (const d of DIRS) {
    const p = join(dataDir, d);
    if (!existsSync(p)) {
      mkdirSync(p, { recursive: true });
      created.push(d);
    }
  }
  const cfg = join(dataDir, 'config.md');
  if (!existsSync(cfg)) {
    writeFileSync(cfg, DEFAULT_CONFIG, 'utf8');
    created.push('config.md');
  }
  const starters = join(pluginRoot, 'starter-patterns');
  if (existsSync(starters)) {
    for (const pack of readdirSync(starters)) {
      const dest = join(dataDir, 'patterns', pack);
      if (!existsSync(dest)) {
        cpSync(join(starters, pack), dest, { recursive: true });
        created.push(`patterns/${pack}`);
      }
    }
  }
  return { created };
}

function readFm(path) {
  return existsSync(path) ? parseFrontmatter(readFileSync(path, 'utf8')) : {};
}

const asMap = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const asLang = (v) => (v === 'en' ? 'en' : 'vi');

export function loadConfig(dataDir) {
  const fm = readFm(join(dataDir, 'config.md'));
  const personal = typeof asMap(fm.reviewRules).personal === 'string' && asMap(fm.reviewRules).personal
    ? asMap(fm.reviewRules).personal
    : join(dataDir, 'review-rules');
  return {
    language: asLang(fm.language),
    reviewRules: { personal },
    pluginSourceDir: typeof fm.pluginSourceDir === 'string' ? fm.pluginSourceDir : '',
    nicknames: {
      agents: asMap(asMap(fm.nicknames).agents),
      steps: asMap(asMap(fm.nicknames).steps),
    },
  };
}

export function projectConfig(dataDir, project) {
  const base = loadConfig(dataDir);
  const fm = readFm(join(dataDir, 'projects', project, 'project.md'));
  return {
    ...base,
    project: fm,
    language: fm.language ? asLang(fm.language) : base.language,
    teamReviewRules: join(dataDir, 'projects', project, 'review-rules'),
  };
}
