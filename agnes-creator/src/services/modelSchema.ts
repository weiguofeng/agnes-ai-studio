// ============================================================
// Model Schema — 模型参数定义系统
// ============================================================
// 根据 Agnes 官方 API 文档，根据不同模型类型动态生成参数面板
// ============================================================

export interface ParamDefinition {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "slider" | "boolean";
  default: unknown;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  required?: boolean;
}

export interface ModelCategory {
  id: string;
  name: string;
  description: string;
  models: ModelDefinition[];
}

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  category: "image" | "video";
  params: ParamDefinition[];
}

// ============================================================
// 图片模型参数
// ============================================================

const IMAGE_COMMON_PARAMS: ParamDefinition[] = [
  {
    key: "size",
    label: "图片尺寸",
    type: "select",
    default: "1024x1024",
    options: [
      { label: "1024x1024 (方形)", value: "1024x1024" },
      { label: "768x1344 (竖屏)", value: "768x1344" },
      { label: "1344x768 (横屏)", value: "1344x768" },
      { label: "1024x1792 (竖屏长图)", value: "1024x1792" },
      { label: "1792x1024 (横屏长图)", value: "1792x1024" },
    ],
    description: "生成图片的宽高尺寸",
  },
  {
    key: "n",
    label: "生成数量",
    type: "slider",
    default: 1,
    min: 1,
    max: 4,
    step: 1,
    description: "一次生成几张图片",
  },
  {
    key: "seed",
    label: "随机种子 (Seed)",
    type: "number",
    default: -1,
    min: -1,
    max: 9999999999,
    description: "-1 为随机，设置具体值可复现相同结果",
  },
  {
    key: "steps",
    label: "采样步数 (Steps)",
    type: "slider",
    default: 20,
    min: 1,
    max: 50,
    step: 1,
    description: "扩散步数，越高细节越丰富，生成越慢",
  },
  {
    key: "guidance_scale",
    label: "CFG 引导系数",
    type: "slider",
    default: 7.5,
    min: 1,
    max: 30,
    step: 0.5,
    description: "提示词引导强度，越高越贴合 Prompt",
  },
  {
    key: "negative_prompt",
    label: "负面提示词 (Negative Prompt)",
    type: "text",
    default: "",
    description: "不希望出现在图片中的内容",
  },
];

const VIDEO_COMMON_PARAMS: ParamDefinition[] = [
  {
    key: "duration",
    label: "视频时长 (秒)",
    type: "select",
    default: 5,
    options: [
      { label: "3 秒", value: 3 },
      { label: "5 秒", value: 5 },
      { label: "10 秒", value: 10 },
      { label: "15 秒", value: 15 },
    ],
    description: "生成视频的时长",
  },
  {
    key: "aspect_ratio",
    label: "画面比例",
    type: "select",
    default: "16:9",
    options: [
      { label: "16:9 (横屏)", value: "16:9" },
      { label: "9:16 (竖屏)", value: "9:16" },
      { label: "1:1 (方形)", value: "1:1" },
    ],
    description: "视频画面的宽高比例",
  },
  {
    key: "fps",
    label: "帧率 (FPS)",
    type: "slider",
    default: 24,
    min: 12,
    max: 30,
    step: 1,
    description: "每秒帧数，越高越流畅",
  },
  {
    key: "seed",
    label: "随机种子 (Seed)",
    type: "number",
    default: -1,
    description: "-1 为随机",
  },
  {
    key: "negative_prompt",
    label: "负面提示词 (Negative Prompt)",
    type: "text",
    default: "",
    description: "不希望出现在视频中的内容",
  },
  {
    key: "camera_motion",
    label: "镜头运动",
    type: "select",
    default: "none",
    options: [
      { label: "无运动", value: "none" },
      { label: "推近 (Zoom In)", value: "zoom_in" },
      { label: "拉远 (Zoom Out)", value: "zoom_out" },
      { label: "左移 (Pan Left)", value: "pan_left" },
      { label: "右移 (Pan Right)", value: "pan_right" },
      { label: "上移 (Pan Up)", value: "pan_up" },
      { label: "下移 (Pan Down)", value: "pan_down" },
    ],
    description: "摄像头的运动方式",
  },
];

// ============================================================
// 注册的模型
// ============================================================

export const REGISTERED_MODELS: ModelDefinition[] = [
  {
    id: "agnes-image-2.1-flash",
    name: "Agnes Image 2.1 Flash",
    description: "快速图像生成模型，支持文生图和图生图",
    category: "image",
    params: IMAGE_COMMON_PARAMS,
  },
  {
    id: "agnes-image-2.0-flash",
    name: "Agnes Image 2.0 Flash",
    description: "上一代快速图像生成模型",
    category: "image",
    params: IMAGE_COMMON_PARAMS,
  },
  {
    id: "agnes-video-v2.0",
    name: "Agnes Video v2.0",
    description: "视频生成模型，支持文生视频和图生视频",
    category: "video",
    params: VIDEO_COMMON_PARAMS,
  },
  {
    id: "agnes-2.0-flash",
    name: "Agnes 2.0 Flash",
    description: "通用多模态生成模型",
    category: "image",
    params: IMAGE_COMMON_PARAMS,
  },
  {
    id: "agnes-1.5-flash",
    name: "Agnes 1.5 Flash",
    description: "轻量快速生成模型",
    category: "image",
    params: IMAGE_COMMON_PARAMS,
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return REGISTERED_MODELS.find((m) => m.id === id);
}

export function getParamsForModel(modelId: string): ParamDefinition[] {
  const model = getModelById(modelId);
  return model?.params ?? [];
}

export function getModelsByCategory(category: "image" | "video"): ModelDefinition[] {
  return REGISTERED_MODELS.filter((m) => m.category === category);
}
