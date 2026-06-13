// ============================================================
// ImageValidator — 图片预检系统
// ============================================================

export interface ImageInfo {
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;       // bytes
  format: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: ImageInfo | null;
}

const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"];
const MIN_DIMENSION = 768;
const RECOMMENDED_MIN_DIMENSION = 1024;
const RECOMMENDED_MIN_SIZE = 300 * 1024; // 300KB
const MAX_FILE_SIZE = 20 * 1024 * 1024;  // 20MB

export class ImageValidator {
  /**
   * 分析并验证图片
   */
  static async validate(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const result: ValidationResult = { valid: true, errors, warnings, info: null };

    // 1. 格式检测
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type.toLowerCase();
    const format = ImageValidator.detectFormat(file.name, file.type);
    if (!format || !ALLOWED_FORMATS.includes(format)) {
      errors.push(`不支持的图片格式：${ext || mimeType}。支持：jpg, jpeg, png, webp`);
      result.valid = false;
    }

    // 2. 文件大小检测
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，最大 20MB`);
      result.valid = false;
    }
    if (file.size < RECOMMENDED_MIN_SIZE && file.size > 0) {
      warnings.push(`图片质量较低 (${(file.size / 1024).toFixed(0)}KB)，可能影响视频生成质量`);
    }

    // 3. 图片尺寸检测（需要加载图片）
    try {
      const info = await ImageValidator.getImageInfo(file);
      result.info = info;

      if (info.width < MIN_DIMENSION || info.height < MIN_DIMENSION) {
        errors.push(`图片尺寸过小 (${info.width}×${info.height})，最小要求 ${MIN_DIMENSION}×${MIN_DIMENSION}`);
        result.valid = false;
      } else if (info.width < RECOMMENDED_MIN_DIMENSION || info.height < RECOMMENDED_MIN_DIMENSION) {
        warnings.push(`图片尺寸偏小 (${info.width}×${info.height})，推荐 ${RECOMMENDED_MIN_DIMENSION}×${RECOMMENDED_MIN_DIMENSION} 以上`);
      }
    } catch {
      errors.push("无法读取图片信息，文件可能已损坏");
      result.valid = false;
    }

    return result;
  }

  /**
   * 检测图片格式
   */
  static detectFormat(filename: string, mimeType: string): string | null {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
    const mimeMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    };
    return mimeMap[mimeType] || null;
  }

  /**
   * 获取图片尺寸信息（浏览器端）
   */
  static getImageInfo(file: File): Promise<ImageInfo> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const info: ImageInfo = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: parseFloat((img.naturalWidth / img.naturalHeight).toFixed(4)),
          fileSize: file.size,
          format: ImageValidator.detectFormat(file.name, file.type) || "unknown",
        };
        URL.revokeObjectURL(img.src);
        resolve(info);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("图片加载失败"));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 格式化尺寸信息用于显示
   */
  static formatInfo(info: ImageInfo): string {
    const ratio = info.aspectRatio > 1
      ? `${info.width}:${Math.round(info.height / (info.width / info.width / info.aspectRatio))}`
      : `${Math.round(info.width / (info.height / info.width))}:1`;
    const sizeMB = (info.fileSize / 1024 / 1024).toFixed(1);
    return `${info.width}×${info.height} | ${info.format.toUpperCase()} | ${sizeMB}MB | 比例约 ${ratio.replace("NaN", "?")}`;
  }
}
