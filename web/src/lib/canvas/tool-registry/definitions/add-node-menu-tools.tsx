import { Folder, FolderOpen, Layers3, Palette, UploadCloud, UserRound, Workflow } from "lucide-react";

import { getNodeIcon, getNodeLabel } from "@/lib/canvas/node-registry";
import { registerAddNodeMenuCommands, type AddNodeMenuCommand } from "@/lib/canvas/tool-registry";
import { CanvasNodeType } from "@/types/canvas";

/** 真正创建节点的命令，文案与图标统一取自节点注册表。 */
function nodeCommand(type: CanvasNodeType, rest: Omit<AddNodeMenuCommand, "id" | "label" | "icon" | "section">): AddNodeMenuCommand {
    return { id: type, label: getNodeLabel(type), icon: getNodeIcon(type), section: "node", ...rest };
}

export const addNodeMenuCommands: AddNodeMenuCommand[] = [
    // 项目级动作不占用节点网格，创作节点保持统一排列。
    { id: "style", label: "项目画风", icon: <Palette />, section: "project", defaultOrder: 10, hover: { tagline: "统一画面风格", description: "为项目设定统一的画面风格，作为后续创作的参照。" }, applicable: (ctx) => !ctx.isProjectLinked, run: (ctx) => ctx.handlers.onChooseStyle() },
    // 创作节点
    // 合并口径（2026-10-04 sync #2）：fork 的 hover 提示族（W6 节点菜单可发现性）
    // 与上游的「角色卡」节点条目并存。
    nodeCommand(CanvasNodeType.Text, { defaultOrder: 10, hover: { tagline: "添加文本节点", description: "在画布上放置文本节点，用来写提示词、说明或脚本草稿。", preview: "node" }, run: (ctx) => ctx.handlers.onAddText() }),
    nodeCommand(CanvasNodeType.Drawing, { defaultOrder: 20, hover: { tagline: "添加绘图节点", description: "放置一块手绘画板，可直接涂画，也能与其他节点连线配合。", preview: "node" }, run: (ctx) => ctx.handlers.onAddDrawing() }),
    nodeCommand(CanvasNodeType.Script, { badge: "核心", defaultOrder: 30, hover: { tagline: "添加分镜脚本", description: "以镜头为单位编写分镜脚本，规划每个镜头的内容与顺序。", preview: "node" }, run: (ctx) => ctx.handlers.onAddScript() }),
    nodeCommand(CanvasNodeType.Frame, { defaultOrder: 40, hover: { tagline: "添加视觉背板", description: "放置背板承托内容，把相关节点组织在一起。", preview: "node" }, applicable: (ctx) => ctx.workspaceMode !== "simple", run: (ctx) => ctx.handlers.onAddFrame() }),
    { id: "folder", label: "文件夹", icon: <Folder />, badge: "6 款", section: "node", defaultOrder: 45, hover: { tagline: "用文件夹收纳", description: "把相关节点收进同一个文件夹，拖动文件夹即可整体移动。", preview: "node" }, run: (ctx) => ctx.handlers.onAddFolder() },
    nodeCommand(CanvasNodeType.Image, { defaultOrder: 50, hover: { tagline: "添加图片节点", description: "放置图片节点，用于生成、编辑或引用图片素材。", preview: "node" }, run: (ctx) => ctx.handlers.onAddImage() }),
    { id: "project-character", label: "角色卡", icon: <UserRound />, section: "node", defaultOrder: 55, hover: { tagline: "添加角色卡", description: "为项目添加可复用的角色设定，生成时保持角色一致。", preview: "node" }, run: (ctx) => ctx.handlers.onOpenProjectCharacters() },
    nodeCommand(CanvasNodeType.Video, { defaultOrder: 60, hover: { tagline: "添加视频节点", description: "放置视频节点，用于生成与处理视频内容。", preview: "node" }, run: (ctx) => ctx.handlers.onAddVideo() }),
    nodeCommand(CanvasNodeType.BatchTable, { defaultOrder: 66, hover: { tagline: "批量发起生成", description: "把提示词与参数放进表格，一次批量发起多条生成任务。", preview: "node" }, run: (ctx) => ctx.handlers.onAddExtensionNode(CanvasNodeType.BatchTable) }),
    nodeCommand(CanvasNodeType.MediaConversion, { badge: "本地", defaultOrder: 65, hover: { tagline: "本地格式转换", description: "在本地把图片或视频转换成需要的格式。", preview: "node" }, run: (ctx) => ctx.handlers.onAddExtensionNode(CanvasNodeType.MediaConversion) }),
    // 导演台落在节点分区，但它开的是导演工作台、不是某种画布节点，故不走注册表。
    { id: "director", label: "导演台", icon: <Layers3 />, badge: "3D", section: "node", defaultOrder: 70, hover: { tagline: "打开 3D 导演台", description: "打开 3D 导演台，搭建立体场景并调整镜头机位。", preview: "node" }, applicable: (ctx) => ctx.workspaceMode !== "simple", run: (ctx) => ctx.handlers.onOpenDirector() },
    nodeCommand(CanvasNodeType.Audio, { defaultOrder: 80, hover: { tagline: "添加音频节点", description: "放置音频节点，用于配音、配乐与声音素材整理。", preview: "node" }, applicable: (ctx) => ctx.workspaceMode !== "simple", run: (ctx) => ctx.handlers.onAddAudio() }),
    // 云端和本地工作流共用独立配置节点，不进入基础模型节点的渠道选择。
    { id: "workflow", label: "工作流", icon: <Workflow />, section: "workflow", defaultOrder: 10, hover: { tagline: "运行工作流", description: "载入云端或本地工作流，批量执行复杂流程。" }, applicable: (ctx) => ctx.workspaceMode !== "simple", run: (ctx) => ctx.handlers.onAddWorkflow() },
    // 导入资源
    { id: "upload", label: "上传文件", icon: <UploadCloud />, section: "resource", defaultOrder: 10, hover: { tagline: "上传本地文件", description: "把本地图片、视频等文件上传到画布，作为创作素材。" }, run: (ctx) => ctx.handlers.onUpload() },
    { id: "project-character", label: "添加角色卡", icon: <UserRound />, section: "resource", defaultOrder: 20, hover: { tagline: "复用角色设定", description: "为项目添加可复用的角色设定，生成时保持角色一致。" }, applicable: (ctx) => ctx.isProjectLinked, run: (ctx) => ctx.handlers.onOpenProjectCharacters() },
    { id: "assets", label: "素材库", icon: <FolderOpen />, section: "resource", defaultOrder: 30, hover: { tagline: "选取素材插入画布", description: "浏览项目中已有的素材，选择后插入画布复用。" }, applicable: (ctx) => !ctx.isProjectLinked, run: (ctx) => ctx.handlers.onOpenMyAssets() },
];

registerAddNodeMenuCommands(addNodeMenuCommands);
